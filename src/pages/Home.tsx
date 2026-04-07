import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, MapPin, ArrowLeft, Bookmark, BookmarkCheck, Map, X, Mail, Check, Copy, Users, Plus, Search } from 'lucide-react';
import type { Tab } from '../types/index';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import type { AppUser } from '../types';
import ImageCarousel from '../components/ImageCarousel';
import PlacePage from '../components/PlacePage';
import ErrorBoundary from '../components/ErrorBoundary';
import { supabase, getFeedPosts, getLikedPosts, getSavedPosts, likePost, unlikePost, savePost, unsavePost, getPostLikeCounts, getUserCollections, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, getOrCreateConversation, getConversations, sendMessage, getMessages, deleteConversation, geocodeMissingPlaces, getPostComments, addComment, savePlace, unsavePlace, getSavedPlaceIds, searchProfiles, createCollection, getGuides, type RealPost, type RealPostPlace, type RealCollection, type Conversation, type Message, type PostComment, type FollowProfile, type Guide } from '../lib/supabase';
import GuideDetail from '../components/GuideDetail';
import CreateGuideSheet from '../components/CreateGuideSheet';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

const MapView = lazy(() => import('../components/MapView'));

interface Props {
  showMessages?: boolean;
  messagesTargetUserId?: string;
  onMessagesClose?: () => void;
  isNewUser?: boolean;
  appUser?: AppUser;
  onNavigate?: (tab: Tab) => void;
}

export default function Home({ showMessages = false, messagesTargetUserId, onMessagesClose, isNewUser, appUser, onNavigate }: Props) {
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
  const [realPosts, setRealPosts] = useState<RealPost[]>([]);
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [likedRealPosts, setLikedRealPosts] = useState<Set<string>>(new Set());
  const [savedRealPosts, setSavedRealPosts] = useState<Set<string>>(new Set());
  const [realPostLikeCounts, setRealPostLikeCounts] = useState<Record<string, number>>({});
  const [userCollections, setUserCollections] = useState<RealCollection[]>([]);
  const [expandedPlacesPostId, setExpandedPlacesPostId] = useState<string | null>(null);
  const [mapOpenPostId, setMapOpenPostId] = useState<string | null>(null);
  const [geocodingPostId, setGeocodingPostId] = useState<string | null>(null);
  const [addToColPlace, setAddToColPlace] = useState<{ id: string; name: string } | null>(null);
  const [placeInCollections, setPlaceInCollections] = useState<Set<string>>(new Set());
  const [loadingPlaceCollections, setLoadingPlaceCollections] = useState(false);
  const [showCommentsPostId, setShowCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, PostComment[]>>({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [homeCommentText, setHomeCommentText] = useState('');
  const [showPostSaveSheet, setShowPostSaveSheet] = useState<{ postId: string; placeIds: string[] } | null>(null);
  const [postSaveSheetColIds, setPostSaveSheetColIds] = useState<Set<string>>(new Set());
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [savingNewCol, setSavingNewCol] = useState(false);
  const [showSharePostId, setShowSharePostId] = useState<string | null>(null);
  const [sharePostSentTo, setSharePostSentTo] = useState<Set<string>>(new Set());
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareSearchResults, setShareSearchResults] = useState<FollowProfile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);
  const [homeShareLinkCopied, setHomeShareLinkCopied] = useState(false);
  const shareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allSavedPlaceIds, setAllSavedPlaceIds] = useState<Set<string>>(new Set());
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});
  const [feedGuides, setFeedGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [inboxSearch, setInboxSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatResults, setNewChatResults] = useState<FollowProfile[]>([]);
  const [searchingNewChat, setSearchingNewChat] = useState(false);
  const [convToDelete, setConvToDelete] = useState<string | null>(null);
  const [swipedConvId, setSwipedConvId] = useState<string | null>(null);
  const [favoriteConvIds, setFavoriteConvIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('curio_fav_convs') ?? '[]')); }
    catch { return new Set(); }
  });
  const swipeTouchRef = useRef<{ x: number; id: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newChatSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch guides for feed
  useEffect(() => { getGuides().then(setFeedGuides); }, []);

  // Fetch real posts from Supabase on mount + re-fetch when any post is updated
  useEffect(() => {
    getFeedPosts().then(async posts => {
      setRealPosts(posts);
      if (posts.length > 0) {
        getPostLikeCounts(posts.map(p => p.id)).then(setRealPostLikeCounts);
        // Geocode any places missing coordinates, then update state immediately
        const allPlaces = posts.flatMap(p => p.places);
        const missing = allPlaces.filter(pl => pl.lat == null || pl.lng == null);
        if (missing.length > 0) {
          const geocoded = await geocodeMissingPlaces(allPlaces, GOOGLE_PLACES_KEY);
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
    });
    const channel = supabase
      .channel('feed-post-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => {
        getFeedPosts().then(posts => {
          setRealPosts(posts);
          if (posts.length > 0) getPostLikeCounts(posts.map(p => p.id)).then(setRealPostLikeCounts);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!appUser || appUser.isDemo) return;
    getLikedPosts(appUser.id).then(setLikedRealPosts);
    getSavedPosts(appUser.id).then(setSavedRealPosts);
    getUserCollections(appUser.id).then(setUserCollections);
    getSavedPlaceIds(appUser.id).then(setAllSavedPlaceIds);
    // Load conversations proactively for the share sheet
    getConversations(appUser.id).then(setConversations);
  }, [appUser]);

  // Load conversations when inbox opens
  useEffect(() => {
    if (!showInbox || !appUser?.id || appUser.isDemo) return;
    setLoadingConversations(true);
    getConversations(appUser.id).then(convs => {
      setConversations(convs);
      setLoadingConversations(false);
    });
  }, [showInbox, appUser?.id]);

  // Auto-open conversation with a specific user when messagesTargetUserId is set
  useEffect(() => {
    if (!messagesTargetUserId || !appUser?.id || appUser.isDemo) return;
    setShowInbox(true);
    getOrCreateConversation(appUser.id, messagesTargetUserId).then(async convId => {
      if (!convId) return;
      // Get other user profile
      const { data: prof } = await supabase.from('profiles').select('id, name, username, avatar_url').eq('id', messagesTargetUserId).single();
      setActiveConversationUser(prof ? { id: prof.id, name: prof.name ?? '', username: prof.username ?? '', avatarUrl: prof.avatar_url ?? null } : null);
      setActiveConversationId(convId);
    });
  }, [messagesTargetUserId, appUser?.id]);

  // Load messages + real-time subscription when a conversation is opened
  useEffect(() => {
    if (!activeConversationId) return;
    setLoadingMessages(true);
    getMessages(activeConversationId).then(msgs => {
      setMessages(msgs);
      setLoadingMessages(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` }, (payload) => {
        const m = payload.new as any;
        if (m.sender_id !== appUser?.id) {
          setMessages(prev => [...prev, { id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, text: m.text, createdAt: m.created_at }]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversationId]);

  const handleSendMessage = async () => {
    if (!activeConversationId || !messageText.trim() || !appUser?.id) return;
    const text = messageText.trim();
    setMessageText('');
    const sent = await sendMessage(activeConversationId, appUser.id, text);
    if (sent) {
      setMessages(prev => [...prev, sent]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, lastMessage: { text, senderId: appUser.id, createdAt: sent.createdAt }, unread: false } : c));
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
      <div className="bg-white min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => { setActiveConversationId(null); setActiveConversationUser(null); setMessages([]); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          {chatUser?.avatarUrl
            ? <img src={chatUser.avatarUrl} alt={chatUser.name} className="w-8 h-8 rounded-full object-cover object-top" />
            : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{initials || '?'}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{chatUser?.name}</p>
            <p className="text-xs text-gray-400">@{chatUser?.username}</p>
          </div>
        </div>
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
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-2">
          <input
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Message…"
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-gray-400"
            autoFocus
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${messageText.trim() ? 'bg-gray-900' : 'bg-gray-200'}`}
          >
            <Send size={15} strokeWidth={1.5} className={messageText.trim() ? 'text-white' : 'text-gray-400'} />
          </button>
        </div>
      </div>
    );
  }

  // ── Find People ──────────────────────────────────────────────────
  if (showFindPeople) {
    return (
      <FindPeople
        currentUserId={appUser?.id ?? ''}
        onBack={() => setShowFindPeople(false)}
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
        localStorage.setItem('curio_fav_convs', JSON.stringify([...next]));
        return next;
      });
      setSwipedConvId(null);
    };

    const handleDeleteConv = async (convId: string) => {
      await deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      setConvToDelete(null);
      setSwipedConvId(null);
    };

    const baseConvs = inboxSearch.trim()
      ? conversations.filter(c => c.otherUser.name.toLowerCase().includes(inboxSearch.toLowerCase()) || c.otherUser.username.toLowerCase().includes(inboxSearch.toLowerCase()))
      : conversations;

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
              onClick={() => { setShowNewChat(true); setNewChatSearch(''); setNewChatResults([]); }}
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
          <p className="text-center text-xs text-gray-400 py-10">No conversations found</p>
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
                        {conv.unread && <div className="w-2 h-2 rounded-full bg-gray-900 flex-shrink-0" />}
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
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewChat(false)} />
            <div className="relative bg-white rounded-t-3xl" style={{ maxHeight: '85vh' }}>
              <div className="px-4 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => setShowNewChat(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                    <X size={14} strokeWidth={2} className="text-gray-700" />
                  </button>
                  <p className="text-sm font-bold text-gray-900 flex-1">New message</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                  <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    value={newChatSearch}
                    onChange={e => {
                      const q = e.target.value;
                      setNewChatSearch(q);
                      if (newChatSearchRef.current) clearTimeout(newChatSearchRef.current);
                      if (!q.trim()) { setNewChatResults([]); return; }
                      setSearchingNewChat(true);
                      newChatSearchRef.current = setTimeout(async () => {
                        const results = await searchProfiles(q, appUser?.id ?? '');
                        setNewChatResults(results);
                        setSearchingNewChat(false);
                      }, 300);
                    }}
                    placeholder="Search people…"
                    className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
                {searchingNewChat && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                  </div>
                )}
                {!searchingNewChat && newChatSearch && newChatResults.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">No people found</p>
                )}
                {!searchingNewChat && !newChatSearch && (
                  <p className="text-center text-xs text-gray-400 py-8">Search for someone to message</p>
                )}
                {newChatResults.map(user => {
                  const ini = user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={user.id}
                      onClick={async () => {
                        if (!appUser?.id) return;
                        const convId = await getOrCreateConversation(appUser.id, user.id);
                        if (!convId) return;
                        setShowNewChat(false);
                        setActiveConversationUser({ id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl });
                        setActiveConversationId(convId);
                        // Refresh conversations list
                        getConversations(appUser.id).then(setConversations);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
                    >
                      {user.avatarUrl
                        ? <img src={user.avatarUrl} alt={user.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{ini}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400">@{user.username}</p>
                      </div>
                    </button>
                  );
                })}
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
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">curio</h1>
        <button
          onClick={() => setShowInbox(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
        >
          <Mail size={17} strokeWidth={1.5} className="text-gray-700" />
        </button>
      </div>

      {/* Feed — vertical scroll */}
      <div className="pt-3 pb-8">

        {/* Empty state */}
        {isNewUser && realPosts.length === 0 && (
          <div className="px-5 pt-8 pb-6">
            <div className="mb-6">
              <p className="text-slate-800 font-bold text-lg mb-1">Welcome{appUser?.name ? `, ${appUser.name.split(' ')[0]}` : ''}</p>
              <p className="text-slate-400 text-sm">Here's how to get started on curio</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => setShowFindPeople(true)} className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"><Users size={20} strokeWidth={1.5} className="text-white" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">Find people to follow</p><p className="text-xs text-slate-400 mt-0.5">Discover travellers with great taste</p></div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => onNavigate?.('add')} className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"><Plus size={20} strokeWidth={1.5} className="text-white" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">Share your first place</p><p className="text-xs text-slate-400 mt-0.5">Post a restaurant, hotel, or spot you love</p></div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {[
          ...realPosts.map(p => ({ type: 'post' as const, id: p.id, ts: new Date(p.createdAt).getTime(), data: p })),
          ...feedGuides.map(g => ({ type: 'guide' as const, id: g.id, ts: new Date(g.publishedAt).getTime(), data: g })),
        ].sort((a, b) => b.ts - a.ts).map(item => {
          if (item.type === 'guide') {
            const guide = item.data;
            const timeAgo = (() => {
              const diff = Date.now() - item.ts;
              const mins = Math.floor(diff / 60000);
              if (mins < 60) return `${mins}m`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h`;
              return `${Math.floor(hrs / 24)}d`;
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
                      <div className="flex items-center gap-2">
                        {guide.profile.avatarUrl
                          ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-8 h-8 rounded-full object-cover border border-white/30" />
                          : <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{guide.profile.name[0]?.toUpperCase()}</div>
                        }
                        <span className="text-white text-sm font-semibold drop-shadow">{guide.profile.username || guide.profile.name}</span>
                      </div>
                      <span className="text-white/70 text-xs drop-shadow">{timeAgo}</span>
                    </div>
                    {/* Guide badge + title bottom */}
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                      <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 inline-block mb-1.5">📖 Guide</span>
                      <h3 className="text-white text-xl font-black leading-tight drop-shadow">{guide.title}</h3>
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
                  </div>
                </button>
              </div>
            );
          }

          const post = item.data;
          const images = post.places.map(p => p.photoUrl).filter(Boolean) as string[];
          if (!images.length) return null;
          const placeLabels = post.places.map(p => p.name.split(',')[0].trim());
          const placeSublabels = post.places.map(p => [p.neighborhood, p.city].filter(Boolean).join(', ') || p.country);
          const timeAgo = (() => {
            const diff = Date.now() - new Date(post.createdAt).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `${mins}m`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h`;
            return `${Math.floor(hrs / 24)}d`;
          })();
          const avatarSrc = post.profile.avatarUrl ?? '/aitana-avatar.jpg';
          const isLiked = likedRealPosts.has(post.id);
          const allPlacesSaved = post.places.length > 0 && post.places.every(p => allSavedPlaceIds.has(p.id));
          const commentCount = commentsMap[post.id]?.length ?? 0;
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
                    <img src={avatarSrc} alt={post.profile.name} className="w-8 h-8 rounded-full object-cover object-top border border-white/30" />
                    <span className="text-white text-sm font-semibold drop-shadow">{post.profile.username || post.profile.name}</span>
                  </button>
                  <span className="text-white/70 text-xs drop-shadow">{timeAgo}</span>
                </div>
                {/* Carousel with place name labels + dots */}
                <ImageCarousel
                  images={images}
                  labels={placeLabels}
                  sublabels={placeSublabels}
                  onIndexChange={(i) => setCarouselIndex(prev => ({ ...prev, [post.id]: i }))}
                  onClick={() => {
                    const idx = carouselIndex[post.id] ?? 0;
                    const placesWithPhotos = post.places.filter(p => p.photoUrl);
                    setSelectedPlacePage(placesWithPhotos[idx] ?? post.places[0]);
                  }}
                />
              </div>

              {/* ── Info strip below card ── */}
              <div className="mx-7 pt-3">
                {/* Actions row */}
                <div className="flex items-center gap-4">
                  <button
                    className="flex items-center gap-1.5 active:scale-90 transition-transform"
                    onClick={() => {
                      if (!appUser || appUser.isDemo) return;
                      setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.delete(post.id) : n.add(post.id); return n; });
                      setRealPostLikeCounts(prev => ({ ...prev, [post.id]: (prev[post.id] ?? 0) + (isLiked ? -1 : 1) }));
                      isLiked ? unlikePost(appUser.id, post.id) : likePost(appUser.id, post.id);
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
                        setLoadingComments(true);
                        const comments = await getPostComments(post.id);
                        setCommentsMap(prev => ({ ...prev, [post.id]: comments }));
                        setLoadingComments(false);
                      }
                    }}
                  >
                    <MessageCircle size={20} strokeWidth={1.5} className="text-gray-600" />
                    {commentCount > 0 && <span className="text-sm text-gray-600">{commentCount}</span>}
                  </button>
                  <button className="active:scale-90 transition-transform" onClick={() => setShowSharePostId(showSharePostId === post.id ? null : post.id)}>
                    <Send size={20} strokeWidth={1.5} className="text-gray-600" />
                  </button>
                  <button
                    className="ml-auto active:scale-90 transition-transform"
                    onClick={async () => {
                      if (!appUser || appUser.isDemo) return;
                      if (allPlacesSaved) {
                        for (const p of post.places) { setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; }); unsavePlace(appUser.id, p.id); }
                      } else {
                        for (const p of post.places) { setAllSavedPlaceIds(prev => new Set(prev).add(p.id)); savePlace(appUser.id, p.id); }
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
                    {loadingComments && <p className="text-xs text-gray-400 py-2">Loading…</p>}
                    {(commentsMap[post.id] ?? []).map(c => (
                      <div key={c.id} className="flex items-start gap-2 mb-2">
                        {c.profile.avatarUrl
                          ? <img src={c.profile.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                          : <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400 mt-0.5">{c.profile.name?.[0]}</div>}
                        <div>
                          <span className="text-xs font-semibold text-gray-900">{c.profile.name} </span>
                          <span className="text-xs text-gray-600">{c.text}</span>
                        </div>
                      </div>
                    ))}
                    {appUser && !appUser.isDemo && (
                      <div className="flex items-center gap-2 mt-2">
                        <input value={homeCommentText} onChange={e => setHomeCommentText(e.target.value)}
                          placeholder="Add a comment…" className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none"
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && homeCommentText.trim()) {
                              const text = homeCommentText.trim(); setHomeCommentText('');
                              const saved = await addComment(appUser.id, post.id, text);
                              if (saved) setCommentsMap(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), saved] }));
                            }
                          }} />
                        <button onClick={async () => {
                          if (!homeCommentText.trim() || !appUser) return;
                          const text = homeCommentText.trim(); setHomeCommentText('');
                          const saved = await addComment(appUser.id, post.id, text);
                          if (saved) setCommentsMap(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), saved] }));
                        }} className="text-xs font-semibold text-white px-3 py-2 bg-gray-900 rounded-xl">Post</button>
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
                          if (!appUser || appUser.isDemo) return;
                          if (isSavedPlace) {
                            setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                            unsavePlace(appUser.id, p.id);
                          } else {
                            setAllSavedPlaceIds(prev => new Set(prev).add(p.id));
                            savePlace(appUser.id, p.id);
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

      {/* Guide detail overlay */}
      {selectedGuide && (
        <GuideDetail
          guide={selectedGuide}
          currentUserId={appUser?.id}
          onClose={() => setSelectedGuide(null)}
          onEditGuide={() => { setEditingGuide(selectedGuide); setSelectedGuide(null); }}
          onPlaceClick={(place) => setSelectedPlacePage(place)}
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
                        if (inCol) {
                          await removePlaceFromCollection(col.id, addToColPlace.id);
                          setPlaceInCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                          setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - 1) } : c));
                        } else {
                          await addPlaceToCollection(col.id, addToColPlace.id);
                          setPlaceInCollections(prev => new Set(prev).add(col.id));
                          setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + 1 } : c));
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
            <div className="px-4 pt-3 pb-8">
              {showNewColInput ? (
                <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2.5">
                  <input
                    autoFocus
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newColName.trim() && appUser) {
                        setSavingNewCol(true);
                        const { data, error } = await createCollection(appUser.id, { name: newColName.trim(), emoji: '', description: '', cover_image_url: null });
                        if (!error && data) {
                          await addPlaceToCollection(data.id, addToColPlace.id);
                          setUserCollections(prev => [{ ...data, placesCount: 1 }, ...prev]);
                          setPlaceInCollections(prev => new Set(prev).add(data.id));
                        }
                        setSavingNewCol(false);
                        setShowNewColInput(false);
                        setNewColName('');
                      }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 text-sm text-gray-900 bg-transparent outline-none placeholder-gray-400"
                  />
                  <button
                    disabled={!newColName.trim() || savingNewCol}
                    onClick={async () => {
                      if (!newColName.trim() || !appUser) return;
                      setSavingNewCol(true);
                      const { data, error } = await createCollection(appUser.id, { name: newColName.trim(), emoji: '', description: '', cover_image_url: null });
                      if (!error && data) {
                        await addPlaceToCollection(data.id, addToColPlace.id);
                        setUserCollections(prev => [{ ...data, placesCount: 1 }, ...prev]);
                        setPlaceInCollections(prev => new Set(prev).add(data.id));
                      }
                      setSavingNewCol(false);
                      setShowNewColInput(false);
                      setNewColName('');
                    }}
                    className="text-xs font-bold text-gray-900 disabled:opacity-40"
                  >
                    {savingNewCol ? '…' : 'Create'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewColInput(true)}
                  className="w-full flex items-center gap-3 py-2 text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={18} strokeWidth={2} className="text-gray-500" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">New collection</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save-all-places-to-collection sheet */}
      {showPostSaveSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowPostSaveSheet(null); setPostSaveSheetColIds(new Set()); setShowNewColInput(false); setNewColName(''); }} />
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
                      if (inCol) {
                        for (const placeId of showPostSaveSheet.placeIds) {
                          await removePlaceFromCollection(col.id, placeId);
                        }
                        setPostSaveSheetColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: Math.max(0, c.placesCount - showPostSaveSheet.placeIds.length) } : c));
                      } else {
                        for (const placeId of showPostSaveSheet.placeIds) {
                          await addPlaceToCollection(col.id, placeId);
                        }
                        setPostSaveSheetColIds(prev => new Set(prev).add(col.id));
                        setUserCollections(prev => prev.map(c => c.id === col.id ? { ...c, placesCount: c.placesCount + showPostSaveSheet.placeIds.length } : c));
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
            <div className="px-4 pt-3">
              {showNewColInput ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newColName.trim() && appUser) {
                        setSavingNewCol(true);
                        const { data, error } = await createCollection(appUser.id, { name: newColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingNewCol(false);
                        if (!error && data) {
                          setUserCollections(prev => [data, ...prev]);
                          setNewColName('');
                          setShowNewColInput(false);
                        }
                      }
                      if (e.key === 'Escape') { setShowNewColInput(false); setNewColName(''); }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none"
                  />
                  <button
                    disabled={!newColName.trim() || savingNewCol}
                    onClick={async () => {
                      if (!newColName.trim() || !appUser) return;
                      setSavingNewCol(true);
                      const { data, error } = await createCollection(appUser.id, { name: newColName.trim(), emoji: '', description: '', cover_image_url: null });
                      setSavingNewCol(false);
                      if (!error && data) { setUserCollections(prev => [data, ...prev]); setNewColName(''); setShowNewColInput(false); }
                    }}
                    className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {savingNewCol ? '…' : 'Create'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewColInput(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
                >
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

      {/* Share bottom sheet */}
      {showSharePostId && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowSharePostId(null); setSharePostSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} />
          <div className="relative bg-white rounded-t-3xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowSharePostId(null); setSharePostSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
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
                      if (!appUser) return;
                      const results = await searchProfiles(q, appUser.id);
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
              if (!showSearch && conversations.length === 0) return null;
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const personId = person.id;
                    const sent = sharePostSentTo.has(personId);
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={personId}
                        onClick={async () => {
                          if (sent || !appUser) return;
                          const convId = await getOrCreateConversation(appUser.id, personId);
                          if (convId) {
                            const url = `${window.location.origin}/post/${showSharePostId}`;
                            await sendMessage(convId, appUser.id, `Check this out on curio: ${url}`);
                            setSharePostSentTo(prev => new Set(prev).add(personId));
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
                  const url = `${window.location.origin}/post/${showSharePostId}`;
                  if (navigator.share) {
                    try { await navigator.share({ url, title: 'Check this out on curio' }); } catch {}
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
                  setHomeShareLinkCopied(true);
                  setTimeout(() => { setHomeShareLinkCopied(false); }, 1500);
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
                setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(selectedPlacePage.id); return n; });
                await unsavePlace(appUser.id, selectedPlacePage.id);
              } else {
                setAllSavedPlaceIds(prev => new Set(prev).add(selectedPlacePage.id));
                await savePlace(appUser.id, selectedPlacePage.id);
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
