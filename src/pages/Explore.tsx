import { useState, useEffect, useRef } from 'react';
import { Search, X, Check, Mail } from 'lucide-react';
import { getFeedPosts, getFollowing, followUser, unfollowUser, type RealPost } from '../lib/supabase';
import type { AppUser } from '../types';

interface Props {
  onOpenMessages?: () => void;
  appUser?: AppUser;
}

interface FlatPlace {
  placeId: string;
  name: string;
  category: string;
  city: string;
  country: string;
  photoUrl: string;
  indexInPost: number;
  post: RealPost;
}

const categoryChips = [
  { id: 'all',        label: 'All',          emoji: '✨' },
  { id: 'cafe',       label: 'Cafés',        emoji: '☕' },
  { id: 'restaurant', label: 'Food & Drink', emoji: '🍽️' },
  { id: 'hotel',      label: 'Stay',         emoji: '🏨' },
  { id: 'nature',     label: 'Nature',       emoji: '🌿' },
  { id: 'bar',        label: 'Nightlife',    emoji: '🌙' },
  { id: 'shop',       label: 'Shopping',     emoji: '🛍️' },
  { id: 'attraction', label: 'Art & Culture',emoji: '🎨' },
  { id: 'experience', label: 'Experiences',  emoji: '🎭' },
  { id: 'beach',      label: 'Beaches',      emoji: '🌊' },
];

type FeedTab = 'For You' | 'Following';

export default function Explore({ onOpenMessages, appUser }: Props) {
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');
  const [query, setQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<FlatPlace | null>(null);

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

  // Flatten posts → individual place cards
  const allPlaces: FlatPlace[] = posts.flatMap(post =>
    post.places.map((pl, i) => ({
      placeId: pl.id,
      name: pl.name,
      category: pl.category.toLowerCase(),
      city: pl.city,
      country: pl.country,
      photoUrl: pl.photoUrl,
      indexInPost: i,
      post,
    }))
  );

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
        />
      )}
    </div>
  );
}

// ── Place card ───────────────────────────────────────────────────────────────

function PlaceCard({ place, onClick }: { place: FlatPlace; onClick: () => void }) {
  const initials = place.post.profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
        <p className="text-white text-xs font-bold leading-tight truncate">{place.name}</p>
        <p className="text-white/70 text-[10px] truncate">{place.city}</p>
      </div>

      {/* Poster avatar */}
      <div className="absolute top-2 right-2">
        {place.post.profile.avatarUrl ? (
          <img
            src={place.post.profile.avatarUrl}
            alt={place.post.profile.name}
            className="w-6 h-6 rounded-full border border-white/60 object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/20 border border-white/50 flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">{initials}</span>
          </div>
        )}
      </div>

      {/* Multi-place indicator */}
      {place.post.places.length > 1 && (
        <div className="absolute top-2 left-2 bg-black/40 rounded-full px-1.5 py-0.5">
          <span className="text-white text-[9px] font-semibold">{place.post.places.length} places</span>
        </div>
      )}
    </button>
  );
}

// ── Post modal ───────────────────────────────────────────────────────────────

function PostModal({ place, isFollowing, isOwnPost, onToggleFollow, onClose }: {
  place: FlatPlace;
  isFollowing: boolean;
  isOwnPost: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
}) {
  const { post, indexInPost } = place;
  const [currentIndex, setCurrentIndex] = useState(indexInPost);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initials = post.profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Carousel */}
        <div className="relative flex-shrink-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {post.places.map((pl) => (
              <div key={pl.id} className="flex-shrink-0 w-full relative" style={{ aspectRatio: '4/3' }}>
                {pl.photoUrl ? (
                  <img src={pl.photoUrl} alt={pl.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white font-bold text-base leading-tight">{pl.name}</p>
                  <p className="text-white/70 text-sm">{pl.city}{pl.country ? `, ${pl.country}` : ''}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center"
          >
            <X size={16} strokeWidth={2} className="text-white" />
          </button>

          {/* Carousel dots */}
          {post.places.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-1">
              {post.places.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Post details */}
        <div className="overflow-y-auto px-4 py-3 pb-8">
          {/* Profile row */}
          <div className="flex items-center gap-3 mb-3">
            {post.profile.avatarUrl ? (
              <img src={post.profile.avatarUrl} alt={post.profile.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-slate-500">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{post.profile.name}</p>
              <p className="text-xs text-slate-400">@{post.profile.username}</p>
            </div>
            {!isOwnPost && (
              <button
                onClick={onToggleFollow}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-slate-900 text-white'
                }`}
              >
                {isFollowing ? <><Check size={12} strokeWidth={2} /> Following</> : 'Follow'}
              </button>
            )}
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="text-sm text-slate-700 mb-2 leading-relaxed">{post.caption}</p>
          )}

          {/* Hashtags */}
          {post.hashtags.length > 0 && (
            <p className="text-sm text-blue-500 mb-3">{post.hashtags.map(h => `#${h}`).join(' ')}</p>
          )}

          {/* Places list — tap to jump carousel */}
          {post.places.length > 1 && (
            <div className="space-y-1.5 mt-1">
              {post.places.map((pl, i) => (
                <button
                  key={pl.id}
                  onClick={() => scrollTo(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    i === currentIndex ? 'bg-slate-100' : 'active:bg-slate-50'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${i === currentIndex ? 'bg-slate-900' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{pl.name}</p>
                    <p className="text-xs text-slate-400 truncate">{pl.city}{pl.country ? `, ${pl.country}` : ''}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 capitalize flex-shrink-0">{pl.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
