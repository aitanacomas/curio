import { useState, useEffect } from 'react';
import { ArrowLeft, Check, MapPin } from 'lucide-react';
import { supabase, getUserPosts, getFollowCounts, getProfile, type RealPost } from '../lib/supabase';
import ImageCarousel from '../components/ImageCarousel';

interface Props {
  userId: string;
  currentUserId: string;
  onBack: () => void;
  onFollowChange?: (delta: number) => void;
}

type ProfileTab = 'Posts' | 'Map' | 'Collections';

export default function UserProfile({ userId, currentUserId, onBack, onFollowChange }: Props) {
  const [profile, setProfile] = useState<{ name: string; username: string; avatarUrl: string | null } | null>(null);
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

  useEffect(() => {
    Promise.all([
      getProfile(userId),
      getUserPosts(userId),
      getFollowCounts(userId),
      // Check if currentUser follows this user
      supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', userId).maybeSingle(),
    ]).then(([prof, p, counts, { data: followRow }]) => {
      setProfile(prof ? { name: prof.name ?? '', username: prof.username ?? '', avatarUrl: prof.avatar_url ?? null } : null);
      setPosts(p);
      setFollowerCount(counts.followers);
      setFollowingCount(counts.following);
      setFollowing(!!followRow);
      setLoadingPosts(false);
    });
  }, [userId, currentUserId]);

  const handleFollow = async () => {
    const nowFollowing = !following;
    setFollowing(nowFollowing);
    setFollowerCount(c => c + (nowFollowing ? 1 : -1));
    onFollowChange?.(nowFollowing ? 1 : -1);
    if (nowFollowing) {
      const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId });
      if (error) { setFollowing(false); setFollowerCount(c => c - 1); onFollowChange?.(-1); }
    } else {
      const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', userId);
      if (error) { setFollowing(true); setFollowerCount(c => c + 1); onFollowChange?.(1); }
    }
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
  const totalPlaces = posts.reduce((n, p) => n + p.places.length, 0);

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
    const labels = selectedPost.places.map(pl => pl.name);
    return (
      <div className="bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => setSelectedPost(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-slate-400">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{profile?.name}</p>
            <p className="text-xs text-gray-400">{new Date(selectedPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        {images.length > 0 && <ImageCarousel images={images} labels={labels} />}
        <div className="px-4 pt-3 pb-4 border-b border-gray-100">
          <p className="text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>
          {selectedPost.locationLabel && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <MapPin size={10} strokeWidth={1.5} />{selectedPost.locationLabel}
            </p>
          )}
        </div>
        <div className="px-4 pt-4 pb-10">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {selectedPost.places.length} Place{selectedPost.places.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            {selectedPost.places.map(place => (
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

  // ── Main profile view ─────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Top nav */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
          <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-900 leading-tight">{profile?.name ?? '…'}</h2>
          <p className="text-xs text-gray-400">@{profile?.username ?? '…'}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Header */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-4">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-16 h-16 rounded-full object-cover object-top flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-slate-400">{initials || '?'}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <button
              onClick={handleFollow}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                following ? 'bg-gray-100 text-gray-600' : 'bg-slate-900 text-white'
              }`}
            >
              {following ? <><Check size={13} strokeWidth={2} />Following</> : <>Follow</>}
            </button>
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
            className={`py-3 text-sm font-medium transition-colors ${
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
          <div className="grid grid-cols-3 gap-px bg-gray-100">
            {posts.map(post => {
              const firstImage = post.places[0]?.photoUrl;
              if (!firstImage) return null;
              return (
                <button key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-white relative">
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
            })}
          </div>
        )
      )}

      {activeTab === 'Map' && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <span className="text-3xl">🗺️</span>
          </div>
          <p className="text-slate-800 font-semibold text-base mb-1.5">Travel map</p>
          <p className="text-slate-400 text-sm text-center max-w-[200px]">
            {profile?.name.split(' ')[0]}'s travel map will appear here
          </p>
        </div>
      )}

      {activeTab === 'Collections' && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <span className="text-3xl">🗂️</span>
          </div>
          <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
          <p className="text-slate-400 text-sm text-center max-w-[200px]">
            Collections {profile?.name.split(' ')[0]} creates will appear here
          </p>
        </div>
      )}
    </div>
  );
}
