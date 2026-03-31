import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { UserPlus, Menu, MapPin, BadgeCheck, ChevronRight, Mail, ArrowLeft, Heart, MessageCircle, Bookmark, BookmarkCheck, Map, Settings, LogOut, Edit3, Share2, Star, Plus } from 'lucide-react';
import { currentUser, collections, myVisitedPlaceIds, places, users, feedItems } from '../data/mockData';
import type { FeedItem, Collection, Place, Category, AppUser } from '../types';
import BookingSheet from '../components/BookingSheet';
import ImageCarousel from '../components/ImageCarousel';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import { supabase, getPublicUrl, getUserPosts, updateProfile, getFollowerProfiles, getFollowingProfiles, type RealPost, type FollowProfile } from '../lib/supabase';

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

export default function Profile({ onOpenMessages, appUser, onLogout, onNavigate, onProfileUpdate, onFollowingCountChange }: { onOpenMessages?: () => void; appUser?: AppUser; onLogout?: () => void; onNavigate?: (tab: import('../types').Tab) => void; onProfileUpdate?: (updates: { name: string; username: string; avatar: string | null }) => void; onFollowingCountChange?: (delta: number) => void }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null);
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
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
  const [followerProfiles, setFollowerProfiles] = useState<FollowProfile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<FollowProfile[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [unfollowTarget, setUnfollowTarget] = useState<FollowProfile | null>(null);
  const [unfollowing, setUnfollowing] = useState(false);

  useEffect(() => {
    if (appUser && !appUser.isDemo) {
      getUserPosts(appUser.id).then(setRealPosts);
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
    bio: '',
  } : user;

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

      let newAvatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.type.split('/')[1] ?? 'jpg';
        const path = `${appUser.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true });
        if (!uploadError) newAvatarUrl = getPublicUrl('avatars', path);
      }

      const updates: { name?: string; username?: string; bio?: string; avatar_url?: string } = {
        name: editName.trim() || displayUser.name,
        username: editUsername.trim().replace('@', '') || displayUser.username,
        bio: editBio.trim(),
      };
      if (newAvatarUrl) updates.avatar_url = newAvatarUrl;

      const error = await updateProfile(appUser.id, updates);
      setSaving(false);
      if (error) {
        setSaveError('Username may already be taken. Try another.');
      } else {
        onProfileUpdate?.({
          name: updates.name!,
          username: updates.username!,
          avatar: newAvatarUrl ?? appUser.avatar,
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
            <input
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              placeholder={displayUser.bio || 'Add a bio…'}
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
          <button onClick={() => { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setShowEditProfile(true); }} className="relative flex-shrink-0">
            <img src={displayUser.avatar} alt={displayUser.name} className="w-16 h-16 rounded-full object-cover object-top" />
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
              <Plus size={11} strokeWidth={2.5} className="text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin size={11} strokeWidth={1.5} className="flex-shrink-0" />
              Based in San Francisco, CA
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{displayUser.bio}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { value: isNewUser ? 0 : actualPlacesCount, label: 'Places', action: null },
            { value: isNewUser ? 0 : actualCountriesCount, label: 'Countries', action: null },
            { value: displayUser.followersCount.toLocaleString(), label: 'Followers', action: () => {
              if (isNewUser && appUser) {
                setLoadingFollowList(true);
                getFollowerProfiles(appUser.id).then(p => { setFollowerProfiles(p); setLoadingFollowList(false); });
              }
              setShowFollowers('followers');
            }},
            { value: displayUser.followingCount.toLocaleString(), label: 'Following', action: () => {
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
            <div className="grid grid-cols-3 gap-px bg-gray-100">
              {realPosts.map(post => {
                const firstImage = post.places[0]?.photoUrl;
                if (!firstImage) return null;
                return (
                  <div key={post.id} className="aspect-square bg-white relative">
                    <img src={firstImage} alt="" className="w-full h-full object-cover" />
                    {post.places.length > 1 && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="grid grid-cols-2 gap-px w-2.5 h-2.5">
                          <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                          <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
      {activeTab === 'Map' && (
        <div className="px-4 pt-4 pb-6">
          <p className="text-sm font-bold text-gray-900 mb-1">Your Travel Map</p>
          <p className="text-xs text-gray-400 mb-3">Every place you've been, on one map.</p>
          <Suspense fallback={<div className="h-72 bg-gray-100 rounded-xl animate-pulse" />}>
            <MapView places={visitedPlaces} height="280px" />
          </Suspense>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { value: actualCountriesCount, label: 'Countries' },
              { value: actualPlacesCount, label: 'Places' },
              { value: '3', label: 'Continents' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-gray-50 rounded-xl py-3">
                <p className="text-lg font-black text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collections Tab */}
      {activeTab === 'Collections' && (
        isNewUser ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">🗂️</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">Curate your favourite places into shareable collections</p>
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
                { icon: Edit3, label: 'Edit Profile', action: () => { setShowMenu(false); { setEditName(displayUser.name); setEditUsername(displayUser.username); setEditBio(displayUser.bio ?? ''); setShowEditProfile(true); }; } },
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
