import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import ActionModal from '../components/ActionModal';
import SondrrLogo from '../components/SondrLogo';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { Search, Plus, BadgeCheck, Lock, ArrowLeft, CalendarDays, MapPin, ChevronRight, Clock, Plane, Share2, Bookmark, BookmarkCheck, X, AlignLeft, Users, Pencil, UserPlus, Loader2, Link, Map as MapIcon, Send, SlidersHorizontal, Hotel, UtensilsCrossed, Ticket, ChevronDown, ChevronUp, Trash2, ClipboardPaste, Sparkles, GripVertical, BookmarkPlus, Check, Heart, MessageCircle, Copy, MoreHorizontal, Flag, UserX } from 'lucide-react';
import { gAutocomplete, gPlaceDetails, gTextSearch, gGeocode, TTL } from '../lib/googlePlaces';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY as string;

function LocationSearch({ value, onChange, onCoverImage }: { value: string; onChange: (val: string) => void; onCoverImage?: (url: string) => void }) {
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef(crypto.randomUUID());

  const handleChange = (val: string) => {
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    if (val.trim().length < 3) { setSuggestions([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await gAutocomplete({ input: val, languageCode: 'en', sessionToken: sessionTokenRef.current });
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
    const token = sessionTokenRef.current;
    sessionTokenRef.current = crypto.randomUUID();
    if (onCoverImage) {
      try {
        const data = await gPlaceDetails(placeId, 'photos', token, TTL.PHOTOS);
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

import type { Category, Collection, Place } from '../types';
import { getPlans, createPlan as dbCreatePlan, updatePlan as dbUpdatePlan, deletePlan as dbDeletePlan, syncPlanCollaborators, getUserCollections, getSubscribedCollections, createCollection, searchProfiles, getFollowerProfiles, getFollowingProfiles, createPlanDay, createPlanItem, updatePlanItem, deletePlanDay, updatePlanDay, deletePlanItem, purgeDuplicatePlanItems, createItemInvite, getItemInvites, updateItemInviteStatus, leavePlan, addCollaborator, getPlanBookings, createPlanBooking, updatePlanBooking, deletePlanBooking, type Plan as DBPlan, type SavedPlace, type FollowProfile, type ItemInvite, type PlanBooking, type BookingType } from '../lib/supabase';
import { getBookingUrl, isBookable } from '../lib/placeUtils';
import { getSavedPlaces, savePlace, unsavePlace, unsubscribeFromCollection, supabase, getPublicUrl, getCollectionPlaces, geocodeMissingPlaces, removePlaceFromCollection, updateCollection, deleteCollection, getPostById, getCollectionCollaborators, removeCollaborator, createGuide, getUserGuides, deleteGuide, addPlaceToCollection, getPlaceCollectionIds, getSubscribedGuides, subscribeToGuide, unsubscribeFromGuide, getSubscribedGuideIds, addGuideToCollection, removeGuideFromCollection, getGuideCollectionIds, likePost, unlikePost, getLikedPosts, getPostLikeCounts, getPostComments, addComment, deleteComment, getConversations, getOrCreateConversation, sendMessage, blockUser, unblockUser, getBlockedUsers, getBlockersOfUser, reportContent, deletePost, getCollectionGuides, type PostComment, type RealPostPlace, type RealPost, type CollectionCollaborator, type Guide, type Conversation } from '../lib/supabase';
import { CATEGORY_EMOJI, timeAgo } from '../lib/constants';
import BookingSheet from '../components/BookingSheet';
import PlaceSearch from '../components/PlaceSearch';
import PlacePage from '../components/PlacePage';
import ImageCarousel from '../components/ImageCarousel';
import GuideDetail from '../components/GuideDetail';
import UserProfile from './UserProfile';

const MapView = lazy(() => import('../components/MapView'));

type SavedTab = 'Places' | 'Collections' | 'Guides' | 'Trips';

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

const placeCategories: { id: Category | 'all'; label: string; emoji: string }[] = [
  { id: 'all',           label: 'All',           emoji: '✨' },
  { id: 'restaurant',    label: 'Restaurant',    emoji: '🍽️' },
  { id: 'cafe',          label: 'Cafe',          emoji: '☕' },
  { id: 'treats',        label: 'Treats',        emoji: '🍰' },
  { id: 'bar',           label: 'Bar',           emoji: '🍸' },
  { id: 'nightlife',     label: 'Nightlife',     emoji: '🎵' },
  { id: 'food',          label: 'Food',          emoji: '🍕' },
  { id: 'hotel',         label: 'Stay',          emoji: '🏨' },
  { id: 'landmark',      label: 'Landmark',      emoji: '🏛️' },
  { id: 'art',           label: 'Art',           emoji: '🎨' },
  { id: 'nature',        label: 'Nature',        emoji: '🌿' },
  { id: 'beach',         label: 'Beach',         emoji: '🏖️' },
  { id: 'shop',          label: 'Shop',          emoji: '🛍️' },
  { id: 'experience',    label: 'Experience',    emoji: '🎡' },
  { id: 'neighbourhood', label: 'Neighbourhood', emoji: '🏘️' },
  { id: 'sports',        label: 'Sports',        emoji: '🎾' },
  { id: 'wellness',      label: 'Wellness',      emoji: '💆' },
  { id: 'event',         label: 'Event',         emoji: '🎟️' },
  { id: 'flight',        label: 'Flight',        emoji: '✈️' },
  { id: 'transport',     label: 'Transport',     emoji: '🚗' },
];

const categoryEmoji = CATEGORY_EMOJI;

const categoryDisplayName: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Cafe', treats: 'Treats', bar: 'Bar', nightlife: 'Nightlife', food: 'Food',
  hotel: 'Stay', landmark: 'Landmark', attraction: 'Landmark', art: 'Art',
  nature: 'Nature', beach: 'Beach', shop: 'Shop', experience: 'Experience',
  neighbourhood: 'Neighbourhood', street: 'Neighbourhood', sports: 'Sports', wellness: 'Wellness',
  event: 'Event', flight: 'Flight', transport: 'Transport',
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

function SortableItineraryItem({ item, dayId, userId, onOpen, categoryEmoji, categoryDisplayName, collaborators }: {
  item: { id: string; name: string; category: string; image?: string; time?: string; timeEnd?: string; checkIn?: string; checkOut?: string; status?: string; booked?: boolean; neighborhood?: string; location?: string; addedBy?: string | null; addedByName?: string | null; addedByAvatar?: string | null };
  dayId: string | null;
  userId?: string;
  onOpen: () => void;
  categoryEmoji: Record<string, string>;
  categoryDisplayName: Record<string, string>;
  collaborators?: { id: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const isBooked = item.status === 'booked' || item.booked;
  const isPending = item.status === 'pending';
  const fmtDate = (s?: string) => { if (!s) return ''; try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return s; } };
  return (
    <div ref={setNodeRef} style={style} className={`rounded-2xl p-3 transition-colors ${isBooked ? 'bg-green-50/70 border border-green-100' : isPending ? 'bg-amber-50/70 border border-amber-100' : 'bg-gray-50'}`}>
      <div className="flex items-start gap-3">
        <div {...listeners} {...attributes} className="mt-1 touch-none cursor-grab active:cursor-grabbing flex-shrink-0 text-gray-300" onClick={e => e.stopPropagation()}>
          <GripVertical size={14} strokeWidth={1.5} />
        </div>
        <ItemThumb image={item.image} name={item.name} category={item.category} />
        <div className="flex-1 min-w-0" onClick={onOpen}>
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
          {!isBooked && isBookable(item.category) && (
            <button
              onClick={e => { e.stopPropagation(); window.open(getBookingUrl(item.name, item.location ?? item.neighborhood ?? '', item.category), '_blank'); }}
              className="text-[10px] font-bold bg-gray-900 text-white px-2.5 py-1 rounded-full"
            >
              Book
            </button>
          )}
        </div>
      </div>
      {(collaborators?.length ?? 0) > 0 && item.addedBy && (
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
          {(() => {
            const uniquePlaces = new Set(trip.days.flatMap(d => d.items.map(i => i.name))).size;
            return trip.dates
              ? <p className="text-white/60 text-xs">· {countDaysFromDateStr(trip.dates)} days · {uniquePlaces} places</p>
              : uniquePlaces > 0
                ? <p className="text-white/60 text-xs">· {uniquePlaces} ideas</p>
                : null;
          })()}
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

export default function Saved({ userId, userAvatar }: { userId?: string; userAvatar?: string | null }) {
  const [activeTab, setActiveTab] = useState<SavedTab>('Places');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Trip | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [placeCategory, setPlaceCategory] = useState<Category | 'all'>('all');
  const [savedPlaceSet, setSavedPlaceSet] = useState<Set<string>>(new Set());
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
  const [newPlanImportCollection, setNewPlanImportCollection] = useState<import('../lib/supabase').RealCollection | null>(null);
  const [newPlanImportPlaces, setNewPlanImportPlaces] = useState<RealPostPlace[]>([]);
  const [newPlanImportSelectedIds, setNewPlanImportSelectedIds] = useState<Set<string>>(new Set());
  const [loadingImportPlaces, setLoadingImportPlaces] = useState(false);
  const coverImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverImageSessionTokenRef = useRef(crypto.randomUUID());
  const [newEventAddress, setNewEventAddress] = useState('');
  const [newEventNeighborhood, setNewEventNeighborhood] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('');
  const [newEventAddressSuggestions, setNewEventAddressSuggestions] = useState<{ placeId: string; label: string }[]>([]);
  const [newEventAddressLoading, setNewEventAddressLoading] = useState(false);
  const newEventAddressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newEventAddressSessionTokenRef = useRef(crypto.randomUUID());
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
  const savedMapRef = useRef<import('leaflet').Map | null>(null);
  const [savedMapPin, setSavedMapPin] = useState<SavedPlace | null>(null);
  const [savedMapSearch, setSavedMapSearch] = useState('');
  const [selectedSavedPost, setSelectedSavedPost] = useState<RealPost | null>(null);
  const [savedPostLiked, setSavedPostLiked] = useState(false);
  const [savedPostLikeCount, setSavedPostLikeCount] = useState(0);
  const [savedPostComments, setSavedPostComments] = useState<PostComment[]>([]);
  const [savedPostCommentText, setSavedPostCommentText] = useState('');
  const [savedPostCommentSending, setSavedPostCommentSending] = useState(false);
  const savedPostCommentRef = useRef<HTMLInputElement>(null);
  const [savedPostOptionsStep, setSavedPostOptionsStep] = useState<'options' | 'reason' | 'done' | 'blockConfirm' | 'deleteConfirm' | null>(null);
  const [savedBlockedUsers, setSavedBlockedUsers] = useState<Set<string>>(new Set());
  const [savedActionModal, setSavedActionModal] = useState<{
    avatarUrl?: string | null; iconType?: 'check'; title: string; subtitle: string;
    confirmLabel?: string; confirmVariant?: 'red' | 'dark'; onConfirm?: () => void;
  } | null>(null);
  const [savedPostOptionsReason, setSavedPostOptionsReason] = useState('');
  const [showSavedPostShare, setShowSavedPostShare] = useState(false);
  const [savedPostShareSentTo, setSavedPostShareSentTo] = useState<Set<string>>(new Set());
  const [savedPostShareSearch, setSavedPostShareSearch] = useState('');
  const [savedPostShareResults, setSavedPostShareResults] = useState<FollowProfile[]>([]);
  const [searchingSavedPostShare, setSearchingSavedPostShare] = useState(false);
  const [savedPostShareLinkCopied, setSavedPostShareLinkCopied] = useState(false);
  const [savedPostConversations, setSavedPostConversations] = useState<Conversation[]>([]);
  const savedPostShareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Collection share sheet
  const [showCollectionShareSheet, setShowCollectionShareSheet] = useState(false);
  const [collectionShareSearchQuery, setCollectionShareSearchQuery] = useState('');
  const [collectionShareSearchResults, setCollectionShareSearchResults] = useState<FollowProfile[]>([]);
  const [collectionShareSentTo, setCollectionShareSentTo] = useState<Set<string>>(new Set());
  const [searchingCollectionShare, setSearchingCollectionShare] = useState(false);
  const [collectionShareLinkCopied, setCollectionShareLinkCopied] = useState(false);
  const collectionShareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postsBrowseGroup, setPostsBrowseGroup] = useState<SavedPlace[] | null>(null);
  const [postsBrowsePosts, setPostsBrowsePosts] = useState<(RealPost | null)[]>([]);
  const [addToColPlace, setAddToColPlace] = useState<SavedPlace | null>(null);
  const [addToColIds, setAddToColIds] = useState<Set<string>>(new Set());
  const [addToColLoading, setAddToColLoading] = useState(false);
  const [addToColSaving, setAddToColSaving] = useState<Set<string>>(new Set());
  // All Saved → place card bookmark sheet: trips state
  const [addToColPlans, setAddToColPlans] = useState<Trip[]>([]);
  const [addToColPlanAdded, setAddToColPlanAdded] = useState<Set<string>>(new Set());
  const [addToColPlanAdding, setAddToColPlanAdding] = useState<string | null>(null);
  const [addToColShowNewTrip, setAddToColShowNewTrip] = useState(false);
  const [addToColNewTripName, setAddToColNewTripName] = useState('');
  const [addToColCreatingTrip, setAddToColCreatingTrip] = useState(false);
  // Post detail overlay bookmark sheet state
  const [postDetailSaveSheet, setPostDetailSaveSheet] = useState(false);
  const [postDetailSaveColIds, setPostDetailSaveColIds] = useState<Set<string>>(new Set());
  const [postDetailSaveColSaving, setPostDetailSaveColSaving] = useState<Set<string>>(new Set());
  const [postDetailSavePlans, setPostDetailSavePlans] = useState<Trip[]>([]);
  const [postDetailSavePlanAdded, setPostDetailSavePlanAdded] = useState<Set<string>>(new Set());
  const [postDetailSavePlanAdding, setPostDetailSavePlanAdding] = useState<string | null>(null);
  const [postDetailSaveShowNewTrip, setPostDetailSaveShowNewTrip] = useState(false);
  const [postDetailSaveNewTripName, setPostDetailSaveNewTripName] = useState('');
  const [postDetailSaveCreatingTrip, setPostDetailSaveCreatingTrip] = useState(false);
  // Collection detail → non-owner place card sheet: trips state
  const [colSavePlans, setColSavePlans] = useState<Trip[]>([]);
  const [colSavePlanAdded, setColSavePlanAdded] = useState<Set<string>>(new Set());
  const [colSavePlanAdding, setColSavePlanAdding] = useState<string | null>(null);
  const [colSaveShowNewTrip, setColSaveShowNewTrip] = useState(false);
  const [colSaveNewTripName, setColSaveNewTripName] = useState('');
  const [colSaveCreatingTrip, setColSaveCreatingTrip] = useState(false);
  // Collection detail → owner place card bookmark sheet state
  const [colOwnerBookmarkSheet, setColOwnerBookmarkSheet] = useState<RealPostPlace | null>(null);
  const [colOwnerBookmarkColIds, setColOwnerBookmarkColIds] = useState<Set<string>>(new Set());
  const [colOwnerBookmarkColSaving, setColOwnerBookmarkColSaving] = useState<Set<string>>(new Set());
  const [colOwnerBookmarkPlans, setColOwnerBookmarkPlans] = useState<Trip[]>([]);
  const [colOwnerBookmarkPlanAdded, setColOwnerBookmarkPlanAdded] = useState<Set<string>>(new Set());
  const [colOwnerBookmarkPlanAdding, setColOwnerBookmarkPlanAdding] = useState<string | null>(null);
  const [colOwnerBookmarkShowNewTrip, setColOwnerBookmarkShowNewTrip] = useState(false);
  const [colOwnerBookmarkNewTripName, setColOwnerBookmarkNewTripName] = useState('');
  const [colOwnerBookmarkCreatingTrip, setColOwnerBookmarkCreatingTrip] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapDayFilter, setMapDayFilter] = useState<string>('all'); // 'all' or day label
  const [planViewMode, setPlanViewMode] = useState<'brainstorm' | 'itinerary'>('brainstorm');
  const [brainstormCategoryFilter, setBrainstormCategoryFilter] = useState<string>('all');
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
  const [detailItemAsPlace, setDetailItemAsPlace] = useState<RealPostPlace | null>(null);
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
  // Itinerary generation
  const [showGenerateSheet, setShowGenerateSheet] = useState(false);
  const [generateSelectedIds, setGenerateSelectedIds] = useState<Set<string>>(new Set());
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState('');
  // Drag-and-drop in itinerary view
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  // AI Ask for ideas
  const [showAskAISheet, setShowAskAISheet] = useState(false);
  const [askAIPrompt, setAskAIPrompt] = useState('');
  const [askAILoading, setAskAILoading] = useState(false);
  const [askAISuggestions, setAskAISuggestions] = useState<{ name: string; category: string; neighborhood: string; reason: string; lat?: number; lng?: number }[]>([]);
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
  const editItemAddressSessionTokenRef = useRef(crypto.randomUUID());
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
  const [newColCoverUrl, setNewColCoverUrl] = useState<string | null>(null);
  const [newColCoverUploading, setNewColCoverUploading] = useState(false);
  const [editColCoverUrl, setEditColCoverUrl] = useState<string | null>(null);
  const [editColCoverUploading, setEditColCoverUploading] = useState(false);
  const [dbCollections, setDbCollections] = useState<import('../lib/supabase').RealCollection[]>([]);
  const [dbSubscribedCollections, setDbSubscribedCollections] = useState<import('../lib/supabase').RealCollection[]>([]);
  const [selectedRealCollection, setSelectedRealCollection] = useState<import('../lib/supabase').RealCollection | null>(null);
  const [realCollectionPlaces, setRealCollectionPlaces] = useState<RealPostPlace[]>([]);
  const [realCollectionGuides, setRealCollectionGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [savedGuidesFilter, setSavedGuidesFilter] = useState<string>('All');
  const [savedSubscribedGuideIds, setSavedSubscribedGuideIds] = useState<Set<string>>(new Set());
  const [savedGuideColSheet, setSavedGuideColSheet] = useState<Guide | null>(null);
  const [savedGuideColIds, setSavedGuideColIds] = useState<Set<string>>(new Set());
  const [savedGuideColLoading, setSavedGuideColLoading] = useState(false);
  const [loadingRealCollectionPlaces, setLoadingRealCollectionPlaces] = useState(false);
  const [realColFilter, setRealColFilter] = useState('all');
  const [showRealColMap, setShowRealColMap] = useState(true);
  const [showEditColSheet, setShowEditColSheet] = useState(false);
  const [editColName, setEditColName] = useState('');
  const [editColDesc, setEditColDesc] = useState('');
  const [editColSaving, setEditColSaving] = useState(false);
  const [confirmUnfollowCol, setConfirmUnfollowCol] = useState(false);
  const [selectedPlacePage, setSelectedPlacePage] = useState<RealPostPlace | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showColSaveSheet, setShowColSaveSheet] = useState<string | null>(null); // placeId
  const [colSaveSheetColIds, setColSaveSheetColIds] = useState<Set<string>>(new Set());
  const [showNewColSave, setShowNewColSave] = useState(false);
  const [newColSaveName, setNewColSaveName] = useState('');
  const [savingNewColSave, setSavingNewColSave] = useState(false);
  const [colSaveUserCollections, setColSaveUserCollections] = useState<import('../lib/supabase').RealCollection[]>([]);
  const [collectionOwnerProfile, setCollectionOwnerProfile] = useState<{ name: string; username: string; avatarUrl: string | null } | null>(null);
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
  const [myGuides, setMyGuides] = useState<Guide[]>([]);
  const [subscribedGuides, setSubscribedGuides] = useState<Guide[]>([]);
  const [showPublishGuide, setShowPublishGuide] = useState(false);
  const [publishGuideTitle, setPublishGuideTitle] = useState('');
  const [publishGuideDesc, setPublishGuideDesc] = useState('');
  const [publishingGuide, setPublishingGuide] = useState(false);

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
        lat: item.lat ?? undefined, lng: item.lng ?? undefined,
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

      const data = await gTextSearch(
        body,
        'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.photos',
        TTL.ENRICHMENT,
      );
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
          const searchData = await gTextSearch(
            { textQuery: address ? `${name} ${address}` : name, languageCode: 'en' },
            'places.id,places.photos,places.types,places.displayName,places.formattedAddress,places.addressComponents,places.location',
            TTL.ENRICHMENT,
          );
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
          const place = await gPlaceDetails(resolvedPlaceId, 'displayName,types,photos,formattedAddress,addressComponents,location', undefined, TTL.PHOTOS);
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

      // Guard: don't add a place that already exists in the same day
      const alreadyInDay = day.items.some(i => i.name.toLowerCase() === name.toLowerCase());
      if (alreadyInDay) {
        setShowAddPlace(false);
        return;
      }

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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
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

  // ── Itinerary Generator (neighborhood-based, no AI) ──────────────────────
  const handleGenerateItinerary = async () => {
    if (!selectedTrip || !userId) return;
    setGenerateLoading(true);
    setGenerateError('');

    try {
      // Delete all existing days first to avoid duplicates on regenerate
      for (const day of selectedTrip.days) {
        if (day.id) await deletePlanDay(day.id);
      }

      const allTripItems = selectedTrip.days.flatMap(d => d.items);
      // Deduplicate by name (within the flat list) so items that appear twice in the same pool aren't doubled
      const _seenGen = new Set<string>();
      const uniqueTripItems = allTripItems.filter(item => {
        const key = item.name.toLowerCase();
        if (_seenGen.has(key)) return false;
        _seenGen.add(key);
        return true;
      });
      const placesToUse = uniqueTripItems.filter(p => generateSelectedIds.has(p.id));
      const numDays = countDaysFromDates(selectedTrip.dates) || 3;

      // Group by neighborhood → city → 'Other'
      const groups = new Map<string, TripItem[]>();
      for (const item of placesToUse) {
        const key = item.neighborhood || item.location || 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }

      // Distribute groups across days: assign each group to the day with fewest items
      const dayBuckets: TripItem[][] = Array.from({ length: numDays }, () => []);
      const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length);
      for (const groupItems of sortedGroups) {
        const targetIdx = dayBuckets.reduce((minIdx, d, i) => d.length < dayBuckets[minIdx].length ? i : minIdx, 0);
        dayBuckets[targetIdx].push(...groupItems);
      }

      // Persist to DB and build local state
      const newDays: TripDay[] = [];
      for (let di = 0; di < numDays; di++) {
        const label = getTripDayLabel(selectedTrip, di);
        const newDay = await createPlanDay(selectedTrip.id, label, di);
        if (!newDay) continue;
        const items: TripItem[] = [];
        for (let pi = 0; pi < dayBuckets[di].length; pi++) {
          const item = dayBuckets[di][pi];
          const dbItem = await createPlanItem(selectedTrip.id, newDay.id, {
            name: item.name,
            category: item.category,
            image_url: item.image ?? '',
            time_label: '',
            time_end: '',
            notes: item.notes ?? '',
            address: item.address ?? '',
            neighborhood: item.neighborhood ?? '',
            location: item.location ?? '',
            status: 'none',
            check_in: '',
            check_out: '',
            position: pi,
            lat: item.lat ?? undefined,
            lng: item.lng ?? undefined,
          });
          if (dbItem) items.push(dbItem);
        }
        newDays.push({ id: newDay.id, label, items });
      }

      const updatedTrip: Trip = { ...selectedTrip, days: newDays };
      setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updatedTrip : p));
      setSelectedTrip(updatedTrip);
      setPlanViewMode('itinerary');
      setShowGenerateSheet(false);
    } catch (e: any) {
      setGenerateError(e.message ?? 'Something went wrong. Try again.');
    } finally {
      setGenerateLoading(false);
    }
  };

  // ── Itinerary drag-and-drop ───────────────────────────────────────────────
  const handleItineraryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id || !selectedTrip) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Find source day and item
    const sourceDayIdx = selectedTrip.days.findIndex(d => d.items.some(i => i.id === activeId));
    if (sourceDayIdx === -1) return;
    const sourceDay = selectedTrip.days[sourceDayIdx];
    const activeItemIdx = sourceDay.items.findIndex(i => i.id === activeId);
    const activeItem = sourceDay.items[activeItemIdx];

    // Check if over is a day id (drop on empty day zone) or an item id
    const targetDayByDayId = selectedTrip.days.findIndex(d => d.id === overId);
    const targetDayByItemId = selectedTrip.days.findIndex(d => d.items.some(i => i.id === overId));
    const destDayIdx = targetDayByDayId !== -1 ? targetDayByDayId : targetDayByItemId;
    if (destDayIdx === -1) return;

    const newDays = selectedTrip.days.map(d => ({ ...d, items: [...d.items] }));

    if (sourceDayIdx === destDayIdx) {
      // Reorder within the same day
      const overItemIdx = newDays[sourceDayIdx].items.findIndex(i => i.id === overId);
      if (overItemIdx === -1) return;
      newDays[sourceDayIdx].items = arrayMove(newDays[sourceDayIdx].items, activeItemIdx, overItemIdx);
      // Persist new positions
      newDays[sourceDayIdx].items.forEach((item, pos) => {
        updatePlanItem(item.id, { position: pos });
      });
    } else {
      // Move to a different day
      newDays[sourceDayIdx].items.splice(activeItemIdx, 1);
      const destDay = newDays[destDayIdx];
      const overItemIdx = destDay.items.findIndex(i => i.id === overId);
      const insertAt = overItemIdx === -1 ? destDay.items.length : overItemIdx;
      destDay.items.splice(insertAt, 0, activeItem);
      // Persist day change + positions
      if (destDay.id) updatePlanItem(activeId, { plan_day_id: destDay.id, position: insertAt });
      destDay.items.forEach((item, pos) => {
        if (item.id !== activeId) updatePlanItem(item.id, { position: pos });
      });
      newDays[sourceDayIdx].items.forEach((item, pos) => {
        updatePlanItem(item.id, { position: pos });
      });
    }

    const updated = { ...selectedTrip, days: newDays };
    setSelectedTrip(updated);
    setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1500 } }) }
      );
      if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests — wait a moment and try again.' : `API error ${res.status}`);
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

  const handleAddAISuggestion = async (suggestion: { name: string; category: string; neighborhood: string; reason: string; lat?: number; lng?: number }, index: number) => {
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
        lat: suggestion.lat ?? undefined, lng: suggestion.lng ?? undefined,
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

  // Cleanup search timers on unmount
  useEffect(() => {
    return () => {
      if (savedPostShareSearchRef.current) clearTimeout(savedPostShareSearchRef.current);
      if (collectionShareSearchRef.current) clearTimeout(collectionShareSearchRef.current);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    getUserGuides(userId).then(setMyGuides);
  }, [userId]);

  // ── Load real data from Supabase ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setPlans([]);
      return;
    }
    setPlansLoading(true);
    getPlans(userId).then(dbPlans => {
      const converted: Trip[] = dbPlans.map(p => {
        // Deduplicate items within each day by name (keep first occurrence per day)
        const deduplicatedDays = p.days.map(d => {
          const seenInDay = new Set<string>();
          return {
          id: d.id,
          label: d.label,
          items: d.items
            .filter(i => {
              const key = i.name.toLowerCase();
              if (seenInDay.has(key)) return false;
              seenInDay.add(key);
              return true;
            })
            .map(i => ({
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
          };
        });
        return ({
        id: p.id,
        destination: p.title,
        country: p.country,
        dates: p.dates,
        coverImage: p.coverImageUrl,
        status: p.status,
        description: p.description,
        days: deduplicatedDays,
        ownerId: p.userId,
        ownerName: p.ownerName ?? null,
        ownerAvatar: p.ownerAvatar ?? null,
        collaborators: p.collaborators.map(c => ({ id: c.id, name: c.name, avatar: c.avatar, pending: c.pending })),
        });
      });
      setPlans(converted);
      setPlansLoading(false);
      // Silently delete any duplicate rows that exist in the DB
      converted.forEach(trip => purgeDuplicatePlanItems(trip.days));
    });

    getSavedPlaces(userId).then(sp => {
      setRealSavedPlaces(sp);
      setRealSavedPlaceIds(new Set(sp.map(p => p.id)));
    });

    getItemInvites(userId).then(setItemInvites);
    getUserCollections(userId).then(setDbCollections);
    Promise.all([getBlockedUsers(userId), getBlockersOfUser(userId)])
      .then(([blocked, blockers]) => setSavedBlockedUsers(new Set([...blocked, ...blockers])));
    getSubscribedCollections(userId).then(setDbSubscribedCollections);
    getSubscribedGuides(userId).then(guides => {
      setSubscribedGuides(guides);
      setSavedSubscribedGuideIds(new Set(guides.map((g: Guide) => g.id)));
    });
    getSubscribedGuideIds(userId).then(ids => setSavedSubscribedGuideIds(new Set(ids)));
  }, [userId]);

  // ── Load likes + comments when a saved post is opened ────────────────
  useEffect(() => {
    if (!selectedSavedPost || !userId) return;
    setSavedPostComments([]);
    setSavedPostCommentText('');
    setShowSavedPostShare(false);
    setSavedPostShareSentTo(new Set());
    getLikedPosts(userId).then(ids => setSavedPostLiked(ids.has(selectedSavedPost.id)));
    getPostLikeCounts([selectedSavedPost.id]).then(counts => setSavedPostLikeCount(counts[selectedSavedPost.id] ?? 0));
    getPostComments(selectedSavedPost.id).then(setSavedPostComments);
    getConversations(userId).then(setSavedPostConversations);
  }, [selectedSavedPost?.id]);

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
              : [item.name, plan.destination, plan.country].filter(Boolean).join(', ');

            const stData = await gTextSearch(
              { textQuery: searchQuery, languageCode: 'en', ...(locationBias ? { locationBias } : {}) },
              'places.displayName,places.formattedAddress,places.addressComponents,places.photos',
              TTL.ENRICHMENT,
            );
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
                    const geoData = await gGeocode(addr);
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
            if (place && needsPhoto) {
              const photoName = place.photos?.[0]?.name;
              const formattedAddr = (place.formattedAddress ?? '').toLowerCase();
              // Build geo hints from all words in destination + country to handle "United States", "New York" etc.
              const geoHints = [plan.destination, plan.country]
                .filter(Boolean)
                .flatMap(s => s!.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2));
              // Require geo match to avoid wrong-location photos
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
    // Auto-detect: if the trip has structured itinerary days, open in itinerary mode
    const hasItinerary = selectedTrip.days.some(d => /^Day\s+\d+/i.test(d.label));
    setPlanViewMode(hasItinerary ? 'itinerary' : 'brainstorm');
    setShowMap(false);
    setMapDayFilter('all');
    setMapCoords({});
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

    // Geocode old items that have no stored coords — use places:searchText directly
    // (works from browser, no proxy needed) and write coords back to DB permanently
    const toGeocode = allItems.filter(item => item.lat == null && !mapCoords[item.id] && !storedCoords[item.id]);
    if (toGeocode.length === 0) { setMapLoading(false); return; }
    let cancelled = false;
    setMapLoading(true);
    (async () => {
      for (const item of toGeocode) {
        if (cancelled) break;
        try {
          const q = [
            item.name,
            item.address || item.neighborhood || '',
            selectedTrip.destination,
            selectedTrip.country,
          ].filter(Boolean).join(', ');
          const data = await gTextSearch(
            { textQuery: q, languageCode: 'en' },
            'places.location',
            TTL.ENRICHMENT,
          );
          const loc = data.places?.[0]?.location;
          if (loc?.latitude && loc?.longitude) {
            const lat = loc.latitude;
            const lng = loc.longitude;
            // Update incrementally so map appears as soon as first place is found
            if (!cancelled) setMapCoords(prev => ({ ...prev, [item.id]: { lat, lng } }));
            // Write back to DB so this item never needs geocoding again
            if (item.id && !item.id.startsWith('item-')) {
              updatePlanItem(item.id, { lat, lng });
            }
          }
          await new Promise(r => setTimeout(r, 120));
        } catch { /* silent */ }
      }
      if (!cancelled) setMapLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, selectedTrip?.id, selectedTrip?.days.flatMap(d => d.items).map(i => i.id).join(',')]);

  const savedPlaces: Place[] = [];
  const myCollections: Collection[] = [];

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
    const filteredItemsWithDayId = brainstormCategoryFilter === 'all'
      ? allItemsWithDayId
      : allItemsWithDayId.filter(i => i.category === brainstormCategoryFilter);
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
          <div className="absolute top-4 right-4 flex gap-2 items-center">
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
          {planViewMode === 'itinerary' && selectedTrip.days.some(d => /^Day\s+\d+/i.test(d.label)) && (
            <div className="flex-1 py-3 text-center">
              <p className="text-base font-black text-gray-900">{countDaysFromDates(selectedTrip.dates) || sortedDays.filter(d => /^Day\s+\d+/i.test(d.label)).length}</p>
              <p className="text-xs text-gray-400">Days</p>
            </div>
          )}
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

          {/* Mode toggle — Brainstorm / Itinerary pill + Show map on same row */}
          {selectedTrip.days.some(d => /^Day\s+\d+/i.test(d.label)) && (
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                  <button
                    onClick={() => setPlanViewMode('brainstorm')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${planViewMode === 'brainstorm' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                  >
                    Brainstorm
                  </button>
                  <button
                    onClick={() => setPlanViewMode('itinerary')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${planViewMode === 'itinerary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                  >
                    Itinerary
                  </button>
                </div>
                <button
                  onClick={() => setShowMap(m => !m)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full"
                >
                  <MapPin size={12} strokeWidth={2} />
                  {showMap ? 'Hide map' : 'Show map'}
                </button>
              </div>
              {planViewMode === 'itinerary' && (
                <button
                  onClick={() => { setShowAddBooking(true); setBookingForm({}); setBookingEmailText(''); setBookingImportMode(false); }}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-gray-400 w-full justify-center py-2 rounded-xl border border-dashed border-gray-200"
                >
                  <Plus size={11} strokeWidth={2} /> Add reservation
                </button>
              )}
            </div>
          )}


          {isBrainstorm ? (
            /* ══════════════════════════════════════
               BRAINSTORM MODE — flat idea list
               ══════════════════════════════════════ */
            <>

              {/* Top actions — always visible */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => openAddPlace(null)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-gray-100 text-xs text-gray-400 font-medium">
                  <Plus size={12} strokeWidth={2} /> Add place
                </button>
                <button onClick={openAskAI} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-gray-100 text-xs text-gray-400 font-medium">
                  <Sparkles size={12} strokeWidth={2} /> Ask AI
                </button>
              </div>

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

              {/* Category filter */}
              {allItemsWithDayId.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: 'none' }}>
                  {placeCategories.filter(c => c.id === 'all' || allItemsWithDayId.some(i => i.category === c.id)).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setBrainstormCategoryFilter(cat.id)}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        brainstormCategoryFilter === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span>{cat.emoji}</span><span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Flat idea list */}
              {filteredItemsWithDayId.length === 0 && allItemsWithDayId.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-base font-bold text-gray-900 mb-1">Start dreaming</p>
                  <p className="text-xs text-gray-400">Add places you want to visit — restaurants, stays, experiences, anything</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredItemsWithDayId.map(item => {
                    const isBooked = item.status === 'booked' || item.booked;
                    const isPending = item.status === 'pending';
                    const isWishlist = !isBooked && !isPending;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 transition-colors ${isBooked ? 'bg-green-50/70 border border-green-100' : isPending ? 'bg-amber-50/70 border border-amber-100' : 'bg-white border-2 border-dashed border-gray-200'}`}
                        onClick={() => { setDetailItem(item); setDetailItemDayId(item._dayId); setDetailItemAsPlace({ id: item.id, name: item.name, category: item.category, neighborhood: item.neighborhood ?? '', city: selectedTrip.destination, country: selectedTrip.country ?? '', photoUrl: item.image ?? '', position: 0, lat: item.lat ?? null, lng: item.lng ?? null }); }}
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
                            <button
                              onClick={async e => {
                                e.stopPropagation();
                                if (userId) await deletePlanItem(item.id);
                                const updatedDays = selectedTrip.days.map(d => ({ ...d, items: d.items.filter(i => i.id !== item.id) }));
                                const updated = { ...selectedTrip, days: updatedDays };
                                setPlans(prev => prev.map(p => p.id === selectedTrip.id ? updated : p));
                                setSelectedTrip(updated);
                              }}
                              className="text-gray-200 hover:text-red-400 transition-colors mt-0.5"
                            >
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
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

                </div>
              )}

            </>
          ) : (
            /* ══════════════════════════════════════
               ITINERARY MODE — day-by-day structure
               ══════════════════════════════════════ */
            <>

              {/* Inline map — shown/hidden with day filter */}
              {showMap && selectedTrip.days.length > 0 && (() => {
                const visibleDays = sortedDays
                  .filter((d, idx, arr) => arr.findIndex(x => x.label === d.label) === idx)
                  .slice(0, countDaysFromDates(selectedTrip.dates) || sortedDays.length);
                const mapItems = (mapDayFilter === 'all'
                  ? selectedTrip.days.flatMap(d => d.items)
                  : (visibleDays.find(d => d.label === mapDayFilter)?.items ?? [])
                ).filter(i => mapCoords[i.id]);
                return (
                  <div className="mb-5">
                    {/* Day filter chips */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                      <button
                        onClick={() => setMapDayFilter('all')}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${mapDayFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        All
                      </button>
                      {visibleDays.map(d => (
                        <button
                          key={d.label}
                          onClick={() => setMapDayFilter(d.label)}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${mapDayFilter === d.label ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {d.label.split('·')[0].trim()}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-2xl overflow-hidden" style={{ height: 240 }}>
                      <Suspense fallback={<div className="flex items-center justify-center h-full bg-gray-100 rounded-2xl"><Loader2 size={20} className="animate-spin text-gray-400" /></div>}>
                        {mapLoading && Object.keys(mapCoords).length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full bg-gray-100 rounded-2xl gap-2">
                            <Loader2 size={20} className="animate-spin text-gray-400" />
                            <p className="text-xs text-gray-400">Finding places on map…</p>
                          </div>
                        ) : (
                          <MapView
                            places={mapItems.map(i => ({
                              id: i.id, lat: mapCoords[i.id].lat, lng: mapCoords[i.id].lng,
                              name: i.name, city: selectedTrip.destination, country: selectedTrip.country,
                            }))}
                            height="240px"
                          />
                        )}
                      </Suspense>
                    </div>
                  </div>
                );
              })()}

              {selectedTrip.days.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-4xl mb-3">🗓</p>
                  <p className="text-base font-bold text-gray-900 mb-1">Nothing added yet</p>
                  <p className="text-xs text-gray-400 mb-6">Set up your days or let AI build your itinerary</p>
                  {selectedTrip.days.some(d => d.items.length > 0) && (
                    <button
                      onClick={() => {
                        setGenerateSelectedIds(new Set(selectedTrip.days.flatMap(d => d.items).map(i => i.id)));
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
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
                  onDragEnd={handleItineraryDragEnd}
                >
                  <div className="space-y-6">
                    {sortedDays
                      .filter((day, idx, arr) => arr.findIndex(d => d.label === day.label) === idx)
                      .slice(0, countDaysFromDates(selectedTrip.dates) || sortedDays.length)
                      .map((day, di) => (
                      <div key={di}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-gray-900">{day.label}</p>
                          {day.id && (
                            <button onClick={() => setDeleteDayConfirm({ id: day.id!, label: day.label })}
                              className="text-gray-300 hover:text-red-400 transition-colors p-1">
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M5.5 5.5v4M7.5 5.5v4M3 3l.7 7.3A1 1 0 003.7 11h5.6a1 1 0 001-.7L11 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                        </div>
                        {/* Reservations for this day */}
                        {(() => {
                          const dayDate = getDayDateFromLabel(day.label);
                          const dayBookings = dayDate ? planBookings.filter(b => {
                            const sameDay = (d: Date) => d.toDateString() === dayDate.toDateString();
                            if (b.type === 'flight') return b.departureTime ? sameDay(new Date(b.departureTime)) : false;
                            if (b.type === 'stay') return b.checkInDate ? sameDay(new Date(b.checkInDate + 'T00:00:00')) : false;
                            if (b.type === 'restaurant' || b.type === 'activity') return b.reservationDate ? sameDay(new Date(b.reservationDate + 'T00:00:00')) : false;
                            return false;
                          }) : [];
                          if (dayBookings.length === 0) return null;
                          return (
                            <div className="space-y-2 mb-3">
                              {dayBookings.map(b => {
                                const meta = BOOKING_META[b.type];
                                return (
                                  <button
                                    key={b.id}
                                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5 text-left"
                                    onClick={() => { setBookingType(b.type); setBookingForm(b); setBookingImportMode(false); setBookingEmailText(''); setShowAddBooking(true); }}
                                  >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                                      {meta.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{b.title || meta.label}</p>
                                      <p className="text-xs text-gray-400 truncate">
                                        {b.type === 'flight' && [b.flightNumber, b.departureAirport && b.arrivalAirport ? `${b.departureAirport} → ${b.arrivalAirport}` : ''].filter(Boolean).join(' · ')}
                                        {b.type === 'stay' && [b.checkInDate && b.checkOutDate ? `${b.checkInDate} – ${b.checkOutDate}` : b.checkInDate, b.address].filter(Boolean).join(' · ')}
                                        {(b.type === 'restaurant' || b.type === 'activity') && [b.reservationTime, b.partySize ? `${b.partySize} ppl` : ''].filter(Boolean).join(' · ')}
                                        {b.confirmationNumber && <span className="font-mono"> · #{b.confirmationNumber}</span>}
                                      </p>
                                    </div>
                                    <ChevronRight size={14} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <SortableContext items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2.5">
                            {day.items.map(item => (
                              <SortableItineraryItem
                                key={item.id}
                                item={item}
                                dayId={day.id ?? null}
                                userId={userId}
                                onOpen={() => { setDetailItem(item); setDetailItemDayId(day.id ?? null); setDetailItemAsPlace({ id: item.id, name: item.name, category: item.category, neighborhood: item.neighborhood ?? '', city: selectedTrip.destination, country: selectedTrip.country ?? '', photoUrl: item.image ?? '', position: 0, lat: item.lat ?? null, lng: item.lng ?? null }); }}
                                categoryEmoji={categoryEmoji}
                                categoryDisplayName={categoryDisplayName}
                                collaborators={selectedTrip.collaborators}
                              />
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
                        </SortableContext>
                      </div>
                    ))}
                    <button onClick={handleAddDay} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-100 text-sm text-gray-300 font-medium">
                      <Plus size={14} strokeWidth={1.5} /> Add a day
                    </button>
                  </div>
                  <DragOverlay>
                    {activeDragId ? (() => {
                      const activeItem = selectedTrip.days.flatMap(d => d.items).find(i => i.id === activeDragId);
                      if (!activeItem) return null;
                      return (
                        <div className="rounded-2xl p-3 bg-white shadow-xl border border-gray-100 opacity-95">
                          <div className="flex items-start gap-3">
                            <GripVertical size={14} strokeWidth={1.5} className="mt-1 text-gray-300 flex-shrink-0" />
                            <ItemThumb image={activeItem.image} name={activeItem.name} category={activeItem.category} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{activeItem.name.split(',')[0].trim()}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{categoryEmoji[activeItem.category] ?? '📍'} {categoryDisplayName[activeItem.category] ?? activeItem.category}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })() : null}
                  </DragOverlay>
                </DndContext>
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

              <p className="text-sm font-bold text-gray-900 mb-4">Edit plan</p>

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
              <p className="text-sm font-bold text-gray-900 mb-4">People on this plan</p>
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
                <p className="text-sm font-bold text-gray-900">Build Itinerary</p>
                <button onClick={() => setShowGenerateSheet(false)} disabled={generateLoading} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  <X size={14} strokeWidth={2} className="text-gray-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                {/* Intro */}
                <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4">
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">
                    🗓 Organise into {countDaysFromDates(selectedTrip.dates) || '?'} days by neighbourhood
                  </p>
                  <p className="text-xs text-gray-400">Select places to include. We'll group nearby spots into the same day to minimise travel — then you can drag to rearrange.</p>
                </div>

                {/* Select all toggle */}
                {(() => {
                  const allTripItems = selectedTrip?.days.flatMap(d => d.items) ?? [];
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-500">{generateSelectedIds.size} of {allTripItems.length} selected</p>
                        <button
                          onClick={() => {
                            if (generateSelectedIds.size === allTripItems.length) {
                              setGenerateSelectedIds(new Set());
                            } else {
                              setGenerateSelectedIds(new Set(allTripItems.map(p => p.id)));
                            }
                          }}
                          className="text-xs font-semibold text-gray-900"
                        >
                          {generateSelectedIds.size === allTripItems.length ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>

                      {/* Place list */}
                      <div className="space-y-2 mb-5">
                        {allTripItems.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">Add places to your brainstorm first</p>
                        ) : allTripItems.map(place => {
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
                                {place.image
                                  ? <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center text-lg">{categoryEmoji[place.category] ?? '📍'}</div>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                                <p className="text-xs text-gray-400 truncate">{[place.neighborhood, place.location].filter(Boolean).join(' · ')}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                                {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

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
                    <>🗓 Organise {generateSelectedIds.size > 0 ? `${generateSelectedIds.size} places` : ''} into days</>
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
                <p className="text-sm font-bold text-gray-900">Ask AI for ideas</p>
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
                <p className="text-sm font-bold text-gray-900">{bookingForm.id ? 'Edit reservation' : 'Add reservation'}</p>
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
                <p className="text-sm font-bold text-gray-900 flex-1">Add anything</p>
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
                              setAddPlaceCity(place.city ?? '');
                              setAddPlaceCountry(place.country ?? '');
                              setAddPlaceLocation(place.city ?? '');
                              setAddPlaceLat(place.lat ?? null);
                              setAddPlaceLng(place.lng ?? null);
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
                    {placeCategories.filter(c => c.id !== 'all').map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setAddPlaceCategory(prev => prev === cat.id ? '' : cat.id)}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          addPlaceCategory === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
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

        {/* Item Detail — PlacePage */}
        {detailItemAsPlace && detailItem && (
          <PlacePage
            place={detailItemAsPlace}
            appUser={userId ? { id: userId, name: '', username: '', avatar: userAvatar ?? '' } as any : undefined}
            isSaved={false}
            onClose={() => { setDetailItemAsPlace(null); setDetailItem(null); }}
          />
        )}

        {/* Item Detail — bottom sheet (legacy, kept for event items) */}
        {showItemDetail && detailItem && !detailItemAsPlace && (
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
                                lat: detailItem.lat ?? undefined, lng: detailItem.lng ?? undefined,
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
                <p className="text-sm font-bold text-gray-900 flex-1">Edit place / plan</p>
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
                          if (!val.trim() || val.trim().length < 3) { setEditItemAddressSuggestions([]); return; }
                          editItemAddressTimerRef.current = setTimeout(async () => {
                            setEditItemAddressSearching(true);
                            try {
                              const data = await gAutocomplete({ input: val, languageCode: 'en', sessionToken: editItemAddressSessionTokenRef.current });
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
                              const editToken = editItemAddressSessionTokenRef.current;
                              editItemAddressSessionTokenRef.current = crypto.randomUUID();
                              // Fetch full details for formatted address + neighborhood
                              try {
                                const data = await gPlaceDetails(s.placeId, 'displayName,formattedAddress,addressComponents,photos', editToken, TTL.PHOTOS);
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

  // ── User Profile overlay ──────────────────────────────────────
  if (viewingUserId && userId) {
    return <UserProfile userId={viewingUserId} currentUserId={userId} onBack={() => setViewingUserId(null)} onFollowChange={() => {}} onMessage={() => {}} />;
  }

  // ── Real Collection Detail ────────────────────────────────────
  if (selectedRealCollection) {
    const catEmoji = (cat: string) => CATEGORY_EMOJI[cat] ?? CATEGORY_EMOJI[cat.toLowerCase()] ?? '📍';
    const mapPlaces = realCollectionPlaces
      .filter(pl => pl.lat != null && pl.lng != null)
      .map(pl => ({ id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country }));
    const isOwn = selectedRealCollection.userId === userId;

    const RealPlaceCard = ({ place }: { place: RealPostPlace }) => {
      const isSaved = realSavedPlaceIds.has(place.id);
      return (
        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
          {/* Tappable area → opens PlacePage */}
          <button
            className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
            onClick={() => setSelectedPlacePage(place)}
          >
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
          </button>
          {/* Action button — separate from tap target */}
          {userId && isOwn ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={async () => {
                  if (!userId) return;
                  // Load collections and plans for the owner bookmark sheet
                  const [cols, planIds] = await Promise.all([
                    getUserCollections(userId),
                    getPlaceCollectionIds(place.id),
                  ]);
                  setColSaveUserCollections(cols);
                  setColOwnerBookmarkColIds(planIds);
                  setColOwnerBookmarkColSaving(new Set());
                  setColOwnerBookmarkPlanAdded(new Set());
                  setColOwnerBookmarkPlanAdding(null);
                  setColOwnerBookmarkShowNewTrip(false);
                  setColOwnerBookmarkNewTripName('');
                  // Reuse the top-level plans already loaded
                  setColOwnerBookmarkPlans(plans.filter(p => !p.description?.includes('[event]')));
                  setColOwnerBookmarkSheet(place);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0"
              >
                <Bookmark size={12} strokeWidth={2} className="text-gray-500" />
              </button>
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
            </div>
          ) : userId ? (
            <button
              onClick={async () => {
                if (isSaved) {
                  // Already saved — open the full sheet for management
                  const [cols, colIds] = await Promise.all([
                    getUserCollections(userId),
                    getPlaceCollectionIds(place.id),
                  ]);
                  setColSaveUserCollections(cols);
                  setColSaveSheetColIds(colIds);
                  setColSavePlans(plans.filter(p => !p.description?.includes('[event]')));
                  setColSavePlanAdded(new Set());
                  setColSavePlanAdding(null);
                  setColSaveShowNewTrip(false);
                  setColSaveNewTripName('');
                  setShowNewColSave(false);
                  setNewColSaveName('');
                  setShowColSaveSheet(place.id);
                } else {
                  await savePlace(userId, place.id);
                  setRealSavedPlaceIds(prev => new Set(prev).add(place.id));
                  setRealSavedPlaces(prev => [...prev, { id: place.id, postId: '', name: place.name, category: place.category ?? '', neighborhood: place.neighborhood ?? '', city: place.city ?? '', country: place.country ?? '', photoUrl: place.photoUrl ?? '', lat: place.lat ?? null, lng: place.lng ?? null }]);
                  // Load user's collections and open the sheet
                  const [cols, colIds] = await Promise.all([
                    getUserCollections(userId),
                    getPlaceCollectionIds(place.id),
                  ]);
                  setColSaveUserCollections(cols);
                  setColSaveSheetColIds(colIds);
                  setColSavePlans(plans.filter(p => !p.description?.includes('[event]')));
                  setColSavePlanAdded(new Set());
                  setColSavePlanAdding(null);
                  setColSaveShowNewTrip(false);
                  setColSaveNewTripName('');
                  setShowNewColSave(false);
                  setNewColSaveName('');
                  setShowColSaveSheet(place.id);
                }
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${isSaved ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
            >
              {isSaved
                ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
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
            onClick={() => { setSelectedRealCollection(null); setRealCollectionPlaces([]); setRealCollectionGuides([]); setRealColFilter('all'); setShowRealColMap(true); setRealColCollaborators([]); setConfirmUnfollowCol(false); }}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute top-4 right-4 flex gap-2">
            {!isOwn && userId && (
              <button
                onClick={() => setConfirmUnfollowCol(true)}
                className="h-8 px-3 rounded-full bg-white/90 flex items-center justify-center text-xs font-semibold text-gray-500"
              >
                Following
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
                setCollectionShareSearchQuery('');
                setCollectionShareSearchResults([]);
                setCollectionShareSentTo(new Set());
                setCollectionShareLinkCopied(false);
                setShowCollectionShareSheet(true);
                if (savedPostConversations.length === 0 && userId) {
                  getConversations(userId).then(setSavedPostConversations);
                }
              }}
              className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <Share2 size={14} strokeWidth={1.5} className="text-gray-700" />
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

        {/* Add places button — owner only, sits just below cover */}
        {isOwn && (
          <div className="flex justify-end px-4 pt-3 pb-1">
            <button
              onClick={() => {
                setShowAddPlaces(true);
                // Refresh saved places in case they haven't loaded yet
                if (userId && realSavedPlaces.length === 0) {
                  import('../lib/supabase').then(({ getSavedPlaces }) =>
                    getSavedPlaces(userId).then(sp => {
                      setRealSavedPlaces(sp);
                      setRealSavedPlaceIds(new Set(sp.map(p => p.id)));
                    })
                  );
                }
              }}
              className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full active:opacity-80"
            >
              <Plus size={12} strokeWidth={2.5} />
              Add places
            </button>
          </div>
        )}

        {/* Owner profile strip (only when viewing someone else's collection) */}
        {!isOwn && (
          <button
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-50 transition-colors text-left"
            onClick={() => setViewingUserId(selectedRealCollection.userId)}
          >
            {collectionOwnerProfile?.avatarUrl ? (
              <img src={collectionOwnerProfile.avatarUrl} alt={collectionOwnerProfile.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${collectionOwnerProfile ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 animate-pulse'}`}>
                {collectionOwnerProfile ? (collectionOwnerProfile.name || collectionOwnerProfile.username || '?')[0].toUpperCase() : ''}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {collectionOwnerProfile ? (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate">{collectionOwnerProfile.name || collectionOwnerProfile.username}</p>
                  {collectionOwnerProfile.username && (
                    <p className="text-xs text-gray-400 truncate">@{collectionOwnerProfile.username}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="h-3.5 w-28 bg-gray-100 rounded animate-pulse mb-1.5" />
                  <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                </>
              )}
            </div>
            <ChevronRight size={14} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
          </button>
        )}

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
                      <p className="text-sm font-bold text-gray-900 mb-2">{area}</p>
                      <div className="space-y-3">{areaPlaces.map(place => <RealPlaceCard key={place.id} place={place} />)}</div>
                    </div>
                  ));
                })()}
              </div>
            </>
          );
        })()}

      {/* Guides in this collection */}
      {realCollectionGuides.length > 0 && (
        <div className="px-4 pt-6 pb-4">
          <p className="text-sm font-bold text-gray-900 mb-3">{realCollectionGuides.length} guide{realCollectionGuides.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 gap-3">
            {realCollectionGuides.map(guide => (
              <button
                key={guide.id}
                className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform bg-gray-200"
                style={{ aspectRatio: '3/4' }}
                onClick={() => setSelectedGuide(guide)}
              >
                {guide.coverUrl
                  ? <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute top-2.5 left-2.5">
                  <span className="text-xs font-semibold text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    {guide.format === 'itinerary' ? 'Itinerary' : 'Guide'}
                  </span>
                </div>
                <button
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center active:scale-90 transition-transform z-10"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!userId) return;
                    setSavedGuideColLoading(true);
                    if (!savedSubscribedGuideIds.has(guide.id)) {
                      subscribeToGuide(userId, guide.id);
                      setSavedSubscribedGuideIds(prev => new Set(prev).add(guide.id));
                    }
                    const ids = await getGuideCollectionIds(guide.id, userId);
                    setSavedGuideColIds(ids);
                    setSavedGuideColSheet(guide);
                    setSavedGuideColLoading(false);
                  }}
                >
                  {savedGuideColLoading && savedGuideColSheet?.id === guide.id
                    ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-white" />
                    : savedSubscribedGuideIds.has(guide.id)
                      ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                      : <Bookmark size={14} strokeWidth={1.5} className="text-white" />}
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-bold text-sm leading-tight line-clamp-2">{guide.title}</p>
                  {guide.destination && (
                    <p className="text-white/70 text-xs mt-0.5 truncate">📍 {guide.destination}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Place detail overlay */}
      {selectedPlacePage && (
        <PlacePage
          place={selectedPlacePage}
          appUser={userId ? { id: userId, avatar: userAvatar ?? null } as any : undefined}
          isSaved={realSavedPlaceIds.has(selectedPlacePage.id)}
          onClose={() => setSelectedPlacePage(null)}
          onToggleSave={async () => {
            if (!userId) return;
            const isSaved = realSavedPlaceIds.has(selectedPlacePage.id);
            if (isSaved) {
              await unsavePlace(userId, selectedPlacePage.id);
              setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(selectedPlacePage.id); return n; });
              setRealSavedPlaces(prev => prev.filter(p => p.id !== selectedPlacePage.id));
            } else {
              await savePlace(userId, selectedPlacePage.id);
              setRealSavedPlaceIds(prev => new Set(prev).add(selectedPlacePage.id));
            }
          }}
        />
      )}

      {/* Guide detail from collection */}
      {selectedGuide && (
        <GuideDetail
          guide={selectedGuide}
          currentUserId={userId ?? undefined}
          onClose={() => setSelectedGuide(null)}
          onViewUser={(uid) => { setSelectedGuide(null); setViewingUserId(uid); }}
        />
      )}

      {/* Save-to-collection sheet (non-owner) */}
      {showColSaveSheet && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50" onClick={() => { setShowColSaveSheet(null); setColSaveSheetColIds(new Set()); setShowNewColSave(false); setNewColSaveName(''); setColSaveShowNewTrip(false); setColSaveNewTripName(''); setColSavePlanAdded(new Set()); }}>
          <div className="w-full bg-white rounded-t-3xl pb-8 max-h-[85vh] overflow-y-auto" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-48 overflow-y-auto">
              {colSaveUserCollections.map(col => {
                const inCol = colSaveSheetColIds.has(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={async () => {
                      if (!showColSaveSheet) return;
                      if (inCol) {
                        await removePlaceFromCollection(col.id, showColSaveSheet);
                        setColSaveSheetColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                      } else {
                        await addPlaceToCollection(col.id, showColSaveSheet);
                        setColSaveSheetColIds(prev => new Set(prev).add(col.id));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} places</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 pt-3">
              <button
                onClick={() => { setNewColName(''); setNewColEmoji(''); setNewColDesc(''); setShowNewCollection(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Plus size={15} strokeWidth={2} className="text-gray-600" />
                </div>
                New collection
              </button>
            </div>
            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {colSavePlans.length === 0 && !colSaveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {colSavePlans.length > 0 && (() => {
                const placeId = showColSaveSheet;
                const place = realCollectionPlaces.find(p => p.id === placeId);
                if (!place) return null;
                return (
                  <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                    {colSavePlans.map(plan => {
                      const added = colSavePlanAdded.has(plan.id);
                      const adding = colSavePlanAdding === plan.id;
                      return (
                        <button
                          key={plan.id}
                          disabled={added || adding}
                          onClick={async () => {
                            setColSavePlanAdding(plan.id);
                            try {
                              const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                              const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                              if (day) {
                                await createPlanItem(plan.id, day.id!, {
                                  name: place.name,
                                  category: place.category || '',
                                  image_url: place.photoUrl || '',
                                  time_label: '',
                                  address: [place.neighborhood, place.city, place.country].filter(Boolean).join(', '),
                                  neighborhood: place.neighborhood || '',
                                  position: day.items.length,
                                  lat: place.lat ?? null,
                                  lng: place.lng ?? null,
                                });
                                setColSavePlanAdded(prev => new Set(prev).add(plan.id));
                              }
                            } finally {
                              setColSavePlanAdding(null);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                        >
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                            {plan.coverImage ? <img src={plan.coverImage} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.destination}</p>
                            {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                          </div>
                          {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                          {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              {colSaveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={colSaveNewTripName}
                    onChange={e => setColSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setColSaveShowNewTrip(false); setColSaveNewTripName(''); }
                      if (e.key === 'Enter' && colSaveNewTripName.trim() && userId) {
                        setColSaveCreatingTrip(true);
                        const newPlan = await dbCreatePlan(userId, { title: colSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) {
                          const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                          setColSavePlans(prev => [converted, ...prev]);
                          setPlans(prev => [converted, ...prev]);
                          setColSaveShowNewTrip(false);
                          setColSaveNewTripName('');
                        }
                        setColSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!colSaveNewTripName.trim() || colSaveCreatingTrip}
                    onClick={async () => {
                      if (!colSaveNewTripName.trim() || !userId) return;
                      setColSaveCreatingTrip(true);
                      const newPlan = await dbCreatePlan(userId, { title: colSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) {
                        const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                        setColSavePlans(prev => [converted, ...prev]);
                        setPlans(prev => [converted, ...prev]);
                        setColSaveShowNewTrip(false);
                        setColSaveNewTripName('');
                      }
                      setColSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {colSaveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setColSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>
            {/* ── Remove from Saved ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!userId || !showColSaveSheet) return;
                  await unsavePlace(userId, showColSaveSheet);
                  setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(showColSaveSheet); return n; });
                  setRealSavedPlaces(prev => prev.filter(p => p.id !== showColSaveSheet));
                  setShowColSaveSheet(null);
                  setColSaveSheetColIds(new Set());
                  setColSaveShowNewTrip(false);
                  setColSaveNewTripName('');
                  setColSavePlanAdded(new Set());
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unfollow collection confirmation sheet */}
      {confirmUnfollowCol && !isOwn && userId && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmUnfollowCol(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex flex-col items-center px-6 pb-2">
              {selectedRealCollection.coverImageUrl ? (
                <img src={selectedRealCollection.coverImageUrl} alt={selectedRealCollection.name} className="w-16 h-16 rounded-2xl object-cover mb-3" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <span className="text-3xl">{selectedRealCollection.emoji || '🗂️'}</span>
                </div>
              )}
              <p className="text-base font-bold text-gray-900 mb-1">Unfollow this collection?</p>
              <p className="text-sm text-gray-400 text-center mb-6">
                "{selectedRealCollection.name}" will be removed from your Following.
              </p>
              <button
                onClick={async () => {
                  setConfirmUnfollowCol(false);
                  await unsubscribeFromCollection(userId, selectedRealCollection.id);
                  setDbSubscribedCollections(prev => prev.filter(c => c.id !== selectedRealCollection.id));
                  setSelectedRealCollection(null);
                  setRealCollectionPlaces([]);
                }}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
              >
                Unfollow
              </button>
              <button
                onClick={() => setConfirmUnfollowCol(false)}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner bookmark sheet — Collections + Trips + Remove from Saved */}
      {colOwnerBookmarkSheet && userId && (
        <div className="fixed inset-0 z-[210] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }} onClick={() => { setColOwnerBookmarkSheet(null); setColOwnerBookmarkColIds(new Set()); setColOwnerBookmarkColSaving(new Set()); setColOwnerBookmarkShowNewTrip(false); setColOwnerBookmarkNewTripName(''); setColOwnerBookmarkPlanAdded(new Set()); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add {colOwnerBookmarkSheet.name.split(',')[0].trim()} to a collection?</p>
            </div>
            {/* Collections */}
            <div className="px-4 space-y-2 max-h-48 overflow-y-auto">
              {colSaveUserCollections.map(col => {
                const inCol = colOwnerBookmarkColIds.has(col.id);
                const isSaving = colOwnerBookmarkColSaving.has(col.id);
                return (
                  <button
                    key={col.id}
                    disabled={isSaving}
                    onClick={async () => {
                      setColOwnerBookmarkColSaving(prev => new Set(prev).add(col.id));
                      if (inCol) {
                        await removePlaceFromCollection(col.id, colOwnerBookmarkSheet.id);
                        setColOwnerBookmarkColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                      } else {
                        await addPlaceToCollection(col.id, colOwnerBookmarkSheet.id, userId);
                        setColOwnerBookmarkColIds(prev => new Set(prev).add(col.id));
                      }
                      setColOwnerBookmarkColSaving(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} places</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {isSaving ? <Loader2 size={10} className="animate-spin text-white" /> : inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 pt-3">
              <button
                onClick={() => { setNewColName(''); setNewColEmoji(''); setNewColDesc(''); setShowNewCollection(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Plus size={15} strokeWidth={2} className="text-gray-600" />
                </div>
                New collection
              </button>
            </div>
            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {colOwnerBookmarkPlans.length === 0 && !colOwnerBookmarkShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {colOwnerBookmarkPlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {colOwnerBookmarkPlans.map(plan => {
                    const added = colOwnerBookmarkPlanAdded.has(plan.id);
                    const adding = colOwnerBookmarkPlanAdding === plan.id;
                    const place = colOwnerBookmarkSheet;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          setColOwnerBookmarkPlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              await createPlanItem(plan.id, day.id!, {
                                name: place.name,
                                category: place.category || '',
                                image_url: place.photoUrl || '',
                                time_label: '',
                                address: [place.neighborhood, place.city, place.country].filter(Boolean).join(', '),
                                neighborhood: place.neighborhood || '',
                                position: day.items.length,
                                lat: place.lat ?? null,
                                lng: place.lng ?? null,
                              });
                              setColOwnerBookmarkPlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setColOwnerBookmarkPlanAdding(null);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                          {plan.coverImage ? <img src={plan.coverImage} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.destination}</p>
                          {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                        </div>
                        {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                        {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {colOwnerBookmarkShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={colOwnerBookmarkNewTripName}
                    onChange={e => setColOwnerBookmarkNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setColOwnerBookmarkShowNewTrip(false); setColOwnerBookmarkNewTripName(''); }
                      if (e.key === 'Enter' && colOwnerBookmarkNewTripName.trim() && userId) {
                        setColOwnerBookmarkCreatingTrip(true);
                        const newPlan = await dbCreatePlan(userId, { title: colOwnerBookmarkNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) {
                          const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                          setColOwnerBookmarkPlans(prev => [converted, ...prev]);
                          setPlans(prev => [converted, ...prev]);
                          setColOwnerBookmarkShowNewTrip(false);
                          setColOwnerBookmarkNewTripName('');
                        }
                        setColOwnerBookmarkCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!colOwnerBookmarkNewTripName.trim() || colOwnerBookmarkCreatingTrip}
                    onClick={async () => {
                      if (!colOwnerBookmarkNewTripName.trim() || !userId) return;
                      setColOwnerBookmarkCreatingTrip(true);
                      const newPlan = await dbCreatePlan(userId, { title: colOwnerBookmarkNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) {
                        const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                        setColOwnerBookmarkPlans(prev => [converted, ...prev]);
                        setPlans(prev => [converted, ...prev]);
                        setColOwnerBookmarkShowNewTrip(false);
                        setColOwnerBookmarkNewTripName('');
                      }
                      setColOwnerBookmarkCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {colOwnerBookmarkCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setColOwnerBookmarkShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>
            {/* ── Remove from Saved ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!userId || !colOwnerBookmarkSheet) return;
                  await unsavePlace(userId, colOwnerBookmarkSheet.id);
                  setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(colOwnerBookmarkSheet.id); return n; });
                  setRealSavedPlaces(prev => prev.filter(p => p.id !== colOwnerBookmarkSheet.id));
                  setColOwnerBookmarkSheet(null);
                  setColOwnerBookmarkColIds(new Set());
                  setColOwnerBookmarkPlanAdded(new Set());
                  setColOwnerBookmarkShowNewTrip(false);
                  setColOwnerBookmarkNewTripName('');
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Collection Sheet */}
      {showEditColSheet && selectedRealCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditColSheet(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900">Edit Collection</h3>
              <button
                disabled={editColSaving || !editColName.trim()}
                onClick={async () => {
                  setEditColSaving(true);
                  const coverUrl = editColCoverUrl ?? selectedRealCollection.coverImageUrl ?? null;
                  await updateCollection(selectedRealCollection.id, { name: editColName.trim(), description: editColDesc.trim(), cover_image_url: coverUrl });
                  const updated = { ...selectedRealCollection, name: editColName.trim(), description: editColDesc.trim(), coverImageUrl: coverUrl };
                  setSelectedRealCollection(updated);
                  setDbCollections(prev => prev.map(c => c.id === selectedRealCollection.id ? { ...c, name: editColName.trim(), description: editColDesc.trim(), coverImageUrl: coverUrl } : c));
                  setEditColSaving(false);
                  setEditColCoverUrl(null);
                  setShowEditColSheet(false);
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >{editColSaving ? 'Saving…' : 'Save'}</button>
            </div>
            <div className="px-4 space-y-4">
              {/* Cover image */}
              <label className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden">
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file || !userId) return;
                  setEditColCoverUploading(true);
                  const path = `collections/${userId}/${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
                  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                  if (!error) setEditColCoverUrl(getPublicUrl('avatars', path));
                  setEditColCoverUploading(false);
                  e.target.value = '';
                }} />
                {(editColCoverUrl ?? selectedRealCollection.coverImageUrl)
                  ? <img src={editColCoverUrl ?? selectedRealCollection.coverImageUrl!} alt="" className="w-full h-full object-cover" />
                  : editColCoverUploading
                    ? <Loader2 size={20} className="text-gray-400 animate-spin" />
                    : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Change cover photo</span></div>
                }
                {(editColCoverUrl ?? selectedRealCollection.coverImageUrl) && !editColCoverUploading && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              <input value={editColName} onChange={e => setEditColName(e.target.value)} placeholder="Collection name" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              <input value={editColDesc} onChange={e => setEditColDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              <button
                onClick={async () => {
                  setShowEditColSheet(false);
                  await deleteCollection(selectedRealCollection.id);
                  setDbCollections(prev => prev.filter(c => c.id !== selectedRealCollection.id));
                  setSelectedRealCollection(null);
                  setRealCollectionPlaces([]);
                }}
                className="w-full py-3 text-sm font-semibold text-red-500 bg-red-50 rounded-xl"
              >Delete collection</button>
            </div>
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
                  <p className="text-sm font-bold text-gray-900 px-2 mb-1">Pending</p>
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
                <p className="text-sm text-gray-400 text-center py-4">No users found on sondrr</p>
              )}
            </div>

            {/* Divider + external invite */}
            <div className="border-t border-gray-100 px-3 pb-10 flex-shrink-0">
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/collection/${selectedRealCollection?.id}`;
                  const msg = `Join me on sondrr and collaborate on my collection! ${url}`;
                  if (navigator.share) {
                    try { await navigator.share({ url, title: 'Join my sondrr collection', text: msg }); } catch {}
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
                  <p className="text-xs text-gray-400">They'll need to create a sondrr account</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Share Sheet */}
      {showCollectionShareSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCollectionShareSheet(false); setCollectionShareSearchQuery(''); setCollectionShareSearchResults([]); setCollectionShareSentTo(new Set()); }} />
          <div className="relative bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowCollectionShareSheet(false); setCollectionShareSearchQuery(''); setCollectionShareSearchResults([]); setCollectionShareSentTo(new Set()); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={collectionShareSearchQuery}
                  onChange={e => {
                    const q = e.target.value;
                    setCollectionShareSearchQuery(q);
                    if (collectionShareSearchRef.current) clearTimeout(collectionShareSearchRef.current);
                    if (!q.trim()) { setCollectionShareSearchResults([]); setSearchingCollectionShare(false); return; }
                    setSearchingCollectionShare(true);
                    collectionShareSearchRef.current = setTimeout(async () => {
                      const results = await searchProfiles(q, userId ?? '');
                      setCollectionShareSearchResults(results);
                      setSearchingCollectionShare(false);
                    }, 300);
                  }}
                  placeholder="Search people..."
                  className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                />
                {searchingCollectionShare && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
              </div>
            </div>
            {(() => {
              const showSearch = collectionShareSearchQuery.trim().length > 0;
              const list = showSearch ? collectionShareSearchResults : savedPostConversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && collectionShareSearchResults.length === 0 && !searchingCollectionShare) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              }
              if (!showSearch && savedPostConversations.length === 0) return null;
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const sent = collectionShareSentTo.has(person.id);
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={person.id}
                        onClick={async () => {
                          if (sent || !userId) return;
                          const convId = await getOrCreateConversation(userId, person.id);
                          if (convId) {
                            const url = `${window.location.origin}/collection/${selectedRealCollection.id}`;
                            await sendMessage(convId, userId, `Check out my collection "${selectedRealCollection.name}" on sondrr: ${url}`);
                            setCollectionShareSentTo(prev => new Set(prev).add(person.id));
                          }
                        }}
                        className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl active:bg-gray-50 text-left"
                      >
                        {person.avatarUrl
                          ? <img src={person.avatarUrl} className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0" />
                          : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{initials}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
                          <p className="text-xs text-gray-400 truncate">@{person.username}</p>
                        </div>
                        <div className={`px-5 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${sent ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>
                          {sent ? 'Sent ✓' : 'Send'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <div className="mt-2 border-t border-gray-100 px-3 pb-10">
              <button
                className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50"
                onClick={async () => {
                  const url = `${window.location.origin}/collection/${selectedRealCollection.id}`;
                  if (navigator.share) {
                    try { await navigator.share({ url, title: selectedRealCollection.name }); } catch {}
                  } else {
                    navigator.clipboard.writeText(url).catch(() => {});
                  }
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Send size={16} strokeWidth={1.5} className="text-gray-700" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Share externally</span>
              </button>
              <button
                className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/collection/${selectedRealCollection.id}`).catch(() => {});
                  setCollectionShareLinkCopied(true);
                  setTimeout(() => setCollectionShareLinkCopied(false), 1500);
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {collectionShareLinkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                </div>
                <span className="text-sm font-semibold text-gray-900">{collectionShareLinkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Sheet (accessible from within collection detail) */}
      {showNewCollection && (
        <div className="fixed inset-0 z-[220] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewCollection(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                disabled={!newColName.trim() || newColSaving || newColCoverUploading}
                onClick={async () => {
                  if (!newColName.trim() || !userId) return;
                  setNewColSaving(true);
                  const { data } = await createCollection(userId, { name: newColName.trim(), emoji: newColEmoji || '', description: newColDesc.trim(), cover_image_url: newColCoverUrl });
                  if (data) { setDbCollections(prev => [data, ...prev]); setColSaveUserCollections(prev => [data, ...prev]); }
                  setNewColSaving(false);
                  setNewColCoverUrl(null);
                  setNewColEmoji('');
                  setShowNewCollection(false);
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >
                {newColSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
            <div className="px-4 space-y-3 pb-6">
              {/* Cover image */}
              <label className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden block">
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file || !userId) return;
                  setNewColCoverUploading(true);
                  const path = `collections/${userId}/${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
                  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                  if (!error) setNewColCoverUrl(getPublicUrl('avatars', path));
                  setNewColCoverUploading(false);
                  e.target.value = '';
                }} />
                {newColCoverUrl
                  ? <img src={newColCoverUrl} className="w-full h-full object-cover" />
                  : newColCoverUploading
                    ? <Loader2 size={20} className="text-gray-400 animate-spin" />
                    : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Add cover photo</span></div>
                }
                {newColCoverUrl && !newColCoverUploading && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              {/* Name */}
              <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="Collection name" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              {/* Description */}
              <input value={newColDesc} onChange={e => setNewColDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* Add Places Sheet */}
      {showAddPlaces && (
        <div className="fixed inset-0 z-[230] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
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
                const alreadyInCol = new Set(realCollectionPlaces.map(rp => rp.id));
                const q = addSearch.toLowerCase();
                const candidates = realSavedPlaces.filter(sp => {
                  if (addCatFilter !== 'all' && sp.category !== addCatFilter) return false;
                  if (q && !sp.name.toLowerCase().includes(q) && !(sp.city ?? '').toLowerCase().includes(q)) return false;
                  return true;
                });
                if (!candidates.length) return (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {realSavedPlaces.length === 0 ? 'Save some places first to add them here' : 'No places match'}
                  </p>
                );
                return (
                  <div className="space-y-2.5">
                    {candidates.map(savedPlace => {
                      const inCol = alreadyInCol.has(savedPlace.id);
                      return (
                        <div key={savedPlace.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                          {savedPlace.photoUrl
                            ? <img src={savedPlace.photoUrl} alt={savedPlace.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                            : <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-xl">{catEmoji(savedPlace.category)}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{savedPlace.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                              <MapPin size={9} strokeWidth={1.5} />
                              {savedPlace.neighborhood ?? savedPlace.city} · {catEmoji(savedPlace.category)} {savedPlace.category}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!selectedRealCollection) return;
                              if (inCol) {
                                await removePlaceFromCollection(selectedRealCollection.id, savedPlace.id);
                                setRealCollectionPlaces(prev => prev.filter(pl => pl.id !== savedPlace.id));
                              } else {
                                await addPlaceToCollection(selectedRealCollection.id, savedPlace.id);
                                setRealCollectionPlaces(prev => [...prev, {
                                  id: savedPlace.id, name: savedPlace.name, photoUrl: savedPlace.photoUrl,
                                  category: savedPlace.category, city: savedPlace.city, country: savedPlace.country,
                                  neighborhood: savedPlace.neighborhood, lat: savedPlace.lat, lng: savedPlace.lng,
                                } as RealPostPlace]);
                              }
                            }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-green-500' : 'bg-gray-900'}`}
                          >
                            {inCol
                              ? <Check size={12} strokeWidth={2.5} className="text-white" />
                              : <Plus size={13} strokeWidth={2.5} className="text-white" />
                            }
                          </button>
                        </div>
                      );
                    })}
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

  // ── Collection Detail ─────────────────────────────────────────
  if (selectedCollection) {
    const extraIds = colAdditions[selectedCollection.id] ?? [];
    const colPlaces: Place[] = [];
    const curator = null as { avatar: string; name: string; isCreator?: boolean; username: string } | null;
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
                  <p className="text-sm font-bold text-gray-900">{filtered.length} places</p>
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
                        <p className="text-sm font-bold text-gray-900 mb-2.5">
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
      </>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <SondrrLogo height={22} color="#0f172a" />
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
          {([['Places', 'Saved'], ['Collections', 'Collections'], ['Guides', 'Guides'], ['Trips', 'My plans']] as [SavedTab, string][]).map(([tab, label]) => (
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
      {activeTab === 'Places' && userId && (() => {
        // Exclude places saved from the user's own posts — you know those already
        const othersPlaces = realSavedPlaces.filter(p => !p.postUserId || p.postUserId !== userId);
        const countriesCount = new Set(othersPlaces.map(p => p.country).filter(Boolean)).size;
        // Group all saves by name+city — used for "from N posts" badge
        const placeGroups = (() => {
          const groups = new Map<string, SavedPlace[]>();
          for (const p of othersPlaces) {
            const key = `${p.name.toLowerCase()}|${p.city.toLowerCase()}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p);
          }
          return groups;
        })();
        // Deduplicate by name+city — keep the entry with the best data (photo preferred)
        const dedupedPlaces = (() => {
          const seen = new Map<string, SavedPlace>();
          for (const p of othersPlaces) {
            const key = `${p.name.toLowerCase()}|${p.city.toLowerCase()}`;
            const existing = seen.get(key);
            if (!existing || (!existing.photoUrl && p.photoUrl)) {
              seen.set(key, p);
            }
          }
          return Array.from(seen.values());
        })();
        const q = savedMapSearch.trim().toLowerCase();
        const filtered = q
          ? dedupedPlaces.filter(p => p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.country.toLowerCase().includes(q))
          : dedupedPlaces;
        const byCountry: Record<string, SavedPlace[]> = {};
        filtered.forEach(p => { const c = p.country || 'Unknown'; if (!byCountry[c]) byCountry[c] = []; byCountry[c].push(p); });
        const catEmoji = (cat: string) => CATEGORY_EMOJI[cat] ?? CATEGORY_EMOJI[cat?.toLowerCase()] ?? '📍';
        return (
        <div className="pb-10">
          {othersPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🔖</span>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-1.5">Nothing saved yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">Tap the bookmark icon on any place to save it here</p>
            </div>
          ) : (
            <>
              {/* Map + stats */}
              <div className="px-4 pt-4">
                <div className="rounded-2xl relative" style={{ height: 220 }}>
                  <div className="rounded-2xl overflow-hidden absolute inset-0">
                    <Suspense fallback={<div className="h-full bg-gray-100 animate-pulse" />}>
                      <MapView
                        places={dedupedPlaces.filter(p => p.lat != null && p.lng != null).map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name, city: p.city, country: p.country }))}
                        height="220px"
                        hideZoomControls
                        selectedId={savedMapPin?.id}
                        onMapReady={(map: import('leaflet').Map) => { savedMapRef.current = map; }}
                        onPlaceClick={(mp) => {
                          const found = realSavedPlaces.find(p => p.id === mp.id);
                          if (found) setSavedMapPin(found);
                        }}
                      />
                    </Suspense>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 px-4 py-3 pointer-events-none">
                    <div className="flex gap-6">
                      <div><p className="text-base font-black text-white">{countriesCount}</p><p className="text-xs text-white/70">Countries</p></div>
                      <div><p className="text-base font-black text-white">{dedupedPlaces.length}</p><p className="text-xs text-white/70">Places saved</p></div>
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 flex flex-col gap-1" style={{ zIndex: 10 }}>
                    <button onClick={() => savedMapRef.current?.zoomIn()} className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="6" y1="0" x2="6" y2="12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/><line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                    <button onClick={() => savedMapRef.current?.zoomOut()} className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                  {/* Pin preview card */}
                  {savedMapPin && (() => {
                    const catEmojiLocal = (cat: string) => CATEGORY_EMOJI[cat] ?? CATEGORY_EMOJI[cat?.toLowerCase()] ?? '📍';
                    return (
                      <div
                        className="absolute bottom-3 left-3 right-3 z-[500]"
                        style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1), opacity 0.2s ease' }}
                      >
                        <div
                          className="bg-white rounded-2xl overflow-hidden flex items-stretch cursor-pointer active:scale-[0.98] transition-transform"
                          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
                          onClick={async () => {
                            if (!savedMapPin.postId) return;
                            const post = await getPostById(savedMapPin.postId);
                            if (post) setSelectedSavedPost(post);
                          }}
                        >
                          {/* Photo */}
                          <div className="w-20 h-20 flex-shrink-0 bg-gray-200">
                            {savedMapPin.photoUrl
                              ? <img src={savedMapPin.photoUrl} alt={savedMapPin.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-2xl">{catEmojiLocal(savedMapPin.category)}</div>
                            }
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                            <p className="text-sm font-bold text-gray-900 truncate leading-tight">{savedMapPin.name.split(',')[0].trim()}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{[savedMapPin.neighborhood, savedMapPin.city].filter(Boolean).join(', ')}</p>
                            {savedMapPin.category && (
                              <p className="text-xs text-gray-400 mt-0.5">{catEmojiLocal(savedMapPin.category)} {savedMapPin.category.charAt(0).toUpperCase() + savedMapPin.category.slice(1)}</p>
                            )}
                          </div>
                          {/* View post indicator */}
                          <div className="flex flex-col items-center justify-center pr-3 pl-1 gap-0.5">
                            <ChevronRight size={16} strokeWidth={2} className="text-gray-300" />
                          </div>
                          {/* Dismiss */}
                          <button
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center z-10"
                            onClick={e => { e.stopPropagation(); setSavedMapPin(null); }}
                          >
                            <X size={11} strokeWidth={2.5} className="text-gray-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* Search */}
              <div className="px-4 pt-3">
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                  <Search size={14} strokeWidth={2} className="text-gray-400 flex-shrink-0" />
                  <input value={savedMapSearch} onChange={e => setSavedMapSearch(e.target.value)} placeholder="Search saved places…" className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none" />
                  {savedMapSearch && <button onClick={() => setSavedMapSearch('')} className="text-gray-400 text-xs">✕</button>}
                </div>
              </div>
              {/* Places by country — clickable to open post */}
              <div className="px-4 pt-4 space-y-5">
                {Object.keys(byCountry).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No places match your search</p>
                ) : Object.entries(byCountry).map(([country, cPlaces]) => (
                  <div key={country}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900">{country}</p>
                      <p className="text-xs text-gray-400">{cPlaces.length} place{cPlaces.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="space-y-2">
                      {cPlaces.map((pl, i) => {
                        const groupKey = `${pl.name.toLowerCase()}|${pl.city.toLowerCase()}`;
                        const group = placeGroups.get(groupKey) ?? [pl];
                        const postCount = group.length;
                        return (
                        <div
                          key={`${pl.id}-${i}`}
                          className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5 cursor-pointer active:bg-gray-100 transition-colors"
                          onClick={async () => {
                            if (postCount > 1) {
                              setPostsBrowseGroup(group);
                              setPostsBrowsePosts(group.map(() => null));
                              group.forEach(async (sp, idx) => {
                                if (!sp.postId) return;
                                const post = await getPostById(sp.postId);
                                setPostsBrowsePosts(prev => { const next = [...prev]; next[idx] = post; return next; });
                              });
                            } else {
                              if (!pl.postId) return;
                              const post = await getPostById(pl.postId);
                              if (post) setSelectedSavedPost(post);
                            }
                          }}
                        >
                          {/* Thumbnail — stacked if multiple posts, single otherwise */}
                          {postCount > 1 ? (() => {
                            const secondSave = group.find(s => s.id !== pl.id && s.photoUrl);
                            return (
                              <div className="relative flex-shrink-0" style={{ width: 54, height: 48 }}>
                                {secondSave?.photoUrl && (
                                  <img src={secondSave.photoUrl} alt="" className="absolute object-cover rounded-[10px]" style={{ width: 40, height: 40, top: 4, left: 13, border: '2.5px solid #f9fafb', zIndex: 1 }} />
                                )}
                                {pl.photoUrl
                                  ? <img src={pl.photoUrl} alt={pl.name} className="absolute object-cover rounded-xl" style={{ width: 44, height: 44, top: 0, left: 0, border: '2.5px solid #f9fafb', zIndex: 2 }} />
                                  : <div className="absolute rounded-xl bg-gray-200 flex items-center justify-center text-lg" style={{ width: 44, height: 44, top: 0, left: 0, border: '2.5px solid #f9fafb', zIndex: 2 }}>{catEmoji(pl.category)}</div>
                                }
                              </div>
                            );
                          })() : (
                            pl.photoUrl
                              ? <img src={pl.photoUrl} alt={pl.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                              : <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-xl">{catEmoji(pl.category)}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-900 truncate">{pl.name.split(',')[0].trim()}</p>
                              {postCount > 1 && (
                                <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-px whitespace-nowrap">{postCount} posts</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{[pl.neighborhood, pl.city].filter(Boolean).join(', ') || country}</p>
                            {pl.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji(pl.category)} {pl.category.charAt(0).toUpperCase() + pl.category.slice(1)}</p>}
                          </div>
                          <button
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 active:bg-gray-300 transition-colors"
                            onClick={async e => {
                              e.stopPropagation();
                              setAddToColPlace(pl);
                              setAddToColLoading(true);
                              setAddToColPlanAdded(new Set());
                              setAddToColPlanAdding(null);
                              setAddToColShowNewTrip(false);
                              setAddToColNewTripName('');
                              const ids = await getPlaceCollectionIds(pl.id);
                              setAddToColIds(ids);
                              setAddToColLoading(false);
                              setAddToColPlans(plans.filter(p => !p.description?.includes('[event]')));
                            }}
                          >
                            <BookmarkPlus size={14} strokeWidth={1.8} className="text-gray-600" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Posts-browse sheet — shown when a place has been saved from multiple posts */}
          {postsBrowseGroup && (
            <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto', background: 'rgba(0,0,0,0.4)' }} onClick={() => setPostsBrowseGroup(null)}>
              <div className="bg-white rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-9 h-1 rounded-full bg-gray-200" />
                </div>
                {/* Header */}
                <div className="px-5 pt-2 pb-4 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">{postsBrowseGroup[0].name.split(',')[0].trim()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{postsBrowseGroup[0].city} · saved from {postsBrowseGroup.length} posts</p>
                </div>
                {/* Posts grid */}
                <div className="overflow-y-auto px-4 pt-4" style={{ maxHeight: '55vh' }}>
                  <div className="grid grid-cols-2 gap-3 pb-8">
                    {postsBrowsePosts.map((post, idx) => {
                      const sp = postsBrowseGroup[idx];
                      return (
                        <button
                          key={sp.id}
                          className="text-left active:opacity-75 transition-opacity"
                          onClick={async () => {
                            if (post) { setPostsBrowseGroup(null); setSelectedSavedPost(post); return; }
                            if (!sp.postId) return;
                            const fetched = await getPostById(sp.postId);
                            if (fetched) { setPostsBrowseGroup(null); setSelectedSavedPost(fetched); }
                          }}
                        >
                          {/* Square image */}
                          <div className="rounded-2xl overflow-hidden aspect-square bg-gray-100 w-full">
                            {sp.photoUrl
                              ? <img src={sp.photoUrl} alt={sp.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-3xl">{catEmoji(sp.category)}</div>
                            }
                          </div>
                          {/* Info below image */}
                          {post ? (
                            <div className="mt-2">
                              <div className="flex items-center gap-1.5">
                                {post.profile.avatarUrl
                                  ? <img src={post.profile.avatarUrl} className="w-4 h-4 rounded-full object-cover flex-shrink-0" alt="" />
                                  : <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-[8px] font-bold text-gray-500">{post.profile.name[0]?.toUpperCase()}</span></div>
                                }
                                <p className="text-xs font-semibold text-gray-900 truncate">@{post.profile.username || post.profile.name}</p>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">{post.places.length} place{post.places.length !== 1 ? 's' : ''}</p>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-1.5">
                              <div className="h-3 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                              <div className="h-2.5 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Post detail — same layout as Profile post view */}
          {selectedSavedPost && (
            <div className="fixed inset-0 z-[300] bg-white overflow-y-auto pb-24" style={{ maxWidth: 384, margin: '0 auto' }}>
              {/* Full-bleed carousel */}
              <div className="relative">
                {selectedSavedPost.places.length > 0
                  ? <ImageCarousel
                      images={selectedSavedPost.places.map(pl => pl.photoUrl).filter(Boolean)}
                      labels={selectedSavedPost.places.map(pl => pl.name.split(',')[0].trim())}
                      sublabels={selectedSavedPost.places.map(pl => [pl.neighborhood, pl.city].filter(Boolean).join(', ') || pl.country)}
                    />
                  : <div className="w-full bg-gray-100" style={{ aspectRatio: '3/4' }} />
                }
                {/* Top overlay */}
                <div className="absolute top-0 left-0 right-0 px-4 pt-5 pb-8 bg-gradient-to-b from-black/55 via-black/10 to-transparent">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setSelectedSavedPost(null)}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md flex-shrink-0"
                    >
                      <ArrowLeft size={17} strokeWidth={1.5} className="text-white" />
                    </button>
                    <button
                      className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md rounded-full px-2 py-1.5 w-fit max-w-[65%] overflow-hidden active:opacity-70"
                      onClick={() => { if (selectedSavedPost.userId !== userId) setViewingUserId(selectedSavedPost.userId); }}
                    >
                      {selectedSavedPost.profile.avatarUrl
                        ? <img src={selectedSavedPost.profile.avatarUrl} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" alt="" />
                        : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/20 flex-shrink-0"><span className="text-xs font-bold text-white">{selectedSavedPost.profile.name[0]?.toUpperCase()}</span></div>
                      }
                      <p className="text-white font-semibold text-sm leading-tight truncate ml-1">
                        {selectedSavedPost.collaborators?.length
                          ? `${selectedSavedPost.profile.username || selectedSavedPost.profile.name} & ${selectedSavedPost.collaborators.map(c => c.username || c.name).join(', ')}`
                          : selectedSavedPost.profile.username || selectedSavedPost.profile.name}
                      </p>
                    </button>
                    <div className="flex-1" />
                    <button
                      className="active:opacity-60 p-1"
                      onClick={e => { e.stopPropagation(); setSavedPostOptionsStep('options'); setSavedPostOptionsReason(''); }}
                    >
                      <MoreHorizontal size={20} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>
              {/* Action bar */}
              <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-5">
                  <button className="flex items-center gap-1.5" onClick={() => {
                    if (!userId) return;
                    setSavedPostLiked(prev => !prev);
                    setSavedPostLikeCount(prev => prev + (savedPostLiked ? -1 : 1));
                    savedPostLiked ? unlikePost(userId, selectedSavedPost.id) : likePost(userId, selectedSavedPost.id);
                  }}>
                    <Heart size={22} strokeWidth={1.5} className={savedPostLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-800'} />
                    <span className="text-sm font-medium text-gray-500">{savedPostLikeCount}</span>
                  </button>
                  <button className="flex items-center gap-1.5" onClick={() => setTimeout(() => savedPostCommentRef.current?.focus(), 50)}>
                    <MessageCircle size={22} strokeWidth={1.5} className="text-gray-800" />
                    <span className="text-sm font-medium text-gray-500">{savedPostComments.length}</span>
                  </button>
                  <button className="active:scale-90 transition-transform" onClick={() => setShowSavedPostShare(true)}>
                    <Send size={21} strokeWidth={1.5} className="text-gray-800" />
                  </button>
                </div>
                <button
                  onClick={async () => {
                    if (!userId) return;
                    // Save all places if not already saved
                    for (const pl of selectedSavedPost.places) {
                      if (!realSavedPlaceIds.has(pl.id)) {
                        await savePlace(userId, pl.id);
                        setRealSavedPlaceIds(prev => new Set(prev).add(pl.id));
                        setRealSavedPlaces(prev => [...prev, { id: pl.id, postId: selectedSavedPost.id, name: pl.name, category: pl.category, neighborhood: pl.neighborhood ?? '', city: pl.city, country: pl.country ?? '', photoUrl: pl.photoUrl ?? '', lat: pl.lat ?? null, lng: pl.lng ?? null }]);
                      }
                    }
                    // Load collections for the sheet (use first place's collection membership)
                    const firstPlace = selectedSavedPost.places[0];
                    const [cols, colIds] = await Promise.all([
                      getUserCollections(userId),
                      firstPlace ? getPlaceCollectionIds(firstPlace.id) : Promise.resolve(new Set<string>()),
                    ]);
                    setColSaveUserCollections(cols);
                    setPostDetailSaveColIds(colIds);
                    setPostDetailSaveColSaving(new Set());
                    setPostDetailSavePlans(plans.filter(p => !p.description?.includes('[event]')));
                    setPostDetailSavePlanAdded(new Set());
                    setPostDetailSavePlanAdding(null);
                    setPostDetailSaveShowNewTrip(false);
                    setPostDetailSaveNewTripName('');
                    setPostDetailSaveSheet(true);
                  }}
                >
                  {selectedSavedPost.places.every(pl => realSavedPlaceIds.has(pl.id))
                    ? <BookmarkCheck size={22} strokeWidth={1.5} className="text-gray-900" />
                    : <Bookmark size={22} strokeWidth={1.5} className="text-gray-300" />}
                </button>
              </div>

              {/* ··· Options sheet for saved post */}
              {savedPostOptionsStep && (
                <div className="fixed inset-0 z-[120] flex flex-col justify-end" style={{ maxWidth: '390px', margin: '0 auto' }} onClick={() => setSavedPostOptionsStep(null)}>
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative bg-white rounded-t-3xl pb-10" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>

                    {savedPostOptionsStep === 'options' && (
                      <div className="px-2 pb-2">
                        {selectedSavedPost.userId === userId ? (
                          <>
                            <button className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left" onClick={() => setSavedPostOptionsStep('deleteConfirm')}>
                              <Trash2 size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                              <span className="text-sm text-gray-900">Delete post</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left" onClick={() => setSavedPostOptionsStep('reason')}>
                              <Flag size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                              <span className="text-sm text-gray-900">Report</span>
                              <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto flex-shrink-0" />
                            </button>
                            <button className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left" onClick={() => {
                              const alreadyBlocked = savedBlockedUsers.has(selectedSavedPost.userId);
                              setSavedPostOptionsStep(null);
                              setSavedActionModal({
                                avatarUrl: selectedSavedPost.profile.avatarUrl,
                                title: alreadyBlocked ? `Unblock @${selectedSavedPost.profile.username || selectedSavedPost.profile.name}?` : `Block @${selectedSavedPost.profile.username || selectedSavedPost.profile.name}?`,
                                subtitle: alreadyBlocked
                                  ? 'They will be able to see your posts and find your profile again.'
                                  : "They won't be able to find your profile or content.",
                                confirmLabel: alreadyBlocked ? 'Unblock' : 'Block',
                                confirmVariant: alreadyBlocked ? 'dark' : 'red',
                                onConfirm: async () => {
                                  if (!userId) return;
                                  if (alreadyBlocked) {
                                    await unblockUser(userId, selectedSavedPost.userId);
                                    setSavedBlockedUsers(prev => { const s = new Set(prev); s.delete(selectedSavedPost.userId); return s; });
                                  } else {
                                    await blockUser(userId, selectedSavedPost.userId);
                                    setSavedBlockedUsers(prev => new Set([...prev, selectedSavedPost.userId]));
                                    setSelectedSavedPost(null);
                                  }
                                  setSavedActionModal(null);
                                },
                              });
                            }}>
                              <UserX size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                              <span className="text-sm text-gray-900">{savedBlockedUsers.has(selectedSavedPost.userId) ? 'Unblock' : 'Block'} @{selectedSavedPost.profile.username || selectedSavedPost.profile.name}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {savedPostOptionsStep === 'reason' && (
                      <div className="px-2 pb-2">
                        <div className="px-5 pb-3 border-b border-gray-100">
                          <p className="text-base font-bold text-gray-900">Report</p>
                          <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
                        </div>
                        <div className="py-1">
                          {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(r => (
                            <button key={r} className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 text-left"
                              onClick={async () => {
                                if (!userId) return;
                                await reportContent(userId, { postId: selectedSavedPost.id, userId: selectedSavedPost.userId, reason: r });
                                setSavedPostOptionsStep(null);
                                setSavedActionModal({
                                  iconType: 'check',
                                  title: 'Report submitted',
                                  subtitle: "Thank you. We'll review this content and take action if it violates our guidelines.",
                                });
                              }}>
                              <span className="text-sm text-gray-900">{r}</span>
                              <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {savedPostOptionsStep === 'deleteConfirm' && (
                      <div className="px-4 pb-2 flex flex-col items-center py-4">
                        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                          <Trash2 size={28} className="text-red-500" />
                        </div>
                        <p className="font-semibold text-gray-900 text-lg mb-1">Delete this post?</p>
                        <p className="text-sm text-gray-500 text-center mb-6">This can't be undone.</p>
                        <button
                          className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm mb-2"
                          onClick={async () => {
                            if (!userId) return;
                            await deletePost(selectedSavedPost.id);
                            setSavedPostOptionsStep(null);
                            setSelectedSavedPost(null);
                          }}
                        >Delete</button>
                        <button className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm" onClick={() => setSavedPostOptionsStep('options')}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Caption + hashtags */}
              {(selectedSavedPost.caption || selectedSavedPost.hashtags.length > 0) && (
                <div className="px-5 pt-4 pb-4 border-b border-gray-100">
                  {selectedSavedPost.caption && <p className="text-sm text-gray-800 leading-relaxed">{selectedSavedPost.caption}</p>}
                  {selectedSavedPost.hashtags.length > 0 && (() => {
                    const seen = new Set<string>();
                    const unique = selectedSavedPost.hashtags.filter(h => { const k = h.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
                    return <p className="text-xs text-orange-400 mt-2">{unique.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>;
                  })()}
                </div>
              )}
              {/* Places list */}
              {selectedSavedPost.places.length > 0 && (
                <div className="px-5 pt-4">
                  <p className="text-sm font-bold text-gray-900 mb-3">
                    {new Set(selectedSavedPost.places.map(p => p.name.split(',')[0].trim().toLowerCase())).size} place{selectedSavedPost.places.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2.5 pb-5">
                    {(() => {
                      const postPlaceCatEmoji = (cat: string) => {
                        const m: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', bar: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', landmark: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙', beach: '🏖️', sport: '⚽', sports: '⚽', wellness: '🧖', treats: '🍰', food: '🥡', neighbourhood: '📍', transport: '✈️', art: '🎨', event: '🎪', flight: '✈️', stay: '🏨' };
                        return m[cat?.toLowerCase()] ?? '📍';
                      };
                      return selectedSavedPost.places
                        .filter((p, i, arr) => arr.findIndex(x => x.name.split(',')[0].trim() === p.name.split(',')[0].trim()) === i)
                        .map(pl => {
                          const isSaved = realSavedPlaceIds.has(pl.id);
                          return (
                            <div
                              key={pl.id}
                              className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3 cursor-pointer active:bg-gray-100 transition-colors"
                              onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(pl.name + ' ' + pl.city)}`, '_blank')}
                            >
                              {pl.photoUrl
                                ? <img src={pl.photoUrl} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" alt={pl.name} />
                                : <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-2xl">{postPlaceCatEmoji(pl.category)}</div>
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{pl.name.split(',')[0].trim()}</p>
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5 flex-wrap">
                                  <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                                  {[pl.neighborhood, pl.city].filter(Boolean).join(', ') || pl.country}
                                </p>
                                {pl.category && <p className="text-xs text-gray-400 mt-0.5">{postPlaceCatEmoji(pl.category)} {pl.category.charAt(0).toUpperCase() + pl.category.slice(1)}</p>}
                              </div>
                              <button
                                className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 active:opacity-70 transition-opacity"
                                onClick={async e => {
                                  e.stopPropagation();
                                  if (!userId) return;
                                  if (isSaved) {
                                    await unsavePlace(userId, pl.id);
                                    setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(pl.id); return n; });
                                    setRealSavedPlaces(prev => prev.filter(p => p.id !== pl.id));
                                  } else {
                                    await savePlace(userId, pl.id);
                                    setRealSavedPlaceIds(prev => new Set(prev).add(pl.id));
                                    setRealSavedPlaces(prev => [...prev, { id: pl.id, postId: selectedSavedPost.id, name: pl.name, category: pl.category, neighborhood: pl.neighborhood ?? '', city: pl.city, country: pl.country ?? '', photoUrl: pl.photoUrl ?? '', lat: pl.lat ?? null, lng: pl.lng ?? null }]);
                                  }
                                }}
                              >
                                {isSaved
                                  ? <BookmarkCheck size={15} strokeWidth={1.5} className="text-white" />
                                  : <BookmarkPlus size={15} strokeWidth={1.5} className="text-white" />
                                }
                              </button>
                            </div>
                          );
                        });
                    })()}
                  </div>
                </div>
              )}
              {/* Comments */}
              <div className="px-5 pt-4 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-900 mb-3">Comments</p>
                {savedPostCommentSending && savedPostComments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
                )}
                {!savedPostCommentSending && savedPostComments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No comments yet — be the first</p>
                )}
                <div className="space-y-3 mb-4">
                  {savedPostComments.filter(c => !savedBlockedUsers.has(c.userId)).map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      {c.profile?.avatarUrl
                        ? <img src={c.profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />}
                      <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-semibold text-gray-900">{c.profile?.username || c.profile?.name}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.text}</p>
                      </div>
                      {c.userId === userId && (
                        <button onClick={async () => { await deleteComment(c.id); setSavedPostComments(prev => prev.filter(x => x.id !== c.id)); }} className="text-[10px] text-gray-300 flex-shrink-0 mt-2">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pb-4">
                  {userAvatar
                    ? <img src={userAvatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />}
                  <div className="flex-1 flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 gap-2">
                    <input
                      ref={savedPostCommentRef}
                      value={savedPostCommentText}
                      onChange={e => setSavedPostCommentText(e.target.value)}
                      placeholder="Add a comment…"
                      className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder-gray-400"
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && savedPostCommentText.trim() && userId) {
                          const text = savedPostCommentText.trim();
                          setSavedPostCommentText('');
                          const saved = await addComment(userId, selectedSavedPost.id, text);
                          if (saved) setSavedPostComments(prev => [...prev, saved]);
                        }
                      }}
                    />
                    {savedPostCommentText.trim() && (
                      <button
                        onClick={async () => {
                          if (!userId) return;
                          const text = savedPostCommentText.trim();
                          setSavedPostCommentText('');
                          const saved = await addComment(userId, selectedSavedPost.id, text);
                          if (saved) setSavedPostComments(prev => [...prev, saved]);
                        }}
                        className="text-xs font-bold text-gray-900 flex-shrink-0"
                      >Post</button>
                    )}
                  </div>
                </div>
              </div>
              {/* Share bottom sheet */}
              {showSavedPostShare && (
                <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
                  <div className="absolute inset-0 bg-black/40" onClick={() => { setShowSavedPostShare(false); setSavedPostShareSentTo(new Set()); setSavedPostShareSearch(''); setSavedPostShareResults([]); }} />
                  <div className="relative bg-white rounded-t-3xl">
                    <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
                    <div className="flex items-center justify-between px-5 pt-2 pb-3">
                      <h3 className="text-base font-bold text-gray-900">Send to</h3>
                      <button onClick={() => { setShowSavedPostShare(false); setSavedPostShareSentTo(new Set()); setSavedPostShareSearch(''); setSavedPostShareResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                        <X size={14} strokeWidth={2} className="text-gray-500" />
                      </button>
                    </div>
                    <div className="px-5 pb-3">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                        <input
                          autoFocus
                          value={savedPostShareSearch}
                          onChange={e => {
                            const q = e.target.value;
                            setSavedPostShareSearch(q);
                            if (savedPostShareSearchRef.current) clearTimeout(savedPostShareSearchRef.current);
                            if (!q.trim()) { setSavedPostShareResults([]); setSearchingSavedPostShare(false); return; }
                            setSearchingSavedPostShare(true);
                            savedPostShareSearchRef.current = setTimeout(async () => {
                              if (!userId) return;
                              const results = await searchProfiles(q, userId);
                              setSavedPostShareResults(results);
                              setSearchingSavedPostShare(false);
                            }, 300);
                          }}
                          placeholder="Search people..."
                          className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                        />
                        {searchingSavedPostShare && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
                      </div>
                    </div>
                    {(() => {
                      const showSearch = savedPostShareSearch.trim().length > 0;
                      const list = showSearch ? savedPostShareResults : savedPostConversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
                      if (showSearch && savedPostShareResults.length === 0 && !searchingSavedPostShare) {
                        return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
                      }
                      if (!showSearch && savedPostConversations.length === 0) return null;
                      return (
                        <div className="px-3 max-h-44 overflow-y-auto">
                          {list.map(person => {
                            const sent = savedPostShareSentTo.has(person.id);
                            const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                            return (
                              <button
                                key={person.id}
                                onClick={async () => {
                                  if (sent || !userId) return;
                                  const convId = await getOrCreateConversation(userId, person.id);
                                  if (convId) {
                                    const url = `${window.location.origin}/post/${selectedSavedPost.id}`;
                                    await sendMessage(convId, userId, `Check this out on sondrr: ${url}`);
                                    setSavedPostShareSentTo(prev => new Set(prev).add(person.id));
                                  }
                                }}
                                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl active:bg-gray-50 text-left"
                              >
                                {person.avatarUrl
                                  ? <img src={person.avatarUrl} className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0" />
                                  : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{initials}</div>}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
                                  <p className="text-xs text-gray-400 truncate">@{person.username}</p>
                                </div>
                                <div className={`px-5 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${sent ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>
                                  {sent ? 'Sent ✓' : 'Send'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="mt-2 border-t border-gray-100 px-3 pb-10">
                      <button
                        className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50"
                        onClick={async () => {
                          const url = `${window.location.origin}/post/${selectedSavedPost.id}`;
                          if (navigator.share) {
                            try { await navigator.share({ url, title: 'Check this out on sondrr' }); } catch {}
                          } else {
                            navigator.clipboard.writeText(url).catch(() => {});
                          }
                        }}
                      >
                        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Send size={16} strokeWidth={1.5} className="text-gray-700" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Share externally</span>
                      </button>
                      <button
                        className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/post/${selectedSavedPost.id}`).catch(() => {});
                          setSavedPostShareLinkCopied(true);
                          setTimeout(() => setSavedPostShareLinkCopied(false), 1500);
                        }}
                      >
                        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {savedPostShareLinkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{savedPostShareLinkCopied ? 'Link copied!' : 'Copy link'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Post detail bookmark / save sheet */}
              {postDetailSaveSheet && userId && selectedSavedPost && (
                <div className="fixed inset-0 z-[420] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }} onClick={() => { setPostDetailSaveSheet(false); setPostDetailSaveColIds(new Set()); setPostDetailSaveColSaving(new Set()); setPostDetailSaveShowNewTrip(false); setPostDetailSaveNewTripName(''); setPostDetailSavePlanAdded(new Set()); }}>
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="relative bg-white rounded-t-3xl pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
                    <div className="px-4 pt-2 pb-3">
                      <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
                      <p className="text-xs text-gray-400 mt-0.5">Also add {selectedSavedPost.places.length > 0 ? selectedSavedPost.places[0].name.split(',')[0].trim() : 'these places'} to a collection?</p>
                    </div>
                    {/* Collections list — keyed to first place */}
                    <div className="px-4 space-y-2 max-h-48 overflow-y-auto">
                      {colSaveUserCollections.map(col => {
                        const inCol = postDetailSaveColIds.has(col.id);
                        const isSaving = postDetailSaveColSaving.has(col.id);
                        const firstPlace = selectedSavedPost.places[0];
                        return (
                          <button
                            key={col.id}
                            disabled={isSaving}
                            onClick={async () => {
                              if (!firstPlace) return;
                              setPostDetailSaveColSaving(prev => new Set(prev).add(col.id));
                              if (inCol) {
                                await removePlaceFromCollection(col.id, firstPlace.id);
                                setPostDetailSaveColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                              } else {
                                // Add all places in the post to this collection
                                await Promise.all(selectedSavedPost.places.map(pl => addPlaceToCollection(col.id, pl.id, userId)));
                                setPostDetailSaveColIds(prev => new Set(prev).add(col.id));
                              }
                              setPostDetailSaveColSaving(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                            }}
                            className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left"
                          >
                            <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                              <p className="text-xs text-gray-400">{col.placesCount} places</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                              {isSaving ? <Loader2 size={10} className="animate-spin text-white" /> : inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="px-4 pt-3">
                      <button
                        onClick={() => { setNewColName(''); setNewColEmoji(''); setNewColDesc(''); setShowNewCollection(true); }}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Plus size={15} strokeWidth={2} className="text-gray-600" />
                        </div>
                        New collection
                      </button>
                    </div>
                    {/* ── Trips section ── */}
                    <div className="mx-4 border-t border-gray-100 mt-1" />
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
                      {postDetailSavePlans.length === 0 && !postDetailSaveShowNewTrip && (
                        <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
                      )}
                      {postDetailSavePlans.length > 0 && (
                        <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                          {postDetailSavePlans.map(plan => {
                            const added = postDetailSavePlanAdded.has(plan.id);
                            const adding = postDetailSavePlanAdding === plan.id;
                            return (
                              <button
                                key={plan.id}
                                disabled={added || adding}
                                onClick={async () => {
                                  setPostDetailSavePlanAdding(plan.id);
                                  try {
                                    const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                                    const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                                    if (day) {
                                      // Add all places in the post
                                      for (const pl of selectedSavedPost.places) {
                                        await createPlanItem(plan.id, day.id!, {
                                          name: pl.name,
                                          category: pl.category || '',
                                          image_url: pl.photoUrl || '',
                                          time_label: '',
                                          address: [pl.neighborhood, pl.city, pl.country].filter(Boolean).join(', '),
                                          neighborhood: pl.neighborhood || '',
                                          position: day.items.length,
                                          lat: pl.lat ?? null,
                                          lng: pl.lng ?? null,
                                        });
                                      }
                                      setPostDetailSavePlanAdded(prev => new Set(prev).add(plan.id));
                                    }
                                  } finally {
                                    setPostDetailSavePlanAdding(null);
                                  }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                              >
                                <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                                  {plan.coverImage ? <img src={plan.coverImage} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.destination}</p>
                                  {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                                </div>
                                {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                                {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {postDetailSaveShowNewTrip ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={postDetailSaveNewTripName}
                            onChange={e => setPostDetailSaveNewTripName(e.target.value)}
                            placeholder="Trip name…"
                            className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                            onKeyDown={async e => {
                              if (e.key === 'Escape') { setPostDetailSaveShowNewTrip(false); setPostDetailSaveNewTripName(''); }
                              if (e.key === 'Enter' && postDetailSaveNewTripName.trim() && userId) {
                                setPostDetailSaveCreatingTrip(true);
                                const newPlan = await dbCreatePlan(userId, { title: postDetailSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                                if (newPlan) {
                                  const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                                  setPostDetailSavePlans(prev => [converted, ...prev]);
                                  setPlans(prev => [converted, ...prev]);
                                  setPostDetailSaveShowNewTrip(false);
                                  setPostDetailSaveNewTripName('');
                                }
                                setPostDetailSaveCreatingTrip(false);
                              }
                            }}
                          />
                          <button
                            disabled={!postDetailSaveNewTripName.trim() || postDetailSaveCreatingTrip}
                            onClick={async () => {
                              if (!postDetailSaveNewTripName.trim() || !userId) return;
                              setPostDetailSaveCreatingTrip(true);
                              const newPlan = await dbCreatePlan(userId, { title: postDetailSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                              if (newPlan) {
                                const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                                setPostDetailSavePlans(prev => [converted, ...prev]);
                                setPlans(prev => [converted, ...prev]);
                                setPostDetailSaveShowNewTrip(false);
                                setPostDetailSaveNewTripName('');
                              }
                              setPostDetailSaveCreatingTrip(false);
                            }}
                            className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                          >
                            {postDetailSaveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setPostDetailSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                          New trip
                        </button>
                      )}
                    </div>
                    {/* ── Remove from Saved ── */}
                    <div className="mx-4 border-t border-gray-100 mt-1" />
                    <div className="px-4 pt-2 pb-2">
                      <button
                        onClick={async () => {
                          if (!userId) return;
                          for (const pl of selectedSavedPost.places) {
                            await unsavePlace(userId, pl.id);
                            setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(pl.id); return n; });
                            setRealSavedPlaces(prev => prev.filter(p => p.id !== pl.id));
                          }
                          setPostDetailSaveSheet(false);
                          setPostDetailSaveColIds(new Set());
                          setPostDetailSavePlanAdded(new Set());
                          setPostDetailSaveShowNewTrip(false);
                          setPostDetailSaveNewTripName('');
                        }}
                        className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                          <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                        </div>
                        Remove from Saved
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
      })()}
      {activeTab === 'Places' && !userId && (
        <div className="pb-6">
          {savedPlaces.length === 0 && (
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
            return filtered.length === 0 && savedPlaces.length > 0 ? (
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
                      <p className="text-white/70 text-xs mt-0.5">{place.city}</p>
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
        myCollections.length === 0 && dbCollections.length === 0 && dbSubscribedCollections.length === 0 ? (
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">My Collections</p>
              <button onClick={() => { setNewColName(''); setNewColEmoji(''); setNewColDesc(''); setShowNewCollection(true); }} className="flex items-center gap-1.5 text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full">
                <Plus size={12} strokeWidth={2.5} /> New
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {dbCollections.map(col => (
                <div key={col.id} className="cursor-pointer" onClick={() => { setSelectedRealCollection(col); setCollectionOwnerProfile(null); setRealCollectionPlaces([]); setRealCollectionGuides([]); setLoadingRealCollectionPlaces(true); setRealColCollaborators([]); getCollectionCollaborators(col.id).then(collabs => setRealColCollaborators(collabs)); getCollectionPlaces(col.id).then(async p => { const geocoded = await geocodeMissingPlaces(p, GOOGLE_PLACES_KEY); const seen = new Set<string>(); setRealCollectionPlaces(geocoded.filter(pl => { const k = pl.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })); setLoadingRealCollectionPlaces(false); }); getCollectionGuides(col.id).then(setRealCollectionGuides); supabase.from('profiles').select('name, username, avatar_url').eq('id', col.userId).single().then(({ data: op }) => { if (op) setCollectionOwnerProfile({ name: op.name ?? '', username: op.username ?? '', avatarUrl: op.avatar_url ?? null }); }); }}>
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

        </div>
        )
      )}

      {/* Subscribed Tab */}
      {activeTab === 'Guides' && (() => {
        const allFormats = Array.from(new Set(subscribedGuides.map(g => g.format === 'itinerary' ? 'Itinerary' : 'Guide')));
        const allDestinations = Array.from(new Set(subscribedGuides.map(g => g.destination).filter(Boolean))) as string[];
        const chips = ['All', ...allFormats, ...allDestinations];
        const filtered = savedGuidesFilter === 'All' || !savedGuidesFilter
          ? subscribedGuides
          : subscribedGuides.filter(g =>
              g.destination === savedGuidesFilter ||
              (savedGuidesFilter === 'Itinerary' && g.format === 'itinerary') ||
              (savedGuidesFilter === 'Guide' && g.format !== 'itinerary')
            );
        return (
          <div className="pb-6">
            {subscribedGuides.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <span className="text-3xl">📖</span>
                </div>
                <p className="text-slate-800 font-semibold text-base mb-1.5">No saved guides yet</p>
                <p className="text-slate-400 text-sm text-center max-w-[220px]">Tap the bookmark on any guide or itinerary to save it here</p>
              </div>
            ) : (
              <>
                {/* Destination / format chips */}
                {chips.length > 1 && (
                  <div className="flex gap-2 px-4 pt-4 pb-3 overflow-x-auto scrollbar-hide">
                    {chips.map(chip => (
                      <button
                        key={chip}
                        onClick={() => setSavedGuidesFilter(chip === savedGuidesFilter ? 'All' : chip)}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          (chip === 'All' && (!savedGuidesFilter || savedGuidesFilter === 'All')) || chip === savedGuidesFilter
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                {/* Guide grid */}
                <div className="px-4 grid grid-cols-2 gap-3">
                  {filtered.map(guide => (
                    <button
                      key={guide.id}
                      className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform bg-gray-200"
                      style={{ aspectRatio: '3/4' }}
                      onClick={() => setSelectedGuide(guide)}
                    >
                      {guide.coverUrl
                        ? <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
                        : <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-[10px] font-semibold text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          {guide.format === 'itinerary' ? 'Itinerary' : 'Guide'}
                        </span>
                      </div>
                      <button
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center active:scale-90 transition-transform z-10"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!userId) return;
                          setSavedGuideColLoading(true);
                          if (!savedSubscribedGuideIds.has(guide.id)) {
                            subscribeToGuide(userId, guide.id);
                            setSavedSubscribedGuideIds(prev => new Set(prev).add(guide.id));
                          }
                          const ids = await getGuideCollectionIds(guide.id, userId);
                          setSavedGuideColIds(ids);
                          setSavedGuideColSheet(guide);
                          setSavedGuideColLoading(false);
                        }}
                      >
                        {savedGuideColLoading && savedGuideColSheet?.id === guide.id
                          ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-white" />
                          : savedSubscribedGuideIds.has(guide.id)
                            ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                            : <Bookmark size={14} strokeWidth={1.5} className="text-white" />}
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-bold text-sm leading-tight line-clamp-2">{guide.title}</p>
                        <p className="text-white/65 text-[11px] mt-1 truncate">
                          {[guide.destination, guide.places?.length ? `${guide.places.length} places` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Trips Tab */}
      {activeTab === 'Trips' && (
        plansLoading ? (
          <div className="px-4 pt-8 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) :
        plans.length === 0 ? (
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
              <p className="text-sm font-bold text-gray-900 mb-3">Invited to</p>
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
              <p className="text-sm font-bold text-gray-900 mb-3">Want to do / see</p>
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
              <p className="text-sm font-bold text-gray-900 mb-3">Coming up</p>
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
              <p className="text-sm font-bold text-gray-900 mb-3">Past</p>
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
        <div className="fixed inset-0 z-[220] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewCollection(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                disabled={!newColName.trim() || newColSaving || newColCoverUploading}
                onClick={async () => {
                  if (!newColName.trim() || !userId) return;
                  setNewColSaving(true);
                  const { data } = await createCollection(userId, { name: newColName.trim(), emoji: newColEmoji || '', description: newColDesc.trim(), cover_image_url: newColCoverUrl });
                  if (data) { setDbCollections(prev => [data, ...prev]); setColSaveUserCollections(prev => [data, ...prev]); }
                  setNewColSaving(false);
                  setNewColCoverUrl(null);
                  setNewColEmoji('');
                  setShowNewCollection(false);
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >
                {newColSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
            <div className="px-4 space-y-3 pb-6">
              {/* Cover image */}
              <label className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden block">
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file || !userId) return;
                  setNewColCoverUploading(true);
                  const path = `collections/${userId}/${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
                  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                  if (!error) setNewColCoverUrl(getPublicUrl('avatars', path));
                  setNewColCoverUploading(false);
                  e.target.value = '';
                }} />
                {newColCoverUrl
                  ? <img src={newColCoverUrl} className="w-full h-full object-cover" />
                  : newColCoverUploading
                    ? <Loader2 size={20} className="text-gray-400 animate-spin" />
                    : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Add cover photo</span></div>
                }
                {newColCoverUrl && !newColCoverUploading && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              {/* Name */}
              <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="Collection name" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              {/* Description */}
              <input value={newColDesc} onChange={e => setNewColDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
            </div>
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
            <p className="text-sm font-bold text-gray-900 mb-4">Edit event</p>
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
                      const acData = await gAutocomplete({ input: query, languageCode: 'en', sessionToken: coverImageSessionTokenRef.current });
                      const placeId = acData?.suggestions?.[0]?.placePrediction?.placeId;
                      if (placeId) {
                        const coverToken = coverImageSessionTokenRef.current;
                        coverImageSessionTokenRef.current = crypto.randomUUID();
                        const detData = await gPlaceDetails(placeId, 'photos', coverToken, TTL.PHOTOS);
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
                                const data = await gAutocomplete({ input: val.trim(), languageCode: 'en', sessionToken: newEventAddressSessionTokenRef.current });
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
                            const eventToken = newEventAddressSessionTokenRef.current;
                            newEventAddressSessionTokenRef.current = crypto.randomUUID();
                            try {
                              const data = await gPlaceDetails(s.placeId, 'addressComponents,photos', eventToken, TTL.PHOTOS);
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

            {/* Import from collection — trips only, destination-matched */}
            {(() => {
              const dest = (newPlanName + ' ' + newPlanLocation).toLowerCase().trim();
              const destWords = dest.split(/\s+/).filter(w => w.length > 2);
              const matchedCols = destWords.length === 0 ? [] : dbCollections.filter(col => {
                const colName = col.name.toLowerCase();
                return destWords.some(w => colName.includes(w)) || destWords.some(w => col.name.toLowerCase().split(/\s+/).some(cw => cw.includes(w)));
              });
              if (newPlanType !== 'trip' || matchedCols.length === 0) return null;
              return (
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-900 mb-1">Import inspiration from a collection?</p>
                <p className="text-xs text-gray-400 mb-3">Places will be added to your plan as brainstorm items.</p>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {matchedCols.map(col => {
                    const selected = newPlanImportCollection?.id === col.id;
                    return (
                      <div key={col.id} className="contents">
                      <button
                        onClick={async () => {
                          if (selected) {
                            setNewPlanImportCollection(null);
                            setNewPlanImportPlaces([]);
                            setNewPlanImportSelectedIds(new Set());
                          } else {
                            setNewPlanImportCollection(col);
                            setLoadingImportPlaces(true);
                            const places = await getCollectionPlaces(col.id);
                            setNewPlanImportPlaces(places);
                            setNewPlanImportSelectedIds(new Set(places.map(p => p.id)));
                            setLoadingImportPlaces(false);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                          {col.coverImageUrl
                            ? <img src={col.coverImageUrl} className="w-full h-full object-cover" alt="" />
                            : <span className="text-lg">{col.emoji || '🗂️'}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                          <p className="text-xs text-gray-400">{col.placesCount} places</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                          {selected && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </button>

                      {/* Place checklist — shown when this collection is selected */}
                      {selected && (
                        <div className="ml-3 mt-1 mb-2 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                          {loadingImportPlaces ? (
                            <div className="flex items-center justify-center py-5 gap-2">
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                              <span className="text-xs text-gray-400">Loading places…</span>
                            </div>
                          ) : newPlanImportPlaces.length === 0 ? (
                            <p className="text-xs text-gray-400 px-4 py-3">No places in this collection yet.</p>
                          ) : (
                            <>
                              {/* Select all / deselect all */}
                              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                                <span className="text-xs text-gray-500 font-medium">{newPlanImportSelectedIds.size} of {newPlanImportPlaces.length} selected</span>
                                <button
                                  onClick={() => {
                                    if (newPlanImportSelectedIds.size === newPlanImportPlaces.length) {
                                      setNewPlanImportSelectedIds(new Set());
                                    } else {
                                      setNewPlanImportSelectedIds(new Set(newPlanImportPlaces.map(p => p.id)));
                                    }
                                  }}
                                  className="text-xs font-semibold text-gray-900"
                                >
                                  {newPlanImportSelectedIds.size === newPlanImportPlaces.length ? 'Deselect all' : 'Select all'}
                                </button>
                              </div>
                              {newPlanImportPlaces.map(place => {
                                const checked = newPlanImportSelectedIds.has(place.id);
                                return (
                                  <button
                                    key={place.id}
                                    onClick={() => {
                                      setNewPlanImportSelectedIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(place.id)) next.delete(place.id);
                                        else next.add(place.id);
                                        return next;
                                      });
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-100 last:border-0 active:bg-gray-100"
                                  >
                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                                      {place.photoUrl
                                        ? <img src={place.photoUrl} className="w-full h-full object-cover" alt="" />
                                        : <div className="w-full h-full flex items-center justify-center text-base">{place.category === 'restaurant' ? '🍽️' : place.category === 'cafe' ? '☕' : place.category === 'hotel' ? '🏨' : place.category === 'attraction' ? '🎡' : '📍'}</div>
                                      }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-900 truncate">{place.name}</p>
                                      {(place.neighborhood || place.city) && (
                                        <p className="text-xs text-gray-400 truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ')}</p>
                                      )}
                                    </div>
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                                      {checked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => {
                      setNewPlanImportCollection(null);
                      setNewPlanImportPlaces([]);
                      setNewPlanImportSelectedIds(new Set());
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-2xl text-sm transition-colors ${!newPlanImportCollection ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-400'}`}
                  >
                    Skip — start fresh
                  </button>
                </div>
              </div>
              );
            })()}

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
                // Import selected places from collection into a Brainstorm day
                if (newPlanImportCollection && userId && newPlan.id && !newPlan.id.startsWith('plan-')) {
                  // Use already-loaded places if available, otherwise fetch
                  const colPlaces = newPlanImportPlaces.length > 0
                    ? newPlanImportPlaces
                    : await getCollectionPlaces(newPlanImportCollection.id);
                  // Filter to only user-selected places
                  const toImport = newPlanImportSelectedIds.size > 0
                    ? colPlaces.filter(p => newPlanImportSelectedIds.has(p.id))
                    : colPlaces;
                  if (toImport.length > 0) {
                    const brainstormDay = await createPlanDay(newPlan.id, 'Brainstorm', 0);
                    if (brainstormDay) {
                      for (let i = 0; i < toImport.length; i++) {
                        const pl = toImport[i];
                        await createPlanItem(newPlan.id, brainstormDay.id, {
                          name: pl.name,
                          category: pl.category || '',
                          image_url: pl.photoUrl || '',
                          time_label: '',
                          address: [pl.neighborhood, pl.city, pl.country].filter(Boolean).join(', '),
                          neighborhood: pl.neighborhood || '',
                          position: i,
                          lat: pl.lat ?? null,
                          lng: pl.lng ?? null,
                        });
                      }
                    }
                  }
                }

                setPlans(prev => [newPlan, ...prev]);
                setNewPlanName(''); setNewPlanDest(''); setNewPlanDates('');
                setNewPlanDesc(''); setNewPlanLocation(''); setNewPlanCoverImage(''); setNewPlanCollabs([]); setNewPlanCollabInput('');
                setDateRange(undefined); setEventSingleDate(undefined); setNewEventAddress(''); setNewEventNeighborhood(''); setNewEventCategory('');
                setNewEventTimeStart(''); setNewEventTimeEnd(''); setNewEventNotes(''); setNewEventInviteLink(''); setNewEventCollabs([]); setNewEventCollabInput('');
                setNewPlanImportCollection(null);
                setNewPlanImportPlaces([]);
                setNewPlanImportSelectedIds(new Set());
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

      {/* Add to Collection / Trips / Remove sheet (All Saved place card) */}
      {addToColPlace && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setAddToColPlace(null); setAddToColShowNewTrip(false); setAddToColNewTripName(''); setAddToColPlanAdded(new Set()); }} />
          <div className="relative bg-white rounded-t-3xl pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            {/* Header */}
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add {addToColPlace.name.split(',')[0].trim()} to a collection?</p>
            </div>
            {/* Collections list */}
            <div className="px-4 space-y-2 max-h-48 overflow-y-auto">
              {addToColLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : dbCollections.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">No collections yet</p>
                  <button
                    onClick={() => { setAddToColPlace(null); setShowNewCollection(true); }}
                    className="mt-3 text-sm font-semibold text-gray-900 underline underline-offset-2"
                  >Create one</button>
                </div>
              ) : dbCollections.map(col => {
                const isIn = addToColIds.has(col.id);
                const isSaving = addToColSaving.has(col.id);
                return (
                  <button
                    key={col.id}
                    disabled={isSaving}
                    onClick={async () => {
                      if (!userId) return;
                      setAddToColSaving(prev => new Set(prev).add(col.id));
                      if (isIn) {
                        await removePlaceFromCollection(col.id, addToColPlace.id);
                        setAddToColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                      } else {
                        await addPlaceToCollection(col.id, addToColPlace.id, userId);
                        setAddToColIds(prev => new Set(prev).add(col.id));
                      }
                      setAddToColSaving(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {col.coverImageUrl
                        ? <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">{col.emoji || '🗂️'}</div>
                      }
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} places</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors border-2 ${isIn ? 'bg-gray-900 border-gray-900' : 'border-gray-200'}`}>
                      {isSaving
                        ? <Loader2 size={12} className="animate-spin text-white" />
                        : isIn && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      }
                    </div>
                  </button>
                );
              })}
            </div>
            {/* New collection shortcut */}
            <div className="px-4 pt-3">
              <button
                onClick={() => { setAddToColPlace(null); setShowNewCollection(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Plus size={15} strokeWidth={2} className="text-gray-600" />
                </div>
                New collection
              </button>
            </div>
            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {addToColPlans.length === 0 && !addToColShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {addToColPlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {addToColPlans.map(plan => {
                    const added = addToColPlanAdded.has(plan.id);
                    const adding = addToColPlanAdding === plan.id;
                    const place = addToColPlace;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          setAddToColPlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              await createPlanItem(plan.id, day.id!, {
                                name: place.name,
                                category: place.category || '',
                                image_url: place.photoUrl || '',
                                time_label: '',
                                address: [place.neighborhood, place.city, place.country].filter(Boolean).join(', '),
                                neighborhood: place.neighborhood || '',
                                position: day.items.length,
                                lat: place.lat ?? null,
                                lng: place.lng ?? null,
                              });
                              setAddToColPlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setAddToColPlanAdding(null);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                          {plan.coverImage ? <img src={plan.coverImage} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.destination}</p>
                          {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                        </div>
                        {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                        {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {addToColShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={addToColNewTripName}
                    onChange={e => setAddToColNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setAddToColShowNewTrip(false); setAddToColNewTripName(''); }
                      if (e.key === 'Enter' && addToColNewTripName.trim() && userId) {
                        setAddToColCreatingTrip(true);
                        const newPlan = await dbCreatePlan(userId, { title: addToColNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) {
                          const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                          setAddToColPlans(prev => [converted, ...prev]);
                          setPlans(prev => [converted, ...prev]);
                          setAddToColShowNewTrip(false);
                          setAddToColNewTripName('');
                        }
                        setAddToColCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!addToColNewTripName.trim() || addToColCreatingTrip}
                    onClick={async () => {
                      if (!addToColNewTripName.trim() || !userId) return;
                      setAddToColCreatingTrip(true);
                      const newPlan = await dbCreatePlan(userId, { title: addToColNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) {
                        const converted: Trip = { id: newPlan.id, destination: newPlan.title, country: newPlan.country, dates: newPlan.dates, coverImage: newPlan.coverImageUrl, status: newPlan.status as Trip['status'], days: [], description: newPlan.description };
                        setAddToColPlans(prev => [converted, ...prev]);
                        setPlans(prev => [converted, ...prev]);
                        setAddToColShowNewTrip(false);
                        setAddToColNewTripName('');
                      }
                      setAddToColCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {addToColCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setAddToColShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>
            {/* ── Remove from Saved ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!userId || !addToColPlace) return;
                  await unsavePlace(userId, addToColPlace.id);
                  setRealSavedPlaceIds(prev => { const n = new Set(prev); n.delete(addToColPlace.id); return n; });
                  setRealSavedPlaces(prev => prev.filter(p => p.id !== addToColPlace.id));
                  setAddToColPlace(null);
                  setAddToColIds(new Set());
                  setAddToColPlanAdded(new Set());
                  setAddToColShowNewTrip(false);
                  setAddToColNewTripName('');
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish as Guide sheet */}
      {showPublishGuide && (() => {
        const trip: Trip | null = selectedTrip;
        if (!trip) return null;
        return (
          <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPublishGuide(false)} />
            <div className="relative bg-white rounded-t-3xl pb-8">
              <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100">
                <p className="text-base font-bold text-gray-900">Publish as Guide</p>
                <button onClick={() => setShowPublishGuide(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  <X size={14} strokeWidth={2} className="text-gray-600" />
                </button>
              </div>
              <div className="px-5 pt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Guide title</p>
                  <input
                    value={publishGuideTitle}
                    onChange={e => setPublishGuideTitle(e.target.value)}
                    placeholder="e.g. 48 Hours in Lisbon"
                    className="w-full text-sm text-gray-900 bg-gray-100 rounded-xl px-3 py-2.5 outline-none placeholder-gray-400"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Description (optional)</p>
                  <textarea
                    value={publishGuideDesc}
                    onChange={e => setPublishGuideDesc(e.target.value)}
                    placeholder="Tell people what makes this trip special…"
                    rows={3}
                    className="w-full text-sm text-gray-900 bg-gray-100 rounded-xl px-3 py-2.5 outline-none placeholder-gray-400 resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400">Publishing makes this itinerary visible to everyone on Sondrr.</p>
                <button
                  disabled={!publishGuideTitle.trim() || publishingGuide || !userId}
                  onClick={async () => {
                    const t = selectedTrip as (Trip | null);
                    if (!publishGuideTitle.trim() || !userId || !t) return;
                    setPublishingGuide(true);
                    const coverUrl = t.coverImage || t.days.flatMap((d: TripDay) => d.items).find((i: TripItem) => i.image)?.image;
                    const id = await createGuide({
                      userId: userId,
                      planId: t.id,
                      title: publishGuideTitle.trim(),
                      destination: t.destination,
                      description: publishGuideDesc.trim() || undefined,
                      coverUrl: coverUrl || undefined,
                    });
                    setPublishingGuide(false);
                    if (id) {
                      getUserGuides(userId).then(setMyGuides);
                      setShowPublishGuide(false);
                    }
                  }}
                  className="w-full py-3 rounded-2xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40"
                >
                  {publishingGuide ? 'Publishing…' : 'Publish Guide'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Guide → Save to Collection sheet */}
      {savedGuideColSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }} onClick={() => { setSavedGuideColSheet(null); setSavedGuideColIds(new Set()); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
              {dbCollections.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No collections yet — create one below</p>
              )}
              {dbCollections.map(col => {
                const inCol = savedGuideColIds.has(col.id);
                return (
                  <button key={col.id} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                    onClick={async () => {
                      if (!userId) return;
                      if (inCol) {
                        setSavedGuideColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        await removeGuideFromCollection(col.id, savedGuideColSheet.id);
                        const remaining = new Set(savedGuideColIds); remaining.delete(col.id);
                        if (remaining.size === 0) { unsubscribeFromGuide(userId, savedGuideColSheet.id); setSavedSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(savedGuideColSheet.id); return n; }); setSubscribedGuides(prev => prev.filter(g => g.id !== savedGuideColSheet.id)); }
                      } else {
                        setSavedGuideColIds(prev => new Set(prev).add(col.id));
                        await addGuideToCollection(col.id, savedGuideColSheet.id, userId);
                        if (!savedSubscribedGuideIds.has(savedGuideColSheet.id)) {
                          subscribeToGuide(userId, savedGuideColSheet.id);
                          setSavedSubscribedGuideIds(prev => new Set(prev).add(savedGuideColSheet.id));
                        }
                      }
                    }}
                  >
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} items</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 pt-3">
              <button onClick={() => setShowNewColSave(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>
            <div className="mx-4 border-t border-gray-100" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!userId || !savedGuideColSheet) return;
                  unsubscribeFromGuide(userId, savedGuideColSheet.id);
                  setSavedSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(savedGuideColSheet.id); return n; });
                  setSubscribedGuides(prev => prev.filter(g => g.id !== savedGuideColSheet.id));
                  setSavedGuideColSheet(null);
                  setSavedGuideColIds(new Set());
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}
      {savedActionModal && (
        <ActionModal
          avatarUrl={savedActionModal.avatarUrl}
          iconType={savedActionModal.iconType}
          title={savedActionModal.title}
          subtitle={savedActionModal.subtitle}
          confirmLabel={savedActionModal.confirmLabel}
          confirmVariant={savedActionModal.confirmVariant}
          onConfirm={savedActionModal.onConfirm}
          onCancel={() => setSavedActionModal(null)}
        />
      )}
    </div>
  );
}
