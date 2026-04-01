import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { Search, Plus, BadgeCheck, Lock, ArrowLeft, CalendarDays, MapPin, ChevronRight, Clock, Plane, Share2, Bookmark, BookmarkCheck, X, AlignLeft, Users, Pencil, UserPlus, Loader2, Link } from 'lucide-react';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

function LocationSearch({ value, onChange, onCoverImage }: { value: string; onChange: (val: string) => void; onCoverImage?: (url: string) => void }) {
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
          body: JSON.stringify({ input: val, languageCode: 'en' }),
        });
        const data = await res.json();
        setSuggestions(
          (data.suggestions ?? [])
            .map((s: any) => ({ placeId: s.placePrediction?.placeId ?? '', text: s.placePrediction?.text?.text ?? '' }))
            .filter((s: any) => s.placeId)
            .slice(0, 5)
        );
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 400);
  };

  const handleSelect = async (placeId: string, text: string) => {
    onChange(text);
    setSuggestions([]);
    if (onCoverImage) {
      try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=photos`, {
          headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'photos' },
        });
        const data = await res.json();
        const photoName = data.photos?.[0]?.name;
        if (photoName) {
          onCoverImage(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`);
        }
      } catch { /* silent */ }
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
        <MapPin size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
        <input
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Location (optional)"
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
        {searching && <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />}
      </div>
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          {suggestions.map(s => (
            <button
              key={s.placeId}
              onClick={() => handleSelect(s.placeId, s.text)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function CoverCropModal({ file, onConfirm, onCancel }: {
  file: File;
  onConfirm: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}) {
  const imgSrc = useState(() => URL.createObjectURL(file))[0];
  const [translateY, setTranslateY] = useState(0);
  const lastY = useRef(0);
  const isDragging = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const FRAME_W = 320;
  const FRAME_H = Math.round(FRAME_W * 208 / 384); // ~173px

  const clamp = (val: number) => {
    if (!imgRef.current) return val;
    const min = -(imgRef.current.clientHeight - FRAME_H);
    return Math.max(min, Math.min(0, val));
  };

  const onLoad = () => {
    if (imgRef.current) setTranslateY(clamp(-(imgRef.current.clientHeight - FRAME_H) / 2));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastY.current = e.clientY;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setTranslateY(prev => clamp(prev + (e.clientY - lastY.current)));
    lastY.current = e.clientY;
  };

  const onPointerUp = () => { isDragging.current = false; };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const cropTop = -translateY;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = Math.round(800 * FRAME_H / FRAME_W);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, cropTop * scaleY, img.clientWidth * scaleX, FRAME_H * scaleY, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) onConfirm(blob, URL.createObjectURL(blob));
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black flex flex-col" style={{ maxWidth: 384, margin: '0 auto' }}>
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onCancel} className="text-sm text-white/70 font-medium">Cancel</button>
        <p className="text-sm font-bold text-white">Adjust cover</p>
        <button onClick={handleConfirm} className="text-sm font-bold text-white">Done</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <div
          className="relative overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing"
          style={{ width: FRAME_W, height: FRAME_H }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            onLoad={onLoad}
            style={{ width: FRAME_W, height: 'auto', transform: `translateY(${translateY}px)`, userSelect: 'none', pointerEvents: 'none', display: 'block' }}
            draggable={false}
          />
          <div className="absolute inset-0 ring-2 ring-white/40 rounded-2xl pointer-events-none" />
        </div>
        <p className="text-white/40 text-xs">Drag to reposition</p>
      </div>
    </div>
  );
}

import { collections, places, users } from '../data/mockData';
import type { Category, Collection, Place } from '../types';
import { getPlans, createPlan as dbCreatePlan, updatePlan as dbUpdatePlan, deletePlan as dbDeletePlan, syncPlanCollaborators, getUserCollections, createCollection, searchProfiles, getFollowerProfiles, getFollowingProfiles, createPlanDay, createPlanItem, updatePlanItem, deletePlanDay, deletePlanItem, createItemInvite, getItemInvites, updateItemInviteStatus, type Plan as DBPlan, type SavedPlace, type FollowProfile, type ItemInvite } from '../lib/supabase';
import { getSavedPlaces, supabase, getPublicUrl } from '../lib/supabase';
import BookingSheet from '../components/BookingSheet';

const MapView = lazy(() => import('../components/MapView'));

type SavedTab = 'Places' | 'Collections' | 'Trips' | 'Map';

interface TripItem {
  id: string;
  name: string;
  category: string;
  image: string;
  address?: string;
  neighborhood?: string;
  time?: string;
  timeEnd?: string;
  notes?: string;
  location?: string;
  status?: 'none' | 'pending' | 'booked';
  checkIn?: string;
  checkOut?: string;
  booked?: boolean;
}

interface TripDay {
  id?: string;
  label: string;
  items: TripItem[];
}

interface TripCollaborator {
  id: string;
  name: string;
  avatar: string;
}

interface Trip {
  id: string;
  destination: string;
  country: string;
  dates: string;
  coverImage: string;
  status: 'dreaming' | 'planning' | 'upcoming' | 'past';
  days: TripDay[];
  collaborators?: TripCollaborator[];
  description?: string;
}

const mockTrips: Trip[] = [
  {
    id: 'trip-6',
    destination: 'Barcelona',
    country: 'Spain',
    dates: '',
    coverImage: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&q=80',
    status: 'dreaming',
    days: [],
  },
  {
    id: 'trip-2',
    destination: 'Tokyo',
    country: 'Japan',
    dates: 'May 16 – May 28, 2025',
    coverImage: '/shibuya-crossing.jpg',
    status: 'upcoming',
    days: [
      {
        label: 'Day 1 · Thu Apr 10',
        items: [
          { id: 'ti-7', name: 'Shibuya Coffee Festival', category: 'Event', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80', time: '10:00 AM', booked: true },
          { id: 'ti-8', name: 'Ichiran Ramen', category: 'Restaurant', image: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&q=80', time: '7:00 PM' },
        ],
      },
      {
        label: 'Day 2 · Fri Apr 11',
        items: [],
      },
    ],
  },
  {
    id: 'trip-4',
    destination: 'Seattle',
    country: 'USA',
    dates: 'Apr 15 – Apr 18, 2025',
    coverImage: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=600&q=80',
    status: 'upcoming',
    days: [
      { label: 'Day 1 · Tue Apr 15', items: [] },
      { label: 'Day 2 · Wed Apr 16', items: [] },
      { label: 'Day 3 · Thu Apr 17', items: [] },
      { label: 'Day 4 · Fri Apr 18', items: [] },
    ],
  },
  {
    id: 'trip-3',
    destination: 'Miami',
    country: 'USA',
    dates: 'Mar 11 – Mar 16, 2026',
    coverImage: '/miami-IMG_7402.jpg',
    status: 'past',
    collaborators: [
      { id: 'c1', name: 'Sofia R.', avatar: 'https://i.pravatar.cc/150?img=47' },
      { id: 'c2', name: 'James T.', avatar: 'https://i.pravatar.cc/150?img=12' },
    ],
    days: [
      {
        label: 'Day 1 · Tue Mar 11',
        items: [
          { id: 'ti-9', name: 'Museum Garage', category: 'Attraction', image: '/miami-IMG_7402.jpg', time: '11:00 AM' },
          { id: 'ti-10', name: 'Bigface Coffee', category: 'Cafe', image: '/miami-bigface-coffee.jpg', time: '9:00 AM' },
          { id: 'ti-11', name: 'Bodega Taqueria', category: 'Restaurant', image: '/miami-IMG_7463.jpg', time: '1:00 PM', booked: true },
        ],
      },
    ],
  },
  {
    id: 'trip-5',
    destination: 'San Diego',
    country: 'USA',
    dates: 'Feb 6 – Feb 9, 2026',
    coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&q=80',
    status: 'past',
    days: [
      { label: 'Day 1 · Thu Feb 6', items: [] },
      { label: 'Day 2 · Fri Feb 7', items: [] },
      { label: 'Day 3 · Sat Feb 8', items: [] },
      { label: 'Day 4 · Sun Feb 9', items: [] },
    ],
  },
  {
    id: 'trip-1',
    destination: 'London',
    country: 'UK',
    dates: 'Dec 15 – Dec 22, 2025',
    coverImage: '/moco-5.jpg',
    status: 'past',
    collaborators: [
      { id: 'c3', name: 'Mia K.', avatar: 'https://i.pravatar.cc/150?img=32' },
    ],
    days: [
      {
        label: 'Day 1 · Sun Dec 15',
        items: [
          { id: 'ti-1', name: 'MOCO Museum', category: 'Attraction', image: '/moco-love.jpg', time: '11:00 AM', booked: true },
          { id: 'ti-2', name: 'Dishoom Shoreditch', category: 'Restaurant', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80', time: '1:30 PM', booked: true },
          { id: 'ti-3', name: 'Sketch London', category: 'Bar', image: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?w=400&q=80', time: '8:00 PM' },
        ],
      },
      {
        label: 'Day 2 · Mon Dec 16',
        items: [
          { id: 'ti-4', name: 'Borough Market', category: 'Food', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80', time: '10:00 AM' },
          { id: 'ti-5', name: 'Tate Modern', category: 'Attraction', image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&q=80', time: '2:00 PM', booked: true },
          { id: 'ti-6', name: 'The Shard Bar', category: 'Bar', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', time: '7:30 PM' },
        ],
      },
    ],
  },
];

const savedPlaceIds = ['place-28', 'place-29', 'place-30', 'place-31', 'place-32', 'place-33'];

const placeCategories: { id: Category | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'cafe', label: 'Cafe', emoji: '☕' },
  { id: 'restaurant', label: 'Food', emoji: '🍽' },
  { id: 'hotel', label: 'Stay', emoji: '🏨' },
  { id: 'attraction', label: 'Attraction', emoji: '🗺' },
  { id: 'bar', label: 'Bar', emoji: '🍸' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'shop', label: 'Shop', emoji: '🛍' },
  { id: 'experience', label: 'Experience', emoji: '🎭' },
];

const categoryEmoji: Record<string, string> = {
  cafe: '☕', restaurant: '🍽', hotel: '🏨', stay: '🏨', attraction: '🏛️', bar: '🍸', nature: '🌿', shop: '🛍', experience: '🗺️', sports: '🎾',
  flight: '✈️', transport: '🚗', event: '🎟️', beach: '🏖️', food: '🍕', wellness: '💆',
  Attraction: '🏛️', Restaurant: '🍽', Bar: '🍸', Food: '🍽', Cafe: '☕', Event: '🎟️', Hotel: '🏨', Sports: '⚽',
};

const categoryDisplayName: Record<string, string> = {
  hotel: 'Stay', cafe: 'Café', restaurant: 'Restaurant', bar: 'Bar',
  attraction: 'Attraction', nature: 'Nature', shop: 'Shop', experience: 'Experience', sports: 'Sports',
  flight: 'Flight', transport: 'Transport', event: 'Event', beach: 'Beach', food: 'Food', wellness: 'Wellness',
};

// Thumbnail with graceful fallback when image URL is broken/expired
function ItemThumb({ image, name, category, size = 'md' }: { image?: string; name: string; category: string; size?: 'sm' | 'md' }) {
  const [err, setErr] = useState(false);
  // Reset error state when image URL changes so a newly fetched photo shows correctly
  useEffect(() => { setErr(false); }, [image]);
  const cls = size === 'sm'
    ? 'w-10 h-10 rounded-lg'
    : 'w-14 h-14 rounded-xl';
  if (!image || image === 'none' || err) {
    return <div className={`${cls} bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-2xl`}>{categoryEmoji[category] ?? '📍'}</div>;
  }
  return <img src={image} alt={name} className={`${cls} object-cover flex-shrink-0`} onError={() => setErr(true)} />;
}

function PlaceRow({ place, isLocked, isSaved, onToggleSave, onBook }: {
  place: Place;
  isLocked: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onBook?: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 bg-gray-50 rounded-2xl p-3 transition-opacity ${isLocked ? 'opacity-40 pointer-events-none select-none' : ''}`}>
      <img src={place.image} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
        <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
          <MapPin size={9} strokeWidth={1.5} />
          {place.neighbourhood ?? place.city}
          <span className="mx-1">·</span>
          {categoryEmoji[place.category] ?? '📍'} {place.category}
        </p>
        {place.rating && <p className="text-xs text-amber-500 font-semibold mt-0.5">★ {place.rating}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {place.bookingAvailable && (
          <button onClick={onBook} className="text-xs font-bold bg-gray-900 text-white rounded-full px-2.5 py-1">Book</button>
        )}
        <button onClick={onToggleSave}>
          {isSaved
            ? <BookmarkCheck size={17} strokeWidth={1.5} className="text-gray-900" />
            : <Bookmark size={17} strokeWidth={1.5} className="text-gray-300" />}
        </button>
      </div>
    </div>
  );
}

/** Extract a "Neighborhood, City" string from Google Places address components.
 *  When components are available they are always preferred over string parsing. */
function extractNeighborhood(comps: any[], formattedAddress?: string): string {
  if (comps.length > 0) {
    const find = (...types: string[]) =>
      comps.find((c: any) => types.some(t => c.types?.includes(t)))?.longText ?? '';
    const area = find('neighborhood') || find('sublocality_level_1') || find('sublocality');
    const city = find('locality');
    if (area && city) {
      if (area.includes(',')) return area; // already "Polanco, Mexico City" style
      if (area === city) return city;
      return `${area}, ${city}`;
    }
    if (area) return area;
    if (city) return city;
    // Components exist but no neighborhood/city found — don't fall back to string parsing
    return '';
  }
  // No components — parse address string carefully
  if (formattedAddress) {
    const parts = formattedAddress.split(',').map(s => s.trim()).filter(Boolean);
    // Find the city: segment just before a state/province code (e.g. "FL", "CA")
    const stateMatch = formattedAddress.match(/,\s*([^,]+),\s*[A-Z]{2}[\s,]/);
    const city = stateMatch ? stateMatch[1].trim() : parts.length >= 2 ? parts[parts.length - 2] : '';
    const firstPart = parts[0];
    const secondPart = parts[1] ?? '';
    // Second segment is a street if it has digits (e.g. "146th Street") or
    // contains a street-type word — in that case firstPart is a business name, not an area.
    const streetRx = /\b(avenue|ave|street|st|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|highway|hwy)\b/i;
    const secondIsStreet = /\d/.test(secondPart) || streetRx.test(secondPart);
    // Only treat firstPart as an area/district when it has no digits AND the second
    // segment is NOT a street (otherwise firstPart is a venue/business name).
    // e.g. "Miami Design District, Miami, FL" → area ✓
    //      "Reserve Padel, NE 146th St, North Miami, FL" → business name, skip ✗
    if (firstPart && city && firstPart !== city && !/\d/.test(firstPart) && !secondIsStreet) {
      return `${firstPart}, ${city}`;
    }
    if (city) return city;
  }
  return '';
}

function formatTime12(val: string): string {
  if (!val) return '';
  const [hStr, mStr] = val.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return val;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function countDaysFromDateStr(dates: string): number {
  if (!dates) return 0;
  const parts = dates.split('–').map(s => s.trim());
  if (parts.length === 1) return 1;
  const [startStr, endStr] = parts;
  const year = new Date().getFullYear();
  const start = new Date(`${startStr} ${year}`);
  const end = /^\d+$/.test(endStr)
    ? new Date(`${startStr.split(' ')[0]} ${endStr} ${year}`)
    : new Date(`${endStr} ${year}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function PlanCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const statusBadge: Record<Trip['status'], string> = {
    dreaming: 'bg-white text-orange-400',
    planning: 'bg-white text-orange-500',
    upcoming: 'bg-white text-orange-500',
    past: 'bg-gray-100 text-gray-500',
  };
  const statusLabel: Record<Trip['status'], string> = {
    dreaming: '✨ Want to do / see',
    planning: '📋 Planning it',
    upcoming: '🗓 Coming up',
    past: '✅ Done',
  };
  return (
    <button onClick={onClick} className="w-full relative h-24 rounded-2xl overflow-hidden text-left">
      <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      <div className="absolute bottom-2.5 left-3 right-3">
        <p className="text-sm font-black text-white">{trip.destination}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {trip.dates ? (
            <p className="text-white/80 text-xs flex items-center gap-1"><CalendarDays size={10} strokeWidth={1.5} />{trip.dates}</p>
          ) : (
            <p className="text-white/60 text-xs">No dates set</p>
          )}
          {trip.dates && <p className="text-white/60 text-xs">· {countDaysFromDateStr(trip.dates)} days · {trip.days.reduce((a, d) => a + d.items.length, 0)} places</p>}
        </div>
      </div>
    </button>
  );
}

function TimePicker({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label: string }) {
  const parse = (v?: string) => {
    const m = v?.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    return { h: m?.[1] ?? '', min: m?.[2] ?? '00', p: (m?.[3]?.toUpperCase() ?? 'AM') as 'AM' | 'PM' };
  };
  const init = parse(value);
  const [hour, setHour] = useState(init.h);
  const [min, setMin] = useState(init.min);
  const [period, setPeriod] = useState<'AM' | 'PM'>(init.p);

  const emit = (h: string, m: string, p: string) => {
    onChange(h ? `${h}:${m} ${p}` : '');
  };

  return (
    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-gray-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-0.5">
        <select
          value={hour}
          onChange={e => { setHour(e.target.value); emit(e.target.value, min, period); }}
          className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer appearance-none"
        >
          <option value="">--</option>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={String(h)}>{h}</option>)}
        </select>
        <span className="text-sm font-bold text-gray-400 mx-0.5">:</span>
        <select
          value={min}
          onChange={e => { setMin(e.target.value); emit(hour, e.target.value, period); }}
          className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer appearance-none"
        >
          {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={period}
          onChange={e => { setPeriod(e.target.value as 'AM'|'PM'); emit(hour, min, e.target.value); }}
          className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer appearance-none ml-1"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

function EventCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const rawDesc = trip.description ?? '';
  const catMatch = rawDesc.match(/\[cat:([^\]]*)\]/);
  const timeMatch = rawDesc.match(/\[time:([^\]]*)\]/);
  const evCat = catMatch?.[1] ?? '';
  const evTime = timeMatch?.[1] ?? '';
  const desc = rawDesc
    .replace('[event]', '')
    .replace(/\[cat:[^\]]*\]/g, '')
    .replace(/\[time:[^\]]*\]/g, '')
    .replace(/\[link:[^\]]*\]/g, '')
    .trim();
  const hasThumb = trip.coverImage && !trip.coverImage.includes('unsplash.com/photo-1476514525535');
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3.5 text-left">
      <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0 text-2xl overflow-hidden">
        {hasThumb
          ? <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
          : '🎟️'
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">{trip.destination}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {trip.dates && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <CalendarDays size={10} strokeWidth={1.5} />{trip.dates}
            </p>
          )}
          {evTime && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} strokeWidth={1.5} />{evTime}
            </p>
          )}
        </div>
        {evCat && <p className="text-xs text-gray-500 mt-0.5 font-medium">{evCat}</p>}
        {desc && <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>}
      </div>
      <ChevronRight size={16} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}

export default function Saved({ isNewUser, userId, userAvatar }: { isNewUser?: boolean; userId?: string; userAvatar?: string | null }) {
  const [activeTab, setActiveTab] = useState<SavedTab>('Places');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Trip | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [placeCategory, setPlaceCategory] = useState<Category | 'all'>('all');
  const [savedPlaceSet, setSavedPlaceSet] = useState<Set<string>>(new Set(isNewUser ? [] : savedPlaceIds));
  const [colViewMode, setColViewMode] = useState<'list' | 'area'>('list');
  const [colCategoryFilter, setColCategoryFilter] = useState<Category | 'all'>('all');
  const [bookingPlace, setBookingPlace] = useState<Place | null>(null);
  const [showAddPlaces, setShowAddPlaces] = useState(false);
  const [colAdditions, setColAdditions] = useState<Record<string, string[]>>({});
  const [addSearch, setAddSearch] = useState('');
  const [addCatFilter, setAddCatFilter] = useState('all');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDest, setNewPlanDest] = useState('');
  const [newPlanDates, setNewPlanDates] = useState('');
  const [newPlanStatus, setNewPlanStatus] = useState<Trip['status']>('planning');
  const [newPlanType, setNewPlanType] = useState<'trip' | 'event'>('trip');
  const coverImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newEventAddress, setNewEventAddress] = useState('');
  const [newEventNeighborhood, setNewEventNeighborhood] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('');
  const [newEventAddressSuggestions, setNewEventAddressSuggestions] = useState<{ placeId: string; label: string }[]>([]);
  const [newEventAddressLoading, setNewEventAddressLoading] = useState(false);
  const newEventAddressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEventSingleCal, setShowEventSingleCal] = useState(false);
  const [eventSingleDate, setEventSingleDate] = useState<Date | undefined>();
  const [newEventTimeStart, setNewEventTimeStart] = useState('');
  const [newEventTimeEnd, setNewEventTimeEnd] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [newEventInviteLink, setNewEventInviteLink] = useState('');
  const [newEventCollabInput, setNewEventCollabInput] = useState('');
  const [newEventCollabs, setNewEventCollabs] = useState<string[]>([]);
  const [plans, setPlans] = useState<Trip[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [realSavedPlaces, setRealSavedPlaces] = useState<SavedPlace[]>([]);
  const [realSavedPlaceIds, setRealSavedPlaceIds] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(false);
  const [mapCoords, setMapCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [mapLoading, setMapLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [editPlanTrip, setEditPlanTrip] = useState<Trip | null>(null);
  const [editShowCalendar, setEditShowCalendar] = useState(false);
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>();
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanDesc, setEditPlanDesc] = useState('');
  const [editPlanCollabInput, setEditPlanCollabInput] = useState('');
  const [editPlanCollabs, setEditPlanCollabs] = useState<TripCollaborator[]>([]);
  const [editPlanLocation, setEditPlanLocation] = useState('');
  const [editPlanCoverImage, setEditPlanCoverImage] = useState('');
  const [editCollabSuggestions, setEditCollabSuggestions] = useState<FollowProfile[]>([]);
  const [editFollowList, setEditFollowList] = useState<FollowProfile[]>([]);
  const editCoverInputRef = useRef<HTMLInputElement>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [coverCropTarget, setCoverCropTarget] = useState<'edit' | null>(null);
  const [coverCropSaving, setCoverCropSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteSuggestions, setInviteSuggestions] = useState<FollowProfile[]>([]);
  const [inviteFollowList, setInviteFollowList] = useState<FollowProfile[]>([]);
  const [inviteCollabs, setInviteCollabs] = useState<TripCollaborator[]>([]);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [addPlaceDayId, setAddPlaceDayId] = useState<string | null>(null);
  const [addPlaceSearch, setAddPlaceSearch] = useState('');
  const [addPlaceSuggestions, setAddPlaceSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [addPlaceSearching, setAddPlaceSearching] = useState(false);
  const [addPlaceSaving, setAddPlaceSaving] = useState(false);
  const addPlaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addPlaceSuggestionsRef = useRef<HTMLDivElement | null>(null);
  const addPlaceScrollRef = useRef<HTMLDivElement | null>(null);
  const [addPlaceSelectedId, setAddPlaceSelectedId] = useState('');
  const [addPlaceSelectedName, setAddPlaceSelectedName] = useState('');
  const [addPlaceTime, setAddPlaceTime] = useState('');
  const [addPlaceNotes, setAddPlaceNotes] = useState('');
  const [addPlaceCategory, setAddPlaceCategory] = useState('');
  const [addPlaceStatus, setAddPlaceStatus] = useState<'none'|'pending'|'booked'>('none');
  const [addPlaceCheckIn, setAddPlaceCheckIn] = useState('');
  const [addPlaceCheckOut, setAddPlaceCheckOut] = useState('');
  const [addPlaceCustomImage, setAddPlaceCustomImage] = useState('');
  const [addPlaceLocation, setAddPlaceLocation] = useState('');
  const [addPlaceTimeEnd, setAddPlaceTimeEnd] = useState('');
  const [addPlaceAddress, setAddPlaceAddress] = useState('');
  const [addPlaceMapsNote, setAddPlaceMapsNote] = useState('');
  const [addPlaceNeighborhood, setAddPlaceNeighborhood] = useState('');
  const addPlaceImageRef = useRef<HTMLInputElement>(null);
  const editItemImageRef = useRef<HTMLInputElement>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<TripItem | null>(null);
  const [detailItemDayId, setDetailItemDayId] = useState<string | null>(null);
  const [showEditItem, setShowEditItem] = useState(false);
  const [editItemUploading, setEditItemUploading] = useState(false);
  const [addPlaceUploading, setAddPlaceUploading] = useState(false);
  const [editItem, setEditItem] = useState<TripItem | null>(null);
  const [showDuplicatePicker, setShowDuplicatePicker] = useState(false);
  const [moveToDay, setMoveToDay] = useState<string | null>(null); // target day id when moving item
  const [editItemDayId, setEditItemDayId] = useState<string | null>(null);
  const [editItemAddressSearch, setEditItemAddressSearch] = useState('');
  const [editItemAddressSuggestions, setEditItemAddressSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [editItemAddressSearching, setEditItemAddressSearching] = useState(false);
  const editItemAddressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editItemSuggestionsRef = useRef<HTMLDivElement | null>(null);
  const editItemScrollRef = useRef<HTMLDivElement | null>(null);
  const [showItemInvite, setShowItemInvite] = useState(false);
  const [itemInviteSearch, setItemInviteSearch] = useState('');
  const [itemInviteSuggestions, setItemInviteSuggestions] = useState<FollowProfile[]>([]);
  const [itemInviteFollowList, setItemInviteFollowList] = useState<FollowProfile[]>([]);
  const [itemInviteSending, setItemInviteSending] = useState(false);
  const [itemInviteSentTo, setItemInviteSentTo] = useState<string[]>([]);
  const itemInviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColEmoji, setNewColEmoji] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColSaving, setNewColSaving] = useState(false);
  const [dbCollections, setDbCollections] = useState<import('../lib/supabase').RealCollection[]>([]);
  const [itemInvites, setItemInvites] = useState<ItemInvite[]>([]);
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanLocation, setNewPlanLocation] = useState('');
  const [newPlanCoverImage, setNewPlanCoverImage] = useState('');
  const [newPlanCollabInput, setNewPlanCollabInput] = useState('');
  const [newPlanCollabs, setNewPlanCollabs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const googleTypesToCategory = (types: string[]): string => {
    if (types.some(t => ['lodging', 'hotel', 'motel', 'resort_hotel'].includes(t))) return 'hotel';
    if (types.some(t => ['restaurant', 'meal_takeaway', 'meal_delivery', 'food'].includes(t))) return 'restaurant';
    if (types.some(t => ['cafe', 'bakery', 'coffee_shop'].includes(t))) return 'cafe';
    if (types.some(t => ['bar', 'night_club'].includes(t))) return 'bar';
    if (types.some(t => ['store', 'shopping_mall', 'clothing_store'].includes(t))) return 'shop';
    if (types.some(t => ['park', 'natural_feature', 'campground'].includes(t))) return 'nature';
    if (types.some(t => ['museum', 'art_gallery', 'tourist_attraction', 'landmark'].includes(t))) return 'attraction';
    if (types.some(t => ['stadium', 'sports_complex', 'gym', 'fitness_center'].includes(t))) return 'sports';
    return 'experience';
  };

  // Parse a loose date string like "Mar 11" or "March 11" or "2025-03-11" into a Date
  const parseFlexDate = (str: string): Date | null => {
    if (!str) return null;
    const year = new Date().getFullYear();
    const d1 = new Date(`${str} ${year}`);
    if (!isNaN(d1.getTime())) return d1;
    const d2 = new Date(str);
    if (!isNaN(d2.getTime())) return d2;
    return null;
  };

  // Extract date from a day label like "Day 1 · Mar 11" or "Day 1 · Tue Mar 11"
  const getDayDateFromLabel = (label: string): Date | null => {
    const match = label.match(/·\s*(?:\w{3}\s+)?(\w+\s+\d+)$/);
    if (!match) return null;
    return parseFlexDate(match[1]);
  };

  // Auto-add a stay item to all days between checkIn and checkOut (exclusive)
  const autoPopulateStay = async (
    item: TripItem,
    sourceDayId: string | null,
    trip: Trip,
  ): Promise<Trip> => {
    const stayCategories = ['hotel', 'stay', 'Hotel'];
    if (!stayCategories.includes(item.category) || !item.checkIn || !item.checkOut) return trip;
    const checkIn = parseFlexDate(item.checkIn);
    const checkOut = parseFlexDate(item.checkOut);
    if (!checkIn || !checkOut || checkOut <= checkIn) return trip;

    let updatedDays = trip.days;
    for (const day of trip.days) {
      if (!day.id || day.id === sourceDayId) continue;
      const dayDate = getDayDateFromLabel(day.label);
      if (!dayDate) continue;
      // Include check-in day up to (not including) check-out day
      const inRange = dayDate >= checkIn && dayDate < checkOut;
      if (!inRange) continue;
      const alreadyHas = day.items.some(i => i.name === item.name);
      if (alreadyHas) continue;
      const dbItem = await createPlanItem(trip.id, day.id, {
        name: item.name, category: item.category, image_url: item.image ?? '',
        time_label: item.time ?? '', time_end: item.timeEnd ?? '',
        notes: item.notes ?? '', address: item.address ?? '', neighborhood: item.neighborhood ?? '',
        status: item.status ?? 'none', check_in: item.checkIn, check_out: item.checkOut,
        position: day.items.length,
      });
      if (dbItem) {
        const newItem: TripItem = {
          id: dbItem.id, name: dbItem.name, category: dbItem.category, image: dbItem.imageUrl,
          address: dbItem.address, neighborhood: dbItem.neighborhood,
          time: dbItem.timeLabel, timeEnd: dbItem.timeEnd, notes: dbItem.notes,
          status: dbItem.status as TripItem['status'], checkIn: dbItem.checkIn, checkOut: dbItem.checkOut,
          booked: dbItem.booked,
        };
        updatedDays = updatedDays.map(d => d.id === day.id ? { ...d, items: [...d.items, newItem] } : d);
      }
    }
    return { ...trip, days: updatedDays };
  };

  const getTripDayLabel = (trip: Trip, dayIndex: number): string => {
    if (trip.dates) {
      const startStr = trip.dates.split('–')[0].trim();
      const year = new Date().getFullYear();
      const start = new Date(`${startStr} ${year}`);
      if (!isNaN(start.getTime())) {
        const date = new Date(start);
        date.setDate(start.getDate() + dayIndex);
        const fmt = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `Day ${dayIndex + 1} · ${fmt}`;
      }
    }
    return `Day ${dayIndex + 1}`;
  };

  const handleAddDay = async () => {
    if (!selectedTrip) return;
    const position = selectedTrip.days.length;
    const label = getTripDayLabel(selectedTrip, position);
    if (userId) {
      const newDay = await createPlanDay(selectedTrip.id, label, position);
      if (newDay) {
        const updated: Trip = { ...selectedTrip, days: [...selectedTrip.days, { id: newDay.id, label, items: [] }] };
        setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
        setSelectedTrip(updated);
      }
    } else {
      const updated: Trip = { ...selectedTrip, days: [...selectedTrip.days, { label, items: [] }] };
      setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
      setSelectedTrip(updated);
    }
  };

  const handleInitDays = async () => {
    if (!selectedTrip || !selectedTrip.dates) return;
    if (selectedTrip.days.length > 0) return; // already set up
    const total = countDaysFromDates(selectedTrip.dates);
    if (total === 0) return;
    const newDays: TripDay[] = [];
    for (let i = 0; i < total; i++) {
      const label = getTripDayLabel(selectedTrip, i);
      if (userId) {
        const newDay = await createPlanDay(selectedTrip.id, label, i);
        if (newDay) newDays.push({ id: newDay.id, label, items: [] });
      } else {
        newDays.push({ label, items: [] });
      }
    }
    const updated: Trip = { ...selectedTrip, days: newDays };
    setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
    setSelectedTrip(updated);
  };

  // ── Google Maps URL paste handler ──────────────────────────────────────
  const handleMapsUrl = async (url: string) => {
    setAddPlaceSuggestions([]);
    setAddPlaceSearching(true);
    setAddPlaceMapsNote('');

    // Short goo.gl links can't be expanded in the browser (CORS).
    if (/maps\.app\.goo\.gl/.test(url)) {
      setAddPlaceSearching(false);
      setAddPlaceMapsNote("Short Google Maps links can't be read directly. In the Maps app tap Share → Copy link and paste the full URL.");
      return;
    }

    try {
      // Extract place name from path: /maps/place/PLACE+NAME/@...
      const placeMatch = url.match(/\/maps\/place\/([^/@?#]+)/);
      let searchQuery = placeMatch
        ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        : '';

      // Extract lat/lng from @ coordinates
      const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const lat = coordMatch ? parseFloat(coordMatch[1]) : null;
      const lng = coordMatch ? parseFloat(coordMatch[2]) : null;

      if (!searchQuery && lat && lng) searchQuery = `${lat},${lng}`;
      if (!searchQuery) { setAddPlaceSearching(false); return; }

      const body: Record<string, unknown> = { textQuery: searchQuery, languageCode: 'en' };
      if (lat && lng) {
        body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 200 } };
      }

      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.photos',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const place = data.places?.[0];

      if (place) {
        if (place.id) setAddPlaceSelectedId(place.id);
        if (place.displayName?.text) {
          setAddPlaceSelectedName(prev => prev.trim() ? prev : place.displayName.text);
        }
        if (place.formattedAddress) {
          setAddPlaceSearch(place.formattedAddress);
          setAddPlaceAddress(place.formattedAddress);
        }
        const area = extractNeighborhood(place.addressComponents ?? [], place.formattedAddress ?? '');
        if (area) setAddPlaceNeighborhood(area);
        const photoName = place.photos?.[0]?.name;
        if (photoName) {
          setAddPlaceCustomImage(
            `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${GOOGLE_PLACES_KEY}`
          );
        }
        setAddPlaceMapsNote('✓ Place found — check the details below');
      } else {
        setAddPlaceMapsNote("Couldn't find this place. Try searching by name instead.");
      }
    } catch {
      setAddPlaceMapsNote('Something went wrong reading the link. Try searching by name.');
    }
    setAddPlaceSearching(false);
  };

  const openAddPlace = (dayId: string | null) => {
    setAddPlaceDayId(dayId);
    setAddPlaceSearch('');
    setAddPlaceSuggestions([]);
    setAddPlaceSelectedId('');
    setAddPlaceSelectedName('');
    setAddPlaceTime('');
    setAddPlaceNotes('');
    setAddPlaceCategory('');
    setAddPlaceStatus('none');
    setAddPlaceCheckIn('');
    setAddPlaceCheckOut('');
    setAddPlaceCustomImage('');
    setAddPlaceUploading(false);
    setAddPlaceLocation('');
    setAddPlaceTimeEnd('');
    setAddPlaceAddress('');
    setAddPlaceNeighborhood('');
    setAddPlaceMapsNote('');
    setShowAddPlace(true);
  };

  const handleSelectPlace = async (placeId: string, text: string, timeLabel: string, timeEnd: string, notes: string, categoryOverride: string, locationStr = '', neighborhoodHint = '') => {
    if (!selectedTrip) return;
    setAddPlaceSaving(true);
    try {
      let name = text;
      let category = categoryOverride || 'experience';
      // Never persist a blob: URL — only use it once upload resolves to a real public URL
      let imageUrl = (addPlaceCustomImage && !addPlaceCustomImage.startsWith('blob:')) ? addPlaceCustomImage : '';
      let address = locationStr;
      let neighborhood = neighborhoodHint;

      if (placeId) {
        try {
          const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
            headers: {
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
              'X-Goog-FieldMask': 'displayName,types,photos,formattedAddress,addressComponents',
              'X-Goog-LanguageCode': 'en',
            },
          });
          const place = await res.json();
          if (place.displayName?.text) name = place.displayName.text;
          if (!categoryOverride && place.types) category = googleTypesToCategory(place.types);
          const photoName = place.photos?.[0]?.name;
          if (!imageUrl && photoName) imageUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_PLACES_KEY}&maxWidthPx=400`;
          if (place.formattedAddress) address = place.formattedAddress;
          const area = extractNeighborhood(place.addressComponents ?? [], place.formattedAddress);
          if (area) neighborhood = area;
        } catch { /* use fallback name/category already set */ }
      }

      let targetDayId = addPlaceDayId;
      let updatedDays = [...selectedTrip.days];

      // If no day exists yet, create Day 1
      if (updatedDays.length === 0) {
        const label = getTripDayLabel(selectedTrip, 0);
        if (userId) {
          const newDay = await createPlanDay(selectedTrip.id, label, 0);
          if (newDay) {
            updatedDays = [{ id: newDay.id, label, items: [] }];
            targetDayId = newDay.id;
          }
        } else {
          updatedDays = [{ label, items: [] }];
          targetDayId = null;
        }
      }

      const dayIndex = targetDayId ? updatedDays.findIndex(d => d.id === targetDayId) : 0;
      if (dayIndex === -1) return;
      const day = updatedDays[dayIndex];
      const position = day.items.length;

      const finalImage = imageUrl; // imageUrl already prefers addPlaceCustomImage (set at top of function)
      let newItem: TripItem;
      if (userId && day.id) {
        const dbItem = await createPlanItem(selectedTrip.id, day.id, {
          name, category, image_url: finalImage,
          time_label: timeLabel, time_end: timeEnd || undefined,
          notes, address: address || undefined, neighborhood: neighborhood || undefined,
          status: addPlaceStatus !== 'none' ? addPlaceStatus : undefined,
          check_in: addPlaceCheckIn || undefined,
          check_out: addPlaceCheckOut || undefined,
          position,
        });
        if (!dbItem) return;
        newItem = { id: dbItem.id, name, category, image: finalImage, address: address || undefined, neighborhood: neighborhood || undefined, time: timeLabel || undefined, timeEnd: timeEnd || undefined, notes: notes || undefined, status: addPlaceStatus, checkIn: addPlaceCheckIn || undefined, checkOut: addPlaceCheckOut || undefined };
      } else {
        newItem = { id: `item-${Date.now()}`, name, category, image: finalImage, address: address || undefined, neighborhood: neighborhood || undefined, time: timeLabel || undefined, timeEnd: timeEnd || undefined, notes: notes || undefined, status: addPlaceStatus, checkIn: addPlaceCheckIn || undefined, checkOut: addPlaceCheckOut || undefined };
      }

      updatedDays[dayIndex] = { ...day, items: [...day.items, newItem] };
      let updated: Trip = { ...selectedTrip, days: updatedDays };
      // Auto-populate stay to all days in check-in/check-out range
      updated = await autoPopulateStay(newItem, targetDayId, updated);
      setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
      setSelectedTrip(updated);
      setAddPlaceSearch('');
      setAddPlaceSuggestions([]);
      setShowAddPlace(false);
    } catch { /* silent */ }
    setAddPlaceSaving(false);
  };

  const openEditPlan = async (trip: Trip) => {
    setEditPlanTrip(trip);
    setEditPlanName(trip.destination);
    setEditPlanDesc(trip.description ?? '');
    setEditPlanLocation(trip.country ?? '');
    setEditPlanCoverImage(trip.coverImage);
    setEditPlanCollabs(trip.collaborators ?? []);
    setEditDateRange(undefined);
    setEditShowCalendar(false);
    setEditPlanCollabInput('');
    setShowEditPlan(true);
    if (userId) {
      const [followers, following] = await Promise.all([getFollowerProfiles(userId), getFollowingProfiles(userId)]);
      const combined = [...followers, ...following].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
      setEditFollowList(combined);
    }
  };

  const parseTripStartDate = (dates: string, status: string): Date | null => {
    if (!dates) return null;
    const startStr = dates.split('–')[0].trim();
    const year = new Date().getFullYear();
    const d = new Date(`${startStr} ${year}`);
    if (isNaN(d.getTime())) return null;
    if (status === 'past' && d > new Date()) d.setFullYear(year - 1);
    return d;
  };

  const countDaysFromDates = (dates: string): number => {
    if (!dates) return 0;
    const parts = dates.split('–').map(s => s.trim());
    if (parts.length === 1) return 1;
    const [startStr, endStr] = parts;
    const year = new Date().getFullYear();
    const start = new Date(`${startStr} ${year}`);
    const end = /^\d+$/.test(endStr)
      ? new Date(`${startStr.split(' ')[0]} ${endStr} ${year}`)
      : new Date(`${endStr} ${year}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return '';
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!range.to || range.from.getTime() === range.to.getTime()) return fmt(range.from);
    if (range.from.getMonth() === range.to.getMonth() && range.from.getFullYear() === range.to.getFullYear()) {
      return `${fmt(range.from)} – ${range.to.getDate()}`;
    }
    return `${fmt(range.from)} – ${fmt(range.to)}`;
  };

  // ── Load real data from Supabase ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setPlans(mockTrips);
      return;
    }
    setPlansLoading(true);
    getPlans(userId).then(dbPlans => {
      const converted: Trip[] = dbPlans.map(p => ({
        id: p.id,
        destination: p.title,
        country: p.country,
        dates: p.dates,
        coverImage: p.coverImageUrl,
        status: p.status,
        description: p.description,
        days: p.days.map(d => ({
          id: d.id,
          label: d.label,
          items: d.items.map(i => ({
            id: i.id,
            name: i.name,
            category: i.category,
            image: i.imageUrl || undefined,
            time: i.timeLabel || undefined,
            timeEnd: i.timeEnd || undefined,
            notes: i.notes || undefined,
            address: i.address || undefined,
            neighborhood: i.neighborhood || undefined,
            location: i.location || undefined,
            status: (i.status as TripItem['status']) || 'none',
            checkIn: i.checkIn || undefined,
            checkOut: i.checkOut || undefined,
            booked: i.booked,
          })),
        })),
        collaborators: p.collaborators.map(c => ({ id: c.id, name: c.name, avatar: c.avatar })),
      }));
      setPlans(converted);
      setPlansLoading(false);
    });

    getSavedPlaces(userId).then(sp => {
      setRealSavedPlaces(sp);
      setRealSavedPlaceIds(new Set(sp.map(p => p.id)));
    });

    getItemInvites(userId).then(setItemInvites);
    getUserCollections(userId).then(setDbCollections);
  }, [userId]);

  // ── Enrich items in the opened trip with address/neighborhood/photo ──
  useEffect(() => {
    if (!selectedTrip || !userId || !GOOGLE_PLACES_KEY) return;
    const plan = selectedTrip;
    let cancelled = false;

    const applyPatch = (itemId: string, dayId: string | undefined, patch: Partial<TripItem>) => {
      setPlans(prev => prev.map(p => p.id !== plan.id ? p : {
        ...p, days: p.days.map(d => d.id !== dayId ? d : {
          ...d, items: d.items.map(i => i.id !== itemId ? i : { ...i, ...patch }),
        }),
      }));
      setSelectedTrip(prev => !prev || prev.id !== plan.id ? prev : {
        ...prev, days: prev.days.map(d => d.id !== dayId ? d : {
          ...d, items: d.items.map(i => i.id !== itemId ? i : { ...i, ...patch }),
        }),
      });
    };

    (async () => {
      for (const day of plan.days) {
        for (const item of day.items) {
          if (cancelled) return;
          if (!item.name || item.name.length < 2) continue;
          // Skip only if neighborhood is a clean "Area, City" with no state codes, zips, or street names
          const streetTypeRx = /\b(avenue|ave|street|st|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|highway|hwy)\b/i;
          const hasCleanNeighborhood =
            item.neighborhood &&
            item.neighborhood.includes(',') &&
            !/,\s*[A-Z]{2}(\s*\d{5})?$/.test(item.neighborhood) && // not ", FL" or ", FL 33141"
            !/\d/.test(item.neighborhood) &&                         // no digits (zip codes, street numbers)
            !streetTypeRx.test(item.neighborhood.split(',')[0]);     // first part is not a street name
          // 'none' = user explicitly removed the photo — never re-fetch
          if (item.image === 'none') { if (hasCleanNeighborhood) continue; }
          const isUserPhoto = item.image?.includes('leooulgankktjapregei.supabase.co');
          // Only flag the specific Unsplash lake placeholder as wrong — correctly-saved
          // Google Places photos should be kept and never re-fetched.
          const hasWrongImage = !isUserPhoto &&
            item.image?.includes('unsplash.com/photo-1476514525535');
          const needsPhoto = !isUserPhoto && item.image !== 'none' && (!item.image || hasWrongImage);
          // Skip only when neighbourhood is clean AND no photo work is needed
          if (hasCleanNeighborhood && !hasWrongImage && !needsPhoto) continue;

          try {
            // If the stored address is a raw Google Maps URL (pasted before the URL
            // parser was added), extract the place name + coords from it instead of
            // sending the entire URL as a search query (which returns garbage results).
            let resolvedAddress = item.address ?? '';
            let locationBias: Record<string, unknown> | null = null;
            if (/google\.com\/maps|maps\.app\.goo\.gl/.test(resolvedAddress)) {
              const rawUrl = item.address ?? '';
              const pm = rawUrl.match(/\/maps\/place\/([^/@?#]+)/);
              if (pm) resolvedAddress = decodeURIComponent(pm[1].replace(/\+/g, ' '));
              const cm = rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (cm) {
                locationBias = { circle: { center: { latitude: parseFloat(cm[1]), longitude: parseFloat(cm[2]) }, radius: 200 } };
              }
            }
            const searchQuery = resolvedAddress
              ? resolvedAddress
              : plan.country ? `${item.name} ${plan.country}` : item.name;

            const stRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.addressComponents,places.photos',
              },
              body: JSON.stringify({ textQuery: searchQuery, languageCode: 'en', ...(locationBias ? { locationBias } : {}) }),
            });
            const stData = await stRes.json();
            const place = stData.places?.[0];

            let newNeighborhood = '';
            if (place) {
              newNeighborhood = extractNeighborhood(place.addressComponents ?? [], place.formattedAddress);
              // If Places gave us only a city, try the item's own stored address
              if (item.address && (!newNeighborhood || !newNeighborhood.includes(','))) {
                const fromAddr = extractNeighborhood([], item.address);
                if (fromAddr && fromAddr.includes(',')) newNeighborhood = fromAddr;
              }
              // Geocoding fallback for "Area, City"
              if (!newNeighborhood || !newNeighborhood.includes(',')) {
                const addr = place.formattedAddress || item.address || '';
                if (addr) {
                  try {
                    const geoRes = await fetch(
                      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_PLACES_KEY}`
                    );
                    const geoData = await geoRes.json();
                    const geoResult = geoData.results?.[0];
                    if (geoResult) {
                      const geoComps = (geoResult.address_components ?? []).map((c: any) => ({
                        types: c.types, longText: c.long_name,
                      }));
                      const geo = extractNeighborhood(geoComps, geoResult.formatted_address);
                      if (geo && geo.includes(',')) newNeighborhood = geo;
                    }
                  } catch { /* silent */ }
                }
              }
            } else if (item.address) {
              // No Places result — extract neighbourhood from stored address string
              const fromAddr = extractNeighborhood([], item.address);
              if (fromAddr) newNeighborhood = fromAddr;
            }

            // ── Photo logic ──────────────────────────────────────────────────
            let newImage = '';
            if (place && needsPhoto && item.address) {
              // Only fetch a photo when the item has a confirmed address — searching
              // by name alone returns unreliable results with wrong photos (e.g. lake).
              const photoName = place.photos?.[0]?.name;
              const formattedAddr = (place.formattedAddress ?? '').toLowerCase();
              const geoHints = [plan.country, plan.destination]
                .filter(Boolean)
                .map(s => s!.toLowerCase().split(/[\s,]+/)[0]);
              const geoMatch = geoHints.length === 0 || geoHints.some(h => formattedAddr.includes(h));
              if (photoName && geoMatch) {
                newImage = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${GOOGLE_PLACES_KEY}`;
              } else if (hasWrongImage) {
                newImage = '__clear__'; // duplicate or geo-fail → clear → emoji
              }
            } else if (hasWrongImage) {
              newImage = '__clear__'; // no address or no result → clear wrong photo → emoji
            }

            const dbUpdates: Record<string, string> = {};
            if (newNeighborhood && newNeighborhood !== item.neighborhood) dbUpdates.neighborhood = newNeighborhood;
            if (newImage === '__clear__') dbUpdates.image_url = '';
            else if (newImage) dbUpdates.image_url = newImage;

            if (Object.keys(dbUpdates).length === 0) {
              await new Promise(r => setTimeout(r, 200));
              continue;
            }

            const ok = await updatePlanItem(item.id, dbUpdates);
            if (!ok) continue;
            applyPatch(item.id, day.id, {
              ...(newNeighborhood ? { neighborhood: newNeighborhood } : {}),
              ...(dbUpdates.image_url !== undefined ? { image: dbUpdates.image_url } : {}),
            });
            await new Promise(r => setTimeout(r, 200));
          } catch { /* silent */ }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Geocode items for map view ──────────────────────────────────────────
  useEffect(() => {
    if (!showMap || !selectedTrip || !GOOGLE_PLACES_KEY) return;
    const allItems = selectedTrip.days.flatMap(d => d.items);
    const toGeocode = allItems.filter(item => !mapCoords[item.id]);
    if (toGeocode.length === 0) return;
    let cancelled = false;
    setMapLoading(true);
    (async () => {
      const newCoords: Record<string, { lat: number; lng: number }> = {};
      for (const item of toGeocode) {
        if (cancelled) break;
        try {
          const q = item.address ? `${item.name} ${item.address}` : `${item.name} ${selectedTrip.country}`;
          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
              'X-Goog-FieldMask': 'places.location,places.displayName',
            },
            body: JSON.stringify({ textQuery: q, languageCode: 'en' }),
          });
          const data = await res.json();
          const loc = data.places?.[0]?.location;
          if (loc) newCoords[item.id] = { lat: loc.latitude, lng: loc.longitude };
          await new Promise(r => setTimeout(r, 120));
        } catch { /* silent */ }
      }
      if (!cancelled) {
        setMapCoords(prev => ({ ...prev, ...newCoords }));
        setMapLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showMap, selectedTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedPlaces = isNewUser
    ? places.filter(p => savedPlaceSet.has(p.id))
    : places.filter(p => savedPlaceIds.includes(p.id));
  const myCollections = isNewUser ? [] : collections.filter(c => c.curatorId === 'user-1');
  const followingCollections = collections.filter(c => c.curatorId !== 'user-1');

  // ── Plan Detail ───────────────────────────────────────────────
  const parseTimeToMinutes = (t: string): number => {
    if (!t) return 9999;
    const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 9999;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  if (selectedTrip) {
    const totalItems = selectedTrip.days.reduce((acc, d) => acc + d.items.length, 0);
    const bookedCount = selectedTrip.days.reduce((acc, d) => acc + d.items.filter(i => i.booked || i.status === 'booked').length, 0);
    const sortedDays = selectedTrip.days.map(d => ({
      ...d,
      items: [...d.items].sort((a, b) => parseTimeToMinutes(a.time ?? '') - parseTimeToMinutes(b.time ?? '')),
    }));
    const allItems = sortedDays.flatMap(d => d.items);
    const statusConfig: Record<Trip['status'], { label: string; color: string }> = {
      dreaming: { label: '✨ Want to do / see', color: 'bg-purple-100 text-purple-700' },
      planning: { label: '📋 Planning it', color: 'bg-amber-100 text-amber-700' },
      upcoming: { label: '🗓 Coming up', color: 'bg-violet-100 text-violet-700' },
      past: { label: '✅ Done', color: 'bg-gray-100 text-gray-500' },
    };
    const collabs = selectedTrip.collaborators ?? [];

    const isEvent = selectedTrip.description?.startsWith('[event]');

    // If somehow an event ended up as selectedTrip, redirect to the event sheet
    if (isEvent) {
      if (!showEventSheet) {
        setSelectedEvent(selectedTrip);
        setShowEventSheet(true);
        setSelectedTrip(null);
      }
      return null;
    }

    return (
      <div className="bg-white min-h-screen">

      {(
        /* ══════════════════════════════════════
           TRIP view — photo hero + stats + days
           ══════════════════════════════════════ */
        <>
        {/* Hero */}
        <div className="relative h-52">
          {selectedTrip.coverImage
            ? <img src={selectedTrip.coverImage} alt={selectedTrip.destination} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" style={{ background: selectedTrip.coverImage ? undefined : 'linear-gradient(to top, #111827, #374151)' }} />
          <button onClick={() => setSelectedTrip(null)} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => { openEditPlan(selectedTrip); }} className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
              <Pencil size={14} strokeWidth={1.5} className="text-gray-700" />
            </button>
            <button onClick={() => {
              const text = `${selectedTrip.destination} trip — ${selectedTrip.dates}`;
              const url = window.location.href;
              if (navigator.share) {
                navigator.share({ title: text, url }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url).then(() => alert('Link copied!')).catch(() => {});
              }
            }} className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
              <Share2 size={15} strokeWidth={1.5} className="text-gray-700" />
            </button>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-black text-white">{selectedTrip.destination}</h2>
            <div className="flex items-center gap-3 mt-1">
              {selectedTrip.dates && (
                <p className="text-white text-xs flex items-center gap-1">
                  <CalendarDays size={11} strokeWidth={1.5} />{selectedTrip.dates}
                </p>
              )}
              {selectedTrip.country && (
                <p className="text-white text-xs flex items-center gap-1">
                  <MapPin size={11} strokeWidth={1.5} />{selectedTrip.country}
                </p>
              )}
            </div>
            {selectedTrip.description && (
              <p className="text-white text-xs mt-1.5 line-clamp-2">{selectedTrip.description}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center divide-x divide-gray-100 border-b border-gray-100">
          {[{ value: countDaysFromDates(selectedTrip.dates), label: 'Days' }, { value: totalItems, label: 'Places' }, { value: bookedCount, label: 'Booked' }].map(s => (
            <div key={s.label} className="flex-1 py-3 text-center">
              <p className="text-base font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Collaborators strip */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="flex -space-x-2">
            {/* You (always first) */}
            {userAvatar ? (
              <img src={userAvatar} alt="You" className="w-8 h-8 rounded-full object-cover border-2 border-white flex-shrink-0 z-10" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center flex-shrink-0 z-10">
                <span className="text-white text-xs font-bold">You</span>
              </div>
            )}
            {collabs.map((c, i) => (
              <img key={c.id} src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover border-2 border-white flex-shrink-0" style={{ zIndex: 9 - i }} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            {collabs.length === 0
              ? <p className="text-xs text-gray-400">Just you on this plan</p>
              : <p className="text-xs text-gray-600 font-medium">You + {collabs.map(c => c.name.split(' ')[0]).join(', ')}</p>
            }
          </div>
          <button
            onClick={async () => {
              setInviteCollabs(selectedTrip.collaborators ?? []);
              setInviteInput('');
              setShowInvite(true);
              if (userId) {
                const [followers, following] = await Promise.all([getFollowerProfiles(userId), getFollowingProfiles(userId)]);
                const combined = [...followers, ...following].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
                setInviteFollowList(combined);
                setInviteSuggestions(combined.filter(f => !(selectedTrip.collaborators ?? []).some(c => c.id === f.id)));
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full flex-shrink-0"
          >
            <UserPlus size={12} strokeWidth={2} /> Invite
          </button>
        </div>



        {/* Place list — TRIP only (events returned early above) */}
        <div className="px-4 pt-4 pb-28">

          {/* Header row: place count + show/hide map */}
          {selectedTrip.days.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{totalItems} places</p>
              <button
                onClick={() => setShowMap(m => !m)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full"
              >
                <MapPin size={12} strokeWidth={2} />
                {showMap ? 'Hide map' : 'Show map'}
              </button>
            </div>
          )}

          {/* Inline map — shown/hidden */}
          {showMap && selectedTrip.days.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-5" style={{ height: 260 }}>
              <Suspense fallback={<div className="flex items-center justify-center h-full bg-gray-100 rounded-2xl"><Loader2 size={20} className="animate-spin text-gray-400" /></div>}>
                {mapLoading && Object.keys(mapCoords).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full bg-gray-100 rounded-2xl gap-2">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                    <p className="text-xs text-gray-400">Finding places on map…</p>
                  </div>
                ) : (
                  <MapView
                    places={selectedTrip.days.flatMap(d => d.items).filter(i => mapCoords[i.id]).map(i => ({
                      id: i.id,
                      lat: mapCoords[i.id].lat,
                      lng: mapCoords[i.id].lng,
                      name: i.name,
                      city: selectedTrip.destination,
                      country: selectedTrip.country,
                    }))}
                    height="260px"
                  />
                )}
              </Suspense>
            </div>
          )}

          {selectedTrip.days.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-3xl mb-3">✨</p>
              <p className="text-base font-bold text-gray-900 mb-1">Nothing added yet</p>
              <p className="text-sm text-gray-400 mb-6">Set up your days or add places directly</p>
              {selectedTrip.dates && countDaysFromDates(selectedTrip.dates) > 0 && (
                <button onClick={handleInitDays} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold mb-3">
                  <CalendarDays size={14} strokeWidth={2} /> Set up {countDaysFromDates(selectedTrip.dates)} days
                </button>
              )}
              <button onClick={() => openAddPlace(null)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 rounded-full text-sm font-semibold">
                <Plus size={14} strokeWidth={2} /> Add a place
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDays
                .filter((day, idx, arr) => arr.findIndex(d => d.label === day.label) === idx)
                .slice(0, countDaysFromDates(selectedTrip.dates) || sortedDays.length)
                .map((day, di) => (
                <div key={di}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{day.label}</p>
                    {day.id && (
                      <button onClick={async () => {
                        if (!selectedTrip) return;
                        if (!window.confirm(`Delete ${day.label} and all its places?`)) return;
                        if (userId) await deletePlanDay(day.id!);
                        const updated = { ...selectedTrip, days: selectedTrip.days.filter(d => d.id !== day.id) };
                        setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                        setSelectedTrip(updated);
                      }} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M5.5 5.5v4M7.5 5.5v4M3 3l.7 7.3A1 1 0 003.7 11h5.6a1 1 0 001-.7L11 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {day.items.map(item => (
                      <div key={item.id} className="bg-gray-50 rounded-2xl p-3" onClick={() => { setDetailItem(item); setDetailItemDayId(day.id ?? null); setShowItemDetail(true); }}>
                        <div className="flex items-start gap-3">
                          <ItemThumb image={item.image} name={item.name} category={item.category} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {categoryEmoji[item.category] ?? '📍'} {categoryDisplayName[item.category] ?? item.category}
                              {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                            </p>
                            {item.time && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock size={9} strokeWidth={1.5} />
                                {item.time}{item.timeEnd ? ` – ${item.timeEnd}` : ''}
                              </p>
                            )}
                            {(item.checkIn || item.checkOut) && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <CalendarDays size={9} strokeWidth={1.5} />
                                {item.checkIn}{item.checkIn && item.checkOut ? ' → ' : ''}{item.checkOut}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {(item.status === 'booked' || item.booked) && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Booked</span>}
                            {item.status === 'pending' && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Pending</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {day.items.length === 0 && (
                      <div className="border-2 border-dashed border-gray-100 rounded-2xl py-5 flex items-center justify-center">
                        <p className="text-sm text-gray-300">Nothing added</p>
                      </div>
                    )}
                    <button onClick={() => openAddPlace(day.id ?? null)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-gray-100 text-xs text-gray-400 font-medium">
                      <Plus size={12} strokeWidth={2} /> Add place / plan
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={handleAddDay} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-100 text-sm text-gray-300 font-medium">
                <Plus size={14} strokeWidth={1.5} /> Add a day
              </button>
            </div>
          )}
        </div>
        </> /* end TRIP view */
        )}

        {/* ── Shared sheets (shown for both events and trips) ── */}
        {/* Edit Plan Sheet */}
        {showEditPlan && editPlanTrip && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditPlan(false)} />
            <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <button onClick={() => setShowEditPlan(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} strokeWidth={2} className="text-gray-500" />
              </button>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Edit plan</p>

              {/* Cover image preview */}
              <div className="relative h-28 rounded-2xl overflow-hidden mb-4">
                <img src={editPlanCoverImage || editPlanTrip.coverImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  {coverCropSaving ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <button onClick={() => editCoverInputRef.current?.click()} className="flex items-center gap-1.5 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full">
                      <Pencil size={11} strokeWidth={2} /> Change cover
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={editCoverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCoverCropFile(file);
                  setCoverCropTarget('edit');
                  e.target.value = '';
                }}
              />

              {/* Title */}
              <input
                autoFocus
                value={editPlanName}
                onChange={e => setEditPlanName(e.target.value)}
                placeholder="Title?"
                className="w-full text-2xl font-black text-gray-900 outline-none placeholder:text-gray-200 mb-5 bg-transparent"
              />

              {/* Dates */}
              <div className="mb-2">
                <button
                  onClick={() => setEditShowCalendar(v => !v)}
                  className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-left"
                >
                  <CalendarDays size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <span className={`flex-1 text-sm ${editDateRange?.from ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                    {editDateRange?.from ? formatDateRange(editDateRange) : (editPlanTrip.dates || 'Dates?')}
                  </span>
                  {editDateRange?.from && (
                    <span onClick={e => { e.stopPropagation(); setEditDateRange(undefined); }} className="text-gray-300 hover:text-gray-500">
                      <X size={13} strokeWidth={2} />
                    </span>
                  )}
                </button>
                {editShowCalendar && (
                  <div className="curio-cal mt-1 rounded-xl overflow-hidden bg-gray-50 flex justify-center">
                    <style>{`
                      .curio-cal .rdp-range_start { background: linear-gradient(to right, transparent 50%, #ffedd5 50%); }
                      .curio-cal .rdp-range_end   { background: linear-gradient(to left,  transparent 50%, #ffedd5 50%); }
                      .curio-cal .rdp-range_middle { background: #ffedd5; }
                      .curio-cal .rdp-range_start button { background: #f97316 !important; color: white !important; border-radius: 9999px !important; }
                      .curio-cal .rdp-range_end   button { background: #f97316 !important; color: white !important; border-radius: 9999px !important; }
                      .curio-cal .rdp-range_middle button { background: transparent !important; color: #c2410c !important; border-radius: 0 !important; }
                    `}</style>
                    <DayPicker
                      mode="range"
                      selected={editDateRange}
                      onSelect={(range) => {
                        setEditDateRange(range);
                        if (range?.from && range?.to && range.to.getTime() !== range.from.getTime()) {
                          setEditShowCalendar(false);
                        }
                      }}
                      classNames={{
                        root: 'p-4 w-full relative',
                        month: 'w-full',
                        month_caption: 'flex items-center mb-3',
                        caption_label: 'text-sm font-bold text-gray-900',
                        nav: 'absolute top-4 right-4 flex gap-2 items-center',
                        button_previous: 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors',
                        button_next: 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors',
                        month_grid: 'w-full border-collapse',
                        weekdays: 'flex mb-1',
                        weekday: 'flex-1 text-center text-xs text-gray-400 font-medium py-1',
                        week: 'flex',
                        day: 'flex-1 flex items-center justify-center p-0.5',
                        day_button: 'w-8 h-8 flex items-center justify-center rounded-full text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer',
                        today: 'font-bold',
                        outside: 'text-gray-200',
                        disabled: 'text-gray-200 cursor-not-allowed',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Optional fields */}
              <div className="space-y-2 mb-5 mt-2">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <AlignLeft size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={editPlanDesc}
                    onChange={e => setEditPlanDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                  />
                </div>
                <LocationSearch value={editPlanLocation} onChange={setEditPlanLocation} onCoverImage={setEditPlanCoverImage} />
              </div>

              <button
                onClick={async () => {
                  const dates = editDateRange?.from ? formatDateRange(editDateRange) : editPlanTrip.dates;
                  const status = editDateRange?.from
                    ? (editDateRange.from >= new Date(new Date().setHours(0, 0, 0, 0)) ? 'upcoming' : 'past')
                    : editPlanTrip.status;
                  const coverImage = editPlanCoverImage || editPlanTrip.coverImage;
                  const updated: Trip = { ...editPlanTrip, destination: editPlanName || editPlanTrip.destination, country: editPlanLocation || editPlanTrip.country, dates, description: editPlanDesc, status, coverImage };
                  if (userId) {
                    await dbUpdatePlan(editPlanTrip.id, { title: updated.destination, country: updated.country, dates: updated.dates, description: updated.description ?? '', status: updated.status, cover_image_url: coverImage });
                  }
                  setPlans(prev => prev.map(p => p.id === editPlanTrip.id ? updated : p));
                  if (selectedTrip?.id === editPlanTrip.id) setSelectedTrip(updated);
                  if (selectedEvent?.id === editPlanTrip.id) setSelectedEvent(updated);
                  setShowEditPlan(false);
                }}
                className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold"
              >
                Save changes
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Delete this plan?')) return;
                  if (userId) await dbDeletePlan(editPlanTrip.id);
                  setPlans(prev => prev.filter(p => p.id !== editPlanTrip.id));
                  setShowEditPlan(false);
                  setSelectedTrip(null);
                  setShowEventSheet(false);
                  setSelectedEvent(null);
                }}
                className="w-full py-3 text-red-500 text-sm font-semibold"
              >
                Delete trip
              </button>
            </div>
          </div>
        )}

        {/* Invite Sheet */}
        {showInvite && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowInvite(false)} />
            <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10 max-h-[70vh] overflow-y-auto">
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <button onClick={() => setShowInvite(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} strokeWidth={2} className="text-gray-500" />
              </button>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Invite to plan</p>
              {inviteCollabs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {inviteCollabs.map(c => (
                    <span key={c.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-0.5">
                      <img src={c.avatar} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-xs text-gray-600 font-medium">{c.name.split(' ')[0]}</span>
                      <button onClick={() => setInviteCollabs(prev => prev.filter(x => x.id !== c.id))}>
                        <X size={10} strokeWidth={2} className="text-gray-400" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-1">
                  <Users size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    value={inviteInput}
                    onChange={async e => {
                      const val = e.target.value;
                      setInviteInput(val);
                      if (!val.trim()) {
                        setInviteSuggestions(inviteFollowList.filter(f => !inviteCollabs.some(c => c.id === f.id)));
                        return;
                      }
                      const q = val.replace(/^@/, '').toLowerCase();
                      const fromFollows = inviteFollowList.filter(f =>
                        (f.username.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)) &&
                        !inviteCollabs.some(c => c.id === f.id)
                      );
                      if (fromFollows.length > 0) {
                        setInviteSuggestions(fromFollows);
                      } else if (userId) {
                        const results = await searchProfiles(val.replace(/^@/, ''), userId);
                        setInviteSuggestions(results.filter(r => !inviteCollabs.some(c => c.id === r.id)));
                      }
                    }}
                    placeholder="Search by name or username..."
                    className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                  />
                </div>
                {inviteSuggestions.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {inviteSuggestions.slice(0, 6).map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setInviteCollabs(prev => [...prev, { id: s.id, name: s.name, avatar: s.avatarUrl ?? `https://i.pravatar.cc/150?u=${s.id}` }]);
                          setInviteInput('');
                          setInviteSuggestions(inviteFollowList.filter(f => !inviteCollabs.some(c => c.id === f.id) && f.id !== s.id));
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <img src={s.avatarUrl ?? `https://i.pravatar.cc/150?u=${s.id}`} alt={s.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 truncate">@{s.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {inviteCollabs.length > 0 && (
                <button
                  onClick={async () => {
                    const updated: Trip = { ...selectedTrip, collaborators: inviteCollabs };
                    if (userId) {
                      // Persist the full collaborator list to plan_collaborators table
                      await syncPlanCollaborators(
                        selectedTrip.id,
                        inviteCollabs.map(c => c.id),
                        userId
                      );
                    }
                    setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                    setSelectedTrip(updated);
                    setShowInvite(false);
                  }}
                  className="w-full mt-4 py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold"
                >
                  Save collaborators
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cover Crop Modal */}
        {coverCropFile && coverCropTarget === 'edit' && (
          <CoverCropModal
            file={coverCropFile}
            onCancel={() => { setCoverCropFile(null); setCoverCropTarget(null); }}
            onConfirm={async (blob, previewUrl) => {
              setCoverCropFile(null);
              setCoverCropTarget(null);
              if (!userId) { setEditPlanCoverImage(previewUrl); return; }
              setCoverCropSaving(true);
              const path = `plan-covers/${userId}/${Date.now()}.jpg`;
              const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
              if (!error) setEditPlanCoverImage(getPublicUrl('avatars', path));
              else setEditPlanCoverImage(previewUrl);
              setCoverCropSaving(false);
            }}
          />
        )}

        {/* Add Place Sheet */}
        {showAddPlace && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddPlace(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
              {/* handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              {/* header */}
              <div className="flex items-center px-5 pt-2 pb-3 flex-shrink-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex-1">Add a place</p>
                <button onClick={() => setShowAddPlace(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={15} strokeWidth={2} className="text-gray-500" />
                </button>
              </div>

              {/* scrollable body */}
              <div ref={addPlaceScrollRef} className="flex-1 overflow-y-auto px-5 pb-8">
                {/* Day selector */}
                {selectedTrip && selectedTrip.days.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Which day?</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedTrip.days.map(day => (
                        <button
                          key={day.id ?? day.label}
                          onClick={() => setAddPlaceDayId(day.id ?? null)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            addPlaceDayId === (day.id ?? null)
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Title</p>
                  <input
                    value={addPlaceSelectedName}
                    onChange={e => setAddPlaceSelectedName(e.target.value)}
                    placeholder="e.g. Dinner at Carbone"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400"
                  />
                </div>

                {/* Address search */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Address <span className="font-normal">(optional)</span></p>
                    <div>
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                        <input
                          value={addPlaceSearch}
                          onChange={e => {
                            const val = e.target.value;
                            setAddPlaceSearch(val);
                            if (addPlaceTimerRef.current) clearTimeout(addPlaceTimerRef.current);
                            if (!val.trim()) { setAddPlaceSuggestions([]); setAddPlaceMapsNote(''); return; }
                            // Detect Google Maps URLs and handle separately
                            if (/maps\.app\.goo\.gl|google\.com\/maps|maps\.google\.com/.test(val)) {
                              handleMapsUrl(val);
                              return;
                            }
                            addPlaceTimerRef.current = setTimeout(async () => {
                              setAddPlaceSearching(true);
                              try {
                                const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
                                  body: JSON.stringify({ input: val, languageCode: 'en' }),
                                });
                                const data = await res.json();
                                setAddPlaceSuggestions(
                                  (data.suggestions ?? [])
                                    .map((s: any) => ({ placeId: s.placePrediction?.placeId ?? '', text: s.placePrediction?.text?.text ?? '' }))
                                    .filter((s: any) => s.placeId)
                                    .slice(0, 6)
                                );
                              } catch { setAddPlaceSuggestions([]); }
                              setAddPlaceSearching(false);
                            }, 400);
                          }}
                          placeholder="Search restaurant, stay, activity…"
                          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                        />
                        {addPlaceSearching && <Loader2 size={14} className="text-gray-400 animate-spin flex-shrink-0" />}
                      </div>
                      {addPlaceMapsNote && (
                        <p className={`text-xs mt-1.5 px-1 ${addPlaceMapsNote.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>
                          {addPlaceMapsNote}
                        </p>
                      )}
                      {addPlaceSuggestions.length > 0 && (
                        <div
                          ref={el => {
                            addPlaceSuggestionsRef.current = el;
                            if (el && addPlaceScrollRef.current) {
                              setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                            }
                          }}
                          className="mt-1 bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden"
                        >
                          {addPlaceSuggestions.map(s => (
                            <button
                              key={s.placeId}
                              onMouseDown={e => e.preventDefault()}
                              onClick={async () => {
                                setAddPlaceSelectedId(s.placeId);
                                setAddPlaceSuggestions([]);
                                // Show the full suggestion text in the address search field
                                setAddPlaceSearch(s.text);
                                // Fetch full details: clean display name, address, neighborhood
                                try {
                                  const res = await fetch(`https://places.googleapis.com/v1/places/${s.placeId}`, {
                                    headers: {
                                      'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
                                      'X-Goog-FieldMask': 'displayName,formattedAddress,addressComponents,photos',
                                      'X-Goog-LanguageCode': 'en',
                                    },
                                  });
                                  const data = await res.json();
                                  if (data.displayName?.text) {
                                    setAddPlaceSelectedName(prev => {
                                      const prevClean = prev.trim();
                                      if (!prevClean || prevClean === s.text) return data.displayName.text;
                                      return prev;
                                    });
                                  } else if (!addPlaceSelectedName.trim()) {
                                    setAddPlaceSelectedName(s.text);
                                  }
                                  if (data.formattedAddress) setAddPlaceAddress(data.formattedAddress);
                                  const area = extractNeighborhood(data.addressComponents ?? [], data.formattedAddress);
                                  if (area) setAddPlaceNeighborhood(area);
                                  // Fetch photo immediately using the exact Place ID — no background guessing
                                  const photoName = data.photos?.[0]?.name;
                                  if (photoName && !addPlaceCustomImage) {
                                    setAddPlaceCustomImage(
                                      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${GOOGLE_PLACES_KEY}`
                                    );
                                  }
                                } catch {
                                  // Fallback: use suggestion text as title
                                  if (!addPlaceSelectedName.trim()) setAddPlaceSelectedName(s.text);
                                }
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left"
                            >
                              <MapPin size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-800">{s.text}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                </div>

                {/* Neighborhood */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Neighborhood <span className="font-normal">(optional)</span></p>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <MapPin size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <input value={addPlaceNeighborhood} onChange={e => setAddPlaceNeighborhood(e.target.value)} placeholder="Auto-filled from search" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                  </div>
                </div>

                {/* Custom image */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Photo <span className="font-normal">(optional)</span></p>
                  {addPlaceCustomImage ? (
                    <div className="relative">
                      <img src={addPlaceCustomImage} alt="custom" className="w-full h-32 object-cover rounded-2xl" />
                      <button onClick={() => setAddPlaceCustomImage('')} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                        <X size={12} strokeWidth={2} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-24 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-gray-400 cursor-pointer">
                      <Plus size={18} strokeWidth={1.5} />
                      <span className="text-xs">Add your own photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const preview = URL.createObjectURL(file);
                        setAddPlaceCustomImage(preview);
                        setAddPlaceUploading(true);
                        if (userId) {
                          const path = `plan-items/${userId}/${Date.now()}.jpg`;
                          const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                          if (!error) setAddPlaceCustomImage(getPublicUrl('avatars', path));
                        }
                        setAddPlaceUploading(false);
                      }} />
                    </label>
                  )}
                </div>

                {/* Category */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Type <span className="font-normal">(optional)</span></p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'restaurant', label: '🍽 Restaurant' },
                      { key: 'hotel', label: '🏨 Stay' },
                      { key: 'cafe', label: '☕ Café' },
                      { key: 'bar', label: '🍸 Bar' },
                      { key: 'attraction', label: '🏛️ Attraction' },
                      { key: 'nature', label: '🌿 Nature' },
                      { key: 'shop', label: '🛍 Shop' },
                      { key: 'experience', label: '🗺️ Experience' },
                      { key: 'sports', label: '🎾 Sports' },
                      { key: 'flight', label: '✈️ Flight' },
                      { key: 'transport', label: '🚗 Transport' },
                      { key: 'event', label: '🎟️ Event' },
                      { key: 'beach', label: '🏖️ Beach' },
                      { key: 'food', label: '🍕 Food' },
                      { key: 'wellness', label: '💆 Wellness' },
                    ].map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => setAddPlaceCategory(prev => prev === cat.key ? '' : cat.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          addPlaceCategory === cat.key
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time — conditional on category */}
                {addPlaceCategory === 'hotel' ? (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Check-in / Check-out <span className="font-normal">(optional)</span></p>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                        <CalendarDays size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                        <input value={addPlaceCheckIn} onChange={e => setAddPlaceCheckIn(e.target.value)} placeholder="Check-in date" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                      </div>
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                        <CalendarDays size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                        <input value={addPlaceCheckOut} onChange={e => setAddPlaceCheckOut(e.target.value)} placeholder="Check-out date" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <TimePicker label="Check-in time" value={addPlaceTime} onChange={setAddPlaceTime} />
                      <TimePicker label="Check-out time" value={addPlaceTimeEnd} onChange={setAddPlaceTimeEnd} />
                    </div>
                  </div>
                ) : addPlaceCategory ? (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Time <span className="font-normal">(optional)</span></p>
                    <div className="flex gap-2">
                      <TimePicker label="Starts" value={addPlaceTime} onChange={setAddPlaceTime} />
                      <TimePicker label="Ends" value={addPlaceTimeEnd} onChange={setAddPlaceTimeEnd} />
                    </div>
                  </div>
                ) : null}

                {/* Status */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Status <span className="font-normal">(optional)</span></p>
                  <div className="flex gap-2">
                    {(['none', 'pending', 'booked'] as const).map(s => (
                      <button key={s} onClick={() => setAddPlaceStatus(s)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          addPlaceStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                        }`}>
                        {s === 'none' ? '—' : s === 'pending' ? 'Pending' : 'Booked'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Notes <span className="font-normal">(optional)</span></p>
                  <textarea
                    value={addPlaceNotes}
                    onChange={e => setAddPlaceNotes(e.target.value)}
                    placeholder="Who you went with, what you ordered, how was it…"
                    rows={3}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 resize-none"
                  />
                </div>

                {/* Save */}
                <button
                  onClick={() => {
                    const id = addPlaceSelectedId;
                    const name = addPlaceSelectedName || addPlaceSearch.trim();
                    if (name) handleSelectPlace(id, name, addPlaceTime, addPlaceTimeEnd, addPlaceNotes, addPlaceCategory, addPlaceAddress || addPlaceLocation, addPlaceNeighborhood);
                  }}
                  disabled={(!addPlaceSelectedId && !addPlaceSearch.trim()) || addPlaceSaving || addPlaceUploading}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {addPlaceUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : addPlaceSaving ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : 'Add to plan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item Detail — bottom sheet */}
        {showItemDetail && detailItem && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowItemDetail(false); setShowDuplicatePicker(false); }} />
            <div className="relative bg-white rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
            {/* Photo header */}
            <div className="relative flex-shrink-0">
              {detailItem.image && detailItem.image !== 'none'
                ? <img src={detailItem.image} alt={detailItem.name} className="w-full object-cover rounded-t-3xl" style={{ height: '48vw', maxHeight: 220, minHeight: 160 }}
                    onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty('display'); }} />
                : null}
              <div
                style={(detailItem.image && detailItem.image !== 'none') ? { display: 'none', height: '36vw', maxHeight: 160, minHeight: 120 } : { height: '36vw', maxHeight: 160, minHeight: 120 }}
                className="w-full flex items-center justify-center bg-gray-100 rounded-t-3xl text-6xl"
              >{categoryEmoji[detailItem.category] ?? '📍'}</div>
              {/* X close */}
              <button onClick={() => setShowItemDetail(false)} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
                <X size={15} strokeWidth={2.5} className="text-white" />
              </button>
              {/* Edit button */}
              <button onClick={() => {
                setShowItemDetail(false);
                setEditItem(detailItem);
                setEditItemDayId(detailItemDayId);
                setMoveToDay(null);
                setEditItemAddressSearch(detailItem.address ?? '');
                setEditItemAddressSuggestions([]);
                setShowEditItem(true);
              }} className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 text-white text-sm font-semibold px-4 py-2 rounded-full">
                <Pencil size={12} strokeWidth={2} /> Edit
              </button>
              {/* Status badge */}
              {(detailItem.status === 'booked' || detailItem.booked) && (
                <span className="absolute bottom-4 right-4 text-sm bg-green-500 text-white font-bold px-4 py-1.5 rounded-full shadow-sm">Booked</span>
              )}
              {detailItem.status === 'pending' && (
                <span className="absolute bottom-4 right-4 text-sm bg-amber-400 text-white font-bold px-4 py-1.5 rounded-full shadow-sm">Pending</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10">
              {/* Title */}
              <h2 className="text-2xl font-black text-gray-900 leading-tight mb-1">{detailItem.name}</h2>
              {/* Category · neighborhood */}
              <p className="text-sm text-gray-400 mb-4 flex items-center gap-1">
                <span>{categoryEmoji[detailItem.category] ?? '📍'}</span>
                <span>{categoryDisplayName[detailItem.category] ?? detailItem.category}</span>
                {detailItem.neighborhood && <><span>·</span><span>{detailItem.neighborhood}</span></>}
              </p>

              {/* Time */}
              {detailItem.time && (
                <div className="flex items-center gap-3 mb-3">
                  <Clock size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <p className="text-base text-gray-800">{detailItem.time}{detailItem.timeEnd ? ` – ${detailItem.timeEnd}` : ''}</p>
                </div>
              )}
              {/* Check-in / out */}
              {(detailItem.checkIn || detailItem.checkOut) && (
                <div className="flex items-center gap-3 mb-3">
                  <CalendarDays size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <p className="text-base text-gray-800">{detailItem.checkIn}{detailItem.checkIn && detailItem.checkOut ? ' → ' : ''}{detailItem.checkOut}</p>
                </div>
              )}
              {/* Address */}
              {(detailItem.address || detailItem.neighborhood) && (
                <div className="flex items-start gap-3 mb-4">
                  <MapPin size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-base text-gray-800">{detailItem.address || detailItem.neighborhood}</p>
                </div>
              )}

              {/* Notes */}
              {detailItem.notes && (
                <div className="bg-gray-50 rounded-2xl px-4 py-4 mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
                  <p className="text-base text-gray-800 leading-relaxed">{detailItem.notes}</p>
                </div>
              )}

              {/* Duplicate to another day */}
              {selectedTrip && selectedTrip.days.length > 1 && (
                <div className="mt-4 mb-2">
                  {!showDuplicatePicker ? (
                    <button
                      onClick={() => setShowDuplicatePicker(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-100 text-sm text-gray-500 font-semibold"
                    >
                      <Plus size={14} strokeWidth={2} /> Duplicate to another day
                    </button>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-gray-400 mb-3">Copy to which day?</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedTrip.days.filter(d => d.id !== detailItemDayId).map(day => (
                          <button
                            key={day.id ?? day.label}
                            onClick={async () => {
                              if (!day.id || !selectedTrip || !detailItem) return;
                              const dbItem = await createPlanItem(selectedTrip.id, day.id, {
                                name: detailItem.name, category: detailItem.category, image_url: detailItem.image ?? '',
                                time_label: detailItem.time ?? '', time_end: detailItem.timeEnd ?? '',
                                notes: detailItem.notes ?? '', address: detailItem.address ?? '', neighborhood: detailItem.neighborhood ?? '',
                                status: detailItem.status ?? 'none', check_in: detailItem.checkIn, check_out: detailItem.checkOut,
                                position: day.items.length,
                              });
                              if (dbItem) {
                                const newItem: TripItem = {
                                  id: dbItem.id, name: dbItem.name, category: dbItem.category, image: dbItem.imageUrl,
                                  address: dbItem.address, neighborhood: dbItem.neighborhood,
                                  time: dbItem.timeLabel, timeEnd: dbItem.timeEnd, notes: dbItem.notes,
                                  status: dbItem.status as TripItem['status'], checkIn: dbItem.checkIn, checkOut: dbItem.checkOut,
                                  booked: dbItem.booked,
                                };
                                const updatedDays = selectedTrip.days.map(d =>
                                  d.id === day.id ? { ...d, items: [...d.items, newItem] } : d
                                );
                                const updated = { ...selectedTrip, days: updatedDays };
                                setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                                setSelectedTrip(updated);
                              }
                              setShowDuplicatePicker(false);
                            }}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700"
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowDuplicatePicker(false)} className="text-xs text-gray-400 font-medium">Cancel</button>
                    </div>
                  )}
                </div>
              )}

              {/* Who's coming */}
              {(() => {
                const invitesForThis = itemInvites.filter(inv => inv.planItemId === detailItem.id);
                const collabs = selectedTrip?.collaborators ?? [];
                const hasAnyone = collabs.length > 0 || invitesForThis.length > 0;
                return hasAnyone ? (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Who's coming</p>
                    <div className="flex flex-wrap gap-2">
                      {collabs.map(c => (
                        <div key={c.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5">
                          {c.avatar ? <img src={c.avatar} alt={c.name} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{c.name[0]}</div>}
                          <span className="text-xs font-semibold text-gray-700">{c.name}</span>
                        </div>
                      ))}
                      {invitesForThis.map(inv => (
                        <div key={inv.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5">
                          {inv.invitedByAvatar ? <img src={inv.invitedByAvatar} alt={inv.invitedByName} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{inv.invitedByName[0]}</div>}
                          <span className="text-xs font-semibold text-gray-700">{inv.invitedByName}</span>
                          <span className={`text-[10px] font-semibold ${inv.status === 'accepted' ? 'text-green-500' : 'text-amber-500'}`}>{inv.status === 'accepted' ? '✓' : '…'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            </div> {/* end sheet inner */}
          </div>
        )}

        {/* Edit Item Sheet */}
        {showEditItem && editItem && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditItem(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="flex items-center px-5 pt-2 pb-3 flex-shrink-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex-1">Edit place / plan</p>
                <button onClick={() => setShowEditItem(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={15} strokeWidth={2} className="text-gray-500" /></button>
              </div>
              <div ref={editItemScrollRef} className="flex-1 overflow-y-auto px-5 pb-8">
                {/* Photo */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Photo</p>
                  <div className="relative">
                    {editItem.image && editItem.image !== 'none' ? (
                      <img
                        src={editItem.image}
                        alt={editItem.name}
                        className="w-full h-36 object-cover rounded-2xl"
                        onError={async e => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
                          // Auto-clear broken URL from DB so enrichment can re-fetch
                          setEditItem(prev => prev ? { ...prev, image: '' } : prev);
                          await updatePlanItem(editItem.id, { image_url: '' });
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-36 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-5xl"
                      style={(editItem.image && editItem.image !== 'none') ? { display: 'none' } : {}}
                    >
                      {categoryEmoji[editItem.category] ?? '📍'}
                    </div>
                    <label className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer">
                      <Pencil size={11} strokeWidth={2} /> Change photo
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setEditItem(prev => prev ? { ...prev, image: URL.createObjectURL(file) } : prev);
                        setEditItemUploading(true);
                        if (userId) {
                          const path = `plan-items/${userId}/${Date.now()}.jpg`;
                          const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                          if (!error) {
                            const publicUrl = getPublicUrl('avatars', path);
                            setEditItem(prev => prev ? { ...prev, image: publicUrl } : prev);
                          }
                        }
                        setEditItemUploading(false);
                      }} />
                    </label>
                    {editItem.image && editItem.image !== 'none' && (
                      <button
                        onClick={async () => {
                          setEditItem(prev => prev ? { ...prev, image: 'none' } : prev);
                          await updatePlanItem(editItem.id, { image_url: 'none' });
                        }}
                        className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full"
                      >
                        <X size={10} strokeWidth={2.5} /> Remove
                      </button>
                    )}
                  </div>
                </div>
                {/* Name */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Name</p>
                  <input value={editItem.name} onChange={e => setEditItem(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none" />
                </div>
                {/* Address with Google Places autocomplete */}
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Address</p>
                  <div className="relative">
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <Search size={14} className="text-gray-400 flex-shrink-0" />
                      <input
                        value={editItemAddressSearch}
                        onChange={e => {
                          const val = e.target.value;
                          setEditItemAddressSearch(val);
                          setEditItem(prev => prev ? { ...prev, address: val } : prev);
                          if (editItemAddressTimerRef.current) clearTimeout(editItemAddressTimerRef.current);
                          if (!val.trim()) { setEditItemAddressSuggestions([]); return; }
                          editItemAddressTimerRef.current = setTimeout(async () => {
                            setEditItemAddressSearching(true);
                            try {
                              const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
                                body: JSON.stringify({ input: val, languageCode: 'en' }),
                              });
                              const data = await res.json();
                              setEditItemAddressSuggestions(
                                (data.suggestions ?? [])
                                  .map((s: any) => ({ placeId: s.placePrediction?.placeId ?? '', text: s.placePrediction?.text?.text ?? '' }))
                                  .filter((s: any) => s.placeId)
                                  .slice(0, 6)
                              );
                            } catch { setEditItemAddressSuggestions([]); }
                            setEditItemAddressSearching(false);
                          }, 400);
                        }}
                        placeholder="Search or type address…"
                        className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                      />
                      {editItemAddressSearching && <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />}
                    </div>
                    {editItemAddressSuggestions.length > 0 && (
                      <div
                        ref={el => {
                          editItemSuggestionsRef.current = el;
                          if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                        }}
                        className="mt-1 bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden"
                      >
                        {editItemAddressSuggestions.map(s => (
                          <button
                            key={s.placeId}
                            onMouseDown={e => e.preventDefault()}
                            onClick={async () => {
                              setEditItemAddressSuggestions([]);
                              setEditItemAddressSearch(s.text);
                              setEditItem(prev => prev ? { ...prev, address: s.text } : prev);
                              // Fetch full details for formatted address + neighborhood
                              try {
                                const res = await fetch(`https://places.googleapis.com/v1/places/${s.placeId}`, {
                                  headers: {
                                    'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
                                    'X-Goog-FieldMask': 'displayName,formattedAddress,addressComponents,photos',
                                    'X-Goog-LanguageCode': 'en',
                                  },
                                });
                                const data = await res.json();
                                if (data.formattedAddress) {
                                  setEditItemAddressSearch(data.formattedAddress);
                                  setEditItem(prev => prev ? { ...prev, address: data.formattedAddress } : prev);
                                }
                                const area = extractNeighborhood(data.addressComponents ?? [], data.formattedAddress);
                                if (area) setEditItem(prev => prev ? { ...prev, neighborhood: area } : prev);
                                // Auto-fill photo if none
                                const photoName = data.photos?.[0]?.name;
                                if (photoName) {
                                  setEditItem(prev => {
                                    if (!prev || prev.image) return prev;
                                    return { ...prev, image: `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}` };
                                  });
                                }
                              } catch { /* ignore */ }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left"
                          >
                            <MapPin size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-800">{s.text}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Neighborhood */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Neighborhood</p>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <MapPin size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <input value={editItem.neighborhood ?? ''} onChange={e => setEditItem(prev => prev ? { ...prev, neighborhood: e.target.value } : prev)}
                      placeholder="Auto-filled from search" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                  </div>
                </div>
                {/* Category */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Type</p>
                  <div className="flex gap-2 flex-wrap">
                    {[{ key: 'restaurant', label: '🍽 Restaurant' },{ key: 'hotel', label: '🏨 Stay' },{ key: 'cafe', label: '☕ Café' },{ key: 'bar', label: '🍸 Bar' },{ key: 'attraction', label: '🏛️ Attraction' },{ key: 'nature', label: '🌿 Nature' },{ key: 'shop', label: '🛍 Shop' },{ key: 'experience', label: '🗺️ Experience' },{ key: 'sports', label: '🎾 Sports' },{ key: 'flight', label: '✈️ Flight' },{ key: 'transport', label: '🚗 Transport' },{ key: 'event', label: '🎟️ Event' },{ key: 'beach', label: '🏖️ Beach' },{ key: 'food', label: '🍕 Food' },{ key: 'wellness', label: '💆 Wellness' }].map(cat => (
                      <button key={cat.key} onClick={() => setEditItem(prev => prev ? { ...prev, category: cat.key } : prev)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${editItem.category === cat.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Time — conditional */}
                {editItem.category === 'hotel' ? (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Check-in / Check-out</p>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                        <CalendarDays size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                        <input value={editItem.checkIn ?? ''} onChange={e => setEditItem(prev => prev ? { ...prev, checkIn: e.target.value } : prev)}
                          placeholder="Check-in date" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                      </div>
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                        <CalendarDays size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                        <input value={editItem.checkOut ?? ''} onChange={e => setEditItem(prev => prev ? { ...prev, checkOut: e.target.value } : prev)}
                          placeholder="Check-out date" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <TimePicker label="Check-in time" value={editItem.time} onChange={v => setEditItem(prev => prev ? { ...prev, time: v } : prev)} />
                      <TimePicker label="Check-out time" value={editItem.timeEnd} onChange={v => setEditItem(prev => prev ? { ...prev, timeEnd: v } : prev)} />
                    </div>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Time</p>
                    <div className="flex gap-2">
                      <TimePicker label="Starts" value={editItem.time} onChange={v => setEditItem(prev => prev ? { ...prev, time: v } : prev)} />
                      <TimePicker label="Ends" value={editItem.timeEnd} onChange={v => setEditItem(prev => prev ? { ...prev, timeEnd: v } : prev)} />
                    </div>
                  </div>
                )}
                {/* Status */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Status</p>
                  <div className="flex gap-2">
                    {(['none','pending','booked'] as const).map(s => (
                      <button key={s} onClick={() => setEditItem(prev => prev ? { ...prev, status: s } : prev)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${editItem.status === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {s === 'none' ? '—' : s === 'pending' ? 'Pending' : 'Booked'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Notes */}
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Notes</p>
                  <textarea value={editItem.notes ?? ''} onChange={e => setEditItem(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                    rows={3} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none resize-none placeholder:text-gray-400"
                    placeholder="Who you went with, what you ordered…" />
                </div>
                {/* Move to day */}
                {selectedTrip && selectedTrip.days.length > 1 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Day</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedTrip.days.map(day => (
                        <button key={day.id ?? day.label}
                          onClick={() => setMoveToDay(day.id === editItemDayId ? null : (day.id ?? null))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            (moveToDay === day.id || (!moveToDay && day.id === editItemDayId))
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}>
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Save */}
                <button onClick={async () => {
                  if (!editItem || !selectedTrip) return;
                  const targetDayId = moveToDay ?? editItemDayId;
                  if (userId) {
                    await updatePlanItem(editItem.id, {
                      name: editItem.name, category: editItem.category,
                      // Never write a blob: URL — only save when it's a real persistent URL
                      ...(editItem.image?.startsWith('blob:') ? {} : { image_url: editItem.image ?? '' }),
                      time_label: editItem.time ?? '', time_end: editItem.timeEnd ?? '',
                      notes: editItem.notes ?? '',
                      address: editItem.address ?? '', neighborhood: editItem.neighborhood ?? '',
                      status: editItem.status ?? 'none',
                      check_in: editItem.checkIn ?? '', check_out: editItem.checkOut ?? '',
                      ...(moveToDay ? { plan_day_id: moveToDay } : {}),
                    });
                  }
                  // Remove from old day, add to new day (or update in same day)
                  let updatedDays = selectedTrip.days.map(d => ({
                    ...d, items: d.items.filter(i => i.id !== editItem.id),
                  }));
                  updatedDays = updatedDays.map(d =>
                    d.id === targetDayId ? { ...d, items: [...d.items, editItem] } : d
                  );
                  let updated = { ...selectedTrip, days: updatedDays };
                  updated = await autoPopulateStay(editItem, targetDayId, updated);
                  setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                  setSelectedTrip(updated);
                  if (detailItem?.id === editItem.id) setDetailItem(editItem);
                  setMoveToDay(null);
                  setShowEditItem(false);
                }} disabled={editItemUploading} className={`w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-colors ${editItemUploading ? 'bg-gray-300' : 'bg-gray-900'}`}>
                  Save changes
                </button>
                {/* Who's coming */}
                {(() => {
                  const itemInvitesForThis = itemInvites.filter(inv => inv.planItemId === editItem?.id);
                  const collabs = selectedTrip?.collaborators ?? [];
                  const hasAnyone = collabs.length > 0 || itemInvitesForThis.length > 0;
                  return hasAnyone ? (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-400 mb-2">Who's coming</p>
                      <div className="flex flex-wrap gap-2">
                        {collabs.map(c => (
                          <div key={c.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5">
                            {c.avatar
                              ? <img src={c.avatar} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                              : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-500">{c.name[0]}</div>
                            }
                            <span className="text-xs font-semibold text-gray-700">{c.name}</span>
                          </div>
                        ))}
                        {itemInvitesForThis.map(inv => (
                          <div key={inv.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5">
                            {inv.invitedByAvatar
                              ? <img src={inv.invitedByAvatar} alt={inv.invitedByName} className="w-5 h-5 rounded-full object-cover" />
                              : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-500">{inv.invitedByName[0]}</div>
                            }
                            <span className="text-xs font-semibold text-gray-700">{inv.invitedByName}</span>
                            <span className={`text-[10px] font-semibold ${inv.status === 'accepted' ? 'text-green-500' : 'text-amber-500'}`}>
                              {inv.status === 'accepted' ? '✓' : '…'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                {/* Invite */}
                <button onClick={async () => {
                  setShowItemInvite(true);
                  setItemInviteSearch('');
                  setItemInviteSentTo([]);
                  if (userId) {
                    const [followers, following] = await Promise.all([getFollowerProfiles(userId), getFollowingProfiles(userId)]);
                    const combined = [...followers, ...following].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
                    setItemInviteFollowList(combined);
                    setItemInviteSuggestions(combined);
                  }
                }} className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-2">
                  <UserPlus size={15} strokeWidth={2} /> Invite someone
                </button>
                {/* Delete */}
                <button onClick={async () => {
                  if (!editItem || !selectedTrip) return;
                  if (userId) await deletePlanItem(editItem.id);
                  const updatedDays = selectedTrip.days.map(d => ({ ...d, items: d.items.filter(i => i.id !== editItem.id) }));
                  const updated = { ...selectedTrip, days: updatedDays };
                  setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                  setSelectedTrip(updated);
                  setShowEditItem(false);
                }} className="w-full py-3 text-red-500 text-sm font-semibold mt-2">
                  Remove from plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item Invite Sheet */}
        {showItemInvite && editItem && (
          <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowItemInvite(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '75vh' }}>
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="flex items-center px-5 pt-2 pb-3 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Invite to {editItem.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">They'll see this as a standalone item in their Trips</p>
                </div>
                <button onClick={() => setShowItemInvite(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ml-3 flex-shrink-0">
                  <X size={15} strokeWidth={2} className="text-gray-500" />
                </button>
              </div>
              {/* Search */}
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={itemInviteSearch}
                    onChange={e => {
                      setItemInviteSearch(e.target.value);
                      const q = e.target.value.toLowerCase();
                      setItemInviteSuggestions(q
                        ? itemInviteFollowList.filter(p => p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
                        : itemInviteFollowList
                      );
                    }}
                    placeholder="Search people…"
                    className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>
              {/* People list */}
              <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-1">
                {itemInviteSuggestions.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">
                    {itemInviteFollowList.length === 0 ? 'Follow people to invite them' : 'No people found'}
                  </p>
                )}
                {itemInviteSuggestions.map(person => (
                  <div key={person.id} className="flex items-center gap-3 py-2.5">
                    {person.avatarUrl
                      ? <img src={person.avatarUrl} alt={person.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{person.name[0]}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                      <p className="text-xs text-gray-400">@{person.username}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (itemInviteSentTo.includes(person.id) || !userId || !selectedTrip) return;
                        setItemInviteSending(true);
                        const dayIdx = editItemDayId ? selectedTrip.days.findIndex(d => d.id === editItemDayId) : -1;
                        const eventDate = dayIdx >= 0 ? getTripDayLabel(selectedTrip, dayIdx) : '';
                        await createItemInvite({
                          planItemId: editItem.id,
                          planId: selectedTrip.id,
                          invitedBy: userId,
                          invitedUserId: person.id,
                          itemName: editItem.name,
                          itemCategory: editItem.category,
                          itemImageUrl: editItem.image ?? '',
                          itemTime: editItem.time ?? '',
                          itemTimeEnd: editItem.timeEnd ?? '',
                          itemAddress: editItem.address ?? '',
                          itemNeighborhood: editItem.neighborhood ?? '',
                          itemNotes: editItem.notes ?? '',
                          eventDate,
                        });
                        setItemInviteSentTo(prev => [...prev, person.id]);
                        setItemInviteSending(false);
                      }}
                      disabled={itemInviteSentTo.includes(person.id) || itemInviteSending}
                      className={`text-xs font-bold px-4 py-2 rounded-full transition-colors flex-shrink-0 ${
                        itemInviteSentTo.includes(person.id)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-900 text-white'
                      }`}
                    >
                      {itemInviteSentTo.includes(person.id) ? '✓ Sent' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── Collection Detail ─────────────────────────────────────────
  if (selectedCollection) {
    const extraIds = colAdditions[selectedCollection.id] ?? [];
    const colPlaces = places.filter(p => [...selectedCollection.placeIds, ...extraIds].includes(p.id));
    const curator = selectedCollection.curatorId ? users.find(u => u.id === selectedCollection.curatorId) : null;
    const isOwn = selectedCollection.curatorId === 'user-1';
    const isPremium = selectedCollection.isPremium && !isOwn;
    const countries = [...new Set(colPlaces.map(p => p.country))].length;

    return (
      <>
      <div className="bg-white min-h-screen">
        {/* Hero */}
        <div className="relative h-64">
          <img src={selectedCollection.coverImage} alt={selectedCollection.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          <button
            onClick={() => setSelectedCollection(null)}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
            <Share2 size={15} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-black text-white">{selectedCollection.name}</h2>
            <p className="text-white/70 text-xs mt-1">{selectedCollection.description}</p>
          </div>
        </div>

        {/* Curator row */}
        {curator && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <img src={curator.avatar} alt={curator.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold text-gray-900">{curator.name}</p>
                {curator.isCreator && <BadgeCheck size={13} className="text-blue-500 fill-blue-500" strokeWidth={1.5} />}
              </div>
              <p className="text-xs text-gray-400">@{curator.username}</p>
            </div>
            {!isOwn ? (
              <button className="text-xs font-bold bg-gray-900 text-white rounded-full px-3 py-1.5 flex-shrink-0">
                Follow
              </button>
            ) : (
              <button className="text-xs font-medium text-gray-400 border border-gray-200 rounded-full px-3 py-1.5 flex-shrink-0">
                Edit
              </button>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center divide-x divide-gray-100 border-b border-gray-100">
          {[
            { value: colPlaces.length, label: 'Places' },
            { value: (selectedCollection.followerCount ?? 0).toLocaleString(), label: 'Subscribers' },
            { value: countries, label: countries === 1 ? 'Country' : 'Countries' },
          ].map(s => (
            <div key={s.label} className="flex-1 py-3 text-center">
              <p className="text-base font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="px-4 pt-4">
          <Suspense fallback={<div className="h-48 bg-gray-100 rounded-xl animate-pulse" />}>
            <MapView places={colPlaces} height="200px" />
          </Suspense>
        </div>

        {/* Filter bar */}
        {(() => {
          const cats = [...new Set(colPlaces.map(p => p.category))];
          const hasNeighbourhoods = colPlaces.some(p => p.neighbourhood);
          const filtered = colCategoryFilter === 'all' ? colPlaces : colPlaces.filter(p => p.category === colCategoryFilter);

          // Group by neighbourhood or city for area view
          const grouped: { label: string; items: typeof colPlaces }[] = [];
          if (colViewMode === 'area') {
            const areaMap = new Map<string, typeof colPlaces>();
            filtered.forEach(p => {
              const key = p.neighbourhood ?? p.city;
              if (!areaMap.has(key)) areaMap.set(key, []);
              areaMap.get(key)!.push(p);
            });
            areaMap.forEach((items, label) => grouped.push({ label, items }));
          }

          return (
            <div className="pt-3 pb-10 px-4">
              {/* Places count + view toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{filtered.length} places</p>
                  {isOwn && (
                    <button onClick={() => setShowAddPlaces(true)} className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                      <Plus size={11} strokeWidth={2.5} className="text-gray-500" />
                    </button>
                  )}
                </div>
                {hasNeighbourhoods && (
                  <div className="flex bg-gray-100 rounded-full p-0.5">
                    {(['list', 'area'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setColViewMode(mode)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          colViewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                        }`}
                      >
                        {mode === 'list' ? 'List' : 'Area'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category chips — scrollable, bleeds to edge */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 mb-3">
                {[{ id: 'all' as const, label: 'All' }, ...cats.map(c => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setColCategoryFilter(cat.id)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      colCategoryFilter === cat.id
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-gray-50 border-gray-100 text-gray-500'
                    }`}
                  >
                    {cat.id !== 'all' && <span>{categoryEmoji[cat.id] ?? '📍'}</span>}
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Places */}
              <div className="relative">
                {colViewMode === 'area' ? (
                  <div className="space-y-5">
                    {grouped.map(({ label, items }, gi) => (
                      <div key={label}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                          📍 {label}
                        </p>
                        <div className="space-y-2.5">
                          {items.map((place, i) => <PlaceRow key={place.id} place={place} isLocked={!!(isPremium && gi === 0 && i >= 2)} isSaved={savedPlaceSet.has(place.id)} onToggleSave={() => setSavedPlaceSet(prev => { const next = new Set(prev); savedPlaceSet.has(place.id) ? next.delete(place.id) : next.add(place.id); return next; })} onBook={() => setBookingPlace(place)} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filtered.map((place, i) => <PlaceRow key={place.id} place={place} isLocked={!!(isPremium && i >= 2)} isSaved={savedPlaceSet.has(place.id)} onToggleSave={() => setSavedPlaceSet(prev => { const next = new Set(prev); savedPlaceSet.has(place.id) ? next.delete(place.id) : next.add(place.id); return next; })} onBook={() => setBookingPlace(place)} />)}
                  </div>
                )}

                {/* Premium paywall */}
                {isPremium && colPlaces.length > 2 && (
                  <div className="absolute bottom-0 left-0 right-0 h-44 flex flex-col items-center justify-end">
                    <div className="w-full bg-gradient-to-t from-white via-white/95 to-transparent h-full absolute bottom-0" />
                    <div className="relative z-10 w-full bg-gray-900 rounded-2xl px-5 py-4 text-center">
                      <Lock size={16} className="text-amber-400 mx-auto mb-1" strokeWidth={1.5} />
                      <p className="text-white text-sm font-bold">Unlock the full guide</p>
                      <p className="text-white/60 text-xs mt-0.5">{colPlaces.length - 2} more places · one-time access</p>
                      <button className="mt-3 w-full bg-white text-gray-900 text-sm font-bold rounded-full py-2.5">
                        Subscribe for ${selectedCollection.price}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Add all to trip */}
        {!isPremium && (
          <div className="px-4 pb-8">
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium">
              <Plane size={14} strokeWidth={1.5} /> Add all to a trip
            </button>
          </div>
        )}
      </div>

      {/* Booking Sheet */}
      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />

      {/* Add Places Sheet */}
      {showAddPlaces && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowAddPlaces(false); setAddSearch(''); setAddCatFilter('all'); }} />
          <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <button
              onClick={() => { setShowAddPlaces(false); setAddSearch(''); setAddCatFilter('all'); }}
              className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
            >
              <X size={15} strokeWidth={2} className="text-gray-600" />
            </button>
            <div className="px-4 pt-1 pb-3 flex-shrink-0 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900 mb-3">Add places</h3>
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  placeholder="Search places..."
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2.5 -mx-4 px-4">
                {['all','cafe','restaurant','hotel','attraction','bar','nature','shop','experience'].map(c => (
                  <button
                    key={c}
                    onClick={() => setAddCatFilter(c)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${addCatFilter === c ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                  >
                    {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 pb-8">
              {(() => {
                const currentIds = new Set([...selectedCollection.placeIds, ...(colAdditions[selectedCollection.id] ?? [])]);
                const sl = addSearch.toLowerCase();
                const candidates = places.filter(p =>
                  !currentIds.has(p.id) &&
                  (addCatFilter === 'all' || p.category === addCatFilter) &&
                  (!addSearch || p.name.toLowerCase().includes(sl) || p.city.toLowerCase().includes(sl))
                );
                if (!candidates.length) return <p className="text-sm text-gray-400 text-center py-8">No places found</p>;
                return (
                  <div className="space-y-2.5">
                    {candidates.map(p => (
                      <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                        <img src={p.image} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                            <MapPin size={9} strokeWidth={1.5} />
                            {p.neighbourhood ?? p.city} · {categoryEmoji[p.category] ?? '📍'} {p.category}
                          </p>
                        </div>
                        <button
                          onClick={() => setColAdditions(prev => ({
                            ...prev,
                            [selectedCollection!.id]: [...(prev[selectedCollection!.id] ?? []), p.id],
                          }))}
                          className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0"
                        >
                          <Plus size={13} strokeWidth={2.5} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">curio</h1>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={15} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
          <input
            placeholder="Search saved places, plans..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-100">
          {([['Places', 'All saved'], ['Collections', 'Collections'], ['Trips', 'My plans'], ['Map', 'Map']] as [SavedTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-gray-900 border-b-2 border-gray-900 -mb-px'
                  : 'text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Places Tab */}
      {activeTab === 'Places' && userId && (
        <div className="pb-6">
          {realSavedPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🔖</span>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-1.5">Nothing saved yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">Tap the bookmark icon on any place to save it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-4 pt-3">
              {realSavedPlaces.map(place => (
                <div key={place.id} className="relative rounded-2xl overflow-hidden cursor-pointer">
                  <img src={place.photoUrl} alt={place.name} className="w-full aspect-square object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2.5 pt-6">
                    <p className="text-white text-xs font-semibold leading-tight truncate">{place.name}</p>
                    <p className="text-white/70 text-xs flex items-center gap-0.5 mt-0.5">
                      <MapPin size={9} strokeWidth={1.5} />{place.city}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'Places' && !userId && (
        <div className="pb-6">
          {isNewUser && savedPlaces.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🔖</span>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-1.5">Nothing saved yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">Tap the bookmark icon on any place to save it here</p>
            </div>
          )}
          {/* Category chips */}
          {savedPlaces.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 pt-3 pb-3">
              {placeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setPlaceCategory(cat.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all ${
                    placeCategory === cat.id
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-gray-50 border-gray-100 text-gray-600'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {(() => {
            const filtered = placeCategory === 'all'
              ? savedPlaces
              : savedPlaces.filter(p => p.category === placeCategory);
            return filtered.length === 0 && !(isNewUser && savedPlaces.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <p className="text-4xl mb-3">{placeCategories.find(c => c.id === placeCategory)?.emoji ?? '🔖'}</p>
                <p className="text-base font-bold text-gray-900">{placeCategory === 'all' ? 'No saved places' : `No saved ${placeCategories.find(c => c.id === placeCategory)?.label.toLowerCase()}s`}</p>
                <p className="text-sm text-gray-400 mt-1">Save places from the explore page to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-4">
                {filtered.map(place => (
                  <div key={place.id} className="relative rounded-2xl overflow-hidden cursor-pointer">
                    <img src={place.image} alt={place.name} className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2.5 pt-6">
                      <p className="text-white text-xs font-semibold leading-tight truncate">{place.name}</p>
                      <p className="text-white/70 text-xs flex items-center gap-0.5 mt-0.5">
                        <MapPin size={9} strokeWidth={1.5} />{place.city}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Collections Tab */}
      {activeTab === 'Collections' && (
        isNewUser && myCollections.length === 0 && dbCollections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">🗂️</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">Curate your favourite places into shareable collections</p>
            <button onClick={() => setShowNewCollection(true)} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold">
              <Plus size={14} strokeWidth={2} /> New collection
            </button>
          </div>
        ) : (
        <div className="px-4 pt-4 pb-6 space-y-6">
          {/* Mine */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mine</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {myCollections.map(col => (
                <div key={col.id} className="cursor-pointer" onClick={() => setSelectedCollection(col)}>
                  <div className="rounded-xl overflow-hidden aspect-square relative">
                    <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" style={col.id === 'col-8' ? { transform: 'scale(1.11)' } : undefined} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                  <p className="text-xs text-gray-400">{col.placeIds.length} places</p>
                </div>
              ))}
              <div className="cursor-pointer" onClick={() => { setNewColName(''); setNewColEmoji(''); setNewColDesc(''); setShowNewCollection(true); }}>
                <div className="rounded-xl border-2 border-dashed border-gray-200 aspect-square flex items-center justify-center bg-gray-50">
                  <Plus size={24} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 mt-2">New Collection</p>
              </div>
            </div>
          </div>

          {/* Following */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subscribed</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {followingCollections.map(col => {
                const curator = col.curatorId ? users.find(u => u.id === col.curatorId) : null;
                return (
                  <div key={col.id} className="cursor-pointer" onClick={() => setSelectedCollection(col)}>
                    <div className="rounded-xl overflow-hidden aspect-square relative">
                      <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" />
                      {col.isPremium && (
                        <div className="absolute top-2 left-2 bg-amber-400 rounded-full px-2 py-0.5 flex items-center gap-1">
                          <Lock size={9} strokeWidth={1.5} className="text-white" />
                          <p className="text-xs font-bold text-white">Premium · ${col.price}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                    {curator && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                        by {curator.name}
                        {curator.isCreator && <BadgeCheck size={11} className="text-blue-500 fill-blue-500" strokeWidth={1.5} />}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">{col.placeIds.length} places · {col.followerCount?.toLocaleString()} subscribers</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )
      )}

      {/* Trips Tab */}
      {activeTab === 'Trips' && (
        plansLoading ? (
          <div className="px-4 pt-8 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) :
        isNewUser && plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">✈️</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No plans yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">Start planning your next adventure and it'll appear here</p>
            <button onClick={() => setShowNewPlan(true)} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold">
              <Plus size={14} strokeWidth={2} /> New plan
            </button>
          </div>
        ) : (
        <div className="px-4 pt-4 pb-6 space-y-6">

          {/* Invited items */}
          {itemInvites.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">📬 Invited to</p>
              <div className="space-y-3">
                {itemInvites.map(invite => (
                  <div key={invite.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-start gap-3 p-3">
                      {invite.itemImageUrl
                        ? <img src={invite.itemImageUrl} alt={invite.itemName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        : <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">{categoryEmoji[invite.itemCategory] ?? '📍'}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{invite.itemName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {categoryEmoji[invite.itemCategory] ?? '📍'} {categoryDisplayName[invite.itemCategory] ?? invite.itemCategory}
                          {invite.itemNeighborhood ? ` · ${invite.itemNeighborhood}` : ''}
                        </p>
                        {invite.itemTime && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={9} strokeWidth={1.5} />
                            {invite.itemTime}{invite.itemTimeEnd ? ` – ${invite.itemTimeEnd}` : ''}
                          </p>
                        )}
                        {invite.eventDate && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <CalendarDays size={9} strokeWidth={1.5} />{invite.eventDate}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">From <span className="font-semibold text-gray-600">{invite.invitedByName}</span></p>
                      </div>
                    </div>
                    {invite.status === 'pending' && (
                      <div className="flex gap-2 px-3 pb-3">
                        <button
                          onClick={async () => {
                            await updateItemInviteStatus(invite.id, 'accepted');
                            setItemInvites(prev => prev.map(i => i.id === invite.id ? { ...i, status: 'accepted' } : i));
                          }}
                          className="flex-1 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl"
                        >Accept</button>
                        <button
                          onClick={async () => {
                            await updateItemInviteStatus(invite.id, 'declined');
                            setItemInvites(prev => prev.filter(i => i.id !== invite.id));
                          }}
                          className="flex-1 py-2 border border-gray-200 text-gray-500 text-xs font-semibold rounded-xl"
                        >Decline</button>
                      </div>
                    )}
                    {invite.status === 'accepted' && (
                      <div className="px-3 pb-3">
                        <p className="text-xs text-green-600 font-semibold">✓ Going</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New plan — always first */}
          <button onClick={() => setShowNewPlan(true)} className="w-full flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <Plus size={20} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">New plan</p>
              <p className="text-xs text-gray-400 mt-0.5">A weekend, a trip, a day out, a single plan — anything</p>
            </div>
          </button>

          {/* Someday */}
          {plans.some(t => t.status === 'dreaming') && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">✨ Want to do / see</p>
              <div className="space-y-3">
                {plans.filter(t => t.status === 'dreaming').map(trip => (
                  trip.description?.startsWith('[event]')
                    ? <EventCard key={trip.id} trip={trip} onClick={() => { setSelectedEvent(trip); setShowEventSheet(true); }} />
                    : <PlanCard key={trip.id} trip={trip} onClick={() => { setSelectedTrip(trip);  }} />
                ))}
              </div>
            </div>
          )}

          {/* Coming up */}
          {plans.some(t => t.status === 'planning' || t.status === 'upcoming') && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">🗓 Coming up</p>
              <div className="space-y-3">
                {plans.filter(t => t.status === 'planning' || t.status === 'upcoming')
                  .sort((a, b) => (parseTripStartDate(a.dates, a.status)?.getTime() ?? 0) - (parseTripStartDate(b.dates, b.status)?.getTime() ?? 0))
                  .map(trip => (
                  trip.description?.startsWith('[event]')
                    ? <EventCard key={trip.id} trip={trip} onClick={() => { setSelectedEvent(trip); setShowEventSheet(true); }} />
                    : <PlanCard key={trip.id} trip={trip} onClick={() => { setSelectedTrip(trip);  }} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {plans.some(t => t.status === 'past') && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">✅ Past</p>
              <div className="space-y-2.5">
                {plans.filter(t => t.status === 'past')
                  .sort((a, b) => (parseTripStartDate(b.dates, b.status)?.getTime() ?? 0) - (parseTripStartDate(a.dates, a.status)?.getTime() ?? 0))
                  .map(trip => (
                  <button key={trip.id} onClick={() => { setSelectedTrip(trip);  }}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 text-left">
                    <img src={trip.coverImage} alt={trip.destination} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 opacity-40" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-700">{trip.destination}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><CalendarDays size={10} strokeWidth={1.5} />{trip.dates}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{countDaysFromDates(trip.dates)} days · {trip.days.reduce((a, d) => a + d.items.length, 0)} places</p>
                    </div>
                    <ChevronRight size={16} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
        )
      )}

      {/* New Collection Sheet */}
      {showNewCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewCollection(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <button onClick={() => setShowNewCollection(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={15} strokeWidth={2} className="text-gray-500" />
            </button>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">New Collection</p>
            {/* Emoji + Name row */}
            <div className="flex gap-3 mb-4">
              <input
                value={newColEmoji}
                onChange={e => setNewColEmoji(e.target.value)}
                placeholder="🗂️"
                className="w-14 h-14 bg-gray-50 rounded-2xl text-2xl text-center outline-none"
                maxLength={2}
              />
              <input
                autoFocus
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                placeholder="Collection name"
                className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 placeholder:font-normal"
              />
            </div>
            {/* Description */}
            <textarea
              value={newColDesc}
              onChange={e => setNewColDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none resize-none placeholder:text-gray-400 mb-5"
            />
            <button
              disabled={!newColName.trim() || newColSaving}
              onClick={async () => {
                if (!newColName.trim() || !userId) return;
                setNewColSaving(true);
                const { data } = await createCollection(userId, {
                  name: newColName.trim(),
                  emoji: newColEmoji || '🗂️',
                  description: newColDesc.trim(),
                });
                if (data) setDbCollections(prev => [data, ...prev]);
                setNewColSaving(false);
                setShowNewCollection(false);
              }}
              className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-bold disabled:opacity-40"
            >
              {newColSaving ? 'Creating…' : 'Create collection'}
            </button>
          </div>
        </div>
      )}

      {/* ── Event Detail Bottom Sheet ── */}
      {showEventSheet && selectedEvent && (() => {
        const ev = selectedEvent;
        const evDesc = ev.description?.replace('[event]', '').replace(/\[cat:[^\]]*\]/g, '').replace(/\[time:[^\]]*\]/g, '').replace(/\[link:[^\]]*\]/g, '').trim() ?? '';
        const evItems = ev.days.flatMap(d => d.items).sort((a, b) => parseTimeToMinutes(a.time ?? '') - parseTimeToMinutes(b.time ?? ''));
        const hasPhoto = ev.coverImage && !ev.coverImage.includes('unsplash.com/photo-1476514525535');
        return (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEventSheet(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
              {/* Photo / emoji header */}
              <div className="relative flex-shrink-0">
                {hasPhoto
                  ? <img src={ev.coverImage} alt={ev.destination} className="w-full object-cover rounded-t-3xl" style={{ height: '48vw', maxHeight: 220, minHeight: 160 }} />
                  : <div className="w-full bg-gray-950 flex items-center justify-center rounded-t-3xl" style={{ height: '36vw', maxHeight: 180, minHeight: 130 }}>
                      <span className="text-6xl">🎟️</span>
                    </div>
                }
                <button onClick={() => setShowEventSheet(false)} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
                  <X size={15} strokeWidth={2.5} className="text-white" />
                </button>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={async () => {
                    if (!confirm('Delete this event?')) return;
                    if (userId) await dbDeletePlan(ev.id);
                    setPlans(prev => prev.filter(p => p.id !== ev.id));
                    setShowEventSheet(false);
                    setSelectedEvent(null);
                  }} className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
                    <X size={15} strokeWidth={2} className="text-red-400" />
                  </button>
                  <button onClick={() => openEditPlan(ev)} className="flex items-center gap-1.5 bg-black/40 text-white text-sm font-semibold px-4 py-2 rounded-full">
                    <Pencil size={12} strokeWidth={2} /> Edit
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10">
                <h2 className="text-2xl font-black text-gray-900 leading-tight mb-1">{ev.destination}</h2>
                {ev.dates && (
                  <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-1">
                    <CalendarDays size={13} strokeWidth={1.5} />{ev.dates}
                  </p>
                )}
                {ev.country && (
                  <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-1">
                    <MapPin size={13} strokeWidth={1.5} />{ev.country}
                  </p>
                )}
                {evDesc && <p className="text-sm text-gray-500 mt-1 mb-3">{evDesc}</p>}

                {evItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm font-bold text-gray-900 mb-1">Nothing added yet</p>
                    <p className="text-xs text-gray-400 mb-5">Add places, tickets or notes</p>
                    <button onClick={() => { setShowEventSheet(false); setSelectedTrip(ev); openAddPlace(null); }} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold">
                      <Plus size={14} strokeWidth={2} /> Add a place / plan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 mt-4">
                    {evItems.map(item => (
                      <button key={item.id} onClick={() => { setDetailItem(item); setDetailItemDayId(ev.days.find(d => d.items.some(i => i.id === item.id))?.id ?? null); setShowItemDetail(true); }} className="w-full bg-gray-50 rounded-2xl p-3 text-left">
                        <div className="flex items-center gap-3">
                          <ItemThumb image={item.image} name={item.name} category={item.category} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{categoryEmoji[item.category] ?? '📍'} {categoryDisplayName[item.category] ?? item.category}{item.neighborhood ? ` · ${item.neighborhood}` : ''}</p>
                            {item.time && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Clock size={9} strokeWidth={1.5} />{item.time}{item.timeEnd ? ` – ${item.timeEnd}` : ''}</p>}
                          </div>
                          {(item.booked || item.status === 'booked') ? <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full flex-shrink-0">Booked</span>
                            : item.status === 'pending' ? <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-1 rounded-full flex-shrink-0">Pending</span> : null}
                        </div>
                      </button>
                    ))}
                    <button onClick={() => { setShowEventSheet(false); setSelectedTrip(ev); openAddPlace(ev.days[0]?.id ?? null); }} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-gray-100 text-xs text-gray-400 font-medium">
                      <Plus size={12} strokeWidth={2} /> Add place / plan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Plan Sheet (for events, rendered at root level) */}
      {showEditPlan && editPlanTrip && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditPlan(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <button onClick={() => setShowEditPlan(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={15} strokeWidth={2} className="text-gray-500" />
            </button>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Edit event</p>
            <input autoFocus value={editPlanName} onChange={e => setEditPlanName(e.target.value)} placeholder="Title" className="w-full text-2xl font-black text-gray-900 outline-none placeholder:text-gray-200 mb-5 bg-transparent" />
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <AlignLeft size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                <input value={editPlanDesc} onChange={e => setEditPlanDesc(e.target.value)} placeholder="Description (optional)" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
              </div>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <MapPin size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                <input value={editPlanLocation} onChange={e => setEditPlanLocation(e.target.value)} placeholder="Location (optional)" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
              </div>
            </div>
            <button onClick={async () => {
              const updated: Trip = { ...editPlanTrip, destination: editPlanName || editPlanTrip.destination, country: editPlanLocation || editPlanTrip.country, description: editPlanDesc };
              if (userId) await dbUpdatePlan(editPlanTrip.id, { title: updated.destination, country: updated.country, dates: editPlanTrip.dates, description: updated.description ?? '', status: editPlanTrip.status, cover_image_url: editPlanTrip.coverImage });
              setPlans(prev => prev.map(p => p.id === editPlanTrip.id ? updated : p));
              setSelectedEvent(updated);
              setShowEditPlan(false);
            }} className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold mb-2">Save changes</button>
            <button onClick={async () => {
              if (!confirm('Delete this event?')) return;
              if (userId) await dbDeletePlan(editPlanTrip.id);
              setPlans(prev => prev.filter(p => p.id !== editPlanTrip.id));
              setShowEditPlan(false); setShowEventSheet(false); setSelectedEvent(null);
            }} className="w-full py-3 text-red-500 text-sm font-semibold">Delete event</button>
          </div>
        </div>
      )}

      {/* New Plan Sheet */}
      {showNewPlan && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewPlan(false)} />
          <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
            {/* Handle + close — fixed at top */}
            <div className="flex-shrink-0 px-5 pt-4 pb-2">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <button onClick={() => setShowNewPlan(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-10">

            {/* Type toggle */}
            <div className="flex bg-gray-100 rounded-full p-0.5 gap-0.5 mb-5 w-fit">
              {(['trip', 'event'] as const).map(t => (
                <button key={t} onClick={() => setNewPlanType(t)}
                  className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-colors ${newPlanType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                  {t === 'trip' ? '🧳 Trip' : '🎟️ Event'}
                </button>
              ))}
            </div>

            {/* Shared title input */}
            <input
              autoFocus
              value={newPlanName}
              onChange={e => {
                const val = e.target.value;
                setNewPlanName(val);
                if (coverImageTimerRef.current) clearTimeout(coverImageTimerRef.current);
                if (val.trim().length > 2) {
                  const query = val.trim();
                  coverImageTimerRef.current = setTimeout(async () => {
                    try {
                      const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
                        body: JSON.stringify({ input: query, languageCode: 'en' }),
                      });
                      const acData = await acRes.json();
                      const placeId = acData?.suggestions?.[0]?.placePrediction?.placeId;
                      if (placeId) {
                        const detRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=photos`, {
                          headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'photos' },
                        });
                        const detData = await detRes.json();
                        const photoName = detData?.photos?.[0]?.name;
                        if (photoName) {
                          setNewPlanCoverImage(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`);
                          return;
                        }
                      }
                    } catch (_) { /* fall through */ }
                    setNewPlanCoverImage(`https://source.unsplash.com/featured/800x500/?${encodeURIComponent(query)}`);
                  }, 600);
                }
              }}
              placeholder="Title"
              className="w-full text-2xl font-black text-gray-900 outline-none placeholder:text-gray-200 mb-5 bg-transparent"
            />

            {newPlanType === 'trip' ? (
              /* ── TRIP form ── */
              <>
                {/* Date range */}
                <div className="mb-2">
                  <button onClick={() => setShowCalendar(v => !v)} className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-left">
                    <CalendarDays size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <span className={`flex-1 text-sm ${dateRange?.from ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                      {dateRange?.from ? formatDateRange(dateRange) : 'Dates?'}
                    </span>
                    {dateRange?.from && (
                      <span onClick={e => { e.stopPropagation(); setDateRange(undefined); setNewPlanDates(''); }} className="text-gray-300"><X size={13} strokeWidth={2} /></span>
                    )}
                  </button>
                  {showCalendar && (
                    <div className="curio-cal mt-1 rounded-xl overflow-hidden bg-gray-50 flex justify-center">
                      <style>{`
                        .curio-cal .rdp-range_start { background: linear-gradient(to right, transparent 50%, #ffedd5 50%); }
                        .curio-cal .rdp-range_end   { background: linear-gradient(to left,  transparent 50%, #ffedd5 50%); }
                        .curio-cal .rdp-range_middle { background: #ffedd5; }
                        .curio-cal .rdp-range_start button { background: #f97316 !important; color: white !important; border-radius: 9999px !important; }
                        .curio-cal .rdp-range_end   button { background: #f97316 !important; color: white !important; border-radius: 9999px !important; }
                        .curio-cal .rdp-range_middle button { background: transparent !important; color: #c2410c !important; border-radius: 0 !important; }
                      `}</style>
                      <DayPicker mode="range" selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to && range.to.getTime() !== range.from.getTime()) { setNewPlanDates(formatDateRange(range)); setShowCalendar(false); }
                          else if (range?.from) setNewPlanDates(formatDateRange(range));
                        }}
                        classNames={{ root: 'p-4 w-full relative', month: 'w-full', month_caption: 'flex items-center mb-3', caption_label: 'text-sm font-bold text-gray-900', nav: 'absolute top-4 right-4 flex gap-2 items-center', button_previous: 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors', button_next: 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors', month_grid: 'w-full border-collapse', weekdays: 'flex mb-1', weekday: 'flex-1 text-center text-xs text-gray-400 font-medium py-1', week: 'flex', day: 'flex-1 flex items-center justify-center p-0.5', day_button: 'w-8 h-8 flex items-center justify-center rounded-full text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer', today: 'font-bold', outside: 'text-gray-200', disabled: 'text-gray-200 cursor-not-allowed' }}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <AlignLeft size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <input value={newPlanDesc} onChange={e => setNewPlanDesc(e.target.value)} placeholder="Description (optional)" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                  </div>
                  <LocationSearch value={newPlanLocation} onChange={setNewPlanLocation} onCoverImage={setNewPlanCoverImage} />
                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <Users size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {newPlanCollabs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {newPlanCollabs.map(c => (
                            <span key={c} className="flex items-center gap-1 bg-white border border-gray-200 text-xs text-gray-600 font-medium px-2 py-1 rounded-full">
                              @{c}<button onClick={() => setNewPlanCollabs(prev => prev.filter(x => x !== c))}><X size={10} strokeWidth={2} className="text-gray-400" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <input value={newPlanCollabInput} onChange={e => setNewPlanCollabInput(e.target.value)}
                        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && newPlanCollabInput.trim()) { e.preventDefault(); const val = newPlanCollabInput.trim().replace(/^@/, ''); if (val && !newPlanCollabs.includes(val)) setNewPlanCollabs(prev => [...prev, val]); setNewPlanCollabInput(''); } }}
                        placeholder="Add collaborators (optional)" className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ── EVENT form — looks like Add Place ── */
              <div className="space-y-4 mb-5">
                {/* Single date */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Date</p>
                  <button onClick={() => setShowEventSingleCal(v => !v)} className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-left">
                    <CalendarDays size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <span className={`flex-1 text-sm ${eventSingleDate ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                      {eventSingleDate ? eventSingleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick a date'}
                    </span>
                    {eventSingleDate && <span onClick={e => { e.stopPropagation(); setEventSingleDate(undefined); }} className="text-gray-300"><X size={13} strokeWidth={2} /></span>}
                  </button>
                  {showEventSingleCal && (
                    <div className="curio-cal mt-1 rounded-xl overflow-hidden bg-gray-50 flex justify-center">
                      <DayPicker mode="single" selected={eventSingleDate}
                        onSelect={(d) => { setEventSingleDate(d ?? undefined); setShowEventSingleCal(false); }}
                        classNames={{ root: 'p-4 w-full relative', month: 'w-full', month_caption: 'flex items-center mb-3', caption_label: 'text-sm font-bold text-gray-900', nav: 'absolute top-4 right-4 flex gap-2 items-center', button_previous: 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors', button_next: 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors', month_grid: 'w-full border-collapse', weekdays: 'flex mb-1', weekday: 'flex-1 text-center text-xs text-gray-400 font-medium py-1', week: 'flex', day: 'flex-1 flex items-center justify-center p-0.5', day_button: 'w-8 h-8 flex items-center justify-center rounded-full text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer', selected: '!bg-gray-900 !text-white !rounded-full', today: 'font-bold', outside: 'text-gray-200', disabled: 'text-gray-200 cursor-not-allowed' }}
                      />
                    </div>
                  )}
                </div>

                {/* Address search */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Address <span className="font-normal text-gray-400">(optional)</span></p>
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                      <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                      <input
                        value={newEventAddress}
                        onChange={async e => {
                          const val = e.target.value;
                          setNewEventAddress(val);
                          if (newEventAddressTimerRef.current) clearTimeout(newEventAddressTimerRef.current);
                          if (val.trim().length > 2) {
                            setNewEventAddressLoading(true);
                            newEventAddressTimerRef.current = setTimeout(async () => {
                              try {
                                const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
                                  body: JSON.stringify({ input: val.trim(), languageCode: 'en' }),
                                });
                                const data = await res.json();
                                setNewEventAddressSuggestions((data.suggestions ?? []).slice(0, 4).map((s: { placePrediction: { placeId: string; text: { text: string } } }) => ({ placeId: s.placePrediction.placeId, label: s.placePrediction.text.text })));
                              } catch { setNewEventAddressSuggestions([]); }
                              setNewEventAddressLoading(false);
                            }, 400);
                          } else {
                            setNewEventAddressSuggestions([]);
                            setNewEventAddressLoading(false);
                          }
                        }}
                        placeholder="Search venue, address..."
                        className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                      />
                    </div>
                    {newEventAddressSuggestions.length > 0 && (
                      <div className="mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                        {newEventAddressSuggestions.map(s => (
                          <button key={s.placeId} onClick={async () => {
                            setNewEventAddress(s.label);
                            setNewEventAddressSuggestions([]);
                            try {
                              const res = await fetch(`https://places.googleapis.com/v1/places/${s.placeId}`, {
                                headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'addressComponents,photos', 'X-Goog-LanguageCode': 'en' },
                              });
                              const data = await res.json();
                              const nbhdText = extractNeighborhood(data.addressComponents ?? [], data.formattedAddress);
                              if (nbhdText) setNewEventNeighborhood(nbhdText);
                              const photoName = data.photos?.[0]?.name;
                              if (photoName) setNewPlanCoverImage(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`);
                            } catch { /* ignore */ }
                          }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Neighborhood */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Neighborhood <span className="font-normal text-gray-400">(optional)</span></p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                    <MapPin size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <input value={newEventNeighborhood} onChange={e => setNewEventNeighborhood(e.target.value)} placeholder="Auto-filled from search" className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
                  </div>
                </div>

                {/* Photo */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Photo <span className="font-normal text-gray-400">(optional)</span></p>
                  {newPlanCoverImage ? (
                    <div className="relative h-28 rounded-xl overflow-hidden">
                      <img src={newPlanCoverImage} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setNewPlanCoverImage('')} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"><X size={11} strokeWidth={2} className="text-white" /></button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-1 text-gray-300">
                      <Plus size={20} strokeWidth={1.5} />
                      <p className="text-xs">Add your own photo</p>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Time <span className="font-normal text-gray-400">(optional)</span></p>
                  <div className="flex gap-2">
                    <TimePicker label="Starts" value={newEventTimeStart} onChange={setNewEventTimeStart} />
                    <TimePicker label="Ends" value={newEventTimeEnd} onChange={setNewEventTimeEnd} />
                  </div>
                </div>

                {/* Type chips */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Type <span className="font-normal text-gray-400">(optional)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'restaurant', label: '🍽 Restaurant' }, { key: 'hotel', label: '🏨 Stay' }, { key: 'cafe', label: '☕ Café' },
                      { key: 'bar', label: '🍸 Bar' }, { key: 'attraction', label: '🏛️ Attraction' }, { key: 'nature', label: '🌿 Nature' },
                      { key: 'shop', label: '🛍 Shop' }, { key: 'experience', label: '🗺️ Experience' }, { key: 'sports', label: '🎾 Sports' },
                      { key: 'flight', label: '✈️ Flight' }, { key: 'transport', label: '🚗 Transport' }, { key: 'event', label: '🎟️ Event' },
                      { key: 'beach', label: '🏖️ Beach' }, { key: 'food', label: '🍕 Food' }, { key: 'wellness', label: '💆 Wellness' },
                    ].map(chip => (
                      <button key={chip.key} onClick={() => setNewEventCategory(prev => prev === chip.key ? '' : chip.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${newEventCategory === chip.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Notes <span className="font-normal text-gray-400">(optional)</span></p>
                  <textarea
                    value={newEventNotes}
                    onChange={e => setNewEventNotes(e.target.value)}
                    placeholder="Any details, reminders, confirmation numbers..."
                    rows={3}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 resize-none"
                  />
                </div>

                {/* Invite link */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Invite link <span className="font-normal text-gray-400">(optional)</span></p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                    <Link size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={newEventInviteLink}
                      onChange={e => setNewEventInviteLink(e.target.value)}
                      placeholder="Paste ticket or event link..."
                      className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Invite people */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Invite people <span className="font-normal text-gray-400">(optional)</span></p>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <Users size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {newEventCollabs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {newEventCollabs.map(c => (
                            <span key={c} className="flex items-center gap-1 bg-white border border-gray-200 text-xs text-gray-600 font-medium px-2 py-1 rounded-full">
                              @{c}
                              <button onClick={() => setNewEventCollabs(prev => prev.filter(x => x !== c))}><X size={10} strokeWidth={2} className="text-gray-400" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        value={newEventCollabInput}
                        onChange={e => setNewEventCollabInput(e.target.value)}
                        onKeyDown={e => {
                          if ((e.key === 'Enter' || e.key === ',') && newEventCollabInput.trim()) {
                            e.preventDefault();
                            const val = newEventCollabInput.trim().replace(/^@/, '');
                            if (val && !newEventCollabs.includes(val)) setNewEventCollabs(prev => [...prev, val]);
                            setNewEventCollabInput('');
                          }
                        }}
                        placeholder="Add @username or email..."
                        className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                if (!newPlanName.trim()) return;
                const defaultCover = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80';
                const coverImage = newPlanCoverImage || defaultCover;

                let dates = '';
                let status: Trip['status'] = 'dreaming';
                if (newPlanType === 'event') {
                  if (eventSingleDate) {
                    dates = eventSingleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    status = eventSingleDate >= new Date(new Date().setHours(0,0,0,0)) ? 'upcoming' : 'past';
                  }
                } else {
                  dates = newPlanDates.trim();
                  status = dateRange?.from ? (dateRange.from >= new Date(new Date().setHours(0,0,0,0)) ? 'upcoming' : 'past') : 'dreaming';
                }

                const descWithType = newPlanType === 'event'
                  ? `[event]${newEventCategory ? `[cat:${newEventCategory}]` : ''}${newEventTimeStart ? `[time:${newEventTimeStart}${newEventTimeEnd ? `-${newEventTimeEnd}` : ''}]` : ''}${newEventInviteLink ? `[link:${newEventInviteLink}]` : ''}${newEventNotes.trim()}`
                  : newPlanDesc.trim();
                const location = newPlanType === 'event' ? (newEventNeighborhood || newEventAddress) : newPlanLocation.trim();

                let newPlan: Trip;
                if (userId) {
                  const dbPlan = await dbCreatePlan(userId, { title: newPlanName.trim(), country: location, dates, description: descWithType, cover_image_url: coverImage, status });
                  if (!dbPlan) return;
                  newPlan = { id: dbPlan.id, destination: dbPlan.title, country: dbPlan.country, dates: dbPlan.dates, coverImage, status: dbPlan.status, description: dbPlan.description, days: [], collaborators: [] };
                } else {
                  newPlan = { id: `plan-${Date.now()}`, destination: newPlanName.trim(), country: location, dates, coverImage, status, days: [] };
                }
                setPlans(prev => [newPlan, ...prev]);
                setNewPlanName(''); setNewPlanDest(''); setNewPlanDates('');
                setNewPlanDesc(''); setNewPlanLocation(''); setNewPlanCoverImage(''); setNewPlanCollabs([]); setNewPlanCollabInput('');
                setDateRange(undefined); setEventSingleDate(undefined); setNewEventAddress(''); setNewEventNeighborhood(''); setNewEventCategory('');
                setNewEventTimeStart(''); setNewEventTimeEnd(''); setNewEventNotes(''); setNewEventInviteLink(''); setNewEventCollabs([]); setNewEventCollabInput('');
                setShowNewPlan(false);
                if (newPlanType === 'event') {
                  setSelectedEvent(newPlan);
                  setShowEventSheet(true);
                } else {
                  setSelectedTrip(newPlan);
                  
                }
              }}
              disabled={!newPlanName.trim()}
              className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold disabled:opacity-30 transition-opacity"
            >
              Let's go
            </button>
            </div> {/* end scrollable content */}
          </div>
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'Map' && (
        <div className="pt-4 pb-6 px-4">
          <p className="text-sm font-bold text-gray-900 mb-1">Your Saved Map</p>
          <p className="text-xs text-gray-400 mb-3">All the places you want to visit.</p>
          <Suspense fallback={<div className="h-64 bg-gray-100 rounded-xl animate-pulse" />}>
            <MapView places={savedPlaces} height="260px" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
