// @refresh reset
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import SondrrLogo from '../components/SondrLogo';
import { Heart, MessageCircle, Send, MapPin, ArrowLeft, Bookmark, BookmarkCheck, Map, X, Mail, Check, Copy, Users, Plus, Search, Loader2, MoreHorizontal, Flag, UserX, Trash2, Edit3, ChevronRight } from 'lucide-react';
import type { Tab } from '../types/index';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import type { AppUser } from '../types';
import ImageCarousel from '../components/ImageCarousel';
import PlacePage from '../components/PlacePage';
import ErrorBoundary from '../components/ErrorBoundary';
import { supabase, getPublicUrl, getFeedPosts, getDiscoveryPosts, getDiscoveryGuides, getFollowCount, getLikedPosts, likePost, unlikePost, getPostLikeCounts, getPostCommentCounts, getUserCollections, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, getOrCreateConversation, getConversations, sendMessage, getMessages, markConversationRead, deleteConversation, geocodeMissingPlaces, getPostComments, addComment, deleteComment, savePlace, unsavePlace, getSavedPlaceIds, searchProfiles, getFollowingProfiles, createCollection, getGuides, likeGuide, unlikeGuide, getGuideLikeCounts, getUserLikedGuides, addGuideComment, getGuideComments, getGuideCommentCounts, subscribeToGuide, unsubscribeFromGuide, getSubscribedGuideIds, blockUser, unblockUser, getBlockedUsers, getBlockersOfUser, reportContent, deletePost, deleteGuide, addGuideToCollection, removeGuideFromCollection, getGuideCollectionIds, getPlans, createPlan, createPlanDay, createPlanItem, type RealPost, type RealPostPlace, type RealCollection, type Conversation, type Message, type PostComment, type FollowProfile, type Guide, type GuideComment, type Plan } from '../lib/supabase';
import GuideDetail from '../components/GuideDetail';
import CreateGuideSheet from '../components/CreateGuideSheet';
import ActionModal from '../components/ActionModal';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

const MapView = lazy(() => import('../components/MapView'));

interface Props {
  showMessages?: boolean;
  messagesTargetUserId?: string;
  onMessagesClose?: () => void;
  isNewUser?: boolean;
  appUser?: AppUser;
  onNavigate?: (tab: Tab) => void;
  onConversationChange?: (inConversation: boolean) => void;
}

export default function Home({ showMessages = false, messagesTargetUserId, onMessagesClose, isNewUser, appUser, onNavigate, onConversationChange }: Props) {
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showInbox, setShowInbox] = useState(showMessages);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationUser, setActiveConversationUser] = useState<{ id: string; name: string; username: string; avatarUrl: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPlacePage, setSelectedPlacePage] = useState<RealPostPlace | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [feedRetry, setFeedRetry] = useState(0);
  const [realPosts, setRealPosts] = useState<RealPost[]>([]);
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [likedRealPosts, setLikedRealPosts] = useState<Set<string>>(new Set());
  const [realPostLikeCounts, setRealPostLikeCounts] = useState<Record<string, number>>({});
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [commentCountsMap, setCommentCountsMap] = useState<Record<string, number>>({});
  const [userCollections, setUserCollections] = useState<RealCollection[]>([]);
  const [expandedPlacesPostId, setExpandedPlacesPostId] = useState<string | null>(null);
  const [addToColPlace, setAddToColPlace] = useState<{ id: string; name: string } | null>(null);
  const [placeInCollections, setPlaceInCollections] = useState<Set<string>>(new Set());
  const [loadingPlaceCollections, setLoadingPlaceCollections] = useState(false);
  const [showCommentsPostId, setShowCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, PostComment[]>>({});
  const [loadingCommentsPostId, setLoadingCommentsPostId] = useState<string | null>(null);
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null); // per-post submit guard
  const [homeCommentText, setHomeCommentText] = useState('');
  const [guideLikes, setGuideLikes] = useState<Record<string, number>>({});
  const [likedGuides, setLikedGuides] = useState<Set<string>>(new Set());
  const [likingGuideIds, setLikingGuideIds] = useState<Set<string>>(new Set());
  const [guideCommentCounts, setGuideCommentCounts] = useState<Record<string, number>>({});
  const [showGuideCommentsId, setShowGuideCommentsId] = useState<string | null>(null);
  const [guideCommentsMap, setGuideCommentsMap] = useState<Record<string, GuideComment[]>>({});
  const [loadingGuideCommentsId, setLoadingGuideCommentsId] = useState<string | null>(null);
  const [guideCommentText, setGuideCommentText] = useState('');
  const [submittingGuideComment, setSubmittingGuideComment] = useState(false);
  const [showShareGuideId, setShowShareGuideId] = useState<string | null>(null);
  const [subscribedGuideIds, setSubscribedGuideIds] = useState<Set<string>>(new Set());
  const [subscribingGuideIds, setSubscribingGuideIds] = useState<Set<string>>(new Set());
  const [guideColSheet, setGuideColSheet] = useState<Guide | null>(null);
  const [guideColIds, setGuideColIds] = useState<Set<string>>(new Set());
  const [guideColLoading, setGuideColLoading] = useState(false);
  const [postSavePlans, setPostSavePlans] = useState<Plan[]>([]);
  const [postSavePlanAdded, setPostSavePlanAdded] = useState<Set<string>>(new Set());
  const [postSavePlanAdding, setPostSavePlanAdding] = useState<string | null>(null);
  const [postSaveShowNewTrip, setPostSaveShowNewTrip] = useState(false);
  const [postSaveNewTripName, setPostSaveNewTripName] = useState('');
  const [postSaveCreatingTrip, setPostSaveCreatingTrip] = useState(false);
  const [showPostSaveSheet, setShowPostSaveSheet] = useState<{ postId: string; placeIds: string[] } | null>(null);
  const [postSaveSheetColIds, setPostSaveSheetColIds] = useState<Set<string>>(new Set());
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [savingNewCol, setSavingNewCol] = useState(false);
  const [activeSheetContext, setActiveSheetContext] = useState<'post' | 'place' | null>(null);
  const [showNewColSheet, setShowNewColSheet] = useState(false);
  const [newColSheetName, setNewColSheetName] = useState('');
  const [newColSheetDesc, setNewColSheetDesc] = useState('');
  const [newColSheetCoverUrl, setNewColSheetCoverUrl] = useState<string | null>(null);
  const [newColSheetCoverUploading, setNewColSheetCoverUploading] = useState(false);
  const [newColSheetSaving, setNewColSheetSaving] = useState(false);
  const [showSharePostId, setShowSharePostId] = useState<string | null>(null);
  const [sharePostSentTo, setSharePostSentTo] = useState<Set<string>>(new Set());
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareSearchResults, setShareSearchResults] = useState<FollowProfile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);
  const [homeShareLinkCopied, setHomeShareLinkCopied] = useState(false);
  const [sendingShareTo, setSendingShareTo] = useState<string | null>(null);
  const [guideShareSentTo, setGuideShareSentTo] = useState<Set<string>>(new Set());
  const shareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allSavedPlaceIds, setAllSavedPlaceIds] = useState<Set<string>>(new Set());
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});
  const [feedGuides, setFeedGuides] = useState<Guide[]>([]);
  const [isDiscoveryFeed, setIsDiscoveryFeed] = useState(false);
  const [isNewUserFlow, setIsNewUserFlow] = useState(false);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{
    avatarUrl?: string | null; iconType?: 'check'; title: string; subtitle: string;
    confirmLabel?: string; confirmVariant?: 'red' | 'dark'; onConfirm?: () => void;
  } | null>(null);
  // Content options sheet (··· menu)
  const [contentOptions, setContentOptions] = useState<{ type: 'post' | 'guide'; id: string; authorId: string; username: string; avatarUrl?: string | null; isOwn: boolean } | null>(null);
  const [reportStep, setReportStep] = useState<'options' | 'reason' | 'done' | 'blockConfirm' | 'deleteConfirm'>('options');
  const [reportReason, setReportReason] = useState('');
  const [optionsToast, setOptionsToast] = useState<string | null>(null);
  const [inboxSearch, setInboxSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatResults, setNewChatResults] = useState<FollowProfile[]>([]);
  const [searchingNewChat, setSearchingNewChat] = useState(false);
  const [followingSuggestions, setFollowingSuggestions] = useState<FollowProfile[]>([]);
  const [newChatSelected, setNewChatSelected] = useState<FollowProfile[]>([]);
  const [startingChat, setStartingChat] = useState(false);
  const [convToDelete, setConvToDelete] = useState<string | null>(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [chatProfileUserId, setChatProfileUserId] = useState<string | null>(null);
  const [showChatReport, setShowChatReport] = useState(false);
  const [swipedConvId, setSwipedConvId] = useState<string | null>(null);
  const [favoriteConvIds, setFavoriteConvIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sondrr_fav_convs') ?? '[]')); }
    catch { return new Set(); }
  });
  const swipeTouchRef = useRef<{ x: number; id: string } | null>(null);
  const newChatSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_fetchVersion, _setFetchVersion] = useState(0); // reserved for stale feed overwrite prevention
  const shareLinkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentSubmitRef = useRef(false);

  // Fetch guides for feed + realtime subscription (FIX 25)
  useEffect(() => {
    if (!appUser?.id) return;
    let isMounted = true;
    const uid = appUser.id;
    getGuides(uid).then(guides => {
      if (!isMounted) return;
      setFeedGuides(guides);
    }).catch(() => {});

    const channel = supabase
      .channel(`feed-guides-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guides' }, () => {
        if (!isMounted) return;
        getGuides(uid).then(guides => { if (isMounted) setFeedGuides(guides); }).catch(() => {});
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [appUser?.id]);

  // FIX 11 — fetch guide like counts whenever feedGuides changes
  useEffect(() => {
    if (!appUser?.id || feedGuides.length === 0) return;
    const guideIds = feedGuides.map(g => g.id);
    Promise.all([
      getGuideLikeCounts(guideIds),
      getUserLikedGuides(appUser.id),
      getGuideCommentCounts(guideIds),
      getSubscribedGuideIds(appUser.id),
    ]).then(([likes, liked, commentCounts, subIds]) => {
      setGuideLikes(likes);
      setLikedGuides(liked);
      setGuideCommentCounts(commentCounts);
      setSubscribedGuideIds(subIds);
    }).catch(() => {});
  }, [feedGuides.length, appUser?.id]);

  // Discovery feed: load when personal feed is empty OR when user is new (< 20 follows)
  useEffect(() => {
    if (!appUser?.id || loadingFeed) return;
    const hasFeed = realPosts.length > 0 || feedGuides.length > 0;
    // Established user with content — clear discovery mode if needed and stop
    if (hasFeed && !isNewUserFlow) {
      if (isDiscoveryFeed) setIsDiscoveryFeed(false);
      return;
    }
    // Discovery already loaded — don't reload
    if (isDiscoveryFeed) return;
    const uid = appUser.id;
    let isMounted = true;
    setLoadingDiscovery(true);
    Promise.all([getDiscoveryPosts(uid), getDiscoveryGuides(uid)]).then(([posts, guides]) => {
      if (!isMounted) return;
      if (posts.length > 0 || guides.length > 0) {
        if (!hasFeed) {
          // Empty personal feed — replace with discovery
          setRealPosts(posts);
          setFeedGuides(guides);
        } else {
          // New user with sparse personal feed — merge discovery (no duplicates)
          setRealPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...posts.filter(p => !existingIds.has(p.id))];
          });
          setFeedGuides(prev => {
            const existingIds = new Set(prev.map(g => g.id));
            return [...prev, ...guides.filter(g => !existingIds.has(g.id))];
          });
        }
        setIsDiscoveryFeed(true);
        const postIds = posts.map(p => p.id);
        if (postIds.length > 0) {
          getPostLikeCounts(postIds).then(counts => { if (isMounted) setRealPostLikeCounts(prev => ({ ...prev, ...counts })); });
          getPostCommentCounts(postIds).then(counts => { if (isMounted) setCommentCountsMap(prev => ({ ...prev, ...counts })); });
        }
        const guideIds = guides.map(g => g.id);
        if (guideIds.length > 0) {
          Promise.all([getGuideLikeCounts(guideIds), getUserLikedGuides(uid)]).then(([counts, liked]) => {
            if (isMounted) {
              setGuideLikes(prev => ({ ...prev, ...counts }));
              setLikedGuides(prev => new Set([...prev, ...liked]));
            }
          });
        }
      }
    }).catch(() => {}).finally(() => { if (isMounted) setLoadingDiscovery(false); });
    return () => { isMounted = false; };
  }, [appUser?.id, loadingFeed, realPosts.length, feedGuides.length, isNewUserFlow, isDiscoveryFeed]);

  // Fetch real posts from Supabase on mount + re-fetch when any post is inserted or updated
  // FIX 1: isMounted guard + per-fetch version to prevent stale overwrites
  useEffect(() => {
    if (!appUser?.id) return;
    let isMounted = true;
    const uid = appUser.id;

    const fetchFeed = async (isInitial = false) => {
      if (isInitial) { setLoadingFeed(true); setFeedError(false); }
      try {
        const posts = await getFeedPosts(uid);
        if (!isMounted) return; // component unmounted — discard
        setRealPosts(posts);
        // FIX 28: prune carouselIndex to only keep entries for current post IDs
        const postIdSet = new Set(posts.map(p => p.id));
        setCarouselIndex(prev => {
          const next: typeof prev = {};
          for (const id of Object.keys(prev)) {
            if (postIdSet.has(id)) next[id] = prev[id];
          }
          return next;
        });
        // BUG-17: clear stale comment panel if post no longer exists
        setShowCommentsPostId(prev => {
          if (prev && !posts.find(p => p.id === prev)) return null;
          return prev;
        });
        if (isInitial) {
          getFollowCount(uid)
            .then(count => { if (isMounted) setIsNewUserFlow(count < 20); })
            .catch(() => { if (isMounted) setIsNewUserFlow(true); }); // default to onboarding if call fails
        }
        if (posts.length > 0) {
          const postIds = posts.map(p => p.id);
          // Fire count fetches but guard on isMounted before setting state
          getPostLikeCounts(postIds).then(counts => { if (isMounted) setRealPostLikeCounts(counts); });
          // BUG-16: fetch comment counts on mount
          getPostCommentCounts(postIds).then(counts => {
            if (isMounted) {
              setCommentCountsMap(counts);
              // FIX 16: clear stale commentsMap entries for posts that no longer exist
              setCommentsMap(prev => {
                const next: typeof prev = {};
                for (const id of postIds) { if (prev[id]) next[id] = prev[id]; }
                return next;
              });
            }
          });
          // Geocode any places missing coordinates, then update state immediately
          const allPlaces = posts.flatMap(p => p.places);
          const missing = allPlaces.filter(pl => pl.lat == null || pl.lng == null);
          if (missing.length > 0) {
            const geocoded = await geocodeMissingPlaces(allPlaces, GOOGLE_PLACES_KEY);
            if (!isMounted) return; // discard stale geocoding
            const coordMap: Record<string, { lat: number; lng: number }> = {};
            geocoded.forEach(pl => { if (pl.lat != null) coordMap[pl.id] = { lat: pl.lat!, lng: pl.lng! }; });
            if (Object.keys(coordMap).length > 0) {
              setRealPosts(prev => prev.map(post => ({
                ...post,
                places: post.places.map(pl => coordMap[pl.id] ? { ...pl, ...coordMap[pl.id] } : pl),
              })));
            }
          }
        }
      } catch {
        if (isInitial && isMounted) setFeedError(true);
      } finally {
        if (isInitial && isMounted) setLoadingFeed(false);
      }
    };

    fetchFeed(true);

    const channel = supabase
      .channel(`feed-post-updates-${uid}`) // unique per user to avoid conflicts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        if (isMounted) fetchFeed(false);
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [appUser?.id, feedRetry]);

  useEffect(() => {
    if (!appUser?.id) return;
    getLikedPosts(appUser.id).then(setLikedRealPosts);
    getUserCollections(appUser.id).then(setUserCollections);
    getSavedPlaceIds(appUser.id).then(setAllSavedPlaceIds);
    // Load conversations proactively for the share sheet
    getConversations(appUser.id).then(setConversations);
    Promise.all([getBlockedUsers(appUser.id), getBlockersOfUser(appUser.id)])
      .then(([blocked, blockers]) => setBlockedUserIds(new Set([...blocked, ...blockers])));
  }, [appUser?.id]);

  // Load conversations when inbox opens
  useEffect(() => {
    if (!showInbox || !appUser?.id) return;
    let isMounted = true;
    setLoadingConversations(true);
    getConversations(appUser.id)
      .then(convs => { if (isMounted) setConversations(convs); })
      .catch(() => {})
      .finally(() => { if (isMounted) setLoadingConversations(false); });
    return () => { isMounted = false; };
  }, [showInbox, appUser?.id]);

  // Auto-open conversation with a specific user when messagesTargetUserId is set
  // FIX 6: isMounted guard to prevent auto-open after close
  useEffect(() => {
    if (!messagesTargetUserId || !appUser?.id) return;
    let isMounted = true;
    setShowInbox(true);
    getOrCreateConversation(appUser.id, messagesTargetUserId).then(async convId => {
      if (!convId || !isMounted) return;
      // Get other user profile
      const { data: prof } = await supabase.from('profiles').select('id, name, username, avatar_url').eq('id', messagesTargetUserId).single();
      if (!isMounted) return;
      setActiveConversationUser(prof ? { id: prof.id, name: prof.name ?? '', username: prof.username ?? '', avatarUrl: prof.avatar_url ?? null } : null);
      setActiveConversationId(convId);
    });
    return () => { isMounted = false; };
  }, [messagesTargetUserId, appUser?.id]);

  // Load messages + real-time subscription when a conversation is opened
  // FIX 4: add appUser?.id to deps; FIX 5: isMounted guard
  useEffect(() => {
    if (!activeConversationId) return;
    let isMounted = true;
    setLoadingMessages(true);
    getMessages(activeConversationId).then(msgs => {
      if (!isMounted) return;
      setMessages(msgs);
      setLoadingMessages(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` }, (payload) => {
        const m = payload.new as any;
        if (m.sender_id !== appUser?.id) {
          if (isMounted) {
            setMessages(prev => [...prev, { id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, text: m.text, createdAt: m.created_at }]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        }
      })
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, appUser?.id]);

  // Notify parent when entering/leaving a conversation (hides bottom nav)
  useEffect(() => {
    onConversationChange?.(showInbox && !!activeConversationId);
  }, [showInbox, activeConversationId, onConversationChange]);

  // BUG-12: Clear comment text when switching posts
  useEffect(() => { setHomeCommentText(''); }, [showCommentsPostId]);

  // BUG-26: Clear share search timeout on unmount; FIX 8: swipeTouchRef cleanup; FIX 22: shareLinkCopiedTimerRef cleanup
  useEffect(() => {
    return () => {
      if (shareSearchRef.current) clearTimeout(shareSearchRef.current);
      if (newChatSearchRef.current) clearTimeout(newChatSearchRef.current);
      swipeTouchRef.current = null; // clear touch state on unmount
      if (shareLinkCopiedTimerRef.current) clearTimeout(shareLinkCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showMessages) setShowInbox(true);
  }, [showMessages]);

  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async () => {
    if (!activeConversationId || !messageText.trim() || !appUser?.id || sendingMessage) return;
    const text = messageText.trim();
    setMessageText('');
    setSendingMessage(true);
    try {
      const sent = await sendMessage(activeConversationId, appUser.id, text);
      if (sent) {
        setMessages(prev => [...prev, sent]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, lastMessage: { text, senderId: appUser.id, createdAt: sent.createdAt }, unread: false } : c));
      } else {
        setMessageText(text); // restore on failure
      }
    } catch {
      setMessageText(text); // restore on failure
    } finally {
      setSendingMessage(false);
    }
  };

  // ── Chat View ────────────────────────────────────────────────────
  if (showInbox && activeConversationId) {
    const chatUser = activeConversationUser;
    const initials = (chatUser?.name ?? '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

    const formatMsgTime = (iso: string) => {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const isThisWeek = now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
      if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (isThisWeek) return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ maxWidth: 384, margin: '0 auto' }}>
        {/* Fixed header */}
        <div className="flex-shrink-0 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => { setActiveConversationId(null); setActiveConversationUser(null); setMessages([]); onConversationChange?.(false); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <button onClick={() => chatUser && setViewingUserId(chatUser.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            {chatUser?.avatarUrl
              ? <img src={chatUser.avatarUrl} alt={chatUser.name} className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{initials || '?'}</div>}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{chatUser?.name}</p>
              <p className="text-xs text-gray-400">@{chatUser?.username}</p>
            </div>
          </button>
          <button onClick={() => { setShowChatOptions(true); setShowChatReport(false); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
            <MoreHorizontal size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>

        {/* Scrollable messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {loadingMessages && <p className="text-center text-xs text-gray-400 py-8">Loading…</p>}
          {!loadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                {chatUser?.avatarUrl
                  ? <img src={chatUser.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  : <span className="text-lg font-bold text-gray-400">{initials || '?'}</span>}
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{chatUser?.name}</p>
              <p className="text-xs text-gray-400">@{chatUser?.username}</p>
              <p className="text-xs text-gray-400 mt-3">Say hello!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMine = msg.senderId === appUser?.id;
            const prev = messages[idx - 1];
            const next = messages[idx + 1];
            const showTime = !next || new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000;
            const isFirstInGroup = !prev || prev.senderId !== msg.senderId || new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
            const isLastInGroup = !next || next.senderId !== msg.senderId || new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000;
            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
                <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 flex-shrink-0">
                    {!isMine && isLastInGroup && (
                      chatUser?.avatarUrl
                        ? <img src={chatUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">{initials || '?'}</div>
                    )}
                  </div>
                  <div className={`max-w-[72%] px-4 py-2.5 text-sm leading-snug ${
                    isMine
                      ? `bg-gray-900 text-white ${isFirstInGroup ? 'rounded-tl-2xl rounded-tr-2xl' : 'rounded-tl-2xl'} ${isLastInGroup ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-bl-2xl rounded-br-2xl'}`
                      : `bg-gray-100 text-gray-900 ${isFirstInGroup ? 'rounded-tl-2xl rounded-tr-2xl' : 'rounded-tr-2xl'} ${isLastInGroup ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-br-2xl rounded-bl-2xl'}`
                  }`}>
                    {msg.text}
                  </div>
                </div>
                {showTime && (
                  <p className={`text-[10px] text-gray-400 mt-1 ${isMine ? 'pr-9' : 'pl-9'}`}>
                    {formatMsgTime(msg.createdAt)}
                    {isMine && <span className="ml-1 text-gray-300">✓</span>}
                  </p>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Fixed input bar */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-2">
          <input
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            placeholder="Message…"
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-gray-400"
            autoFocus={!('ontouchstart' in window)}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sendingMessage}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${messageText.trim() && !sendingMessage ? 'bg-gray-900' : 'bg-gray-200'}`}
          >
            {sendingMessage
              ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send size={15} strokeWidth={1.5} className={messageText.trim() ? 'text-white' : 'text-gray-400'} />}
          </button>
        </div>

        {/* Chat options sheet */}
        {showChatOptions && !showChatReport && (
          <div className="absolute inset-0 z-[100] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowChatOptions(false)} />
            <div className="relative bg-white rounded-t-3xl pb-10">
              <div className="flex justify-center pt-3 pb-4"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
              <div className="px-2 space-y-1">
                <button onClick={() => setShowChatReport(true)}
                  className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left">
                  <Flag size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900">Report</span>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto flex-shrink-0" />
                </button>
                <button onClick={() => {
                  setShowChatOptions(false);
                  if (!chatUser) return;
                  const alreadyBlocked = blockedUserIds.has(chatUser.id);
                  setActionModal({
                    avatarUrl: chatUser.avatarUrl,
                    title: alreadyBlocked ? `Unblock @${chatUser.username}?` : `Block @${chatUser.username}?`,
                    subtitle: alreadyBlocked
                      ? 'They will be able to see your profile and message you again.'
                      : "They won't be able to see your profile or send you messages.",
                    confirmLabel: alreadyBlocked ? 'Unblock' : 'Block',
                    confirmVariant: alreadyBlocked ? 'dark' : 'red',
                    onConfirm: async () => {
                      if (!appUser?.id || !chatUser?.id) return;
                      if (alreadyBlocked) {
                        await unblockUser(appUser.id, chatUser.id);
                        setBlockedUserIds(prev => { const s = new Set(prev); s.delete(chatUser.id); return s; });
                      } else {
                        await blockUser(appUser.id, chatUser.id);
                        setBlockedUserIds(prev => new Set([...prev, chatUser.id]));
                        setActiveConversationId(null); setActiveConversationUser(null); setMessages([]);
                        onConversationChange?.(false);
                      }
                      setActionModal(null);
                    },
                  });
                }} className="w-full flex items-center gap-3 py-4 px-5 rounded-xl active:bg-gray-50 text-left">
                  <UserX size={18} strokeWidth={1.5} className="text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900">{chatUser && blockedUserIds.has(chatUser.id) ? 'Unblock' : 'Block'} @{chatUser?.username}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat report reason picker */}
        {showChatOptions && showChatReport && (
          <div className="absolute inset-0 z-[100] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowChatOptions(false); setShowChatReport(false); }} />
            <div className="relative bg-white rounded-t-3xl pb-10">
              <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
              <div className="px-5 pt-3 pb-3 border-b border-gray-100">
                <p className="text-base font-bold text-gray-900">Report</p>
                <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
              </div>
              <div className="py-1">
                {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(reason => (
                  <button key={reason} onClick={async () => {
                    if (!appUser?.id || !chatUser?.id) return;
                    await reportContent(appUser.id, { userId: chatUser.id, reason });
                    setShowChatOptions(false);
                    setShowChatReport(false);
                    setActionModal({
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

        {/* View profile from chat — rendered inside the fixed overlay */}
        {chatProfileUserId && appUser && (
          <div className="absolute inset-0 z-[200] bg-white overflow-y-auto">
            <UserProfile
              userId={chatProfileUserId}
              currentUserId={appUser.id}
              onBack={() => setChatProfileUserId(null)}
              onFollowChange={() => {}}
              onMessage={() => {}}
            />
          </div>
        )}

        {/* Action modal (Block/Report confirmation) — must be inside this early return */}
        {actionModal && (
          <ActionModal
            avatarUrl={actionModal.avatarUrl}
            iconType={actionModal.iconType}
            title={actionModal.title}
            subtitle={actionModal.subtitle}
            confirmLabel={actionModal.confirmLabel}
            confirmVariant={actionModal.confirmVariant}
            onConfirm={actionModal.onConfirm}
            onCancel={() => setActionModal(null)}
          />
        )}
      </div>
    );
  }

  // ── Find People ──────────────────────────────────────────────────
  if (showFindPeople) {
    return (
      <FindPeople
        currentUserId={appUser?.id ?? ''}
        onBack={() => { setShowFindPeople(false); setFeedRetry(c => c + 1); }}
        onOpenMessages={() => setShowInbox(true)}
      />
    );
  }

  // ── User Profile ─────────────────────────────────────────────────
  if (viewingUserId && appUser) {
    return <UserProfile userId={viewingUserId} currentUserId={appUser.id} onBack={() => setViewingUserId(null)} onFollowChange={() => {}} onMessage={() => setShowInbox(true)} />;
  }

  // ── Inbox View ───────────────────────────────────────────────────
  if (showInbox) {
    const formatConvTime = (iso: string) => {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
      if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (diff < 7 * 24 * 3600000) return d.toLocaleDateString([], { weekday: 'short' });
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const toggleFavorite = (convId: string) => {
      setFavoriteConvIds(prev => {
        const next = new Set(prev);
        if (next.has(convId)) next.delete(convId); else next.add(convId);
        try { localStorage.setItem('sondrr_fav_convs', JSON.stringify([...next])); } catch {}
        return next;
      });
      setSwipedConvId(null);
    };

    const handleDeleteConv = async (convId: string) => {
      try {
        await deleteConversation(convId);
        setConversations(prev => prev.filter(c => c.id !== convId));
        // FIX 7: Clean up from favorites
        setFavoriteConvIds(prev => {
          const next = new Set(prev);
          next.delete(convId);
          try { localStorage.setItem('sondrr_fav_convs', JSON.stringify([...next])); } catch {}
          return next;
        });
      } catch {
        // silent — swipedConvId reset so user can retry
      }
      setConvToDelete(null);
      setSwipedConvId(null);
    };

    const baseConvs = (inboxSearch.trim()
      ? conversations.filter(c => c.otherUser.name.toLowerCase().includes(inboxSearch.toLowerCase()) || c.otherUser.username.toLowerCase().includes(inboxSearch.toLowerCase()))
      : conversations
    ).filter(c => !blockedUserIds.has(c.otherUser.id)); // hide convs with blocked/blockers

    // Favorites pinned at top
    const filteredConvs = [
      ...baseConvs.filter(c => favoriteConvIds.has(c.id)),
      ...baseConvs.filter(c => !favoriteConvIds.has(c.id)),
    ];

    return (
      <div className="bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => { setShowInbox(false); onMessagesClose?.(); setInboxSearch(''); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
              <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
            </button>
            <h2 className="text-base font-bold text-gray-900 flex-1">Messages</h2>
            <button
              aria-label="New message"
              onClick={() => {
                setShowNewChat(true); setNewChatSearch(''); setNewChatResults([]);
                if (appUser?.id && followingSuggestions.length === 0) {
                  getFollowingProfiles(appUser.id).then(list => setFollowingSuggestions(list.slice(0, 20)));
                }
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          </div>
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
            <input
              value={inboxSearch}
              onChange={e => setInboxSearch(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400"
            />
            {inboxSearch && (
              <button onClick={() => setInboxSearch('')}>
                <X size={13} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {loadingConversations && (
          <div className="divide-y divide-gray-50">
            {[0,1,2].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-28" />
                  <div className="h-2.5 bg-gray-100 rounded w-40" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingConversations && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Send size={22} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">No messages yet</p>
            <p className="text-xs text-gray-400 leading-relaxed mb-5">Start a conversation with someone you follow.</p>
            <button
              onClick={() => { setShowNewChat(true); setNewChatSearch(''); setNewChatResults([]); }}
              className="bg-gray-900 text-white text-sm font-semibold rounded-full px-5 py-2.5"
            >
              New message
            </button>
          </div>
        )}

        {!loadingConversations && conversations.length > 0 && filteredConvs.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-10">
            {inboxSearch ? `No results for "${inboxSearch}"` : 'No conversations yet'}
          </p>
        )}

        <div className="divide-y divide-gray-50 overflow-hidden">
          {filteredConvs.map(conv => {
            const u = conv.otherUser;
            const ini = u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const isSwiped = swipedConvId === conv.id;
            const isFav = favoriteConvIds.has(conv.id);
            return (
              <div key={conv.id} className="relative overflow-hidden">
                {/* Action buttons revealed on swipe */}
                <div className="absolute right-0 top-0 bottom-0 flex">
                  <button
                    aria-label={isFav ? 'Unfavorite' : 'Favorite'}
                    onClick={() => toggleFavorite(conv.id)}
                    className="w-16 flex flex-col items-center justify-center gap-1 text-white text-[10px] font-semibold"
                    style={{ background: '#F59E0B' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? 'white' : 'none'} stroke="white" strokeWidth="1.8">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                    {isFav ? 'Unfav' : 'Fav'}
                  </button>
                  <button
                    aria-label="Delete conversation"
                    onClick={() => setConvToDelete(conv.id)}
                    className="w-16 flex flex-col items-center justify-center gap-1 bg-red-500 text-white text-[10px] font-semibold"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
                    </svg>
                    Delete
                  </button>
                </div>

                {/* Row content — slides left to reveal actions */}
                <div
                  style={{
                    transform: isSwiped ? 'translateX(-128px)' : 'translateX(0)',
                    transition: 'transform 0.22s ease',
                  }}
                  onTouchStart={e => {
                    swipeTouchRef.current = { x: e.touches[0].clientX, id: conv.id };
                    if (swipedConvId && swipedConvId !== conv.id) setSwipedConvId(null);
                  }}
                  onTouchEnd={e => {
                    if (!swipeTouchRef.current) return;
                    const diff = e.changedTouches[0].clientX - swipeTouchRef.current.x;
                    if (swipeTouchRef.current.id === conv.id) {
                      if (diff < -40) setSwipedConvId(conv.id);
                      else if (diff > 20) setSwipedConvId(null);
                    }
                    swipeTouchRef.current = null;
                  }}
                >
                  <button
                    onClick={() => {
                      if (isSwiped) { setSwipedConvId(null); return; }
                      setActiveConversationUser(u);
                      setActiveConversationId(conv.id);
                      onConversationChange?.(true);
                      // Mark as read when opening — both UI and DB
                      if (conv.unread) {
                        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c));
                        markConversationRead(conv.id, conv.isUser1 ?? true);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-white active:bg-gray-50 text-left"
                  >
                    <div className="relative flex-shrink-0">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover" />
                        : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">{ini || '?'}</div>}
                      {isFav && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${conv.unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>{u.name}</p>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatConvTime(conv.lastMessage.createdAt)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className={`text-xs truncate flex-1 ${conv.unread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                          {conv.lastMessage ? conv.lastMessage.text : 'No messages yet'}
                        </p>
                        {conv.unread && <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delete confirmation sheet */}
        {convToDelete && (
          <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setConvToDelete(null)} />
            <div className="relative bg-white rounded-t-3xl px-4 pt-5 pb-8">
              <p className="text-sm font-semibold text-gray-900 text-center mb-1">Delete conversation?</p>
              <p className="text-xs text-gray-400 text-center mb-5">This will remove the chat for both sides.</p>
              <button
                onClick={() => handleDeleteConv(convToDelete)}
                className="w-full bg-red-500 text-white text-sm font-semibold rounded-2xl py-3.5 mb-2"
              >
                Delete
              </button>
              <button
                onClick={() => setConvToDelete(null)}
                className="w-full bg-gray-100 text-gray-700 text-sm font-semibold rounded-2xl py-3.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* New Chat sheet */}
        {showNewChat && (
          <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNewChat(false); setNewChatSelected([]); setNewChatSearch(''); setNewChatResults([]); }} />
            <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
              {/* Header */}
              <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => { setShowNewChat(false); setNewChatSelected([]); setNewChatSearch(''); setNewChatResults([]); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                    <X size={14} strokeWidth={2} className="text-gray-700" />
                  </button>
                  <p className="text-sm font-bold text-gray-900 flex-1">New message</p>
                </div>
                {/* Selected chips */}
                {newChatSelected.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newChatSelected.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-slate-100 rounded-full pl-1 pr-2 py-1">
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt={u.name} className="w-5 h-5 rounded-full object-cover" />
                          : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-500">{u.name[0]}</div>}
                        <span className="text-xs font-semibold text-gray-800">{u.name}</span>
                        <button onClick={() => setNewChatSelected(prev => prev.filter(x => x.id !== u.id))} className="text-gray-400 hover:text-gray-600 leading-none">
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                  <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    value={newChatSearch}
                    onChange={e => {
                      const q = e.target.value;
                      setNewChatSearch(q);
                      if (newChatSearchRef.current) clearTimeout(newChatSearchRef.current);
                      if (!q.trim() || !appUser?.id) { setNewChatResults([]); return; }
                      setSearchingNewChat(true);
                      newChatSearchRef.current = setTimeout(async () => {
                        const results = await searchProfiles(q, appUser.id, appUser.id);
                        setNewChatResults(results);
                        setSearchingNewChat(false);
                      }, 300);
                    }}
                    placeholder="Search people…"
                    className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* People list */}
              <div className="overflow-y-auto flex-1">
                {searchingNewChat && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                  </div>
                )}
                {!searchingNewChat && newChatSearch && newChatResults.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">No people found</p>
                )}
                {!searchingNewChat && !newChatSearch && followingSuggestions.length === 0 && newChatSelected.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">Search for someone to message</p>
                )}
                {(() => {
                  const list = (newChatSearch ? newChatResults : followingSuggestions).filter(u => !blockedUserIds.has(u.id));
                  if (list.length === 0) return null;
                  return (
                    <div>
                      {!newChatSearch && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Suggested</p>}
                      {list.map(user => {
                        const ini = user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                        const isSelected = newChatSelected.some(s => s.id === user.id);
                        return (
                          <button key={user.id} onClick={() => {
                            if (isSelected) {
                              setNewChatSelected(prev => prev.filter(x => x.id !== user.id));
                            } else {
                              setNewChatSelected(prev => [...prev, user]);
                              setNewChatSearch('');
                              setNewChatResults([]);
                            }
                          }} className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 text-left">
                            {user.avatarUrl
                              ? <img src={user.avatarUrl} alt={user.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                              : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{ini}</div>}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                              <p className="text-xs text-gray-400">@{user.username}</p>
                            </div>
                            {isSelected && <Check size={16} strokeWidth={2.5} className="text-gray-900 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Start chat button */}
              <div className="px-4 pb-8 pt-3 flex-shrink-0 border-t border-gray-100">
                <button
                  disabled={newChatSelected.length === 0 || startingChat}
                  onClick={async () => {
                    if (!appUser?.id || newChatSelected.length === 0) return;
                    setStartingChat(true);
                    const user = newChatSelected[0];
                    const convId = await getOrCreateConversation(appUser.id, user.id);
                    if (!convId) { setStartingChat(false); return; }
                    setShowNewChat(false);
                    setNewChatSelected([]);
                    setNewChatSearch('');
                    setNewChatResults([]);
                    setActiveConversationUser({ id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl });
                    setActiveConversationId(convId);
                    onConversationChange?.(true);
                    getConversations(appUser.id).then(setConversations).catch(() => {});
                    setStartingChat(false);
                  }}
                  className="w-full py-4 rounded-2xl font-semibold text-sm transition-colors disabled:opacity-40"
                  style={{ backgroundColor: '#0f172a', color: '#fff' }}
                >
                  {startingChat ? 'Opening…' : newChatSelected.length > 0 ? `Message ${newChatSelected[0].name.split(' ')[0]}` : 'Select someone'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Feed View ────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <SondrrLogo height={22} color="#0f172a" />
        <button
          onClick={() => setShowInbox(true)}
          className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
        >
          <Mail size={17} strokeWidth={1.5} className="text-gray-700" />
          {conversations.some(c => c.unread) && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-orange-500" />
          )}
        </button>
      </div>

      {/* Feed — vertical scroll */}
      <div className="pt-3 pb-8">

        {/* Loading skeleton — BUG-03 */}
        {(loadingFeed || loadingDiscovery) && (
          <div className="space-y-7 px-4 pt-2">
            {[0, 1].map(i => (
              <div key={i} className="animate-pulse">
                <div className="rounded-[22px] bg-gray-100 h-72 w-full" />
                <div className="mt-3 px-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-24" />
                  <div className="h-3 bg-gray-100 rounded w-40" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {feedError && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <p className="text-sm font-semibold text-gray-900 mb-1">Couldn't load feed</p>
            <p className="text-xs text-gray-400 mb-4">Check your connection and try again.</p>
            <button onClick={() => setFeedRetry(c => c + 1)} className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-full">Retry</button>
          </div>
        )}

        {/* New user onboarding CTAs — shown immediately when personal feed is empty */}
        {!loadingFeed && isNewUserFlow && (
          <div className="px-4 pt-5 pb-3">
            <p className="text-slate-800 font-bold text-lg mb-1">Welcome{appUser?.name ? `, ${appUser.name.split(' ')[0]}` : ''}</p>
            <p className="text-slate-400 text-sm mb-4">Here's how to get started on sondrr</p>
            <div className="space-y-2.5">
              <button onClick={() => setShowFindPeople(true)} className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"><Users size={20} strokeWidth={1.5} className="text-white" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">Follow people</p><p className="text-xs text-slate-400 mt-0.5">Build your personal feed with people you love</p></div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => onNavigate?.('add')} className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"><Plus size={20} strokeWidth={1.5} className="text-white" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">Share a place</p><p className="text-xs text-slate-400 mt-0.5">Post a restaurant, hotel, or spot you love</p></div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {(isDiscoveryFeed || loadingDiscovery) && (
              <p className="text-sm text-slate-400 mt-5 mb-2 px-1">Discover what's on sondrr</p>
            )}
          </div>
        )}

        {/* Empty feed for established users (20+ follows but nothing posted yet) */}
        {!loadingFeed && !loadingDiscovery && !feedError && realPosts.length === 0 && feedGuides.length === 0 && !isNewUserFlow && (
          <div className="px-4 pt-5 pb-3">
            <p className="text-slate-800 font-bold text-lg mb-1">Welcome{appUser?.name ? `, ${appUser.name.split(' ')[0]}` : ''}</p>
            <p className="text-slate-400 text-sm mb-4">Here's how to get started on sondrr</p>
            <div className="space-y-2.5">
              <button onClick={() => setShowFindPeople(true)} className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"><Users size={20} strokeWidth={1.5} className="text-white" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">Follow people</p><p className="text-xs text-slate-400 mt-0.5">Build your personal feed with people you love</p></div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => onNavigate?.('add')} className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"><Plus size={20} strokeWidth={1.5} className="text-white" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">Share a place</p><p className="text-xs text-slate-400 mt-0.5">Post a restaurant, hotel, or spot you love</p></div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {!loadingFeed && !loadingDiscovery && [
          ...realPosts.filter(p => !blockedUserIds.has(p.userId)).map(p => ({ type: 'post' as const, id: p.id, ts: new Date(p.createdAt).getTime(), data: p })),
          ...feedGuides.filter(g => !blockedUserIds.has(g.userId)).map(g => ({ type: 'guide' as const, id: g.id, ts: new Date(g.publishedAt).getTime(), data: g })),
        ].sort((a, b) => {
          const ta = isNaN(a.ts) ? 0 : a.ts;
          const tb = isNaN(b.ts) ? 0 : b.ts;
          return tb - ta;
        }).map(item => {
          if (item.type === 'guide') {
            const guide = item.data;
            const isGuideLiked = likedGuides.has(guide.id);
            // FIX 13: extended timeAgo with weeks/months/years
            const timeAgo = (() => {
              const diff = Date.now() - item.ts;
              const mins = Math.floor(diff / 60000);
              if (mins < 1) return 'just now';
              if (mins < 60) return `${mins}m`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h`;
              const days = Math.floor(hrs / 24);
              if (days < 7) return `${days}d`;
              const weeks = Math.floor(days / 7);
              if (weeks < 5) return `${weeks}w`;
              const months = Math.floor(days / 30);
              if (months < 12) return `${months}mo`;
              return `${Math.floor(days / 365)}y`;
            })();
            return (
              <div key={`guide-${guide.id}`} className="mb-7 mx-4">
                <button
                  onClick={() => setSelectedGuide(guide)}
                  className="w-full text-left active:opacity-90 transition-opacity"
                >
                  <div className="relative rounded-[22px] overflow-hidden shadow-md" style={{ height: 300 }}>
                    {guide.coverUrl
                      ? <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
                      : <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
                    {/* Author top */}
                    <div className="absolute top-0 left-0 right-0 px-4 pt-4 flex items-center justify-between">
                      <button
                        className="flex items-center gap-2 active:opacity-75"
                        onClick={(e) => { e.stopPropagation(); setViewingUserId(guide.userId); }}
                      >
                        {guide.profile.avatarUrl
                          ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-8 h-8 rounded-full object-cover border border-white/30" />
                          : <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{guide.profile.name[0]?.toUpperCase()}</div>
                        }
                        <span className="text-white text-sm font-semibold drop-shadow">{guide.profile.username || guide.profile.name}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-white/70 text-xs drop-shadow">{timeAgo}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReportStep('options'); setReportReason(''); setContentOptions({ type: 'guide', id: guide.id, authorId: guide.userId, username: guide.profile.username || guide.profile.name, avatarUrl: guide.profile.avatarUrl, isOwn: appUser?.id === guide.userId }); }}
                          className="active:opacity-60 p-1"
                        >
                          <MoreHorizontal size={14} strokeWidth={2} className="text-white" />
                        </button>
                      </div>
                    </div>
                    {/* Guide badge + title bottom */}
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                      <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 inline-block mb-1.5">{guide.format === 'itinerary' ? 'Itinerary' : 'Guide'}</span>
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white text-[15px] font-bold leading-tight drop-shadow-sm">{guide.title}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            {guide.destination && (
                              <span className="text-white/70 text-xs flex items-center gap-0.5">
                                <MapPin size={9} strokeWidth={1.5} className="inline" />{guide.destination}
                              </span>
                            )}
                            {guide.destination && guide.places && guide.places.length > 0 && (
                              <span className="text-white/40 text-xs">·</span>
                            )}
                            {guide.places && guide.places.length > 0 && (
                              <span className="text-white/70 text-xs">{guide.places.length} place{guide.places.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        <span className="flex-shrink-0 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                          Read →
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                {/* Guide action row — like, comment, share, save */}
                <div className="mx-3 pt-2.5 flex items-center gap-3">
                  {/* Like */}
                  <button
                    disabled={likingGuideIds.has(guide.id)}
                    className="flex items-center gap-1.5 active:scale-90 transition-transform"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const uid = appUser?.id; if (!uid) return;
                      if (likingGuideIds.has(guide.id)) return;
                      setLikingGuideIds(prev => new Set(prev).add(guide.id));
                      const wasLiked = isGuideLiked;
                      setLikedGuides(prev => { const n = new Set(prev); wasLiked ? n.delete(guide.id) : n.add(guide.id); return n; });
                      setGuideLikes(prev => ({ ...prev, [guide.id]: Math.max(0, (prev[guide.id] ?? 0) + (wasLiked ? -1 : 1)) }));
                      try {
                        const ok = await (wasLiked ? unlikeGuide(uid, guide.id) : likeGuide(uid, guide.id));
                        if (!ok) {
                          setLikedGuides(prev => { const n = new Set(prev); wasLiked ? n.add(guide.id) : n.delete(guide.id); return n; });
                          setGuideLikes(prev => ({ ...prev, [guide.id]: Math.max(0, (prev[guide.id] ?? 0) + (wasLiked ? 1 : -1)) }));
                        }
                      } catch {
                        setLikedGuides(prev => { const n = new Set(prev); wasLiked ? n.add(guide.id) : n.delete(guide.id); return n; });
                        setGuideLikes(prev => ({ ...prev, [guide.id]: Math.max(0, (prev[guide.id] ?? 0) + (wasLiked ? 1 : -1)) }));
                      } finally {
                        setLikingGuideIds(prev => { const n = new Set(prev); n.delete(guide.id); return n; });
                      }
                    }}
                  >
                    <Heart size={20} strokeWidth={1.5} className={isGuideLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-600'} />
                    {(guideLikes[guide.id] ?? 0) > 0 && <span className="text-sm text-gray-600">{guideLikes[guide.id]}</span>}
                  </button>
                  {/* Comment */}
                  <button className="flex items-center gap-1.5 active:scale-90 transition-transform" onClick={async (e) => {
                    e.stopPropagation();
                    const opening = showGuideCommentsId !== guide.id;
                    setShowGuideCommentsId(opening ? guide.id : null);
                    setShowShareGuideId(null);
                    if (opening && !guideCommentsMap[guide.id]) {
                      setLoadingGuideCommentsId(guide.id);
                      getGuideComments(guide.id).then(c => {
                        setGuideCommentsMap(prev => ({ ...prev, [guide.id]: c }));
                        setLoadingGuideCommentsId(null);
                      }).catch(() => setLoadingGuideCommentsId(null));
                    }
                  }}>
                    <MessageCircle size={20} strokeWidth={1.5} className="text-gray-600" />
                    {(guideCommentCounts[guide.id] ?? 0) > 0 && <span className="text-sm text-gray-600">{guideCommentCounts[guide.id]}</span>}
                  </button>
                  {/* Share */}
                  <button className="active:scale-90 transition-transform" onClick={(e) => {
                    e.stopPropagation();
                    setShowShareGuideId(showShareGuideId === guide.id ? null : guide.id);
                    setShowGuideCommentsId(null);
                  }}>
                    <Send size={20} strokeWidth={1.5} className="text-gray-600" />
                  </button>
                  {/* Save to All Saved + open collection sheet */}
                  <button className="ml-auto active:scale-90 transition-transform" onClick={async (e) => {
                    e.stopPropagation();
                    const uid = appUser?.id; if (!uid) return;
                    setGuideColLoading(true);
                    // Auto-save to All Saved immediately (subscribe)
                    if (!subscribedGuideIds.has(guide.id)) {
                      subscribeToGuide(uid, guide.id);
                      setSubscribedGuideIds(prev => new Set(prev).add(guide.id));
                    }
                    const ids = await getGuideCollectionIds(guide.id, uid);
                    setGuideColIds(ids);
                    setGuideColSheet(guide);
                    setGuideColLoading(false);
                  }}>
                    {guideColLoading && guideColSheet?.id === guide.id
                      ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400" />
                      : guideColIds.size > 0 && guideColSheet?.id !== guide.id
                        ? <BookmarkCheck size={20} strokeWidth={1.5} className="text-gray-900" />
                        : subscribedGuideIds.has(guide.id)
                          ? <BookmarkCheck size={20} strokeWidth={1.5} className="text-gray-900" />
                          : <Bookmark size={20} strokeWidth={1.5} className="text-gray-600" />}
                  </button>
                </div>
                {/* Guide comments panel */}
                {showGuideCommentsId === guide.id && (
                  <div className="mx-3 mt-2 mb-1">
                    {loadingGuideCommentsId === guide.id ? (
                      <div className="py-3 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                    ) : (guideCommentsMap[guide.id] ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 py-2 px-1">No comments yet</p>
                    ) : (
                      <div className="space-y-2 mb-2">
                        {(guideCommentsMap[guide.id] ?? []).filter(c => !blockedUserIds.has(c.userId)).map(c => (
                          <div key={c.id} className="flex gap-2">
                            <span className="text-xs font-semibold text-gray-900">{c.profile.username || c.profile.name}</span>
                            <span className="text-xs text-gray-700">{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-center border-t border-gray-100 pt-2">
                      <input
                        value={guideCommentText}
                        onChange={e => setGuideCommentText(e.target.value)}
                        placeholder="Add a comment…"
                        className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none"
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && !e.shiftKey && guideCommentText.trim() && appUser?.id && !submittingGuideComment) {
                            e.preventDefault();
                            setSubmittingGuideComment(true);
                            const saved = await addGuideComment(guide.id, appUser.id, guideCommentText.trim()).catch(() => null);
                            if (saved) {
                              setGuideCommentsMap(prev => ({ ...prev, [guide.id]: [...(prev[guide.id] ?? []), saved] }));
                              setGuideCommentCounts(prev => ({ ...prev, [guide.id]: (prev[guide.id] ?? 0) + 1 }));
                              setGuideCommentText('');
                            }
                            setSubmittingGuideComment(false);
                          }
                        }}
                      />
                      <button
                        disabled={!guideCommentText.trim() || submittingGuideComment}
                        onClick={async () => {
                          if (!guideCommentText.trim() || !appUser?.id || submittingGuideComment) return;
                          setSubmittingGuideComment(true);
                          const saved = await addGuideComment(guide.id, appUser.id, guideCommentText.trim()).catch(() => null);
                          if (saved) {
                            setGuideCommentsMap(prev => ({ ...prev, [guide.id]: [...(prev[guide.id] ?? []), saved] }));
                            setGuideCommentCounts(prev => ({ ...prev, [guide.id]: (prev[guide.id] ?? 0) + 1 }));
                            setGuideCommentText('');
                          }
                          setSubmittingGuideComment(false);
                        }}
                        className="text-sm font-semibold text-gray-900 disabled:opacity-40"
                      >
                        {submittingGuideComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={16} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          const post = item.data;
          const images = post.places.map(p => p.photoUrl).filter(Boolean) as string[];
          if (!images.length) return null;
          const placeLabels = post.places.map(p => p.name.split(',')[0].trim());
          const placeSublabels = post.places.map(p => [p.neighborhood, p.city].filter(Boolean).join(', ') || p.country);
          // FIX 13: extended timeAgo with weeks/months/years
          const timeAgo = (() => {
            const diff = Date.now() - new Date(post.createdAt).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h`;
            const days = Math.floor(hrs / 24);
            if (days < 7) return `${days}d`;
            const weeks = Math.floor(days / 7);
            if (weeks < 5) return `${weeks}w`;
            const months = Math.floor(days / 30);
            if (months < 12) return `${months}mo`;
            return `${Math.floor(days / 365)}y`;
          })();
          const avatarSrc = post.profile.avatarUrl ?? null;
          const isLiked = likedRealPosts.has(post.id);
          const allPlacesSaved = post.places.length > 0 && post.places.every(p => allSavedPlaceIds.has(p.id));
          // BUG-16: use commentCountsMap for badge, fall back to loaded comments length
          const commentCount = commentsMap[post.id] != null ? commentsMap[post.id].length : (commentCountsMap[post.id] ?? 0);
          const uniquePlaceCount = (() => {
            const seen = new Set<string>();
            return post.places.filter(p => { const k = p.name.split(',')[0].trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).length;
          })();

          return (
            <div key={post.id} className="mb-7">
              {/* ── Photo card ── */}
              <div className="mx-4 relative rounded-[22px] overflow-hidden shadow-md">
                {/* Author overlay at top */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" style={{ height: 72 }} />
                <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 flex items-center justify-between">
                  <button onClick={() => setViewingUserId(post.userId)} className="flex items-center gap-2 active:opacity-75">
                    {avatarSrc
                      ? <img src={avatarSrc} alt={post.profile.name} className="w-8 h-8 rounded-full object-cover object-top border border-white/30" />
                      : <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(post.profile.name || post.profile.username || '?')[0].toUpperCase()}</div>}
                    <span className="text-white text-sm font-semibold drop-shadow">{post.profile.username || post.profile.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs drop-shadow">{timeAgo}</span>
                    <button
                      onClick={() => { setReportStep('options'); setReportReason(''); setContentOptions({ type: 'post', id: post.id, authorId: post.userId, username: post.profile.username || post.profile.name, avatarUrl: post.profile.avatarUrl, isOwn: appUser?.id === post.userId }); }}
                      className="active:opacity-60 p-1"
                    >
                      <MoreHorizontal size={14} strokeWidth={2} className="text-white" />
                    </button>
                  </div>
                </div>
                {/* Carousel with place name labels + dots */}
                <ImageCarousel
                  images={images}
                  labels={placeLabels}
                  sublabels={placeSublabels}
                  onIndexChange={(i) => setCarouselIndex(prev => ({ ...prev, [post.id]: i }))}
                  onClick={() => {
                    // BUG-31: carouselIndex is updated via onIndexChange before click fires
                    const idx = carouselIndex[post.id] ?? 0;
                    const placesWithPhotos = post.places.filter(p => p.photoUrl);
                    setSelectedPlacePage(placesWithPhotos[idx] ?? post.places[0]);
                    setExpandedPlacesPostId(null); // FIX 26: close places sheet if open
                  }}
                />
              </div>

              {/* ── Info strip below card ── */}
              <div className="mx-7 pt-3">
                {/* Actions row */}
                <div className="flex items-center gap-4">
                  <button
                    className="flex items-center gap-1.5 active:scale-90 transition-transform"
                    disabled={likingPostIds.has(post.id)}
                    onClick={async () => {
                      if (!appUser?.id) return; // BUG-50
                      if (likingPostIds.has(post.id)) return; // BUG-08: debounce guard
                      setLikingPostIds(prev => new Set(prev).add(post.id));
                      // Optimistic update
                      setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.delete(post.id) : n.add(post.id); return n; });
                      setRealPostLikeCounts(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? 0) + (isLiked ? -1 : 1)) }));
                      try {
                        // BUG-10: check return value and rollback if false
                        const ok = await (isLiked ? unlikePost(appUser.id, post.id) : likePost(appUser.id, post.id));
                        if (!ok) {
                          // BUG-09: clamp rollback to >= 0
                          setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.add(post.id) : n.delete(post.id); return n; });
                          setRealPostLikeCounts(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? 0) + (isLiked ? 1 : -1)) }));
                        }
                      } catch {
                        // Rollback on exception
                        setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.add(post.id) : n.delete(post.id); return n; });
                        setRealPostLikeCounts(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? 0) + (isLiked ? 1 : -1)) }));
                      } finally {
                        setLikingPostIds(prev => { const n = new Set(prev); n.delete(post.id); return n; });
                      }
                    }}
                  >
                    <Heart size={20} strokeWidth={1.5} className={isLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-600'} />
                    {(realPostLikeCounts[post.id] ?? 0) > 0 && <span className="text-sm text-gray-600">{realPostLikeCounts[post.id]}</span>}
                  </button>
                  <button
                    className="flex items-center gap-1.5 active:scale-90 transition-transform"
                    onClick={async () => {
                      if (showCommentsPostId === post.id) { setShowCommentsPostId(null); return; }
                      setShowCommentsPostId(post.id);
                      if (!commentsMap[post.id]) {
                        // BUG-14: per-post loading state
                        setLoadingCommentsPostId(post.id);
                        try {
                          const comments = await getPostComments(post.id);
                          setCommentsMap(prev => ({ ...prev, [post.id]: comments }));
                        } finally {
                          setLoadingCommentsPostId(null);
                        }
                      }
                    }}
                  >
                    <MessageCircle size={20} strokeWidth={1.5} className="text-gray-600" />
                    {commentCount > 0 && <span className="text-sm text-gray-600">{commentCount}</span>}
                  </button>
                  <button className="active:scale-90 transition-transform" onClick={() => {
                    // BUG-29+30: clear copied state when opening share sheet
                    setHomeShareLinkCopied(false);
                    // FIX 27: mutual exclusion
                    setShowPostSaveSheet(null);
                    setAddToColPlace(null);
                    setShowSharePostId(showSharePostId === post.id ? null : post.id);
                  }}>
                    <Send size={20} strokeWidth={1.5} className="text-gray-600" />
                  </button>
                  <button
                    className="ml-auto active:scale-90 transition-transform"
                    onClick={async () => {
                      if (!appUser?.id) return; // BUG-50
                      if (allPlacesSaved) {
                        // Optimistic unsave
                        const prevIds = new Set(allSavedPlaceIds);
                        for (const p of post.places) { setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; }); }
                        // BUG-51: await and check return; BUG-20: rollback on failure
                        for (const p of post.places) {
                          const ok = await unsavePlace(appUser.id, p.id);
                          if (!ok) { setAllSavedPlaceIds(prevIds); break; }
                        }
                      } else {
                        // Optimistic save
                        const prevIds = new Set(allSavedPlaceIds);
                        for (const p of post.places) { setAllSavedPlaceIds(prev => new Set(prev).add(p.id)); }
                        // BUG-51: await and check return; BUG-20: rollback on failure
                        let anyFailed = false;
                        for (const p of post.places) {
                          try {
                            const ok = await savePlace(appUser.id, p.id);
                            if (!ok) anyFailed = true;
                          } catch {
                            anyFailed = true;
                          }
                        }
                        if (anyFailed) { setAllSavedPlaceIds(prevIds); return; }
                        // FIX 18: fetch collection IDs for ALL places and take the intersection
                        if (post.places.length > 0) {
                          const allColIdSets = await Promise.all(post.places.map(p => getPlaceCollectionIds(p.id)));
                          let intersection = allColIdSets[0] ?? new Set<string>();
                          for (const s of allColIdSets.slice(1)) {
                            intersection = new Set([...intersection].filter(id => s.has(id)));
                          }
                          setPostSaveSheetColIds(intersection);
                        } else {
                          setPostSaveSheetColIds(new Set());
                        }
                        setShowNewColInput(false);
                        setNewColName('');
                        setActiveSheetContext('post');
                        // FIX 27: mutual exclusion
                        setShowSharePostId(null);
                        setAddToColPlace(null);
                        // Load user's trips for the Trips section
                        setPostSavePlanAdded(new Set());
                        setPostSaveShowNewTrip(false);
                        setPostSaveNewTripName('');
                        if (appUser?.id) {
                          getPlans(appUser.id).then(setPostSavePlans);
                        }
                        setShowPostSaveSheet({ postId: post.id, placeIds: post.places.map(p => p.id) });
                      }
                    }}
                  >
                    {allPlacesSaved ? <BookmarkCheck size={20} strokeWidth={1.5} className="text-gray-900" /> : <Bookmark size={20} strokeWidth={1.5} className="text-gray-600" />}
                  </button>
                </div>

                {/* Caption */}
                {post.caption && <p className="text-sm text-gray-700 mt-2 leading-snug">{post.caption}</p>}

                {/* Places button — only show when multiple unique places */}
                {uniquePlaceCount > 1 && (
                  <div className="flex items-center gap-3 mt-2.5">
                    <button
                      onClick={() => setExpandedPlacesPostId(p => p === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-gray-500 active:opacity-70"
                    >
                      <MapPin size={13} strokeWidth={1.5} className="text-gray-400" />
                      <span className="text-sm text-gray-500">{uniquePlaceCount} places</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                )}

                {/* Inline comments */}
                {showCommentsPostId === post.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {/* BUG-14: per-post loading state */}
                    {loadingCommentsPostId === post.id && <p className="text-xs text-gray-400 py-2">Loading…</p>}
                    {(commentsMap[post.id] ?? []).filter(c => !blockedUserIds.has(c.userId)).map(c => (
                      <div key={c.id} className="flex items-start gap-2 mb-2">
                        {c.profile.avatarUrl
                          ? <img src={c.profile.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                          : <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400 mt-0.5">{c.profile.name?.[0]}</div>}
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-gray-900">{c.profile.name} </span>
                          <span className="text-xs text-gray-600">{c.text}</span>
                        </div>
                        {/* BUG-13: delete comment button for own comments */}
                        {c.userId === appUser?.id && (
                          <button
                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 active:scale-90 transition-transform"
                            onClick={async () => {
                              // FIX 15: optimistic delete with rollback
                              const prevComments = commentsMap[post.id] ?? [];
                              setCommentsMap(prev => ({ ...prev, [post.id]: (prev[post.id] ?? []).filter(x => x.id !== c.id) }));
                              setCommentCountsMap(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? 1) - 1) }));
                              try {
                                await deleteComment(c.id);
                              } catch {
                                // rollback
                                setCommentsMap(prev => ({ ...prev, [post.id]: prevComments }));
                                setCommentCountsMap(prev => ({ ...prev, [post.id]: prevComments.length }));
                              }
                            }}
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    ))}
                    {appUser && (
                      <div className="flex items-center gap-2 mt-2">
                        <input value={homeCommentText} onChange={e => setHomeCommentText(e.target.value)}
                          placeholder="Add a comment…" className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none"
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && !e.shiftKey && homeCommentText.trim() && submittingCommentPostId !== post.id) {
                              e.preventDefault();
                              // FIX 17: ref guard to prevent double-fire
                              if (commentSubmitRef.current) return;
                              commentSubmitRef.current = true;
                              const text = homeCommentText.trim(); setHomeCommentText('');
                              setSubmittingCommentPostId(post.id);
                              try {
                                const saved = await addComment(appUser.id, post.id, text);
                                if (saved) {
                                  setCommentsMap(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), saved] }));
                                  setCommentCountsMap(prev => ({ ...prev, [post.id]: (prev[post.id] ?? 0) + 1 }));
                                }
                              } finally {
                                setSubmittingCommentPostId(null);
                                commentSubmitRef.current = false;
                              }
                            }
                          }} />
                        {/* BUG-15: disable submit while in-flight */}
                        <button
                          disabled={submittingCommentPostId === post.id || !homeCommentText.trim()}
                          onClick={async () => {
                            if (!homeCommentText.trim() || !appUser || submittingCommentPostId === post.id) return;
                            // FIX 17: ref guard to prevent double-fire
                            if (commentSubmitRef.current) return;
                            commentSubmitRef.current = true;
                            const text = homeCommentText.trim(); setHomeCommentText('');
                            setSubmittingCommentPostId(post.id);
                            try {
                              const saved = await addComment(appUser.id, post.id, text);
                              if (saved) {
                                setCommentsMap(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), saved] }));
                                setCommentCountsMap(prev => ({ ...prev, [post.id]: (prev[post.id] ?? 0) + 1 }));
                              }
                            } finally {
                              setSubmittingCommentPostId(null);
                              commentSubmitRef.current = false;
                            }
                          }}
                          className="text-xs font-semibold text-white px-3 py-2 bg-gray-900 rounded-xl disabled:opacity-40"
                        >Post</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>


      {/* Places bottom sheet — map at top + list */}
      {expandedPlacesPostId && (() => {
        const post = realPosts.find(p => p.id === expandedPlacesPostId);
        if (!post) return null;
        const mapPlaces = post.places.filter(p => p.lat != null && p.lng != null).map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name, neighbourhood: p.neighborhood, city: p.city, country: p.country }));
        return (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setExpandedPlacesPostId(null)} />
            <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
              <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              {/* Header */}
              <div className="px-5 pb-3 flex items-center justify-between">
                <p className="text-base font-bold text-gray-900">{(() => { const s = new Set<string>(); return post.places.filter(p => { const k = p.name.split(',')[0].trim().toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }).length; })()} places</p>
                <button onClick={() => setExpandedPlacesPostId(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={14} strokeWidth={2} className="text-gray-500" />
                </button>
              </div>
              {/* Map */}
              {mapPlaces.length > 0 && (
                <div className="mx-4 mb-3 rounded-2xl overflow-hidden">
                  <Suspense fallback={<div className="h-44 bg-gray-100 animate-pulse rounded-2xl" />}>
                    <MapView places={mapPlaces} height="160px" />
                  </Suspense>
                </div>
              )}
              {/* Place list — deduplicated by name */}
              <div className="flex-1 overflow-y-auto pb-8 border-t border-gray-100">
                {(() => {
                  const seen = new Set<string>();
                  return post.places.filter(p => {
                    const key = p.name.split(',')[0].trim().toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                })().map((p, i) => {
                  const isSavedPlace = allSavedPlaceIds.has(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-bold text-gray-300 w-4 text-center flex-shrink-0">{i + 1}</span>
                      <button onClick={() => { setSelectedPlacePage(p); setExpandedPlacesPostId(null); }} className="flex-shrink-0 active:opacity-70">
                        {p.photoUrl
                          ? <img src={p.photoUrl} className="w-14 h-14 rounded-2xl object-cover" />
                          : <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">📍</div>}
                      </button>
                      <button onClick={() => { setSelectedPlacePage(p); setExpandedPlacesPostId(null); }} className="flex-1 min-w-0 text-left active:opacity-70">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name.split(',')[0].trim()}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{[p.neighborhood, p.city].filter(Boolean).join(', ') || p.country}</p>
                      </button>
                      <button
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
                        onClick={async () => {
                          if (!appUser?.id) return; // BUG-50
                          if (isSavedPlace) {
                            // Optimistic unsave with rollback (BUG-20)
                            setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                            const ok = await unsavePlace(appUser.id, p.id);
                            if (!ok) setAllSavedPlaceIds(prev => new Set(prev).add(p.id));
                          } else {
                            // Optimistic save with rollback (BUG-20)
                            setAllSavedPlaceIds(prev => new Set(prev).add(p.id));
                            const ok = await savePlace(appUser.id, p.id);
                            if (!ok) { setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; }); return; }
                            // BUG-24: load placeInCollections before showing addToColPlace sheet
                            // FIX 20: reset stale state before async load
                            setPlaceInCollections(new Set());
                            setLoadingPlaceCollections(true);
                            // FIX 27: mutual exclusion
                            setShowSharePostId(null);
                            setShowPostSaveSheet(null);
                            setAddToColPlace({ id: p.id, name: p.name });
                            setActiveSheetContext('place');
                            setShowNewColInput(false);
                            setNewColName('');
                            setPostSavePlanAdded(new Set());
                            setPostSaveShowNewTrip(false);
                            setPostSaveNewTripName('');
                            if (appUser?.id) getPlans(appUser.id).then(setPostSavePlans);
                            try {
                              const colIds = await getPlaceCollectionIds(p.id);
                              setPlaceInCollections(colIds);
                            } finally {
                              setLoadingPlaceCollections(false);
                            }
                          }
                        }}
                      >
                        {isSavedPlace
                          ? <BookmarkCheck size={18} strokeWidth={1.5} className="text-gray-900" />
                          : <Bookmark size={18} strokeWidth={1.5} className="text-gray-400" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Content options sheet (···) ── */}
      {contentOptions && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ maxWidth: '390px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setContentOptions(null)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            {reportStep === 'options' && (
              <>
                <div className="py-1">
                  {contentOptions.isOwn ? (
                    <>
                      {contentOptions.type === 'guide' && (
                        <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                          onClick={() => {
                            const g = feedGuides.find(g => g.id === contentOptions.id);
                            if (g) { setEditingGuide(g); }
                            setContentOptions(null);
                          }}>
                          <Edit3 size={18} strokeWidth={1.5} className="text-gray-500" />
                          <span className="text-sm text-gray-900">Edit</span>
                        </button>
                      )}
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => setReportStep('deleteConfirm')}>
                        <Trash2 size={18} strokeWidth={1.5} className="text-gray-500" />
                        <span className="text-sm text-gray-900">Delete</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => setReportStep('reason')}>
                        <Flag size={18} strokeWidth={1.5} className="text-gray-500" />
                        <span className="text-sm text-gray-900">Report</span>
                        <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto" />
                      </button>
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => {
                          const alreadyBlocked = blockedUserIds.has(contentOptions.authorId);
                          setContentOptions(null);
                          setActionModal({
                            avatarUrl: contentOptions.avatarUrl,
                            title: alreadyBlocked ? `Unblock @${contentOptions.username}?` : `Block @${contentOptions.username}?`,
                            subtitle: alreadyBlocked
                              ? 'They will be able to see your posts and find your profile again.'
                              : "They won't be able to see your profile or posts, and you won't see theirs.",
                            confirmLabel: alreadyBlocked ? 'Unblock' : 'Block',
                            confirmVariant: alreadyBlocked ? 'dark' : 'red',
                            onConfirm: async () => {
                              if (!appUser?.id) return;
                              if (alreadyBlocked) {
                                await unblockUser(appUser.id, contentOptions.authorId);
                                setBlockedUserIds(prev => { const s = new Set(prev); s.delete(contentOptions.authorId); return s; });
                              } else {
                                await blockUser(appUser.id, contentOptions.authorId);
                                setBlockedUserIds(prev => new Set([...prev, contentOptions.authorId]));
                                setRealPosts(prev => prev.filter(p => p.userId !== contentOptions.authorId));
                                setFeedGuides(prev => prev.filter(g => g.userId !== contentOptions.authorId));
                              }
                              setActionModal(null);
                            },
                          });
                        }}>
                        <UserX size={18} strokeWidth={1.5} className="text-gray-500" />
                        <span className="text-sm text-gray-900">{blockedUserIds.has(contentOptions.authorId) ? 'Unblock' : 'Block'} @{contentOptions.username}</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {reportStep === 'reason' && (
              <>
                <div className="px-5 pb-3 border-b border-gray-100">
                  <p className="text-base font-bold text-gray-900">Report</p>
                  <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
                </div>
                <div className="py-1">
                  {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(reason => (
                    <button key={reason} className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50"
                      onClick={async () => {
                        if (!appUser?.id) return;
                        await reportContent(appUser.id, { postId: contentOptions.type === 'post' ? contentOptions.id : undefined, userId: contentOptions.authorId, reason });
                        setContentOptions(null);
                        setActionModal({
                          iconType: 'check',
                          title: 'Report submitted',
                          subtitle: "Thank you. We'll review this content and take action if it violates our guidelines.",
                        });
                      }}>
                      <span className="text-sm text-gray-900">{reason}</span>
                      <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {reportStep === 'deleteConfirm' && contentOptions && (
              <div className="flex flex-col items-center px-6 pb-2 pt-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Trash2 size={28} strokeWidth={1.5} className="text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Delete this {contentOptions.type}?</p>
                <p className="text-sm text-gray-400 text-center mb-6">This can't be undone.</p>
                <button className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
                  onClick={async () => {
                    if (contentOptions.type === 'post') {
                      await deletePost(contentOptions.id);
                      setRealPosts(prev => prev.filter(p => p.id !== contentOptions.id));
                    } else {
                      await deleteGuide(contentOptions.id);
                      setFeedGuides(prev => prev.filter(g => g.id !== contentOptions.id));
                    }
                    setContentOptions(null);
                    setOptionsToast('Deleted');
                    setTimeout(() => setOptionsToast(null), 2500);
                  }}>
                  Delete
                </button>
                <button className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold"
                  onClick={() => setReportStep('options')}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {optionsToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {optionsToast}
        </div>
      )}
      {actionModal && (
        <ActionModal
          avatarUrl={actionModal.avatarUrl}
          iconType={actionModal.iconType}
          title={actionModal.title}
          subtitle={actionModal.subtitle}
          confirmLabel={actionModal.confirmLabel}
          confirmVariant={actionModal.confirmVariant}
          onConfirm={actionModal.onConfirm}
          onCancel={() => setActionModal(null)}
        />
      )}

      {/* Guide detail overlay */}
      {selectedGuide && (
        <GuideDetail
          guide={selectedGuide}
          currentUserId={appUser?.id}
          onClose={() => setSelectedGuide(null)}
          onEditGuide={() => {
            // FIX 24: capture fresh reference to avoid stale data
            const guideToEdit = feedGuides.find(g => g.id === selectedGuide?.id) ?? selectedGuide;
            setEditingGuide(guideToEdit);
            setSelectedGuide(null);
          }}
          onPlaceClick={(place) => setSelectedPlacePage(place)}
          onViewUser={(uid) => { setSelectedGuide(null); setViewingUserId(uid); }}
        />
      )}

      {editingGuide && appUser && (
        <CreateGuideSheet
          userId={appUser.id}
          editingGuide={editingGuide}
          onClose={() => setEditingGuide(null)}
          onCreated={() => setEditingGuide(null)}
          onUpdated={(updated) => {
            setFeedGuides(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
            setEditingGuide(null);
          }}
        />
      )}

      {/* Collection picker sheet */}
      {addToColPlace && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddToColPlace(null)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Saved to All Saved ✓</h3>
              <p className="text-xs text-gray-400 truncate">Also add "{addToColPlace.name}" to a collection?</p>
            </div>
            {loadingPlaceCollections ? (
              <div className="px-4 space-y-3 pb-4">
                {[0, 1].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
                {userCollections.map(col => {
                  const inCol = placeInCollections.has(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={async () => {
                        const placeId = addToColPlace?.id; if (!placeId) return;
                        if (inCol) {
                          // BUG-22: only remove if actually in collection
                          if (placeInCollections.has(col.id)) {
                            // Optimistic update
                            setPlaceInCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                            setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                            try {
                              await removePlaceFromCollection(col.id, placeId);
                            } catch {
                              // Rollback
                              setPlaceInCollections(prev => new Set(prev).add(col.id));
                              setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + 1 } : c));
                            }
                          }
                        } else {
                          // Optimistic update
                          setPlaceInCollections(prev => new Set(prev).add(col.id));
                          setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + 1 } : c));
                          // BUG-53: also update postSaveSheetColIds if post save sheet is open
                          if (activeSheetContext === 'post') {
                            setPostSaveSheetColIds(prev => new Set(prev).add(col.id));
                          }
                          try {
                            await addPlaceToCollection(col.id, placeId);
                          } catch {
                            // Rollback
                            setPlaceInCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                            setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                            if (activeSheetContext === 'post') {
                              setPostSaveSheetColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                            }
                          }
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
                        {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* New collection */}
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => { setActiveSheetContext('place'); setShowNewColSheet(true); }}
                className="w-full flex items-center gap-3 py-2 text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Plus size={18} strokeWidth={2} className="text-gray-500" />
                </div>
                <span className="text-sm font-semibold text-gray-700">New collection</span>
              </button>
            </div>

            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {postSavePlans.length === 0 && !postSaveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {postSavePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {postSavePlans.map(plan => {
                    const added = postSavePlanAdded.has(plan.id);
                    const adding = postSavePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!appUser?.id || !addToColPlace) return;
                          setPostSavePlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              // Find full place data from feed if available
                              const fullPlace = realPosts.flatMap(p => p.places).find(pl => pl.id === addToColPlace.id);
                              await createPlanItem(plan.id, day.id, {
                                name: addToColPlace.name,
                                category: fullPlace?.category || '',
                                image_url: fullPlace?.photoUrl || '',
                                time_label: '',
                                address: fullPlace ? [fullPlace.neighborhood, fullPlace.city, fullPlace.country].filter(Boolean).join(', ') : '',
                                neighborhood: fullPlace?.neighborhood || '',
                                position: day.items.length,
                                lat: fullPlace?.lat ?? null,
                                lng: fullPlace?.lng ?? null,
                              });
                              setPostSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setPostSavePlanAdding(null);
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
              {postSaveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={postSaveNewTripName}
                    onChange={e => setPostSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setPostSaveShowNewTrip(false); setPostSaveNewTripName(''); }
                      if (e.key === 'Enter' && postSaveNewTripName.trim() && appUser?.id) {
                        setPostSaveCreatingTrip(true);
                        const newPlan = await createPlan(appUser.id, { title: postSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setPostSavePlans(prev => [newPlan, ...prev]); setPostSaveShowNewTrip(false); setPostSaveNewTripName(''); }
                        setPostSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!postSaveNewTripName.trim() || postSaveCreatingTrip}
                    onClick={async () => {
                      if (!postSaveNewTripName.trim() || !appUser?.id) return;
                      setPostSaveCreatingTrip(true);
                      const newPlan = await createPlan(appUser.id, { title: postSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) { setPostSavePlans(prev => [newPlan, ...prev]); setPostSaveShowNewTrip(false); setPostSaveNewTripName(''); }
                      setPostSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {postSaveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setPostSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
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
                  if (!appUser?.id || !addToColPlace) return;
                  await unsavePlace(appUser.id, addToColPlace.id);
                  setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(addToColPlace.id); return n; });
                  setAddToColPlace(null);
                  setPostSavePlanAdded(new Set());
                  setPostSaveShowNewTrip(false);
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

      {/* Save-all-places-to-collection sheet */}
      {showPostSaveSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowPostSaveSheet(null); setPostSaveSheetColIds(new Set()); setShowNewColInput(false); setNewColName(''); setPostSavePlanAdded(new Set()); setPostSaveShowNewTrip(false); setPostSaveNewTripName(''); }} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add {showPostSaveSheet.placeIds.length} place{showPostSaveSheet.placeIds.length !== 1 ? 's' : ''} to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-60 overflow-y-auto">
              {userCollections.map(col => {
                const inCol = postSaveSheetColIds.has(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={async () => {
                      const placeIds = showPostSaveSheet?.placeIds; if (!placeIds) return;
                      if (inCol) {
                        // BUG-22: only remove if actually in the collection
                        // FIX 19: error handling with silent failure
                        if (postSaveSheetColIds.has(col.id)) {
                          try {
                            for (const placeId of placeIds) {
                              await removePlaceFromCollection(col.id, placeId);
                            }
                            setPostSaveSheetColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                            setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - placeIds.length) } : c));
                          } catch {
                            // silent — sheet stays showing the collection as checked
                          }
                        }
                      } else {
                        const placeIds = showPostSaveSheet?.placeIds; if (!placeIds) return;
                        try {
                          for (const placeId of placeIds) {
                            await addPlaceToCollection(col.id, placeId);
                          }
                          setPostSaveSheetColIds(prev => new Set(prev).add(col.id));
                          setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + placeIds.length } : c));
                        } catch {
                          // silent — do not update state on failure
                        }
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
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
                      {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* New collection quick-create */}
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => { setActiveSheetContext('post'); setShowNewColSheet(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Plus size={15} strokeWidth={2} className="text-gray-600" />
                </div>
                New collection
              </button>
            </div>

            {/* ── Trips section ── */}
            <div className="mx-4 mt-1 mb-1 border-t border-gray-100" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {postSavePlans.length === 0 && !postSaveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {postSavePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {postSavePlans.map(plan => {
                    const added = postSavePlanAdded.has(plan.id);
                    const adding = postSavePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!appUser?.id || !showPostSaveSheet) return;
                          setPostSavePlanAdding(plan.id);
                          try {
                            // Reuse existing Brainstorm day if one exists, else create
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              const post = realPosts.find(p => p.id === showPostSaveSheet.postId);
                              const places = post?.places.filter(pl => showPostSaveSheet.placeIds.includes(pl.id)) ?? [];
                              const startPos = day.items.length;
                              for (let i = 0; i < places.length; i++) {
                                const pl = places[i];
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
                              setPostSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setPostSavePlanAdding(null);
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
                        {added && !adding && (
                          <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                        {!added && !adding && (
                          <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* New trip inline */}
              {postSaveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={postSaveNewTripName}
                    onChange={e => setPostSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setPostSaveShowNewTrip(false); setPostSaveNewTripName(''); }
                      if (e.key === 'Enter' && postSaveNewTripName.trim() && appUser?.id) {
                        setPostSaveCreatingTrip(true);
                        const newPlan = await createPlan(appUser.id, { title: postSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) {
                          setPostSavePlans(prev => [newPlan, ...prev]);
                          setPostSaveShowNewTrip(false);
                          setPostSaveNewTripName('');
                        }
                        setPostSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!postSaveNewTripName.trim() || postSaveCreatingTrip}
                    onClick={async () => {
                      if (!postSaveNewTripName.trim() || !appUser?.id) return;
                      setPostSaveCreatingTrip(true);
                      const newPlan = await createPlan(appUser.id, { title: postSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) {
                        setPostSavePlans(prev => [newPlan, ...prev]);
                        setPostSaveShowNewTrip(false);
                        setPostSaveNewTripName('');
                      }
                      setPostSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {postSaveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPostSaveShowNewTrip(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Plus size={15} strokeWidth={2} className="text-gray-600" />
                  </div>
                  New trip
                </button>
              )}
            </div>

            {/* Remove from Saved */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  const uid = appUser?.id;
                  const placeIds = showPostSaveSheet?.placeIds;
                  if (!uid || !placeIds) return;
                  for (const placeId of placeIds) {
                    await unsavePlace(uid, placeId);
                    setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(placeId); return n; });
                  }
                  setShowPostSaveSheet(null);
                  setPostSaveSheetColIds(new Set());
                  setPostSavePlanAdded(new Set());
                  setPostSaveShowNewTrip(false);
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

      {/* Guide → Save to Collection sheet */}
      {guideColSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }} onClick={() => { setGuideColSheet(null); setGuideColIds(new Set()); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
              {userCollections.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No collections yet — create one below</p>
              )}
              {userCollections.map(col => {
                const inCol = guideColIds.has(col.id);
                return (
                  <button key={col.id} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                    onClick={async () => {
                      const uid = appUser?.id; if (!uid) return;
                      if (inCol) {
                        setGuideColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        await removeGuideFromCollection(col.id, guideColSheet.id);
                        // unsubscribe only if in no collections now
                        const remaining = new Set(guideColIds); remaining.delete(col.id);
                        if (remaining.size === 0) { unsubscribeFromGuide(uid, guideColSheet.id); setSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(guideColSheet.id); return n; }); }
                      } else {
                        setGuideColIds(prev => new Set(prev).add(col.id));
                        await addGuideToCollection(col.id, guideColSheet.id, uid);
                        // auto-subscribe so it appears in Guides tab
                        if (!subscribedGuideIds.has(guideColSheet.id)) {
                          subscribeToGuide(uid, guideColSheet.id);
                          setSubscribedGuideIds(prev => new Set(prev).add(guideColSheet.id));
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
              <button onClick={() => { setActiveSheetContext(null); setShowNewColSheet(true); }} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>
            <div className="mx-4 border-t border-gray-100" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  const uid = appUser?.id;
                  if (!uid || !guideColSheet) return;
                  unsubscribeFromGuide(uid, guideColSheet.id);
                  setSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(guideColSheet.id); return n; });
                  setGuideColSheet(null);
                  setGuideColIds(new Set());
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
        <div className="fixed inset-0 z-[310] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNewColSheet(false); setNewColSheetName(''); setNewColSheetDesc(''); setNewColSheetCoverUrl(null); }} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                disabled={!newColSheetName.trim() || newColSheetSaving || newColSheetCoverUploading}
                onClick={async () => {
                  if (!newColSheetName.trim() || !appUser) return;
                  setNewColSheetSaving(true);
                  try {
                    const { data, error } = await createCollection(appUser.id, { name: newColSheetName.trim(), emoji: '', description: newColSheetDesc.trim(), cover_image_url: newColSheetCoverUrl });
                    if (!error && data) {
                      if (activeSheetContext === 'place' && addToColPlace) {
                        await addPlaceToCollection(data.id, addToColPlace.id);
                        setPlaceInCollections(prev => new Set(prev).add(data.id));
                        setUserCollections(prev => [{ ...data, placesCount: 1 }, ...prev]);
                      } else if (activeSheetContext === 'post' && showPostSaveSheet) {
                        const placeIds = showPostSaveSheet.placeIds;
                        for (const placeId of placeIds) {
                          await addPlaceToCollection(data.id, placeId);
                        }
                        setUserCollections(prev => [{ ...data, placesCount: placeIds.length }, ...prev]);
                        setPostSaveSheetColIds(prev => new Set(prev).add(data.id));
                      } else {
                        setUserCollections(prev => [{ ...data, placesCount: 0 }, ...prev]);
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
                  const file = e.target.files?.[0]; if (!file || !appUser) return;
                  setNewColSheetCoverUploading(true);
                  const path = `collections/${appUser.id}/${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
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

      {/* Share bottom sheet */}
      {showSharePostId && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (shareLinkCopiedTimerRef.current) clearTimeout(shareLinkCopiedTimerRef.current); setShowSharePostId(null); setSharePostSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); setHomeShareLinkCopied(false); }} />
          <div className="relative bg-white rounded-t-3xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { if (shareLinkCopiedTimerRef.current) clearTimeout(shareLinkCopiedTimerRef.current); setShowSharePostId(null); setSharePostSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); setHomeShareLinkCopied(false); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
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
                    if (shareSearchRef.current) clearTimeout(shareSearchRef.current);
                    if (!q.trim()) { setShareSearchResults([]); setSearchingShare(false); return; }
                    setSearchingShare(true);
                    shareSearchRef.current = setTimeout(async () => {
                      const uid = appUser?.id; if (!uid) return;
                      // BUG-25: restrict search to followers of current user
                      const results = await searchProfiles(q, uid, uid);
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
              const list = showSearch ? shareSearchResults : conversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl, convId: c.id }));
              if (showSearch && shareSearchResults.length === 0 && !searchingShare) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              }
              if (!showSearch && conversations.length === 0) {
                return (
                  <p className="text-sm text-gray-400 text-center py-4 px-5">
                    Search to find people to share with
                  </p>
                );
              }
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const personId = person.id;
                    const sent = sharePostSentTo.has(personId);
                    const isSending = sendingShareTo === personId; // BUG-28
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={personId}
                        disabled={isSending}
                        onClick={async () => {
                          if (sent || !appUser?.id) return; // BUG-50
                          setSendingShareTo(personId); // BUG-28
                          try {
                            const convId = await getOrCreateConversation(appUser.id, personId);
                            if (convId) {
                              const url = `${window.location.origin}/post/${showSharePostId}`;
                              await sendMessage(convId, appUser.id, `Check this out on sondrr: ${url}`);
                              setSharePostSentTo(prev => new Set(prev).add(personId));
                            }
                          } finally {
                            setSendingShareTo(null);
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
                        <div className={`px-5 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${sent ? 'bg-gray-100 text-gray-400' : isSending ? 'bg-gray-300 text-gray-500' : 'bg-gray-900 text-white'}`}>
                          {isSending ? '…' : sent ? 'Sent ✓' : 'Send'}
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
                  const url = `${window.location.origin}/post/${showSharePostId}`;
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
                  navigator.clipboard.writeText(`${window.location.origin}/post/${showSharePostId}`).catch(() => {});
                  // FIX 22: clear previous timer before setting new one
                  if (shareLinkCopiedTimerRef.current) clearTimeout(shareLinkCopiedTimerRef.current);
                  setHomeShareLinkCopied(true);
                  shareLinkCopiedTimerRef.current = setTimeout(() => { setHomeShareLinkCopied(false); }, 1500);
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {homeShareLinkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                </div>
                <span className="text-sm font-semibold text-gray-900">{homeShareLinkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guide share bottom sheet */}
      {showShareGuideId && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowShareGuideId(null); setGuideShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} />
          <div className="relative bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowShareGuideId(null); setGuideShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={shareSearchQuery}
                  onChange={e => {
                    const q = e.target.value;
                    setShareSearchQuery(q);
                    if (shareSearchRef.current) clearTimeout(shareSearchRef.current);
                    if (!q.trim()) { setShareSearchResults([]); setSearchingShare(false); return; }
                    setSearchingShare(true);
                    shareSearchRef.current = setTimeout(async () => {
                      const uid = appUser?.id; if (!uid) return;
                      const results = await searchProfiles(q, uid, uid);
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
            {(() => {
              const showSearch = shareSearchQuery.trim().length > 0;
              const list = showSearch ? shareSearchResults : conversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && shareSearchResults.length === 0 && !searchingShare) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              }
              if (!showSearch && conversations.length === 0) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">Search to find people to share with</p>;
              }
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const personId = person.id;
                    const sent = guideShareSentTo.has(personId);
                    const isSending = sendingShareTo === personId;
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={personId}
                        disabled={isSending}
                        onClick={async () => {
                          if (sent || !appUser?.id || !showShareGuideId) return;
                          setSendingShareTo(personId);
                          try {
                            const convId = await getOrCreateConversation(appUser.id, personId);
                            if (convId) {
                              const url = `${window.location.origin}?guide=${showShareGuideId}`;
                              await sendMessage(convId, appUser.id, `Check out this guide on sondrr: ${url}`);
                              setGuideShareSentTo(prev => new Set(prev).add(personId));
                              getConversations(appUser.id).then(setConversations).catch(() => {});
                            }
                          } catch { /* silent */ } finally {
                            setSendingShareTo(null);
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
                        <div className={`px-5 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${sent ? 'bg-gray-100 text-gray-400' : isSending ? 'bg-gray-300 text-gray-500' : 'bg-gray-900 text-white'}`}>
                          {isSending ? '…' : sent ? 'Sent ✓' : 'Send'}
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
                  const url = `${window.location.origin}?guide=${showShareGuideId}`;
                  if (navigator.share) {
                    try { await navigator.share({ url, title: 'Check out this guide on sondrr' }); } catch {}
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
                  navigator.clipboard.writeText(`${window.location.origin}?guide=${showShareGuideId}`).catch(() => {});
                  setShowShareGuideId(null);
                  setGuideShareSentTo(new Set());
                  setShareSearchQuery('');
                  setShareSearchResults([]);
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Copy size={16} strokeWidth={1.5} className="text-gray-700" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Copy link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPlacePage && (
        <ErrorBoundary fallback={null} key={selectedPlacePage.id}>
          <PlacePage
            place={selectedPlacePage}
            appUser={appUser}
            onClose={() => setSelectedPlacePage(null)}
            isSaved={allSavedPlaceIds.has(selectedPlacePage.id)}
            onToggleSave={async () => {
              if (!appUser?.id || !selectedPlacePage) return;
              if (allSavedPlaceIds.has(selectedPlacePage.id)) {
                // Unsave: optimistic remove
                setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(selectedPlacePage.id); return n; });
                const ok = await unsavePlace(appUser.id, selectedPlacePage.id);
                if (!ok) setAllSavedPlaceIds(prev => new Set(prev).add(selectedPlacePage.id));
              } else {
                // Save: optimistic add, then open the collection sheet
                setAllSavedPlaceIds(prev => new Set(prev).add(selectedPlacePage.id));
                const ok = await savePlace(appUser.id, selectedPlacePage.id);
                if (!ok) {
                  setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(selectedPlacePage.id); return n; });
                } else {
                  setPlaceInCollections(new Set());
                  setLoadingPlaceCollections(true);
                  setShowSharePostId(null);
                  setShowPostSaveSheet(null);
                  setAddToColPlace({ id: selectedPlacePage.id, name: selectedPlacePage.name });
                  setActiveSheetContext('place');
                  setPostSavePlanAdded(new Set());
                  setPostSaveShowNewTrip(false);
                  setPostSaveNewTripName('');
                  if (appUser?.id) getPlans(appUser.id).then(setPostSavePlans);
                  try {
                    const colIds = await getPlaceCollectionIds(selectedPlacePage.id);
                    setPlaceInCollections(colIds);
                  } finally {
                    setLoadingPlaceCollections(false);
                  }
                }
              }
            }}
            onViewUser={(userId) => { setSelectedPlacePage(null); setViewingUserId(userId); }}
            onSelectPlace={(p) => setSelectedPlacePage(p)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
