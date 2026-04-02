import { useState, useRef } from 'react';
import { ArrowLeft, Camera, Sparkles, Check, MapPin, X, Heart, MessageCircle, Send, Pencil, Loader2, Plus, GripVertical, RotateCcw, RotateCw } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { Category } from '../types';
import { supabase, getPublicUrl } from '../lib/supabase';
import { googleTypesToCategory } from '../lib/placeUtils';
import PlaceSearch from '../components/PlaceSearch';

type Step = 'upload' | 'places' | 'preview';
type Visibility = 'map' | 'profile' | 'feed';

interface IdentifiedPlace {
  id: string;
  photo: string;
  name: string;
  category: Category | '';
  neighborhood: string;
  city: string;
  country: string;
  analyzing: boolean;
  expanded: boolean;
  lat?: number;
  lng?: number;
}

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

// Extract only the place name (first comma-separated component)
const shortName = (name: string) => name.split(',')[0].trim();


async function readExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        const view = new DataView(buf);
        if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
        let offset = 2;
        while (offset < view.byteLength - 2) {
          const marker = view.getUint16(offset);
          const len = view.getUint16(offset + 2);
          if (marker === 0xFFE1) {
            const exifHeader = String.fromCharCode(...new Uint8Array(buf, offset + 4, 4));
            if (exifHeader === 'Exif') {
              const tiffOffset = offset + 10;
              const littleEndian = view.getUint16(tiffOffset) === 0x4949;
              const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
              const ifdCount = view.getUint16(tiffOffset + ifdOffset, littleEndian);
              let gpsIfdOffset: number | null = null;
              for (let i = 0; i < ifdCount; i++) {
                const entryOffset = tiffOffset + ifdOffset + 2 + i * 12;
                const tag = view.getUint16(entryOffset, littleEndian);
                if (tag === 0x8825) gpsIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
              }
              if (gpsIfdOffset !== null) {
                const gpsCount = view.getUint16(tiffOffset + gpsIfdOffset, littleEndian);
                let latRef = 'N', lngRef = 'E';
                let lat: number[] | null = null, lng: number[] | null = null;
                for (let i = 0; i < gpsCount; i++) {
                  const eOff = tiffOffset + gpsIfdOffset + 2 + i * 12;
                  const tag = view.getUint16(eOff, littleEndian);
                  if (tag === 1) latRef = String.fromCharCode(view.getUint8(eOff + 8));
                  if (tag === 3) lngRef = String.fromCharCode(view.getUint8(eOff + 8));
                  if (tag === 2 || tag === 4) {
                    const valOffset = view.getUint32(eOff + 8, littleEndian);
                    const coords = [0, 1, 2].map(j => {
                      const num = view.getUint32(tiffOffset + valOffset + j * 8, littleEndian);
                      const den = view.getUint32(tiffOffset + valOffset + j * 8 + 4, littleEndian);
                      return den !== 0 ? num / den : 0;
                    });
                    if (tag === 2) lat = coords;
                    else lng = coords;
                  }
                }
                if (lat && lng) {
                  const toDecimal = (d: number[]) => d[0] + d[1] / 60 + d[2] / 3600;
                  resolve({
                    lat: latRef === 'S' ? -toDecimal(lat) : toDecimal(lat),
                    lng: lngRef === 'W' ? -toDecimal(lng) : toDecimal(lng),
                  });
                  return;
                }
              }
            }
          }
          offset += 2 + len;
        }
      } catch { /* no EXIF */ }
      resolve(null);
    };
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

async function lookupPlaceFromGps(lat: number, lng: number): Promise<Partial<IdentifiedPlace> | null> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.types,places.addressComponents',
      },
      body: JSON.stringify({
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 100 } },
        maxResultCount: 1,
        excludedTypes: ['locality', 'political', 'country', 'route', 'street_address'],
        languageCode: 'en',
      }),
    });
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    const name = shortName(place.displayName?.text ?? '');
    const types: string[] = place.types ?? [];
    const category = googleTypesToCategory(types);
    const addrComps: { types: string[]; longText?: string; shortText?: string }[] = place.addressComponents ?? [];
    const addrVal = (c: typeof addrComps[0]) => c.longText || c.shortText || '';
    const addrFind = (...t: string[]) => { const c = addrComps.find(c => t.some(x => c.types?.includes(x))); return c ? addrVal(c) : ''; };
    const neighborhood = addrFind('sublocality_level_1') || addrFind('sublocality_level_2') || addrFind('neighborhood') || addrFind('sublocality');
    const city = addrFind('postal_town') || addrFind('locality') || addrFind('administrative_area_level_2') || addrFind('administrative_area_level_1');
    const country = addrFind('country');
    return { name, category, neighborhood, city, country, lat, lng };
  } catch { return null; }
}

const categories: { id: Category; label: string; emoji: string }[] = [
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { id: 'cafe', label: 'Café', emoji: '☕' },
  { id: 'bar', label: 'Bar', emoji: '🍸' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'hotel', label: 'Stay', emoji: '🏨' },
  { id: 'attraction', label: 'Attraction', emoji: '🏛️' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'beach', label: 'Beach', emoji: '🏖️' },
  { id: 'shop', label: 'Shop', emoji: '🛍️' },
  { id: 'experience', label: 'Experience', emoji: '🗺️' },
  { id: 'sports', label: 'Sports', emoji: '🎾' },
  { id: 'wellness', label: 'Wellness', emoji: '💆' },
  { id: 'street', label: 'Street', emoji: '🏙️' },
  { id: 'event', label: 'Event', emoji: '🎟️' },
  { id: 'flight', label: 'Flight', emoji: '✈️' },
  { id: 'transport', label: 'Transport', emoji: '🚗' },
];

interface Props {
  userId: string;
  userAvatar?: string | null;
  onComplete: (info: { visibility: Visibility; placesCount: number }) => void;
}

// ── Photo editor (crop + rotate) ─────────────────────────────────────────────

function PhotoEditor({ src, onApply, onClose }: { src: string; onApply: (newUrl: string) => void; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [editSrc, setEditSrc] = useState(src);
  const [rotating, setRotating] = useState(false);

  const rotate = async (deg: number) => {
    setRotating(true);
    const img = new Image();
    img.src = editSrc;
    await new Promise<void>(r => { img.onload = () => r(); });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const W = img.naturalWidth, H = img.naturalHeight;
    const is90 = Math.abs(deg) === 90;
    canvas.width = is90 ? H : W;
    canvas.height = is90 ? W : H;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -W / 2, -H / 2);
    canvas.toBlob(blob => {
      if (blob) { setEditSrc(URL.createObjectURL(blob)); setCrop(undefined); }
      setRotating(false);
    }, 'image/jpeg', 0.95);
  };

  const handleApply = () => {
    const img = imgRef.current;
    if (!img || !crop?.width || !crop?.height) { onApply(editSrc); return; }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    canvas.width = Math.round(crop.width * scaleX);
    canvas.height = Math.round(crop.height * scaleY);
    ctx.drawImage(img, crop.x * scaleX, crop.y * scaleY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      onApply(blob ? URL.createObjectURL(blob) : editSrc);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
        <button onClick={onClose} className="text-white/60 text-sm font-medium">Cancel</button>
        <div className="flex gap-2">
          <button
            onClick={() => rotate(-90)}
            disabled={rotating}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-40"
          >
            <RotateCcw size={16} className="text-white" />
          </button>
          <button
            onClick={() => rotate(90)}
            disabled={rotating}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-40"
          >
            <RotateCw size={16} className="text-white" />
          </button>
        </div>
        <button onClick={handleApply} className="text-white font-semibold text-sm">Apply</button>
      </div>

      {/* Crop area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-2">
        <ReactCrop crop={crop} onChange={c => setCrop(c)} style={{ maxHeight: '100%' }}>
          <img
            ref={imgRef}
            src={editSrc}
            alt="Edit"
            style={{ maxHeight: '65vh', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          />
        </ReactCrop>
      </div>

      <p className="text-white/30 text-xs text-center py-4 flex-shrink-0">
        Drag to crop · Tap arrows to rotate
      </p>
    </div>
  );
}

// ── Sortable place row ────────────────────────────────────────────────────────

function SortablePlaceRow({
  p,
  onToggleExpanded,
  onRemove,
  onUpdate,
  onEditPhoto,
}: {
  p: IdentifiedPlace;
  onToggleExpanded: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<IdentifiedPlace>) => void;
  onEditPhoto: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : undefined,
  };

  const needsAddress = !p.analyzing && !p.name;

  return (
    <div ref={setNodeRef} style={style} className={`rounded-2xl transition-colors ${needsAddress ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing p-1 flex-shrink-0 -ml-1"
          style={{ touchAction: 'none' }}
        >
          <GripVertical size={16} className="text-gray-300" />
        </button>

        {/* Photo — tap to edit */}
        <button
          onClick={() => !p.analyzing && onEditPhoto(p.id)}
          className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 active:scale-95 transition-transform"
        >
          <img src={p.photo} alt="" className="w-full h-full object-cover" />
          {p.analyzing ? (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Sparkles size={14} className="text-white animate-pulse" />
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Pencil size={12} className="text-white" />
              </div>
              {needsAddress ? (
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                  <span className="text-white text-[9px] font-black">!</span>
                </div>
              ) : (
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={10} className="text-white" strokeWidth={3} />
                </div>
              )}
            </>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {p.analyzing ? (
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded-full w-3/4 animate-pulse" />
              <div className="h-2.5 bg-gray-200 rounded-full w-1/2 animate-pulse" />
            </div>
          ) : needsAddress ? (
            <button className="text-left w-full" onClick={() => onToggleExpanded(p.id)}>
              <p className="font-semibold text-amber-600 text-sm">Address required</p>
              <p className="text-xs text-amber-400 mt-0.5">Tap to search on Google Maps</p>
            </button>
          ) : (
            <>
              <p className="font-bold text-gray-900 text-sm truncate">{p.name}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin size={10} />
                {[p.neighborhood, p.city, p.country].filter(Boolean).join(', ') || p.country}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!p.analyzing && (
            <button
              onClick={() => onToggleExpanded(p.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                p.expanded ? 'bg-gray-900' : needsAddress ? 'bg-amber-400' : 'bg-white shadow-sm'
              }`}
            >
              <Pencil size={13} className={p.expanded || needsAddress ? 'text-white' : 'text-gray-500'} />
            </button>
          )}
          <button
            onClick={() => onRemove(p.id)}
            className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center"
          >
            <X size={12} className="text-gray-400" />
          </button>
        </div>
      </div>

      {p.expanded && !p.analyzing && (
        <div className="border-t border-gray-100 bg-white px-3 pb-3 pt-3 rounded-b-2xl overflow-visible">
          <div className="mb-3">
            <PlaceSearch onSelect={result => onUpdate(p.id, result as Partial<IdentifiedPlace>)} />
          </div>
          <input
            value={p.name}
            onChange={e => onUpdate(p.id, { name: e.target.value })}
            className="font-bold text-gray-900 text-sm w-full outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-gray-500 pb-0.5 mb-2 transition-colors"
            placeholder="Place name"
          />
          <div className="flex items-center mb-3" style={{ gap: '4px' }}>
            <MapPin size={10} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 flex items-center" style={{ gap: 0 }}>
              <input
                value={p.neighborhood}
                onChange={e => onUpdate(p.id, { neighborhood: e.target.value })}
                className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                style={{ width: `${Math.max(52, (p.neighborhood || 'Neighbourhood').length * 7.2)}px`, padding: 0, margin: 0 }}
                placeholder="Neighbourhood"
              /><span>,&nbsp;</span><input
                value={p.city}
                onChange={e => onUpdate(p.id, { city: e.target.value })}
                className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                style={{ width: `${Math.max(28, (p.city || 'City').length * 7.2)}px`, padding: 0, margin: 0 }}
                placeholder="City"
              /><span>,&nbsp;</span><input
                value={p.country}
                onChange={e => onUpdate(p.id, { country: e.target.value })}
                className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                style={{ width: `${Math.max(40, (p.country || 'Country').length * 7.2)}px`, padding: 0, margin: 0 }}
                placeholder="Country"
              />
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onUpdate(p.id, { category: cat.id })}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  p.category === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span>{cat.emoji}</span><span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Add({ userId, userAvatar, onComplete }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [places, setPlaces] = useState<IdentifiedPlace[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('feed');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [extraHashtags, setExtraHashtags] = useState<string[]>([]);
  const [extraTagInput, setExtraTagInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [editingPlaces, setEditingPlaces] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);
  const carouselStartX = useRef(0);
  const carouselDragging = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPlaces(prev => {
        const oldIndex = prev.findIndex(p => p.id === active.id);
        const newIndex = prev.findIndex(p => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const analyzeEntries = (entries: IdentifiedPlace[], files: File[]) => {
    entries.forEach(async (entry, i) => {
      const file = files[i];
      let result: Partial<IdentifiedPlace> | null = null;
      if (file) {
        const gps = await readExifGps(file);
        if (gps) {
          if (GOOGLE_PLACES_KEY) {
            result = await lookupPlaceFromGps(gps.lat, gps.lng);
          }
          result = { ...(result ?? {}), lat: gps.lat, lng: gps.lng };
        }
      }
      setPlaces(prev => prev.map(p =>
        p.id === entry.id ? { ...p, ...(result ?? {}), analyzing: false } : p
      ));
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const entries: IdentifiedPlace[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      photo: URL.createObjectURL(f),
      name: '', category: '', neighborhood: '', city: '', country: '',
      analyzing: true, expanded: false,
    }));
    setPlaces(entries);
    setStep('places');
    analyzeEntries(entries, files);
    e.target.value = '';
  };

  const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const entries: IdentifiedPlace[] = files.map((f, i) => ({
      id: `${Date.now()}-add-${i}`,
      photo: URL.createObjectURL(f),
      name: '', category: '', neighborhood: '', city: '', country: '',
      analyzing: true, expanded: false,
    }));
    setPlaces(prev => [...prev, ...entries]);
    analyzeEntries(entries, files);
    e.target.value = '';
  };

  const removePlace = (id: string) => setPlaces(prev => prev.filter(p => p.id !== id));
  const updatePlace = (id: string, updates: Partial<IdentifiedPlace>) =>
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  const toggleExpanded = (id: string) =>
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, expanded: !p.expanded } : p));

  const handlePhotoEdited = (id: string, newUrl: string) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, photo: newUrl } : p));
    setEditingPhotoId(null);
  };

  // ── Save post to Supabase ──────────────────────────────────────────
  const handlePost = async () => {
    if (!userId || userId === 'demo-user') {
      onComplete({ visibility, placesCount: places.length });
      return;
    }
    setPosting(true);
    setPostError('');
    try {
      const uploadedPlaces = await Promise.all(places.map(async (p, i) => {
        const blob = await fetch(p.photo).then(r => r.blob());
        const ext = blob.type.split('/')[1] ?? 'jpg';
        const path = `${userId}/${Date.now()}-${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('post-photos')
          .upload(path, blob, { upsert: true });
        if (uploadErr) throw uploadErr;
        return { ...p, photoUrl: getPublicUrl('post-photos', path) };
      }));

      // Enrich any places still missing neighborhood / city / category before saving
      const enrichedPlaces = await Promise.all(uploadedPlaces.map(async (p) => {
        if (!p.name || (p.neighborhood && p.city && p.category && p.lat != null)) return p;
        try {
          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'places.addressComponents,places.types,places.location' },
            body: JSON.stringify({ textQuery: [p.name, p.city, p.country].filter(Boolean).join(', '), languageCode: 'en' }),
          });
          const data = await res.json();
          const place = data.places?.[0];
          if (!place) return p;
          const comps: { types: string[]; longText?: string; shortText?: string }[] = place.addressComponents ?? [];
          const types: string[] = place.types ?? [];
          const find = (...t: string[]) => { const c = comps.find(c => t.some(x => c.types?.includes(x))); return c ? (c.longText || c.shortText || '') : ''; };
          const neighborhood = find('sublocality_level_1') || find('sublocality_level_2') || find('neighborhood') || find('sublocality');
          const city = find('postal_town') || find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1');
          const country = find('country');
          const category = googleTypesToCategory(types);
          const lat = p.lat ?? (place.location?.latitude ?? null);
          const lng = p.lng ?? (place.location?.longitude ?? null);
          return {
            ...p,
            neighborhood: p.neighborhood || neighborhood,
            city: p.city || city,
            country: p.country || country,
            category: (p.category || category) as Category | '',
            lat,
            lng,
          };
        } catch { return p; }
      }));

      const allHashtags = [
        ...enrichedPlaces.map(p => shortName(p.name).replace(/\s+/g, '')),
        ...[...new Set(enrichedPlaces.map(p => p.city).filter(Boolean))],
        ...extraHashtags,
      ];
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({ user_id: userId, caption, visibility, hashtags: allHashtags, location_label: locationLabel })
        .select()
        .single();
      if (postErr) throw postErr;

      const placesRows = enrichedPlaces.map((p, i) => ({
        post_id: post.id,
        name: shortName(p.name),
        category: p.category || null,
        neighborhood: p.neighborhood || null,
        city: p.city,
        country: p.country,
        photo_url: p.photoUrl,
        position: i,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
      }));
      const { error: placesErr } = await supabase.from('post_places').insert(placesRows);
      if (placesErr) throw placesErr;

      onComplete({ visibility, placesCount: places.length });
    } catch (err: any) {
      setPostError(err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const primaryPlace = places[0];
  const uniqueCities = [...new Set(places.map(p => p.city).filter(Boolean))];
  const locationLabel = primaryPlace
    ? places.length === 1
      ? `${shortName(primaryPlace.name)} · ${primaryPlace.city}`
      : uniqueCities.length > 1
        ? `${shortName(primaryPlace.name)}, ${primaryPlace.city} +${places.length - 1}`
        : `${shortName(primaryPlace.name)} +${places.length - 1} · ${primaryPlace.city}`
    : '';

  const visibilityOptions: { value: Visibility; label: string }[] = [
    { value: 'map', label: 'Private' },
    { value: 'profile', label: 'Followers' },
    { value: 'feed', label: 'Everyone' },
  ];

  // ── Photo editor overlay ───────────────────────────────────────────
  const editingPlace = editingPhotoId ? places.find(p => p.id === editingPhotoId) : null;
  if (editingPlace) {
    return (
      <PhotoEditor
        src={editingPlace.photo}
        onApply={newUrl => handlePhotoEdited(editingPhotoId!, newUrl)}
        onClose={() => setEditingPhotoId(null)}
      />
    );
  }

  // ── UPLOAD ────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-5 pb-3">
          <button onClick={() => onComplete({ visibility, placesCount: 0 })}>
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
        </div>
        <div className="px-4 mb-6">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">New post</h1>
          <p className="text-sm text-gray-400 mt-0.5">Upload photos and tag each place</p>
        </div>

        <div className="px-4 flex-1 flex flex-col">
          <label
            className="relative flex-1 flex flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 active:bg-gray-100 transition-colors min-h-80 cursor-pointer overflow-hidden"
          >
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Camera size={30} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <div className="text-center px-8">
              <p className="font-bold text-gray-700 text-base">Select your photos</p>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                Upload your photos, then search to tag each place
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-4 py-2 rounded-full">
              Choose photos
            </span>
          </label>

          <div className="pb-12 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-300 font-medium">How it works</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-3">
              {[
                { icon: '📸', text: 'Upload one or more photos of the places you visited' },
                { icon: '🔍', text: 'Search to tag the place name and city' },
                { icon: '↕️', text: 'Drag to reorder · tap photo to crop or rotate' },
                { icon: '✏️', text: 'Write one caption for the whole post' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-base">{item.icon}</span>
                  <p className="text-sm text-gray-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLACES ────────────────────────────────────────────────────────
  if (step === 'places') {
    const anyAnalyzing = places.some(p => p.analyzing);
    const analyzingCount = places.filter(p => p.analyzing).length;
    const missingAddress = places.filter(p => !p.analyzing && !p.name);
    const allAddressed = !anyAnalyzing && missingAddress.length === 0;

    if (places.length === 0) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
          <p className="text-gray-400 text-sm text-center">All places removed.</p>
          <button onClick={() => setStep('upload')} className="text-gray-900 font-semibold text-sm underline">
            Start over
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white flex flex-col">

        <div className="px-4 pt-5 pb-3">
          <button onClick={() => setStep('upload')} className="mb-3">
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {anyAnalyzing ? 'Checking location data' : `${places.length} place${places.length !== 1 ? 's' : ''} added`}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {anyAnalyzing
              ? `${analyzingCount} remaining…`
              : missingAddress.length > 0
                ? `${missingAddress.length} place${missingAddress.length !== 1 ? 's' : ''} still need${missingAddress.length === 1 ? 's' : ''} an address`
                : 'All places tagged — ready to continue'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4 space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={places.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {places.map(p => (
                <SortablePlaceRow
                  key={p.id}
                  p={p}
                  onToggleExpanded={toggleExpanded}
                  onRemove={removePlace}
                  onUpdate={updatePlace}
                  onEditPhoto={id => setEditingPhotoId(id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <label
            id="places-add-more-label"
            className="relative w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium active:bg-gray-50 transition-colors cursor-pointer overflow-hidden"
          >
            <input ref={addMoreRef} type="file" accept="image/*" multiple onChange={handleAddMore} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Camera size={16} strokeWidth={1.5} />
            Add more photos
          </label>
        </div>

        <div className="px-4 pb-6 pt-3 border-t border-gray-100">
          {!anyAnalyzing && missingAddress.length > 0 && (
            <p className="text-center text-xs text-amber-500 font-medium mb-2">
              Search an address for every photo to continue
            </p>
          )}
          <button
            onClick={() => setStep('preview')}
            disabled={!allAddressed}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all ${
              !allAddressed ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-slate-900 text-white'
            }`}
          >
            {anyAnalyzing ? 'Checking location…' : 'Write your caption'}
          </button>
        </div>
      </div>
    );
  }

  // ── PREVIEW ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">

      <div className="flex-1 overflow-y-auto">
        <div>
          <div className="px-4 pt-4 pb-2">
            <button onClick={() => setStep('places')}><ArrowLeft className="w-6 h-6 text-slate-700" /></button>
          </div>

          <div className="border-y border-gray-100">
            <div className="flex items-start gap-3 px-4 pt-3 pb-2">
              <img src={userAvatar ?? '/aitana-avatar.jpg'} alt="" className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">You</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1 truncate">
                  <MapPin size={10} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  {locationLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditingPlaces(prev => !prev)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    editingPlaces ? 'bg-gray-900' : 'bg-gray-100'
                  }`}
                >
                  <Pencil size={14} strokeWidth={1.5} className={editingPlaces ? 'text-white' : 'text-gray-500'} />
                </button>
                <label
                  className="relative w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden"
                >
                  <input ref={addMoreRef} type="file" accept="image/*" multiple onChange={handleAddMore} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Plus size={16} strokeWidth={1.5} className="text-gray-500" />
                </label>
              </div>
            </div>

            {/* Carousel */}
            {places.length > 0 && (
              <div
                className="relative overflow-hidden select-none"
                onPointerDown={e => { carouselStartX.current = e.clientX; carouselDragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                onPointerUp={e => {
                  if (!carouselDragging.current) return;
                  carouselDragging.current = false;
                  const delta = carouselStartX.current - e.clientX;
                  if (Math.abs(delta) > 40) setCarouselIndex(i => Math.max(0, Math.min(places.length - 1, i + (delta > 0 ? 1 : -1))));
                }}
                onPointerCancel={() => { carouselDragging.current = false; }}
              >
                <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                  {places.map(p => (
                    <img key={p.id} src={p.photo} alt="" draggable={false} className="w-full flex-shrink-0 aspect-[4/5] object-cover pointer-events-none" />
                  ))}
                </div>
                {places.length > 1 && (
                  <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                    {places.map((_, i) => (
                      <button key={i} onClick={() => setCarouselIndex(i)} className={`rounded-full transition-all duration-200 ${i === carouselIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
                    ))}
                  </div>
                )}
                {places[carouselIndex] && (
                  <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <MapPin size={8} className="text-white/80 flex-shrink-0" />
                    <span className="text-white text-[11px] font-semibold leading-none">{places[carouselIndex].name || 'Unnamed'}</span>
                  </div>
                )}
              </div>
            )}

            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1.5">
                    <Heart size={22} strokeWidth={1.5} className="text-gray-700" />
                    <span className="text-xs text-gray-500">0</span>
                  </button>
                  <button className="flex items-center gap-1.5">
                    <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
                    <span className="text-xs text-gray-500">0</span>
                  </button>
                  <button><Send size={22} strokeWidth={1.5} className="text-gray-700" /></button>
                </div>
                <button className="px-5 py-1.5 rounded-full border border-gray-900 text-sm font-semibold text-gray-900">Save</button>
              </div>
            </div>

            {caption && (
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-700 leading-snug line-clamp-2">{caption}</p>
              </div>
            )}
            {!caption && <div className="pb-3" />}
          </div>
        </div>

        {/* Inline place editing in preview */}
        {editingPlaces && (
          <div className="border-b border-gray-100 bg-gray-50/50">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {places.length} Place{places.length !== 1 ? 's' : ''} tagged
              </p>
            </div>
            <div className="px-4 pb-4 space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={places.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {places.map(p => (
                    <SortablePlaceRow
                      key={p.id}
                      p={p}
                      onToggleExpanded={toggleExpanded}
                      onRemove={removePlace}
                      onUpdate={updatePlace}
                      onEditPhoto={id => setEditingPhotoId(id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <label
                className="relative w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium active:bg-gray-50 transition-colors cursor-pointer overflow-hidden"
              >
                <input ref={addMoreRef} type="file" accept="image/*" multiple onChange={handleAddMore} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Camera size={16} strokeWidth={1.5} />
                Add more photos
              </label>
            </div>
          </div>
        )}

        {/* Caption / Hashtags / Privacy */}
        <div className="bg-white px-4 pt-6 pb-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Caption</p>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={places.length > 1
              ? `a ${places[0]?.city?.toLowerCase() ?? 'trip'} day done right…`
              : 'Write something about this place…'}
            rows={2}
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-900 outline-none placeholder-gray-300 focus:bg-gray-100 resize-none transition-colors leading-relaxed"
          />

          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-5">Hashtags</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-gray-50 rounded-2xl px-4 py-3">
            {places.map(p => (
              <span key={p.id} className="text-[12px] font-medium text-slate-400">#{shortName(p.name).replace(/\s+/g, '')}</span>
            ))}
            {[...new Set(places.map(p => p.city).filter(Boolean))].map(city => (
              <span key={city} className="text-[12px] font-medium text-slate-400">#{city.replace(/\s+/g, '')}</span>
            ))}
            {extraHashtags.filter(t => t.trim()).map(t => (
              <span key={t} className="text-[12px] font-medium text-slate-400">#{t.replace(/^#+/, '').replace(/\s+/g, '')}</span>
            ))}
            <input
              value={extraTagInput}
              onChange={e => setExtraTagInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === ' ' || e.key === 'Enter') && extraTagInput.trim()) {
                  e.preventDefault();
                  setExtraHashtags(prev => [...prev, extraTagInput.trim()]);
                  setExtraTagInput('');
                }
              }}
              placeholder="+ add"
              className="text-[12px] font-medium text-slate-500 bg-transparent outline-none placeholder-slate-300"
              style={{ width: `${Math.max(40, (extraTagInput.length + 5) * 7)}px` }}
            />
          </div>

          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-5">Privacy</p>
          <div className="flex gap-2">
            {visibilityOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  visibility === opt.value ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {postError && (
            <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-3 mt-4">{postError}</p>
          )}
          <button
            onClick={handlePost}
            disabled={posting}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base mt-5 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {posting && <Loader2 size={18} className="animate-spin" />}
            {posting ? 'Posting…' : visibility === 'feed' ? 'Post to curio' : visibility === 'profile' ? 'Share with followers' : 'Save privately'}
          </button>
        </div>
      </div>
    </div>
  );
}
