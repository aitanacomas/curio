import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { UserPlus, Menu, MapPin, BadgeCheck, ChevronRight, Mail, ArrowLeft, Heart, MessageCircle, Bookmark, BookmarkCheck, Map, Settings, LogOut, Edit3, Share2, Star, Plus } from 'lucide-react';
import { currentUser, collections, myVisitedPlaceIds, places, users, feedItems } from '../data/mockData';
import type { FeedItem, Collection, Place, Category, AppUser } from '../types';
import BookingSheet from '../components/BookingSheet';
import ImageCarousel from '../components/ImageCarousel';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import { supabase, getPublicUrl, getUserPosts, updateProfile, getFollowerProfiles, getFollowingProfiles, getFollowCounts, getUserCollections, createCollection, type RealPost, type FollowProfile, type RealCollection } from '../lib/supabase';

const MapView = lazy(() => import('../components/MapView'));

type ProfileTab = 'Posts' | 'Map' | 'Collections';

const myPosts = feedItems.filter(f => f.userId === 'user-1');

const categoryEmoji: Record<string, string> = {
  cafe: '☕', restaurant: '🍽', hotel: '🏨', bar: '🍸',
  attraction: '🏛', shop: '🛍', nature: '🌿', experience: '🎯',
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

export default function Profile({ onOpenMessages, appUser, onLogout, onNavigate, onProfileUpdate, onFollowingCountChange }: { onOpenMessages?: () => void; appUser?: AppUser; onLogout?: () => void; onNavigate?: (tab: import('../types').Tab) => void; onProfileUpdate?: (updates: { name: string; username: string; avatar: string | null; bio: string; location: string }) => void; onFollowingCountChange?: (delta: number) => void }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null);
  const [showFindPeople, setShowFindPeople] = useState(false);
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
  const [selectedRealPost, setSelectedRealPost] = useState<RealPost | null>(null);
  const [realCollections, setRealCollections] = useState<RealCollection[]>([]);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColEmoji, setNewColEmoji] = useState('📍');
  const [newColDesc, setNewColDesc] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  useEffect(() => {
    if (appUser && !appUser.isDemo) {
      getUserPosts(appUser.id).then(async posts => {
        setRealPosts(posts);
        // Auto-geocode any places missing lat/lng
        const missing = posts.flatMap(p => p.places.filter(pl => pl.lat == null || pl.lng == null));
        if (missing.length === 0) return;
        const updates: { id: string; lat: number; lng: number }[] = [];
        for (const pl of missing) {
          try {
            const q = encodeURIComponent(`${pl.name}, ${pl.city}, ${pl.country}`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
              headers: { 'Accept-Language': 'en', 'User-Agent': 'CurioApp/1.0' },
            });
            const data = await res.json();
            if (data[0]) updates.push({ id: pl.id, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
          } catch { /* skip */ }
        }
        if (updates.length > 0) {
          await Promise.all(updates.map(u => supabase.from('post_places').update({ lat: u.lat, lng: u.lng }).eq('id', u.id)));
          getUserPosts(appUser.id).then(setRealPosts);
        }
      });
      getUserCollections(appUser.id).then(setRealCollections);
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
    avatar: appUser.avatar || user.avatar,
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

  // ── Find People ─────────────────────────────────────────────────
  if (showFindPeople) {
    return <FindPeople currentUserId={appUser?.id ?? ''} onBack={() => setShowFindPeople(false)} onFollowChange={onFollowingCountChange} />;
  }

  if (viewingUserId && appUser) {
    return <UserProfile userId={viewingUserId} currentUserId={appUser.id} onBack={() => setViewingUserId(null)} onFollowChange={onFollowingCountChange} />;
  }

  // ── Real Post Detail ────────────────────────────────────────────
  if (selectedRealPost) {
    const images = selectedRealPost.places.map(pl => pl.photoUrl).filter(Boolean);
    const labels = selectedRealPost.places.map(pl => pl.name);
    return (
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
            <p className="text-xs text-gray-400">{new Date(selectedRealPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        {images.length > 0 && <ImageCarousel images={images} labels={labels} />}
        <div className="px-4 pt-3 pb-4 border-b border-gray-100">
          <p className="text-sm text-gray-800 leading-relaxed">{selectedRealPost.caption}</p>
          {selectedRealPost.locationLabel && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <MapPin size={10} strokeWidth={1.5} />{selectedRealPost.locationLabel}
            </p>
          )}
        </div>
        <div className="px-4 pt-4 pb-10">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {selectedRealPost.places.length} Place{selectedRealPost.places.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            {selectedRealPost.places.map(place => (
              <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                    <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />{place.city}, {place.country}
                  </p>
                  {place.category && <p className="text-xs text-gray-400 mt-0.5">{place.category}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
        finalAvatarUrl = getPublicUrl('avatars', path);
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
        setSaveError('Username may already be taken. Try another.');
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
                  {!isMe && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (showFollowers === 'following') {
                          setUnfollowTarget(u);
                        } else {
                          setViewingUserId(u.id);
                        }
                      }}
                      className={`text-xs font-semibold rounded-full px-3 py-1.5 flex-shrink-0 ${
                        showFollowers === 'following'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {showFollowers === 'following'
                        ? <span className="flex items-center gap-1"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Following</span>
                        : 'View'}
                    </button>
                  )}
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
            labels={postPlaces.map(p => p.name)}
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
              className={`px-5 py-1.5 rounded-full border text-sm font-semibold transition-colors ${isSaved ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-900 text-gray-900 bg-white'}`}
            >
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
                      <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                        <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                        {place.city}, {place.country}
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

  // ── Main Profile View ───────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Top Nav */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={() => setShowFindPeople(true)} className="w-9 h-9 flex items-center justify-center">
          <UserPlus size={22} strokeWidth={1.5} className="text-gray-700" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-900 leading-tight flex items-center justify-center gap-1.5">
            {displayUser.name}
            {displayUser.verified && <BadgeCheck size={16} className="text-blue-500 fill-blue-500" strokeWidth={1.5} />}
          </h2>
          <p className="text-xs text-gray-400">@{displayUser.username}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onOpenMessages} className="w-9 h-9 flex items-center justify-center">
            <Mail size={20} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <button onClick={() => setShowMenu(true)} className="w-9 h-9 flex items-center justify-center">
            <Menu size={22} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setEditLocation(displayUser.location ?? ''); setShowEditProfile(true); }} className="relative flex-shrink-0">
            <img src={displayUser.avatar} alt={displayUser.name} className="w-16 h-16 rounded-full object-cover object-top" />
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
              <Plus size={11} strokeWidth={2.5} className="text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0 space-y-1">
            {displayUser.bio ? (
              <p className="text-xs text-gray-600 leading-relaxed">{displayUser.bio}</p>
            ) : (
              <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(''); setEditLocation(displayUser.location ?? ''); setShowEditProfile(true); }} className="text-xs text-gray-400 italic">Add a bio…</button>
            )}
            {displayUser.location ? (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                {displayUser.location}
              </p>
            ) : null}
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
                  <button key={post.id} onClick={() => setSelectedRealPost(post)} className="aspect-square bg-white relative">
                    <img src={firstImage} alt="" className="w-full h-full object-cover" />
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
          <div className="grid grid-cols-3 gap-px bg-gray-100">
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
              <button onClick={() => { setNewColName(''); setNewColEmoji('📍'); setNewColDesc(''); setShowCreateCollection(true); }} className="flex items-center gap-1.5 text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full">
                <Plus size={12} strokeWidth={2.5} /> New
              </button>
            </div>
            {realCollections.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                {realCollections.map(col => (
                  <div key={col.id} className="text-left">
                    <div className="rounded-xl overflow-hidden aspect-square bg-gray-100 flex items-center justify-center">
                      <span className="text-5xl">{col.emoji}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                    {col.description ? <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{col.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <span className="text-4xl mb-3">🗂️</span>
                <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
                <p className="text-slate-400 text-sm text-center max-w-[200px]">Curate your favourite places into shareable collections</p>
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
                  const { data, error } = await createCollection(appUser.id, { name: newColName.trim(), emoji: newColEmoji, description: newColDesc.trim() });
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
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl flex-shrink-0">
                  {newColEmoji}
                </div>
                <input
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  placeholder="Collection name"
                  className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Emoji</p>
                <div className="flex gap-2 flex-wrap">
                  {['📍','🌍','🏖️','🏔️','🍽️','☕','🏛️','🛍️','🌿','🎯','🌊','🏙️','❤️','⭐'].map(e => (
                    <button key={e} onClick={() => setNewColEmoji(e)} className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-colors ${newColEmoji === e ? 'bg-gray-900' : 'bg-gray-100'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
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
