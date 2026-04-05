import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UserPlus, Menu, MapPin, BadgeCheck, ChevronRight, Bell, Mail, ArrowLeft, Heart, MessageCircle, Bookmark, BookmarkCheck, Map, Settings, LogOut, Edit3, Share2, Star, Plus, X, Check, Send, Search, GripVertical, Globe } from 'lucide-react';
import Notifications, { getUnreadCount, markAsSeen } from './Notifications';
import { currentUser } from '../data/mockData';
import type { Place, AppUser } from '../types';
import BookingSheet from '../components/BookingSheet';
import ImageCarousel from '../components/ImageCarousel';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import { supabase, getPublicUrl, getUserPosts, updateProfile, getFollowerProfiles, getFollowingProfiles, getFollowCounts, getUserCollections, createCollection, updateCollection, deleteCollection, getLikedPosts, getSavedPosts, likePost, unlikePost, savePost, unsavePost, getPostLikeCounts, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, getCollectionPlaces, geocodeMissingPlaces, getCollectionCollaborators, addCollaborator, removeCollaborator, getSharedCollections, getSubscribedCollections, searchProfiles, deletePostPlace, deletePost, updatePostCaption, reorderPostPlaces, updatePostOrder, savePlace, unsavePlace, getSavedPlaceIds, getNotifications, getPostComments, addComment, deleteComment, getPostCollaborators, addPostCollaborator, removePostCollaborator, updatePostPlace, getUserGuides, deleteGuide, type RealPost, type RealPostPlace, type FollowProfile, type RealCollection, type CollectionCollaborator, type PostComment, type PostCollaborator, type Guide } from '../lib/supabase';
import { googleTypesToCategory } from '../lib/placeUtils';
import PlaceSearch from '../components/PlaceSearch';
import GuideDetail from '../components/GuideDetail';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington DC',
};

function fixAndDeduplicatePlaces(places: RealPostPlace[]): RealPostPlace[] {
  // Fix US state abbreviations stored as city
  const fixed = places.map(pl => {
    const city = (pl.city ?? '').trim();
    if (/^[A-Z]{2}$/.test(city) && US_STATES[city]) {
      const fullName = US_STATES[city];
      supabase.from('post_places').update({ city: fullName }).eq('id', pl.id);
      return { ...pl, city: fullName };
    }
    return pl;
  });
  // Deduplicate by name — keep first occurrence
  const seen = new Set<string>();
  return fixed.filter(pl => {
    const key = pl.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MapView = lazy(() => import('../components/MapView'));

type ProfileTab = 'Posts' | 'Map' | 'Collections' | 'Guides';

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
};

function SortablePostCell({ post, isDraggingAny, onClick, likeCount }: { post: RealPost; isDraggingAny: boolean; onClick: () => void; likeCount?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  const firstImage = post.places.map(p => p.photoUrl).find(url => url && url.trim());
  if (!firstImage) return null;
  const collabs = (post.collaborators ?? []).slice(0, 2);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDraggingAny) onClick(); }}
      className="aspect-square bg-white relative cursor-pointer touch-manipulation overflow-hidden"
    >
      <img src={firstImage} alt="" className="w-full h-full object-cover" draggable={false} onError={e => { (e.currentTarget.closest('[class*="aspect-square"]') as HTMLElement | null)?.style && ((e.currentTarget.closest('[class*="aspect-square"]') as HTMLElement).style.display = 'none'); }} />
      {isDragging && <div className="absolute inset-0 ring-2 ring-gray-900 ring-inset rounded-sm" />}
      {/* Multi-place indicator */}
      {post.places.length > 1 && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
          <div className="grid grid-cols-2 gap-px w-2.5 h-2.5">
            <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
            <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
          </div>
        </div>
      )}
      {/* Bottom bar: like count + collab avatars */}
      {((likeCount ?? 0) > 0 || collabs.length > 0) && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-1.5 py-1 bg-gradient-to-t from-black/50 to-transparent">
          {(likeCount ?? 0) > 0 ? (
            <span className="text-white text-[10px] font-semibold flex items-center gap-0.5">
              <Heart size={9} className="fill-white text-white" />
              {likeCount}
            </span>
          ) : <span />}
          {collabs.length > 0 && (
            <div className="flex -space-x-1">
              {collabs.map(c => (
                c.avatarUrl
                  ? <img key={c.id} src={c.avatarUrl} className="w-4 h-4 rounded-full border border-white/60 object-cover" />
                  : <div key={c.id} className="w-4 h-4 rounded-full border border-white/60 bg-gray-400 flex items-center justify-center text-[7px] font-bold text-white">{c.name[0]?.toUpperCase()}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortableEditPlace({ place, i, total, isExpanded, onToggle, onRemove, onUpdateField, onSelectPlace, categoryEmojiMap }: {
  place: RealPostPlace; i: number; total: number; isExpanded: boolean;
  onToggle: () => void; onRemove: () => void;
  onUpdateField: (field: keyof RealPostPlace, value: string) => void;
  onSelectPlace: (result: { name: string; neighborhood: string; city: string; country: string; category: string }) => void;
  categoryEmojiMap: Record<string, string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: place.id });
  const emoji = categoryEmojiMap[place.category] ?? '';
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="border-b border-gray-100"
    >
      <div className="flex items-center gap-3 px-5 py-3.5">
        {/* Drag handle */}
        <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing flex-shrink-0 p-1 -ml-1" style={{ touchAction: 'none' }}>
          <GripVertical size={18} className="text-gray-300" />
        </button>
        {/* Photo + category badge */}
        <div className="relative flex-shrink-0">
          {place.photoUrl
            ? <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-2xl object-cover" />
            : <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">{emoji || '📍'}</div>
          }
          {emoji && (
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center text-xs">{emoji}</div>
          )}
        </div>
        {/* Info */}
        <button className="flex-1 min-w-0 text-left" onClick={onToggle}>
          <p className="text-[15px] font-semibold text-gray-900 truncate leading-tight">{place.name || <span className="text-gray-400 italic text-sm">Unnamed place</span>}</p>
          <p className="text-[13px] text-gray-400 truncate mt-0.5">{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}</p>
          <p className="text-[11px] text-gray-300 mt-0.5">{isExpanded ? 'Tap to collapse' : 'Tap to edit'}</p>
        </button>
        {/* Remove */}
        <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 flex-shrink-0">
          <X size={12} strokeWidth={2} className="text-gray-500" />
        </button>
      </div>
      {/* Expanded editor */}
      {isExpanded && (
        <div className="bg-gray-50 px-5 py-4 space-y-3">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3">
            <MapPin size={14} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
            <input
              value={place.name}
              onChange={e => onUpdateField('name', e.target.value)}
              placeholder="Place name"
              className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none"
            />
          </div>
          <PlaceSearch
            placeholder="Search Google Maps to update…"
            onSelect={onSelectPlace}
          />
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
            {([
              ['restaurant','🍽️','Restaurant'],['cafe','☕','Cafe'],['treats','🍰','Treats'],
              ['bar','🍸','Bar'],['nightlife','🎵','Nightlife'],['food','🍕','Food'],
              ['hotel','🏨','Stay'],['landmark','🏛️','Landmark'],['art','🎨','Art'],
              ['nature','🌿','Nature'],['beach','🏖️','Beach'],['shop','🛍️','Shop'],
              ['experience','🎡','Experience'],['neighbourhood','🏘️','Neighbourhood'],
              ['sports','🎾','Sports'],['wellness','💆','Wellness'],
              ['event','🎟️','Event'],['flight','✈️','Flight'],['transport','🚗','Transport'],
            ] as [string, string, string][]).map(([cat, em, label]) => (
              <button
                key={cat}
                onClick={() => onUpdateField('category', cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${place.category === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-gray-200'}`}
              >
                {em} {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile({ onOpenMessages, appUser, onLogout, onNavigate, onProfileUpdate, onFollowingCountChange }: { onOpenMessages?: (targetUserId?: string) => void; appUser?: AppUser; onLogout?: () => void; onNavigate?: (tab: import('../types').Tab) => void; onProfileUpdate?: (updates: { name: string; username: string; avatar: string | null; bio: string; location: string; website?: string }) => void; onFollowingCountChange?: (delta: number) => void }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [showMenu, setShowMenu] = useState(false);
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null);
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showCreatorOnboard, setShowCreatorOnboard] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [bookingPlace, setBookingPlace] = useState<Place | null>(null);
  const [realPosts, setRealPosts] = useState<RealPost[]>([]);
  const [realFollowerCount, setRealFollowerCount] = useState(0);
  const [realFollowingCount, setRealFollowingCount] = useState(0);
  const [followerProfiles, setFollowerProfiles] = useState<FollowProfile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<FollowProfile[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [unfollowTarget, setUnfollowTarget] = useState<FollowProfile | null>(null);
  const [unfollowing, setUnfollowing] = useState(false);
  const [listFollowingIds, setListFollowingIds] = useState<Set<string>>(new Set());
  const [listFollowPending, setListFollowPending] = useState<string | null>(null);
  const [selectedRealPost, setSelectedRealPost] = useState<RealPost | null>(null);
  const [postPlaceSavedIds, setPostPlaceSavedIds] = useState<Set<string>>(new Set());
  const [showPostMap, setShowPostMap] = useState(false);
  const [geocodingPostMap, setGeocodingPostMap] = useState(false);
  const [postCommentText, setPostCommentText] = useState('');
  const [postComments, setPostComments] = useState<import('../lib/supabase').PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const postCommentInputRef = useRef<HTMLInputElement>(null);
  const [showPostShareSheet, setShowPostShareSheet] = useState(false);
  const [postSentTo, setPostSentTo] = useState<Set<string>>(new Set());
  const [showEditPost, setShowEditPost] = useState(false);
  const [isDraggingPost, setIsDraggingPost] = useState(false);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
  );
  const handlePostDragEnd = useCallback(async (event: DragEndEvent) => {
    setIsDraggingPost(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRealPosts(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id);
      const newIndex = prev.findIndex(p => p.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      updatePostOrder(reordered.map(p => p.id));
      return reordered;
    });
  }, []);
  const [editPostCaption, setEditPostCaption] = useState('');
  const [editPostPlaces, setEditPostPlaces] = useState<RealPostPlace[]>([]);
  const [editPostHashtags, setEditPostHashtags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [savingEditPost, setSavingEditPost] = useState(false);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const [realCollections, setRealCollections] = useState<RealCollection[]>([]);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [selectedRealCollection, setSelectedRealCollection] = useState<RealCollection | null>(null);
  const [realCollectionPlaces, setRealCollectionPlaces] = useState<RealPostPlace[]>([]);
  const [loadingCollectionPlaces, setLoadingCollectionPlaces] = useState(false);
  const [showEditCollection, setShowEditCollection] = useState(false);
  const [editColName, setEditColName] = useState('');
  const [editColDesc, setEditColDesc] = useState('');
  const [editColCoverFile, setEditColCoverFile] = useState<File | null>(null);
  const [editColCoverPreview, setEditColCoverPreview] = useState<string | null>(null);
  const [savingEditCollection, setSavingEditCollection] = useState(false);
  const [showAddPlacesSheet, setShowAddPlacesSheet] = useState(false);
  const [addPlacesSearch, setAddPlacesSearch] = useState('');
  const [colPlaceIds, setColPlaceIds] = useState<Set<string>>(new Set());
  const [colFilter, setColFilter] = useState('all');
  const [mapSearch, setMapSearch] = useState('');
  const profileMapRef = useRef<import('leaflet').Map | null>(null);
  const [showColMap, setShowColMap] = useState(true);
  const [addToColPlace, setAddToColPlace] = useState<{ id: string; name: string } | null>(null);
  const [placeInCollections, setPlaceInCollections] = useState<Set<string>>(new Set());
  const [loadingPlaceCollections, setLoadingPlaceCollections] = useState(false);
  const [showInlineNewCol, setShowInlineNewCol] = useState(false);
  const [showSaveAllPicker, setShowSaveAllPicker] = useState(false);
  const [saveAllColIds, setSaveAllColIds] = useState<Set<string>>(new Set());
  const [inlineNewColName, setInlineNewColName] = useState('');
  const [savingInlineCol, setSavingInlineCol] = useState(false);
  const [likedRealPosts, setLikedRealPosts] = useState<Set<string>>(new Set());
  const [savedRealPosts, setSavedRealPosts] = useState<Set<string>>(new Set());
  const [realPostLikeCounts, setRealPostLikeCounts] = useState<Record<string, number>>({});
  const [newColName, setNewColName] = useState('');
  const [newColEmoji, setNewColEmoji] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColCoverFile, setNewColCoverFile] = useState<File | null>(null);
  const [newColCoverPreview, setNewColCoverPreview] = useState<string | null>(null);
  const [savingCollection, setSavingCollection] = useState(false);
  const [sharedCollections, setSharedCollections] = useState<RealCollection[]>([]);
  const [userGuides, setUserGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [collectionCollaborators, setCollectionCollaborators] = useState<CollectionCollaborator[]>([]);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<FollowProfile[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [pendingCollabIds, setPendingCollabIds] = useState<Set<string>>(new Set());
  const [postCollaborators, setPostCollaborators] = useState<PostCollaborator[]>([]);
  const [postCollabSearch, setPostCollabSearch] = useState('');
  const [postCollabResults, setPostCollabResults] = useState<FollowProfile[]>([]);
  const [invitingPostCollab, setInvitingPostCollab] = useState<string | null>(null);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('curio_notifs') !== 'false');

  useEffect(() => {
    if (appUser && !appUser.isDemo) {
      getNotifications(appUser.id).then(notifs => {
        setUnreadCount(getUnreadCount(appUser.id, notifs));
      });
    }
  }, [appUser?.id]);

  useEffect(() => {
    if (appUser && !appUser.isDemo) {
      getUserPosts(appUser.id).then(async posts => {
        setRealPosts(posts);
        if (posts.length > 0) {
          getPostLikeCounts(posts.map(p => p.id)).then(setRealPostLikeCounts);
        }
        const GKEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

        // Auto-enrich any places missing neighbourhood, city, or category — or with a 2-letter state abbreviation stored as city
        const isAbbreviation = (s: string) => /^[A-Z]{2}$/.test((s ?? '').trim());
        const missingData = posts.flatMap(p => p.places.filter(pl => !pl.neighborhood || !pl.city || !pl.category || isAbbreviation(pl.city)));
        if (missingData.length > 0) {
          // Normalize city abbreviations that Google Places doesn't recognise
          const normalCity = (c: string) => ({ cdmx: 'Mexico City', 'ciudad de mexico': 'Mexico City', 'ciudad de méxico': 'Mexico City', nyc: 'New York City', la: 'Los Angeles', sf: 'San Francisco', dc: 'Washington DC' }[c?.toLowerCase()] ?? c);
          const searchPlace = async (textQuery: string) => {
            const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'places.addressComponents,places.types' },
              body: JSON.stringify({ textQuery, languageCode: 'en' }),
            });
            const d = await r.json();
            return d.places?.[0] ?? null;
          };
          // Run all enrichments in parallel
          const enrichResults = await Promise.all(missingData.map(async (pl) => {
            if (!pl.name) return null;
            try {
              const city = normalCity(pl.city);
              // Try progressively simpler queries until one works
              let place = await searchPlace([pl.name, city, pl.country].filter(Boolean).join(', '))
                ?? await searchPlace([pl.name, pl.country].filter(Boolean).join(', '))
                ?? await searchPlace(pl.name);
              if (!place) return null;
              const comps: { types: string[]; longText?: string; shortText?: string }[] = place.addressComponents ?? [];
              const types: string[] = place.types ?? [];
              const find = (...t: string[]) => { const c = comps.find(c => t.some(x => c.types?.includes(x))); return c ? (c.longText || c.shortText || '') : ''; };
              const findLong = (...t: string[]) => { const c = comps.find(c => t.some(x => c.types?.includes(x))); return c ? (c.longText || '') : ''; };
              const neighborhood = find('sublocality_level_1') || find('sublocality_level_2') || find('neighborhood') || find('sublocality') || find('administrative_area_level_2');
              const resolvedCity = find('postal_town') || find('locality') || findLong('administrative_area_level_1');
              const country = findLong('country') || find('country');
              const fix: Record<string, string> = {};
              if (neighborhood && !pl.neighborhood) fix.neighborhood = neighborhood;
              if (resolvedCity && (!pl.city || isAbbreviation(pl.city))) fix.city = resolvedCity;
              if (country && !pl.country) fix.country = country;
              if (!pl.category && types.length) fix.category = googleTypesToCategory(types);
              return Object.keys(fix).length ? { id: pl.id, fix } : null;
            } catch { return null; }
          }));
          const locationFixes: Record<string, Record<string, string>> = {};
          enrichResults.forEach(r => { if (r) locationFixes[r.id] = r.fix; });
          if (Object.keys(locationFixes).length > 0) {
            Object.entries(locationFixes).forEach(([id, fix]) =>
              supabase.from('post_places').update(fix).eq('id', id)
            );
            const applyFixes = (p: RealPost) => ({ ...p, places: p.places.map(pl => locationFixes[pl.id] ? { ...pl, ...locationFixes[pl.id] } : pl) });
            setRealPosts(prev => prev.map(applyFixes));
            setSelectedRealPost(prev => prev ? applyFixes(prev) : prev);
          }
        }

        // Auto-geocode any places missing lat/lng — with Nominatim fallback
        const allPlaces = posts.flatMap(p => p.places);
        const missingCoords = allPlaces.filter(pl => pl.lat == null || pl.lng == null);
        if (missingCoords.length > 0) {
          const geocoded = await geocodeMissingPlaces(allPlaces, GKEY);
          const coordMap: Record<string, { lat: number; lng: number }> = {};
          geocoded.forEach(pl => { if (pl.lat != null) coordMap[pl.id] = { lat: pl.lat!, lng: pl.lng! }; });
          if (Object.keys(coordMap).length > 0) {
            setRealPosts(prev => prev.map(post => ({
              ...post,
              places: post.places.map(pl => coordMap[pl.id] ? { ...pl, ...coordMap[pl.id] } : pl),
            })));
          }
        }
      });
      getUserCollections(appUser.id).then(setRealCollections);
      getSharedCollections(appUser.id).then(setSharedCollections);
      getUserGuides(appUser.id).then(setUserGuides);
      getLikedPosts(appUser.id).then(setLikedRealPosts);
      getSavedPosts(appUser.id).then(setSavedRealPosts);
      getSavedPlaceIds(appUser.id).then(setPostPlaceSavedIds);
      getFollowingProfiles(appUser.id).then(setFollowingProfiles);
      getFollowCounts(appUser.id).then(({ followers, following }) => {
        setRealFollowerCount(followers);
        setRealFollowingCount(following);
      });
      // Real-time: refresh posts when a new one is added
      const channel = supabase
        .channel('profile-posts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `user_id=eq.${appUser.id}` }, () => {
          getUserPosts(appUser.id).then(setRealPosts);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [appUser]);

  // Load real comments when a post is opened
  useEffect(() => {
    if (!selectedRealPost) { setPostComments([]); setPostCommentText(''); return; }
    setLoadingComments(true);
    getPostComments(selectedRealPost.id).then(comments => {
      setPostComments(comments);
      setLoadingComments(false);
    });
  }, [selectedRealPost?.id]);

  // Pre-load which places in the selected post are saved to any collection
  useEffect(() => {
    if (!selectedRealPost || !appUser) { setPostPlaceSavedIds(new Set()); return; }
    Promise.all(selectedRealPost.places.map(pl => getPlaceCollectionIds(pl.id))).then(results => {
      const saved = new Set<string>();
      selectedRealPost.places.forEach((pl, i) => { if (results[i].size > 0) saved.add(pl.id); });
      setPostPlaceSavedIds(saved);
    });
  }, [selectedRealPost, appUser]);

  // When "Save all" picker opens, compute which collections already contain ALL places
  useEffect(() => {
    if (!showSaveAllPicker || !selectedRealPost || selectedRealPost.places.length === 0) { setSaveAllColIds(new Set()); return; }
    Promise.all(selectedRealPost.places.map(pl => getPlaceCollectionIds(pl.id))).then(sets => {
      const intersection = sets.reduce<Set<string>>((acc, cur) => new Set([...acc].filter(id => cur.has(id))), sets[0] ?? new Set());
      setSaveAllColIds(intersection);
    });
  }, [showSaveAllPicker]);

  const visitedPlaces = realPosts.flatMap(p => p.places).filter(pl => pl.lat != null && pl.lng != null);
  const user = currentUser;

  // Compute accurate stats from real posts
  const actualPlacesCount = new Set(realPosts.flatMap(p => p.places.map(pl => pl.id))).size;
  const actualCountriesCount = new Set(realPosts.flatMap(p => p.places.map(pl => pl.country)).filter(Boolean)).size;

  const isNewUser = appUser?.isDemo === false;
  const displayUser = isNewUser && appUser ? {
    ...user,
    id: appUser.id,
    name: appUser.name,
    username: appUser.username,
    avatar: appUser.avatar || null,
    followersCount: 0,
    followingCount: appUser.followingCount,
    bio: appUser?.bio ?? '',
    location: appUser?.location ?? '',
  } : { ...user, location: '' };

  // ── Notifications ────────────────────────────────────────────────
  if (showNotifications && appUser?.id) {
    return <Notifications userId={appUser.id} onBack={() => setShowNotifications(false)} onViewProfile={(actorId) => { setShowNotifications(false); setViewingUserId(actorId); }} />;
  }

  // ── Find People ─────────────────────────────────────────────────
  if (showFindPeople) {
    return <FindPeople currentUserId={appUser?.id ?? ''} onBack={() => setShowFindPeople(false)} onFollowChange={onFollowingCountChange} onOpenMessages={onOpenMessages} />;
  }

  if (viewingUserId && appUser) {
    return <UserProfile userId={viewingUserId} currentUserId={appUser.id} onBack={() => setViewingUserId(null)} onFollowChange={onFollowingCountChange} onMessage={onOpenMessages} />;
  }

  // ── Real Post Detail ────────────────────────────────────────────
  if (selectedRealPost) {
    const images = selectedRealPost.places.map(pl => pl.photoUrl).filter(Boolean);
    const labels = selectedRealPost.places.map(pl => pl.name.split(',')[0].trim());
    return (
      <>
      <div className="bg-white min-h-screen pb-24">

        {/* ── Full-bleed photo with frosted glass controls ── */}
        <div className="relative">
          {images.length > 0
            ? <ImageCarousel images={images} labels={labels} sublabels={selectedRealPost.places.map(pl => [pl.neighborhood, pl.city].filter(Boolean).join(', ') || pl.country)} />
            : <div className="w-full bg-gray-100" style={{ aspectRatio: '3/4' }} />
          }
          {/* Top overlay: back | user info | edit */}
          <div className="absolute top-0 left-0 right-0 px-4 pt-5 pb-8 bg-gradient-to-b from-black/55 via-black/10 to-transparent">
            <div className="flex items-center gap-2.5">
              {/* Back */}
              <button
                onClick={() => setSelectedRealPost(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md flex-shrink-0"
              >
                <ArrowLeft size={17} strokeWidth={1.5} className="text-white" />
              </button>
              {/* Avatar + name — frosted glass pill, collaborators tappable */}
              {(() => {
                const isOwner = selectedRealPost.userId === appUser?.id;
                const collabs = selectedRealPost.collaborators ?? [];
                // Owner info: use appUser's live avatar when current user is owner, else use post's profile
                const ownerAvatarSrc = isOwner ? (avatarPreview ?? appUser?.avatar ?? null) : (selectedRealPost.profile.avatarUrl ?? null);
                const ownerName = isOwner ? (displayUser.username || displayUser.name) : (selectedRealPost.profile.username || selectedRealPost.profile.name);
                // Names: owner first, then each collaborator
                const allNames = [ownerName, ...collabs.map(c => c.username || c.name)];
                // If current user is a collaborator (not owner), add themselves to the names
                if (!isOwner && appUser) allNames.push(displayUser.username || displayUser.name);
                return (
                  <div className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md rounded-full px-2 py-1.5 w-fit max-w-[65%] overflow-hidden">
                    {/* Owner avatar */}
                    {ownerAvatarSrc
                      ? <img src={ownerAvatarSrc} alt={ownerName} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/20 flex-shrink-0"><span className="text-xs font-bold text-white">{ownerName[0]?.toUpperCase()}</span></div>
                    }
                    {/* Collaborator avatars */}
                    {collabs.slice(0, 2).map(c => (
                      c.avatarUrl
                        ? <img key={c.id} src={c.avatarUrl} alt={c.name} className="-ml-2 w-7 h-7 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" />
                        : <div key={c.id} className="-ml-2 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/20 flex-shrink-0"><span className="text-xs font-bold text-white">{c.name[0]?.toUpperCase()}</span></div>
                    ))}
                    {/* Current user avatar when they're a collaborator (not owner) */}
                    {!isOwner && appUser && (
                      (avatarPreview ?? appUser.avatar)
                        ? <img src={avatarPreview ?? appUser.avatar!} alt={displayUser.name} className="-ml-2 w-7 h-7 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" />
                        : <div className="-ml-2 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/20 flex-shrink-0"><span className="text-xs font-bold text-white">{displayUser.name[0]?.toUpperCase()}</span></div>
                    )}
                    {/* Name(s) */}
                    <p className="text-white font-semibold text-sm leading-tight truncate ml-1">
                      {allNames.length > 1 ? allNames.join(' & ') : allNames[0]}
                    </p>
                  </div>
                );
              })()}
              {/* Spacer */}
              <div className="flex-1" />
              {/* Edit */}
              <button
                onClick={() => { setEditPostCaption(selectedRealPost.caption); setEditPostPlaces([...selectedRealPost.places]); setEditPostHashtags([...selectedRealPost.hashtags]); setEditTagInput(''); getPostCollaborators(selectedRealPost.id).then(setPostCollaborators); setPostCollabSearch(''); setPostCollabResults([]); setShowEditPost(true); }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md flex-shrink-0"
              >
                <Edit3 size={15} strokeWidth={1.5} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="bg-white">

          {/* Actions */}
          <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-5">
              <button
                className="flex items-center gap-1.5"
                onClick={() => {
                  if (!appUser) return;
                  const isLiked = likedRealPosts.has(selectedRealPost.id);
                  setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.delete(selectedRealPost.id) : n.add(selectedRealPost.id); return n; });
                  setRealPostLikeCounts(prev => ({ ...prev, [selectedRealPost.id]: (prev[selectedRealPost.id] ?? 0) + (isLiked ? -1 : 1) }));
                  isLiked ? unlikePost(appUser.id, selectedRealPost.id) : likePost(appUser.id, selectedRealPost.id);
                }}
              >
                <Heart size={22} strokeWidth={1.5} className={likedRealPosts.has(selectedRealPost.id) ? 'fill-gray-900 text-gray-900' : 'text-gray-800'} />
                <span className="text-sm font-medium text-gray-500">{realPostLikeCounts[selectedRealPost.id] ?? 0}</span>
              </button>
              <button
                className="flex items-center gap-1.5"
                onClick={() => { setTimeout(() => postCommentInputRef.current?.focus(), 50); }}
              >
                <MessageCircle size={22} strokeWidth={1.5} className="text-gray-800" />
                <span className="text-sm font-medium text-gray-500">{postComments.length}</span>
              </button>
              <button onClick={() => { setPostSentTo(new Set()); setShowPostShareSheet(true); }}>
                <Send size={21} strokeWidth={1.5} className="text-gray-800" />
              </button>
            </div>
            {(() => {
              const allSaved = selectedRealPost.places.length > 0 && selectedRealPost.places.every(p => postPlaceSavedIds.has(p.id));
              return (
                <button onClick={() => setShowSaveAllPicker(true)}>
                  {allSaved
                    ? <BookmarkCheck size={22} strokeWidth={1.5} className="text-gray-900" />
                    : <Bookmark size={22} strokeWidth={1.5} className="text-gray-700" />}
                </button>
              );
            })()}
          </div>

          {/* Caption + hashtags */}
          {(selectedRealPost.caption || selectedRealPost.hashtags.length > 0) && (
            <div className="px-5 pt-4 pb-5">
              {selectedRealPost.caption && <p className="text-sm text-gray-800 leading-relaxed">{selectedRealPost.caption}</p>}
              {selectedRealPost.hashtags.length > 0 && (() => {
                const seen = new Set<string>();
                const unique = selectedRealPost.hashtags.filter(h => { const k = h.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
                return <p className="text-xs text-orange-400 mt-2">{unique.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>;
              })()}
            </div>
          )}

          {/* Places + map */}
          {selectedRealPost.places.length > 0 && (
            <div className="px-5 pt-4 border-t border-gray-100">
              {(() => {
                const uniqueCount = new Set(selectedRealPost.places.map(p => p.name.split(',')[0].trim().toLowerCase())).size;
                return (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {uniqueCount} place{uniqueCount !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={async () => {
                    if (showPostMap) { setShowPostMap(false); return; }
                    setShowPostMap(true);
                    // Geocode any missing coords right now
                    const missing = selectedRealPost.places.filter(p => p.lat == null || p.lng == null);
                    if (missing.length > 0) {
                      setGeocodingPostMap(true);
                      await geocodeMissingPlaces(
                        selectedRealPost.places,
                        GOOGLE_PLACES_KEY,
                        (updated) => {
                          const coordMap: Record<string, { lat: number; lng: number }> = {};
                          updated.forEach(pl => { if (pl.lat != null) coordMap[pl.id] = { lat: pl.lat!, lng: pl.lng! }; });
                          setSelectedRealPost(prev => prev ? { ...prev, places: prev.places.map(pl => coordMap[pl.id] ? { ...pl, ...coordMap[pl.id] } : pl) } : prev);
                          setRealPosts(prev => prev.map(rp => ({ ...rp, places: rp.places.map(pl => coordMap[pl.id] ? { ...pl, ...coordMap[pl.id] } : pl) })));
                        }
                      );
                      setGeocodingPostMap(false);
                    }
                  }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showPostMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Map size={11} strokeWidth={1.5} />
                  {showPostMap ? 'Hide map' : 'View on map'}
                </button>
              </div>
                ); })()}
              {showPostMap && (() => {
                const mapPlaces = selectedRealPost.places.filter(p => p.lat != null && p.lng != null).map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name, city: p.city, country: p.country }));
                if (geocodingPostMap && mapPlaces.length === 0) return (
                  <div className="rounded-2xl bg-gray-50 h-28 flex flex-col items-center justify-center gap-1 animate-pulse mb-3">
                    <Map size={18} strokeWidth={1.5} className="text-gray-300" />
                    <p className="text-xs text-gray-400">Loading map…</p>
                  </div>
                );
                return mapPlaces.length > 0 ? (
                  <div className="rounded-2xl overflow-hidden mb-3">
                    <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse" />}>
                      <MapView places={mapPlaces} height="200px" />
                    </Suspense>
                  </div>
                ) : null;
              })()}
              <div className="space-y-2.5 pb-5">
                {selectedRealPost.places.filter((p, i, arr) => arr.findIndex(x => x.name.split(',')[0].trim() === p.name.split(',')[0].trim()) === i).map(place => (
                  <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                    {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{place.name.split(',')[0].trim()}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5 flex-wrap">
                        <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
                      </p>
                      {place.category && <p className="text-xs text-gray-400 mt-0.5">{categoryEmoji[place.category] ?? '📍'} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
                    </div>
                    {realCollections.length > 0 && (
                      <button
                        onClick={() => {
                          setAddToColPlace({ id: place.id, name: place.name });
                          setLoadingPlaceCollections(true);
                          getPlaceCollectionIds(place.id).then(ids => { setPlaceInCollections(ids); setLoadingPlaceCollections(false); });
                        }}
                        className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${postPlaceSavedIds.has(place.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                      >
                        {postPlaceSavedIds.has(place.id)
                          ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                          : <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="px-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</p>
            {loadingComments && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
            {!loadingComments && postComments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No comments yet — be the first</p>
            )}
            <div className="space-y-3 mb-4">
              {postComments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  {c.profile.avatarUrl
                    ? <img src={c.profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />}
                  <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-gray-900">{c.profile.username}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.text}</p>
                  </div>
                  {c.userId === appUser?.id && (
                    <button onClick={async () => { await deleteComment(c.id); setPostComments(prev => prev.filter(x => x.id !== c.id)); }} className="text-[10px] text-gray-300 flex-shrink-0 mt-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-4">
              {appUser?.avatar
                ? <img src={appUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />}
              <div className="flex-1 flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 gap-2">
                <input
                  ref={postCommentInputRef}
                  value={postCommentText}
                  onChange={e => setPostCommentText(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && postCommentText.trim() && appUser?.id && selectedRealPost) {
                      const text = postCommentText.trim();
                      setPostCommentText('');
                      const saved = await addComment(appUser.id, selectedRealPost.id, text);
                      if (saved) setPostComments(prev => [...prev, saved]);
                    }
                  }}
                  placeholder="Add a comment…"
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder-gray-400"
                />
                {postCommentText.trim() && (
                  <button
                    onClick={async () => {
                      if (!appUser?.id || !selectedRealPost) return;
                      const text = postCommentText.trim();
                      setPostCommentText('');
                    const saved = await addComment(appUser.id, selectedRealPost.id, text);
                    if (saved) setPostComments(prev => [...prev, saved]);
                  }}
                  className="text-xs font-bold text-gray-900 flex-shrink-0"
                >Post</button>
              )}
              </div>
            </div>
          </div>

          {/* Date */}
          <p className="text-xs text-gray-400 px-5 pt-4 pb-8">
            {new Date(selectedRealPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

        </div>
      </div>

      {/* Share sheet */}
      {showPostShareSheet && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPostShareSheet(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900">Share</h3>
              <button onClick={() => setShowPostShareSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                <X size={16} strokeWidth={1.5} className="text-gray-700" />
              </button>
            </div>
            {/* Preview */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                {selectedRealPost.places[0]?.photoUrl && (
                  <img src={selectedRealPost.places[0].photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                )}
                <p className="text-sm font-semibold text-gray-900 truncate">{selectedRealPost.caption}</p>
              </div>
            </div>
            {/* Send to following */}
            <div className="px-4 max-h-64 overflow-y-auto space-y-3">
              {followingProfiles.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Follow people to send them posts</p>
              ) : followingProfiles.map(friend => {
                const sent = postSentTo.has(friend.id);
                return (
                  <div key={friend.id} className="flex items-center gap-3">
                    {friend.avatarUrl
                      ? <img src={friend.avatarUrl} alt={friend.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{friend.name[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{friend.name}</p>
                      <p className="text-xs text-gray-400">@{friend.username}</p>
                    </div>
                    <button
                      onClick={() => setPostSentTo(prev => { const n = new Set(prev); n.add(friend.id); return n; })}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${sent ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-gray-700'}`}
                    >{sent ? 'Sent' : 'Send'}</button>
                  </div>
                );
              })}
            </div>
            {/* Also share externally */}
            <div className="px-4 pt-4">
              <button
                onClick={() => navigator.share({ title: selectedRealPost.caption, text: selectedRealPost.caption }).catch(() => {})}
                className="w-full py-2.5 bg-gray-100 rounded-2xl text-sm font-semibold text-gray-700"
              >Share externally…</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit post sheet */}
      {showEditPost && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditPost(false)} />
          <div className="relative bg-white rounded-t-[2rem] max-h-[94vh] flex flex-col">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0 border-b border-gray-100">
              <button onClick={() => setShowEditPost(false)} className="text-sm font-medium text-gray-400 active:text-gray-600 transition-colors">
                Cancel
              </button>
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">Edit post</h3>
              <button
                disabled={savingEditPost}
                onClick={async () => {
                  setSavingEditPost(true);
                  const first = editPostPlaces[0];
                  const locationLabel = !first ? '' : editPostPlaces.length === 1
                    ? `${first.name.split(',')[0].trim()} · ${first.city}`
                    : `${first.name.split(',')[0].trim()} +${editPostPlaces.length - 1} · ${first.city}`;
                  await updatePostCaption(selectedRealPost.id, editPostCaption, editPostHashtags, locationLabel);
                  await Promise.all(editPostPlaces.map(ep =>
                    updatePostPlace(ep.id, {
                      name: ep.name,
                      neighborhood: ep.neighborhood,
                      city: ep.city,
                      country: ep.country,
                      category: ep.category,
                    })
                  ));
                  const removedIds = selectedRealPost.places.filter(p => !editPostPlaces.find(ep => ep.id === p.id)).map(p => p.id);
                  for (const id of removedIds) await deletePostPlace(id);
                  if (editPostPlaces.length > 0) await reorderPostPlaces(editPostPlaces.map(p => p.id));
                  const updated = { ...selectedRealPost, caption: editPostCaption, hashtags: editPostHashtags, locationLabel, places: editPostPlaces };
                  setSelectedRealPost(updated);
                  setRealPosts(prev => prev.map(p => p.id === selectedRealPost.id ? updated : p));
                  setSavingEditPost(false);
                  setShowEditPost(false);
                }}
                className="text-sm font-bold text-orange-500 disabled:opacity-40 active:opacity-70 transition-opacity"
              >{savingEditPost ? 'Saving…' : 'Done'}</button>
            </div>

            <div className="overflow-y-auto flex-1 pb-10">

              {/* Caption — frameless, feels like editing the post itself */}
              <div className="px-5 pt-4 pb-4 border-b border-gray-100">
                <textarea
                  value={editPostCaption}
                  onChange={e => setEditPostCaption(e.target.value)}
                  rows={3}
                  placeholder="Write a caption…"
                  className="w-full text-[15px] text-gray-900 leading-relaxed outline-none resize-none placeholder-gray-300 bg-transparent"
                />
                {/* Hashtags inline below caption */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {editPostHashtags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setEditPostHashtags(prev => prev.filter(t => t !== tag))}
                      className="flex items-center gap-1 text-[13px] font-medium text-orange-500"
                    >
                      #{tag} <X size={9} strokeWidth={2.5} className="text-orange-300" />
                    </button>
                  ))}
                  <input
                    value={editTagInput}
                    onChange={e => setEditTagInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === ' ' || e.key === 'Enter') && editTagInput.trim()) {
                        e.preventDefault();
                        const newTag = editTagInput.trim().replace(/^#+/, '').replace(/\s+/g, '');
                        if (newTag && !editPostHashtags.includes(newTag)) setEditPostHashtags(prev => [...prev, newTag]);
                        setEditTagInput('');
                      }
                    }}
                    placeholder="# add tag"
                    className="text-[13px] font-medium text-gray-400 bg-transparent outline-none placeholder-gray-300 min-w-[60px]"
                    style={{ width: `${Math.max(60, (editTagInput.length + 5) * 8)}px` }}
                  />
                </div>
              </div>

              {/* Places — drag to reorder */}
              {editPostPlaces.length > 0 && (
                <div className="pt-1">
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event;
                      if (over && active.id !== over.id) {
                        setEditPostPlaces(prev => {
                          const oldIndex = prev.findIndex(p => p.id === active.id);
                          const newIndex = prev.findIndex(p => p.id === over.id);
                          return arrayMove(prev, oldIndex, newIndex);
                        });
                      }
                    }}
                  >
                    <SortableContext items={editPostPlaces.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      {editPostPlaces.map((place, i) => (
                        <SortableEditPlace
                          key={place.id}
                          place={place}
                          i={i}
                          total={editPostPlaces.length}
                          isExpanded={expandedPlaceId === place.id}
                          onToggle={() => setExpandedPlaceId(expandedPlaceId === place.id ? null : place.id)}
                          onRemove={() => { setEditPostPlaces(prev => prev.filter(p => p.id !== place.id)); if (expandedPlaceId === place.id) setExpandedPlaceId(null); }}
                          onUpdateField={(field, value) => setEditPostPlaces(prev => prev.map(p => p.id === place.id ? { ...p, [field]: value } : p))}
                          onSelectPlace={result => setEditPostPlaces(prev => prev.map(p => p.id === place.id ? { ...p, name: result.name || p.name, neighborhood: result.neighborhood, city: result.city, country: result.country, category: result.category || p.category } : p))}
                          categoryEmojiMap={categoryEmoji}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {/* Collaborators */}
              <div className="px-5 pt-4 pb-4 border-b border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">With</p>
                {postCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {postCollaborators.map(c => (
                      <div key={c.userId} className="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1">
                        {c.profile.avatarUrl
                          ? <img src={c.profile.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                          : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-600">{c.profile.name[0]?.toUpperCase() || '?'}</div>}
                        <span className="text-xs font-medium text-gray-700">@{c.profile.username}</span>
                        {c.status === 'pending' && <span className="text-[9px] text-gray-400 ml-0.5">pending</span>}
                        <button onClick={async () => { await removePostCollaborator(selectedRealPost.id, c.userId); setPostCollaborators(prev => prev.filter(x => x.userId !== c.userId)); }} className="ml-0.5 text-gray-400"><X size={10} strokeWidth={2.5} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2.5">
                  <Search size={13} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={postCollabSearch}
                    onChange={async e => {
                      setPostCollabSearch(e.target.value);
                      if (e.target.value.trim().length > 0) {
                        const results = await searchProfiles(e.target.value, appUser?.id ?? '');
                        setPostCollabResults(results.filter(r => !postCollaborators.find(c => c.userId === r.id)));
                      } else { setPostCollabResults([]); }
                    }}
                    placeholder="Add a collaborator…"
                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder-gray-400"
                  />
                </div>
                {postCollabResults.length > 0 && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {postCollabResults.slice(0, 5).map(u => (
                      <button key={u.id} disabled={invitingPostCollab === u.id}
                        onClick={async () => {
                          if (!appUser?.id) return;
                          setInvitingPostCollab(u.id);
                          const err = await addPostCollaborator(selectedRealPost.id, u.id, appUser.id);
                          if (!err) {
                            const newCollab: PostCollaborator = { id: `${selectedRealPost.id}-${u.id}`, postId: selectedRealPost.id, userId: u.id, invitedBy: appUser.id, status: 'pending', createdAt: new Date().toISOString(), profile: { name: u.name, username: u.username, avatarUrl: u.avatarUrl } };
                            setPostCollaborators(prev => [...prev, newCollab]);
                            setPostCollabResults(prev => prev.filter(r => r.id !== u.id));
                            setPostCollabSearch('');
                          }
                          setInvitingPostCollab(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0 active:bg-gray-50"
                      >
                        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{u.name[0]?.toUpperCase() || '?'}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400">@{u.username}</p>
                        </div>
                        <span className="text-xs font-semibold text-orange-500 flex-shrink-0">{invitingPostCollab === u.id ? 'Inviting…' : 'Invite'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="px-5 pt-5 pb-2">
                <button
                  onClick={async () => {
                    if (!confirm('Delete this post?')) return;
                    await deletePost(selectedRealPost.id);
                    setRealPosts(prev => prev.filter(p => p.id !== selectedRealPost.id));
                    setShowEditPost(false);
                    setSelectedRealPost(null);
                  }}
                  className="w-full py-3 text-sm font-semibold text-red-500 active:opacity-70 transition-opacity"
                >Delete post</button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Save ALL places to collection picker */}
      {showSaveAllPicker && selectedRealPost && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSaveAllPicker(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Save all to collection</h3>
              <p className="text-xs text-gray-400">{selectedRealPost.places.length} place{selectedRealPost.places.length !== 1 ? 's' : ''}</p>
            </div>
            {realCollections.length > 0 && (
              <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
                {realCollections.map(col => (
                  <button
                    key={col.id}
                    onClick={async () => {
                      if (!appUser) return;
                      const alreadyIn = saveAllColIds.has(col.id);
                      if (alreadyIn) {
                        for (const place of selectedRealPost.places) {
                          await removePlaceFromCollection(col.id, place.id);
                        }
                        setSaveAllColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        setRealCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - selectedRealPost.places.length) } : c));
                      } else {
                        for (const place of selectedRealPost.places) {
                          await addPlaceToCollection(col.id, place.id);
                        }
                        setSaveAllColIds(prev => new Set(prev).add(col.id));
                        setPostPlaceSavedIds(prev => { const n = new Set(prev); selectedRealPost.places.forEach(p => n.add(p.id)); return n; });
                        setRealCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + selectedRealPost.places.length } : c));
                      }
                    }}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} places</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${saveAllColIds.has(col.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {saveAllColIds.has(col.id) && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {/* New collection */}
            <div className="px-4 pt-3 pb-2">
              {showInlineNewCol ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={inlineNewColName}
                    onChange={e => setInlineNewColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && inlineNewColName.trim() && appUser) {
                        setSavingInlineCol(true);
                        const { data, error } = await createCollection(appUser.id, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingInlineCol(false);
                        if (!error && data) { setRealCollections(prev => [data, ...prev]); setInlineNewColName(''); setShowInlineNewCol(false); }
                      }
                      if (e.key === 'Escape') { setShowInlineNewCol(false); setInlineNewColName(''); }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-gray-400"
                  />
                  <button
                    disabled={!inlineNewColName.trim() || savingInlineCol}
                    onClick={async () => {
                      if (!inlineNewColName.trim() || !appUser) return;
                      setSavingInlineCol(true);
                      const { data, error } = await createCollection(appUser.id, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                      setSavingInlineCol(false);
                      if (!error && data) { setRealCollections(prev => [data, ...prev]); setInlineNewColName(''); setShowInlineNewCol(false); }
                    }}
                    className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                  >{savingInlineCol ? '…' : 'Create'}</button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowInlineNewCol(true); setInlineNewColName(''); }}
                  className="w-full flex items-center gap-3 py-3 text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={18} strokeWidth={2} className="text-gray-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">New collection</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection picker sheet */}
      {addToColPlace && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setAddToColPlace(null); setShowInlineNewCol(false); setInlineNewColName(''); }} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Save to collection</h3>
              <p className="text-xs text-gray-400 truncate">{addToColPlace.name}</p>
            </div>
            {loadingPlaceCollections ? (
              <div className="px-4 space-y-3 pb-4">
                {[0, 1].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="px-4 space-y-2 max-h-72 overflow-y-auto">
                {realCollections.map(col => {
                  const inCol = placeInCollections.has(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={async () => {
                        if (inCol) {
                          await removePlaceFromCollection(col.id, addToColPlace.id);
                          setPlaceInCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                          setRealCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                          // Update bookmark icon — check if still in any other collection
                          getPlaceCollectionIds(addToColPlace.id).then(ids => {
                            setPostPlaceSavedIds(prev => { const n = new Set(prev); ids.size > 0 ? n.add(addToColPlace.id) : n.delete(addToColPlace.id); return n; });
                          });
                        } else {
                          await addPlaceToCollection(col.id, addToColPlace.id);
                          setPlaceInCollections(prev => new Set(prev).add(col.id));
                          setRealCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + 1 } : c));
                          setPostPlaceSavedIds(prev => new Set(prev).add(addToColPlace.id));
                        }
                      }}
                      className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3 text-left"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        {col.coverImageUrl
                          ? <img src={col.coverImageUrl} className="w-full h-full object-cover" />
                          : <span className="text-xl">{col.emoji || '🗂️'}</span>
                        }
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
            )}
            {/* New collection */}
            <div className="px-4 pt-3 pb-2">
              {showInlineNewCol ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={inlineNewColName}
                    onChange={e => setInlineNewColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && inlineNewColName.trim() && appUser) {
                        setSavingInlineCol(true);
                        const { data, error } = await createCollection(appUser.id, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingInlineCol(false);
                        if (!error && data) {
                          setRealCollections(prev => [data, ...prev]);
                          setInlineNewColName('');
                          setShowInlineNewCol(false);
                        }
                      }
                      if (e.key === 'Escape') { setShowInlineNewCol(false); setInlineNewColName(''); }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-gray-400"
                  />
                  <button
                    disabled={!inlineNewColName.trim() || savingInlineCol}
                    onClick={async () => {
                      if (!inlineNewColName.trim() || !appUser) return;
                      setSavingInlineCol(true);
                      const { data, error } = await createCollection(appUser.id, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                      setSavingInlineCol(false);
                      if (!error && data) {
                        setRealCollections(prev => [data, ...prev]);
                        setInlineNewColName('');
                        setShowInlineNewCol(false);
                      }
                    }}
                    className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                  >
                    {savingInlineCol ? '…' : 'Create'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowInlineNewCol(true); setInlineNewColName(''); }}
                  className="w-full flex items-center gap-3 py-3 text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={18} strokeWidth={2} className="text-gray-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">New collection</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // ── Edit Profile Sheet ──────────────────────────────────────────
  if (showEditProfile) {
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
      if (!appUser?.id) return;
      setSaving(true);
      setSaveError('');

      let finalAvatarUrl: string | null = appUser.avatar;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() ?? 'jpg';
        const path = `${appUser.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) {
          setSaving(false);
          setSaveError(`Photo upload failed: ${uploadError.message}`);
          return;
        }
        finalAvatarUrl = `${getPublicUrl('avatars', path)}?t=${Date.now()}`;
      }

      const updates: { name?: string; username?: string; bio?: string; location?: string; avatar_url?: string; website_url?: string } = {
        name: editName.trim() || displayUser.name,
        username: editUsername.trim().replace('@', '') || displayUser.username,
        bio: editBio.trim(),
        location: editLocation.trim(),
        avatar_url: finalAvatarUrl ?? undefined,
        website_url: editWebsite.trim() || undefined,
      };

      const error = await updateProfile(appUser.id, updates);
      setSaving(false);
      if (error) {
        setSaveError((error as any).message?.includes('RLS') ? 'Could not save — permission error. Contact support.' : 'Username may already be taken. Try another.');
      } else {
        onProfileUpdate?.({
          name: updates.name!,
          username: updates.username!,
          avatar: finalAvatarUrl,
          bio: updates.bio ?? '',
          location: updates.location ?? '',
          website: updates.website_url ?? '',
        });
        setAvatarFile(null);
        setAvatarPreview(null);
        setShowEditProfile(false);
      }
    };

    const currentAvatar = avatarPreview ?? (appUser?.avatar || null);

    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-gray-100">
          <button onClick={() => { setShowEditProfile(false); setAvatarFile(null); setAvatarPreview(null); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">Edit Profile</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="px-4 pt-6 space-y-5">
          {/* Avatar */}
          {createPortal(
            <input id="profile-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.001, zIndex: -1 }} />,
            document.body
          )}
          <div className="flex flex-col items-center gap-3">
            <label htmlFor="profile-avatar-input" className="relative cursor-pointer w-20 h-20">
              {currentAvatar ? (
                <img src={currentAvatar} alt={displayUser.name} className="w-20 h-20 rounded-full object-cover object-top" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-400">{displayUser.name[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center pointer-events-none">
                <Edit3 size={13} strokeWidth={1.5} className="text-white" />
              </div>
            </label>
            <label htmlFor="profile-avatar-input" className="text-sm font-semibold text-gray-500 cursor-pointer">
              Change photo
            </label>
          </div>
          {/* Fields */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Name</p>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={displayUser.name}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Username</p>
            <input
              value={editUsername}
              onChange={e => setEditUsername(e.target.value)}
              placeholder={displayUser.username}
              autoCapitalize="none"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Bio</p>
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              placeholder={displayUser.bio || 'Tell people about yourself…'}
              rows={3}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors resize-none"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Location</p>
            <input
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
              placeholder={displayUser.location || 'City, Country'}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Link</p>
            <input
              value={editWebsite}
              onChange={e => setEditWebsite(e.target.value)}
              placeholder="yourwebsite.com"
              autoCapitalize="none"
              inputMode="url"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
            />
          </div>
          {saveError && (
            <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-3">{saveError}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Followers / Following Modal ─────────────────────────────────
  if (showFollowers) {
    const title = showFollowers === 'followers' ? 'Followers' : 'Following';
    const list = showFollowers === 'followers' ? followerProfiles : followingProfiles;

    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-gray-100">
          <button onClick={() => setShowFollowers(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">{title}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {loadingFollowList ? (
            <div className="space-y-4 px-4 pt-4">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-28" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length > 0 ? (
            list.map(u => {
              const ini = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const isMe = u.id === appUser?.id;
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => !isMe && setViewingUserId(u.id)}>
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-400">{ini || '?'}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">@{u.username}</p>
                  </div>
                  {!isMe && (() => {
                    const isFollowing = showFollowers === 'following' || listFollowingIds.has(u.id);
                    const isPending = listFollowPending === u.id;
                    return (
                      <button
                        disabled={isPending}
                        onClick={async e => {
                          e.stopPropagation();
                          if (showFollowers === 'following') {
                            setUnfollowTarget(u);
                          } else if (isFollowing) {
                            // route through confirmation sheet
                            setUnfollowTarget(u);
                          } else {
                            // follow back
                            setListFollowPending(u.id);
                            await supabase.from('follows').insert({ follower_id: appUser!.id, following_id: u.id });
                            setListFollowingIds(prev => new Set([...prev, u.id]));
                            setFollowingProfiles(prev => [...prev, u]);
                            setRealFollowingCount(c => c + 1);
                            onFollowingCountChange?.(1);
                            setListFollowPending(null);
                          }
                        }}
                        className={`text-[11px] font-semibold rounded-full px-3 py-1.5 flex-shrink-0 flex items-center gap-1 disabled:opacity-50 transition-colors ${
                          isFollowing
                            ? 'border border-gray-300 text-gray-500 bg-white'
                            : 'bg-gray-900 text-white'
                        }`}
                      >
                        {isPending ? '…' : isFollowing
                          ? <><Check size={10} strokeWidth={2.5} />Following</>
                          : 'Follow'}
                      </button>
                    );
                  })()}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-3xl mb-3">{showFollowers === 'followers' ? '👥' : '🔍'}</p>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {showFollowers === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
              <p className="text-xs text-gray-400 max-w-[200px]">
                {showFollowers === 'followers'
                  ? 'Share your posts and people will find you'
                  : 'Find people to follow from your profile'}
              </p>
            </div>
          )}
        </div>

        {/* Unfollow confirmation sheet */}
        {unfollowTarget && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setUnfollowTarget(null)} />
            <div className="relative bg-white rounded-t-3xl pb-8">
              <div className="flex justify-center pt-3 pb-4">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="flex flex-col items-center px-6 pb-2">
                {unfollowTarget.avatarUrl ? (
                  <img src={unfollowTarget.avatarUrl} alt={unfollowTarget.name} className="w-16 h-16 rounded-full object-cover mb-3" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <span className="text-xl font-bold text-slate-400">
                      {unfollowTarget.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <p className="text-base font-bold text-gray-900 mb-1">Unfollow {unfollowTarget.name.split(' ')[0]}?</p>
                <p className="text-sm text-gray-400 text-center mb-6">
                  Their posts will no longer appear in your feed.
                </p>
                <button
                  disabled={unfollowing}
                  onClick={async () => {
                    if (!appUser) return;
                    setUnfollowing(true);
                    const { error } = await supabase.from('follows').delete()
                      .eq('follower_id', appUser.id)
                      .eq('following_id', unfollowTarget.id);
                    if (!error) {
                      setFollowingProfiles(prev => prev.filter(p => p.id !== unfollowTarget.id));
                      setListFollowingIds(prev => { const s = new Set(prev); s.delete(unfollowTarget.id); return s; });
                      setRealFollowingCount(c => c - 1);
                      onFollowingCountChange?.(-1);
                    }
                    setUnfollowing(false);
                    setUnfollowTarget(null);
                  }}
                  className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3 disabled:opacity-50"
                >
                  {unfollowing ? 'Unfollowing…' : 'Unfollow'}
                </button>
                <button onClick={() => setUnfollowTarget(null)} className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Creator Onboard Sheet ───────────────────────────────────────
  if (showCreatorOnboard) {
    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <button onClick={() => setShowCreatorOnboard(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>
        <div className="px-6 pt-2">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-4">
            <Star size={26} strokeWidth={1.5} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Become a Creator</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">Monetize your travel knowledge. Build premium collections, earn from subscribers, and reach thousands of travelers.</p>
          <div className="space-y-4 mb-8">
            {[
              { emoji: '💰', title: 'Earn monthly income', desc: 'Charge for access to your premium collections' },
              { emoji: '📍', title: 'Build your brand', desc: 'Your curated lists reach travelers worldwide' },
              { emoji: '📊', title: 'Track your impact', desc: 'See who\'s following your recommendations' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl text-sm">Apply to be a creator</button>
          <p className="text-xs text-gray-400 text-center mt-3">Usually approved within 48 hours</p>
        </div>
      </div>
    );
  }

  // ── Real Collection Detail ──────────────────────────────────────
  if (selectedRealCollection) {
    const mapPlaces = realCollectionPlaces
      .filter(pl => pl.lat != null && pl.lng != null)
      .map(pl => ({ id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country }));
    // All post_places across user's posts (for the add sheet)
    const allUserPlaces = realPosts.flatMap(p => p.places);

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
            onClick={() => { setSelectedRealCollection(null); setRealCollectionPlaces([]); setShowEditCollection(false); setShowAddPlacesSheet(false); }}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          {/* Top right actions */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => { setInviteSearch(''); setInviteResults([]); setShowInviteSheet(true); }}
              className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <UserPlus size={14} strokeWidth={1.5} className="text-gray-700" />
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/collection/${selectedRealCollection.id}`;
                navigator.share({ title: selectedRealCollection.name, url });
              }}
              className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <Share2 size={14} strokeWidth={1.5} className="text-gray-700" />
            </button>
            <button
              onClick={() => { setEditColName(selectedRealCollection.name); setEditColDesc(selectedRealCollection.description); setEditColCoverFile(null); setEditColCoverPreview(null); setShowEditCollection(true); }}
              className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <Edit3 size={14} strokeWidth={1.5} className="text-gray-700" />
            </button>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-black text-white">{selectedRealCollection.name}</h2>
            {selectedRealCollection.description && (
              <p className="text-white/70 text-xs mt-1">{selectedRealCollection.description}</p>
            )}
          </div>
        </div>

        {/* Collaborators row — tappable to open invite sheet */}
        {collectionCollaborators.length > 0 && (
          <button
            onClick={() => setShowInviteSheet(true)}
            className="flex items-center gap-2 px-4 pt-3 w-full text-left active:opacity-70"
          >
            <div className="flex -space-x-2">
              {collectionCollaborators.slice(0, 5).map(c => (
                c.profile.avatarUrl
                  ? <img key={c.id} src={c.profile.avatarUrl} alt={c.profile.name} className="w-7 h-7 rounded-full border-2 border-white object-cover" />
                  : <div key={c.id} className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{c.profile.name.charAt(0)}</div>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {collectionCollaborators.length === 1
                ? `@${collectionCollaborators[0].profile.username} invited`
                : `${collectionCollaborators.length} invited`}
              <span className="text-amber-500 ml-1">· pending</span>
            </p>
          </button>
        )}

        {loadingCollectionPlaces ? (
          <div className="px-4 pt-4 space-y-3">
            <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
            {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : realCollectionPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <span className="text-4xl mb-3">📍</span>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No places yet</p>
            <p className="text-slate-400 text-sm max-w-[220px] mb-5">Save places from your posts to start building this collection</p>
            <button
              onClick={() => { setColPlaceIds(new Set()); setShowAddPlacesSheet(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold"
            >
              <Plus size={14} strokeWidth={2.5} /> Add places
            </button>
          </div>
        ) : (() => {
          const catEmoji = (cat: string) => {
            const m: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', dining: '🍽️', bar: '🍸', cocktail: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙' };
            return m[cat.toLowerCase()] ?? '📍';
          };
          const locationLine = (place: typeof realCollectionPlaces[0]) => {
            const parts = [place.neighborhood, place.city].filter(Boolean);
            return parts.join(', ') || place.country;
          };
          const PlaceCard = ({ place }: { place: typeof realCollectionPlaces[0] }) => (
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
              {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                  <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />{locationLine(place)}
                </p>
                {place.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji(place.category)} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
                {collectionCollaborators.length > 0 && place.addedBy && (
                  <div className="flex items-center gap-1 mt-1.5">
                    {place.addedByAvatar
                      ? <img src={place.addedByAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full bg-gray-300 flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0">{(place.addedByName ?? '?')[0].toUpperCase()}</div>
                    }
                    <span className="text-[10px] text-gray-400">
                      {place.addedBy === appUser?.id ? 'You' : (place.addedByName ?? 'Someone')} added this
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  await removePlaceFromCollection(selectedRealCollection.id, place.id);
                  setRealCollectionPlaces(prev => prev.filter(p => p.id !== place.id));
                  setRealCollections(prev => prev.map(c => c.id === selectedRealCollection.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                  setSelectedRealCollection(prev => prev ? { ...prev, placesCount: Math.max(0, prev.placesCount - 1) } : prev);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 flex-shrink-0"
              >
                <X size={12} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
          );
          return (
            <>
              {/* Count + add + show/hide map */}
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{realCollectionPlaces.length} place{realCollectionPlaces.length !== 1 ? 's' : ''} in this collection</p>
                  <button
                    onClick={() => { setColPlaceIds(new Set(realCollectionPlaces.map(p => p.id))); setShowAddPlacesSheet(true); }}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-gray-500"
                  >
                    <Plus size={10} strokeWidth={3} />
                  </button>
                </div>
                {mapPlaces.length > 0 && (
                  <button
                    onClick={() => setShowColMap(v => !v)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${showColMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {showColMap ? 'Hide map' : 'Show map'}
                  </button>
                )}
              </div>

              {/* Map */}
              {showColMap && mapPlaces.length > 0 && (
                <div className="px-4 pt-2">
                  <div className="rounded-2xl overflow-hidden">
                    <Suspense fallback={<div className="h-52 bg-gray-100 animate-pulse" />}>
                      <MapView places={mapPlaces} height="220px" />
                    </Suspense>
                  </div>
                </div>
              )}

              {/* Activity filter chips */}
              {(() => {
                const cats = Array.from(new Set(realCollectionPlaces.map(p => p.category).filter(Boolean)));
                if (cats.length < 2) return null;
                const chipClass = (active: boolean) =>
                  `flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`;
                return (
                  <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
                    <button onClick={() => setColFilter('all')} className={chipClass(colFilter === 'all')}>All</button>
                    {cats.map(cat => (
                      <button key={cat} onClick={() => setColFilter(colFilter === cat ? 'all' : cat)} className={chipClass(colFilter === cat)}>
                        {catEmoji(cat)} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Places grouped by neighborhood */}
              <div className="px-4 pt-3 pb-10 space-y-3">
                {(() => {
                  const filtered = colFilter === 'all' ? realCollectionPlaces : realCollectionPlaces.filter(p => p.category === colFilter);
                  const byArea: Record<string, typeof filtered> = {};
                  filtered.forEach(p => { const k = p.neighborhood || p.city || 'Other'; if (!byArea[k]) byArea[k] = []; byArea[k].push(p); });
                  if (Object.keys(byArea).length === 0) return <p className="text-center text-sm text-gray-400 py-8">No places match this filter</p>;
                  return Object.entries(byArea).map(([area, areaPlaces]) => (
                    <div key={area}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{area}</p>
                      <div className="space-y-3">{areaPlaces.map(place => <PlaceCard key={place.id} place={place} />)}</div>
                    </div>
                  ));
                })()}
              </div>
            </>
          );
        })()}
      </div>

      {/* Edit collection sheet */}
      {showEditCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditCollection(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900">Edit Collection</h3>
              <button
                disabled={savingEditCollection}
                onClick={async () => {
                  if (!selectedRealCollection) return;
                  setSavingEditCollection(true);
                  let coverUrl: string | undefined = undefined;
                  if (editColCoverFile && appUser) {
                    const ext = editColCoverFile.name.split('.').pop() ?? 'jpg';
                    const path = `collections/${appUser.id}/${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from('avatars').upload(path, editColCoverFile, { upsert: true, contentType: editColCoverFile.type });
                    if (!upErr) coverUrl = getPublicUrl('avatars', path);
                  }
                  const payload: { name?: string; description?: string; cover_image_url?: string } = {
                    name: editColName.trim() || selectedRealCollection.name,
                    description: editColDesc.trim(),
                  };
                  if (coverUrl) payload.cover_image_url = coverUrl;
                  await updateCollection(selectedRealCollection.id, payload);
                  const updated = { ...selectedRealCollection, name: payload.name!, description: payload.description!, coverImageUrl: coverUrl ?? selectedRealCollection.coverImageUrl };
                  setSelectedRealCollection(updated);
                  setRealCollections(prev => prev.map(c => c.id === updated.id ? updated : c));
                  setSavingEditCollection(false);
                  setShowEditCollection(false);
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >{savingEditCollection ? 'Saving…' : 'Save'}</button>
            </div>
            <div className="px-4 space-y-4">
              {createPortal(
                <input id="edit-col-cover-input" type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setEditColCoverFile(f); setEditColCoverPreview(URL.createObjectURL(f));
                }} style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.001, zIndex: -1 }} />,
                document.body
              )}
              <label htmlFor="edit-col-cover-input" className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden">
                {(editColCoverPreview ?? selectedRealCollection.coverImageUrl)
                  ? <img src={editColCoverPreview ?? selectedRealCollection.coverImageUrl!} className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Change cover photo</span></div>
                }
                {(editColCoverPreview ?? selectedRealCollection.coverImageUrl) && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              <input value={editColName} onChange={e => setEditColName(e.target.value)} placeholder="Collection name" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              <input value={editColDesc} onChange={e => setEditColDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              <button
                onClick={async () => {
                  if (!selectedRealCollection) return;
                  await deleteCollection(selectedRealCollection.id);
                  setRealCollections(prev => prev.filter(c => c.id !== selectedRealCollection.id));
                  setSelectedRealCollection(null);
                  setRealCollectionPlaces([]);
                  setShowEditCollection(false);
                }}
                className="w-full py-3 text-sm font-semibold text-red-500 bg-red-50 rounded-xl"
              >Delete collection</button>
            </div>
          </div>
        </div>
      )}

      {/* Add places sheet */}
      {showAddPlacesSheet && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAddPlacesSheet(false); setAddPlacesSearch(''); }} />
          <div className="relative bg-white rounded-t-3xl pb-8 max-h-[80vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">Add places</h3>
              <button onClick={() => { setShowAddPlacesSheet(false); setAddPlacesSearch(''); }} className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full">Done</button>
            </div>
            {allUserPlaces.length === 0 ? (
              <div className="px-4 pb-4 text-center">
                <p className="text-sm text-gray-400">Post some places first to add them here</p>
              </div>
            ) : (
              <>
              <div className="px-4 pb-3 flex-shrink-0 space-y-2">
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    value={addPlacesSearch}
                    onChange={e => setAddPlacesSearch(e.target.value)}
                    placeholder="Search places…"
                    className="flex-1 text-sm text-gray-900 bg-transparent outline-none placeholder-gray-400"
                  />
                  {addPlacesSearch && <button onClick={() => setAddPlacesSearch('')} className="text-gray-400"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                </div>
                {(() => {
                  const filtered = allUserPlaces.filter(p => !addPlacesSearch.trim() || p.name.toLowerCase().includes(addPlacesSearch.toLowerCase()) || p.city?.toLowerCase().includes(addPlacesSearch.toLowerCase()));
                  const allSelected = filtered.length > 0 && filtered.every(p => colPlaceIds.has(p.id));
                  return (
                    <button
                      onClick={async () => {
                        if (allSelected) {
                          await Promise.all(filtered.map(p => removePlaceFromCollection(selectedRealCollection!.id, p.id)));
                          setColPlaceIds(prev => { const n = new Set(prev); filtered.forEach(p => n.delete(p.id)); return n; });
                          setRealCollectionPlaces(prev => prev.filter(p => !filtered.some(f => f.id === p.id)));
                          setRealCollections(prev => prev.map(c => c.id === selectedRealCollection!.id ? { ...c, placesCount: Math.max(0, c.placesCount - filtered.filter(p => colPlaceIds.has(p.id)).length) } : c));
                          setSelectedRealCollection(prev => prev ? { ...prev, placesCount: Math.max(0, prev.placesCount - filtered.filter(p => colPlaceIds.has(p.id)).length) } : prev);
                        } else {
                          const toAdd = filtered.filter(p => !colPlaceIds.has(p.id));
                          await Promise.all(toAdd.map(p => addPlaceToCollection(selectedRealCollection!.id, p.id)));
                          setColPlaceIds(prev => { const n = new Set(prev); toAdd.forEach(p => n.add(p.id)); return n; });
                          setRealCollectionPlaces(prev => [...prev, ...toAdd.map(p => ({ id: p.id, name: p.name, category: p.category, neighborhood: p.neighborhood ?? '', city: p.city, country: p.country, photoUrl: p.photoUrl, position: p.position, lat: p.lat, lng: p.lng }))]);
                          setRealCollections(prev => prev.map(c => c.id === selectedRealCollection!.id ? { ...c, placesCount: c.placesCount + toAdd.length } : c));
                          setSelectedRealCollection(prev => prev ? { ...prev, placesCount: prev.placesCount + toAdd.length } : prev);
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-gray-900">Select all</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                        {allSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>
                  );
                })()}
              </div>
              <div className="px-4 space-y-2 overflow-y-auto pb-4">
                {allUserPlaces.filter(p => !addPlacesSearch.trim() || p.name.toLowerCase().includes(addPlacesSearch.toLowerCase()) || p.city?.toLowerCase().includes(addPlacesSearch.toLowerCase())).map(place => {
                  const inCol = colPlaceIds.has(place.id);
                  return (
                    <button
                      key={place.id}
                      onClick={async () => {
                        if (inCol) {
                          await removePlaceFromCollection(selectedRealCollection.id, place.id);
                          setColPlaceIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                          setRealCollectionPlaces(prev => prev.filter(p => p.id !== place.id));
                          setRealCollections(prev => prev.map(c => c.id === selectedRealCollection.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                          setSelectedRealCollection(prev => prev ? { ...prev, placesCount: Math.max(0, prev.placesCount - 1) } : prev);
                        } else {
                          await addPlaceToCollection(selectedRealCollection.id, place.id);
                          setColPlaceIds(prev => new Set(prev).add(place.id));
                          setRealCollectionPlaces(prev => [...prev, { id: place.id, name: place.name, category: place.category, neighborhood: place.neighborhood ?? '', city: place.city, country: place.country, photoUrl: place.photoUrl, position: place.position, lat: place.lat, lng: place.lng }]);
                          setRealCollections(prev => prev.map(c => c.id === selectedRealCollection.id ? { ...c, placesCount: c.placesCount + 1 } : c));
                          setSelectedRealCollection(prev => prev ? { ...prev, placesCount: prev.placesCount + 1 } : prev);
                        }
                      }}
                      className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3 text-left"
                    >
                      {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                        <p className="text-xs text-gray-400">{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                        {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Invite collaborator sheet */}
      {showInviteSheet && selectedRealCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowInviteSheet(false); setPendingCollabIds(new Set()); }} />
          <div className="relative bg-white rounded-t-3xl max-h-[75vh] flex flex-col">
            {/* Handle + header */}
            <div className="px-5 pt-4 pb-0 flex-shrink-0">
              <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <button onClick={() => { setShowInviteSheet(false); setPendingCollabIds(new Set()); }} className="absolute top-4 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} strokeWidth={2} className="text-gray-500" />
              </button>
              <p className="text-base font-bold text-gray-900 mb-4">Invite collaborators</p>
              {/* Search bar */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3 mb-3">
                <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={inviteSearch}
                  onChange={async e => {
                    const val = e.target.value;
                    setInviteSearch(val);
                    if (appUser) searchProfiles(val, appUser.id).then(setInviteResults);
                  }}
                  placeholder="Search people..."
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* All invited collaborators — shown as Pending until acceptance flow exists */}
            {collectionCollaborators.length > 0 && !inviteSearch && (
              <div className="px-3 flex-shrink-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Pending</p>
                {collectionCollaborators.map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5 px-2">
                    {c.profile.avatarUrl
                      ? <img src={c.profile.avatarUrl} alt={c.profile.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{c.profile.name.charAt(0)}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.profile.name}</p>
                      <p className="text-xs text-amber-500 font-medium">Invite sent</p>
                    </div>
                    <button
                      onClick={async () => {
                        await removeCollaborator(selectedRealCollection.id, c.userId);
                        setCollectionCollaborators(prev => prev.filter(x => x.id !== c.id));
                        setPendingCollabIds(prev => { const n = new Set(prev); n.delete(c.userId); return n; });
                      }}
                      className="text-xs font-semibold text-red-500 px-3 py-1.5 rounded-full bg-red-50"
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Search results */}
            <div className="overflow-y-auto flex-1 px-3">
              {inviteResults.map(user => {
                const alreadyAdded = collectionCollaborators.some(c => c.userId === user.id);
                const isPending = pendingCollabIds.has(user.id);
                return (
                  <div key={user.id} className="flex items-center gap-3 py-2.5 px-2">
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{user.name.charAt(0)}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                      {alreadyAdded
                        ? <p className="text-xs font-medium text-amber-500">Invite sent</p>
                        : <p className="text-xs text-gray-400">@{user.username}</p>}
                    </div>
                    {!alreadyAdded && (
                      <button
                        disabled={invitingUserId === user.id}
                        onClick={async () => {
                          if (!appUser) return;
                          setInvitingUserId(user.id);
                          const err = await addCollaborator(selectedRealCollection.id, user.id, appUser.id);
                          if (!err) {
                            const newCollab: CollectionCollaborator = { id: `${Date.now()}`, collectionId: selectedRealCollection.id, userId: user.id, invitedBy: appUser.id, createdAt: new Date().toISOString(), profile: { name: user.name, username: user.username, avatarUrl: user.avatarUrl } };
                            setCollectionCollaborators(prev => [...prev, newCollab]);
                            setPendingCollabIds(prev => new Set(prev).add(user.id));
                          }
                          setInvitingUserId(null);
                        }}
                        className={`text-xs font-bold px-5 py-2 rounded-full flex-shrink-0 transition-colors ${invitingUserId === user.id ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}
                      >{invitingUserId === user.id ? '…' : 'Invite'}</button>
                    )}
                  </div>
                );
              })}
              {inviteSearch && inviteResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No users found on curio</p>
              )}
            </div>

            {/* Invite externally */}
            <div className="border-t border-gray-100 px-3 pb-10 flex-shrink-0">
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/collection/${selectedRealCollection.id}`;
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

  // ── Main Profile View ───────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Top Nav */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={() => setShowFindPeople(true)} className="w-9 h-9 flex items-center justify-center">
          <UserPlus size={22} strokeWidth={1.5} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowNotifications(true); markAsSeen(appUser?.id ?? ''); setUnreadCount(0); }} className="w-9 h-9 flex items-center justify-center relative">
            <Bell size={20} strokeWidth={1.5} className="text-gray-700" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
            )}
          </button>
          <button onClick={() => setShowMenu(true)} className="w-9 h-9 flex items-center justify-center">
            <Menu size={22} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="px-4 pb-4">
        <div className="flex items-start gap-4">
          <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setEditLocation(displayUser.location ?? ''); setEditWebsite(appUser?.website ?? ''); setShowEditProfile(true); }} className="relative flex-shrink-0">
            {(avatarPreview ?? displayUser.avatar)
              ? <img src={avatarPreview ?? displayUser.avatar!} alt={displayUser.name} className="w-16 h-16 rounded-full object-cover object-top" />
              : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-400">{displayUser.name[0]?.toUpperCase()}</div>
            }
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
              <Plus size={11} strokeWidth={2.5} className="text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-base font-bold text-gray-900 leading-tight truncate flex items-center gap-1.5">
              {displayUser.name}
              {displayUser.verified && <BadgeCheck size={15} className="text-blue-500 fill-blue-500 flex-shrink-0" strokeWidth={1.5} />}
            </p>
            <p className="text-xs text-gray-400 truncate">@{displayUser.username}</p>
            {displayUser.bio ? (
              <div className="pt-0.5">
                <p className="text-xs text-gray-500 leading-snug">{displayUser.bio}</p>
              </div>
            ) : (
              <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(''); setEditLocation(displayUser.location ?? ''); setEditWebsite(appUser?.website ?? ''); setShowEditProfile(true); }} className="text-xs text-gray-400 italic pt-0.5">Add a bio…</button>
            )}
            {appUser?.website && (
              <a
                href={appUser.website.startsWith('http') ? appUser.website : `https://${appUser.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-500 font-medium pt-0.5"
              >
                <Globe size={10} strokeWidth={1.5} />
                {appUser.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { value: realPosts.length, label: 'Posts', action: null },
            { value: isNewUser ? (() => { const seen = new Set<string>(); return realPosts.flatMap(p => p.places).filter(pl => { const k = pl.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).length; })() : actualPlacesCount, label: 'Places', action: null },
            { value: isNewUser ? realFollowerCount : displayUser.followersCount, label: 'Followers', action: () => {
              if (isNewUser && appUser) {
                setLoadingFollowList(true);
                getFollowerProfiles(appUser.id).then(p => { setFollowerProfiles(p); setLoadingFollowList(false); });
              }
              setListFollowingIds(new Set(followingProfiles.map(p => p.id)));
              setShowFollowers('followers');
            }},
            { value: isNewUser ? realFollowingCount : displayUser.followingCount, label: 'Following', action: () => {
              if (isNewUser && appUser) {
                setLoadingFollowList(true);
                getFollowingProfiles(appUser.id).then(p => { setFollowingProfiles(p); setLoadingFollowList(false); });
              }
              setShowFollowers('following');
            }},
          ].map(stat => (
            <button key={stat.label} onClick={stat.action ?? undefined} className="text-center">
              <p className="text-base font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </button>
          ))}
        </div>

      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b border-gray-100 border-t">
        {(['Posts', 'Map', 'Collections', 'Guides'] as ProfileTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-gray-900 font-bold border-b-2 border-gray-900 -mb-px' : 'text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      {activeTab === 'Posts' && (
        isNewUser ? (
          realPosts.length > 0 ? (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragStart={() => setIsDraggingPost(true)}
              onDragEnd={handlePostDragEnd}
              onDragCancel={() => setIsDraggingPost(false)}
            >
              <SortableContext items={realPosts.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 gap-px bg-white border-t border-gray-100">
                  {realPosts.map(post => (
                    <SortablePostCell
                      key={post.id}
                      post={post}
                      isDraggingAny={isDraggingPost}
                      likeCount={realPostLikeCounts[post.id] ?? 0}
                      onClick={() => { setSelectedRealPost(post); setShowPostMap(false); setPostComments([]); setPostCommentText(''); }}
                    />
                  )).filter(Boolean)}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <span className="text-3xl">📍</span>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-1.5">No posts yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px] mb-6">Share a place you love and it'll appear here</p>
              <button onClick={() => onNavigate?.('add')} className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold">
                Create first post
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">📍</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No posts yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px] mb-6">Share a place you love and it'll appear here</p>
            <button onClick={() => onNavigate?.('add')} className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold">
              Create first post
            </button>
          </div>
        )
      )}

      {/* Map Tab */}
      {activeTab === 'Map' && (() => {
        const rawPlaces = realPosts.flatMap(p => p.places);
        // Deduplicate by name — keep first occurrence
        const seenNames = new Set<string>();
        const allPlaces = rawPlaces.filter(pl => {
          const key = pl.name.trim().toLowerCase();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        }).map(pl => {
          // Fix US state abbreviations in city
          const city = (pl.city ?? '').trim();
          if (/^[A-Z]{2}$/.test(city) && US_STATES[city]) return { ...pl, city: US_STATES[city] };
          return pl;
        });
        const mapPlaces = allPlaces.filter(pl => pl.lat != null && pl.lng != null).map(pl => ({ id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country }));
        const countriesCount = isNewUser ? new Set(allPlaces.map(pl => pl.country).filter(Boolean)).size : actualCountriesCount;
        const placesCount = isNewUser ? allPlaces.length : actualPlacesCount;
        const postsCount = realPosts.length;
        const q = mapSearch.trim().toLowerCase();
        const filteredPlaces = q
          ? allPlaces.filter(pl => pl.name.toLowerCase().includes(q) || pl.city.toLowerCase().includes(q) || pl.country.toLowerCase().includes(q))
          : allPlaces;
        const byCountry: Record<string, typeof allPlaces> = {};
        filteredPlaces.forEach(pl => {
          const c = pl.country || 'Unknown';
          if (!byCountry[c]) byCountry[c] = [];
          byCountry[c].push(pl);
        });
        const catEmoji = (cat: string) => {
          const m: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', bar: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙', street: '📍' };
          return m[cat?.toLowerCase()] ?? '📍';
        };
        return (
          <div className="pb-10">
            {/* Map with stats overlay */}
            <div className="px-4 pt-4">
              {/* Outer wrapper: relative but NO overflow-hidden so overlays can exceed map bounds */}
              <div className="rounded-2xl relative" style={{ height: 220 }}>
                {/* Map clipped to rounded corners */}
                <div className="rounded-2xl overflow-hidden absolute inset-0">
                  {mapPlaces.length > 0 ? (
                    <Suspense fallback={<div className="h-full bg-gray-100 animate-pulse" />}>
                      <MapView
                        places={mapPlaces}
                        height="220px"
                        hideZoomControls
                        onMapReady={map => { profileMapRef.current = map; }}
                      />
                    </Suspense>
                  ) : (
                    <div className="h-full bg-gray-100 flex items-center justify-center">
                      <p className="text-xs text-gray-400">Your places will appear here as you add posts</p>
                    </div>
                  )}
                </div>
                {/* Full-width gradient — pointer-events-none so map is still pannable */}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl pointer-events-none" />
                {/* Stats — on top of gradient */}
                <div className="absolute bottom-0 left-0 px-4 py-3 pointer-events-none">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-base font-black text-white">{countriesCount}</p>
                      <p className="text-[11px] text-white/70">Countries visited</p>
                    </div>
                    <div>
                      <p className="text-base font-black text-white">{placesCount}</p>
                      <p className="text-[11px] text-white/70">Places</p>
                    </div>
                  </div>
                </div>
                {/* Zoom controls — on top of gradient, bottom-right */}
                {mapPlaces.length > 0 && (
                  <div className="absolute bottom-3 right-3 flex flex-col gap-1" style={{ zIndex: 10 }}>
                    <button
                      onClick={() => profileMapRef.current?.zoomIn()}
                      className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.15)', border: 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <line x1="6" y1="0" x2="6" y2="12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => profileMapRef.current?.zoomOut()}
                      className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.15)', border: 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Search */}
            {allPlaces.length > 0 && (
              <div className="px-4 pt-3">
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                  <Search size={14} strokeWidth={2} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={mapSearch}
                    onChange={e => setMapSearch(e.target.value)}
                    placeholder="Search places…"
                    className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  />
                  {mapSearch && <button onClick={() => setMapSearch('')} className="text-gray-400 text-xs">✕</button>}
                </div>
              </div>
            )}

            {/* Places by country */}
            {allPlaces.length > 0 && (
              <div className="px-4 pt-4 space-y-5">
                {Object.keys(byCountry).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No places match your search</p>
                ) : Object.entries(byCountry).map(([country, cPlaces]) => (
                  <div key={country}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{country}</p>
                      <p className="text-xs text-gray-400">{cPlaces.length} place{cPlaces.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="space-y-2">
                      {cPlaces.map((pl, i) => {
                        const isSaved = postPlaceSavedIds.has(pl.id);
                        return (
                        <div key={`${pl.id}-${i}`} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                          {pl.photoUrl ? (
                            <img src={pl.photoUrl} alt={pl.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-xl">{catEmoji(pl.category)}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{pl.name}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                              <MapPin size={9} strokeWidth={1.5} className="flex-shrink-0" />
                              {[pl.neighborhood, pl.city].filter(Boolean).join(', ') || country}
                            </p>
                            {pl.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji(pl.category)} {pl.category.charAt(0).toUpperCase() + pl.category.slice(1)}</p>}
                          </div>
                          {appUser && !appUser.isDemo && (
                            <button
                              onClick={() => {
                                if (!isSaved) {
                                  setPostPlaceSavedIds(prev => new Set(prev).add(pl.id));
                                  savePlace(appUser.id, pl.id);
                                }
                                setAddToColPlace({ id: pl.id, name: pl.name });
                                setLoadingPlaceCollections(true);
                                getPlaceCollectionIds(pl.id).then(ids => { setPlaceInCollections(ids); setLoadingPlaceCollections(false); });
                              }}
                              className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${isSaved ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                            >
                              {isSaved
                                ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                                : <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />}
                            </button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Collections Tab */}
      {activeTab === 'Collections' && (
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-gray-900">My Collections</p>
            <button onClick={() => { setNewColName(''); setNewColEmoji(''); setNewColDesc(''); setNewColCoverFile(null); setNewColCoverPreview(null); setShowCreateCollection(true); }} className="flex items-center gap-1.5 text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full">
              <Plus size={12} strokeWidth={2.5} /> New
            </button>
          </div>
          {realCollections.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {realCollections.map(col => (
                <button key={col.id} className="text-left" onClick={() => {
                    setSelectedRealCollection(col);
                    setShowColMap(true);
                    setColFilter('all');
                    setCollectionCollaborators([]);
                    setLoadingCollectionPlaces(true);
                    getCollectionPlaces(col.id).then(async places => {
                      const geocoded = await geocodeMissingPlaces(places, GOOGLE_PLACES_KEY);
                      setRealCollectionPlaces(fixAndDeduplicatePlaces(geocoded));
                      setLoadingCollectionPlaces(false);
                    });
                    getCollectionCollaborators(col.id).then(setCollectionCollaborators);
                  }}>
                  <div className="rounded-xl overflow-hidden aspect-square bg-gray-100 flex items-center justify-center relative">
                    {col.coverImageUrl
                      ? <img src={col.coverImageUrl} className="w-full h-full object-cover" />
                      : <span className="text-5xl">{col.emoji || '🗂️'}</span>
                    }
                    {col.coverImageUrl && col.emoji && (
                      <div className="absolute bottom-2 left-2 text-xl leading-none">{col.emoji}</div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{col.placesCount ?? 0} places</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <span className="text-4xl mb-3">🗂️</span>
              <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">Curate your favourite places into shareable collections</p>
            </div>
          )}

          {/* Shared with me */}
          {sharedCollections.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Shared with me</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                {sharedCollections.map(col => (
                  <button key={col.id} className="text-left" onClick={() => {
                    setSelectedRealCollection(col);
                    setShowColMap(true);
                    setColFilter('all');
                    setCollectionCollaborators([]);
                    setLoadingCollectionPlaces(true);
                    getCollectionPlaces(col.id).then(async places => { const geocoded = await geocodeMissingPlaces(places, GOOGLE_PLACES_KEY); setRealCollectionPlaces(fixAndDeduplicatePlaces(geocoded)); setLoadingCollectionPlaces(false); });
                    getCollectionCollaborators(col.id).then(setCollectionCollaborators);
                  }}>
                    <div className="rounded-xl overflow-hidden aspect-square bg-gray-100 flex items-center justify-center relative">
                      {col.coverImageUrl
                        ? <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                        : <span className="text-3xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-2 truncate">{col.name}</p>
                    <p className="text-xs text-gray-400">{col.placesCount} place{col.placesCount !== 1 ? 's' : ''}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Guides Tab */}
      {activeTab === 'Guides' && (
        <div className="px-4 pt-4 pb-6">
          {userGuides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <span className="text-4xl mb-3">📖</span>
              <p className="text-slate-800 font-semibold text-base mb-1.5">No guides yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">Publish a trip from your plans to create a public travel guide</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userGuides.map(guide => (
                <button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide)}
                  className="w-full text-left flex gap-3 bg-gray-50 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
                >
                  {guide.coverUrl ? (
                    <img src={guide.coverUrl} alt={guide.title} className="w-20 h-20 object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 flex items-center justify-center flex-shrink-0 text-3xl">🗺️</div>
                  )}
                  <div className="flex-1 min-w-0 py-3 pr-3">
                    <p className="text-sm font-bold text-gray-900 truncate">{guide.title}</p>
                    {guide.destination && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={10} strokeWidth={1.5} />{guide.destination}
                      </p>
                    )}
                    {guide.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{guide.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guide Detail */}
      {selectedGuide && appUser && (
        <GuideDetail
          guide={selectedGuide}
          currentUserId={appUser.id}
          onClose={() => setSelectedGuide(null)}
          onDeleteGuide={async (id) => {
            await deleteGuide(id);
            setUserGuides(prev => prev.filter(g => g.id !== id));
            setSelectedGuide(null);
          }}
        />
      )}

      {/* Create Collection Sheet */}
      {showCreateCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateCollection(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                onClick={async () => {
                  if (!newColName.trim() || !appUser) return;
                  setSavingCollection(true);
                  let coverUrl: string | null = null;
                  if (newColCoverFile) {
                    const ext = newColCoverFile.name.split('.').pop() ?? 'jpg';
                    const path = `collections/${appUser.id}/${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from('avatars').upload(path, newColCoverFile, { upsert: true, contentType: newColCoverFile.type });
                    if (!upErr) coverUrl = getPublicUrl('avatars', path);
                  }
                  const { data, error } = await createCollection(appUser.id, { name: newColName.trim(), emoji: newColEmoji, description: newColDesc.trim(), cover_image_url: coverUrl });
                  setSavingCollection(false);
                  if (!error && data) {
                    setRealCollections(prev => [data, ...prev]);
                    setShowCreateCollection(false);
                  }
                }}
                disabled={!newColName.trim() || savingCollection}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >
                {savingCollection ? 'Saving…' : 'Create'}
              </button>
            </div>
            <div className="px-4 space-y-4">
              {/* Cover image */}
              {createPortal(
                <input id="new-col-cover-input" type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setNewColCoverFile(f); setNewColCoverPreview(URL.createObjectURL(f));
                }} style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.001, zIndex: -1 }} />,
                document.body
              )}
              <label htmlFor="new-col-cover-input" className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden">
                {newColCoverPreview
                  ? <img src={newColCoverPreview} className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Add cover photo</span></div>
                }
                {newColCoverPreview && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              {/* Name */}
              <input
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                placeholder="Collection name"
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
              />
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description (optional)</p>
                <input
                  value={newColDesc}
                  onChange={e => setNewColDesc(e.target.value)}
                  placeholder="What's this collection about?"
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Bottom Sheet */}
      {showMenu && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMenu(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-4 pt-2 space-y-1">
              {[
                { icon: Edit3, label: 'Edit Profile', action: () => { setShowMenu(false); setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setEditLocation(displayUser.location ?? ''); setEditWebsite(appUser?.website ?? ''); setShowEditProfile(true); } },
                { icon: Share2, label: 'Share Profile', action: async () => {
                  setShowMenu(false);
                  const url = `${window.location.origin}/?u=${displayUser.username}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: displayUser.name, text: `Check out ${displayUser.name} on Curio`, url }); } catch {}
                  } else {
                    try { await navigator.clipboard.writeText(url); setProfileLinkCopied(true); setTimeout(() => setProfileLinkCopied(false), 2000); } catch {}
                  }
                }},
                { icon: Settings, label: 'Settings', action: () => { setShowMenu(false); setShowSettings(true); } },
                { icon: Mail, label: 'Messages', action: () => { setShowMenu(false); onOpenMessages?.(); } },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl active:bg-gray-50 text-left"
                >
                  <item.icon size={20} strokeWidth={1.5} className="text-gray-700" />
                  <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                </button>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl active:bg-gray-50 text-left">
                  <LogOut size={20} strokeWidth={1.5} className="text-red-400" />
                  <span className="text-sm font-semibold text-red-400">Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Sheet ── */}
      {showSettings && (
        <div className="fixed inset-0 z-[210] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSettings(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">Settings</p>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-600" />
              </button>
            </div>
            <div className="px-5 pt-4 space-y-1">
              <button
                onClick={() => { setShowSettings(false); setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setEditLocation(displayUser.location ?? ''); setEditWebsite(appUser?.website ?? ''); setShowEditProfile(true); }}
                className="w-full flex items-center gap-3 py-3.5 border-b border-gray-50"
              >
                <Edit3 size={16} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                <span className="flex-1 text-left text-sm text-gray-900">Edit Profile</span>
                <ChevronRight size={14} strokeWidth={1.5} className="text-gray-300" />
              </button>
              <div className="flex items-center gap-3 py-3.5 border-b border-gray-50">
                <Bell size={16} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-900">Notifications</span>
                <button
                  onClick={() => {
                    const current = localStorage.getItem('curio_notifs') !== 'false';
                    localStorage.setItem('curio_notifs', String(!current));
                    setNotificationsEnabled(!current);
                  }}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${notificationsEnabled ? 'bg-gray-900' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <button
                onClick={() => { setShowSettings(false); onLogout?.(); }}
                className="w-full flex items-center gap-3 py-3.5 text-red-500"
              >
                <LogOut size={16} strokeWidth={1.5} className="flex-shrink-0" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {profileLinkCopied && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          Link copied!
        </div>
      )}

      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />
    </div>
  );
}
