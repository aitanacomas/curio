import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import UserProfile from './UserProfile';
import { Search, X, Mail, MapPin, Bookmark, BookmarkCheck, Map, Heart, MessageCircle, Send, Plus, Check } from 'lucide-react';
import { getFeedPosts, getFollowing, followUser, unfollowUser, searchProfiles, savePlace, unsavePlace, likePost, unlikePost, savePost, unsavePost, getPostComments, addComment, getSavedPlaces, getUserCollections, addPlaceToCollection, createCollection, getConversations, getOrCreateConversation, sendMessage, removePlaceFromCollection, type RealPost, type FollowProfile, type PostComment, type RealCollection, type Conversation } from '../lib/supabase';

const MapView = lazy(() => import('../components/MapView'));

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

function resolveCity(city: string | undefined): string {
  if (!city) return '';
  const c = city.trim();
  return (/^[A-Z]{2}$/.test(c) && US_STATES[c]) ? US_STATES[c] : c;
}
import type { AppUser } from '../types';

interface Props {
  onOpenMessages?: () => void;
  appUser?: AppUser;
}

interface FlatPlace {
  placeId: string;
  name: string;
  category: string;
  neighborhood?: string;
  city: string;
  country: string;
  photoUrl: string;
  indexInPost: number;
  post: RealPost;
}

const categoryChips = [
  { id: 'all',        label: 'All',          emoji: '✨' },
  { id: 'restaurant', label: 'Restaurant',   emoji: '🍽️' },
  { id: 'cafe',       label: 'Café',         emoji: '☕' },
  { id: 'bar',        label: 'Bar',          emoji: '🍸' },
  { id: 'food',       label: 'Food',         emoji: '🍕' },
  { id: 'hotel',      label: 'Stay',         emoji: '🏨' },
  { id: 'attraction', label: 'Attraction',   emoji: '🏛️' },
  { id: 'nature',     label: 'Nature',       emoji: '🌿' },
  { id: 'beach',      label: 'Beach',        emoji: '🏖️' },
  { id: 'shop',       label: 'Shop',         emoji: '🛍️' },
  { id: 'experience', label: 'Experience',   emoji: '🗺️' },
  { id: 'sports',     label: 'Sports',       emoji: '🎾' },
  { id: 'wellness',   label: 'Wellness',     emoji: '💆' },
  { id: 'street',     label: 'Street',       emoji: '🏙️' },
  { id: 'event',      label: 'Event',        emoji: '🎟️' },
];

type FeedTab = 'For You' | 'Following';

export default function Explore({ onOpenMessages, appUser }: Props) {
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState<FollowProfile[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<FlatPlace | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      getFeedPosts(),
      appUser?.id ? getFollowing(appUser.id) : Promise.resolve(new Set<string>()),
    ]).then(([fetchedPosts, followingSet]) => {
      setPosts(fetchedPosts);
      setFollowing(followingSet);
      setLoading(false);
    });
  }, [appUser?.id]);

  // Debounced user search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setUserResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchProfiles(query, appUser?.id ?? '');
      setUserResults(results);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, appUser?.id]);

  // Flatten posts → individual place cards, shuffled once when posts load
  const allPlaces: FlatPlace[] = useMemo(() => {
    const flat = posts.flatMap(post =>
      post.places.map((pl, i) => ({
        placeId: pl.id,
        name: pl.name,
        category: pl.category.toLowerCase(),
        neighborhood: pl.neighborhood,
        city: pl.city,
        country: pl.country,
        photoUrl: pl.photoUrl,
        indexInPost: i,
        post,
      }))
    );
    // Fisher-Yates shuffle
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    return flat;
  }, [posts]);

  const tabFiltered = activeTab === 'Following'
    ? allPlaces.filter(p => following.has(p.post.userId))
    : allPlaces;

  const categoryFiltered = activeCategory === 'all'
    ? tabFiltered
    : tabFiltered.filter(p => p.category === activeCategory);

  const filtered = query
    ? categoryFiltered.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.city.toLowerCase().includes(query.toLowerCase()) ||
        p.post.profile.name.toLowerCase().includes(query.toLowerCase()) ||
        p.post.profile.username.toLowerCase().includes(query.toLowerCase())
      )
    : categoryFiltered;

  const toggleFollow = async (userId: string) => {
    if (!appUser?.id) return;
    if (following.has(userId)) {
      setFollowing(prev => { const s = new Set(prev); s.delete(userId); return s; });
      await unfollowUser(appUser.id, userId);
    } else {
      setFollowing(prev => new Set(prev).add(userId));
      await followUser(appUser.id, userId);
    }
  };

  if (viewingUserId && appUser) {
    return <UserProfile userId={viewingUserId} currentUserId={appUser.id} onBack={() => setViewingUserId(null)} onFollowChange={() => {}} onMessage={onOpenMessages} />;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">curio</h1>
          {onOpenMessages && (
            <button onClick={onOpenMessages} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
              <Mail size={17} strokeWidth={1.5} className="text-gray-700" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cities, places, people..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-5 mb-3">
          {(['For You', 'Following'] as FeedTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === tab ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {categoryChips.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveCategory(chip.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCategory === chip.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* User search results */}
      {query.trim() && userResults.length > 0 && (
        <div className="px-4 pt-3 pb-4 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">People</p>
          <div className="space-y-3">
            {userResults.map(user => {
              const isFollowing = following.has(user.id);
              const isOwnProfile = appUser?.id === user.id;
              return (
                <div key={user.id} className="flex items-center gap-3">
                  <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setViewingUserId(user.id)}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-gray-400 text-sm font-semibold">{user.name?.[0]?.toUpperCase()}</span></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                    </div>
                  </button>
                  {!isOwnProfile && appUser?.id && (
                    <button
                      onClick={() => toggleFollow(user.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-gray-900 text-white'}`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-3xl mb-3">🌍</p>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              {activeTab === 'Following' ? 'No places from people you follow' : 'No places yet'}
            </p>
            <p className="text-xs text-gray-400 max-w-[200px]">
              {activeTab === 'Following'
                ? 'Follow more people to see their places here'
                : 'Be the first to share a place on curio'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(place => (
              <PlaceCard
                key={place.placeId}
                place={place}
                onClick={() => setSelectedPlace(place)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Post modal */}
      {selectedPlace && (
        <PostModal
          place={selectedPlace}
          isFollowing={following.has(selectedPlace.post.userId)}
          isOwnPost={appUser?.id === selectedPlace.post.userId}
          onToggleFollow={() => toggleFollow(selectedPlace.post.userId)}
          onClose={() => setSelectedPlace(null)}
          userId={appUser?.id}
          onViewUser={(uid) => { setSelectedPlace(null); setViewingUserId(uid); }}
        />
      )}
    </div>
  );
}

// ── Place card ───────────────────────────────────────────────────────────────

function PlaceCard({ place, onClick }: { place: FlatPlace; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-95 transition-transform">
      {place.photoUrl ? (
        <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
          <span className="text-slate-400 text-xs">No photo</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Place info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-xs font-bold leading-tight truncate">{place.name.split(',')[0].trim()}</p>
        <p className="text-white/70 text-[10px] truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}</p>
      </div>
    </button>
  );
}

// ── Post modal ───────────────────────────────────────────────────────────────

const modalCatEmoji: Record<string, string> = {
  cafe: '☕', coffee: '☕', restaurant: '🍽️', dining: '🍽️', bar: '🍸',
  hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️',
  nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙', beach: '🏖️',
  sports: '🎾', wellness: '💆', street: '🏙️', event: '🎟️', food: '🍕',
};

function PostModal({ place, isFollowing, isOwnPost, onToggleFollow, onClose, userId, onViewUser }: {
  place: FlatPlace;
  isFollowing: boolean;
  isOwnPost: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  userId?: string;
  onViewUser?: (userId: string) => void;
}) {
  const { post, indexInPost } = place;
  const [currentIndex, setCurrentIndex] = useState(indexInPost);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const commentsTopRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isPostSaved, setIsPostSaved] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState<string | null>(null); // placeId being saved to collection
  const [saveSheetColIds, setSaveSheetColIds] = useState<Set<string>>(new Set());
  const [showNewSaveCol, setShowNewSaveCol] = useState(false);
  const [newSaveColName, setNewSaveColName] = useState('');
  const [savingNewSaveCol, setSavingNewSaveCol] = useState(false);
  const [userCollectionList, setUserCollectionList] = useState<RealCollection[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareSearchResults, setShareSearchResults] = useState<FollowProfile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);
  const [shareSentTo, setShareSentTo] = useState<Set<string>>(new Set());
  const [showPostSaveColSheet, setShowPostSaveColSheet] = useState(false);
  const [postSaveColIds, setPostSaveColIds] = useState<Set<string>>(new Set());
  const [allPlacesSaved, setAllPlacesSaved] = useState(false);
  const shareSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initials = post.profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Deduplicate places by name
  const uniquePlaces = post.places.filter((pl, i, arr) =>
    arr.findIndex(x => x.name.split(',')[0].trim().toLowerCase() === pl.name.split(',')[0].trim().toLowerCase()) === i
  );

  // Load user's saved places, collections and conversations on mount
  const [conversations, setConversations] = useState<Conversation[]>([]);
  useEffect(() => {
    if (userId) {
      getSavedPlaces(userId).then(sp => {
        setSavedPlaceIds(new Set(sp.map(p => p.id)));
        setAllPlacesSaved(post.places.length > 0 && post.places.every(p => sp.some(s => s.id === p.id)));
      });
      getUserCollections(userId).then(setUserCollectionList);
      getConversations(userId).then(setConversations);
    }
  }, [userId]);

  // Load comments when comment section is opened
  useEffect(() => {
    if (showComments) {
      getPostComments(post.id).then(setComments);
    }
  }, [showComments, post.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = indexInPost * scrollRef.current.offsetWidth;
    }
  }, [indexInPost]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
      setCurrentIndex(index);
    }
  };

  const scrollTo = (i: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' });
      setCurrentIndex(i);
    }
  };

  const toggleSavePlace = async (placeId: string) => {
    if (!userId) return;
    if (savedPlaceIds.has(placeId)) {
      setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(placeId); return n; });
      await unsavePlace(userId, placeId);
    } else {
      setSavedPlaceIds(prev => new Set(prev).add(placeId));
      await savePlace(userId, placeId);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full overflow-y-auto" style={{ maxWidth: '384px', maxHeight: '96vh' }} onClick={e => e.stopPropagation()}>
        <div className="bg-white w-full rounded-t-[2rem]">

          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="w-9 h-1 bg-white/70 rounded-full" />
          </div>

          {/* Photo carousel — scrolls with the rest */}
          <div className="relative overflow-hidden rounded-t-[2rem]">

            {/* Profile pill — top left */}
            <button
              onClick={() => onViewUser?.(post.userId)}
              className="absolute top-4 left-3 z-20 flex items-center gap-2 bg-black/55 backdrop-blur-md rounded-full pl-1 pr-3 py-1 active:opacity-80"
            >
              {post.profile.avatarUrl
                ? <img src={post.profile.avatarUrl} alt={post.profile.name} className="w-6 h-6 rounded-full object-cover object-top border border-white/30 flex-shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><span className="text-white text-[9px] font-bold">{initials}</span></div>
              }
              <span className="text-white text-xs font-semibold leading-none">{post.profile.name}</span>
            </button>
            {/* Close button — top right */}
            <button
              onClick={onClose}
              className="absolute top-4 right-3 z-20 w-8 h-8 bg-black/55 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <X size={15} strokeWidth={2.5} className="text-white" />
            </button>

            {/* Swipeable photos */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {uniquePlaces.map((pl) => (
                <div key={pl.id} className="flex-shrink-0 w-full" style={{ aspectRatio: '3/4' }}>
                  {pl.photoUrl
                    ? <img src={pl.photoUrl} alt={pl.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-100" />
                  }
                </div>
              ))}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

            {/* Bottom bar: place name left, dots right — same row */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 flex items-end justify-between gap-3 pointer-events-none">
              <div className="min-w-0">
                <p className="text-white font-semibold text-xs leading-tight truncate">{uniquePlaces[currentIndex]?.name.split(',')[0].trim()}</p>
                <p className="text-white/70 text-[10px] mt-0.5 truncate">
                  {[resolveCity(uniquePlaces[currentIndex]?.city), uniquePlaces[currentIndex]?.country].filter(Boolean).join(', ')}
                </p>
              </div>
              {uniquePlaces.length > 1 && (
                <div className="flex gap-1.5 items-center flex-shrink-0 pointer-events-auto pb-0.5">
                  {uniquePlaces.length <= 5
                    ? uniquePlaces.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollTo(i)}
                          className={`rounded-full transition-all duration-200 ${i === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                        />
                      ))
                    : <span className="text-white text-[11px] font-semibold bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 leading-none">
                        {currentIndex + 1} / {uniquePlaces.length}
                      </span>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Content below photo — no inner scroll, flows naturally */}
          <div ref={scrollableRef}>

            {/* Actions row */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-5">
                <button
                  className="flex items-center gap-1.5"
                  onClick={() => {
                    if (!userId) return;
                    setIsLiked(p => !p);
                    setLikeCount((p: number) => p + (isLiked ? -1 : 1));
                    isLiked ? unlikePost(userId, post.id) : likePost(userId, post.id);
                  }}
                >
                  <Heart size={22} strokeWidth={1.5} className={isLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-800'} />
                  <span className="text-sm font-medium text-gray-500">{likeCount}</span>
                </button>
                <button className="flex items-center gap-1.5" onClick={() => {
                  setShowComments(p => !p);
                }}>
                  <MessageCircle size={22} strokeWidth={1.5} className="text-gray-800" />
                  <span className="text-sm font-medium text-gray-500">{comments.length}</span>
                </button>
                <button onClick={() => setShowShareSheet(true)}>
                  <Send size={21} strokeWidth={1.5} className="text-gray-800" />
                </button>
              </div>
              <button
                onClick={async () => {
                  if (!userId) return;
                  if (allPlacesSaved) {
                    for (const p of post.places) {
                      setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                      unsavePlace(userId, p.id);
                    }
                    setAllPlacesSaved(false);
                  } else {
                    for (const p of post.places) {
                      setSavedPlaceIds(prev => new Set(prev).add(p.id));
                      savePlace(userId, p.id);
                    }
                    setAllPlacesSaved(true);
                    setShowPostSaveColSheet(true);
                  }
                }}
              >
                {allPlacesSaved
                  ? <BookmarkCheck size={22} strokeWidth={1.5} className="text-gray-900" />
                  : <Bookmark size={22} strokeWidth={1.5} className="text-gray-700" />
                }
              </button>
            </div>

            {/* Caption + hashtags */}
            {(post.caption || post.hashtags.length > 0) && (
              <div className="px-5 pb-5">
                {post.caption && <p className="text-sm text-gray-800 leading-relaxed">{post.caption}</p>}
                {post.hashtags.length > 0 && (() => {
                  const seen = new Set<string>();
                  const unique = post.hashtags.filter(h => { const k = h.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
                  return <p className="text-xs text-orange-400 mt-2">{unique.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>;
                })()}
              </div>
            )}

            {/* Places list */}
            {uniquePlaces.length > 0 && (
              <div className="px-5 pt-4 border-t border-gray-100">
                {(() => {
                  const mapPlaces = uniquePlaces.filter(p => p.lat && p.lng).map(p => ({
                    id: p.id, name: p.name.split(',')[0].trim(), lat: p.lat!, lng: p.lng!,
                    category: p.category, image: p.photoUrl, neighbourhood: p.neighborhood ?? '', city: p.city ?? '', country: p.country ?? '',
                    savedCount: 0, bookingAvailable: false, rating: null,
                  }));
                  const centerPlace = uniquePlaces.find(p => p.lat && p.lng);
                  const hasCoords = mapPlaces.length > 0 && centerPlace;
                  return (
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {uniquePlaces.length} place{uniquePlaces.length !== 1 ? 's' : ''}
                      </p>
                      {hasCoords && (
                        <button
                          onClick={() => setShowMap(p => !p)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <Map size={11} strokeWidth={1.5} />
                          {showMap ? 'Hide map' : 'View on map'}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Mini map */}
                {showMap && (() => {
                  const mapPlaces = uniquePlaces.filter(p => p.lat && p.lng).map(p => ({
                    id: p.id, name: p.name.split(',')[0].trim(), lat: p.lat!, lng: p.lng!,
                    category: p.category, image: p.photoUrl, neighbourhood: p.neighborhood ?? '', city: p.city ?? '', country: p.country ?? '',
                    savedCount: 0, bookingAvailable: false, rating: null,
                  }));
                  const centerPlace = uniquePlaces.find(p => p.lat && p.lng);
                  if (!centerPlace || mapPlaces.length === 0) return null;
                  return (
                    <div className="mb-3 rounded-2xl overflow-hidden">
                      <Suspense fallback={<div className="h-44 bg-gray-100 animate-pulse rounded-2xl" />}>
                        <MapView places={mapPlaces} center={[centerPlace.lat!, centerPlace.lng!]} zoom={13} height="176px" />
                      </Suspense>
                    </div>
                  );
                })()}
                <div className="space-y-2.5 pb-5">
                {uniquePlaces.map((pl, i) => {
                  const emoji = modalCatEmoji[pl.category?.toLowerCase() ?? ''] ?? '📍';
                  const isSaved = savedPlaceIds.has(pl.id);
                  return (
                    <div
                      key={pl.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3"
                    >
                      <button onClick={() => scrollTo(i)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {pl.photoUrl
                          ? <img src={pl.photoUrl} alt={pl.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                          : <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-xl">{emoji}</span></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{pl.name.split(',')[0].trim()}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                            <MapPin size={9} strokeWidth={1.5} className="flex-shrink-0" />
                            {[pl.neighborhood, resolveCity(pl.city)].filter(Boolean).join(', ') || pl.country}
                          </p>
                          {pl.category && (
                            <p className="text-xs text-gray-400 mt-0.5">{emoji} {pl.category.charAt(0).toUpperCase() + pl.category.slice(1)}</p>
                          )}
                        </div>
                      </button>
                      {userId && (
                        <button
                          onClick={async () => {
                            if (!userId) return;
                            if (isSaved) {
                              toggleSavePlace(pl.id);
                            } else {
                              setSavedPlaceIds(prev => new Set(prev).add(pl.id));
                              savePlace(userId, pl.id);
                              setShowSaveSheet(pl.id);
                            }
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${isSaved ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                        >
                          {isSaved
                            ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                            : <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Comments section */}
            {showComments && comments.length > 0 && (
              <div ref={commentsTopRef} className="px-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</p>
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      {c.profile.avatarUrl
                        ? <img src={c.profile.avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                        : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[10px] font-semibold text-gray-500">{c.profile.name[0]}</span></div>
                      }
                      <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl px-3 py-2.5">
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-xs font-semibold text-gray-900">{c.profile.name.split(' ')[0]}</p>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comment input */}
            {userId && (
              <div className="px-5 pt-4 pb-6">
                <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && commentText.trim() && !commentSending) {
                        setCommentSending(true);
                        const c = await addComment(userId, post.id, commentText.trim());
                        if (c) { setComments(prev => [...prev, c]); setShowComments(true); }
                        setCommentText('');
                        setCommentSending(false);
                      }
                    }}
                    placeholder="Add a comment…"
                    className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                  />
                  {commentText.trim() && (
                    <button
                      disabled={commentSending}
                      onClick={async () => {
                        if (!commentText.trim() || commentSending) return;
                        setCommentSending(true);
                        const c = await addComment(userId, post.id, commentText.trim());
                        if (c) { setComments(prev => [...prev, c]); setShowComments(true); }
                        setCommentText('');
                        setCommentSending(false);
                      }}
                      className="text-xs font-bold text-gray-900 disabled:text-gray-300"
                    >Post</button>
                  )}
                </div>
              </div>
            )}
            <div ref={commentsEndRef} />
          </div>
        </div>
      </div>

      {/* Save-to-collection sheet */}
      {showSaveSheet && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50" onClick={() => { setShowSaveSheet(null); setSaveSheetColIds(new Set()); setShowNewSaveCol(false); setNewSaveColName(''); }}>
          <div className="w-full bg-white rounded-t-3xl pb-8" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            {/* User's collections */}
            <div className="px-4 space-y-2 max-h-60 overflow-y-auto">
              {userCollectionList.map(col => {
                const inCol = saveSheetColIds.has(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={async () => {
                      if (!showSaveSheet) return;
                      if (inCol) {
                        setSaveSheetColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                      } else {
                        await addPlaceToCollection(col.id, showSaveSheet);
                        setSaveSheetColIds(prev => new Set(prev).add(col.id));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {col.coverImageUrl
                        ? <img src={col.coverImageUrl} className="w-full h-full object-cover" />
                        : <span className="text-xl">{col.emoji || '🗂️'}</span>}
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
            {/* New collection quick-create */}
            <div className="px-4 pt-3">
              {showNewSaveCol ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newSaveColName}
                    onChange={e => setNewSaveColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newSaveColName.trim() && userId) {
                        setSavingNewSaveCol(true);
                        const { data, error } = await createCollection(userId, { name: newSaveColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingNewSaveCol(false);
                        if (!error && data) { setUserCollectionList(prev => [data, ...prev]); setNewSaveColName(''); setShowNewSaveCol(false); }
                      }
                      if (e.key === 'Escape') { setShowNewSaveCol(false); setNewSaveColName(''); }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none"
                  />
                  <button
                    disabled={!newSaveColName.trim() || savingNewSaveCol}
                    onClick={async () => {
                      if (!newSaveColName.trim() || !userId) return;
                      setSavingNewSaveCol(true);
                      const { data, error } = await createCollection(userId, { name: newSaveColName.trim(), emoji: '', description: '', cover_image_url: null });
                      setSavingNewSaveCol(false);
                      if (!error && data) { setUserCollectionList(prev => [data, ...prev]); setNewSaveColName(''); setShowNewSaveCol(false); }
                    }}
                    className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >{savingNewSaveCol ? '…' : 'Create'}</button>
                </div>
              ) : (
                <button onClick={() => setShowNewSaveCol(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Plus size={15} strokeWidth={2} className="text-gray-600" />
                  </div>
                  New collection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post save-to-collection sheet */}
      {showPostSaveColSheet && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50" onClick={() => { setShowPostSaveColSheet(false); setPostSaveColIds(new Set()); }}>
          <div className="w-full bg-white rounded-t-3xl pb-8" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add {post.places.length} place{post.places.length !== 1 ? 's' : ''} to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-60 overflow-y-auto">
              {userCollectionList.map(col => {
                const inCol = postSaveColIds.has(col.id);
                return (
                  <button key={col.id} onClick={async () => {
                    if (inCol) {
                      for (const p of post.places) await removePlaceFromCollection(col.id, p.id);
                      setPostSaveColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                    } else {
                      for (const p of post.places) await addPlaceToCollection(col.id, p.id);
                      setPostSaveColIds(prev => new Set(prev).add(col.id));
                    }
                  }} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
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
              <button onClick={() => setShowNewSaveCol(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share sheet */}
      {showShareSheet && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={() => { setShowShareSheet(false); setShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }}>
          <div className="w-full bg-white rounded-t-3xl" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowShareSheet(false); setShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            {/* Search bar */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={shareSearchQuery}
                  onChange={e => {
                    const q = e.target.value;
                    setShareSearchQuery(q);
                    if (shareSearchTimerRef.current) clearTimeout(shareSearchTimerRef.current);
                    if (!q.trim()) { setShareSearchResults([]); setSearchingShare(false); return; }
                    setSearchingShare(true);
                    shareSearchTimerRef.current = setTimeout(async () => {
                      if (!userId) return;
                      const results = await searchProfiles(q, userId);
                      setShareSearchResults(results);
                      setSearchingShare(false);
                    }, 300);
                  }}
                  placeholder="Search people..."
                  className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                />
                {searchingShare && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
              </div>
            </div>
            {/* People list */}
            {(() => {
              const showSearch = shareSearchQuery.trim().length > 0;
              const list = showSearch ? shareSearchResults : conversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && shareSearchResults.length === 0 && !searchingShare) return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              if (!showSearch && conversations.length === 0) return null;
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const sent = shareSentTo.has(person.id);
                    const ini = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button key={person.id} onClick={async () => {
                        if (sent || !userId) return;
                        const convId = await getOrCreateConversation(userId, person.id);
                        if (convId) {
                          await sendMessage(convId, userId, `Check this out on curio: ${window.location.origin}/?post=${post.id}`);
                          setShareSentTo(prev => new Set(prev).add(person.id));
                        }
                      }} className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl active:bg-gray-50 text-left">
                        {person.avatarUrl
                          ? <img src={person.avatarUrl} className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0" />
                          : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{ini}</div>}
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
            {/* Divider + external options */}
            <div className="mt-2 border-t border-gray-100 px-3 pb-10">
              <button className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50" onClick={async () => {
                const url = `${window.location.origin}/?post=${post.id}`;
                if (navigator.share) { try { await navigator.share({ url, title: 'Check this out on curio' }); } catch {} }
                else { navigator.clipboard.writeText(url).catch(() => {}); }
              }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Send size={16} strokeWidth={1.5} className="text-gray-700" /></div>
                <span className="text-sm font-semibold text-gray-900">Share externally</span>
              </button>
              <button className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?post=${post.id}`).catch(() => {});
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 1500);
              }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {linkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-700"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                </div>
                <span className="text-sm font-semibold text-gray-900">{linkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
