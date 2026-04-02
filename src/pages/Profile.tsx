import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { UserPlus, Menu, MapPin, BadgeCheck, ChevronRight, Bell, Mail, ArrowLeft, Heart, MessageCircle, Bookmark, BookmarkCheck, Map, Settings, LogOut, Edit3, Share2, Star, Plus, X, Check, Send } from 'lucide-react';
import Notifications, { getUnreadCount, markAsSeen } from './Notifications';
import { currentUser, collections, myVisitedPlaceIds, places, users, feedItems } from '../data/mockData';
import type { FeedItem, Collection, Place, Category, AppUser } from '../types';
import BookingSheet from '../components/BookingSheet';
import ImageCarousel from '../components/ImageCarousel';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import { supabase, getPublicUrl, getUserPosts, updateProfile, getFollowerProfiles, getFollowingProfiles, getFollowCounts, getUserCollections, createCollection, updateCollection, deleteCollection, getLikedPosts, getSavedPosts, likePost, unlikePost, savePost, unsavePost, getPostLikeCounts, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, getCollectionPlaces, getCollectionCollaborators, addCollaborator, removeCollaborator, getSharedCollections, getSubscribedCollections, searchProfiles, deletePostPlace, deletePost, updatePostCaption, reorderPostPlaces, savePlace, unsavePlace, getNotifications, getPostComments, addComment, deleteComment, getPostCollaborators, addPostCollaborator, removePostCollaborator, type RealPost, type RealPostPlace, type FollowProfile, type RealCollection, type CollectionCollaborator, type PostComment, type PostCollaborator } from '../lib/supabase';

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

type ProfileTab = 'Posts' | 'Map' | 'Collections';

const myPosts = feedItems.filter(f => f.userId === 'user-1');

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
};

const mockComments: Record<string, { userId: string; text: string; time: string }[]> = {
  'feed-9': [
    { userId: 'user-1', text: 'that corridor photo is unreal. i need to go back', time: '55m' },
    { userId: 'user-5', text: 'the bar is genuinely one of the most beautiful rooms i have ever been in', time: '40m' },
  ],
  'feed-8': [
    { userId: 'user-2', text: 'the crystallised porsche stopped me in my tracks', time: '15m' },
    { userId: 'user-5', text: "i don't believe in god but she doesn't mind is everything to me", time: '12m' },
  ],
  'feed-7': [
    { userId: 'user-5', text: 'bodega is SO good, that steak taco is unreal', time: '25m' },
    { userId: 'user-8', text: 'the ferry view on a clear day is one of my favourite things in the world', time: '18m' },
  ],
  'feed-6': [
    { userId: 'user-5', text: 'Museum Garage is one of my favourite buildings in the US, period', time: '2h' },
    { userId: 'user-8', text: 'the sneaker lab!! I walked past it 3 times before I found the entrance lol', time: '1h' },
  ],
  'feed-1': [
    { userId: 'user-7', text: 'Casa Simera es un sueño, la mejor terraza de la ciudad', time: '1h' },
    { userId: 'user-5', text: 'Latte Latte changed my life honestly. That flat white is no joke', time: '45m' },
  ],
};

export default function Profile({ onOpenMessages, appUser, onLogout, onNavigate, onProfileUpdate, onFollowingCountChange }: { onOpenMessages?: (targetUserId?: string) => void; appUser?: AppUser; onLogout?: () => void; onNavigate?: (tab: import('../types').Tab) => void; onProfileUpdate?: (updates: { name: string; username: string; avatar: string | null; bio: string; location: string }) => void; onFollowingCountChange?: (delta: number) => void }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null);
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreatorOnboard, setShowCreatorOnboard] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set(['place-28', 'place-29', 'place-30']));
  const [bookingPlace, setBookingPlace] = useState<Place | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [colCategoryFilter, setColCategoryFilter] = useState<Category | 'all'>('all');
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
  const [postCommentText, setPostCommentText] = useState('');
  const [postComments, setPostComments] = useState<import('../lib/supabase').PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const postCommentInputRef = useRef<HTMLInputElement>(null);
  const [showPostShareSheet, setShowPostShareSheet] = useState(false);
  const [postSentTo, setPostSentTo] = useState<Set<string>>(new Set());
  const [showEditPost, setShowEditPost] = useState(false);
  const [editPostCaption, setEditPostCaption] = useState('');
  const [editPostPlaces, setEditPostPlaces] = useState<RealPostPlace[]>([]);
  const [editPostHashtags, setEditPostHashtags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [savingEditPost, setSavingEditPost] = useState(false);
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
  const editColCoverInputRef = useRef<HTMLInputElement>(null);
  const [showAddPlacesSheet, setShowAddPlacesSheet] = useState(false);
  const [colPlaceIds, setColPlaceIds] = useState<Set<string>>(new Set());
  const [colFilter, setColFilter] = useState('all');
  const [showColMap, setShowColMap] = useState(true);
  const [addToColPlace, setAddToColPlace] = useState<{ id: string; name: string } | null>(null);
  const [placeInCollections, setPlaceInCollections] = useState<Set<string>>(new Set());
  const [loadingPlaceCollections, setLoadingPlaceCollections] = useState(false);
  const [showInlineNewCol, setShowInlineNewCol] = useState(false);
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
  const colCoverInputRef = useRef<HTMLInputElement>(null);
  const [sharedCollections, setSharedCollections] = useState<RealCollection[]>([]);
  const [subscribedCollections, setSubscribedCollections] = useState<RealCollection[]>([]);
  const [collectionCollaborators, setCollectionCollaborators] = useState<CollectionCollaborator[]>([]);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<FollowProfile[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [postCollaborators, setPostCollaborators] = useState<PostCollaborator[]>([]);
  const [postCollabSearch, setPostCollabSearch] = useState('');
  const [postCollabResults, setPostCollabResults] = useState<FollowProfile[]>([]);
  const [invitingPostCollab, setInvitingPostCollab] = useState<string | null>(null);

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

        // Auto-enrich any places missing neighbourhood or city (in memory + DB)
        const missingLocation = posts.flatMap(p => p.places.filter(pl => !pl.neighborhood || !pl.city));
        if (missingLocation.length > 0) {
          const locationFixes: Record<string, { neighborhood?: string; city?: string; country?: string }> = {};
          for (const pl of missingLocation) {
            try {
              const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'places.addressComponents' },
                body: JSON.stringify({ textQuery: [pl.name, pl.city, pl.country].filter(Boolean).join(', '), languageCode: 'en' }),
              });
              const data = await res.json();
              const comps: { types: string[]; longText: string }[] = data.places?.[0]?.addressComponents ?? [];
              if (!comps.length) continue;
              const find = (...types: string[]) => comps.find(c => types.some(t => c.types?.includes(t)))?.longText ?? '';
              let hasPostalTown = comps.some(c => c.types?.includes('postal_town'));
              const neighborhood = find('sublocality_level_1') || find('sublocality_level_2') || find('neighborhood') || find('sublocality');
              const city = find('postal_town') || (!hasPostalTown ? find('locality') : '') || find('administrative_area_level_2');
              const country = find('country');
              const fix: Record<string, string> = {};
              if (neighborhood && !pl.neighborhood) fix.neighborhood = neighborhood;
              if (city && !pl.city) fix.city = city;
              if (country && !pl.country) fix.country = country;
              if (Object.keys(fix).length) locationFixes[pl.id] = fix;
            } catch { /* skip */ }
          }
          if (Object.keys(locationFixes).length > 0) {
            Object.entries(locationFixes).forEach(([id, fix]) =>
              supabase.from('post_places').update(fix).eq('id', id)
            );
            setRealPosts(prev => prev.map(post => ({
              ...post,
              places: post.places.map(pl => locationFixes[pl.id] ? { ...pl, ...locationFixes[pl.id] } : pl),
            })));
          }
        }

        // Auto-geocode any places missing lat/lng (in memory + DB)
        const missing = posts.flatMap(p => p.places.filter(pl => pl.lat == null || pl.lng == null));
        if (missing.length === 0) return;
        const coords: Record<string, { lat: number; lng: number }> = {};
        for (const pl of missing) {
          try {
            const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY },
              body: JSON.stringify({ input: `${pl.name}, ${pl.city}, ${pl.country}` }),
            });
            const acData = await acRes.json();
            const placeId = acData.suggestions?.[0]?.placePrediction?.placeId;
            if (!placeId) continue;
            const detRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
              headers: { 'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'location' },
            });
            const det = await detRes.json();
            if (det.location?.latitude != null)
              coords[pl.id] = { lat: det.location.latitude, lng: det.location.longitude };
          } catch { /* skip */ }
        }
        if (Object.keys(coords).length === 0) return;
        // Update DB (best effort) and update local state immediately
        Object.entries(coords).forEach(([id, c]) =>
          supabase.from('post_places').update({ lat: c.lat, lng: c.lng }).eq('id', id)
        );
        setRealPosts(prev => prev.map(post => ({
          ...post,
          places: post.places.map(pl => coords[pl.id] ? { ...pl, ...coords[pl.id] } : pl),
        })));
      });
      getUserCollections(appUser.id).then(setRealCollections);
      getSharedCollections(appUser.id).then(setSharedCollections);
      getSubscribedCollections(appUser.id).then(setSubscribedCollections);
      getLikedPosts(appUser.id).then(setLikedRealPosts);
      getSavedPosts(appUser.id).then(setSavedRealPosts);
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

  const visitedPlaces = places.filter(p => myVisitedPlaceIds.includes(p.id));
  const user = currentUser;
  const myCollections = collections.filter(c => c.curatorId === 'user-1');
  const otherUsers = users.filter(u => u.id !== 'user-1');

  // Compute accurate stats from posts only (places actually visited & shared)
  const myPostedPlaceIds = new Set(myPosts.flatMap(p => p.placeIds ?? [p.placeId]));
  const myPostedPlaces = places.filter(p => myPostedPlaceIds.has(p.id));
  const myPostedCountries = new Set(myPostedPlaces.map(p => p.country));
  const actualPlacesCount = myPostedPlaceIds.size;
  const actualCountriesCount = myPostedCountries.size;

  const isNewUser = appUser?.isDemo === false;
  const displayUser = isNewUser && appUser ? {
    ...user,
    name: appUser.name,
    username: appUser.username,
    avatar: appUser.avatar || null,
    followersCount: 0,
    followingCount: appUser.followingCount,
    bio: appUser?.bio ?? '',
    location: appUser?.location ?? '',
  } : { ...user, location: '' };

  const getPlaceById = (id: string) => places.find(p => p.id === id)!;
  const getUserById = (id: string) => users.find(u => u.id === id)!;

  const getPostPlaces = (item: FeedItem) => {
    const ids = item.placeIds ?? [item.placeId];
    return ids.map(id => getPlaceById(id)).filter(Boolean);
  };

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
      <div className="bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => setSelectedRealPost(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          {(avatarPreview ?? appUser?.avatar) ? (
            <img src={avatarPreview ?? appUser!.avatar!} alt={displayUser.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-slate-400">{displayUser.name[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{displayUser.name}</p>
            {selectedRealPost.places.length > 0 && (
              <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1 truncate">
                <MapPin size={10} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                {selectedRealPost.places.length === 1
                  ? `${selectedRealPost.places[0].name.split(',')[0].trim()} · ${selectedRealPost.places[0].city}`
                  : `${selectedRealPost.places[0].name.split(',')[0].trim()} +${selectedRealPost.places.length - 1} · ${selectedRealPost.places[0].city}`}
              </p>
            )}
          </div>
          <button
            onClick={() => { setEditPostCaption(selectedRealPost.caption); setEditPostPlaces([...selectedRealPost.places]); setEditPostHashtags([...selectedRealPost.hashtags]); setEditTagInput(''); getPostCollaborators(selectedRealPost.id).then(setPostCollaborators); setPostCollabSearch(''); setPostCollabResults([]); setShowEditPost(true); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0"
          >
            <Edit3 size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>
        {images.length > 0 && <ImageCarousel images={images} labels={labels} />}
        <div className="px-4 pt-3 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
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
                <Heart size={22} strokeWidth={1.5} className={likedRealPosts.has(selectedRealPost.id) ? 'fill-gray-900 text-gray-900' : 'text-gray-700'} />
                <span className="text-xs text-gray-500">{realPostLikeCounts[selectedRealPost.id] ?? 0}</span>
              </button>
              <button
                className="flex items-center gap-1.5"
                onClick={() => { setTimeout(() => postCommentInputRef.current?.focus(), 50); }}
              >
                <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
                <span className="text-xs text-gray-500">{postComments.length}</span>
              </button>
              <button
                onClick={() => { setPostSentTo(new Set()); setShowPostShareSheet(true); }}
                className="flex items-center gap-1.5"
              >
                <Send size={20} strokeWidth={1.5} className="text-gray-700" />
              </button>
            </div>
            {(() => {
              const allSaved = selectedRealPost.places.length > 0 && selectedRealPost.places.every(p => postPlaceSavedIds.has(p.id));
              return (
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${allSaved ? 'bg-gray-100 text-gray-600' : 'bg-white border border-gray-300 text-gray-700'}`}
                  onClick={async () => {
                    if (!appUser) return;
                    if (allSaved) {
                      // unsave all places
                      for (const place of selectedRealPost.places) {
                        await unsavePlace(appUser.id, place.id);
                        setPostPlaceSavedIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                      }
                    } else {
                      // save all unsaved places
                      for (const place of selectedRealPost.places) {
                        if (!postPlaceSavedIds.has(place.id)) {
                          await savePlace(appUser.id, place.id);
                          setPostPlaceSavedIds(prev => new Set(prev).add(place.id));
                        }
                      }
                    }
                  }}
                >
                  {allSaved && <Check size={13} strokeWidth={2} />}
                  {allSaved ? 'Saved' : 'Save all'}
                </button>
              );
            })()}
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{selectedRealPost.caption}</p>
          {selectedRealPost.hashtags.length > 0 && (
            <p className="text-xs text-orange-400 mt-1">{selectedRealPost.hashtags.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">{new Date(selectedRealPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Places + map */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {selectedRealPost.places.length} Place{selectedRealPost.places.length !== 1 ? 's' : ''}
            </p>
            {selectedRealPost.places.some(p => p.lat != null) && (
              <button
                onClick={() => setShowPostMap(v => !v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${showPostMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {showPostMap ? 'Hide map' : 'Show map'}
              </button>
            )}
          </div>
          {showPostMap && (() => {
            const mapPlaces = selectedRealPost.places.filter(p => p.lat != null && p.lng != null).map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name, city: p.city, country: p.country }));
            return mapPlaces.length > 0 ? (
              <div className="rounded-2xl overflow-hidden mb-3">
                <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse" />}>
                  <MapView places={mapPlaces} height="200px" />
                </Suspense>
              </div>
            ) : null;
          })()}
          <div className="space-y-3">
            {selectedRealPost.places.filter((p, i, arr) => arr.findIndex(x => x.name.split(',')[0].trim() === p.name.split(',')[0].trim()) === i).map(place => (
              <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                    <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
                  </p>
                  {place.category && <p className="text-xs text-gray-400 mt-0.5">{categoryEmoji[place.category] ?? '📍'} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
                </div>
                {realCollections.length > 0 && (
                  <button
                    onClick={() => {
                      setAddToColPlace({ id: place.id, name: place.name });
                      setLoadingPlaceCollections(true);
                      getPlaceCollectionIds(place.id).then(ids => {
                        setPlaceInCollections(ids);
                        setLoadingPlaceCollections(false);
                      });
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

        {/* Comments */}
        <div className="px-4 pt-4 pb-6 border-t border-gray-100 mt-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</p>
          {loadingComments && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
          {!loadingComments && postComments.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No comments yet — be the first</p>
          )}
          <div className="space-y-3 mb-4">
            {postComments.map(c => (
              <div key={c.id} className="flex items-start gap-2">
                {c.profile.avatarUrl
                  ? <img src={c.profile.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />}
                <div className="flex-1">
                  <span className="text-xs font-semibold text-gray-900">{c.profile.username} </span>
                  <span className="text-xs text-gray-700">{c.text}</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(c.createdAt)}</p>
                </div>
                {c.userId === appUser?.id && (
                  <button onClick={async () => { await deleteComment(c.id); setPostComments(prev => prev.filter(x => x.id !== c.id)); }} className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {appUser?.avatar
              ? <img src={appUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              : <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />}
            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-3 py-2 gap-2">
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditPost(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10 max-h-[90vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-4 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">Edit post</h3>
              <button
                disabled={savingEditPost}
                onClick={async () => {
                  setSavingEditPost(true);
                  // Compute updated location_label from reordered places
                  const first = editPostPlaces[0];
                  const locationLabel = !first ? '' : editPostPlaces.length === 1
                    ? `${first.name.split(',')[0].trim()} · ${first.city}`
                    : `${first.name.split(',')[0].trim()} +${editPostPlaces.length - 1} · ${first.city}`;
                  // Save caption + hashtags + location_label
                  await updatePostCaption(selectedRealPost.id, editPostCaption, editPostHashtags, locationLabel);
                  // Remove deleted places
                  const removedIds = selectedRealPost.places.filter(p => !editPostPlaces.find(ep => ep.id === p.id)).map(p => p.id);
                  for (const id of removedIds) await deletePostPlace(id);
                  // Always persist new order
                  if (editPostPlaces.length > 0) await reorderPostPlaces(editPostPlaces.map(p => p.id));
                  // Update local state everywhere
                  const updated = { ...selectedRealPost, caption: editPostCaption, hashtags: editPostHashtags, locationLabel, places: editPostPlaces };
                  setSelectedRealPost(updated);
                  setRealPosts(prev => prev.map(p => p.id === selectedRealPost.id ? updated : p));
                  setSavingEditPost(false);
                  setShowEditPost(false);
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-50"
              >{savingEditPost ? 'Saving…' : 'Save'}</button>
            </div>
            <div className="px-4 overflow-y-auto flex-1 space-y-5">
              {/* Caption */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Caption</p>
                <textarea
                  value={editPostCaption}
                  onChange={e => setEditPostCaption(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none resize-none"
                />
              </div>
              {/* Places — reorder + remove */}
              {editPostPlaces.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Images & Places</p>
                  <p className="text-xs text-gray-400 mb-2.5">Use the arrows to reorder — the first image becomes the cover</p>
                  <div className="space-y-2">
                    {editPostPlaces.map((place, i) => (
                      <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5">
                        {/* Number badge + image */}
                        <div className="relative flex-shrink-0">
                          {place.photoUrl
                            ? <img src={place.photoUrl} alt={place.name} className="w-16 h-16 rounded-xl object-cover" />
                            : <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center text-2xl">{categoryEmoji[place.category as keyof typeof categoryEmoji] ?? '📍'}</div>
                          }
                          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-gray-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{i + 1}</div>
                        </div>
                        {/* Name + location */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
                          <p className="text-xs text-gray-400 truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}</p>
                          <p className="text-xs text-gray-300">{categoryEmoji[place.category as keyof typeof categoryEmoji]} {place.category}</p>
                        </div>
                        {/* Move up/down */}
                        <div className="flex flex-col gap-1">
                          <button
                            disabled={i === 0}
                            onClick={() => setEditPostPlaces(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; })}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 disabled:opacity-25 active:bg-gray-300"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2l3.5 4H1.5z" fill="currentColor"/></svg>
                          </button>
                          <button
                            disabled={i === editPostPlaces.length - 1}
                            onClick={() => setEditPostPlaces(prev => { const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; })}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 disabled:opacity-25 active:bg-gray-300"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 8L1.5 4h7z" fill="currentColor"/></svg>
                          </button>
                        </div>
                        {/* Remove */}
                        <button onClick={() => setEditPostPlaces(prev => prev.filter(p => p.id !== place.id))} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 flex-shrink-0">
                          <X size={12} strokeWidth={2} className="text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Hashtags */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Hashtags</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-gray-50 rounded-xl px-4 py-3 min-h-[44px]">
                  {editPostHashtags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setEditPostHashtags(prev => prev.filter(t => t !== tag))}
                      className="flex items-center gap-1 text-xs font-medium text-orange-400"
                    >
                      #{tag}<X size={9} strokeWidth={2.5} className="text-orange-300" />
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
                    placeholder="+ add"
                    className="text-xs font-medium text-gray-500 bg-transparent outline-none placeholder-gray-300"
                    style={{ width: `${Math.max(40, (editTagInput.length + 5) * 7)}px` }}
                  />
                </div>
                <p className="text-[10px] text-gray-300 mt-1 px-1">Tap a tag to remove · press space or enter to add</p>
              </div>
              {/* Collaborators */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">With</p>
                {/* Current collaborators */}
                {postCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {postCollaborators.map(c => (
                      <div key={c.userId} className="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1">
                        {c.profile.avatarUrl
                          ? <img src={c.profile.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                          : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-600">{c.profile.name[0]?.toUpperCase() || '?'}</div>}
                        <span className="text-xs font-medium text-gray-700">@{c.profile.username}</span>
                        {c.status === 'pending' && <span className="text-[9px] text-gray-400">pending</span>}
                        <button
                          onClick={async () => {
                            await removePostCollaborator(selectedRealPost.id, c.userId);
                            setPostCollaborators(prev => prev.filter(x => x.userId !== c.userId));
                          }}
                          className="ml-0.5 text-gray-400"
                        ><X size={10} strokeWidth={2.5} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Search + invite */}
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <input
                    value={postCollabSearch}
                    onChange={async e => {
                      setPostCollabSearch(e.target.value);
                      if (e.target.value.trim().length > 0) {
                        const results = await searchProfiles(e.target.value, appUser?.id ?? '');
                        setPostCollabResults(results.filter(r => !postCollaborators.find(c => c.userId === r.id)));
                      } else {
                        setPostCollabResults([]);
                      }
                    }}
                    placeholder="Search to add a collaborator…"
                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder-gray-400"
                  />
                </div>
                {postCollabResults.length > 0 && (
                  <div className="mt-1.5 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    {postCollabResults.slice(0, 5).map(u => (
                      <button
                        key={u.id}
                        disabled={invitingPostCollab === u.id}
                        onClick={async () => {
                          if (!appUser?.id) return;
                          setInvitingPostCollab(u.id);
                          const err = await addPostCollaborator(selectedRealPost.id, u.id, appUser.id);
                          if (!err) {
                            const newCollab: PostCollaborator = {
                              id: `${selectedRealPost.id}-${u.id}`,
                              postId: selectedRealPost.id,
                              userId: u.id,
                              invitedBy: appUser.id,
                              status: 'pending',
                              createdAt: new Date().toISOString(),
                              profile: { name: u.name, username: u.username, avatarUrl: u.avatarUrl },
                            };
                            setPostCollaborators(prev => [...prev, newCollab]);
                            setPostCollabResults(prev => prev.filter(r => r.id !== u.id));
                            setPostCollabSearch('');
                          }
                          setInvitingPostCollab(null);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{u.name[0]?.toUpperCase() || '?'}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400">@{u.username}</p>
                        </div>
                        <span className="text-xs font-semibold text-orange-500 flex-shrink-0">
                          {invitingPostCollab === u.id ? 'Inviting…' : 'Invite'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Delete post */}
              <button
                onClick={async () => {
                  if (!confirm('Delete this post?')) return;
                  await deletePost(selectedRealPost.id);
                  setRealPosts(prev => prev.filter(p => p.id !== selectedRealPost.id));
                  setShowEditPost(false);
                  setSelectedRealPost(null);
                }}
                className="w-full py-3 text-sm font-semibold text-red-500 bg-red-50 rounded-2xl"
              >Delete post</button>
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

      const updates: { name?: string; username?: string; bio?: string; location?: string; avatar_url?: string } = {
        name: editName.trim() || displayUser.name,
        username: editUsername.trim().replace('@', '') || displayUser.username,
        bio: editBio.trim(),
        location: editLocation.trim(),
        avatar_url: finalAvatarUrl ?? undefined,
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
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          <div className="flex flex-col items-center gap-3">
            <div className="relative" onClick={() => fileInputRef.current?.click()}>
              {currentAvatar ? (
                <img src={currentAvatar} alt={displayUser.name} className="w-20 h-20 rounded-full object-cover object-top" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-400">{displayUser.name[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center">
                <Edit3 size={13} strokeWidth={1.5} className="text-white" />
              </div>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-gray-500">Change photo</button>
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

  // ── Post Detail ─────────────────────────────────────────────────
  if (selectedPost) {
    const postUser = getUserById(selectedPost.userId);
    const postPlaces = getPostPlaces(selectedPost);
    const centerPlace = postPlaces[0];
    const comments = mockComments[selectedPost.id] ?? [];
    const isLiked = likedPosts.has(selectedPost.id);
    const isSaved = savedPosts.has(selectedPost.id);

    return (
      <>
      <div className="bg-white min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button
            onClick={() => { setSelectedPost(null); setShowMap(false); setCommentText(''); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <img src={postUser.avatar} alt={postUser.name} className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{postUser.name}</p>
            <p className="text-xs text-gray-400">{selectedPost.createdAt}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <ImageCarousel
            images={selectedPost.images}
            labels={postPlaces.map(p => p.name.split(',')[0].trim())}
            scales={selectedPost.id === 'feed-8' ? [1.02, 1, 1, 1, 1.05] : selectedPost.id === 'feed-9' ? [1, 1, 1, 1, 1.07, 1] : undefined}
          />

          {/* Like / Comment / Save */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLikedPosts(prev => { const n = new Set(prev); if (n.has(selectedPost.id)) n.delete(selectedPost.id); else n.add(selectedPost.id); return n; })}
                className="flex items-center gap-1.5"
              >
                <Heart size={22} strokeWidth={1.5} className={isLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-700'} />
                <span className="text-xs text-gray-500">{(selectedPost.likes + (isLiked ? 1 : 0)).toLocaleString()}</span>
              </button>
              <div className="flex items-center gap-1.5 text-gray-700">
                <MessageCircle size={22} strokeWidth={1.5} />
                <span className="text-xs text-gray-500">{selectedPost.comments}</span>
              </div>
            </div>
            <button
              onClick={() => setSavedPosts(prev => { const n = new Set(prev); if (n.has(selectedPost.id)) n.delete(selectedPost.id); else n.add(selectedPost.id); return n; })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isSaved ? 'bg-gray-100 text-gray-600' : 'bg-white border border-gray-300 text-gray-700'}`}
            >
              {isSaved && <Check size={13} strokeWidth={2} />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>

          {/* Caption */}
          <div className="px-4 pb-4 border-b border-gray-100">
            <p className="text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>
          </div>

          {/* Places */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {postPlaces.length} Place{postPlaces.length !== 1 ? 's' : ''} in this post
              </p>
              {postPlaces.length >= 1 && (
                <button
                  onClick={() => setShowMap(p => !p)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Map size={12} strokeWidth={1.5} />
                  {showMap ? 'Hide map' : 'View on map'}
                </button>
              )}
            </div>

            {showMap && centerPlace && (
              <div className="mb-4 rounded-2xl overflow-hidden">
                <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse" />}>
                  <MapView places={postPlaces} center={[centerPlace.lat, centerPlace.lng]} zoom={15} height="200px" />
                </Suspense>
              </div>
            )}

            <div className="space-y-3">
              {postPlaces.map(place => {
                const isSavedPlace = savedPlaces.has(place.id);
                return (
                  <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                    <img src={place.image} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                        <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                        {[place.neighbourhood, place.city].filter(Boolean).join(', ') || place.country}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {place.savedCount.toLocaleString()} saves{place.rating ? ` · ★ ${place.rating}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {place.bookingAvailable && (
                        <button onClick={() => setBookingPlace(place)} className="text-xs font-bold bg-gray-900 text-white rounded-full px-2.5 py-1">Book</button>
                      )}
                      <button
                        onClick={() => setSavedPlaces(prev => { const n = new Set(prev); if (n.has(place.id)) n.delete(place.id); else n.add(place.id); return n; })}
                        className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${isSavedPlace ? 'bg-gray-900 border-gray-900' : 'border-gray-200 bg-white'}`}
                      >
                        <Bookmark size={13} strokeWidth={1.5} className={isSavedPlace ? 'fill-white text-white' : 'text-gray-600'} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div className="px-4 pt-5 border-t border-gray-100 mt-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</p>
              <div className="space-y-4">
                {comments.map((c, i) => {
                  const commenter = getUserById(c.userId);
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <img src={commenter.avatar} alt={commenter.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" style={{ objectPosition: commenter.avatarPosition ?? 'top' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-xs font-semibold text-gray-900">{commenter.name.split(' ')[0]}</p>
                          <p className="text-xs text-gray-400">{c.time}</p>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
              <button onClick={() => setCommentText('')} className="text-xs font-semibold text-gray-400">Post</button>
            </div>
          </div>
        </div>
      </div>
      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />
      </>
    );
  }

  // ── Collection Detail ───────────────────────────────────────────
  if (selectedCollection) {
    const colPlaces = places.filter(p => selectedCollection.placeIds.includes(p.id));
    const curator = selectedCollection.curatorId ? users.find(u => u.id === selectedCollection.curatorId) : null;
    const countries = [...new Set(colPlaces.map(p => p.country))].length;
    const cats = [...new Set(colPlaces.map(p => p.category))];
    const filtered = colCategoryFilter === 'all' ? colPlaces : colPlaces.filter(p => p.category === colCategoryFilter);

    return (
      <>
      <div className="bg-white min-h-screen">
        {/* Hero */}
        <div className="relative h-64">
          <img src={selectedCollection.coverImage} alt={selectedCollection.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          <button
            onClick={() => { setSelectedCollection(null); setColCategoryFilter('all'); }}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/collection/${selectedCollection.id}`;
              navigator.share({ title: selectedCollection.name, url });
            }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
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
            <button className="text-xs font-medium text-gray-400 border border-gray-200 rounded-full px-3 py-1.5 flex-shrink-0">Edit</button>
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

        {/* Category filter */}
        <div className="pt-3 pb-10 px-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{filtered.length} places</p>
          </div>
          {cats.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none mb-4">
              {(['all', ...cats] as (Category | 'all')[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setColCategoryFilter(cat)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    colCategoryFilter === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {cat === 'all' ? '✨ All' : `${categoryEmoji[cat] ?? '📍'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {filtered.map(place => {
              const isSavedPlace = savedPlaces.has(place.id);
              return (
                <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
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
                      <button onClick={() => setBookingPlace(place)} className="text-xs font-bold bg-gray-900 text-white rounded-full px-2.5 py-1">Book</button>
                    )}
                    <button onClick={() => setSavedPlaces(prev => { const n = new Set(prev); if (n.has(place.id)) n.delete(place.id); else n.add(place.id); return n; })}>
                      {isSavedPlace
                        ? <BookmarkCheck size={17} strokeWidth={1.5} className="text-gray-900" />
                        : <Bookmark size={17} strokeWidth={1.5} className="text-gray-300" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />
      </>
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

        {/* Collaborators row */}
        {collectionCollaborators.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <div className="flex -space-x-2">
              {collectionCollaborators.slice(0, 5).map(c => (
                c.profile.avatarUrl
                  ? <img key={c.id} src={c.profile.avatarUrl} alt={c.profile.name} className="w-7 h-7 rounded-full border-2 border-white object-cover" />
                  : <div key={c.id} className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{c.profile.name.charAt(0)}</div>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {collectionCollaborators.length === 1
                ? `@${collectionCollaborators[0].profile.username} can edit`
                : `${collectionCollaborators.length} collaborators`}
            </p>
          </div>
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
            <p className="text-slate-400 text-sm max-w-[220px]">Tap "+" to start building your collection</p>
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
              <input ref={editColCoverInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                setEditColCoverFile(f); setEditColCoverPreview(URL.createObjectURL(f));
              }} />
              <button onClick={() => editColCoverInputRef.current?.click()} className="w-full h-32 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center relative">
                {(editColCoverPreview ?? selectedRealCollection.coverImageUrl)
                  ? <img src={editColCoverPreview ?? selectedRealCollection.coverImageUrl!} className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Change cover photo</span></div>
                }
                {(editColCoverPreview ?? selectedRealCollection.coverImageUrl) && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </button>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddPlacesSheet(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8 max-h-[80vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-4 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">Add places</h3>
              <button onClick={() => setShowAddPlacesSheet(false)} className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full">Done</button>
            </div>
            {allUserPlaces.length === 0 ? (
              <div className="px-4 pb-4 text-center">
                <p className="text-sm text-gray-400">Post some places first to add them here</p>
              </div>
            ) : (
              <div className="px-4 space-y-2 overflow-y-auto pb-4">
                {allUserPlaces.map(place => {
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
            )}
          </div>
        </div>
      )}

      {/* Invite collaborator sheet */}
      {showInviteSheet && selectedRealCollection && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowInviteSheet(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8 max-h-[80vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">Invite collaborators</h3>
              <button onClick={() => setShowInviteSheet(false)} className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full">Done</button>
            </div>
            {/* Search input */}
            <div className="px-4 pb-3 flex-shrink-0">
              <input
                value={inviteSearch}
                onChange={async e => {
                  const val = e.target.value;
                  setInviteSearch(val);
                  if (appUser) searchProfiles(val, appUser.id).then(setInviteResults);
                }}
                placeholder="Search by name or username…"
                className="w-full bg-gray-100 rounded-full px-4 py-2 text-sm outline-none"
              />
            </div>
            {/* Existing collaborators */}
            {collectionCollaborators.length > 0 && (
              <div className="px-4 pb-2 flex-shrink-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current collaborators</p>
                {collectionCollaborators.map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2">
                    {c.profile.avatarUrl
                      ? <img src={c.profile.avatarUrl} alt={c.profile.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{c.profile.name.charAt(0)}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.profile.name}</p>
                      <p className="text-xs text-gray-400">@{c.profile.username}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await removeCollaborator(selectedRealCollection.id, c.userId);
                        setCollectionCollaborators(prev => prev.filter(x => x.id !== c.id));
                      }}
                      className="text-xs text-red-500 font-semibold"
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}
            {/* Search results */}
            <div className="overflow-y-auto flex-1 px-4">
              {inviteResults.filter(r => !collectionCollaborators.some(c => c.userId === r.id)).map(user => (
                <div key={user.id} className="flex items-center gap-3 py-2.5">
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{user.name.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-400">@{user.username}</p>
                  </div>
                  <button
                    disabled={invitingUserId === user.id}
                    onClick={async () => {
                      if (!appUser) return;
                      setInvitingUserId(user.id);
                      const err = await addCollaborator(selectedRealCollection.id, user.id, appUser.id);
                      if (!err) {
                        const newCollab: CollectionCollaborator = { id: `${Date.now()}`, collectionId: selectedRealCollection.id, userId: user.id, invitedBy: appUser.id, createdAt: new Date().toISOString(), profile: { name: user.name, username: user.username, avatarUrl: user.avatarUrl } };
                        setCollectionCollaborators(prev => [...prev, newCollab]);
                        setInviteResults(prev => prev.filter(r => r.id !== user.id));
                      }
                      setInvitingUserId(null);
                    }}
                    className="text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                  >{invitingUserId === user.id ? '…' : 'Invite'}</button>
                </div>
              ))}
              {inviteSearch && inviteResults.filter(r => !collectionCollaborators.some(c => c.userId === r.id)).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No users found</p>
              )}
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
          <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setEditLocation(displayUser.location ?? ''); setShowEditProfile(true); }} className="relative flex-shrink-0">
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
              <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(''); setEditLocation(displayUser.location ?? ''); setShowEditProfile(true); }} className="text-xs text-gray-400 italic pt-0.5">Add a bio…</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { value: isNewUser ? realPosts.length : myPosts.length, label: 'Posts', action: null },
            { value: isNewUser ? realPosts.reduce((n, p) => n + p.places.length, 0) : actualPlacesCount, label: 'Places', action: null },
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
      <div className="grid grid-cols-3 border-b border-gray-100 border-t">
        {(['Posts', 'Map', 'Collections'] as ProfileTab[]).map(tab => (
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
            <div className="grid grid-cols-3 gap-px bg-white border-t border-gray-100">
              {realPosts.map(post => {
                const firstImage = post.places[0]?.photoUrl;
                if (!firstImage) return null;
                return (
                  <button key={post.id} onClick={() => { setSelectedRealPost(post); setShowPostMap(false); setPostComments([]); setPostCommentText(''); }} className="aspect-square bg-white relative">
                    <img src={firstImage} alt="" className="w-full h-full object-cover" />
                    {post.places.length > 1 && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="grid grid-cols-2 gap-px w-2.5 h-2.5">
                          <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                          <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                        </div>
                      </div>
                    )}
                    {(post.collaborators ?? []).length > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 flex -space-x-1">
                        {(post.collaborators ?? []).slice(0, 3).map(c => (
                          c.avatarUrl
                            ? <img key={c.id} src={c.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-white" />
                            : <div key={c.id} className="w-5 h-5 rounded-full bg-gray-400 border border-white flex items-center justify-center text-[8px] font-bold text-white">{c.name[0]?.toUpperCase() || '?'}</div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              }).filter(Boolean)}
            </div>
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
          <div className="grid grid-cols-3 gap-px bg-white">
            {myPosts.map(post => (
              <button key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-white relative">
                <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
                {post.images.length > 1 && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-px w-2.5 h-2.5">
                      <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                      <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {/* Map Tab */}
      {activeTab === 'Map' && (() => {
        const mapPlaces = isNewUser
          ? realPosts.flatMap(post => post.places.filter(pl => pl.lat != null && pl.lng != null).map(pl => ({ id: pl.id, lat: pl.lat!, lng: pl.lng!, name: pl.name, city: pl.city, country: pl.country })))
          : visitedPlaces;
        const mapHeight = 'calc(100vh - 460px)';
        return (
        <div className="flex flex-col px-4 pt-4 pb-6 gap-4">
          <Suspense fallback={<div style={{ height: mapHeight }} className="bg-gray-100 rounded-xl animate-pulse" />}>
            <div className="rounded-xl overflow-hidden" style={{ height: mapHeight }}>
              <MapView places={mapPlaces} height={mapHeight} center={mapPlaces.length === 0 ? [10, 0] : undefined} />
            </div>
          </Suspense>
          <div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: isNewUser ? new Set(realPosts.flatMap(p => p.places.map(pl => pl.country))).size : actualCountriesCount, label: 'Countries' },
                { value: isNewUser ? realPosts.reduce((n, p) => n + p.places.length, 0) : actualPlacesCount, label: 'Places' },
                { value: isNewUser ? realPosts.length : myPosts.length, label: 'Posts' },
              ].map(stat => (
                <div key={stat.label} className="text-center bg-gray-50 rounded-xl py-3">
                  <p className="text-lg font-black text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
            {mapPlaces.length === 0 && isNewUser && (
              <p className="text-xs text-gray-400 text-center mt-3">Your places will appear on the map as you add posts</p>
            )}
          </div>
        </div>
        );
      })()}

      {/* Collections Tab */}
      {activeTab === 'Collections' && (
        isNewUser ? (
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
                      getCollectionPlaces(col.id).then(places => {
                        setRealCollectionPlaces(places);
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
                      getCollectionPlaces(col.id).then(places => { setRealCollectionPlaces(places); setLoadingCollectionPlaces(false); });
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

            {/* Subscribed */}
            {subscribedCollections.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subscribed</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                  {subscribedCollections.map(col => (
                    <button key={col.id} className="text-left" onClick={() => {
                      setSelectedRealCollection(col);
                      setShowColMap(true);
                      setColFilter('all');
                      setCollectionCollaborators([]);
                      setLoadingCollectionPlaces(true);
                      getCollectionPlaces(col.id).then(places => { setRealCollectionPlaces(places); setLoadingCollectionPlaces(false); });
                    }}>
                      <div className="rounded-xl overflow-hidden aspect-square bg-gray-100 flex items-center justify-center relative">
                        {col.coverImageUrl
                          ? <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                          : <span className="text-3xl">{col.emoji || '🗂️'}</span>}
                        <div className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-2 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} place{col.placesCount !== 1 ? 's' : ''}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="px-4 pt-4 pb-6">
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {myCollections.map(col => (
              <button key={col.id} onClick={() => setSelectedCollection(col)} className="text-left">
                <div className="rounded-xl overflow-hidden aspect-square relative">
                  <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" style={col.id === 'col-8' ? { transform: 'scale(1.11)' } : undefined} />
                  {col.isPremium && (
                    <div className="absolute top-2 left-2 bg-amber-400 rounded-full px-2 py-0.5">
                      <p className="text-xs font-bold text-white">Premium</p>
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                <p className="text-xs text-gray-400">
                  {col.placeIds.length} places{col.followerCount ? ` · ${col.followerCount.toLocaleString()} followers` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
        )
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
              <input ref={colCoverInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setNewColCoverFile(f);
                setNewColCoverPreview(URL.createObjectURL(f));
              }} />
              <button
                onClick={() => colCoverInputRef.current?.click()}
                className="w-full h-32 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center relative"
              >
                {newColCoverPreview
                  ? <img src={newColCoverPreview} className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Add cover photo</span></div>
                }
                {newColCoverPreview && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </button>
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
                { icon: Edit3, label: 'Edit Profile', action: () => { setShowMenu(false); setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setEditLocation(displayUser.location ?? ''); setShowEditProfile(true); } },
                { icon: Share2, label: 'Share Profile', action: () => setShowMenu(false) },
                { icon: Settings, label: 'Settings', action: () => setShowMenu(false) },
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

      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />
    </div>
  );
}
