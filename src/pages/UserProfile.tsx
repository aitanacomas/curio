import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, MapPin, Map, MessageCircle, Share2, Bookmark, BookmarkCheck, Plus, Heart, Send, Search, X, Copy, MoreHorizontal, Flag, UserX, Trash2, Loader2, ChevronRight } from 'lucide-react';
import { supabase, getUserPosts, getFollowCounts, getProfile, getUserCollections, getCollectionPlaces, geocodeMissingPlaces, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, subscribeToCollection, unsubscribeFromCollection, isSubscribedToCollection, createCollection, getPublicUrl, likePost, unlikePost, getLikedPosts, getPostLikeCounts, savePlace, unsavePlace, getSavedPlaceIds, getPostComments, addComment, deleteComment, deletePost, getPlans, createPlan, createPlanDay, createPlanItem, getUserGuides, subscribeToGuide, unsubscribeFromGuide, isSubscribedToGuide, getGuideSubscriberCount, getSubscribedGuideIds, getGuideCollectionIds, addGuideToCollection, removeGuideFromCollection, getConversations, getOrCreateConversation, sendMessage, searchProfiles, reportContent, blockUser, unblockUser, getBlockedUsers, getBlockersOfUser, sendFollowRequest, cancelFollowRequest, getFollowRequestStatus, type RealPost, type RealCollection, type RealPostPlace, type PostComment, type Plan, type Guide, type Conversation, type FollowProfile } from '../lib/supabase';
import GuideDetail from '../components/GuideDetail';
import PlacePage from '../components/PlacePage';
import ActionModal from '../components/ActionModal';
import { googleTypesToCategory } from '../lib/placeUtils';
import { gTextSearch, TTL } from '../lib/googlePlaces';
import { US_STATES, CATEGORY_EMOJI as categoryEmoji, timeAgo } from '../lib/constants';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
import ImageCarousel from '../components/ImageCarousel';

const MapView = lazy(() => import('../components/MapView'));

interface Props {
  userId: string;
  currentUserId: string;
  onBack: () => void;
  onFollowChange?: (delta: number) => void;
  onMessage?: (userId: string) => void;
  onFollowStateChange?: () => void;
}

type ProfileTab = 'Posts' | 'Map' | 'Collections' | 'Guides';

export default function UserProfile({ userId, currentUserId, onBack, onFollowChange, onMessage, onFollowStateChange }: Props) {
  const [profile, setProfile] = useState<{ name: string; username: string; avatarUrl: string | null; coverUrl?: string | null; bio?: string | null; location?: string | null; isPrivate?: boolean } | null>(null);
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followRequested, setFollowRequested] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [selectedPost, setSelectedPost] = useState<RealPost | null>(null);
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<{ id: string; name: string; username: string; avatarUrl: string | null }[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [unfollowing, setUnfollowing] = useState(false);
  const [showUnfollowColConfirm, setShowUnfollowColConfirm] = useState(false);
  const [selectedCollectionPlacePage, setSelectedCollectionPlacePage] = useState<RealPostPlace | null>(null);
  const [collections, setCollections] = useState<RealCollection[]>([]);
  const [viewingCollection, setViewingCollection] = useState<RealCollection | null>(null);
  const [collectionPlaces, setCollectionPlaces] = useState<RealPostPlace[]>([]);
  const [collectionPlacesLoading, setCollectionPlacesLoading] = useState(false);
  const [colFilter, setColFilter] = useState('all');
  const [showColMap, setShowColMap] = useState(true);
  const [enrichingMap, setEnrichingMap] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const userProfileMapRef = useRef<import('leaflet').Map | null>(null);
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
  const [showNewColSheet, setShowNewColSheet] = useState(false);
  const [newColSheetName, setNewColSheetName] = useState('');
  const [newColSheetDesc, setNewColSheetDesc] = useState('');
  const [newColSheetCoverUrl, setNewColSheetCoverUrl] = useState<string | null>(null);
  const [newColSheetCoverUploading, setNewColSheetCoverUploading] = useState(false);
  const [newColSheetSaving, setNewColSheetSaving] = useState(false);
  const [newColSheetContext, setNewColSheetContext] = useState<'saveAll' | 'singlePlace' | null>(null);
  const [saveAllColIds, setSaveAllColIds] = useState<Set<string>>(new Set());
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [postLikeCounts, setPostLikeCounts] = useState<Record<string, number>>({});
  const [showPostMap, setShowPostMap] = useState(false);
  const [postPlaceSavedIds, setPostPlaceSavedIds] = useState<Set<string>>(new Set());
  const [allSavedIds, setAllSavedIds] = useState<Set<string>>(new Set());
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [postCommentText, setPostCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [postOptionsStep, setPostOptionsStep] = useState<'options' | 'reason' | 'done' | 'blockConfirm' | 'deleteConfirm'>('options');
  const [postOptionsReason, setPostOptionsReason] = useState('');
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [followListError, setFollowListError] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [userGuides, setUserGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [upSubscribedGuideIds, setUpSubscribedGuideIds] = useState<Set<string>>(new Set());
  const [upGuideColSheet, setUpGuideColSheet] = useState<Guide | null>(null);
  const [upGuideColIds, setUpGuideColIds] = useState<Set<string>>(new Set());
  const [upGuideColLoading, setUpGuideColLoading] = useState(false);
  const postCommentInputRef = useRef<HTMLInputElement>(null);
  const [showUserPostShare, setShowUserPostShare] = useState(false);
  const [userPostShareConversations, setUserPostShareConversations] = useState<Conversation[]>([]);
  const [userPostShareSentTo, setUserPostShareSentTo] = useState<Set<string>>(new Set());
  const [userPostShareSearch, setUserPostShareSearch] = useState('');
  const [userPostShareResults, setUserPostShareResults] = useState<FollowProfile[]>([]);
  const [searchingUserPostShare, setSearchingUserPostShare] = useState(false);
  const [userPostShareLinkCopied, setUserPostShareLinkCopied] = useState(false);
  const userPostShareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Collection share sheet
  const [followErrorToast, setFollowErrorToast] = useState(false);
  const [showCollShareSheet, setShowCollShareSheet] = useState(false);
  const [collShareSearch, setCollShareSearch] = useState('');
  const [collShareResults, setCollShareResults] = useState<FollowProfile[]>([]);
  const [collShareSentTo, setCollShareSentTo] = useState<Set<string>>(new Set());
  const [searchingCollShare, setSearchingCollShare] = useState(false);
  const [collShareLinkCopied, setCollShareLinkCopied] = useState(false);
  const collShareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postDetailKey, setPostDetailKey] = useState(0);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [showAvatarZoom, setShowAvatarZoom] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [upActionModal, setUpActionModal] = useState<{
    avatarUrl?: string | null; iconType?: 'check'; title: string; subtitle: string;
    confirmLabel?: string; confirmVariant?: 'red' | 'dark'; onConfirm?: () => void;
  } | null>(null);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportSuccessToast, setReportSuccessToast] = useState(false);
  const REPORT_REASONS = ['Spam', 'Inappropriate content', 'Misinformation', 'Harassment', 'Other'];
  // Trips state — shared between post and individual-place save sheets
  const [savePlans, setSavePlans] = useState<Plan[]>([]);
  const [savePlanAdded, setSavePlanAdded] = useState<Set<string>>(new Set());
  const [savePlanAdding, setSavePlanAdding] = useState<string | null>(null);
  const [saveShowNewTrip, setSaveShowNewTrip] = useState(false);
  const [saveNewTripName, setSaveNewTripName] = useState('');
  const [saveCreatingTrip, setSaveCreatingTrip] = useState(false);

  useEffect(() => {
    return () => {
      if (userPostShareSearchRef.current) clearTimeout(userPostShareSearchRef.current);
      if (collShareSearchRef.current) clearTimeout(collShareSearchRef.current);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      getProfile(userId),
      getUserPosts(userId),
      getFollowCounts(userId),
      supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', userId).maybeSingle(),
      getUserCollections(userId),
    ]).then(([prof, p, counts, { data: followRow }, cols]) => {
      setProfile(prof ? { name: prof.name ?? '', username: prof.username ?? '', avatarUrl: prof.avatar_url ?? null, coverUrl: prof.cover_url ?? null, bio: prof.bio ?? null, location: prof.location ?? null, isPrivate: prof.is_private ?? false } : null);
      setPosts(p);
      setCollections(cols);
      setFollowerCount(counts.followers);
      setFollowingCount(counts.following);
      setFollowing(!!followRow);
      setLoadingPosts(false);
      // Check pending follow request if not already following
      if (!followRow && prof?.is_private) {
        getFollowRequestStatus(currentUserId, userId).then(status => {
          setFollowRequested(status === 'pending');
        });
      }
    });
    // Fetch guides
    getUserGuides(userId).then(setUserGuides);
    // Fetch subscribed guide IDs for bookmark state
    getSubscribedGuideIds(currentUserId).then(ids => setUpSubscribedGuideIds(new Set(ids)));
    // Fetch current user's own collections for the "save place" picker
    getUserCollections(currentUserId).then(setMyCollections);
    // Fetch current user's avatar for comment input
    getProfile(currentUserId).then(p => setCurrentUserAvatar(p?.avatar_url ?? null));
    // Fetch likes
    getLikedPosts(currentUserId).then(setLikedPosts);
    // Fetch all saved place IDs for bookmark state
    getSavedPlaceIds(currentUserId).then(setAllSavedIds);
    // Check block state in both directions
    Promise.all([getBlockedUsers(currentUserId), getBlockersOfUser(currentUserId)]).then(([blocked, blockers]) => {
      setIsBlockedByMe(blocked.has(userId));
      setHasBlockedMe(blockers.has(userId));
      setBlockedUsers(new Set([...blocked, ...blockers]));
    });
    // Load current user's trips for save sheets
    getPlans(currentUserId).then(setSavePlans);
  }, [userId, currentUserId]);

  // Load like counts + saved place ids whenever a post is opened
  useEffect(() => {
    if (!selectedPost) return;
    getPostLikeCounts([selectedPost.id]).then(counts => setPostLikeCounts(prev => ({ ...prev, ...counts })));
    // Load saved place ids for this post
    Promise.all(selectedPost.places.map(async p => {
      const cols = await getPlaceCollectionIds(p.id);
      return { id: p.id, saved: cols.size > 0 };
    })).then(results => {
      const saved = new Set<string>(results.filter(r => r.saved).map(r => r.id));
      setPostPlaceSavedIds(saved);
    }).catch(() => {});
    // Auto-enrich any places missing neighbourhood, city, category, or coordinates (in-memory only for other users' posts)
    const isAbbreviation = (s: string) => /^[A-Z]{2}$/.test((s ?? '').trim());
    const missingData = selectedPost.places.filter(pl => !pl.neighborhood || !pl.city || !pl.category || pl.lat == null || isAbbreviation(pl.city));
    if (missingData.length === 0) return;
    (async () => {
      const normalCity = (c: string) => ({ cdmx: 'Mexico City', 'ciudad de mexico': 'Mexico City', 'ciudad de méxico': 'Mexico City', nyc: 'New York City', la: 'Los Angeles', sf: 'San Francisco', dc: 'Washington DC' }[c?.toLowerCase()] ?? c);
      const searchPlace = async (textQuery: string) => {
        const d = await gTextSearch(
          { textQuery, languageCode: 'en' },
          'places.addressComponents,places.types,places.location',
          TTL.ENRICHMENT,
        );
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
        // Write fixes to DB so this place never needs enriching again
        Object.entries(fixes).forEach(([id, fix]) => {
          supabase.from('post_places').update(fix).eq('id', id).then(() => {});
        });
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
  }, [selectedPost?.id, postDetailKey]);

  // Load real comments when a post is opened
  useEffect(() => {
    if (!selectedPost) { setPostComments([]); setPostCommentText(''); setCommentsError(false); return; }
    setLoadingComments(true);
    setCommentsError(false);
    getPostComments(selectedPost.id)
      .then(comments => {
        setPostComments(comments);
        setLoadingComments(false);
      })
      .catch(() => {
        setCommentsError(true);
        setLoadingComments(false);
      });
  }, [selectedPost?.id, postDetailKey]);

  // When "Save all" picker opens, compute which collections already contain ALL places
  useEffect(() => {
    if (!showSaveAllPicker || !selectedPost || selectedPost.places.length === 0) { setSaveAllColIds(new Set()); return; }
    Promise.all(selectedPost.places.map(pl => getPlaceCollectionIds(pl.id))).then(sets => {
      const intersection = sets.reduce<Set<string>>((acc, cur) => new Set([...acc].filter(id => cur.has(id))), sets[0] ?? new Set());
      setSaveAllColIds(intersection);
    });
  }, [showSaveAllPicker, selectedPost]);

  // When map tab opens, enrich any places missing coordinates (in-memory)
  useEffect(() => {
    if (activeTab !== 'Map') return;
    const allPlaces = posts.flatMap(p => p.places);
    const missingCoords = allPlaces.filter(pl => pl.lat == null || pl.lng == null);
    if (missingCoords.length === 0) return;
    let cancelled = false;
    setEnrichingMap(true);
    (async () => {
      const fixes: Record<string, { lat?: number; lng?: number }> = {};
      for (const pl of missingCoords) {
        if (cancelled) return;
        try {
          const data = await gTextSearch(
            { textQuery: [pl.name, pl.city, pl.country].filter(Boolean).join(', '), languageCode: 'en' },
            'places.location',
            TTL.ENRICHMENT,
          );
          const loc = data.places?.[0]?.location;
          if (loc?.latitude != null && loc?.longitude != null) fixes[pl.id] = { lat: loc.latitude, lng: loc.longitude };
        } catch { /* skip */ }
      }
      if (cancelled) return;
      if (Object.keys(fixes).length > 0) {
        // Write coords to DB so map never needs to re-geocode these places
        Object.entries(fixes).forEach(([id, coords]) => {
          supabase.from('post_places').update(coords).eq('id', id).then(() => {});
        });
        setPosts(prev => prev.map(post => ({
          ...post,
          places: post.places.map(pl => fixes[pl.id] ? { ...pl, ...fixes[pl.id] } : pl),
        })));
      }
      setEnrichingMap(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleFollow = async () => {
    if (userId === currentUserId) return;
    if (following) {
      setShowUnfollowConfirm(true);
    } else if (followRequested) {
      // Cancel pending request
      setFollowRequested(false);
      await cancelFollowRequest(currentUserId, userId);
    } else {
      doFollow();
    }
  };

  const doFollow = async () => {
    if (userId === currentUserId) return;
    if (profile?.isPrivate) {
      // Private account — send a follow request instead
      setFollowRequested(true);
      const ok = await sendFollowRequest(currentUserId, userId);
      if (!ok) setFollowRequested(false);
      return;
    }
    setFollowing(true);
    setFollowerCount(c => c + 1);
    onFollowChange?.(1);
    const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId });
    if (error) {
      setFollowing(false);
      setFollowerCount(c => c - 1);
      onFollowChange?.(-1);
      setFollowErrorToast(true);
      setTimeout(() => setFollowErrorToast(false), 3000);
    } else {
      onFollowStateChange?.();
    }
  };

  const doUnfollow = async () => {
    setUnfollowing(true);
    const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', userId);
    if (!error) {
      setFollowing(false);
      setFollowerCount(c => c - 1);
      onFollowChange?.(-1);
    } else {
      setFollowErrorToast(true);
      setTimeout(() => setFollowErrorToast(false), 3000);
    }
    setUnfollowing(false);
    setShowUnfollowConfirm(false);
  };

  const openFollowList = async (type: 'followers' | 'following') => {
    setShowFollowList(type);
    setLoadingList(true);
    setFollowListError(false);
    if (type === 'followers') {
      const { data, error } = await supabase
        .from('follows')
        .select('follower:profiles!follower_id ( id, name, username, avatar_url )')
        .eq('following_id', userId);
      if (error) {
        setFollowListError(true);
      } else {
        setFollowList((data ?? []).map((r: any) => ({ id: r.follower.id, name: r.follower.name ?? '', username: r.follower.username ?? '', avatarUrl: r.follower.avatar_url ?? null })));
      }
    } else {
      const { data, error } = await supabase
        .from('follows')
        .select('following:profiles!following_id ( id, name, username, avatar_url )')
        .eq('follower_id', userId);
      if (error) {
        setFollowListError(true);
      } else {
        setFollowList((data ?? []).map((r: any) => ({ id: r.following.id, name: r.following.name ?? '', username: r.following.username ?? '', avatarUrl: r.following.avatar_url ?? null })));
      }
    }
    setLoadingList(false);
  };

  const initials = (profile?.name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const totalPlaces = (() => { const seen = new Set<string>(); return posts.flatMap(p => p.places).filter(pl => { const k = pl.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).length; })();

  // ── Blocked by this user — show a neutral wall, don't reveal why ──
  if (hasBlockedMe) {
    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-gray-100">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <UserX size={26} strokeWidth={1.5} className="text-gray-400" />
          </div>
          <p className="text-base font-bold text-gray-900 mb-2">This account isn't available</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            The link you followed may be broken, or the account may have been removed.
          </p>
        </div>
      </div>
    );
  }

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
          ) : followListError ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-3xl mb-3">⚠️</p>
              <p className="text-sm font-semibold text-gray-900 mb-1">Couldn't load list</p>
              <p className="text-xs text-gray-400 mb-4">Something went wrong. Tap to retry.</p>
              <button
                onClick={() => { setFollowListError(false); openFollowList(showFollowList!); }}
                className="px-5 py-2 bg-gray-900 text-white text-xs font-bold rounded-full"
              >
                Retry
              </button>
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
              <button
                className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md rounded-full px-2 py-1.5 w-fit max-w-[65%] overflow-hidden active:opacity-75"
                onClick={() => setSelectedPost(null)}
              >
                {profile?.avatarUrl
                  ? <img src={profile.avatarUrl} alt={profile.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/20 flex-shrink-0"><span className="text-xs font-bold text-white">{initials}</span></div>
                }
                {(selectedPost.collaborators ?? []).slice(0, 2).map(c => (
                  c.avatarUrl
                    ? <img key={c.id} src={c.avatarUrl} alt={c.name} className="-ml-2 w-7 h-7 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" />
                    : <div key={c.id} className="-ml-2 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/20 flex-shrink-0"><span className="text-xs font-bold text-white">{c.name[0]?.toUpperCase()}</span></div>
                ))}
                <p className="text-white font-semibold text-sm leading-tight truncate ml-1">
                  {(selectedPost.collaborators ?? []).length > 0
                    ? `${profile?.username || profile?.name} & ${(selectedPost.collaborators ?? []).map(c => c.username || c.name).join(' & ')}`
                    : (profile?.username || profile?.name)}
                </p>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { setPostOptionsStep('options'); setPostOptionsReason(''); setShowPostOptions(true); }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md flex-shrink-0"
              >
                <MoreHorizontal size={17} strokeWidth={1.5} className="text-white" />
              </button>
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
                onClick={async () => {
                  if (likingPostIds.has(selectedPost.id)) return;
                  setLikingPostIds(prev => new Set(prev).add(selectedPost.id));
                  const nowLiked = likedPosts.has(selectedPost.id);
                  setLikedPosts(prev => { const n = new Set(prev); nowLiked ? n.delete(selectedPost.id) : n.add(selectedPost.id); return n; });
                  setPostLikeCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] ?? 0) + (nowLiked ? -1 : 1) }));
                  try {
                    const ok = await (nowLiked ? unlikePost(currentUserId, selectedPost.id) : likePost(currentUserId, selectedPost.id));
                    if (!ok) {
                      setLikedPosts(prev => { const n = new Set(prev); nowLiked ? n.add(selectedPost.id) : n.delete(selectedPost.id); return n; });
                      setPostLikeCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] ?? 0) + (nowLiked ? 1 : -1) }));
                    }
                  } finally {
                    setLikingPostIds(prev => { const n = new Set(prev); n.delete(selectedPost.id); return n; });
                  }
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
                setUserPostShareSentTo(new Set());
                setUserPostShareSearch('');
                setUserPostShareResults([]);
                setUserPostShareLinkCopied(false);
                setShowUserPostShare(true);
                getConversations(currentUserId).then(setUserPostShareConversations);
              }}>
                <Send size={21} strokeWidth={1.5} className="text-gray-800" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (allSaved) {
                    // Unsave all places optimistically
                    const placeIds = selectedPost.places.map(p => p.id);
                    const prevSaved = new Set(allSavedIds);
                    setAllSavedIds(prev => { const n = new Set(prev); placeIds.forEach(id => n.delete(id)); return n; });
                    for (const p of selectedPost.places) {
                      const ok = await unsavePlace(currentUserId, p.id);
                      if (!ok) {
                        // Rollback all on first failure
                        setAllSavedIds(prevSaved);
                        break;
                      }
                    }
                  } else {
                    // Save all places optimistically — capture prevState for per-place rollback
                    const prevSaved = new Set(allSavedIds);
                    setAllSavedIds(prev => { const n = new Set(prev); selectedPost.places.forEach(p => n.add(p.id)); return n; });
                    const results = await Promise.all(selectedPost.places.map(async p => ({ id: p.id, ok: await savePlace(currentUserId, p.id) })));
                    const failedIds = results.filter(r => !r.ok).map(r => r.id);
                    if (failedIds.length > 0) {
                      // Rollback only the failed ones
                      setAllSavedIds(prev => {
                        const n = new Set(prev);
                        failedIds.forEach(id => { if (!prevSaved.has(id)) n.delete(id); });
                        return n;
                      });
                    }
                    setShowSaveAllPicker(true);
                  }
                }}
              >
                {allSaved
                  ? <BookmarkCheck size={22} strokeWidth={1.5} className="text-gray-900" />
                  : <Bookmark size={22} strokeWidth={1.5} className="text-gray-700" />}
              </button>
            </div>
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
            {(() => {
              const uniquePlaceCount = new Set(selectedPost.places.map(p => p.name.split(',')[0].trim().toLowerCase())).size;
              return (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {uniquePlaceCount} place{uniquePlaceCount !== 1 ? 's' : ''}
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
              ); })()}
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
                        const ok = await unsavePlace(currentUserId, place.id);
                        if (!ok) setAllSavedIds(prev => new Set(prev).add(place.id));
                      } else {
                        setAllSavedIds(prev => new Set(prev).add(place.id));
                        const ok = await savePlace(currentUserId, place.id);
                        if (!ok) {
                          setAllSavedIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                        } else {
                          setSavingPlace({ id: place.id, name: place.name.split(',')[0].trim() });
                          setLoadingPlaceInCols(true);
                          const ids = await getPlaceCollectionIds(place.id);
                          setPlaceInMyCollections(ids);
                          setLoadingPlaceInCols(false);
                        }
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
            {commentsError ? (
              <button
                onClick={() => {
                  setCommentsError(false);
                  setLoadingComments(true);
                  getPostComments(selectedPost.id)
                    .then(comments => { setPostComments(comments); setLoadingComments(false); })
                    .catch(() => { setCommentsError(true); setLoadingComments(false); });
                }}
                className="w-full text-sm text-gray-400 text-center py-3 active:text-gray-600"
              >
                Couldn't load comments — tap to retry
              </button>
            ) : (
              <>
                {postComments.filter(c => !blockedUsers.has(c.userId)).length === 0 && !loadingComments && (
                  <p className="text-sm text-gray-400 text-center py-3">Be the first one to add a comment ✨</p>
                )}
                {postComments.filter(c => !blockedUsers.has(c.userId)).length > 0 && (
                  <div className="space-y-3 mb-4">
                    {postComments.filter(c => !blockedUsers.has(c.userId)).map(c => (
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
                          confirmDeleteCommentId === c.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                              <button
                                onClick={async () => {
                                  await deleteComment(c.id);
                                  setPostComments(prev => prev.filter(x => x.id !== c.id));
                                  setConfirmDeleteCommentId(null);
                                }}
                                className="text-[10px] font-bold text-red-500 px-1.5 py-0.5 rounded-full bg-red-50"
                              >Delete?</button>
                              <button
                                onClick={() => setConfirmDeleteCommentId(null)}
                                className="text-[10px] text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-100"
                              >Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteCommentId(c.id)}
                              className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5"
                            >✕</button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 mt-3">
              {currentUserAvatar
                ? <img src={currentUserAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />}
              <input
                ref={postCommentInputRef}
                value={postCommentText}
                onChange={e => setPostCommentText(e.target.value)}
                disabled={commentSending}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && postCommentText.trim() && selectedPost && !commentSending) {
                    const text = postCommentText.trim();
                    setPostCommentText('');
                    setCommentSending(true);
                    try {
                      const saved = await addComment(currentUserId, selectedPost.id, text);
                      if (saved) setPostComments(prev => [...prev, saved]);
                    } finally {
                      setCommentSending(false);
                    }
                  }
                }}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400 disabled:opacity-50"
              />
              {postCommentText.trim() && (
                <button
                  disabled={commentSending}
                  onClick={async () => {
                    if (!selectedPost || commentSending) return;
                    const text = postCommentText.trim();
                    setPostCommentText('');
                    setCommentSending(true);
                    try {
                      const saved = await addComment(currentUserId, selectedPost.id, text);
                      if (saved) setPostComments(prev => [...prev, saved]);
                    } finally {
                      setCommentSending(false);
                    }
                  }}
                  className="text-xs font-bold text-gray-900 disabled:opacity-40"
                >{commentSending ? '…' : 'Post'}</button>
              )}
            </div>
          </div>

          {/* Date — very end of post */}
          <p className="text-xs text-gray-400 px-5 pb-8 pt-4">{new Date(selectedPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        </div>

        {/* Delete post confirmation sheet (BUG-47) */}
        {/* Post options sheet (···) */}
        {showPostOptions && selectedPost && (
          <div className="fixed inset-0 z-[500] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowPostOptions(false)} />
            <div className="relative bg-white rounded-t-3xl pb-10">
              <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
              {postOptionsStep === 'options' && (
                <>
                  <div className="py-1">
                    {currentUserId === selectedPost.userId ? (
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => setPostOptionsStep('deleteConfirm')}>
                        <Trash2 size={18} strokeWidth={1.5} className="text-gray-500" />
                        <span className="text-sm text-gray-900">Delete</span>
                      </button>
                    ) : (
                      <>
                        <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                          onClick={() => setPostOptionsStep('reason')}>
                          <Flag size={18} strokeWidth={1.5} className="text-gray-500" />
                          <span className="text-sm text-gray-900">Report</span>
                          <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto" />
                        </button>
                        <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                          onClick={() => {
                            setShowPostOptions(false);
                            setUpActionModal({
                              avatarUrl: selectedPost.profile.avatarUrl,
                              title: isBlockedByMe ? `Unblock @${selectedPost.profile.username || selectedPost.profile.name}?` : `Block @${selectedPost.profile.username || selectedPost.profile.name}?`,
                              subtitle: isBlockedByMe
                                ? 'They will be able to see your posts and find your profile again.'
                                : "They won't be able to see your profile or posts, and you won't see theirs.",
                              confirmLabel: isBlockedByMe ? 'Unblock' : 'Block',
                              confirmVariant: isBlockedByMe ? 'dark' : 'red',
                              onConfirm: async () => {
                                if (isBlockedByMe) {
                                  await unblockUser(currentUserId, userId);
                                  setIsBlockedByMe(false);
                                } else {
                                  await blockUser(currentUserId, selectedPost.userId);
                                  setIsBlockedByMe(true);
                                }
                                setSelectedPost(null);
                                setUpActionModal(null);
                              },
                            });
                          }}>
                          <UserX size={18} strokeWidth={1.5} className="text-gray-500" />
                          <span className="text-sm text-gray-900">{isBlockedByMe ? 'Unblock' : 'Block'} @{selectedPost.profile.username || selectedPost.profile.name}</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
              {postOptionsStep === 'reason' && (
                <>
                  <div className="px-5 pb-3 border-b border-gray-100">
                    <p className="text-base font-bold text-gray-900">Report</p>
                    <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
                  </div>
                  <div className="py-1">
                    {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(reason => (
                      <button key={reason} className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50"
                        onClick={async () => {
                          await reportContent(currentUserId, { postId: selectedPost.id, userId: selectedPost.userId, reason });
                          setShowPostOptions(false);
                          setUpActionModal({
                            iconType: 'check',
                            title: 'Report submitted',
                            subtitle: "Thank you. We'll review this content and take action if it violates our guidelines.",
                          });
                        }}>
                        <span className="text-sm text-gray-900">{reason}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {postOptionsStep === 'deleteConfirm' && (
                <div className="flex flex-col items-center px-6 pb-2 pt-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Trash2 size={28} strokeWidth={1.5} className="text-gray-400" />
                  </div>
                  <p className="text-base font-bold text-gray-900 mb-1">Delete this post?</p>
                  <p className="text-sm text-gray-400 text-center mb-6">This can't be undone.</p>
                  <button className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
                    onClick={async () => {
                      await deletePost(selectedPost.id);
                      setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
                      setShowPostOptions(false);
                      setSelectedPost(null);
                    }}>
                    Delete
                  </button>
                  <button className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold"
                    onClick={() => setPostOptionsStep('options')}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}

        {confirmDeletePostId && (
          <div className="fixed inset-0 z-[500] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeletePostId(null)} />
            <div className="relative bg-white rounded-t-3xl pb-10">
              <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
              <div className="px-6 pt-4 pb-2 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <Trash2 size={24} strokeWidth={1.5} className="text-red-500" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Delete this post?</p>
                <p className="text-sm text-gray-500 leading-snug">This can't be undone.</p>
              </div>
              <div className="px-5 pt-3 flex flex-col gap-2">
                <button
                  onClick={async () => {
                    const postId = confirmDeletePostId;
                    setConfirmDeletePostId(null);
                    await deletePost(postId);
                    setPosts(prev => prev.filter(p => p.id !== postId));
                    setSelectedPost(null);
                    setShowPostMap(false);
                  }}
                  className="w-full py-3.5 bg-red-500 text-white font-bold text-sm rounded-2xl active:opacity-80"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeletePostId(null)}
                  className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold text-sm rounded-2xl active:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main profile view ─────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen relative">
      {/* Hero cover */}
      <div className="relative" style={{ height: 200 }}>
        <div className="absolute inset-0">
          {profile?.coverUrl
            ? <img src={profile.coverUrl} alt="Cover" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
          }
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Top Nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pb-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
          </button>
          <div className="flex items-center gap-1.5">
            {userId !== currentUserId && (
              <button
                onClick={handleFollow}
                className={`h-9 flex items-center gap-1.5 px-3 rounded-full text-[11px] font-semibold transition-colors backdrop-blur-sm ${
                  following ? 'bg-black/25 text-white border border-white/30'
                  : followRequested ? 'bg-black/25 text-white border border-white/30'
                  : 'bg-white text-gray-900'
                }`}
              >
                {following ? <><Check size={10} strokeWidth={2.5} />Following</>
                  : followRequested ? <>Requested</>
                  : <>Follow</>}
              </button>
            )}
            {onMessage && (
              <button onClick={() => onMessage?.(userId)} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
                <MessageCircle size={17} strokeWidth={1.6} className="text-white" />
              </button>
            )}
            <button onClick={() => setShowUserMenu(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
              <MoreHorizontal size={17} strokeWidth={1.6} className="text-white" />
            </button>
          </div>
        </div>

        {/* Name + @username bottom-left */}
        <div className="absolute bottom-10 right-28" style={{ left: 24 }}>
          <p className="text-base font-semibold text-white leading-tight drop-shadow">{profile?.name ?? '…'}</p>
          <p className="text-sm font-light text-white/70 mt-0.5">@{profile?.username ?? '…'}</p>
        </div>
      </div>

      {/* White card overlapping cover */}
      <div className="relative bg-white rounded-t-3xl -mt-6" style={{ zIndex: 10 }}>
        {/* Avatar */}
        <button
          onClick={() => profile?.avatarUrl && setShowAvatarZoom(true)}
          className="absolute rounded-full overflow-hidden"
          style={{ top: -44, right: 24, width: 88, height: 88, boxShadow: '0 0 0 4px white', zIndex: 20 }}
        >
          {profile?.avatarUrl
            ? <img src={profile.avatarUrl} alt={profile?.name} className="w-full h-full object-cover object-top" />
            : <div className="w-full h-full bg-gray-300 flex items-center justify-center text-2xl font-bold text-white">{profile?.name?.[0]?.toUpperCase() ?? '?'}</div>
          }
        </button>

        {/* Bio + followers */}
        <div className="pr-4 pt-4 pb-3" style={{ minHeight: 64, paddingLeft: 24 }}>
          {profile?.bio && (
            <p className="text-sm text-gray-700 leading-snug mb-1.5">{profile.bio}</p>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <button onClick={() => openFollowList('followers')} className="font-medium text-gray-800">
              {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
            </button>
            <span className="text-gray-400">·</span>
            <button onClick={() => openFollowList('following')} className="font-medium text-gray-800">
              {followingCount} following
            </button>
          </div>
        </div>
      </div>

      {/* Pill Tabs */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white overflow-x-auto">
        {(['Posts', 'Map', 'Collections', 'Guides'] as ProfileTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Posts — Pinterest/masonry style */}
      {activeTab === 'Posts' && (
        loadingPosts ? (
          <div className="px-1.5 pt-1.5 pb-4" style={{ columns: 3, columnGap: 5 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="break-inside-avoid mb-1.5 rounded-xl overflow-hidden bg-gray-100 animate-pulse" style={{ aspectRatio: '4/5' }} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">📍</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No posts yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">
              When {profile?.name?.split(' ')[0] || 'this user'} posts, you'll see them here
            </p>
          </div>
        ) : (
          <div className="px-1.5 pt-1.5 pb-4" style={{ columns: 3, columnGap: 5 }}>
            {posts.map(post => {
              const firstImage = post.places.map(p => p.photoUrl).find(url => url && url.trim());
              if (!firstImage) return null;
              return (
                <div
                  key={post.id}
                  className="break-inside-avoid mb-1.5 relative rounded-xl overflow-hidden cursor-pointer active:opacity-90 transition-opacity"
                  onClick={() => { setSelectedPost(post); setPostDetailKey(k => k + 1); }}
                >
                  <div className="w-full" style={{ aspectRatio: '4/5' }}>
                    <img src={firstImage} alt="" className="w-full h-full object-cover block" draggable={false} onError={e => { (e.currentTarget.closest('div[class*="break-inside"]') as HTMLElement | null)?.remove(); }} />
                  </div>
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
                Places {profile?.name?.split(' ')[0] || 'this user'} tags will appear on the map
              </p>
            </div>
          );
        }
        return (
          <div className="pb-10">
            {/* Map with stats overlay */}
            <div className="px-4 pt-4">
              <div className="rounded-2xl relative" style={{ height: 220 }}>
                {/* Map clipped to rounded corners */}
                <div className="rounded-2xl overflow-hidden absolute inset-0">
                  {mapPlaces.length > 0 ? (
                    <Suspense fallback={<div className="h-full bg-gray-100 animate-pulse" />}>
                      <MapView
                        places={mapPlaces}
                        height="220px"
                        hideZoomControls
                        onMapReady={map => { userProfileMapRef.current = map; }}
                      />
                    </Suspense>
                  ) : (
                    <div className="h-full bg-gray-100 flex items-center justify-center">
                      <p className="text-xs text-gray-400">No places with coordinates yet</p>
                    </div>
                  )}
                </div>
                {/* Full-width gradient */}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl pointer-events-none" />
                {/* Stats */}
                <div className="absolute bottom-0 left-0 px-4 py-3 pointer-events-none">
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
                {/* Zoom controls */}
                {mapPlaces.length > 0 && (
                  <div className="absolute bottom-3 right-3 flex flex-col gap-1" style={{ zIndex: 10 }}>
                    <button
                      onClick={() => userProfileMapRef.current?.zoomIn()}
                      className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.15)', border: 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <line x1="6" y1="0" x2="6" y2="12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => userProfileMapRef.current?.zoomOut()}
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
                              const ok = await unsavePlace(currentUserId, pl.id);
                              if (!ok) setAllSavedIds(prev => new Set(prev).add(pl.id));
                            } else {
                              setAllSavedIds(prev => new Set(prev).add(pl.id));
                              const ok = await savePlace(currentUserId, pl.id);
                              if (!ok) {
                                setAllSavedIds(prev => { const n = new Set(prev); n.delete(pl.id); return n; });
                              } else {
                                setSavingPlace({ id: pl.id, name: pl.name });
                                setLoadingPlaceInCols(true);
                                const ids = await getPlaceCollectionIds(pl.id);
                                setPlaceInMyCollections(ids);
                                setLoadingPlaceInCols(false);
                              }
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
              Collections {profile?.name?.split(' ')[0] || 'this user'} creates will appear here
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
              <p className="text-base font-bold text-gray-900 mb-1">Unfollow {profile?.name?.split(' ')[0] || 'this user'}?</p>
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
            {/* Top-right: follow + share */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                disabled={subscribing}
                onClick={async () => {
                  if (isSubscribed) { setShowUnfollowColConfirm(true); return; }
                  setSubscribing(true);
                  await subscribeToCollection(currentUserId, viewingCollection.id);
                  setIsSubscribed(true);
                  setSubscribing(false);
                }}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-colors backdrop-blur-sm ${isSubscribed ? 'bg-white/90 text-gray-500' : 'bg-white/90 text-gray-900'}`}
              >
                {subscribing ? '…' : isSubscribed ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={() => {
                  setCollShareSearch('');
                  setCollShareResults([]);
                  setCollShareSentTo(new Set());
                  setCollShareLinkCopied(false);
                  setShowCollShareSheet(true);
                  if (userPostShareConversations.length === 0) {
                    getConversations(currentUserId).then(setUserPostShareConversations);
                  }
                }}
                className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
              >
                <Share2 size={14} strokeWidth={1.5} className="text-gray-700" />
              </button>
            </div>
            {/* Title overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-black text-white">{viewingCollection.name}</h2>
              {viewingCollection.description && (
                <p className="text-white/70 text-xs mt-1">{viewingCollection.description}</p>
              )}
            </div>
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
            const catEmoji = (cat: string) => categoryEmoji[cat] ?? categoryEmoji[cat?.toLowerCase()] ?? '📍';
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
                            {/* Tappable area → PlacePage */}
                            <button
                              className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
                              onClick={() => setSelectedCollectionPlacePage(place)}
                            >
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
                            </button>
                            {/* Save button */}
                            <button
                              onClick={async () => {
                                const isSaved = allSavedIds.has(place.id);
                                if (isSaved) {
                                  setAllSavedIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                                  const ok = await unsavePlace(currentUserId, place.id);
                                  if (!ok) setAllSavedIds(prev => new Set(prev).add(place.id));
                                } else {
                                  setAllSavedIds(prev => new Set(prev).add(place.id));
                                  const ok = await savePlace(currentUserId, place.id);
                                  if (!ok) {
                                    setAllSavedIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                                  } else {
                                    setSavingPlace({ id: place.id, name: place.name });
                                    setLoadingPlaceInCols(true);
                                    const ids = await getPlaceCollectionIds(place.id);
                                    setPlaceInMyCollections(ids);
                                    setLoadingPlaceInCols(false);
                                  }
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

      {/* Collection Share Sheet */}
      {showCollShareSheet && viewingCollection && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCollShareSheet(false); setCollShareSearch(''); setCollShareResults([]); setCollShareSentTo(new Set()); }} />
          <div className="relative bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowCollShareSheet(false); setCollShareSearch(''); setCollShareResults([]); setCollShareSentTo(new Set()); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={collShareSearch}
                  onChange={e => {
                    const q = e.target.value;
                    setCollShareSearch(q);
                    if (collShareSearchRef.current) clearTimeout(collShareSearchRef.current);
                    if (!q.trim()) { setCollShareResults([]); setSearchingCollShare(false); return; }
                    setSearchingCollShare(true);
                    collShareSearchRef.current = setTimeout(async () => {
                      const results = await searchProfiles(q, currentUserId);
                      setCollShareResults(results);
                      setSearchingCollShare(false);
                    }, 300);
                  }}
                  placeholder="Search people..."
                  className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                />
                {searchingCollShare && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
              </div>
            </div>
            {(() => {
              const showSearch = collShareSearch.trim().length > 0;
              const list = showSearch ? collShareResults : userPostShareConversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && collShareResults.length === 0 && !searchingCollShare) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              }
              if (!showSearch && userPostShareConversations.length === 0) return null;
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const sent = collShareSentTo.has(person.id);
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={person.id}
                        onClick={async () => {
                          if (sent) return;
                          const convId = await getOrCreateConversation(currentUserId, person.id);
                          if (convId) {
                            const url = `${window.location.origin}/collection/${viewingCollection.id}`;
                            await sendMessage(convId, currentUserId, `Check out this collection "${viewingCollection.name || 'Someone\'s collection'}" on sondrr: ${url}`);
                            setCollShareSentTo(prev => new Set(prev).add(person.id));
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
                  const url = `${window.location.origin}/collection/${viewingCollection.id}`;
                  if (navigator.share) {
                    try { await navigator.share({ url, title: viewingCollection.name || 'Collection on sondrr' }); } catch {}
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
                  navigator.clipboard.writeText(`${window.location.origin}/collection/${viewingCollection.id}`).catch(() => {});
                  setCollShareLinkCopied(true);
                  setTimeout(() => setCollShareLinkCopied(false), 1500);
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {collShareLinkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                </div>
                <span className="text-sm font-semibold text-gray-900">{collShareLinkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place detail overlay (from collection view) */}
      {selectedCollectionPlacePage && (
        <PlacePage
          place={selectedCollectionPlacePage}
          appUser={{ id: currentUserId } as any}
          isSaved={allSavedIds.has(selectedCollectionPlacePage.id)}
          onClose={() => setSelectedCollectionPlacePage(null)}
          onToggleSave={async () => {
            const isSaved = allSavedIds.has(selectedCollectionPlacePage.id);
            if (isSaved) {
              // Unsave: optimistic remove
              setAllSavedIds(prev => { const n = new Set(prev); n.delete(selectedCollectionPlacePage.id); return n; });
              const ok = await unsavePlace(currentUserId, selectedCollectionPlacePage.id);
              if (!ok) setAllSavedIds(prev => new Set(prev).add(selectedCollectionPlacePage.id));
            } else {
              // Save: optimistic add, then open the collection sheet
              setAllSavedIds(prev => new Set(prev).add(selectedCollectionPlacePage.id));
              const ok = await savePlace(currentUserId, selectedCollectionPlacePage.id);
              if (!ok) {
                setAllSavedIds(prev => { const n = new Set(prev); n.delete(selectedCollectionPlacePage.id); return n; });
              } else {
                setSavingPlace({ id: selectedCollectionPlacePage.id, name: selectedCollectionPlacePage.name.split(',')[0].trim() });
                setLoadingPlaceInCols(true);
                setSavePlanAdded(new Set());
                setSaveShowNewTrip(false);
                setSaveNewTripName('');
                getPlans(currentUserId).then(setSavePlans);
                try {
                  const ids = await getPlaceCollectionIds(selectedCollectionPlacePage.id);
                  setPlaceInMyCollections(ids);
                } finally {
                  setLoadingPlaceInCols(false);
                }
              }
            }
          }}
        />
      )}

      {/* Unfollow collection confirmation sheet */}
      {showUnfollowColConfirm && viewingCollection && (
        <div className="fixed inset-0 z-[350] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnfollowColConfirm(false)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-4"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex flex-col items-center px-6 pb-2">
              {viewingCollection.coverImageUrl
                ? <img src={viewingCollection.coverImageUrl} alt={viewingCollection.name} className="w-16 h-16 rounded-2xl object-cover mb-3" />
                : <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><span className="text-3xl">{viewingCollection.emoji || '🗂️'}</span></div>
              }
              <p className="text-base font-bold text-gray-900 mb-1">Unfollow this collection?</p>
              <p className="text-sm text-gray-400 text-center mb-6">"{viewingCollection.name}" will be removed from your Following.</p>
              <button
                onClick={async () => {
                  setShowUnfollowColConfirm(false);
                  setSubscribing(true);
                  await unsubscribeFromCollection(currentUserId, viewingCollection.id);
                  setIsSubscribed(false);
                  setSubscribing(false);
                }}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
              >Unfollow</button>
              <button onClick={() => setShowUnfollowColConfirm(false)} className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Share bottom sheet */}
      {showUserPostShare && selectedPost && (() => {
        const sharePost = selectedPost as RealPost;
        return (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowUserPostShare(false); setUserPostShareSentTo(new Set()); setUserPostShareSearch(''); setUserPostShareResults([]); }} />
          <div className="relative bg-white rounded-t-3xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowUserPostShare(false); setUserPostShareSentTo(new Set()); setUserPostShareSearch(''); setUserPostShareResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            {/* Search bar */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={userPostShareSearch}
                  onChange={e => {
                    const q = e.target.value;
                    setUserPostShareSearch(q);
                    if (userPostShareSearchRef.current) clearTimeout(userPostShareSearchRef.current);
                    if (!q.trim()) { setUserPostShareResults([]); setSearchingUserPostShare(false); return; }
                    setSearchingUserPostShare(true);
                    userPostShareSearchRef.current = setTimeout(async () => {
                      const results = await searchProfiles(q, currentUserId);
                      setUserPostShareResults(results);
                      setSearchingUserPostShare(false);
                    }, 300);
                  }}
                  placeholder="Search people..."
                  className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                />
                {searchingUserPostShare && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
              </div>
            </div>
            {/* People list */}
            {(() => {
              const showSearch = userPostShareSearch.trim().length > 0;
              const list = showSearch ? userPostShareResults : userPostShareConversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && userPostShareResults.length === 0 && !searchingUserPostShare) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              }
              if (!showSearch && userPostShareConversations.length === 0) return null;
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const sent = userPostShareSentTo.has(person.id);
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={person.id}
                        onClick={async () => {
                          if (sent) return;
                          const convId = await getOrCreateConversation(currentUserId, person.id);
                          if (convId) {
                            const url = `${window.location.origin}/post/${sharePost.id}`;
                            await sendMessage(convId, currentUserId, `Check this out on sondrr: ${url}`);
                            setUserPostShareSentTo(prev => new Set(prev).add(person.id));
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
            {/* Divider + external options */}
            <div className="mt-2 border-t border-gray-100 px-3 pb-10">
              <button
                className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50"
                onClick={async () => {
                  const url = `${window.location.origin}/post/${sharePost.id}`;
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
                  navigator.clipboard.writeText(`${window.location.origin}/post/${sharePost.id}`).catch(() => {});
                  setUserPostShareLinkCopied(true);
                  setTimeout(() => setUserPostShareLinkCopied(false), 1500);
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {userPostShareLinkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                </div>
                <span className="text-sm font-semibold text-gray-900">{userPostShareLinkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Save ALL places to collection picker */}
      {showSaveAllPicker && (() => {
        const post = selectedPost!;
        return (
          <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowSaveAllPicker(false); setSavePlanAdded(new Set()); setSaveShowNewTrip(false); setSaveNewTripName(''); }} />
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
                <button
                  onClick={() => { setNewColSheetContext('saveAll'); setShowNewColSheet(true); }}
                  className="w-full flex items-center gap-3 py-3 text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={18} strokeWidth={2} className="text-gray-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">New collection</p>
                </button>
              </div>

              {/* ── Trips section ── */}
              <div className="mx-4 border-t border-gray-100 mt-1" />
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
                {savePlans.length === 0 && !saveShowNewTrip && (
                  <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
                )}
                {savePlans.length > 0 && (
                  <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                    {savePlans.map(plan => {
                      const added = savePlanAdded.has(plan.id);
                      const adding = savePlanAdding === plan.id;
                      return (
                        <button
                          key={plan.id}
                          disabled={added || adding}
                          onClick={async () => {
                            setSavePlanAdding(plan.id);
                            try {
                              const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                              const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                              if (day) {
                                const startPos = day.items.length;
                                for (let i = 0; i < post.places.length; i++) {
                                  const pl = post.places[i];
                                  await createPlanItem(plan.id, day.id, {
                                    name: pl.name,
                                    category: pl.category || '',
                                    image_url: pl.photoUrl || '',
                                    time_label: '',
                                    address: [pl.neighborhood, pl.city, pl.country].filter(Boolean).join(', '),
                                    neighborhood: pl.neighborhood || '',
                                    position: startPos + i,
                                    lat: pl.lat ?? null,
                                    lng: pl.lng ?? null,
                                  });
                                }
                                setSavePlanAdded(prev => new Set(prev).add(plan.id));
                              }
                            } finally {
                              setSavePlanAdding(null);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                        >
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                            {plan.coverImageUrl
                              ? <img src={plan.coverImageUrl} className="w-full h-full object-cover" alt="" />
                              : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.title}</p>
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
                {saveShowNewTrip ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={saveNewTripName}
                      onChange={e => setSaveNewTripName(e.target.value)}
                      placeholder="Trip name…"
                      className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                      onKeyDown={async e => {
                        if (e.key === 'Escape') { setSaveShowNewTrip(false); setSaveNewTripName(''); }
                        if (e.key === 'Enter' && saveNewTripName.trim()) {
                          setSaveCreatingTrip(true);
                          const newPlan = await createPlan(currentUserId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                          if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                          setSaveCreatingTrip(false);
                        }
                      }}
                    />
                    <button
                      disabled={!saveNewTripName.trim() || saveCreatingTrip}
                      onClick={async () => {
                        if (!saveNewTripName.trim()) return;
                        setSaveCreatingTrip(true);
                        const newPlan = await createPlan(currentUserId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                        setSaveCreatingTrip(false);
                      }}
                      className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                    >
                      {saveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                    New trip
                  </button>
                )}
              </div>

              {/* Remove from Saved */}
              <div className="mx-4 border-t border-gray-100 mt-1" />
              <div className="px-4 pt-2 pb-2">
                <button
                  onClick={async () => {
                    const prevSaved = new Set(allSavedIds);
                    setAllSavedIds(prev => { const n = new Set(prev); post.places.forEach(p => n.delete(p.id)); return n; });
                    for (const p of post.places) {
                      const ok = await unsavePlace(currentUserId, p.id);
                      if (!ok) { setAllSavedIds(prevSaved); return; }
                    }
                    setShowSaveAllPicker(false);
                    setSavePlanAdded(new Set());
                    setSaveShowNewTrip(false);
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
        );
      })()}

      {/* Save-place-to-collection picker */}
      {savingPlace && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSavingPlace(null); setShowInlineNewCol(false); setInlineNewColName(''); setSavePlanAdded(new Set()); setSaveShowNewTrip(false); setSaveNewTripName(''); }} />
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
              <button
                onClick={() => { setNewColSheetContext('singlePlace'); setShowNewColSheet(true); }}
                className="w-full flex items-center gap-2 text-sm font-semibold text-gray-500 py-2"
              >
                <Plus size={16} strokeWidth={2} className="text-gray-400" /> New collection
              </button>
            </div>

            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {savePlans.length === 0 && !saveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {savePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {savePlans.map(plan => {
                    const added = savePlanAdded.has(plan.id);
                    const adding = savePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!savingPlace) return;
                          setSavePlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              await createPlanItem(plan.id, day.id, {
                                name: savingPlace.name,
                                category: '',
                                image_url: '',
                                time_label: '',
                                address: '',
                                neighborhood: '',
                                position: day.items.length,
                                lat: null,
                                lng: null,
                              });
                              setSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setSavePlanAdding(null);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                          {plan.coverImageUrl
                            ? <img src={plan.coverImageUrl} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.title}</p>
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
              {saveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={saveNewTripName}
                    onChange={e => setSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setSaveShowNewTrip(false); setSaveNewTripName(''); }
                      if (e.key === 'Enter' && saveNewTripName.trim()) {
                        setSaveCreatingTrip(true);
                        const newPlan = await createPlan(currentUserId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                        setSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!saveNewTripName.trim() || saveCreatingTrip}
                    onClick={async () => {
                      if (!saveNewTripName.trim()) return;
                      setSaveCreatingTrip(true);
                      const newPlan = await createPlan(currentUserId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                      setSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {saveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>

            {/* Remove from Saved */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!savingPlace) return;
                  setAllSavedIds(prev => { const n = new Set(prev); n.delete(savingPlace.id); return n; });
                  await unsavePlace(currentUserId, savingPlace.id);
                  setSavingPlace(null);
                  setSavePlanAdded(new Set());
                  setSaveShowNewTrip(false);
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

      {/* New Collection full modal sheet */}
      {showNewColSheet && (
        <div className="fixed inset-0 z-[420] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNewColSheet(false); setNewColSheetName(''); setNewColSheetDesc(''); setNewColSheetCoverUrl(null); }} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                disabled={!newColSheetName.trim() || newColSheetSaving || newColSheetCoverUploading}
                onClick={async () => {
                  if (!newColSheetName.trim()) return;
                  setNewColSheetSaving(true);
                  try {
                    const { data, error } = await createCollection(currentUserId, { name: newColSheetName.trim(), emoji: '', description: newColSheetDesc.trim(), cover_image_url: newColSheetCoverUrl });
                    if (!error && data) {
                      if (newColSheetContext === 'singlePlace' && savingPlace) {
                        await addPlaceToCollection(data.id, savingPlace.id);
                        setPlaceInMyCollections(prev => new Set(prev).add(data.id));
                        setMyCollections(prev => [{ ...data, placesCount: 1 }, ...prev]);
                      } else if (newColSheetContext === 'saveAll') {
                        // saveAll adds to myCollections — places are saved by the user picking the collection
                        setMyCollections(prev => [{ ...data, placesCount: 0 }, ...prev]);
                      } else {
                        setMyCollections(prev => [{ ...data, placesCount: 0 }, ...prev]);
                      }
                    }
                  } finally {
                    setNewColSheetSaving(false);
                    setShowNewColSheet(false);
                    setNewColSheetName('');
                    setNewColSheetDesc('');
                    setNewColSheetCoverUrl(null);
                  }
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >
                {newColSheetSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
            <div className="px-4 space-y-3 pb-6">
              <label className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden block">
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setNewColSheetCoverUploading(true);
                  const path = `collections/${currentUserId}/${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
                  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                  if (!error) setNewColSheetCoverUrl(getPublicUrl('avatars', path));
                  setNewColSheetCoverUploading(false);
                  e.target.value = '';
                }} />
                {newColSheetCoverUrl
                  ? <img src={newColSheetCoverUrl} className="w-full h-full object-cover" />
                  : newColSheetCoverUploading
                    ? <Loader2 size={20} className="text-gray-400 animate-spin" />
                    : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Add cover photo</span></div>
                }
                {newColSheetCoverUrl && !newColSheetCoverUploading && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              <input autoFocus value={newColSheetName} onChange={e => setNewColSheetName(e.target.value)} placeholder="Collection name" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              <input value={newColSheetDesc} onChange={e => setNewColSheetDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
            </div>
          </div>
        </div>
      )}
      {/* Guides tab */}
      {activeTab === 'Guides' && (
        <div className="px-4 pt-4 pb-10">
          {userGuides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <span className="text-4xl mb-3">📖</span>
              <p className="text-slate-800 font-semibold text-base mb-1">No guides yet</p>
              <p className="text-slate-400 text-sm text-center">This user hasn't published any guides</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {userGuides.map(guide => (
                <button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide)}
                  className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform aspect-square bg-gray-200"
                >
                  {guide.coverUrl
                    ? <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center text-4xl">📖</div>
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <button
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center active:scale-90 transition-transform z-10"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!currentUserId) return;
                      setUpGuideColLoading(true);
                      if (!upSubscribedGuideIds.has(guide.id)) {
                        subscribeToGuide(currentUserId, guide.id);
                        setUpSubscribedGuideIds(prev => new Set(prev).add(guide.id));
                      }
                      const ids = await getGuideCollectionIds(guide.id, currentUserId);
                      setUpGuideColIds(ids);
                      setUpGuideColSheet(guide);
                      setUpGuideColLoading(false);
                    }}
                  >
                    {upGuideColLoading && upGuideColSheet?.id === guide.id
                      ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-white" />
                      : upSubscribedGuideIds.has(guide.id)
                        ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                        : <Bookmark size={14} strokeWidth={1.5} className="text-white" />}
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 inline-block mb-1.5">{guide.format === 'itinerary' ? 'Itinerary' : 'Guide'}</span>
                    <div className="flex items-end justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white leading-tight">{guide.title}</p>
                        <p className="text-[10px] text-white/60 mt-0.5">
                          {[guide.destination, `${guide.places?.length ?? 0} places`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="flex-shrink-0 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full border border-white/20">Read →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedGuide && (
        <GuideDetail
          guide={selectedGuide}
          currentUserId={currentUserId}
          onClose={() => setSelectedGuide(null)}
          onPlaceClick={() => {}}
        />
      )}

      {/* ── Follow error toast ── */}
      {followErrorToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          Something went wrong. Please try again.
        </div>
      )}

      {/* ── Avatar zoom lightbox ── */}
      {showAvatarZoom && profile?.avatarUrl && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowAvatarZoom(false)}>
          <img src={profile.avatarUrl} alt={profile.name} className="w-64 h-64 rounded-full object-cover object-top shadow-2xl" style={{ boxShadow: '0 0 0 4px rgba(255,255,255,0.2)' }} />
        </div>
      )}

      {/* ── User options menu ── */}
      {showUserMenu && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUserMenu(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-2 pt-1 space-y-1">
              <button onClick={() => { setShowUserMenu(false); setShowReportSheet(true); }}
                className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left">
                <Flag size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-900">Report</span>
                <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto flex-shrink-0" />
              </button>
              <button onClick={() => {
                setShowUserMenu(false);
                setUpActionModal({
                  avatarUrl: profile?.avatarUrl,
                  title: isBlockedByMe ? `Unblock @${profile?.username}?` : `Block @${profile?.username}?`,
                  subtitle: isBlockedByMe
                    ? 'They will be able to see your posts and find your profile again.'
                    : "They won't be able to see your posts or find your profile.",
                  confirmLabel: isBlockedByMe ? 'Unblock' : 'Block',
                  confirmVariant: isBlockedByMe ? 'dark' : 'red',
                  onConfirm: async () => {
                    if (isBlockedByMe) {
                      await unblockUser(currentUserId, userId);
                      setIsBlockedByMe(false);
                    } else {
                      await blockUser(currentUserId, userId);
                      setIsBlockedByMe(true);
                    }
                    setUpActionModal(null);
                  },
                });
              }} className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left">
                <UserX size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-900">
                  {isBlockedByMe ? 'Unblock' : 'Block'} @{profile?.username}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report sheet ── */}
      {showReportSheet && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '390px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowReportSheet(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 pt-3 pb-3 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">Report</p>
              <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
            </div>
            <div className="py-1">
              {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(reason => (
                <button key={reason} onClick={async () => {
                  await reportContent(currentUserId, { userId, reason });
                  setShowReportSheet(false);
                  setUpActionModal({
                    iconType: 'check',
                    title: 'Report submitted',
                    subtitle: "Thank you. We'll review this and take action if it violates our guidelines.",
                  });
                }} className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 text-left">
                  <span className="text-sm text-gray-900">{reason}</span>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {upActionModal && (
        <ActionModal
          avatarUrl={upActionModal.avatarUrl}
          iconType={upActionModal.iconType}
          title={upActionModal.title}
          subtitle={upActionModal.subtitle}
          confirmLabel={upActionModal.confirmLabel}
          confirmVariant={upActionModal.confirmVariant}
          onConfirm={upActionModal.onConfirm}
          onCancel={() => setUpActionModal(null)}
        />
      )}

      {/* Guide → Save to Collection sheet */}
      {upGuideColSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }} onClick={() => { setUpGuideColSheet(null); setUpGuideColIds(new Set()); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
              {myCollections.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No collections yet — create one below</p>
              )}
              {myCollections.map(col => {
                const inCol = upGuideColIds.has(col.id);
                return (
                  <button key={col.id} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                    onClick={async () => {
                      if (!currentUserId) return;
                      if (inCol) {
                        setUpGuideColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        await removeGuideFromCollection(col.id, upGuideColSheet.id);
                        const remaining = new Set(upGuideColIds); remaining.delete(col.id);
                        if (remaining.size === 0) { unsubscribeFromGuide(currentUserId, upGuideColSheet.id); setUpSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(upGuideColSheet.id); return n; }); }
                      } else {
                        setUpGuideColIds(prev => new Set(prev).add(col.id));
                        await addGuideToCollection(col.id, upGuideColSheet.id, currentUserId);
                        if (!upSubscribedGuideIds.has(upGuideColSheet.id)) {
                          subscribeToGuide(currentUserId, upGuideColSheet.id);
                          setUpSubscribedGuideIds(prev => new Set(prev).add(upGuideColSheet.id));
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
              <button onClick={() => setShowNewColSheet(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>
            <div className="mx-4 border-t border-gray-100" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!currentUserId || !upGuideColSheet) return;
                  unsubscribeFromGuide(currentUserId, upGuideColSheet.id);
                  setUpSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(upGuideColSheet.id); return n; });
                  setUpGuideColSheet(null);
                  setUpGuideColIds(new Set());
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
  );
}
