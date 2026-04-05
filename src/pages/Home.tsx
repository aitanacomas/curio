import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, MapPin, ArrowLeft, Bookmark, BookmarkCheck, Map, X, Mail, Check, Copy, Users, Plus, Search } from 'lucide-react';
import type { Tab } from '../types/index';
import FindPeople from './FindPeople';
import UserProfile from './UserProfile';
import type { AppUser } from '../types';
import ImageCarousel from '../components/ImageCarousel';
import PlacePage from '../components/PlacePage';
import { supabase, getFeedPosts, getLikedPosts, getSavedPosts, likePost, unlikePost, savePost, unsavePost, getPostLikeCounts, getUserCollections, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, getOrCreateConversation, getConversations, sendMessage, getMessages, geocodeMissingPlaces, getPostComments, addComment, savePlace, unsavePlace, getSavedPlaceIds, searchProfiles, createCollection, type RealPost, type RealPostPlace, type RealCollection, type Conversation, type Message, type PostComment, type FollowProfile } from '../lib/supabase';

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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loadingMessages && <p className="text-center text-xs text-gray-400 py-8">Loading…</p>}
          {!loadingMessages && messages.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-12">No messages yet — say hello!</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.senderId === appUser?.id;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                {!isMine && (
                  chatUser?.avatarUrl
                    ? <img src={chatUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-0.5" />
                    : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0 mb-0.5">{initials || '?'}</div>
                )}
                <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-snug ${isMine ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                  {msg.text}
                </div>
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
    return (
      <div className="bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => { setShowInbox(false); onMessagesClose?.(); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">Messages</h2>
        </div>
        {loadingConversations && (
          <div className="space-y-0 divide-y divide-gray-50">
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
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Send size={22} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">No messages yet</p>
            <p className="text-xs text-gray-400 leading-relaxed">Tap the chat icon on someone's profile to start a conversation.</p>
          </div>
        )}
        <div className="divide-y divide-gray-50">
          {conversations.map(conv => {
            const u = conv.otherUser;
            const ini = u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <button
                key={conv.id}
                onClick={async () => {
                  setActiveConversationUser(u);
                  setActiveConversationId(conv.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
              >
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">{ini || '?'}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm ${conv.unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>{u.name}</p>
                    {conv.unread && <div className="w-2 h-2 rounded-full bg-gray-900 flex-shrink-0" />}
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${conv.unread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {conv.lastMessage ? conv.lastMessage.text : 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Feed View ────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
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

      {/* Feed */}
      <div className="bg-slate-50 space-y-3 px-3 pt-3 pb-8">
        {/* Real posts from Supabase */}
        {realPosts.map(post => {
          const images = post.places.map(p => p.photoUrl).filter(Boolean);
          const firstPlace = post.places[0];
          if (!images.length || !firstPlace) return null;
          const sn = (name: string) => name.split(',')[0].trim();
          const locationLabel = post.locationLabel || (post.places.length === 1
            ? `${sn(firstPlace.name)} · ${firstPlace.city}`
            : `${sn(firstPlace.name)} +${post.places.length - 1} · ${firstPlace.city}`);
          const timeAgo = (() => {
            const diff = Date.now() - new Date(post.createdAt).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `${mins}m`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h`;
            return `${Math.floor(hrs / 24)}d`;
          })();
          const avatarSrc = post.profile.avatarUrl ?? '/aitana-avatar.jpg';
          const isSaved = savedRealPosts.has(post.id);
          const isLiked = likedRealPosts.has(post.id);
          return (
            <div key={post.id} className="bg-white rounded-3xl overflow-hidden">
              {/* Photo with overlaid profile info */}
              <div className="relative">
                <ImageCarousel
                  images={images}
                  labels={post.places.map(p => p.name.split(',')[0].trim())}
                  sublabels={post.places.map(p => [p.city, p.country].filter(Boolean).join(', '))}
                />
                {/* Profile overlay — top left (owner + collaborators) */}
                <button
                  onClick={() => setViewingUserId(post.userId)}
                  className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/25 backdrop-blur-md rounded-full pl-1 pr-3 py-1 active:opacity-75"
                >
                  <img src={avatarSrc} alt={post.profile.name} className="w-6 h-6 rounded-full object-cover object-top border border-white/40 flex-shrink-0" />
                  {(post.collaborators ?? []).slice(0, 2).map(c => (
                    c.avatarUrl
                      ? <img key={c.id} src={c.avatarUrl} alt={c.name} className="-ml-2 w-6 h-6 rounded-full object-cover border border-white/40 flex-shrink-0" />
                      : <div key={c.id} className="-ml-2 w-6 h-6 rounded-full bg-white/20 border border-white/40 flex items-center justify-center flex-shrink-0"><span className="text-white text-[9px] font-bold">{c.name[0]?.toUpperCase()}</span></div>
                  ))}
                  <span className="text-white text-xs font-semibold leading-none ml-0.5">
                    {(post.collaborators ?? []).length > 0
                      ? `${post.profile.username || post.profile.name} & ${(post.collaborators ?? []).map(c => c.username || c.name).join(' & ')}`
                      : (post.profile.username || post.profile.name)}
                  </span>
                </button>
                {/* Time — top right */}
                <span className="absolute top-4 right-4 text-white/60 text-[10px] font-medium">{timeAgo}</span>
              </div>

              {/* Below-photo content */}
              <div className="px-4 pt-3 pb-4">
                {/* Actions row */}
                {(() => {
                  const allPlacesSaved = post.places.length > 0 && post.places.every(p => allSavedPlaceIds.has(p.id));
                  const commentCount = commentsMap[post.id]?.length ?? 0;
                  return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        className="flex items-center gap-1.5"
                        onClick={() => {
                          if (!appUser || appUser.isDemo) return;
                          setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.delete(post.id) : n.add(post.id); return n; });
                          setRealPostLikeCounts(prev => ({ ...prev, [post.id]: (prev[post.id] ?? 0) + (isLiked ? -1 : 1) }));
                          isLiked ? unlikePost(appUser.id, post.id) : likePost(appUser.id, post.id);
                        }}
                      >
                        <Heart size={19} strokeWidth={1.5} className={isLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-500'} />
                        <span className="text-xs text-gray-400">{realPostLikeCounts[post.id] ?? 0}</span>
                      </button>
                      <button
                        className="flex items-center gap-1.5"
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
                        <MessageCircle size={19} strokeWidth={1.5} className={showCommentsPostId === post.id ? 'text-gray-900' : 'text-gray-500'} />
                        <span className="text-xs text-gray-400">{commentCount}</span>
                      </button>
                      <button onClick={() => setShowSharePostId(showSharePostId === post.id ? null : post.id)}>
                        <Send size={19} strokeWidth={1.5} className={showSharePostId === post.id ? 'text-gray-900' : 'text-gray-500'} />
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        if (!appUser || appUser.isDemo) return;
                        if (allPlacesSaved) {
                          for (const p of post.places) {
                            setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                            unsavePlace(appUser.id, p.id);
                          }
                        } else {
                          for (const p of post.places) {
                            setAllSavedPlaceIds(prev => new Set(prev).add(p.id));
                            savePlace(appUser.id, p.id);
                          }
                          // Show "Also add to collection?" sheet
                          setShowPostSaveSheet({ postId: post.id, placeIds: post.places.map(p => p.id) });
                        }
                      }}
                    >
                      {allPlacesSaved
                        ? <BookmarkCheck size={19} strokeWidth={1.5} className="text-gray-900" />
                        : <Bookmark size={19} strokeWidth={1.5} className="text-gray-500" />
                      }
                    </button>
                  </div>
                  );
                })()}
                {/* Caption */}
                {post.caption && <p className="text-sm text-gray-800 leading-snug mt-2.5">{post.caption}</p>}

                {/* Comments section */}
                {showCommentsPostId === post.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {loadingComments && !commentsMap[post.id] ? (
                      <div className="space-y-2 mb-3">
                        {[0,1].map(i => <div key={i} className="h-6 bg-gray-50 rounded-lg animate-pulse" />)}
                      </div>
                    ) : (commentsMap[post.id] ?? []).length > 0 ? (
                      <div className="space-y-2.5 mb-3">
                        {(commentsMap[post.id] ?? []).map(c => (
                          <div key={c.id} className="flex items-start gap-2">
                            {c.profile.avatarUrl
                              ? <img src={c.profile.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                              : <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400">{c.profile.name?.[0]}</div>}
                            <div>
                              <span className="text-xs font-semibold text-gray-900">{c.profile.name} </span>
                              <span className="text-xs text-gray-600">{c.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-3">No comments yet. Be the first!</p>
                    )}
                    {appUser && !appUser.isDemo && (
                      <div className="flex items-center gap-2">
                        <input
                          value={homeCommentText}
                          onChange={e => setHomeCommentText(e.target.value)}
                          placeholder="Add a comment…"
                          className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none"
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && homeCommentText.trim()) {
                              const text = homeCommentText.trim();
                              setHomeCommentText('');
                              const saved = await addComment(appUser.id, post.id, text);
                              if (saved) setCommentsMap(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), saved] }));
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            if (!homeCommentText.trim() || !appUser) return;
                            const text = homeCommentText.trim();
                            setHomeCommentText('');
                            const saved = await addComment(appUser.id, post.id, text);
                            if (saved) setCommentsMap(prev => ({ ...prev, [post.id]: [...(prev[post.id] ?? []), saved] }));
                          }}
                          className="text-xs font-semibold text-white px-3 py-2 bg-gray-900 rounded-xl"
                        >Post</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Places section — below the main card content */}
              <div className="px-4 pb-4">
                {/* Places toggle */}
                {post.places.length > 0 && (() => {
                  const uniquePlaces = post.places.filter((p, i, arr) => arr.findIndex(x => x.name.split(',')[0].trim() === p.name.split(',')[0].trim()) === i);
                  return (
                  <>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => setExpandedPlacesPostId(p => p === post.id ? null : post.id)}
                      className="text-xs font-semibold text-gray-400 flex items-center gap-1"
                    >
                      <MapPin size={10} strokeWidth={1.5} className="text-gray-400" />
                      {uniquePlaces.length} place{uniquePlaces.length !== 1 ? 's' : ''}
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`transition-transform ${expandedPlacesPostId === post.id ? 'rotate-180' : ''}`}>
                        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {(() => {
                      const mapOpen = mapOpenPostId === post.id;
                      return (
                        <button
                          onClick={async () => {
                            if (mapOpen) { setMapOpenPostId(null); return; }
                            setExpandedPlacesPostId(post.id);
                            setMapOpenPostId(post.id);
                            // Geocode ALL missing coords — update map pin by pin as each resolves
                            const missing = uniquePlaces.filter(p => p.lat == null || p.lng == null);
                            if (missing.length > 0) {
                              setGeocodingPostId(post.id);
                              await geocodeMissingPlaces(
                                post.places,
                                GOOGLE_PLACES_KEY,
                                (updated) => {
                                  const coordMap: Record<string, { lat: number; lng: number }> = {};
                                  updated.forEach(pl => { if (pl.lat != null) coordMap[pl.id] = { lat: pl.lat!, lng: pl.lng! }; });
                                  setRealPosts(prev => prev.map(rp => ({
                                    ...rp,
                                    places: rp.places.map(pl => coordMap[pl.id] ? { ...pl, ...coordMap[pl.id] } : pl),
                                  })));
                                }
                              );
                              setGeocodingPostId(null);
                            }
                          }}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${mapOpen ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <Map size={11} strokeWidth={1.5} />
                          {mapOpen ? 'Hide map' : 'View on map'}
                        </button>
                      );
                    })()}
                  </div>
                  {expandedPlacesPostId === post.id && (
                  <div className="mt-2 space-y-2">
                    {/* Map — above the place cards */}
                    {mapOpenPostId === post.id && (() => {
                      const isGeocoding = geocodingPostId === post.id;
                      const mapPlaces = uniquePlaces.filter(p => p.lat && p.lng).map(p => ({
                        id: p.id, name: p.name.split(',')[0].trim(), lat: p.lat!, lng: p.lng!,
                        category: p.category, image: p.photoUrl, neighbourhood: p.neighborhood ?? '', city: p.city ?? '', country: p.country ?? '',
                        savedCount: 0, bookingAvailable: false, rating: null,
                      }));
                      if (isGeocoding && mapPlaces.length === 0) return (
                        <div className="rounded-2xl bg-gray-50 h-28 flex flex-col items-center justify-center gap-1 animate-pulse">
                          <Map size={18} strokeWidth={1.5} className="text-gray-300" />
                          <p className="text-xs text-gray-400">Loading map…</p>
                        </div>
                      );
                      if (mapPlaces.length === 0) return (
                        <div className="rounded-2xl bg-gray-50 h-28 flex flex-col items-center justify-center gap-1">
                          <Map size={18} strokeWidth={1.5} className="text-gray-300" />
                          <p className="text-xs text-gray-400">Map not available for these places</p>
                        </div>
                      );
                      return (
                        <div className="rounded-2xl overflow-hidden">
                          <Suspense fallback={<div className="h-44 bg-gray-100 animate-pulse rounded-2xl" />}>
                            <MapView places={mapPlaces} height="176px" />
                          </Suspense>
                        </div>
                      );
                    })()}
                    {uniquePlaces.map(place => {
                      const catEmoji: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', dining: '🍽️', bar: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙', beach: '🏖️', sports: '🎾', wellness: '💆', street: '🏙️', event: '🎟️' };
                      return (
                      <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                        <button onClick={() => setSelectedPlacePage(place)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-0.5 truncate mt-0.5">
                            <MapPin size={9} strokeWidth={1.5} className="flex-shrink-0" />
                            {[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
                          </p>
                          {place.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji[place.category.toLowerCase()] ?? '📍'} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
                        </div>
                        </button>
                        {appUser && !appUser.isDemo && (
                          <button
                            onClick={async () => {
                              const isSavedToAll = allSavedPlaceIds.has(place.id);
                              if (isSavedToAll) {
                                setAllSavedPlaceIds(prev => { const n = new Set(prev); n.delete(place.id); return n; });
                                unsavePlace(appUser.id, place.id);
                              } else {
                                setAllSavedPlaceIds(prev => new Set(prev).add(place.id));
                                savePlace(appUser.id, place.id);
                                // Show optional collection picker
                                setAddToColPlace({ id: place.id, name: place.name });
                                setLoadingPlaceCollections(true);
                                getPlaceCollectionIds(place.id).then(ids => {
                                  setPlaceInCollections(ids);
                                  setLoadingPlaceCollections(false);
                                });
                              }
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${allSavedPlaceIds.has(place.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-200 bg-white'}`}
                          >
                            {allSavedPlaceIds.has(place.id)
                              ? <BookmarkCheck size={13} strokeWidth={1.5} className="text-white" />
                              : <Bookmark size={13} strokeWidth={1.5} className="text-gray-400" />}
                          </button>
                        )}
                      </div>
                      );
                    })}

                  </div>
                  )}
                  </>
                  );
                })()}
              </div>
            </div>
          );
        })}

        {/* Empty state for real users with no posts yet */}
        {isNewUser && realPosts.length === 0 && (
          <div className="px-5 pt-8 pb-6">
            <div className="mb-6">
              <p className="text-slate-800 font-bold text-lg mb-1">
                Welcome{appUser?.name ? `, ${appUser.name.split(' ')[0]}` : ''}
              </p>
              <p className="text-slate-400 text-sm">Here's how to get started on curio</p>
            </div>

            {/* Action cards */}
            <div className="space-y-3">
              {/* Find people */}
              <button
                onClick={() => setShowFindPeople(true)}
                className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                  <Users size={20} strokeWidth={1.5} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Find people to follow</p>
                  <p className="text-xs text-slate-400 mt-0.5">Discover travellers with great taste</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Add a post */}
              <button
                onClick={() => onNavigate?.('add')}
                className="w-full flex items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                  <Plus size={20} strokeWidth={1.5} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Share your first place</p>
                  <p className="text-xs text-slate-400 mt-0.5">Post a restaurant, hotel, or spot you love</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 flex-shrink-0">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}

      </div>

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
        <PlacePage
          place={selectedPlacePage}
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
        />
      )}
    </div>
  );
}
