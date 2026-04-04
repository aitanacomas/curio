import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { Search, Plus, BadgeCheck, Lock, ArrowLeft, CalendarDays, MapPin, ChevronRight, Clock, Plane, Share2, Bookmark, BookmarkCheck, X, AlignLeft, Users, Pencil, UserPlus, Loader2, Link, Map as MapIcon, Send, SlidersHorizontal, Hotel, UtensilsCrossed, Ticket, ChevronDown, ChevronUp, Trash2, ClipboardPaste, Sparkles } from 'lucide-react';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY as string;

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
    <div>
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
        <div className="mt-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.placeId}
              onClick={() => handleSelect(s.placeId, s.text)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center gap-2"
            >
              <MapPin size={11} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
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
import { getPlans, createPlan as dbCreatePlan, updatePlan as dbUpdatePlan, deletePlan as dbDeletePlan, syncPlanCollaborators, getUserCollections, getSubscribedCollections, createCollection, searchProfiles, getFollowerProfiles, getFollowingProfiles, createPlanDay, createPlanItem, updatePlanItem, deletePlanDay, updatePlanDay, deletePlanItem, createItemInvite, getItemInvites, updateItemInviteStatus, leavePlan, addCollaborator, getPlanBookings, createPlanBooking, updatePlanBooking, deletePlanBooking, type Plan as DBPlan, type SavedPlace, type FollowProfile, type ItemInvite, type PlanBooking, type BookingType } from '../lib/supabase';
import { getSavedPlaces, savePlace, unsavePlace, unsubscribeFromCollection, supabase, getPublicUrl, getCollectionPlaces, geocodeMissingPlaces, removePlaceFromCollection, updateCollection, getPostById, getCollectionCollaborators, removeCollaborator, type RealPostPlace, type RealPost, type CollectionCollaborator } from '../lib/supabase';
import BookingSheet from '../components/BookingSheet';
import PlaceSearch from '../components/PlaceSearch';

const MapView = lazy(() => import('../components/MapView'));

type SavedTab = 'Places' | 'Collections' | 'Trips' | 'Map';

interface TripItem {
  id: string;
  name: string;
  category: string;
  image?: string;
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
  lat?: number | null;
  lng?: number | null;
  addedBy?: string | null;
  addedByName?: string | null;
  addedByAvatar?: string | null;
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
  pending?: boolean;
}

interface Trip {
  id: string;
  ownerId?: string;
  ownerName?: string | null;
  ownerAvatar?: string | null;
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
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { id: 'cafe', label: 'Cafe', emoji: '☕' },
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

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', stay: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
  // capitalised fallbacks
  Restaurant: '🍽️', Cafe: '☕', Bar: '🍸', Food: '🍕',
  Hotel: '🏨', Attraction: '🏛️', Nature: '🌿', Beach: '🏖️',
  Shop: '🛍️', Experience: '🗺️', Sports: '🎾', Wellness: '💆',
  Street: '🏙️', Event: '🎟️', Flight: '✈️', Transport: '🚗',
};

const categoryDisplayName: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Cafe', bar: 'Bar', food: 'Food',
  hotel: 'Stay', attraction: 'Attraction', nature: 'Nature', beach: 'Beach',
  shop: 'Shop', experience: 'Experience', sports: 'Sports', wellness: 'Wellness',
  street: 'Street', event: 'Event', flight: 'Flight', transport: 'Transport',
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
        <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
        <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
          <MapPin size={9} strokeWidth={1.5} />
          {[place.neighbourhood, place.city].filter(Boolean).join(', ') || place.country}
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
    // sublocality_level_1 is most specific (e.g. "Soho", "Marylebone", "Polanco")
    const area = find('sublocality_level_1') || find('sublocality_level_2') || find('neighborhood') || find('sublocality');
    // postal_town wins for UK ("London"), locality for everywhere else, admin_area_2 as last resort
    const city = find('postal_town') || find('locality') || find('administrative_area_level_2');
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

function PlanCard({ trip, onClick, userId }: { trip: Trip; onClick: () => void; userId?: string }) {
  const isOwner = !userId || !trip.ownerId || trip.ownerId === userId;
  const isShared = userId && trip.ownerId && trip.ownerId !== userId;
  return (
    <button onClick={onClick} className="w-full relative h-24 rounded-2xl overflow-hidden text-left">
      <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      {/* Owner view: show collaborator avatars + "sharing" */}
      {isOwner && (trip.collaborators ?? []).filter(c => !c.pending).length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full pl-1 pr-2.5 py-1">
          <div className="flex -space-x-1.5">
            {(trip.collaborators ?? []).filter(c => !c.pending).slice(0, 3).map((c, i) => (
              c.avatar
                ? <img key={c.id} src={c.avatar} alt={c.name} className="w-4 h-4 rounded-full object-cover ring-1 ring-black/30" style={{ zIndex: i }} />
                : <div key={c.id} className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-black/30" style={{ zIndex: i }}>{(c.name?.[0] ?? '?').toUpperCase()}</div>
            ))}
          </div>
          <span className="text-[10px] text-white/90 font-semibold">sharing</span>
        </div>
      )}

      {/* Collaborator view: show owner avatar + "shared by" */}
      {isShared && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full pl-1 pr-2.5 py-1">
          {trip.ownerAvatar
            ? <img src={trip.ownerAvatar} alt={trip.ownerName ?? ''} className="w-4 h-4 rounded-full object-cover ring-1 ring-black/30" />
            : <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-black/30">{(trip.ownerName?.[0] ?? '?').toUpperCase()}</div>
          }
          <span className="text-[10px] text-white/90 font-semibold">shared by {trip.ownerName ?? 'someone'}</span>
        </div>
      )}

      <div className="absolute bottom-2.5 left-3 right-3">
        <p className="text-sm font-black text-white">{trip.destination}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {trip.dates ? (
            <p className="text-white/80 text-xs flex items-center gap-1"><CalendarDays size={10} strokeWidth={1.5} />{trip.dates}</p>
          ) : (
            <p className="text-white/50 text-xs flex items-center gap-1"><CalendarDays size={10} strokeWidth={1.5} />Brainstorm</p>
          )}
          {trip.dates
            ? <p className="text-white/60 text-xs">· {countDaysFromDateStr(trip.dates)} days · {trip.days.reduce((a, d) => a + d.items.length, 0)} places</p>
            : trip.days.reduce((a, d) => a + d.items.length, 0) > 0
              ? <p className="text-white/60 text-xs">· {trip.days.reduce((a, d) => a + d.items.length, 0)} ideas</p>
              : null
          }
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
  const [selectedSavedPost, setSelectedSavedPost] = useState<RealPost | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [planViewMode, setPlanViewMode] = useState<'brainstorm' | 'itinerary'>('brainstorm');
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
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [coverCropTarget, setCoverCropTarget] = useState<'edit' | null>(null);
  const [coverCropSaving, setCoverCropSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [deleteDayConfirm, setDeleteDayConfirm] = useState<{ id: string; label: string } | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteSuggestions, setInviteSuggestions] = useState<FollowProfile[]>([]);
  const [inviteFollowList, setInviteFollowList] = useState<FollowProfile[]>([]);
  const [inviteCollabs, setInviteCollabs] = useState<TripCollaborator[]>([]);
  const [inviteOriginalIds, setInviteOriginalIds] = useState<Set<string>>(new Set());
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [addPlaceDayId, setAddPlaceDayId] = useState<string | null>(null);
  const [addPlaceSearch, setAddPlaceSearch] = useState('');
  const [addPlaceSuggestions, setAddPlaceSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [addPlaceSearching, setAddPlaceSearching] = useState(false);
  const [addPlaceFetchingDetails, setAddPlaceFetchingDetails] = useState(false);
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
  const [addPlaceCity, setAddPlaceCity] = useState('');
  const [addPlaceCountry, setAddPlaceCountry] = useState('');
  const [addPlaceLat, setAddPlaceLat] = useState<number | null>(null);
  const [addPlaceLng, setAddPlaceLng] = useState<number | null>(null);
  const addPlaceImageRef = useRef<HTMLInputElement>(null);
  const editItemImageRef = useRef<HTMLInputElement>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<TripItem | null>(null);
  const [detailItemDayId, setDetailItemDayId] = useState<string | null>(null);
  const [showEditItem, setShowEditItem] = useState(false);
  const [editItemUploading, setEditItemUploading] = useState(false);
  const [addPlaceUploading, setAddPlaceUploading] = useState(false);
  const [addPlaceSource, setAddPlaceSource] = useState<'google' | 'saved' | 'booking'>('google');
  const [addPlaceSavedSearch, setAddPlaceSavedSearch] = useState('');
  const [addPlaceSavedCountry, setAddPlaceSavedCountry] = useState('');
  const [addPlaceSavedCategory, setAddPlaceSavedCategory] = useState('');
  // Bookings
  const [planBookings, setPlanBookings] = useState<PlanBooking[]>([]);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType>('flight');
  const [bookingImportMode, setBookingImportMode] = useState(false);
  const [bookingEmailText, setBookingEmailText] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState<Partial<PlanBooking>>({});
  const [showReturnFlight, setShowReturnFlight] = useState(false);
  const [returnFlightForm, setReturnFlightForm] = useState<{ flightNumber: string; departureTime: string; arrivalTime: string }>({ flightNumber: '', departureTime: '', arrivalTime: '' });
  const [bookingsExpanded, setBookingsExpanded] = useState(true);
  // AI itinerary generation
  const [showGenerateSheet, setShowGenerateSheet] = useState(false);
  const [generateSelectedIds, setGenerateSelectedIds] = useState<Set<string>>(new Set());
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState('');
  // Track which plans have had AI itineraries generated this session
  const [aiGeneratedPlanIds, setAiGeneratedPlanIds] = useState<Set<string>>(new Set());
  // AI Ask for ideas
  const [showAskAISheet, setShowAskAISheet] = useState(false);
  const [askAIPrompt, setAskAIPrompt] = useState('');
  const [askAILoading, setAskAILoading] = useState(false);
  const [askAISuggestions, setAskAISuggestions] = useState<{ name: string; category: string; neighborhood: string; reason: string }[]>([]);
  const [askAIError, setAskAIError] = useState('');
  const [addedAISuggestions, setAddedAISuggestions] = useState<Set<number>>(new Set());
  const [addingAISuggestion, setAddingAISuggestion] = useState<number | null>(null);
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
  const [dbSubscribedCollections, setDbSubscribedCollections] = useState<import('../lib/supabase').RealCollection[]>([]);
  const [selectedRealCollection, setSelectedRealCollection] = useState<import('../lib/supabase').RealCollection | null>(null);
  const [realCollectionPlaces, setRealCollectionPlaces] = useState<RealPostPlace[]>([]);
  const [loadingRealCollectionPlaces, setLoadingRealCollectionPlaces] = useState(false);
  const [realColFilter, setRealColFilter] = useState('all');
  const [showRealColMap, setShowRealColMap] = useState(true);
  const [showEditColSheet, setShowEditColSheet] = useState(false);
  const [editColName, setEditColName] = useState('');
  const [editColDesc, setEditColDesc] = useState('');
  const [editColSaving, setEditColSaving] = useState(false);
  const [showColInviteSheet, setShowColInviteSheet] = useState(false);
  const [colInviteSearch, setColInviteSearch] = useState('');
  const [colInviteResults, setColInviteResults] = useState<import('../lib/supabase').FollowProfile[]>([]);
  const [colInviteSending, setColInviteSending] = useState<string | null>(null);
  const [colInviteSent, setColInviteSent] = useState<string[]>([]);
  const [colInvitedPeople, setColInvitedPeople] = useState<import('../lib/supabase').FollowProfile[]>([]);
  const [colCollaborators, setColCollaborators] = useState<CollectionCollaborator[]>([]);
  const [realColCollaborators, setRealColCollaborators] = useState<CollectionCollaborator[]>([]);
  const [itemInvites, setItemInvites] = useState<ItemInvite[]>([]);
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanLocation, setNewPlanLocation] = useState('');
  const [newPlanCoverImage, setNewPlanCoverImage] = useState('');
  const [newPlanCollabInput, setNewPlanCollabInput] = useState('');
  const [newPlanCollabs, setNewPlanCollabs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const googleTypesToCategory = (types: string[]): string => {
    const has = (...t: string[]) => types.some(x => t.includes(x));
    if (has('lodging','hotel','motel','resort_hotel','hostel','bed_and_breakfast','extended_stay_hotel','guest_house','inn')) return 'hotel';
    if (has('restaurant','american_restaurant','barbecue_restaurant','brazilian_restaurant','breakfast_restaurant','brunch_restaurant','buffet_restaurant','chinese_restaurant','french_restaurant','greek_restaurant','indian_restaurant','indonesian_restaurant','italian_restaurant','japanese_restaurant','korean_restaurant','lebanese_restaurant','mediterranean_restaurant','mexican_restaurant','middle_eastern_restaurant','pizza_restaurant','ramen_restaurant','seafood_restaurant','spanish_restaurant','steak_house','sushi_restaurant','thai_restaurant','turkish_restaurant','vegan_restaurant','vegetarian_restaurant','vietnamese_restaurant')) return 'restaurant';
    if (has('cafe','coffee_shop','bakery','bagel_shop','tea_house','patisserie','dessert_shop','ice_cream_shop')) return 'cafe';
    if (has('bar','night_club','wine_bar','cocktail_bar','sports_bar','pub','brewery','winery','distillery','karaoke')) return 'bar';
    if (has('food_court','fast_food_restaurant','meal_takeaway','meal_delivery','sandwich_shop','hamburger_restaurant','supermarket','grocery_store','convenience_store','deli','food_delivery')) return 'food';
    if (has('airport','train_station','bus_station','subway_station','transit_station','light_rail_station','ferry_terminal','taxi_stand','car_rental','bus_stop','airport_terminal')) return 'transport';
    if (has('beach','marina','diving_center','water_park')) return 'beach';
    if (has('park','national_park','natural_feature','campground','hiking_area','rv_park','forest','nature_reserve','botanical_garden','wildlife_sanctuary')) return 'nature';
    if (has('stadium','sports_complex','gym','fitness_center','bowling_alley','golf_course','tennis_court','swimming_pool','ski_resort','rock_climbing_gym','cycling_studio','sports_club','athletic_field','race_track')) return 'sports';
    if (has('spa','beauty_salon','hair_salon','hair_care','nail_salon','physiotherapist','massage','yoga_studio','sauna','wellness_center','massage_therapist')) return 'wellness';
    if (has('store','shopping_mall','clothing_store','book_store','department_store','bicycle_store','electronics_store','furniture_store','home_goods_store','jewelry_store','shoe_store','pet_store','florist','gift_shop','market','liquor_store','toy_store','sporting_goods_store','pharmacy')) return 'shop';
    if (has('route','street_address','intersection')) return 'street';
    if (has('event_venue','banquet_hall','convention_center','conference_center','wedding_venue','concert_hall')) return 'event';
    if (has('airline')) return 'flight';
    if (has('museum','art_gallery','tourist_attraction','landmark','historical_landmark','cultural_landmark','monument','amusement_park','zoo','aquarium','movie_theater','performing_arts_theater','library','church','mosque','synagogue','hindu_temple','place_of_worship','embassy','city_hall','university','castle','ruins')) return 'attraction';
    return 'experience';
  };

  // Parse a loose date string like "Mar 11" or "March 11" or "2025-03-11" into a Date
  const parseFlexDate = (str: string): Date | null => {
    if (!str) return null;
    // Handle ISO format YYYY-MM-DD (from type="date" input) — must not append year
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(str + 'T00:00:00');
      return isNaN(d.getTime()) ? null : d;
    }
    // Handle text formats like "Mar 11" by appending current year
    const year = new Date().getFullYear();
    const d1 = new Date(`${str} ${year}`);
    if (!isNaN(d1.getTime())) return d1;
    const d2 = new Date(str);
    if (!isNaN(d2.getTime())) return d2;
    return null;
  };

  const fmtDate = (str: string | undefined): string => {
    if (!str) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return str;
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
        position: day.items.length, added_by: userId || undefined,
      });
      if (dbItem) {
        const newItem: TripItem = {
          id: dbItem.id, name: dbItem.name, category: dbItem.category, image: dbItem.imageUrl,
          address: dbItem.address, neighborhood: dbItem.neighborhood,
          time: dbItem.timeLabel, timeEnd: dbItem.timeEnd, notes: dbItem.notes,
          status: dbItem.status as TripItem['status'], checkIn: dbItem.checkIn, checkOut: dbItem.checkOut,
          booked: dbItem.booked, addedBy: userId || null, addedByName: null, addedByAvatar: null,
        };
        updatedDays = updatedDays.map(d => d.id === day.id ? { ...d, items: [...d.items, newItem] } : d);
      }
    }
    return { ...trip, days: updatedDays };
  };

  const getTripDayLabel = (trip: Trip, dayIndex: number): string => {
    if (trip.dates) {
      const startStr = trip.dates.split('–')[0].trim();
      // Parse year from dates string if present, otherwise use trip year or current year
      const yearMatch = trip.dates.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      // Parse as UTC to avoid timezone offset shifting the date
      const months: Record<string, number> = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
      const parts = startStr.split(' ').filter(Boolean);
      const monthNum = months[parts[0]];
      const dayNum = parseInt(parts[1]);
      if (monthNum !== undefined && !isNaN(dayNum)) {
        const start = new Date(Date.UTC(year, monthNum, dayNum));
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + dayIndex);
        const fmt = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
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
    setAddPlaceCity('');
    setAddPlaceCountry('');
    setAddPlaceMapsNote('');
    setAddPlaceLat(null);
    setAddPlaceLng(null);
    setAddPlaceFetchingDetails(false);
    setAddPlaceSource('google');
    setAddPlaceSavedSearch('');
    setAddPlaceSavedCountry('');
    setAddPlaceSavedCategory('');
    setShowAddPlace(true);
  };

  const handleSelectPlace = async (placeId: string, text: string, timeLabel: string, timeEnd: string, notes: string, categoryOverride: string, locationStr = '', neighborhoodHint = '', knownLat: number | null = null, knownLng: number | null = null) => {
    if (!selectedTrip) return;
    setAddPlaceSaving(true);
    try {
      let name = text;
      let category = categoryOverride || 'experience';
      // Never persist a blob: URL — only use it once upload resolves to a real public URL
      let imageUrl = (addPlaceCustomImage && !addPlaceCustomImage.startsWith('blob:')) ? addPlaceCustomImage : '';
      let address = locationStr;
      let neighborhood = neighborhoodHint;

      // Use pre-fetched coordinates when available (e.g. from PlaceSearch) — avoids a redundant API call
      let lat: number | null = knownLat;
      let lng: number | null = knownLng;

      // If we have a placeId, fetch full details (name, photo, category, address) — skip if we already have coords
      let resolvedPlaceId = placeId;

      // No placeId — do a text search to resolve one and get all details
      if (!resolvedPlaceId && name) {
        try {
          const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
              'X-Goog-FieldMask': 'places.id,places.photos,places.types,places.displayName,places.formattedAddress,places.addressComponents,places.location',
            },
            body: JSON.stringify({ textQuery: address ? `${name} ${address}` : name }),
          });
          const searchData = await searchRes.json();
          const found = searchData.places?.[0];
          if (found) {
            resolvedPlaceId = found.id ?? '';
            if (!categoryOverride && found.types) category = googleTypesToCategory(found.types);
            const photoName = found.photos?.[0]?.name;
            if (!imageUrl && photoName) imageUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_PLACES_KEY}&maxWidthPx=400`;
            if (found.formattedAddress && !address) address = found.formattedAddress;
            const area = extractNeighborhood(found.addressComponents ?? [], found.formattedAddress ?? '');
            if (area && !neighborhood) neighborhood = area;
            if (lat == null && found.location?.latitude != null) { lat = found.location.latitude; lng = found.location.longitude; }
          }
        } catch { /* silent */ }
      }

      if (resolvedPlaceId) {
        try {
          const res = await fetch(`https://places.googleapis.com/v1/places/${resolvedPlaceId}`, {
            headers: {
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
              'X-Goog-FieldMask': 'displayName,types,photos,formattedAddress,addressComponents,location',
              'X-Goog-LanguageCode': 'en',
            },
          });
          const place = await res.json();
          if (place.displayName?.text) name = place.displayName.text;
          if (!categoryOverride && place.types) category = googleTypesToCategory(place.types);
          const photoName = place.photos?.[0]?.name;
          if (!imageUrl && photoName) imageUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_PLACES_KEY}&maxWidthPx=400`;
          if (place.formattedAddress && !address) address = place.formattedAddress;
          const area = extractNeighborhood(place.addressComponents ?? [], place.formattedAddress);
          if (area && !neighborhood) neighborhood = area;
          if (lat == null && place.location?.latitude != null) { lat = place.location.latitude; lng = place.location.longitude; }
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
      console.log('[handleSelectPlace] before save — address:', address, '| imageUrl:', finalImage?.slice(0, 60));
      let newItem: TripItem;
      if (userId && day.id) {
        const dbItem = await createPlanItem(selectedTrip.id, day.id, {
          name, category, image_url: finalImage,
          time_label: timeLabel, time_end: timeEnd || undefined,
          notes, address: address || undefined, neighborhood: neighborhood || undefined,
          status: addPlaceStatus !== 'none' ? addPlaceStatus : undefined,
          check_in: addPlaceCheckIn || undefined,
          check_out: addPlaceCheckOut || undefined,
          position, added_by: userId || undefined,
          lat: lat ?? undefined, lng: lng ?? undefined,
        });
        if (!dbItem) return;
        newItem = { id: dbItem.id, name, category, image: finalImage, address: address || undefined, neighborhood: neighborhood || undefined, time: timeLabel || undefined, timeEnd: timeEnd || undefined, notes: notes || undefined, status: addPlaceStatus, checkIn: addPlaceCheckIn || undefined, checkOut: addPlaceCheckOut || undefined, lat, lng };
      } else {
        newItem = { id: `item-${Date.now()}`, name, category, image: finalImage, address: address || undefined, neighborhood: neighborhood || undefined, time: timeLabel || undefined, timeEnd: timeEnd || undefined, notes: notes || undefined, status: addPlaceStatus, checkIn: addPlaceCheckIn || undefined, checkOut: addPlaceCheckOut || undefined, lat, lng };
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

  // ── Booking email parser (smart) ─────────────────────────────────────────
  const parseBookingEmail = (raw: string, type: BookingType): Partial<PlanBooking> => {
    // Normalise: strip HTML tags, decode entities, collapse whitespace
    const text = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    // ── Helpers ────────────────────────────────────────────────────────────
    const first = (patterns: RegExp[]): string => {
      for (const p of patterns) { const m = text.match(p); if (m?.[1]?.trim()) return m[1].trim(); }
      return '';
    };
    const firstNoGroup = (patterns: RegExp[]): string => {
      for (const p of patterns) { const m = text.match(p); if (m?.[0]?.trim()) return m[0].trim(); }
      return '';
    };

    // ── Confirmation number ────────────────────────────────────────────────
    const confirmationNumber = first([
      /(?:confirmation(?:\s+code)?|booking\s+(?:code|ref|reference)|record\s+locator|PNR|reservation(?:\s+code)?|itinerary|ref(?:erence)?|conf)[:\s#]+([A-Z0-9]{4,15})/i,
      /RECLOC=([A-Z0-9]{4,8})/i,
      /\b([A-Z]{6})\b(?=\s*\n)/,  // 6-char uppercase code on its own line
    ]).toUpperCase();

    // ── Title / name ───────────────────────────────────────────────────────
    // Airlines by IATA code
    const AIRLINE_CODES: Record<string,string> = {
      AA:'American Airlines', DL:'Delta Air Lines', UA:'United Airlines', WN:'Southwest Airlines',
      B6:'JetBlue', AS:'Alaska Airlines', NK:'Spirit Airlines', F9:'Frontier Airlines',
      BA:'British Airways', VS:'Virgin Atlantic', LH:'Lufthansa', AF:'Air France',
      KL:'KLM', IB:'Iberia', AZ:'ITA Airways', EI:'Aer Lingus', FR:'Ryanair', U2:'easyJet',
      EK:'Emirates', QR:'Qatar Airways', EY:'Etihad', SQ:'Singapore Airlines',
      CX:'Cathay Pacific', JL:'Japan Airlines', NH:'ANA', KE:'Korean Air',
      TK:'Turkish Airlines', LA:'LATAM', AM:'Aeromexico', CM:'Copa Airlines',
      AC:'Air Canada', QF:'Qantas', NZ:'Air New Zealand', MX:'Mexicana',
    };
    const AIRPORTS = new Set(['JFK','LAX','LHR','CDG','DXB','SFO','ORD','ATL','SEA','MIA','BOS','DEN','LAS','PHX','MCO','EWR','MSP','DTW','FCO','BCN','AMS','FRA','MAD','MEX','GRU','NRT','HND','ICN','SIN','HKG','SYD','MEL','YYZ','YVR','DFW','IAH','CLT','PHL','SLC','PDX','MSY','BNA','RDU','TPA','SAN','SMF','DOH','AUH','RUH','CAI','IST','VIE','ZRH','BRU','LIS','ATH','PRG','WAW','BUD','CPH','ARN','OSL','HEL','DUB','MAN','EDI','MXP','LIN','MUC','BER','HAM','DUS','CGN','STR','FCO','VCE','NAP','PMO','BLQ','PSA','GOA','GVA','BSL','GRU','EZE','BOG','LIM','SCL','CUN','CZM','PVR','SJO','PTY','SDQ','MBJ','AUA','BGI','NAS','MBJ','HAV','VRA','BDA','ABV','ACC','NBO','JRO','CPT','JNB','CAI','CMN','TUN','ALG','LOS','ADD']);
    const BOOKING_PROVIDERS: Record<string,string> = {
      'booking.com':'Booking.com','airbnb':'Airbnb','vrbo':'VRBO','hotels.com':'Hotels.com',
      'expedia':'Expedia','marriott':'Marriott','hilton':'Hilton','hyatt':'Hyatt',
      'ihg':'IHG','wyndham':'Wyndham','accorhotels':'Accor','melia':'Meliá',
      'opentable':'OpenTable','resy':'Resy','yelp':'Yelp Reservations','sevenrooms':'SevenRooms',
      'tock':'Tock','exploretock':'Tock','dishcovery':'Dishcovery',
      'viator':'Viator','getyourguide':'GetYourGuide','klook':'Klook',
      'eventbrite':'Eventbrite','ticketmaster':'Ticketmaster','stubhub':'StubHub',
    };

    // Detect provider from text
    let detectedProvider = '';
    for (const [key, val] of Object.entries(BOOKING_PROVIDERS)) {
      if (text.toLowerCase().includes(key)) { detectedProvider = val; break; }
    }

    // ── DATE helpers ───────────────────────────────────────────────────────
    const DATE_PATTERNS = [
      /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,.]?\s+\d{1,2}[,.]?\s+\d{4}/gi,
      /\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,.]?\s+\d{4}/gi,
      /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g,
      /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g,
    ];
    const allDates: string[] = [];
    for (const p of DATE_PATTERNS) { const matches = [...text.matchAll(p)]; matches.forEach(m => allDates.push(m[0].trim())); }
    const uniqueDates = [...new Set(allDates)];

    const TIME_PATTERN = /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/g;
    const allTimes = [...text.matchAll(TIME_PATTERN)].map(m => m[1].trim());

    // ── FLIGHT ─────────────────────────────────────────────────────────────
    if (type === 'flight') {
      // Parse all flight blocks: "Flight: Alaska 1489" or "Flight: AS1489"
      const flightBlocks = [...text.matchAll(/Flight:\s*([^\n]+)\nOperated By[^\n]+\n[^\n]+\nDeparts:\s*([^(]+)\(([A-Z]{3})\)[^\n]+at\s+([\d:]+\s*[apm]+)\nArrives:\s*([^(]+)\(([A-Z]{3})\)[^\n]+at\s+([\d:]+\s*[apm]+)/gi)];

      // Fallback: simpler patterns
      const flightNumMatches = [...text.matchAll(/(?:Flight|Flight number)[:\s]+(?:Alaska\s+|[A-Z]{2}\s*)?(\d{3,4})/gi)];
      const airlineNameMatch = text.match(/(?:Alaska Airlines|American Airlines|Delta Air Lines|United Airlines|Southwest|JetBlue|Spirit|Frontier|British Airways|Lufthansa|Air France|KLM|Emirates|Qatar Airways|Etihad|Singapore Airlines)/i);
      const airlineName = airlineNameMatch?.[0] ?? first([/(?:Check in with|Operated by)\s+([A-Za-z ]+(?:Airlines?|Airways?))/i, /(?:airline|carrier)[:\s]+([^\n]{2,40})/i]);

      // Outbound flight
      let flightNumber = '', depAirport = '', arrAirport = '', depTime = '', arrTime = '';
      // Return flight fields reused
      let retFlightNumber = '', retDepTime = '', retArrTime = '';

      if (flightBlocks.length >= 1) {
        const b = flightBlocks[0];
        const fnRaw = b[1].trim(); // e.g. "Alaska 1489"
        flightNumber = fnRaw.replace(/^[A-Za-z ]+\s+/, ''); // keep just number portion
        // Try to get IATA code
        const iataMatch = fnRaw.match(/\b([A-Z]{2})(\d{3,4})\b/);
        if (iataMatch) flightNumber = iataMatch[1] + iataMatch[2];
        else flightNumber = 'AS' + flightNumber.replace(/\D/g, '');
        depAirport = b[3]; arrAirport = b[6];
        depTime = `${b[2].trim()} at ${b[4]}`; arrTime = `${b[5].trim()} at ${b[7]}`;
      } else {
        // Simpler fallback
        const fn = flightNumMatches[0]?.[1] ?? '';
        flightNumber = fn ? `AS${fn}` : '';
        const departsMatch = text.match(/Departs?:\s*([^(]+)\(([A-Z]{3})\)[^\n]+at\s+([\d:]+\s*[apm]+)/i);
        const arrivesMatch = text.match(/Arrives?:\s*([^(]+)\(([A-Z]{3})\)[^\n]+at\s+([\d:]+\s*[apm]+)/i);
        depAirport = departsMatch?.[2] ?? '';
        arrAirport = arrivesMatch?.[2] ?? '';
        depTime = departsMatch ? `${departsMatch[1].trim()} at ${departsMatch[3]}` : '';
        arrTime = arrivesMatch ? `${arrivesMatch[1].trim()} at ${arrivesMatch[3]}` : '';
      }

      // Return flight
      if (flightBlocks.length >= 2) {
        const b2 = flightBlocks[1];
        const fnRaw2 = b2[1].trim();
        const iataMatch2 = fnRaw2.match(/\b([A-Z]{2})(\d{3,4})\b/);
        retFlightNumber = iataMatch2 ? iataMatch2[1] + iataMatch2[2] : `AS${fnRaw2.replace(/\D/g, '')}`;
        retDepTime = `${b2[2].trim()} at ${b2[4]}`;
        retArrTime = `${b2[5].trim()} at ${b2[7]}`;
      } else if (flightNumMatches.length >= 2) {
        retFlightNumber = `AS${flightNumMatches[1][1]}`;
        const allDeparts = [...text.matchAll(/Departs?:\s*([^(]+)\(([A-Z]{3})\)[^\n]+at\s+([\d:]+\s*[apm]+)/gi)];
        const allArrives = [...text.matchAll(/Arrives?:\s*([^(]+)\(([A-Z]{3})\)[^\n]+at\s+([\d:]+\s*[apm]+)/gi)];
        if (allDeparts[1]) retDepTime = `${allDeparts[1][1].trim()} at ${allDeparts[1][3]}`;
        if (allArrives[1]) retArrTime = `${allArrives[1][1].trim()} at ${allArrives[1][3]}`;
      }

      const title = airlineName || detectedProvider || 'Flight';
      return { confirmationNumber, title, flightNumber, airline: airlineName, departureAirport: depAirport, arrivalAirport: arrAirport, departureTime: depTime, arrivalTime: arrTime, checkInDate: retFlightNumber, checkOutDate: retDepTime, address: retArrTime };
    }

    // ── STAY ───────────────────────────────────────────────────────────────
    if (type === 'stay') {
      const hotelName = first([
        /(?:property|hotel|resort|hostel|villa|apartment|accommodation)[:\s]+([^\n]{2,60})/i,
        /(?:you're staying at|your stay at|reserved at)[:\s]+([^\n]{2,60})/i,
        /^(.{3,50})\n.*(?:check[-\s]?in|reservation)/im,
      ]) || detectedProvider;
      const checkIn = first([/(?:check[-\s]?in|arrival|from|start\s+date)[:\s]+([^\n]{3,40})/i]) || uniqueDates[0] || '';
      const checkOut = first([/(?:check[-\s]?out|departure|until|end\s+date|to)[:\s]+([^\n]{3,40})/i]) || uniqueDates[1] || '';
      const address = first([/(?:address|located at|property\s+address|find\s+us\s+at)[:\s]+([^\n]{5,100})/i]);
      return { confirmationNumber, title: hotelName, checkInDate: checkIn, checkOutDate: checkOut, address };
    }

    // ── RESTAURANT ─────────────────────────────────────────────────────────
    if (type === 'restaurant') {
      const restaurantName = first([
        /(?:restaurant|dining|table\s+at|reservation\s+at|you're\s+confirmed\s+at)[:\s]+([^\n]{2,60})/i,
        /^(.{3,50})\n.*(?:reservation|party|guests?)/im,
      ]) || detectedProvider;
      const resDate = first([/(?:date|dining\s+date|reservation\s+date)[:\s]+([^\n]{3,30})/i]) || firstNoGroup(DATE_PATTERNS) || uniqueDates[0] || '';
      const resTime = first([/(?:time|dining\s+time|arrival\s+time)[:\s]+([^\n]{3,20})/i]) || allTimes[0] || '';
      const party = first([/(?:party\s+of|covers?|guests?|pax|people|diners?)[:\s]+(\d+)/i, /(?:table\s+for|for\s+a\s+party\s+of)\s+(\d+)/i]);
      return { confirmationNumber, title: restaurantName, reservationDate: resDate, reservationTime: resTime, partySize: party ? parseInt(party) : null };
    }

    // ── ACTIVITY ───────────────────────────────────────────────────────────
    if (type === 'activity') {
      const activityName = first([
        /(?:activity|tour|experience|ticket|event|museum|attraction|show|concert|performance)[:\s]+([^\n]{2,80})/i,
        /(?:you(?:'re| are)\s+(?:booked|confirmed)\s+for)[:\s]+([^\n]{2,80})/i,
        /^(.{3,60})\n.*(?:ticket|booking|confirmed)/im,
      ]) || detectedProvider;
      const actDate = first([/(?:date|event\s+date|tour\s+date|visit\s+date)[:\s]+([^\n]{3,30})/i]) || firstNoGroup(DATE_PATTERNS) || uniqueDates[0] || '';
      const actTime = first([/(?:time|start\s+time|meeting\s+point\s+time)[:\s]+([^\n]{3,20})/i]) || allTimes[0] || '';
      const pax = first([/(?:guests?|participants?|people|pax|tickets?)[:\s]+(\d+)/i, /(\d+)\s+(?:guests?|participants?|people|tickets?)/i]);
      return { confirmationNumber, title: activityName, reservationDate: actDate, reservationTime: actTime, partySize: pax ? parseInt(pax) : null };
    }

    return { confirmationNumber };
  };

  // ── Flight email regex parser (no AI needed — format is always structured) ──
  const parseFlightsFromEmail = (text: string): Partial<PlanBooking>[] => {
    const AIRLINE_IATA: Record<string, string> = {
      alaska: 'AS', american: 'AA', delta: 'DL', united: 'UA',
      southwest: 'WN', jetblue: 'B6', spirit: 'NK', frontier: 'F9',
      hawaiian: 'HA', 'sun country': 'SY', allegiant: 'G4',
      british: 'BA', lufthansa: 'LH', 'air france': 'AF', klm: 'KL',
      emirates: 'EK', qatar: 'QR', singapore: 'SQ', iberia: 'IB',
      ryanair: 'FR', easyjet: 'U2', 'air canada': 'AC', westjet: 'WS',
      'virgin atlantic': 'VS', 'turkish airlines': 'TK', 'swiss': 'LX',
    };
    const getIATA = (name: string) => {
      const lower = name.toLowerCase();
      for (const [k, v] of Object.entries(AIRLINE_IATA)) {
        if (lower.includes(k)) return v;
      }
      const m = name.match(/\b([A-Z]{2})\b/);
      return m ? m[1] : name.slice(0, 2).toUpperCase();
    };

    // Confirmation code
    const confMatch = text.match(/(?:confirmation\s+(?:code|number)|record\s+locator|PNR|booking\s+(?:ref|code))[:\s#]+([A-Z0-9]{4,10})/i);
    const confirmationNumber = confMatch?.[1]?.toUpperCase() ?? '';

    // Split into individual flight blocks at each "Flight:" line
    const blocks = text.split(/(?=^Flight:)/im).filter(b => /^Flight:/im.test(b));
    if (blocks.length === 0) return [];

    return blocks.map(block => {
      // "Flight: Alaska 1489" → title + IATA flight number
      const flightMatch = block.match(/^Flight:\s*([A-Za-z][A-Za-z\s]+?)\s+(\d{1,4})\b/im);
      let flightNumber = '', title = 'Flight';
      if (flightMatch) {
        const airlineName = flightMatch[1].trim();
        title = airlineName.replace(/\s*(air\s*lines?)\s*/i, ' Airlines').trim();
        flightNumber = getIATA(airlineName) + flightMatch[2];
      }

      // "Departs: San Francisco (SFO) on Wed, Apr 15 at 9:59 am"
      const depMatch = block.match(/Departs?:\s*[^(]+\(([A-Z]{3})\)\s+on\s+\w+,?\s+(\w+\s+\d+)\s+at\s+([\d:]+\s*[apm]+)/i);
      const depAirport = depMatch?.[1] ?? '';
      const departureTime = depMatch ? `${depMatch[2]} at ${depMatch[3]}` : '';

      // "Arrives: Seattle (SEA) on Wed, Apr 15 at 12:16 pm"
      const arrMatch = block.match(/Arrives?:\s*[^(]+\(([A-Z]{3})\)\s+on\s+\w+,?\s+(\w+\s+\d+)\s+at\s+([\d:]+\s*[apm]+)/i);
      const arrAirport = arrMatch?.[1] ?? '';
      const arrivalTime = arrMatch ? `${arrMatch[2]} at ${arrMatch[3]}` : '';

      return { title, confirmationNumber, flightNumber, departureAirport: depAirport, arrivalAirport: arrAirport, departureTime, arrivalTime };
    });
  };

  const handleBookingImport = async () => {
    if (!bookingEmailText.trim()) return;
    setBookingLoading(true);
    try {
      if (bookingType === 'flight') {
        const flights = parseFlightsFromEmail(bookingEmailText);

        if (flights.length >= 2 && selectedTrip && userId) {
          // Round trip — save both as separate cards
          const created = await Promise.all(
            flights.map(f => createPlanBooking(selectedTrip.id, userId, {
              type: 'flight',
              title: f.title ?? 'Flight',
              confirmationNumber: f.confirmationNumber ?? '',
              notes: '',
              flightNumber: f.flightNumber ?? '',
              airline: f.airline ?? '',
              departureAirport: f.departureAirport ?? '',
              arrivalAirport: f.arrivalAirport ?? '',
              departureTime: f.departureTime ?? '',
              arrivalTime: f.arrivalTime ?? '',
              checkInDate: '', checkOutDate: '', address: '',
              reservationDate: '', reservationTime: '', partySize: null,
            }))
          );
          const valid = created.filter(Boolean) as PlanBooking[];
          if (valid.length) {
            setPlanBookings(prev => [...prev, ...valid]);
            setShowAddBooking(false);
            setShowAddPlace(false);
            setAddPlaceSource('google');
            setBookingEmailText('');
            setBookingForm({});
            setShowReturnFlight(false);
            setReturnFlightForm({ flightNumber: '', departureTime: '', arrivalTime: '' });
          }
        } else if (flights.length === 1) {
          // Single flight — fill form for review
          setBookingForm(prev => ({ ...prev, ...flights[0] }));
          setBookingImportMode(false);
        } else {
          // Nothing parsed — fall back to old regex
          const fallback = parseBookingEmail(bookingEmailText, bookingType);
          setBookingForm(prev => ({ ...prev, ...fallback }));
          setBookingImportMode(false);
        }
      } else {
        // Non-flight: use Gemini
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text:
              `Extract booking info from this ${bookingType} confirmation email. Return ONLY a JSON object, no markdown.
Stay: {"title":"Hotel name","confirmationNumber":"CODE","checkInDate":"Apr 15","checkOutDate":"Apr 18","address":"Full address"}
Restaurant: {"title":"Restaurant name","confirmationNumber":"CODE","reservationDate":"Apr 15","reservationTime":"8:00 pm","partySize":2}
Activity: {"title":"Activity name","confirmationNumber":"CODE","reservationDate":"Apr 15","reservationTime":"10:00 am","partySize":1}
Email: ${bookingEmailText.slice(0, 3000)}` }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 400 } }) }
        );
        const d = await res.json();
        const raw = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) { setBookingForm(prev => ({ ...prev, ...JSON.parse(m[0]) })); setBookingImportMode(false); }
        else { setBookingImportMode(false); }
      }
    } catch {
      const parsed = parseBookingEmail(bookingEmailText, bookingType);
      setBookingForm(prev => ({ ...prev, ...parsed }));
      setBookingImportMode(false);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleSaveBooking = async () => {
    if (!selectedTrip || !userId) return;
    setBookingLoading(true);
    const base: Omit<PlanBooking, 'id' | 'planId' | 'addedBy' | 'createdAt'> = {
      type: bookingType,
      title: bookingForm.title ?? '',
      confirmationNumber: bookingForm.confirmationNumber ?? '',
      notes: bookingForm.notes ?? '',
      flightNumber: bookingForm.flightNumber ?? '',
      airline: bookingForm.airline ?? '',
      departureAirport: bookingForm.departureAirport ?? '',
      arrivalAirport: bookingForm.arrivalAirport ?? '',
      departureTime: bookingForm.departureTime ?? '',
      arrivalTime: bookingForm.arrivalTime ?? '',
      checkInDate: bookingForm.checkInDate ?? '',
      checkOutDate: bookingForm.checkOutDate ?? '',
      address: bookingForm.address ?? '',
      reservationDate: bookingForm.reservationDate ?? '',
      reservationTime: bookingForm.reservationTime ?? '',
      partySize: bookingForm.partySize ?? null,
    };
    if (bookingForm.id) {
      // Edit existing
      await updatePlanBooking(bookingForm.id, base);
      setPlanBookings(prev => prev.map(b => b.id === bookingForm.id ? { ...b, ...base } : b));
    } else {
      // Create outbound
      const created = await createPlanBooking(selectedTrip.id, userId, base);
      if (created) setPlanBookings(prev => [...prev, created]);

      // Create return flight if filled in
      if (bookingType === 'flight' && showReturnFlight && returnFlightForm.flightNumber.trim()) {
        const returnBase: Omit<PlanBooking, 'id' | 'planId' | 'addedBy' | 'createdAt'> = {
          ...base,
          flightNumber: returnFlightForm.flightNumber,
          departureAirport: bookingForm.arrivalAirport ?? '',
          arrivalAirport: bookingForm.departureAirport ?? '',
          departureTime: returnFlightForm.departureTime,
          arrivalTime: returnFlightForm.arrivalTime,
        };
        const returnCreated = await createPlanBooking(selectedTrip.id, userId, returnBase);
        if (returnCreated) setPlanBookings(prev => [...prev, returnCreated]);
      }
    }
    setBookingLoading(false);
    setShowAddBooking(false);
    setBookingForm({});
    setBookingEmailText('');
    setBookingImportMode(false);
    setShowReturnFlight(false);
    setReturnFlightForm({ flightNumber: '', departureTime: '', arrivalTime: '' });
  };

  const handleDeleteBooking = async (id: string) => {
    await deletePlanBooking(id);
    setPlanBookings(prev => prev.filter(b => b.id !== id));
  };

  // ── AI Itinerary Generator ────────────────────────────────────────────────
  const handleGenerateItinerary = async () => {
    if (!selectedTrip || !userId) return;
    setGenerateLoading(true);
    setGenerateError('');

    const placesToUse = realSavedPlaces.filter(p => generateSelectedIds.has(p.id));
    const numDays = countDaysFromDates(selectedTrip.dates) || 3;

    const prompt = `You are a travel itinerary planner. Create a day-by-day itinerary for a trip to ${selectedTrip.destination || selectedTrip.country} (${selectedTrip.dates || `${numDays} days`}).

The user has saved these places they want to visit:
${placesToUse.map((p, i) => `${i + 1}. ${p.name} — ${p.category} — ${[p.neighborhood, p.city].filter(Boolean).join(', ')}`).join('\n')}

Rules:
- Distribute places across ${numDays} day(s) as evenly as possible
- Group places that are in the same neighborhood/area on the same day to minimise travel
- For restaurants/cafes: suggest morning ones earlier, dinner ones later in the day
- Assign a realistic timeLabel (e.g. "9:00 AM", "1:00 PM", "7:30 PM") to each place
- Add a short, useful one-line note for each place (what to order, what to see, tip)
- If there are more places than fit comfortably, prioritise variety across categories

Return ONLY valid JSON, no markdown, no explanation:
{
  "days": [
    {
      "label": "Day 1",
      "places": [
        { "name": "Place Name", "timeLabel": "10:00 AM", "notes": "Short tip here" }
      ]
    }
  ]
}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2000 },
          }),
        }
      );

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]) as { days: { label: string; places: { name: string; timeLabel: string; notes: string }[] }[] };

      // Build a lookup from name → saved place
      const placeByName: Record<string, typeof realSavedPlaces[0]> = {};
      for (const p of placesToUse) placeByName[p.name.toLowerCase()] = p;

      // Create plan days + items, build local Trip update in parallel
      const newDays: TripDay[] = [];
      for (let di = 0; di < parsed.days.length; di++) {
        const dayData = parsed.days[di];
        const newDay = await createPlanDay(selectedTrip.id, dayData.label, di);
        if (!newDay) continue;
        const items: TripItem[] = [];
        for (let pi = 0; pi < dayData.places.length; pi++) {
          const p = dayData.places[pi];
          const saved = placeByName[p.name.toLowerCase()];
          const dbItem = await createPlanItem(selectedTrip.id, newDay.id, {
            name: p.name,
            category: saved?.category ?? 'experience',
            image_url: saved?.photoUrl ?? '',
            time_label: p.timeLabel,
            time_end: '',
            notes: p.notes,
            address: '',
            neighborhood: saved?.neighborhood ?? '',
            location: saved?.city ?? '',
            status: 'none',
            check_in: '',
            check_out: '',
            position: pi,
          });
          if (dbItem) items.push(dbItem);
        }
        newDays.push({ id: newDay.id, label: dayData.label, items });
      }

      const updatedTrip: Trip = { ...selectedTrip, days: newDays };
      setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updatedTrip : p));
      setSelectedTrip(updatedTrip);
      setAiGeneratedPlanIds(prev => new Set([...prev, selectedTrip.id]));
      setPlanViewMode('itinerary');
      setShowGenerateSheet(false);
    } catch (e: any) {
      setGenerateError(e.message ?? 'Something went wrong. Try again.');
    } finally {
      setGenerateLoading(false);
    }
  };

  // ── Ask AI for ideas ─────────────────────────────────────────────────────
  const handleAskAIIdeas = async () => {
    if (!selectedTrip || !askAIPrompt.trim()) return;
    setAskAILoading(true);
    setAskAIError('');
    setAskAISuggestions([]);
    const numDays = countDaysFromDates(selectedTrip.dates) || 3;
    const prompt = `You are a travel expert. Suggest 8 specific, real places to visit in ${selectedTrip.destination || selectedTrip.country} for someone who: ${askAIPrompt}

Trip context: ${numDays} days in ${selectedTrip.destination || selectedTrip.country}${selectedTrip.dates ? ` (${selectedTrip.dates})` : ''}

Return ONLY valid JSON, no markdown, no explanation:
{
  "suggestions": [
    {
      "name": "Exact Real Place Name",
      "category": "restaurant|cafe|bar|landmark|experience|nature|shop|art",
      "neighborhood": "Neighborhood or area name",
      "reason": "One sentence explaining why this fits"
    }
  ]
}`;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1500 } }) }
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]) as { suggestions: { name: string; category: string; neighborhood: string; reason: string }[] };
      setAskAISuggestions(parsed.suggestions ?? []);
    } catch (e: any) {
      setAskAIError(e.message ?? 'Something went wrong. Try again.');
    } finally {
      setAskAILoading(false);
    }
  };

  const openAskAI = () => {
    setAskAIPrompt('');
    setAskAISuggestions([]);
    setAddedAISuggestions(new Set());
    setAskAIError('');
    setShowAskAISheet(true);
  };

  const handleAddAISuggestion = async (suggestion: { name: string; category: string; neighborhood: string; reason: string }, index: number) => {
    if (!selectedTrip || !userId) return;
    setAddingAISuggestion(index);
    let updatedDays = [...selectedTrip.days];
    let targetDayId: string | null = null;
    if (updatedDays.length === 0) {
      const label = getTripDayLabel(selectedTrip, 0);
      const newDay = await createPlanDay(selectedTrip.id, label, 0);
      if (newDay) { updatedDays = [{ id: newDay.id, label, items: [] }]; targetDayId = newDay.id; }
    } else {
      targetDayId = updatedDays[0].id ?? null;
    }
    const day = updatedDays[0];
    if (day?.id) {
      const dbItem = await createPlanItem(selectedTrip.id, day.id, {
        name: suggestion.name, category: suggestion.category, image_url: '',
        time_label: '', notes: suggestion.reason, neighborhood: suggestion.neighborhood,
        position: day.items.length, added_by: userId,
      });
      if (dbItem) {
        const newItem: TripItem = { id: dbItem.id, name: suggestion.name, category: suggestion.category, image: '', neighborhood: suggestion.neighborhood, notes: suggestion.reason, status: 'none' };
        updatedDays[0] = { ...day, items: [...day.items, newItem] };
        const updated: Trip = { ...selectedTrip, days: updatedDays };
        setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
        setSelectedTrip(updated);
        setAddedAISuggestions(prev => new Set([...prev, index]));
      }
    }
    setAddingAISuggestion(null);
  };

  const BOOKING_META: Record<BookingType, { icon: React.ReactNode; label: string; color: string }> = {
    flight:     { icon: <Plane size={14} strokeWidth={2} />,            label: 'Flight',      color: 'bg-gray-100 text-gray-600' },
    stay:       { icon: <Hotel size={14} strokeWidth={2} />,            label: 'Stay',        color: 'bg-gray-100 text-gray-600' },
    restaurant: { icon: <UtensilsCrossed size={14} strokeWidth={2} />,  label: 'Restaurant',  color: 'bg-gray-100 text-gray-600' },
    activity:   { icon: <Ticket size={14} strokeWidth={2} />,           label: 'Activity',    color: 'bg-gray-100 text-gray-600' },
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
            addedBy: i.addedBy ?? null,
            addedByName: i.addedByName ?? null,
            addedByAvatar: i.addedByAvatar ?? null,
          })),
        })),
        ownerId: p.userId,
        ownerName: p.ownerName ?? null,
        ownerAvatar: p.ownerAvatar ?? null,
        collaborators: p.collaborators.map(c => ({ id: c.id, name: c.name, avatar: c.avatar, pending: c.pending })),
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
    getSubscribedCollections(userId).then(setDbSubscribedCollections);
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
  // Reset view mode when opening a different plan
  useEffect(() => {
    if (!selectedTrip) return;
    // Always start in brainstorm — itinerary is reached via AI generate
    setPlanViewMode('brainstorm');
    setShowMap(false);
    setMapCoords({}); // clear cached coords so geocoding re-runs for the new trip
  }, [selectedTrip?.id]);

  // Fetch bookings when plan changes
  useEffect(() => {
    if (!selectedTrip) { setPlanBookings([]); return; }
    getPlanBookings(selectedTrip.id).then(setPlanBookings);
  }, [selectedTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showMap || !selectedTrip || !GOOGLE_PLACES_KEY) return;
    const allItems = selectedTrip.days.flatMap(d => d.items);

    // Seed mapCoords with any stored lat/lng (items added after the migration)
    const storedCoords: Record<string, { lat: number; lng: number }> = {};
    for (const item of allItems) {
      if (item.lat != null && item.lng != null) {
        storedCoords[item.id] = { lat: item.lat, lng: item.lng };
      }
    }
    if (Object.keys(storedCoords).length > 0) {
      setMapCoords(prev => ({ ...prev, ...storedCoords }));
    }

    // Only geocode items that have no stored coords and haven't been geocoded yet
    const toGeocode = allItems.filter(item => item.lat == null && !mapCoords[item.id] && !storedCoords[item.id]);
    if (toGeocode.length === 0) { setMapLoading(false); return; }
    let cancelled = false;
    setMapLoading(true);
    (async () => {
      const newCoords: Record<string, { lat: number; lng: number }> = {};
      for (const item of toGeocode) {
        if (cancelled) break;
        try {
          const q = [
            item.name,
            item.address || item.neighborhood || '',
            selectedTrip.destination,
            selectedTrip.country,
          ].filter(Boolean).join(', ');
          // Use server-side proxy to avoid browser Referer/CORS issues
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data.lat && data.lng) newCoords[item.id] = { lat: data.lat, lng: data.lng };
          await new Promise(r => setTimeout(r, 120));
        } catch { /* silent */ }
      }
      if (!cancelled) {
        setMapCoords(prev => ({ ...prev, ...newCoords }));
        setMapLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, selectedTrip?.id, selectedTrip?.days.flatMap(d => d.items).map(i => i.id).join(',')]);

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
    // Count how many days each place name appears across the whole trip
    const itemDayCount = new Map<string, number>();
    selectedTrip.days.forEach(d => d.items.forEach(i => {
      itemDayCount.set(i.name, (itemDayCount.get(i.name) ?? 0) + 1);
    }));
    // "Places" stat = unique place names only
    const totalItems = itemDayCount.size;
    const bookedCount = selectedTrip.days.reduce((acc, d) => acc + d.items.filter(i => i.booked || i.status === 'booked').length, 0);
    const sortedDays = selectedTrip.days.map(d => ({
      ...d,
      items: [...d.items].sort((a, b) => parseTimeToMinutes(a.time ?? '') - parseTimeToMinutes(b.time ?? '')),
    }));
    const allItems = sortedDays.flatMap(d => d.items);
    const allItemsWithDayId = sortedDays.flatMap(d => d.items.map(i => ({ ...i, _dayId: d.id ?? null })));
    const hasDates = !!selectedTrip.dates && selectedTrip.dates.trim().length > 0;
    const isBrainstorm = planViewMode === 'brainstorm';
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
            {/* Date + location + collaborators in one row */}
            <div className="flex items-center justify-between mt-2 gap-3">
              <div className="min-w-0">
                <div className="flex flex-col gap-0.5">
                  {selectedTrip.dates ? (
                    <p className="text-white/70 text-xs flex items-center gap-1">
                      <CalendarDays size={10} strokeWidth={1.5} />{selectedTrip.dates}
                    </p>
                  ) : (
                    <button onClick={() => openEditPlan(selectedTrip)} className="flex items-center gap-1 text-white/50 text-xs">
                      <CalendarDays size={10} strokeWidth={1.5} />Add dates
                    </button>
                  )}
                  {selectedTrip.country && (
                    <p className="text-white/60 text-xs flex items-center gap-1">
                      <MapPin size={10} strokeWidth={1.5} />{selectedTrip.country}
                    </p>
                  )}
                </div>
              </div>
              {/* Collaborator avatars + invite */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex -space-x-1.5">
                  {(() => {
                    const isOwner = !selectedTrip.ownerId || selectedTrip.ownerId === userId;
                    const avatars = [];
                    if (isOwner) {
                      avatars.push(userAvatar
                        ? <img key="you" src={userAvatar} alt="You" className="w-6 h-6 rounded-full object-cover border-2 border-white/40" style={{zIndex:10}} />
                        : <div key="you" className="w-6 h-6 rounded-full bg-gray-900 border-2 border-white/40 flex items-center justify-center" style={{zIndex:10}}><span className="text-white text-[8px] font-bold">Y</span></div>
                      );
                    } else {
                      selectedTrip.ownerAvatar
                        ? avatars.push(<img key="owner" src={selectedTrip.ownerAvatar} alt="Owner" className="w-6 h-6 rounded-full object-cover border-2 border-white/40" style={{zIndex:10}} />)
                        : avatars.push(<div key="owner" className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white/40 flex items-center justify-center" style={{zIndex:10}}><span className="text-white text-[8px] font-bold">{selectedTrip.ownerName?.[0]?.toUpperCase() ?? '?'}</span></div>);
                      avatars.push(userAvatar
                        ? <img key="you" src={userAvatar} alt="You" className="w-6 h-6 rounded-full object-cover border-2 border-white/40" style={{zIndex:9}} />
                        : <div key="you" className="w-6 h-6 rounded-full bg-gray-900 border-2 border-white/40 flex items-center justify-center" style={{zIndex:9}}><span className="text-white text-[8px] font-bold">Y</span></div>
                      );
                    }
                    collabs.filter(c => c.id !== userId).slice(0, 2).forEach((c, i) => {
                      avatars.push(c.avatar
                        ? <img key={c.id} src={c.avatar} alt={c.name} className={`w-6 h-6 rounded-full object-cover border-2 border-white/40 ${c.pending ? 'opacity-50' : ''}`} style={{zIndex: 8-i}} />
                        : <div key={c.id} className={`w-6 h-6 rounded-full bg-gray-400 border-2 border-white/40 flex items-center justify-center ${c.pending ? 'opacity-50' : ''}`} style={{zIndex: 8-i}}><span className="text-white text-[8px] font-bold">{c.name[0]?.toUpperCase()}</span></div>
                      );
                    });
                    return avatars;
                  })()}
                </div>
                <button
                  onClick={async () => {
                    const existing = selectedTrip.collaborators ?? [];
                    setInviteCollabs(existing);
                    setInviteOriginalIds(new Set(existing.map(c => c.id)));
                    setInviteInput('');
                    setShowInvite(true);
                    if (userId) {
                      const [followers, following] = await Promise.all([getFollowerProfiles(userId), getFollowingProfiles(userId)]);
                      const combined = [...followers, ...following].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
                      setInviteFollowList(combined);
                      setInviteSuggestions(combined.filter(f => !(selectedTrip.collaborators ?? []).some(c => c.id === f.id)));
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[11px] font-semibold"
                >
                  <UserPlus size={10} strokeWidth={2} /> Invite
                </button>
                {userId && selectedTrip.ownerId && selectedTrip.ownerId !== userId && (
                  <button
                    onClick={async () => {
                      if (!confirm('Leave this trip?')) return;
                      await leavePlan(selectedTrip.id, userId);
                      setPlans(prev => prev.filter(p => p.id !== selectedTrip.id));
                      setSelectedTrip(null);
                    }}
                    className="px-2.5 py-1 rounded-full bg-red-500/80 text-white text-[11px] font-semibold"
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center divide-x divide-gray-100 border-b border-gray-100">
          <div className="flex-1 py-3 text-center">
            <p className="text-base font-black text-gray-900">{planViewMode === 'itinerary' && selectedTrip.days.length > 0 ? (countDaysFromDates(selectedTrip.dates) || sortedDays.length) : allItems.length}</p>
            <p className="text-xs text-gray-400">{planViewMode === 'itinerary' && selectedTrip.days.length > 0 ? 'Days' : 'Ideas'}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-base font-black text-gray-900">{totalItems}</p>
            <p className="text-xs text-gray-400">Places</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-base font-black text-gray-900">{planBookings.length}</p>
            <p className="text-xs text-gray-400">Reserved</p>
          </div>
        </div>




        {/* Place list — TRIP only (events returned early above) */}
        <div className="px-4 pt-4 pb-28">

          {/* Mode indicator — only show when AI itinerary exists */}
          {planViewMode === 'itinerary' && aiGeneratedPlanIds.has(selectedTrip.id) && (
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setPlanViewMode('brainstorm')}
                className="text-xs text-gray-400 font-medium flex items-center gap-1"
              >
                ← Brainstorm
              </button>
              <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">🗓 Your itinerary</p>
              <button
                onClick={() => { setGenerateSelectedIds(new Set(realSavedPlaces.map(p => p.id))); setShowGenerateSheet(true); }}
                className="text-xs text-gray-400 font-medium"
              >
                Regenerate
              </button>
            </div>
          )}

          {/* ── Bookings section — only shown when there are bookings ── */}
          {planBookings.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setBookingsExpanded(e => !e)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-700"
                >
                  {bookingsExpanded ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
                  Reservations <span className="text-gray-400 font-normal">· {planBookings.length}</span>
                </button>
                <button
                  onClick={() => { setShowAddBooking(true); setBookingForm({}); setBookingEmailText(''); setBookingImportMode(false); }}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-3 py-1"
                >
                  <Plus size={11} strokeWidth={2.5} /> Add
                </button>
              </div>

              {bookingsExpanded && (
                <div className="space-y-2">
                  {planBookings.map(b => {
                    const meta = BOOKING_META[b.type];
                    return (
                      <div
                        key={b.id}
                        className="bg-gray-50 rounded-2xl px-4 py-3 flex items-start gap-3 cursor-pointer"
                        onClick={() => {
                          setBookingType(b.type);
                          setBookingForm(b);
                          setBookingImportMode(false);
                          setBookingEmailText('');
                          setShowAddBooking(true);
                        }}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{b.title || meta.label}</p>
                          {b.type === 'flight' && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {[b.flightNumber, b.departureAirport && b.arrivalAirport ? `${b.departureAirport} → ${b.arrivalAirport}` : '', b.departureTime].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {b.type === 'stay' && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {b.checkInDate && b.checkOutDate ? `${b.checkInDate} – ${b.checkOutDate}` : b.checkInDate}
                              {b.address && ` · ${b.address}`}
                            </p>
                          )}
                          {(b.type === 'restaurant' || b.type === 'activity') && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {[b.reservationDate, b.reservationTime, b.partySize ? `${b.partySize} people` : ''].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {b.confirmationNumber && (
                            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">#{b.confirmationNumber}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                          <ChevronRight size={13} strokeWidth={2} className="text-gray-300" />
                          <button onClick={e => { e.stopPropagation(); handleDeleteBooking(b.id); }} className="text-gray-300 hover:text-red-400">
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* ── /Bookings section ────────────────────────────────── */}


          {isBrainstorm ? (
            /* ══════════════════════════════════════
               BRAINSTORM MODE — flat idea list
               ══════════════════════════════════════ */
            <>
              {/* Itinerary ready banner */}
              {aiGeneratedPlanIds.has(selectedTrip.id) && (
                <button
                  onClick={() => setPlanViewMode('itinerary')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl mb-4 border border-gray-100"
                >
                  <p className="text-xs font-semibold text-gray-700">🗓 Your itinerary is ready</p>
                  <p className="text-xs text-gray-400 font-medium">View →</p>
                </button>
              )}

              {/* Map toggle */}
              {allItems.length > 0 && (
                <div className="flex justify-end mb-3">
                  <button onClick={() => setShowMap(m => !m)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                    <MapPin size={12} strokeWidth={2} />{showMap ? 'Hide map' : 'Show map'}
                  </button>
                </div>
              )}

              {/* Inline map */}
              {showMap && allItems.length > 0 && (
                <div className="rounded-2xl overflow-hidden mb-5" style={{ height: 220 }}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full bg-gray-100 rounded-2xl"><Loader2 size={20} className="animate-spin text-gray-400" /></div>}>
                    {mapLoading && Object.keys(mapCoords).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full bg-gray-100 rounded-2xl gap-2">
                        <Loader2 size={20} className="animate-spin text-gray-400" />
                        <p className="text-xs text-gray-400">Finding places…</p>
                      </div>
                    ) : (
                      <MapView
                        places={allItems.filter(i => mapCoords[i.id]).map(i => ({
                          id: i.id, lat: mapCoords[i.id].lat, lng: mapCoords[i.id].lng,
                          name: i.name, city: selectedTrip.destination, country: selectedTrip.country,
                        }))}
                        height="220px"
                      />
                    )}
                  </Suspense>
                </div>
              )}

              {/* Flat idea list */}
              {allItemsWithDayId.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-4xl mb-3">✨</p>
                  <p className="text-base font-bold text-gray-900 mb-1">Start dreaming</p>
                  <p className="text-xs text-gray-400 mb-6">Add places you want to visit — restaurants, stays, experiences, anything</p>
                  <button onClick={() => openAddPlace(null)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-xs font-semibold mb-2">
                    <Plus size={13} strokeWidth={2} /> Add anything — flights, reservations, places…
                  </button>
                  <button onClick={openAskAI} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gray-50 text-xs text-gray-500 font-medium">
                    ✨ Need help? Ask AI what to do on your trip
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {allItemsWithDayId.map(item => {
                    const isBooked = item.status === 'booked' || item.booked;
                    const isPending = item.status === 'pending';
                    const isWishlist = !isBooked && !isPending;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 transition-colors ${isBooked ? 'bg-green-50/70 border border-green-100' : isPending ? 'bg-amber-50/70 border border-amber-100' : 'bg-white border-2 border-dashed border-gray-200'}`}
                        onClick={() => { setDetailItem(item); setDetailItemDayId(item._dayId); setShowItemDetail(true); }}
                      >
                        <div className="flex items-start gap-3">
                          <ItemThumb image={item.image} name={item.name} category={item.category} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name.split(',')[0].trim()}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {categoryEmoji[item.category] ?? '📍'} {categoryDisplayName[item.category] ?? item.category}
                              {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                            </p>
                            {item.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">{item.notes}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {isBooked && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✓ Booked</span>}
                            {isPending && <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Pending</span>}
                            {isWishlist && <span className="text-[10px] text-gray-300 font-medium">Wishlist</span>}
                          </div>
                        </div>
                        {(selectedTrip.collaborators?.length ?? 0) > 0 && item.addedBy && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                            {item.addedByAvatar
                              ? <img src={item.addedByAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                              : <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] font-bold text-white">{(item.addedByName ?? '?')[0].toUpperCase()}</div>
                            }
                            <span className="text-[10px] text-gray-400">{item.addedBy === userId ? 'You' : (item.addedByName ?? 'Someone')} added this</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Bottom actions */}
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button onClick={() => openAddPlace(null)} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-gray-100 text-xs text-gray-400 font-medium">
                      <Plus size={12} strokeWidth={2} /> Add anything — flights, reservations, places…
                    </button>
                    <button onClick={openAskAI} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-gray-100 text-xs text-gray-400 font-medium">
                      <Sparkles size={12} strokeWidth={2} /> Need help? Ask AI what to do on your trip
                    </button>
                    {!aiGeneratedPlanIds.has(selectedTrip.id) && (
                      <button
                        onClick={() => { setGenerateSelectedIds(new Set(realSavedPlaces.map(p => p.id))); setShowGenerateSheet(true); }}
                        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gray-900 text-white text-xs font-semibold"
                      >
                        🗓 Generate your {countDaysFromDates(selectedTrip.dates) > 0 ? `${countDaysFromDates(selectedTrip.dates)}-day ` : ''}itinerary
                      </button>
                    )}
                  </div>
                </div>
              )}

            </>
          ) : (
            /* ══════════════════════════════════════
               ITINERARY MODE — day-by-day structure
               ══════════════════════════════════════ */
            <>
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
                          id: i.id, lat: mapCoords[i.id].lat, lng: mapCoords[i.id].lng,
                          name: i.name, city: selectedTrip.destination, country: selectedTrip.country,
                        }))}
                        height="260px"
                      />
                    )}
                  </Suspense>
                </div>
              )}

              {selectedTrip.days.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-4xl mb-3">🗓</p>
                  <p className="text-base font-bold text-gray-900 mb-1">Nothing added yet</p>
                  <p className="text-xs text-gray-400 mb-6">Set up your days or let AI build your itinerary</p>
                  {realSavedPlaces.length > 0 && (
                    <button
                      onClick={() => {
                        setGenerateSelectedIds(new Set(realSavedPlaces.map(p => p.id)));
                        setShowGenerateSheet(true);
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-xs font-semibold mb-2"
                    >
                      ✨ Generate itinerary with AI
                    </button>
                  )}
                  {countDaysFromDates(selectedTrip.dates) > 0 && (
                    <button onClick={handleInitDays} className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-500 rounded-full text-xs font-semibold mb-1.5">
                      <CalendarDays size={13} strokeWidth={2} /> Set up {countDaysFromDates(selectedTrip.dates)} days manually
                    </button>
                  )}
                  <button onClick={() => openAddPlace(null)} className="flex items-center gap-2 px-4 py-2 text-gray-400 rounded-full text-xs font-medium">
                    <Plus size={13} strokeWidth={2} /> Add a place
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
                          <button onClick={() => setDeleteDayConfirm({ id: day.id!, label: day.label })}
                            className="text-gray-300 hover:text-red-400 transition-colors p-1">
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M5.5 5.5v4M7.5 5.5v4M3 3l.7 7.3A1 1 0 003.7 11h5.6a1 1 0 001-.7L11 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {day.items.map(item => {
                          const isBooked = item.status === 'booked' || item.booked;
                          const isPending = item.status === 'pending';
                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl p-3 transition-colors ${isBooked ? 'bg-green-50/70 border border-green-100' : isPending ? 'bg-amber-50/70 border border-amber-100' : 'bg-gray-50'}`}
                              onClick={() => { setDetailItem(item); setDetailItemDayId(day.id ?? null); setShowItemDetail(true); }}
                            >
                              <div className="flex items-start gap-3">
                                <ItemThumb image={item.image} name={item.name} category={item.category} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name.split(',')[0].trim()}</p>
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
                                      {fmtDate(item.checkIn)}{item.checkIn && item.checkOut ? ' → ' : ''}{fmtDate(item.checkOut)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                  {isBooked && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✓ Booked</span>}
                                  {isPending && <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Pending</span>}
                                </div>
                              </div>
                              {(selectedTrip.collaborators?.length ?? 0) > 0 && item.addedBy && (
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                                  {item.addedByAvatar
                                    ? <img src={item.addedByAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                                    : <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] font-bold text-white">{(item.addedByName ?? '?')[0].toUpperCase()}</div>
                                  }
                                  <span className="text-[10px] text-gray-400">
                                    {item.addedBy === userId ? 'You' : (item.addedByName ?? 'Someone')} added this
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
            </>
          )}
        </div>
        </> /* end TRIP view */
        )}

        {/* ── Delete Day Confirmation Sheet ── */}
        {deleteDayConfirm && selectedTrip && (
          <div className="fixed inset-0 z-[250] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteDayConfirm(null)} />
            <div className="relative bg-white rounded-t-3xl pb-8 px-5">
              <div className="flex justify-center pt-3 pb-5">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <svg width="20" height="20" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M5.5 5.5v4M7.5 5.5v4M3 3l.7 7.3A1 1 0 003.7 11h5.6a1 1 0 001-.7L11 3" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Delete {deleteDayConfirm.label}?</p>
                <p className="text-sm text-gray-400">All places added to this day will be permanently removed.</p>
              </div>
              <button
                onClick={async () => {
                  const dayId = deleteDayConfirm.id;
                  const dayLabel = deleteDayConfirm.label;
                  setDeleteDayConfirm(null);
                  if (userId) await deletePlanDay(dayId);
                  const remaining = selectedTrip.days.filter(d => d.id !== dayId);
                  const renumbered = remaining.map((d, idx) => {
                    const newLabel = getTripDayLabel(selectedTrip, idx);
                    return { ...d, label: newLabel };
                  });
                  if (userId) {
                    await Promise.all(renumbered.map((d, idx) =>
                      d.id ? updatePlanDay(d.id, { label: d.label, position: idx }) : Promise.resolve()
                    ));
                  }
                  let newDates = selectedTrip.dates;
                  const dateRx = /([A-Z][a-z]{2}\s+\d{1,2})/;
                  const firstDate = renumbered[0]?.label.match(dateRx)?.[1];
                  const lastDate = renumbered[renumbered.length - 1]?.label.match(dateRx)?.[1];
                  if (firstDate && lastDate) {
                    newDates = firstDate === lastDate ? firstDate : `${firstDate} – ${lastDate}`;
                    if (userId) await dbUpdatePlan(selectedTrip.id, { dates: newDates });
                  }
                  const updated = { ...selectedTrip, days: renumbered, dates: newDates };
                  setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                  setSelectedTrip(updated);
                }}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
              >
                Delete day
              </button>
              <button onClick={() => setDeleteDayConfirm(null)} className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
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
              {createPortal(
                <input id="saved-trip-cover-input" type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setCoverCropFile(file); setCoverCropTarget('edit'); e.currentTarget.value = '';
                }} style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.001, zIndex: -1 }} />,
                document.body
              )}
              <div className="relative h-28 rounded-2xl overflow-hidden mb-4">
                <img src={editPlanCoverImage || editPlanTrip.coverImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  {coverCropSaving ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <label htmlFor="saved-trip-cover-input" className="flex items-center gap-1.5 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer">
                      <Pencil size={11} strokeWidth={2} /> Change cover
                    </label>
                  )}
                </div>
              </div>
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
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">People on this plan</p>
              {inviteCollabs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {inviteCollabs.map(c => {
                    const isExisting = inviteOriginalIds.has(c.id);
                    return (
                      <span key={c.id} className={`flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 ${isExisting ? 'bg-gray-900' : 'bg-gray-100'}`}>
                        {c.avatar
                          ? <img src={c.avatar} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                          : <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${isExisting ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-600'}`}>{c.name[0]?.toUpperCase()}</div>
                        }
                        <span className={`text-xs font-medium ${isExisting ? 'text-white' : 'text-gray-600'}`}>{c.name.split(' ')[0]}</span>
                        <button onClick={() => {
                          setInviteCollabs(prev => prev.filter(x => x.id !== c.id));
                          const restored = inviteFollowList.find(f => f.id === c.id);
                          if (restored) setInviteSuggestions(prev => [...prev, restored].slice(0, 4));
                        }}>
                          <X size={10} strokeWidth={2} className={isExisting ? 'text-gray-400' : 'text-gray-400'} />
                        </button>
                      </span>
                    );
                  })}
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
                    {!inviteInput.trim() && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Suggestions</p>
                    )}
                    {inviteSuggestions.slice(0, inviteInput.trim() ? 6 : 4).map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setInviteCollabs(prev => [...prev, { id: s.id, name: s.name, avatar: s.avatarUrl ?? '' }]);
                          setInviteInput('');
                          setInviteSuggestions(inviteFollowList.filter(f => !inviteCollabs.some(c => c.id === f.id) && f.id !== s.id));
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {s.avatarUrl
                          ? <img src={s.avatarUrl} alt={s.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{s.name[0]?.toUpperCase()}</div>
                        }
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 truncate">@{s.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(() => {
                const currentIds = new Set(inviteCollabs.map(c => c.id));
                const hasNewPeople = inviteCollabs.some(c => !inviteOriginalIds.has(c.id));
                const hasRemovals = [...inviteOriginalIds].some(id => !currentIds.has(id));
                const hasChanges = hasNewPeople || hasRemovals;
                if (!hasChanges) return null;
                const label = hasNewPeople && !hasRemovals ? 'Send invitation' : hasRemovals && !hasNewPeople ? 'Save changes' : 'Save & send invitation';
                return (
                  <button
                    onClick={async () => {
                      const withPending = inviteCollabs.map(c => ({
                        ...c,
                        pending: !inviteOriginalIds.has(c.id),
                      }));
                      const updated: Trip = { ...selectedTrip, collaborators: withPending };
                      if (userId) {
                        await syncPlanCollaborators(selectedTrip.id, inviteCollabs.map(c => c.id), userId);
                      }
                      setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                      setSelectedTrip(updated);
                      setShowInvite(false);
                    }}
                    className="w-full mt-4 py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold"
                  >
                    {label}
                  </button>
                );
              })()}
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

        {/* ── Generate Itinerary Sheet ─────────────────────────────────────── */}
        {showGenerateSheet && selectedTrip && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => !generateLoading && setShowGenerateSheet(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
              {/* Handle + header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100">
                <div className="w-8" />
                <div className="w-10 h-1 rounded-full bg-gray-200 absolute top-3 left-1/2 -translate-x-1/2" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Generate Itinerary</p>
                <button onClick={() => setShowGenerateSheet(false)} disabled={generateLoading} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  <X size={14} strokeWidth={2} className="text-gray-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                {/* Intro */}
                <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4">
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">
                    ✨ AI will build your {countDaysFromDates(selectedTrip.dates) || '?'}-day itinerary
                  </p>
                  <p className="text-xs text-gray-400">Select the saved places you want to include. AI will group them by area and suggest timings.</p>
                </div>

                {/* Select all toggle */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500">{generateSelectedIds.size} of {realSavedPlaces.length} selected</p>
                  <button
                    onClick={() => {
                      if (generateSelectedIds.size === realSavedPlaces.length) {
                        setGenerateSelectedIds(new Set());
                      } else {
                        setGenerateSelectedIds(new Set(realSavedPlaces.map(p => p.id)));
                      }
                    }}
                    className="text-xs font-semibold text-gray-900"
                  >
                    {generateSelectedIds.size === realSavedPlaces.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {/* Place list */}
                <div className="space-y-2 mb-5">
                  {realSavedPlaces.map(place => {
                    const selected = generateSelectedIds.has(place.id);
                    return (
                      <button
                        key={place.id}
                        onClick={() => {
                          setGenerateSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(place.id)) next.delete(place.id); else next.add(place.id);
                            return next;
                          });
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors text-left ${selected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white'}`}
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                          {place.photoUrl
                            ? <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">{categoryEmoji[place.category] ?? '📍'}</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                          <p className="text-xs text-gray-400 truncate">{[place.neighborhood, place.city].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                          {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {generateError && (
                  <p className="text-xs text-red-500 text-center mb-3">{generateError}</p>
                )}

                <button
                  onClick={handleGenerateItinerary}
                  disabled={generateLoading || generateSelectedIds.size === 0}
                  className="w-full py-4 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {generateLoading ? (
                    <>
                      <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                      Building your itinerary…
                    </>
                  ) : (
                    <>✨ Generate {generateSelectedIds.size > 0 ? `with ${generateSelectedIds.size} places` : ''}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Ask AI for Ideas Sheet ───────────────────────────────────────── */}
        {showAskAISheet && selectedTrip && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => !askAILoading && setShowAskAISheet(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
              {/* Handle + header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100">
                <div className="w-8" />
                <div className="w-10 h-1 rounded-full bg-gray-200 absolute top-3 left-1/2 -translate-x-1/2" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ask AI for ideas</p>
                <button onClick={() => setShowAskAISheet(false)} disabled={askAILoading} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  <X size={14} strokeWidth={2} className="text-gray-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                {askAISuggestions.length === 0 ? (
                  <>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4">
                      <p className="text-sm font-semibold text-gray-900 mb-0.5">What's your vibe?</p>
                      <p className="text-xs text-gray-400">Tell AI what you're into and it'll suggest the best places in {selectedTrip.destination}.</p>
                    </div>
                    <textarea
                      value={askAIPrompt}
                      onChange={e => setAskAIPrompt(e.target.value)}
                      placeholder={`e.g. I love street food, hidden gems and local markets. Not too touristy.`}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 resize-none focus:outline-none focus:border-gray-400 mb-4"
                      rows={3}
                    />
                    {askAIError && <p className="text-xs text-red-500 mb-3">{askAIError}</p>}
                    <button
                      onClick={handleAskAIIdeas}
                      disabled={askAILoading || !askAIPrompt.trim()}
                      className="w-full py-4 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {askAILoading ? (
                        <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Finding places…</>
                      ) : (
                        <>✨ Get suggestions</>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-gray-900">Places for you</p>
                      <button onClick={() => { setAskAISuggestions([]); setAddedAISuggestions(new Set()); }} className="text-xs text-gray-400 font-medium">Try again</button>
                    </div>
                    <div className="space-y-2.5 mb-5">
                      {askAISuggestions.map((s, i) => {
                        const added = addedAISuggestions.has(i);
                        const adding = addingAISuggestion === i;
                        return (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors ${added ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'}`}>
                            <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center text-base">
                              {categoryEmoji[s.category] ?? '📍'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 leading-snug">{s.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{s.neighborhood}</p>
                              <p className="text-xs text-gray-400 mt-1 italic leading-snug">{s.reason}</p>
                            </div>
                            <button
                              onClick={() => !added && handleAddAISuggestion(s, i)}
                              disabled={added || adding}
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${added ? 'bg-green-100' : 'bg-gray-900'}`}
                            >
                              {adding ? (
                                <Loader2 size={14} strokeWidth={2} className="animate-spin text-white" />
                              ) : added ? (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              ) : (
                                <Plus size={14} strokeWidth={2} className="text-white" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {addedAISuggestions.size > 0 && (
                      <button
                        onClick={() => setShowAskAISheet(false)}
                        className="w-full py-3.5 bg-gray-900 text-white text-sm font-bold rounded-2xl"
                      >
                        Done — {addedAISuggestions.size} place{addedAISuggestions.size !== 1 ? 's' : ''} added
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Add Booking Sheet ────────────────────────────────────────────── */}
        {showAddBooking && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddBooking(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
              {/* Handle + header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100">
                <div className="w-8 h-8" />
                <div className="w-10 h-1 rounded-full bg-gray-200 absolute top-3 left-1/2 -translate-x-1/2" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{bookingForm.id ? 'Edit Reservation' : 'Add Reservation'}</p>
                <button onClick={() => setShowAddBooking(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  <X size={14} strokeWidth={2} className="text-gray-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
                {/* Type selector — only when adding new */}
                {!bookingForm.id && (<>
                  <div className="grid grid-cols-4 gap-2 mb-5">
                    {(['flight', 'stay', 'restaurant', 'activity'] as BookingType[]).map(t => {
                      const m = BOOKING_META[t];
                      const active = bookingType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => { setBookingType(t); setBookingForm({}); setBookingEmailText(''); setBookingImportMode(false); setShowReturnFlight(false); setReturnFlightForm({ flightNumber: '', departureTime: '', arrivalTime: '' }); }}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500'}`}
                        >
                          <span className={active ? 'text-white' : ''}>{m.icon}</span>
                          <span className="text-[10px] font-semibold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Import from email toggle — only when adding new */}
                  <button
                    onClick={() => setBookingImportMode(m => !m)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 rounded-2xl border border-dashed border-gray-300 text-xs font-semibold text-gray-500"
                  >
                    <ClipboardPaste size={13} strokeWidth={2} />
                    {bookingImportMode ? 'Fill in manually instead' : 'Paste confirmation email'}
                  </button>
                </>)}

                {bookingImportMode ? (
                  <div className="space-y-3">
                    <textarea
                      value={bookingEmailText}
                      onChange={e => setBookingEmailText(e.target.value)}
                      placeholder="Paste your confirmation email text here…"
                      className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none resize-none"
                      rows={7}
                    />
                    <button
                      onClick={handleBookingImport}
                      disabled={!bookingEmailText.trim()}
                      className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40"
                    >
                      Extract details
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Common fields */}
                    <input
                      value={bookingForm.title ?? ''}
                      onChange={e => setBookingForm(p => ({ ...p, title: e.target.value }))}
                      placeholder={bookingType === 'flight' ? 'Airline' : bookingType === 'stay' ? 'Hotel / property name' : bookingType === 'restaurant' ? 'Restaurant name' : 'Activity / venue name'}
                      className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none"
                    />
                    <input
                      value={bookingForm.confirmationNumber ?? ''}
                      onChange={e => setBookingForm(p => ({ ...p, confirmationNumber: e.target.value }))}
                      placeholder="Confirmation code (optional)"
                      className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none font-mono"
                    />

                    {/* Flight-specific */}
                    {bookingType === 'flight' && (<>
                      <input value={bookingForm.flightNumber ?? ''} onChange={e => setBookingForm(p => ({ ...p, flightNumber: e.target.value }))} placeholder="Flight number (e.g. AS123)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bookingForm.departureAirport ?? ''} onChange={e => setBookingForm(p => ({ ...p, departureAirport: e.target.value }))} placeholder="From (SFO)" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        <input value={bookingForm.arrivalAirport ?? ''} onChange={e => setBookingForm(p => ({ ...p, arrivalAirport: e.target.value }))} placeholder="To (SEA)" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bookingForm.departureTime ?? ''} onChange={e => setBookingForm(p => ({ ...p, departureTime: e.target.value }))} placeholder="Date & departure time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        <input value={bookingForm.arrivalTime ?? ''} onChange={e => setBookingForm(p => ({ ...p, arrivalTime: e.target.value }))} placeholder="Arrival time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      </div>
                      {!bookingForm.id && (
                        <button onClick={() => setShowReturnFlight(v => !v)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-gray-200 text-xs font-semibold text-gray-400">
                          {showReturnFlight ? '− Remove return flight' : '+ Add return flight'}
                        </button>
                      )}
                      {showReturnFlight && !bookingForm.id && (<>
                        <p className="text-xs font-semibold text-gray-400 pt-1">Return flight — {bookingForm.arrivalAirport || '?'} → {bookingForm.departureAirport || '?'}</p>
                        <input value={returnFlightForm.flightNumber} onChange={e => setReturnFlightForm(p => ({ ...p, flightNumber: e.target.value }))} placeholder="Flight number (e.g. AS383)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={returnFlightForm.departureTime} onChange={e => setReturnFlightForm(p => ({ ...p, departureTime: e.target.value }))} placeholder="Date & departure time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          <input value={returnFlightForm.arrivalTime} onChange={e => setReturnFlightForm(p => ({ ...p, arrivalTime: e.target.value }))} placeholder="Arrival time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        </div>
                      </>)}
                    </>)}

                    {/* Stay-specific */}
                    {bookingType === 'stay' && (<>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bookingForm.checkInDate ?? ''} onChange={e => setBookingForm(p => ({ ...p, checkInDate: e.target.value }))} placeholder="Check-in date" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        <input value={bookingForm.checkOutDate ?? ''} onChange={e => setBookingForm(p => ({ ...p, checkOutDate: e.target.value }))} placeholder="Check-out date" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      </div>
                      <input value={bookingForm.address ?? ''} onChange={e => setBookingForm(p => ({ ...p, address: e.target.value }))} placeholder="Address (optional)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                    </>)}

                    {/* Restaurant / Activity-specific */}
                    {(bookingType === 'restaurant' || bookingType === 'activity') && (<>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bookingForm.reservationDate ?? ''} onChange={e => setBookingForm(p => ({ ...p, reservationDate: e.target.value }))} placeholder="Date" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        <input value={bookingForm.reservationTime ?? ''} onChange={e => setBookingForm(p => ({ ...p, reservationTime: e.target.value }))} placeholder="Time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      </div>
                      <input value={bookingForm.partySize?.toString() ?? ''} onChange={e => setBookingForm(p => ({ ...p, partySize: e.target.value ? parseInt(e.target.value) : null }))} type="number" placeholder={bookingType === 'restaurant' ? 'Party size' : 'Number of people'} className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                    </>)}

                    <textarea
                      value={bookingForm.notes ?? ''}
                      onChange={e => setBookingForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none resize-none"
                      rows={2}
                    />

                    <button
                      onClick={handleSaveBooking}
                      disabled={bookingLoading || !bookingForm.title?.trim()}
                      className="w-full py-3.5 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40"
                    >
                      {bookingLoading ? 'Saving…' : 'Save reservation'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex-1">Add anything</p>
                <button onClick={() => setShowAddPlace(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={15} strokeWidth={2} className="text-gray-500" />
                </button>
              </div>

              {/* Source toggle */}
              <div className="flex bg-gray-100 rounded-full p-0.5 gap-0.5 mx-5 mb-3 flex-shrink-0">
                <button
                  onClick={() => setAddPlaceSource('google')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors ${addPlaceSource === 'google' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  Search
                </button>
                <button
                  onClick={() => setAddPlaceSource('saved')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors ${addPlaceSource === 'saved' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  Saved
                </button>
                <button
                  onClick={() => { setAddPlaceSource('booking'); setBookingForm({}); setBookingEmailText(''); setBookingImportMode(false); }}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors ${addPlaceSource === 'booking' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  Reservation
                </button>
              </div>

              {/* Saved places picker */}
              {addPlaceSource === 'saved' && (
                <div className="flex flex-col flex-1 overflow-hidden px-5 pb-8">
                  {/* Search bar — matches name, city, country, category */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2.5 mb-3 flex-shrink-0">
                    <Search size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    <input
                      autoFocus
                      value={addPlaceSavedSearch}
                      onChange={e => setAddPlaceSavedSearch(e.target.value)}
                      placeholder="Search by name, city, country or type…"
                      className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                    />
                    {addPlaceSavedSearch && (
                      <button onClick={() => setAddPlaceSavedSearch('')} className="text-gray-400"><X size={12} /></button>
                    )}
                  </div>
                  {(() => {
                    const q = addPlaceSavedSearch.toLowerCase();
                    const filtered = realSavedPlaces.filter(p => {
                      if (!q) return true;
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.city?.toLowerCase().includes(q) ||
                        p.country?.toLowerCase().includes(q) ||
                        p.neighborhood?.toLowerCase().includes(q) ||
                        (categoryDisplayName[p.category] ?? p.category)?.toLowerCase().includes(q)
                      );
                    });
                    if (filtered.length === 0) return (
                      <p className="text-sm text-gray-400 text-center py-10">No saved places found</p>
                    );
                    return (
                      <div className="overflow-y-auto flex-1 space-y-2">
                        {filtered.map(place => (
                          <button
                            key={place.id}
                            onClick={() => {
                              setAddPlaceSelectedName(place.name);
                              setAddPlaceSearch(`${place.name}, ${place.city}`);
                              setAddPlaceAddress(`${place.name}${place.neighborhood ? `, ${place.neighborhood}` : ''}, ${place.city}, ${place.country}`);
                              setAddPlaceCategory(place.category);
                              setAddPlaceCustomImage(place.photoUrl ?? '');
                              setAddPlaceNeighborhood(place.neighborhood ?? '');
                              setAddPlaceLocation(place.city ?? '');
                              setAddPlaceSource('google'); // switch to form view
                            }}
                            className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 text-left"
                          >
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
                              {place.photoUrl
                                ? <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xl">{categoryEmoji[place.category] ?? '📍'}</div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {categoryEmoji[place.category] ?? '📍'} {categoryDisplayName[place.category] ?? place.category}
                                {place.neighborhood ? ` · ${place.neighborhood}` : place.city ? ` · ${place.city}` : ''}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Booking tab — inline booking form inside add sheet */}
              {addPlaceSource === 'booking' && (
                <div className="flex-1 overflow-y-auto px-5 pb-8">
                  {/* Type selector */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {(['flight', 'stay', 'restaurant', 'activity'] as BookingType[]).map(t => {
                      const m = BOOKING_META[t];
                      const active = bookingType === t;
                      return (
                        <button key={t} onClick={() => { setBookingType(t); setBookingForm({}); setBookingEmailText(''); setBookingImportMode(false); setShowReturnFlight(false); setReturnFlightForm({ flightNumber: '', departureTime: '', arrivalTime: '' }); }}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500'}`}>
                          <span>{m.icon}</span>
                          <span className="text-[10px] font-semibold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setBookingImportMode(m => !m)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 rounded-2xl border border-dashed border-gray-300 text-xs font-semibold text-gray-500">
                    <ClipboardPaste size={13} strokeWidth={2} />
                    {bookingImportMode ? 'Fill in manually instead' : 'Paste confirmation email'}
                  </button>
                  {bookingImportMode ? (
                    <div className="space-y-3">
                      <textarea value={bookingEmailText} onChange={e => setBookingEmailText(e.target.value)}
                        placeholder="Paste your confirmation email text here…"
                        className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none resize-none" rows={7} />
                      <button onClick={handleBookingImport} disabled={!bookingEmailText.trim()}
                        className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40">
                        Extract details
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input value={bookingForm.title ?? ''} onChange={e => setBookingForm(p => ({ ...p, title: e.target.value }))}
                        placeholder={bookingType === 'flight' ? 'Airline' : bookingType === 'stay' ? 'Hotel / property name' : bookingType === 'restaurant' ? 'Restaurant name' : 'Activity / venue name'}
                        className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      <input value={bookingForm.confirmationNumber ?? ''} onChange={e => setBookingForm(p => ({ ...p, confirmationNumber: e.target.value }))}
                        placeholder="Confirmation code (optional)"
                        className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none font-mono" />
                      {bookingType === 'flight' && (<>
                        <input value={bookingForm.flightNumber ?? ''} onChange={e => setBookingForm(p => ({ ...p, flightNumber: e.target.value }))} placeholder="Flight number (e.g. AS123)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bookingForm.departureAirport ?? ''} onChange={e => setBookingForm(p => ({ ...p, departureAirport: e.target.value }))} placeholder="From (SFO)" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          <input value={bookingForm.arrivalAirport ?? ''} onChange={e => setBookingForm(p => ({ ...p, arrivalAirport: e.target.value }))} placeholder="To (SEA)" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bookingForm.departureTime ?? ''} onChange={e => setBookingForm(p => ({ ...p, departureTime: e.target.value }))} placeholder="Date & departure time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          <input value={bookingForm.arrivalTime ?? ''} onChange={e => setBookingForm(p => ({ ...p, arrivalTime: e.target.value }))} placeholder="Arrival time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        </div>
                        <button onClick={() => setShowReturnFlight(v => !v)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-gray-200 text-xs font-semibold text-gray-400">
                          {showReturnFlight ? '− Remove return flight' : '+ Add return flight'}
                        </button>
                        {showReturnFlight && (<>
                          <p className="text-xs font-semibold text-gray-400 pt-1">Return flight — {bookingForm.arrivalAirport || '?'} → {bookingForm.departureAirport || '?'}</p>
                          <input value={returnFlightForm.flightNumber} onChange={e => setReturnFlightForm(p => ({ ...p, flightNumber: e.target.value }))} placeholder="Flight number (e.g. AS383)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={returnFlightForm.departureTime} onChange={e => setReturnFlightForm(p => ({ ...p, departureTime: e.target.value }))} placeholder="Date & departure time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                            <input value={returnFlightForm.arrivalTime} onChange={e => setReturnFlightForm(p => ({ ...p, arrivalTime: e.target.value }))} placeholder="Arrival time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          </div>
                        </>)}
                      </>)}
                      {bookingType === 'stay' && (<>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bookingForm.checkInDate ?? ''} onChange={e => setBookingForm(p => ({ ...p, checkInDate: e.target.value }))} placeholder="Check-in" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          <input value={bookingForm.checkOutDate ?? ''} onChange={e => setBookingForm(p => ({ ...p, checkOutDate: e.target.value }))} placeholder="Check-out" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        </div>
                        <input value={bookingForm.address ?? ''} onChange={e => setBookingForm(p => ({ ...p, address: e.target.value }))} placeholder="Address (optional)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      </>)}
                      {(bookingType === 'restaurant' || bookingType === 'activity') && (<>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bookingForm.reservationDate ?? ''} onChange={e => setBookingForm(p => ({ ...p, reservationDate: e.target.value }))} placeholder="Date" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                          <input value={bookingForm.reservationTime ?? ''} onChange={e => setBookingForm(p => ({ ...p, reservationTime: e.target.value }))} placeholder="Time" className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                        </div>
                        <input value={bookingForm.partySize?.toString() ?? ''} onChange={e => setBookingForm(p => ({ ...p, partySize: e.target.value ? parseInt(e.target.value) : null }))}
                          type="number" placeholder={bookingType === 'restaurant' ? 'Party size' : 'Number of people'} className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none" />
                      </>)}
                      <textarea value={bookingForm.notes ?? ''} onChange={e => setBookingForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Notes (optional)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none resize-none" rows={2} />
                      <button onClick={handleSaveBooking} disabled={bookingLoading || !bookingForm.title?.trim()}
                        className="w-full py-3.5 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40">
                        {bookingLoading ? 'Saving…' : 'Save reservation'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* scrollable body */}
              {addPlaceSource === 'google' && (
              <div ref={addPlaceScrollRef} className="flex-1 overflow-y-auto px-5 pb-8">
                {/* Day selector — only show in itinerary mode */}
                {selectedTrip && selectedTrip.days.length > 0 && planViewMode === 'itinerary' && (
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

                {/* Place search — same framework as Add Post */}
                <div className="mb-4">
                  <PlaceSearch
                    placeholder="Search restaurant, stay, activity…"
                    onSelect={result => {
                      if (result.name) { setAddPlaceSelectedName(result.name); setAddPlaceSearch(result.name); }
                      if (result.category) setAddPlaceCategory(result.category);
                      if (result.neighborhood) setAddPlaceNeighborhood(result.neighborhood);
                      if (result.city) setAddPlaceCity(result.city);
                      if (result.country) setAddPlaceCountry(result.country);
                      if (result.address) setAddPlaceAddress(result.address);
                      if (result.placeId) setAddPlaceSelectedId(result.placeId);
                      setAddPlaceLat(result.lat ?? null);
                      setAddPlaceLng(result.lng ?? null);
                    }}
                  />
                </div>

                {/* Name + location — shown after selecting a place, matches Add Post layout */}
                {addPlaceSelectedName && (
                  <div className="mb-4">
                    <input
                      value={addPlaceSelectedName}
                      onChange={e => setAddPlaceSelectedName(e.target.value)}
                      className="font-bold text-gray-900 text-sm w-full outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-gray-500 pb-0.5 mb-2 transition-colors"
                      placeholder="Place name"
                    />
                    <div className="flex items-center" style={{ gap: '4px' }}>
                      <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400 flex items-center" style={{ gap: 0 }}>
                        <input
                          value={addPlaceNeighborhood}
                          onChange={e => setAddPlaceNeighborhood(e.target.value)}
                          className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                          style={{ width: `${Math.max(52, (addPlaceNeighborhood || 'Neighbourhood').length * 7.2)}px`, padding: 0, margin: 0 }}
                          placeholder="Neighbourhood"
                        /><span>,&nbsp;</span><input
                          value={addPlaceCity}
                          onChange={e => setAddPlaceCity(e.target.value)}
                          className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                          style={{ width: `${Math.max(28, (addPlaceCity || 'City').length * 7.2)}px`, padding: 0, margin: 0 }}
                          placeholder="City"
                        /><span>,&nbsp;</span><input
                          value={addPlaceCountry}
                          onChange={e => setAddPlaceCountry(e.target.value)}
                          className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                          style={{ width: `${Math.max(40, (addPlaceCountry || 'Country').length * 7.2)}px`, padding: 0, margin: 0 }}
                          placeholder="Country"
                        />
                      </span>
                    </div>
                  </div>
                )}

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
                    <>
                      {createPortal(
                        <input id="saved-add-place-photo" type="file" accept="image/*" onChange={async e => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const preview = URL.createObjectURL(file);
                          setAddPlaceCustomImage(preview);
                          setAddPlaceUploading(true);
                          if (userId) {
                            const path = `plan-items/${userId}/${Date.now()}.jpg`;
                            const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                            if (!error) setAddPlaceCustomImage(getPublicUrl('avatars', path));
                          }
                          setAddPlaceUploading(false);
                        }} style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.001, zIndex: -1 }} />,
                        document.body
                      )}
                      <label htmlFor="saved-add-place-photo" className="w-full h-24 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-gray-400 cursor-pointer">
                        <Plus size={18} strokeWidth={1.5} />
                        <span className="text-xs">Add your own photo</span>
                      </label>
                    </>
                  )}
                </div>

                {/* Category */}
                <div className="mb-5">
                  <p className={`text-xs mb-1.5 font-medium ${!addPlaceCategory ? 'text-gray-400' : 'text-gray-400'}`}>
                    Type <span className="font-normal">(optional)</span>
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {[
                      { key: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
                      { key: 'cafe', label: 'Cafe', emoji: '☕' },
                      { key: 'bar', label: 'Bar', emoji: '🍸' },
                      { key: 'food', label: 'Food', emoji: '🍕' },
                      { key: 'hotel', label: 'Stay', emoji: '🏨' },
                      { key: 'attraction', label: 'Attraction', emoji: '🏛️' },
                      { key: 'nature', label: 'Nature', emoji: '🌿' },
                      { key: 'beach', label: 'Beach', emoji: '🏖️' },
                      { key: 'shop', label: 'Shop', emoji: '🛍️' },
                      { key: 'experience', label: 'Experience', emoji: '🗺️' },
                      { key: 'sports', label: 'Sports', emoji: '🎾' },
                      { key: 'wellness', label: 'Wellness', emoji: '💆' },
                      { key: 'street', label: 'Street', emoji: '🏙️' },
                      { key: 'event', label: 'Event', emoji: '🎟️' },
                      { key: 'flight', label: 'Flight', emoji: '✈️' },
                      { key: 'transport', label: 'Transport', emoji: '🚗' },
                    ].map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => setAddPlaceCategory(prev => prev === cat.key ? '' : cat.key)}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          addPlaceCategory === cat.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span>{cat.emoji}</span><span>{cat.label}</span>
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
                        <input type="date" value={addPlaceCheckIn} onChange={e => setAddPlaceCheckIn(e.target.value)} className="flex-1 bg-transparent text-sm text-gray-700 outline-none" />
                      </div>
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                        <CalendarDays size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                        <input type="date" value={addPlaceCheckOut} onChange={e => setAddPlaceCheckOut(e.target.value)} className="flex-1 bg-transparent text-sm text-gray-700 outline-none" />
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
                    const addressToSave = addPlaceAddress || addPlaceSearch.trim() || addPlaceLocation;
                    if (name) handleSelectPlace(id, name, addPlaceTime, addPlaceTimeEnd, addPlaceNotes, addPlaceCategory, addressToSave, addPlaceNeighborhood, addPlaceLat, addPlaceLng);
                  }}
                  disabled={!addPlaceSelectedName.trim() || addPlaceSaving || addPlaceUploading}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {addPlaceUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : addPlaceSaving ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : 'Add to plan'}
                </button>
              </div>
              )}
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
                  <p className="text-base text-gray-800">{fmtDate(detailItem.checkIn)}{detailItem.checkIn && detailItem.checkOut ? ' → ' : ''}{fmtDate(detailItem.checkOut)}</p>
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
                                position: day.items.length, added_by: userId || undefined,
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
                    {createPortal(
                      <input id="saved-edit-item-photo" type="file" accept="image/*" onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return;
                        setEditItem(prev => prev ? { ...prev, image: URL.createObjectURL(file) } : prev);
                        setEditItemUploading(true);
                        if (userId) {
                          const path = `plan-items/${userId}/${Date.now()}.jpg`;
                          const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                          if (!error) { const publicUrl = getPublicUrl('avatars', path); setEditItem(prev => prev ? { ...prev, image: publicUrl } : prev); }
                        }
                        setEditItemUploading(false);
                      }} style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.001, zIndex: -1 }} />,
                      document.body
                    )}
                    <label htmlFor="saved-edit-item-photo" className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer">
                      <Pencil size={11} strokeWidth={2} /><span>Change photo</span>
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
                    {[{ key: 'restaurant', label: '🍽 Restaurant' },{ key: 'hotel', label: '🏨 Stay' },{ key: 'cafe', label: '☕ Cafe' },{ key: 'bar', label: '🍸 Bar' },{ key: 'attraction', label: '🏛️ Attraction' },{ key: 'nature', label: '🌿 Nature' },{ key: 'shop', label: '🛍 Shop' },{ key: 'experience', label: '🗺️ Experience' },{ key: 'sports', label: '🎾 Sports' },{ key: 'flight', label: '✈️ Flight' },{ key: 'transport', label: '🚗 Transport' },{ key: 'event', label: '🎟️ Event' },{ key: 'beach', label: '🏖️ Beach' },{ key: 'food', label: '🍕 Food' },{ key: 'wellness', label: '💆 Wellness' }].map(cat => (
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
                        <input type="date" value={editItem.checkIn ?? ''} onChange={e => setEditItem(prev => prev ? { ...prev, checkIn: e.target.value } : prev)}
                          className="flex-1 bg-transparent text-sm text-gray-700 outline-none" />
                      </div>
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                        <CalendarDays size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                        <input type="date" value={editItem.checkOut ?? ''} onChange={e => setEditItem(prev => prev ? { ...prev, checkOut: e.target.value } : prev)}
                          className="flex-1 bg-transparent text-sm text-gray-700 outline-none" />
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

  // ── Real Collection Detail ────────────────────────────────────
  if (selectedRealCollection) {
    const catEmoji = (cat: string) => {
      const m: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', dining: '🍽️', bar: '🍸', cocktail: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙' };
      return m[cat.toLowerCase()] ?? '📍';
    };
    const mapPlaces = realCollectionPlaces
      .filter(pl => pl.lat != null && pl.lng != null)
      .map(pl => ({ id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country }));
    const isOwn = selectedRealCollection.userId === userId;

    const RealPlaceCard = ({ place }: { place: RealPostPlace }) => {
      const isSaved = realSavedPlaceIds.has(place.id);
      return (
        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
          {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
            <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
              <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
              {[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
            </p>
            {place.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji(place.category)} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
            {realColCollaborators.length > 0 && place.addedBy && (
              <div className="flex items-center gap-1 mt-1.5">
                {place.addedByAvatar
                  ? <img src={place.addedByAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-3.5 h-3.5 rounded-full bg-gray-300 flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0">{(place.addedByName ?? '?')[0].toUpperCase()}</div>
                }
                <span className="text-[10px] text-gray-400">
                  {place.addedBy === userId ? 'You' : (place.addedByName ?? 'Someone')} added this
                </span>
              </div>
            )}
          </div>
          {userId && isOwn ? (
            /* Owner: show X to remove from collection */
            <button
              onClick={async () => {
                await removePlaceFromCollection(selectedRealCollection.id, place.id);
                setRealCollectionPlaces(prev => prev.filter(p => p.id !== place.id));
                setSelectedRealCollection(prev => prev ? { ...prev, placesCount: Math.max(0, prev.placesCount - 1) } : prev);
                setDbCollections(prev => prev.map(c => c.id === selectedRealCollection.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 flex-shrink-0"
            >
              <X size={12} strokeWidth={2} className="text-gray-500" />
            </button>
          ) : userId ? (
            /* Non-owner: show bookmark toggle */
            <button
              onClick={async () => {
                if (isSaved) {
                  await unsavePlace(userId, place.id);
                  setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                  setRealSavedPlaces(prev => prev.filter(p => p.id !== place.id));
                } else {
                  await savePlace(userId, place.id);
                  setRealSavedPlaceIds(prev => new Set(prev).add(place.id));
                  setRealSavedPlaces(prev => [...prev, { id: place.id, postId: '', name: place.name, category: place.category ?? '', neighborhood: place.neighborhood ?? '', city: place.city ?? '', country: place.country ?? '', photoUrl: place.photoUrl ?? '', lat: place.lat ?? null, lng: place.lng ?? null }]);
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 flex-shrink-0"
            >
              {isSaved
                ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-gray-900" />
                : <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />
              }
            </button>
          ) : null}
        </div>
      );
    };

    return (
      <>
      <div className="bg-white min-h-screen">
        {/* Hero */}
        <div className="relative h-64">
          {selectedRealCollection.coverImageUrl ? (
            <img src={selectedRealCollection.coverImageUrl} alt={selectedRealCollection.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <span className="text-7xl">{selectedRealCollection.emoji || '🗂️'}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
          <button
            onClick={() => { setSelectedRealCollection(null); setRealCollectionPlaces([]); setRealColFilter('all'); setShowRealColMap(true); setRealColCollaborators([]); }}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute top-4 right-4 flex gap-2">
            {!isOwn && userId && (
              <button
                onClick={async () => {
                  await unsubscribeFromCollection(userId, selectedRealCollection.id);
                  setDbSubscribedCollections(prev => prev.filter(c => c.id !== selectedRealCollection.id));
                  setSelectedRealCollection(null);
                  setRealCollectionPlaces([]);
                }}
                className="h-8 px-3 rounded-full bg-white/90 flex items-center justify-center text-xs font-semibold text-gray-700"
              >
                Unsubscribe
              </button>
            )}
            {isOwn && (
              <button
                onClick={async () => { setColInviteSearch(''); setColInviteResults([]); setColInviteSent([]); setColInvitedPeople([]); setShowColInviteSheet(true); if (selectedRealCollection) { const collabs = await getCollectionCollaborators(selectedRealCollection.id); setColCollaborators(collabs); } }}
                className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
              >
                <UserPlus size={14} strokeWidth={1.5} className="text-gray-700" />
              </button>
            )}
            <button
              onClick={() => {
                const url = `${window.location.origin}/collection/${selectedRealCollection.id}`;
                if (navigator.share) navigator.share({ title: selectedRealCollection.name, url });
                else navigator.clipboard?.writeText(url);
              }}
              className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <Share2 size={15} strokeWidth={1.5} className="text-gray-700" />
            </button>
            {isOwn && (
              <button
                onClick={() => { setEditColName(selectedRealCollection.name); setEditColDesc(selectedRealCollection.description ?? ''); setShowEditColSheet(true); }}
                className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
              >
                <Pencil size={14} strokeWidth={1.5} className="text-gray-700" />
              </button>
            )}
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-black text-white">{selectedRealCollection.name}</h2>
            {selectedRealCollection.description && (
              <p className="text-white/70 text-xs mt-1">{selectedRealCollection.description}</p>
            )}
          </div>
        </div>

        {/* Places */}
        {loadingRealCollectionPlaces ? (
          <div className="px-4 pt-4 space-y-3">
            <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
            {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : realCollectionPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <span className="text-4xl mb-3">📍</span>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No places yet</p>
            <p className="text-slate-400 text-sm max-w-[220px]">{isOwn ? 'Save places from your posts to start building this collection' : 'No places have been added to this collection yet'}</p>
          </div>
        ) : (() => {
          const chipClass = (active: boolean) =>
            `flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`;
          const cats = Array.from(new Set(realCollectionPlaces.map(p => p.category).filter(Boolean)));
          return (
            <>
              {/* Count + show/hide map */}
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{realCollectionPlaces.length} place{realCollectionPlaces.length !== 1 ? 's' : ''} in this collection</p>
                  {isOwn && (
                    <button
                      onClick={() => {/* future: open add places sheet */}}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-gray-500"
                    >
                      <Plus size={10} strokeWidth={3} />
                    </button>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (showRealColMap) { setShowRealColMap(false); return; }
                    setShowRealColMap(true);
                    const missing = realCollectionPlaces.filter(p => p.lat == null || p.lng == null);
                    if (missing.length > 0) {
                      await geocodeMissingPlaces(
                        realCollectionPlaces,
                        GOOGLE_PLACES_KEY,
                        (updated) => {
                          const coordMap: Record<string, { lat: number; lng: number }> = {};
                          updated.forEach(pl => { if (pl.lat != null) coordMap[pl.id] = { lat: pl.lat!, lng: pl.lng! }; });
                          setRealCollectionPlaces(prev => prev.map(pl => coordMap[pl.id] ? { ...pl, ...coordMap[pl.id] } : pl));
                        }
                      );
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${showRealColMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  <MapIcon size={11} strokeWidth={1.5} />
                  {showRealColMap ? 'Hide map' : 'View on map'}
                </button>
              </div>

              {/* Map */}
              {showRealColMap && (
                <div className="px-4 pt-2">
                  {mapPlaces.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden">
                      <Suspense fallback={<div className="h-52 bg-gray-100 animate-pulse" />}>
                        <MapView places={mapPlaces} height="220px" />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-gray-50 h-28 flex flex-col items-center justify-center gap-1">
                      <MapIcon size={18} strokeWidth={1.5} className="text-gray-300" />
                      <p className="text-xs text-gray-400">Map not available for these places</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category filter chips */}
              {cats.length >= 2 && (
                <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
                  <button onClick={() => setRealColFilter('all')} className={chipClass(realColFilter === 'all')}>All</button>
                  {cats.map(cat => (
                    <button key={cat} onClick={() => setRealColFilter(realColFilter === cat ? 'all' : cat)} className={chipClass(realColFilter === cat)}>
                      {catEmoji(cat)} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {/* Places grouped by neighborhood */}
              <div className="px-4 pt-3 pb-10 space-y-3">
                {(() => {
                  const filtered = realColFilter === 'all' ? realCollectionPlaces : realCollectionPlaces.filter(p => p.category === realColFilter);
                  const byArea: Record<string, typeof filtered> = {};
                  filtered.forEach(p => { const k = p.neighborhood || p.city || 'Other'; if (!byArea[k]) byArea[k] = []; byArea[k].push(p); });
                  if (Object.keys(byArea).length === 0) return <p className="text-center text-sm text-gray-400 py-8">No places match this filter</p>;
                  return Object.entries(byArea).map(([area, areaPlaces]) => (
                    <div key={area}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{area}</p>
                      <div className="space-y-3">{areaPlaces.map(place => <RealPlaceCard key={place.id} place={place} />)}</div>
                    </div>
                  ));
                })()}
              </div>
            </>
          );
        })()}
      </div>

      {/* Edit Collection Sheet */}
      {showEditColSheet && selectedRealCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditColSheet(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <button onClick={() => setShowEditColSheet(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={15} strokeWidth={2} className="text-gray-500" />
            </button>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Edit collection</p>
            <input
              value={editColName}
              onChange={e => setEditColName(e.target.value)}
              placeholder="Collection name"
              className="w-full text-xl font-black text-gray-900 outline-none placeholder:text-gray-300 mb-3 bg-transparent border-b border-gray-100 pb-2"
            />
            <textarea
              value={editColDesc}
              onChange={e => setEditColDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full text-sm text-gray-700 outline-none placeholder:text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 resize-none mb-4"
            />
            <button
              disabled={editColSaving || !editColName.trim()}
              onClick={async () => {
                setEditColSaving(true);
                await updateCollection(selectedRealCollection.id, { name: editColName.trim(), description: editColDesc.trim() });
                const updated = { ...selectedRealCollection, name: editColName.trim(), description: editColDesc.trim() };
                setSelectedRealCollection(updated);
                setDbCollections(prev => prev.map(c => c.id === selectedRealCollection.id ? { ...c, name: editColName.trim(), description: editColDesc.trim() } : c));
                setEditColSaving(false);
                setShowEditColSheet(false);
              }}
              className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold disabled:opacity-40"
            >
              {editColSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Invite Collaborators Sheet */}
      {showColInviteSheet && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowColInviteSheet(false); setColInviteSent([]); setColInvitedPeople([]); setColCollaborators([]); }} />
          <div className="relative bg-white rounded-t-3xl max-h-[75vh] flex flex-col">
            {/* Handle + header */}
            <div className="px-5 pt-4 pb-0 flex-shrink-0">
              <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <button onClick={() => setShowColInviteSheet(false)} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} strokeWidth={2} className="text-gray-500" />
              </button>
              <p className="text-base font-bold text-gray-900 mb-4">Invite collaborators</p>
              {/* Search */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3 mb-3">
                <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={colInviteSearch}
                  onChange={async e => {
                    setColInviteSearch(e.target.value);
                    if (e.target.value.trim().length > 0) {
                      const results = await searchProfiles(e.target.value.trim(), userId ?? '');
                      setColInviteResults(results);
                    } else setColInviteResults([]);
                  }}
                  placeholder="Search people..."
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* User list */}
            <div className="overflow-y-auto flex-1 px-3">
              {/* All invited collaborators — shown as Pending until acceptance flow exists */}
              {(colCollaborators.length > 0 || colInvitedPeople.length > 0) && !colInviteSearch && (
                <div className="mb-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Pending</p>
                  {/* DB collaborators */}
                  {colCollaborators.map(c => (
                    <div key={c.id} className="flex items-center gap-3 py-2.5 px-2">
                      {c.profile.avatarUrl
                        ? <img src={c.profile.avatarUrl} alt={c.profile.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{c.profile.name[0]}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{c.profile.name}</p>
                        <p className="text-xs text-amber-500 font-medium">Invite sent</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!selectedRealCollection) return;
                          await removeCollaborator(selectedRealCollection.id, c.userId);
                          setColCollaborators(prev => prev.filter(x => x.id !== c.id));
                        }}
                        className="text-xs font-semibold text-red-500 px-3 py-1.5 rounded-full bg-red-50"
                      >Remove</button>
                    </div>
                  ))}
                  {/* Invited this session (not yet in DB fetch) */}
                  {colInvitedPeople.filter(p => !colCollaborators.some(c => c.userId === p.id)).map(person => (
                    <div key={person.id} className="flex items-center gap-3 py-2.5 px-2">
                      {person.avatarUrl
                        ? <img src={person.avatarUrl} alt={person.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{person.name[0]}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                        <p className="text-xs text-amber-500 font-medium">Invite sent</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Search results */}
              {colInviteResults.map(person => {
                const alreadyAdded = colCollaborators.some(c => c.userId === person.id);
                const isPending = colInviteSent.includes(person.id);
                return (
                  <div key={person.id} className="flex items-center gap-3 py-2.5 px-2">
                    {person.avatarUrl
                      ? <img src={person.avatarUrl} alt={person.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{person.name[0]}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                      {alreadyAdded || isPending
                        ? <p className="text-xs font-medium text-amber-500">Invite sent</p>
                        : <p className="text-xs text-gray-400">@{person.username}</p>
                      }
                    </div>
                    {!alreadyAdded && !isPending && (
                      <button
                        disabled={colInviteSending === person.id}
                        onClick={async () => {
                          if (!userId || !selectedRealCollection) return;
                          setColInviteSending(person.id);
                          await addCollaborator(selectedRealCollection.id, person.id, userId);
                          setColInviteSent(prev => [...prev, person.id]);
                          setColInvitedPeople(prev => [...prev, person]);
                          setColInviteSending(null);
                          setColInviteSearch('');
                          setColInviteResults([]);
                        }}
                        className="text-xs font-bold px-5 py-2 rounded-full flex-shrink-0 bg-gray-900 text-white"
                      >
                        {colInviteSending === person.id ? '…' : 'Invite'}
                      </button>
                    )}
                  </div>
                );
              })}
              {colInviteSearch.length > 0 && colInviteResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No users found on curio</p>
              )}
            </div>

            {/* Divider + external invite */}
            <div className="border-t border-gray-100 px-3 pb-10 flex-shrink-0">
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/collection/${selectedRealCollection?.id}`;
                  const msg = `Join me on curio and collaborate on my collection! ${url}`;
                  if (navigator.share) {
                    try { await navigator.share({ url, title: 'Join my curio collection', text: msg }); } catch {}
                  } else {
                    navigator.clipboard.writeText(msg).catch(() => {});
                  }
                }}
                className="w-full flex items-center gap-3 py-3.5 px-2 rounded-2xl active:bg-gray-50"
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Send size={16} strokeWidth={1.5} className="text-gray-700" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Invite externally</p>
                  <p className="text-xs text-gray-400">They'll need to create a curio account</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
                <div
                  key={place.id}
                  className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                  onClick={async () => {
                    if (!place.postId) return;
                    const post = await getPostById(place.postId);
                    if (post) setSelectedSavedPost(post);
                  }}
                >
                  <img src={place.photoUrl} alt={place.name} className="w-full aspect-square object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2.5 pt-6">
                    <p className="text-white text-xs font-semibold leading-tight truncate">{place.name.split(',')[0].trim()}</p>
                    <p className="text-white/70 text-xs flex items-center gap-0.5 mt-0.5">
                      <MapPin size={9} strokeWidth={1.5} />{place.city}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Post detail overlay when a saved place card is tapped */}
          {selectedSavedPost && (
              <div className="fixed inset-0 z-50 bg-white overflow-y-auto pb-24">
                {/* Frosted glass header */}
                <div className="relative">
                  <div className="w-full bg-gray-100" style={{ aspectRatio: '3/4', position: 'relative' }}>
                    {selectedSavedPost.places.length > 0 && (
                      <img src={selectedSavedPost.places[0].photoUrl} className="w-full h-full object-cover" alt="" />
                    )}
                    {selectedSavedPost.places.length > 1 && (
                      <div className="absolute bottom-3 right-3 bg-black/50 rounded-full px-2 py-0.5 text-white text-xs font-medium">
                        1 / {selectedSavedPost.places.length}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-0 left-0 right-0 px-4 pt-12 pb-8 bg-gradient-to-b from-black/55 via-black/10 to-transparent">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setSelectedSavedPost(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md flex-shrink-0"
                      >
                        <ArrowLeft size={17} strokeWidth={1.5} className="text-white" />
                      </button>
                      <div className="flex items-center gap-2 bg-black/35 backdrop-blur-md rounded-full px-3 py-1.5 w-fit max-w-[65%] overflow-hidden">
                        {selectedSavedPost.profile.avatarUrl
                          ? <img src={selectedSavedPost.profile.avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                          : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><span className="text-xs font-bold text-white">{selectedSavedPost.profile.name[0]?.toUpperCase()}</span></div>
                        }
                        <p className="text-white font-semibold text-sm leading-tight truncate">
                          {selectedSavedPost.collaborators?.length
                            ? `${selectedSavedPost.profile.username || selectedSavedPost.profile.name} & ${selectedSavedPost.collaborators.map(c => c.username || c.name).join(', ')}`
                            : selectedSavedPost.profile.username || selectedSavedPost.profile.name}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Post content */}
                <div className="bg-white px-5 pt-4 pb-5">
                  {selectedSavedPost.hashtags.length > 0 && (() => {
                    const seen = new Set<string>();
                    const unique = selectedSavedPost.hashtags.filter(h => { const k = h.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
                    return <p className="text-xs text-orange-400 mb-4">{unique.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>;
                  })()}
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{selectedSavedPost.places.length} place{selectedSavedPost.places.length !== 1 ? 's' : ''}</p>
                  <div className="space-y-3">
                    {selectedSavedPost.places.map(pl => (
                      <div key={pl.id} className="flex items-center gap-3">
                        <img src={pl.photoUrl} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" alt={pl.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{pl.name.split(',')[0].trim()}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{[pl.neighborhood, pl.city].filter(Boolean).join(', ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                      <p className="text-white text-xs font-semibold leading-tight truncate">{place.name.split(',')[0].trim()}</p>
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
        isNewUser && myCollections.length === 0 && dbCollections.length === 0 && dbSubscribedCollections.length === 0 ? (
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
              {dbCollections.map(col => (
                <div key={col.id} className="cursor-pointer" onClick={() => { setSelectedRealCollection(col); setRealCollectionPlaces([]); setLoadingRealCollectionPlaces(true); setRealColCollaborators([]); getCollectionCollaborators(col.id).then(collabs => setRealColCollaborators(collabs)); getCollectionPlaces(col.id).then(async p => { const geocoded = await geocodeMissingPlaces(p, GOOGLE_PLACES_KEY); const seen = new Set<string>(); setRealCollectionPlaces(geocoded.filter(pl => { const k = pl.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })); setLoadingRealCollectionPlaces(false); }); }}>
                  <div className="rounded-xl overflow-hidden aspect-square relative bg-gray-100">
                    {col.coverImageUrl ? (
                      <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">{col.emoji || '🗂️'}</div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                  <p className="text-xs text-gray-400">{col.placesCount} places</p>
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
          {dbSubscribedCollections.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subscribed</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {dbSubscribedCollections.map(col => (
                <div key={col.id} className="cursor-pointer" onClick={() => { setSelectedRealCollection(col); setRealCollectionPlaces([]); setLoadingRealCollectionPlaces(true); setRealColCollaborators([]); getCollectionCollaborators(col.id).then(collabs => setRealColCollaborators(collabs)); getCollectionPlaces(col.id).then(async p => { const geocoded = await geocodeMissingPlaces(p, GOOGLE_PLACES_KEY); const seen = new Set<string>(); setRealCollectionPlaces(geocoded.filter(pl => { const k = pl.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })); setLoadingRealCollectionPlaces(false); }); }}>
                  <div className="rounded-xl overflow-hidden aspect-square relative bg-gray-100">
                    {col.coverImageUrl ? (
                      <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">{col.emoji || '🗂️'}</div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                  <p className="text-xs text-gray-400">{col.placesCount} places</p>
                </div>
              ))}
            </div>
          </div>
          )}
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
                    : <PlanCard key={trip.id} trip={trip} onClick={() => { setSelectedTrip(trip);  }} userId={userId} />
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
                    : <PlanCard key={trip.id} trip={trip} onClick={() => { setSelectedTrip(trip);  }} userId={userId} />
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
                      {/* Owner: show collaborator avatars */}
                      {userId && trip.ownerId === userId && (trip.collaborators ?? []).filter(c => !c.pending).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex -space-x-1 opacity-50">
                            {(trip.collaborators ?? []).filter(c => !c.pending).slice(0, 3).map((c, i) => (
                              c.avatar
                                ? <img key={c.id} src={c.avatar} alt={c.name} className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white" style={{ zIndex: i }} />
                                : <div key={c.id} className="w-3.5 h-3.5 rounded-full bg-gray-400 flex items-center justify-center text-[6px] font-bold text-white ring-1 ring-white" style={{ zIndex: i }}>{(c.name?.[0] ?? '?').toUpperCase()}</div>
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-400 font-normal">sharing with {(trip.collaborators ?? []).filter(c => !c.pending).length} {(trip.collaborators ?? []).filter(c => !c.pending).length === 1 ? 'person' : 'people'}</span>
                        </div>
                      )}
                      {/* Collaborator: show owner avatar + "shared by" */}
                      {userId && trip.ownerId && trip.ownerId !== userId && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {trip.ownerAvatar
                            ? <img src={trip.ownerAvatar} alt={trip.ownerName ?? ''} className="w-3.5 h-3.5 rounded-full object-cover opacity-50" />
                            : <div className="w-3.5 h-3.5 rounded-full bg-gray-300 flex items-center justify-center text-[6px] font-bold text-white opacity-50">{(trip.ownerName?.[0] ?? '?').toUpperCase()}</div>
                          }
                          <span className="text-[10px] text-gray-400 font-normal">shared by {trip.ownerName ?? 'someone'}</span>
                        </div>
                      )}
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
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.name.split(',')[0].trim()}</p>
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
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-gray-400">
                    <Users size={14} strokeWidth={1.5} className="flex-shrink-0" />
                    <p className="text-sm">Invite people after creating the plan</p>
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
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Address</p>
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
                      { key: 'restaurant', label: '🍽 Restaurant' }, { key: 'hotel', label: '🏨 Stay' }, { key: 'cafe', label: '☕ Cafe' },
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
              disabled={!newPlanName.trim() || (newPlanType === 'event' && !newEventAddress.trim())}
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
