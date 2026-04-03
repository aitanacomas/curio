import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, MapPin, Map, MessageCircle, Share2, Bookmark, BookmarkCheck, Plus, Heart, Send, Search } from 'lucide-react';
import { supabase, getUserPosts, getFollowCounts, getProfile, getUserCollections, getCollectionPlaces, geocodeMissingPlaces, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, subscribeToCollection, unsubscribeFromCollection, isSubscribedToCollection, createCollection, getPublicUrl, likePost, unlikePost, getLikedPosts, getPostLikeCounts, savePlace, unsavePlace, getSavedPlaceIds, getPostComments, addComment, deleteComment, getPlans, type RealPost, type RealCollection, type RealPostPlace, type PostComment, type Plan } from '../lib/supabase';
import { googleTypesToCategory } from '../lib/placeUtils';

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

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
};
import ImageCarousel from '../components/ImageCarousel';

const MapView = lazy(() => import('../components/MapView'));

interface Props {
  userId: string;
  currentUserId: string;
  onBack: () => void;
  onFollowChange?: (delta: number) => void;
  onMessage?: (userId: string) => void;
}

type ProfileTab = 'Posts' | 'Map' | 'Collections';

export default function UserProfile({ userId, currentUserId, onBack, onFollowChange, onMessage }: Props) {
  const [profile, setProfile] = useState<{ name: string; username: string; avatarUrl: string | null; bio?: string | null; location?: string | null } | null>(null);
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [selectedPost, setSelectedPost] = useState<RealPost | null>(null);
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<{ id: string; name: string; username: string; avatarUrl: string | null }[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [unfollowing, setUnfollowing] = useState(false);
  const [collections, setCollections] = useState<RealCollection[]>([]);
  const [viewingCollection, setViewingCollection] = useState<RealCollection | null>(null);
  const [collectionPlaces, setCollectionPlaces] = useState<RealPostPlace[]>([]);
  const [collectionPlacesLoading, setCollectionPlacesLoading] = useState(false);
  const [colFilter, setColFilter] = useState('all');
  const [showColMap, setShowColMap] = useState(true);
  const [enrichingMap, setEnrichingMap] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [myCollections, setMyCollections] = useState<RealCollection[]>([]);
  const [savingPlace, setSavingPlace] = useState<{ id: string; name: string } | null>(null);
  const [placeInMyCollections, setPlaceInMyCollections] = useState<Set<string>>(new Set());
  const [loadingPlaceInCols, setLoadingPlaceInCols] = useState(false);
  const [showInlineNewCol, setShowInlineNewCol] = useState(false);
  const [inlineNewColName, setInlineNewColName] = useState('');
  const [savingInlineCol, setSavingInlineCol] = useState(false);
  const [showSaveAllPicker, setShowSaveAllPicker] = useState(false);
  const [saveAllColIds, setSaveAllColIds] = useState<Set<string>>(new Set());
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [postLikeCounts, setPostLikeCounts] = useState<Record<string, number>>({});
  const [showPostMap, setShowPostMap] = useState(false);
  const [postPlaceSavedIds, setPostPlaceSavedIds] = useState<Set<string>>(new Set());
  const [allSavedIds, setAllSavedIds] = useState<Set<string>>(new Set());
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [postCommentText, setPostCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const postCommentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      getProfile(userId),
      getUserPosts(userId),
      getFollowCounts(userId),
      supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', userId).maybeSingle(),
      getUserCollections(userId),
    ]).then(([prof, p, counts, { data: followRow }, cols]) => {
      setProfile(prof ? { name: prof.name ?? '', username: prof.username ?? '', avatarUrl: prof.avatar_url ?? null, bio: prof.bio ?? null, location: prof.location ?? null } : null);
      setPosts(p);
      setCollections(cols);
      setFollowerCount(counts.followers);
      setFollowingCount(counts.following);
      setFollowing(!!followRow);
      setLoadingPosts(false);
    });
    // Fetch current user's own collections for the "save place" picker
    getUserCollections(currentUserId).then(setMyCollections);
    // Fetch current user's avatar for comment input
    getProfile(currentUserId).then(p => setCurrentUserAvatar(p?.avatar_url ?? null));
    // Fetch likes
    getLikedPosts(currentUserId).then(setLikedPosts);
    // Fetch all saved place IDs for bookmark state
    getSavedPlaceIds(currentUserId).then(setAllSavedIds);
  }, [userId, currentUserId]);

  // Load like counts + saved place ids whenever a post is opened
  useEffect(() => {
    if (!selectedPost) return;
    getPostLikeCounts([selectedPost.id]).then(counts => setPostLikeCounts(prev => ({ ...prev, ...counts })));
    // Load saved place ids for this post
    Promise.all(selectedPost.places.map(p => p.id)).then(async ids => {
      const saved = new Set<string>();
      await Promise.all(ids.map(async id => {
        const cols = await getPlaceCollectionIds(id);
        if (cols.size > 0) saved.add(id);
      }));
      setPostPlaceSavedIds(saved);
    });
    // Auto-enrich any places missing neighbourhood, city, category, or coordinates (in-memory only for other users' posts)
    const isAbbreviation = (s: string) => /^[A-Z]{2}$/.test((s ?? '').trim());
    const missingData = selectedPost.places.filter(pl => !pl.neighborhood || !pl.city || !pl.category || pl.lat == null || isAbbreviation(pl.city));
    if (missingData.length === 0) return;
    const GKEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
    (async () => {
      const normalCity = (c: string) => ({ cdmx: 'Mexico City', 'ciudad de mexico': 'Mexico City', 'ciudad de méxico': 'Mexico City', nyc: 'New York City', la: 'Los Angeles', sf: 'San Francisco', dc: 'Washington DC' }[c?.toLowerCase()] ?? c);
      const searchPlace = async (textQuery: string) => {
        const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'places.addressComponents,places.types,places.location' },
          body: JSON.stringify({ textQuery, languageCode: 'en' }),
        });
        const d = await r.json();
        return d.places?.[0] ?? null;
      };
      const enrichResults = await Promise.all(missingData.map(async (pl) => {
        if (!pl.name) return null;
        try {
          const city = normalCity(pl.city);
          let place = await searchPlace([pl.name, city, pl.country].filter(Boolean).join(', '))
            ?? await searchPlace([pl.name, pl.country].filter(Boolean).join(', '))
            ?? await searchPlace(pl.name);
          if (!place) return null;
          const comps: { types: string[]; longText?: string; shortText?: string }[] = place.addressComponents ?? [];
          const types: string[] = place.types ?? [];
          const find = (...t: string[]) => { const c = comps.find(c => t.some(x => c.types?.includes(x))); return c ? (c.longText || c.shortText || '') : ''; };
          const neighborhood = find('sublocality_level_1') || find('sublocality_level_2') || find('neighborhood') || find('sublocality');
          const resolvedCity = find('postal_town') || find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1');
          const country = find('country');
          const fix: Record<string, any> = {};
          if (neighborhood && !pl.neighborhood) fix.neighborhood = neighborhood;
          if (resolvedCity && (!pl.city || isAbbreviation(pl.city))) fix.city = resolvedCity;
          if (country && !pl.country) fix.country = country;
          if (!pl.category && types.length) fix.category = googleTypesToCategory(types);
          if (pl.lat == null && place.location?.latitude != null) fix.lat = place.location.latitude;
          if (pl.lng == null && place.location?.longitude != null) fix.lng = place.location.longitude;
          return Object.keys(fix).length ? { id: pl.id, fix } : null;
        } catch { return null; }
      }));
      const fixes: Record<string, Record<string, any>> = {};
      enrichResults.forEach(r => { if (r) fixes[r.id] = r.fix; });
      if (Object.keys(fixes).length > 0) {
        setPosts(prev => prev.map(post => ({
          ...post,
          places: post.places.map(pl => fixes[pl.id] ? { ...pl, ...fixes[pl.id] } : pl),
        })));
        setSelectedPost(prev => prev ? {
          ...prev,
          places: prev.places.map(pl => fixes[pl.id] ? { ...pl, ...fixes[pl.id] } : pl),
        } : prev);
      }
    })();
  }, [selectedPost?.id]);

  // Load real comments when a post is opened
  useEffect(() => {
    if (!selectedPost) { setPostComments([]); setPostCommentText(''); return; }
    setLoadingComments(true);
    getPostComments(selectedPost.id).then(comments => {
      setPostComments(comments);
      setLoadingComments(false);
    });
  }, [selectedPost?.id]);

  // When "Save all" picker opens, compute which collections already contain ALL places
  useEffect(() => {
    if (!showSaveAllPicker || !selectedPost || selectedPost.places.length === 0) { setSaveAllColIds(new Set()); return; }
    Promise.all(selectedPost.places.map(pl => getPlaceCollectionIds(pl.id))).then(sets => {
      const intersection = sets.reduce<Set<string>>((acc, cur) => new Set([...acc].filter(id => cur.has(id))), sets[0] ?? new Set());
      setSaveAllColIds(intersection);
    });
  }, [showSaveAllPicker]);

  // When map tab opens, enrich any places missing coordinates (in-memory)
  useEffect(() => {
    if (activeTab !== 'Map') return;
    const allPlaces = posts.flatMap(p => p.places);
    const missingCoords = allPlaces.filter(pl => pl.lat == null || pl.lng == null);
    if (missingCoords.length === 0) return;
    const GKEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
    setEnrichingMap(true);
    (async () => {
      const fixes: Record<string, { lat?: number; lng?: number }> = {};
      for (const pl of missingCoords) {
        try {
          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'places.location' },
            body: JSON.stringify({ textQuery: [pl.name, pl.city, pl.country].filter(Boolean).join(', '), languageCode: 'en' }),
          });
          const data = await res.json();
          const loc = data.places?.[0]?.location;
          if (loc?.latitude != null && loc?.longitude != null) fixes[pl.id] = { lat: loc.latitude, lng: loc.longitude };
        } catch { /* skip */ }
      }
      if (Object.keys(fixes).length > 0) {
        setPosts(prev => prev.map(post => ({
          ...post,
          places: post.places.map(pl => fixes[pl.id] ? { ...pl, ...fixes[pl.id] } : pl),
        })));
      }
      setEnrichingMap(false);
    })();
  }, [activeTab, posts.length]);

  const handleFollow = () => {
    if (following) {
      setShowUnfollowConfirm(true);
    } else {
      doFollow();
    }
  };

  const doFollow = async () => {
    setFollowing(true);
    setFollowerCount(c => c + 1);
    onFollowChange?.(1);
    const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId });
    if (error) { setFollowing(false); setFollowerCount(c => c - 1); onFollowChange?.(-1); }
  };

  const doUnfollow = async () => {
    setUnfollowing(true);
    const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', userId);
    if (!error) {
      setFollowing(false);
      setFollowerCount(c => c - 1);
      onFollowChange?.(-1);
    }
    setUnfollowing(false);
    setShowUnfollowConfirm(false);
  };

  const openFollowList = async (type: 'followers' | 'following') => {
    setShowFollowList(type);
    setLoadingList(true);
    if (type === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('follower:profiles!follower_id ( id, name, username, avatar_url )')
        .eq('following_id', userId);
      setFollowList((data ?? []).map((r: any) => ({ id: r.follower.id, name: r.follower.name ?? '', username: r.follower.username ?? '', avatarUrl: r.follower.avatar_url ?? null })));
    } else {
      const { data } = await supabase
        .from('follows')
        .select('following:profiles!following_id ( id, name, username, avatar_url )')
        .eq('follower_id', userId);
      setFollowList((data ?? []).map((r: any) => ({ id: r.following.id, name: r.following.name ?? '', username: r.following.username ?? '', avatarUrl: r.following.avatar_url ?? null })));
    }
    setLoadingList(false);
  };

  const initials = (profile?.name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const totalPlaces = (() => { const seen = new Set<string>(); return posts.flatMap(p => p.places).filter(pl => { const k = pl.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).length; })();

  // ── Follow list ───────────────────────────────────────────────────
  if (showFollowList) {
    const title = showFollowList === 'followers' ? 'Followers' : 'Following';
    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-gray-100">
          <button onClick={() => setShowFollowList(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">{title}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {loadingList ? (
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
          ) : followList.length > 0 ? followList.map(u => {
            const ini = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
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
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-3xl mb-3">{showFollowList === 'followers' ? '👥' : '🔍'}</p>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {showFollowList === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Post detail ───────────────────────────────────────────────────
  if (selectedPost) {
    const images = selectedPost.places.map(pl => pl.photoUrl).filter(Boolean);
    const labels = selectedPost.places.map(pl => pl.name.split(',')[0].trim());
    const isLiked = likedPosts.has(selectedPost.id);
    const likeCount = postLikeCounts[selectedPost.id] ?? 0;
    const allSaved = selectedPost.places.length > 0 && selectedPost.places.every(p => allSavedIds.has(p.id));
    return (
      <div className="bg-white min-h-screen pb-24">

        {/* ── Full-bleed photo with frosted glass controls ── */}
        <div className="relative">
          {images.length > 0
            ? <ImageCarousel images={images} labels={labels} sublabels={selectedPost.places.map(pl => [pl.neighborhood, pl.city].filter(Boolean).join(', ') || pl.country)} />
            : <div className="w-full bg-gray-100" style={{ aspectRatio: '3/4' }} />
          }
          {/* Top overlay: back | user pill | share */}
          <div className="absolute top-0 left-0 right-0 px-4 pt-5 pb-8 bg-gradient-to-b from-black/55 via-black/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setSelectedPost(null); setShowPostMap(false); }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md flex-shrink-0"
              >
                <ArrowLeft size={17} strokeWidth={1.5} className="text-white" />
              </button>
              <div className="flex items-center gap-2 bg-black/35 backdrop-blur-md rounded-full px-3 py-1.5 w-fit max-w-[55%] overflow-hidden">
                {profile?.avatarUrl
                  ? <img src={profile.avatarUrl} alt={profile.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><span className="text-xs font-bold text-white">{initials}</span></div>
                }
                <p className="text-white font-semibold text-sm leading-tight truncate">{profile?.username || profile?.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content — all inside one bg-white wrapper ── */}
        <div className="bg-white">

          {/* Actions */}
          <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-5">
              <button
                className="flex items-center gap-1.5"
                onClick={() => {
                  const nowLiked = likedPosts.has(selectedPost.id);
                  setLikedPosts(prev => { const n = new Set(prev); nowLiked ? n.delete(selectedPost.id) : n.add(selectedPost.id); return n; });
                  setPostLikeCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] ?? 0) + (nowLiked ? -1 : 1) }));
                  nowLiked ? unlikePost(currentUserId, selectedPost.id) : likePost(currentUserId, selectedPost.id);
                }}
              >
                <Heart size={22} strokeWidth={1.5} className={isLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-800'} />
                <span className="text-sm font-medium text-gray-500">{likeCount}</span>
              </button>
              <button className="flex items-center gap-1.5" onClick={() => { setTimeout(() => postCommentInputRef.current?.focus(), 50); }}>
                <MessageCircle size={22} strokeWidth={1.5} className="text-gray-800" />
                <span className="text-sm font-medium text-gray-500">{postComments.length}</span>
              </button>
              <button onClick={() => {
                const url = window.location.href;
                if (navigator.share) { navigator.share({ title: selectedPost.caption || 'Check this out on curio', url }); }
                else { navigator.clipboard?.writeText(url); }
              }}>
                <Send size={21} strokeWidth={1.5} className="text-gray-800" />
              </button>
            </div>
            <button
              onClick={async () => {
                if (!allSaved) {
                  for (const p of selectedPost.places) {
                    setAllSavedIds(prev => new Set(prev).add(p.id));
                    savePlace(currentUserId, p.id);
                  }
                }
                setShowSaveAllPicker(true);
              }}
            >
              {allSaved
                ? <BookmarkCheck size={22} strokeWidth={1.5} className="text-gray-900" />
                : <Bookmark size={22} strokeWidth={1.5} className="text-gray-700" />}
            </button>
          </div>

          {/* Caption + hashtags */}
          {(selectedPost.caption || selectedPost.hashtags.length > 0) && (
            <div className="px-5 pt-4 pb-5">
              {selectedPost.caption && <p className="text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>}
              {selectedPost.hashtags.length > 0 && (() => {
                const seen = new Set<string>();
                const unique = selectedPost.hashtags.filter(h => { const k = h.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
                return <p className="text-xs text-orange-400 mt-2">{unique.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>;
              })()}
            </div>
          )}

          {/* Places + map */}
          <div className="px-5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {selectedPost.places.length} place{selectedPost.places.length !== 1 ? 's' : ''}
              </p>
              {selectedPost.places.some(p => p.lat != null) && (
                <button
                  onClick={() => setShowPostMap(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showPostMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Map size={11} strokeWidth={1.5} />
                  {showPostMap ? 'Hide map' : 'View on map'}
                </button>
              )}
            </div>
            {showPostMap && (() => {
              const mapPlaces = selectedPost.places.filter(p => p.lat != null && p.lng != null).map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name.split(',')[0].trim(), city: p.city, country: p.country }));
              return mapPlaces.length > 0 ? (
                <div className="rounded-2xl overflow-hidden mb-3">
                  <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse" />}>
                    <MapView places={mapPlaces} height="200px" />
                  </Suspense>
                </div>
              ) : null;
            })()}
            <div className="space-y-2.5 pb-5">
              {selectedPost.places.filter((p, i, arr) => arr.findIndex(x => x.name.split(',')[0].trim() === p.name.split(',')[0].trim()) === i).map(place => (
                <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                  {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                      <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
                    </p>
                    {place.category && <p className="text-xs text-gray-400 mt-0.5">{categoryEmoji[place.category] ?? '📍'} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      const isSaved = allSavedIds.has(place.id);
                      if (isSaved) {
                        setAllSavedIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                        unsavePlace(currentUserId, place.id);
                      } else {
                        setAllSavedIds(prev => new Set(prev).add(place.id));
                        savePlace(currentUserId, place.id);
                        setSavingPlace({ id: place.id, name: place.name.split(',')[0].trim() });
                        setLoadingPlaceInCols(true);
                        const ids = await getPlaceCollectionIds(place.id);
                        setPlaceInMyCollections(ids);
                        setLoadingPlaceInCols(false);
                      }
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${allSavedIds.has(place.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                  >
                    {allSavedIds.has(place.id)
                      ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                      : <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="px-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</p>
            {postComments.length === 0 && !loadingComments && (
              <p className="text-sm text-gray-400 text-center py-3">Be the first one to add a comment ✨</p>
            )}
            {postComments.length > 0 && (
              <div className="space-y-3 mb-4">
                {postComments.map(c => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    {c.profile.avatarUrl
                      ? <img src={c.profile.avatarUrl} alt={c.profile.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                      : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0 mt-0.5">{c.profile.name[0]?.toUpperCase() || '?'}</div>}
                    <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl px-3 py-2.5">
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-xs font-semibold text-gray-900">{c.profile.name.split(' ')[0]}</p>
                        <p className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.text}</p>
                    </div>
                    {c.userId === currentUserId && (
                      <button onClick={async () => { await deleteComment(c.id); setPostComments(prev => prev.filter(x => x.id !== c.id)); }} className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 mt-3">
              {currentUserAvatar
                ? <img src={currentUserAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />}
              <input
                ref={postCommentInputRef}
                value={postCommentText}
                onChange={e => setPostCommentText(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && postCommentText.trim() && selectedPost) {
                    const text = postCommentText.trim();
                    setPostCommentText('');
                    const saved = await addComment(currentUserId, selectedPost.id, text);
                    if (saved) setPostComments(prev => [...prev, saved]);
                  }
                }}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
              {postCommentText.trim() && (
                <button
                  onClick={async () => {
                    if (!selectedPost) return;
                    const text = postCommentText.trim();
                    setPostCommentText('');
                    const saved = await addComment(currentUserId, selectedPost.id, text);
                    if (saved) setPostComments(prev => [...prev, saved]);
                  }}
                  className="text-xs font-bold text-gray-900"
                >Post</button>
              )}
            </div>
          </div>

          {/* Date — very end of post */}
          <p className="text-xs text-gray-400 px-5 pb-8 pt-4">{new Date(selectedPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        </div>
      </div>
    );
  }

  // ── Main profile view ─────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen relative">
      {/* Top nav */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
        </button>
        {/* Right side: follow + message */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFollow}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              following
                ? 'border border-gray-300 text-gray-500 bg-white'
                : 'bg-gray-900 text-white'
            }`}
          >
            {following ? <><Check size={10} strokeWidth={2.5} />Following</> : <>Follow</>}
          </button>
          {onMessage && (
            <button
              onClick={() => onMessage?.(userId)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
            >
              <MessageCircle size={17} strokeWidth={1.6} className="text-gray-700" />
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pb-4">
        <div className="flex items-start gap-4">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-16 h-16 rounded-full object-cover object-top flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-slate-400">{initials || '?'}</span>
            </div>
          )}
          {/* Name, username, bio, location stacked beside avatar */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-base font-bold text-gray-900 leading-tight truncate">{profile?.name ?? '…'}</p>
            <p className="text-xs text-gray-400 truncate">@{profile?.username ?? '…'}</p>
            {profile?.bio ? (
              <div className="pt-0.5">
                <p className="text-xs text-gray-500 leading-snug">{profile.bio}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { value: posts.length, label: 'Posts', action: null },
            { value: totalPlaces, label: 'Places', action: null },
            { value: followerCount, label: 'Followers', action: () => openFollowList('followers') },
            { value: followingCount, label: 'Following', action: () => openFollowList('following') },
          ].map(stat => (
            <button key={stat.label} onClick={stat.action ?? undefined} className="text-center">
              <p className="text-base font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-gray-100 border-t">
        {(['Posts', 'Map', 'Collections'] as ProfileTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-xs font-medium transition-colors ${
              activeTab === tab ? 'text-gray-900 font-bold border-b-2 border-gray-900 -mb-px' : 'text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Posts */}
      {activeTab === 'Posts' && (
        loadingPosts ? (
          <div className="grid grid-cols-3 gap-px bg-gray-100 mt-px">
            {[0,1,2,3,4,5].map(i => <div key={i} className="aspect-square bg-gray-50 animate-pulse" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">📍</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No posts yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">
              When {profile?.name.split(' ')[0]} posts, you'll see them here
            </p>
          </div>
        ) : (
          <div className="bg-white">
          <div className="grid grid-cols-3 gap-px bg-white">
            {posts.map(post => {
              const firstImage = post.places.map(p => p.photoUrl).find(url => url && url.trim());
              if (!firstImage) return null;
              return (
                <button key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-white relative overflow-hidden">
                  <img src={firstImage} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget.closest('button') as HTMLElement | null)?.style && ((e.currentTarget.closest('button') as HTMLElement).style.display = 'none'); }} />
                  {post.places.length > 1 && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="grid grid-cols-2 gap-px w-2.5 h-2.5">
                        <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                        <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          </div>
        )
      )}

      {activeTab === 'Map' && (() => {
        const rawPlaces = posts.flatMap(p => p.places);
        const seenNames = new Set<string>();
        const allPlaces = rawPlaces.filter(pl => {
          const key = pl.name.trim().toLowerCase();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        }).map(pl => {
          const city = (pl.city ?? '').trim();
          if (/^[A-Z]{2}$/.test(city) && US_STATES[city]) return { ...pl, city: US_STATES[city] };
          return pl;
        });
        const mapPlaces = allPlaces.filter(pl => pl.lat != null && pl.lng != null).map(pl => ({
          id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country,
        }));
        const countriesCount = new Set(allPlaces.map(pl => pl.country).filter(Boolean)).size;
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
        if (enrichingMap && allPlaces.length === 0) {
          return (
            <div className="px-4 pt-4">
              <div className="h-48 bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center">
                <p className="text-xs text-gray-400">Loading map…</p>
              </div>
            </div>
          );
        }
        if (allPlaces.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🗺️</span>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-1.5">No places yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">
                Places {profile?.name.split(' ')[0]} tags will appear on the map
              </p>
            </div>
          );
        }
        return (
          <div className="pb-10">
            {/* Map with stats overlay */}
            <div className="px-4 pt-4">
              <div className="rounded-2xl overflow-hidden relative">
                {mapPlaces.length > 0 ? (
                  <Suspense fallback={<div className="h-52 bg-gray-100 animate-pulse" />}>
                    <MapView places={mapPlaces} height="220px" />
                  </Suspense>
                ) : (
                  <div className="h-52 bg-gray-100 flex items-center justify-center">
                    <p className="text-xs text-gray-400">No places with coordinates yet</p>
                  </div>
                )}
                {/* Stats overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-base font-black text-white">{countriesCount}</p>
                      <p className="text-[11px] text-white/70">Countries visited</p>
                    </div>
                    <div>
                      <p className="text-base font-black text-white">{allPlaces.length}</p>
                      <p className="text-[11px] text-white/70">Places</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
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

            {/* Places by country */}
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
                    {cPlaces.map(pl => (
                      <div key={pl.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
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
                        <button
                          onClick={async () => {
                            const isSaved = allSavedIds.has(pl.id);
                            if (isSaved) {
                              setAllSavedIds(prev => { const n = new Set(prev); n.delete(pl.id); return n; });
                              unsavePlace(currentUserId, pl.id);
                            } else {
                              setAllSavedIds(prev => new Set(prev).add(pl.id));
                              savePlace(currentUserId, pl.id);
                              setSavingPlace({ id: pl.id, name: pl.name });
                              setLoadingPlaceInCols(true);
                              const ids = await getPlaceCollectionIds(pl.id);
                              setPlaceInMyCollections(ids);
                              setLoadingPlaceInCols(false);
                            }
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${allSavedIds.has(pl.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                        >
                          {allSavedIds.has(pl.id)
                            ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                            : <Bookmark size={14} strokeWidth={1.5} className="text-gray-500" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {activeTab === 'Collections' && (
        collections.length > 0 ? (
          <div className="px-4 pt-4 pb-10">
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {collections.map(col => (
                <button key={col.id} className="text-left" onClick={async () => {
                  setViewingCollection(col);
                  setCollectionPlaces([]);
                  setColFilter('all');
                  setIsSubscribed(false);
                  setCollectionPlacesLoading(true);
                  const [places, subscribed] = await Promise.all([
                    getCollectionPlaces(col.id),
                    isSubscribedToCollection(currentUserId, col.id),
                  ]);
                  const geocoded = await geocodeMissingPlaces(places, GOOGLE_PLACES_KEY);
                  setCollectionPlaces(geocoded);
                  setIsSubscribed(subscribed);
                  setCollectionPlacesLoading(false);
                }}>
                  <div className="rounded-xl overflow-hidden aspect-square bg-gray-100 flex items-center justify-center">
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
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">🗂️</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">
              Collections {profile?.name.split(' ')[0]} creates will appear here
            </p>
          </div>
        )
      )}

      {/* Unfollow confirmation sheet */}
      {showUnfollowConfirm && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnfollowConfirm(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex flex-col items-center px-6 pb-2">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-16 h-16 rounded-full object-cover mb-3" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-slate-400">{initials || '?'}</span>
                </div>
              )}
              <p className="text-base font-bold text-gray-900 mb-1">Unfollow {profile?.name.split(' ')[0]}?</p>
              <p className="text-sm text-gray-400 text-center mb-6">Their posts will no longer appear in your feed.</p>
              <button
                disabled={unfollowing}
                onClick={doUnfollow}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3 disabled:opacity-50"
              >
                {unfollowing ? 'Unfollowing…' : 'Unfollow'}
              </button>
              <button onClick={() => setShowUnfollowConfirm(false)} className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Detail — full-screen */}
      {viewingCollection && (
        <div className="fixed inset-0 z-[300] bg-white overflow-y-auto" style={{ maxWidth: '384px', margin: '0 auto' }}>
          {/* Hero */}
          <div className="relative h-64 flex-shrink-0">
            {viewingCollection.coverImageUrl ? (
              <img src={viewingCollection.coverImageUrl} alt={viewingCollection.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <span className="text-7xl">{viewingCollection.emoji || '🗂️'}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
            {/* Back */}
            <button
              onClick={() => { setViewingCollection(null); setCollectionPlaces([]); setColFilter('all'); setIsSubscribed(false); }}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
            </button>
            {/* Top-right: share */}
            <button
              onClick={() => navigator.share?.({ title: viewingCollection.name, url: `${window.location.origin}/collection/${viewingCollection.id}` })}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            >
              <Share2 size={14} strokeWidth={1.5} className="text-gray-700" />
            </button>
            {/* Title overlay */}
            <div className="absolute bottom-4 left-4 right-16">
              <h2 className="text-2xl font-black text-white">{viewingCollection.name}</h2>
              {viewingCollection.description && (
                <p className="text-white/70 text-xs mt-1">{viewingCollection.description}</p>
              )}
            </div>
          </div>

          {/* Subscribe strip */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-900">{viewingCollection.placesCount} place{viewingCollection.placesCount !== 1 ? 's' : ''}</p>
              {isSubscribed && <p className="text-xs text-green-600 font-medium mt-0.5">Subscribed · updates appear in your profile</p>}
            </div>
            <button
              disabled={subscribing}
              onClick={async () => {
                setSubscribing(true);
                if (isSubscribed) {
                  await unsubscribeFromCollection(currentUserId, viewingCollection.id);
                  setIsSubscribed(false);
                } else {
                  await subscribeToCollection(currentUserId, viewingCollection.id);
                  setIsSubscribed(true);
                }
                setSubscribing(false);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors ${isSubscribed ? 'bg-gray-100 text-gray-700' : 'bg-gray-900 text-white'}`}
            >
              {isSubscribed ? <BookmarkCheck size={13} strokeWidth={2} /> : <Bookmark size={13} strokeWidth={2} />}
              {subscribing ? '…' : isSubscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          </div>

          {/* Body */}
          {collectionPlacesLoading ? (
            <div className="px-4 pt-4 space-y-3">
              <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
              {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : collectionPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <span className="text-4xl mb-3">📍</span>
              <p className="text-slate-800 font-semibold text-base mb-1.5">No places yet</p>
              <p className="text-slate-400 text-sm max-w-[220px]">This collection doesn't have any places added yet.</p>
            </div>
          ) : (() => {
            const catEmoji = (cat: string) => {
              const m: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', dining: '🍽️', bar: '🍸', cocktail: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙' };
              return m[cat.toLowerCase()] ?? '📍';
            };
            const mapPlaces = collectionPlaces
              .filter(pl => pl.lat != null && pl.lng != null)
              .map(pl => ({ id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country }));
            const cats = Array.from(new Set(collectionPlaces.map(p => p.category).filter(Boolean)));
            const filtered = colFilter === 'all' ? collectionPlaces : collectionPlaces.filter(p => p.category === colFilter);
            const byArea: Record<string, typeof filtered> = {};
            filtered.forEach(p => { const k = p.neighborhood || p.city || 'Other'; if (!byArea[k]) byArea[k] = []; byArea[k].push(p); });
            return (
              <>
                {/* Count + map toggle */}
                <div className="flex items-center justify-between px-4 pt-4 pb-1">
                  <p className="text-sm font-semibold text-gray-900">{collectionPlaces.length} in this collection</p>
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

                {/* Category filter chips */}
                {cats.length >= 2 && (
                  <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
                    {(['all', ...cats] as string[]).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setColFilter(cat)}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${colFilter === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                        {cat === 'all' ? 'All' : `${catEmoji(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Places grouped by area */}
                <div className="px-4 pt-3 pb-10 space-y-3">
                  {Object.keys(byArea).length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">No places match this filter</p>
                  ) : Object.entries(byArea).map(([area, areaPlaces]) => (
                    <div key={area}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{area}</p>
                      <div className="space-y-3">
                        {areaPlaces.map(place => (
                          <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                            {place.photoUrl
                              ? <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                              : <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><MapPin size={20} strokeWidth={1.5} className="text-gray-300" /></div>
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                                <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                                {[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
                              </p>
                              {place.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji(place.category)} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
                            </div>
                            {/* Save button */}
                            <button
                              onClick={async () => {
                                const isSaved = allSavedIds.has(place.id);
                                if (isSaved) {
                                  setAllSavedIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                                  unsavePlace(currentUserId, place.id);
                                } else {
                                  setAllSavedIds(prev => new Set(prev).add(place.id));
                                  savePlace(currentUserId, place.id);
                                  setSavingPlace({ id: place.id, name: place.name });
                                  setLoadingPlaceInCols(true);
                                  const ids = await getPlaceCollectionIds(place.id);
                                  setPlaceInMyCollections(ids);
                                  setLoadingPlaceInCols(false);
                                }
                              }}
                              className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${allSavedIds.has(place.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                            >
                              {allSavedIds.has(place.id)
                                ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                                : <Bookmark size={14} strokeWidth={1.5} className="text-gray-500" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Save ALL places to collection picker */}
      {showSaveAllPicker && (() => {
        const post = selectedPost!;
        return (
          <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowSaveAllPicker(false)} />
            <div className="relative bg-white rounded-t-3xl pb-8">
              <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="px-4 pb-4">
                <h3 className="text-base font-bold text-gray-900 mb-0.5">Saved to All Saved ✓</h3>
                <p className="text-xs text-gray-400">Also add all {post.places.length} place{post.places.length !== 1 ? 's' : ''} to a collection?</p>
              </div>
              {myCollections.length > 0 && (
                <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
                  {myCollections.map(col => (
                    <button
                      key={col.id}
                      onClick={async () => {
                        const alreadyIn = saveAllColIds.has(col.id);
                        if (alreadyIn) {
                          for (const place of post.places) {
                            await removePlaceFromCollection(col.id, place.id);
                          }
                          setSaveAllColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                          setMyCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - post.places.length) } : c));
                        } else {
                          for (const place of post.places) {
                            await addPlaceToCollection(col.id, place.id);
                          }
                          setSaveAllColIds(prev => new Set(prev).add(col.id));
                          setPostPlaceSavedIds(prev => { const n = new Set(prev); post.places.forEach(p => n.add(p.id)); return n; });
                          setMyCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + post.places.length } : c));
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
              {/* New collection quick-create */}
              <div className="px-4 pt-3 pb-2">
                {showInlineNewCol ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={inlineNewColName}
                      onChange={e => setInlineNewColName(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && inlineNewColName.trim()) {
                          setSavingInlineCol(true);
                          const { data, error } = await createCollection(currentUserId, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                          setSavingInlineCol(false);
                          if (!error && data) { setMyCollections(prev => [data, ...prev]); setInlineNewColName(''); setShowInlineNewCol(false); }
                        }
                        if (e.key === 'Escape') { setShowInlineNewCol(false); setInlineNewColName(''); }
                      }}
                      placeholder="Collection name…"
                      className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none"
                    />
                    <button
                      disabled={!inlineNewColName.trim() || savingInlineCol}
                      onClick={async () => {
                        if (!inlineNewColName.trim()) return;
                        setSavingInlineCol(true);
                        const { data, error } = await createCollection(currentUserId, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingInlineCol(false);
                        if (!error && data) { setMyCollections(prev => [data, ...prev]); setInlineNewColName(''); setShowInlineNewCol(false); }
                      }}
                      className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                    >{savingInlineCol ? '…' : 'Create'}</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowInlineNewCol(true)}
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
        );
      })()}

      {/* Save-place-to-collection picker */}
      {savingPlace && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSavingPlace(null); setShowInlineNewCol(false); setInlineNewColName(''); }} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Saved to All Saved ✓</h3>
              <p className="text-xs text-gray-400 truncate">Also add "{savingPlace.name}" to a collection?</p>
            </div>
            {loadingPlaceInCols ? (
              <div className="px-4 space-y-3 pb-4">
                {[0,1].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : myCollections.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 px-4">You don't have any collections yet. Create one below!</p>
            ) : (
              <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
                {myCollections.map(col => {
                  const inCol = placeInMyCollections.has(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={async () => {
                        if (inCol) {
                          await removePlaceFromCollection(col.id, savingPlace.id);
                          setPlaceInMyCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                          setMyCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                        } else {
                          await addPlaceToCollection(col.id, savingPlace.id);
                          setPlaceInMyCollections(prev => new Set(prev).add(col.id));
                          setMyCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + 1 } : c));
                        }
                      }}
                      className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3 text-left"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        {col.coverImageUrl
                          ? <img src={col.coverImageUrl} className="w-full h-full object-cover" />
                          : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                        <p className="text-xs text-gray-400">{col.placesCount} places</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                        {inCol && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Quick-create new collection */}
            <div className="px-4 pt-3">
              {showInlineNewCol ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={inlineNewColName}
                    onChange={e => setInlineNewColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && inlineNewColName.trim()) {
                        setSavingInlineCol(true);
                        const { data, error } = await createCollection(currentUserId, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingInlineCol(false);
                        if (!error && data) {
                          setMyCollections(prev => [data, ...prev]);
                          setInlineNewColName('');
                          setShowInlineNewCol(false);
                        }
                      }
                      if (e.key === 'Escape') { setShowInlineNewCol(false); setInlineNewColName(''); }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none"
                  />
                  <button
                    disabled={!inlineNewColName.trim() || savingInlineCol}
                    onClick={async () => {
                      if (!inlineNewColName.trim()) return;
                      setSavingInlineCol(true);
                      const { data, error } = await createCollection(currentUserId, { name: inlineNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                      setSavingInlineCol(false);
                      if (!error && data) { setMyCollections(prev => [data, ...prev]); setInlineNewColName(''); setShowInlineNewCol(false); }
                    }}
                    className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {savingInlineCol ? '…' : 'Create'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowInlineNewCol(true)}
                  className="w-full flex items-center gap-2 text-sm font-semibold text-gray-500 py-2"
                >
                  <Plus size={16} strokeWidth={2} className="text-gray-400" /> New collection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
