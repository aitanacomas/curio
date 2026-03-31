import { lazy, Suspense, useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, MapPin, ArrowLeft, Bookmark, Map, X, Link, Copy, Mail, Check, Users, Plus } from 'lucide-react';
import type { Tab } from '../types/index';
import FindPeople from './FindPeople';
import { feedItems, users, places, collections } from '../data/mockData';
import type { FeedItem, User, Collection, Place, AppUser } from '../types';
import BookingSheet from '../components/BookingSheet';
import ImageCarousel from '../components/ImageCarousel';
import { getFeedPosts, getLikedPosts, getSavedPosts, likePost, unlikePost, savePost, unsavePost, getPostLikeCounts, getUserCollections, addPlaceToCollection, removePlaceFromCollection, getPlaceCollectionIds, type RealPost, type RealCollection } from '../lib/supabase';

const MapView = lazy(() => import('../components/MapView'));

// Mock comments per post
const mockComments: Record<string, { userId: string; text: string; time: string }[]> = {
  'feed-9': [
    { userId: 'user-1', text: 'that corridor photo is unreal. i need to go back', time: '55m' },
    { userId: 'user-5', text: 'the bar is genuinely one of the most beautiful rooms i have ever been in', time: '40m' },
    { userId: 'user-6', text: 'those cocktails with the rose petal… obsessed', time: '28m' },
    { userId: 'user-7', text: 'adding this to my madrid list immediately', time: '15m' },
  ],
  'feed-8': [
    { userId: 'user-2', text: 'the crystallised porsche stopped me in my tracks. daniel arsham is on another level', time: '15m' },
    { userId: 'user-5', text: "i don't believe in god but she doesn't mind is everything to me", time: '12m' },
    { userId: 'user-6', text: 'moco london is so underrated compared to the amsterdam one, glad people are going', time: '8m' },
    { userId: 'user-7', text: 'adding this to my london list immediately', time: '4m' },
  ],
  'feed-7': [
    { userId: 'user-5', text: 'bodega is SO good, that steak taco is unreal', time: '25m' },
    { userId: 'user-8', text: 'the ferry view on a clear day is one of my favourite things in the world', time: '18m' },
    { userId: 'user-6', text: "bob's donuts at the end of a full day is exactly the right call", time: '10m' },
    { userId: 'user-7', text: 'sfmoma rooftop terrace at golden hour?? dying', time: '5m' },
  ],
  'feed-6': [
    { userId: 'user-5', text: 'Museum Garage is one of my favourite buildings in the US, period', time: '2h' },
    { userId: 'user-8', text: 'the sneaker lab!! I walked past it 3 times before I found the entrance lol', time: '1h' },
    { userId: 'user-6', text: 'bigface is literally the only reason i go to the design district', time: '52m' },
    { userId: 'user-7', text: "need to go to ksubi next time I'm in miami", time: '30m' },
  ],
  'feed-1': [
    { userId: 'user-7', text: 'Casa Simera es un sueño, la mejor terraza de la ciudad', time: '1h' },
    { userId: 'user-5', text: 'Latte Latte changed my life honestly. That flat white is no joke', time: '45m' },
    { userId: 'user-6', text: 'The guava roll at Rosetta… I think about it weekly', time: '30m' },
    { userId: 'user-8', text: 'Malcriado has such a vibe, adding it to my cdmx list immediately', time: '20m' },
  ],
  'feed-2': [
    { userId: 'user-6', text: 'Booked for next Tuesday already 😂', time: '22h' },
    { userId: 'user-5', text: 'The natural wine list alone is worth it', time: '18h' },
    { userId: 'user-8', text: 'The terrace at golden hour is something else', time: '12h' },
  ],
  'feed-3': [
    { userId: 'user-8', text: 'Late March is peak — went last year and it was surreal', time: '3d' },
    { userId: 'user-5', text: 'Put it on my spring Japan trip list!', time: '2d' },
    { userId: 'user-6', text: 'The light through the blossoms at dusk 🥹', time: '1d' },
  ],
  'feed-4': [
    { userId: 'user-6', text: 'The latte art really does take 10 mins 😍', time: '5d' },
    { userId: 'user-7', text: 'Worth every minute of the queue', time: '4d' },
    { userId: 'user-5', text: 'Queue starts at 7am btw 😅', time: '3d' },
  ],
  'feed-5': [
    { userId: 'user-8', text: 'The rooftop terrace at sunset is unreal', time: '6d' },
    { userId: 'user-6', text: 'Stayed here in February — 10/10 would go back', time: '6d' },
    { userId: 'user-5', text: 'The restaurant downstairs is equally good', time: '5d' },
  ],
};

const mockDMs: Record<string, { from: string; text: string; time: string; mine?: boolean }[]> = {
  'user-2': [
    { from: 'user-2', text: 'ok bodega for dinner this week? I need those tacos again', time: '2h' },
    { from: 'user-1', text: 'YES. Thursday?', time: '2h', mine: true },
    { from: 'user-2', text: 'Thursday works! I\'ll book', time: '1h' },
    { from: 'user-1', text: 'perfect see you then', time: '1h', mine: true },
  ],
  'user-3': [
    { from: 'user-3', text: 'Hey! Saw your Paris recs. Septime is on my list for sure', time: '1d' },
    { from: 'user-1', text: 'You have to go, book 2 weeks ahead though', time: '1d', mine: true },
    { from: 'user-3', text: 'Noted. Any other hidden gems in Paris?', time: '23h' },
  ],
  'user-4': [
    { from: 'user-4', text: 'Just sent you the Tokyo hotel list 🏨', time: '3d' },
    { from: 'user-1', text: 'This is incredible, saving all of them', time: '3d', mine: true },
  ],
};

interface ShareTarget {
  type: 'post' | 'place';
  label: string;
  image: string;
}

interface Props {
  showMessages?: boolean;
  onMessagesClose?: () => void;
  isNewUser?: boolean;
  appUser?: AppUser;
  onNavigate?: (tab: Tab) => void;
}

export default function Home({ showMessages = false, onMessagesClose, isNewUser, appUser, onNavigate }: Props) {
  const [feed, setFeed] = useState(feedItems);
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set(['place-28', 'place-29', 'place-30', 'place-31', 'place-32']));
  const [showMap, setShowMap] = useState(false);
  const [storyUser, setStoryUser] = useState<User | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showInbox, setShowInbox] = useState(showMessages);
  const [saveTarget, setSaveTarget] = useState<{ type: 'post' | 'place'; id: string } | null>(null);
  const [myCollections, setMyCollections] = useState<Collection[]>(collections.filter(c => c.curatorId === 'user-1'));
  const [collectionSaves, setCollectionSaves] = useState<Record<string, Set<string>>>({});
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [dmText, setDmText] = useState('');
  const [dmThreads, setDmThreads] = useState(mockDMs);
  const [showAllComments, setShowAllComments] = useState(false);
  const [bookingPlace, setBookingPlace] = useState<Place | null>(null);
  const [realPosts, setRealPosts] = useState<RealPost[]>([]);
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [likedRealPosts, setLikedRealPosts] = useState<Set<string>>(new Set());
  const [savedRealPosts, setSavedRealPosts] = useState<Set<string>>(new Set());
  const [realPostLikeCounts, setRealPostLikeCounts] = useState<Record<string, number>>({});
  const [userCollections, setUserCollections] = useState<RealCollection[]>([]);
  const [expandedPlacesPostId, setExpandedPlacesPostId] = useState<string | null>(null);
  const [addToColPlace, setAddToColPlace] = useState<{ id: string; name: string } | null>(null);
  const [placeInCollections, setPlaceInCollections] = useState<Set<string>>(new Set());
  const [loadingPlaceCollections, setLoadingPlaceCollections] = useState(false);

  // Fetch real posts from Supabase on mount
  useEffect(() => {
    getFeedPosts().then(posts => {
      setRealPosts(posts);
      if (posts.length > 0) {
        getPostLikeCounts(posts.map(p => p.id)).then(setRealPostLikeCounts);
      }
    });
  }, []);

  useEffect(() => {
    if (!appUser || appUser.isDemo) return;
    getLikedPosts(appUser.id).then(setLikedRealPosts);
    getSavedPosts(appUser.id).then(setSavedRealPosts);
    getUserCollections(appUser.id).then(setUserCollections);
  }, [appUser]);

  useEffect(() => {
    if (!saveTarget) return;
    const prevent = (e: Event) => {
      const sheet = document.getElementById('save-sheet');
      if (sheet && sheet.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('wheel', prevent, { passive: false });
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.removeEventListener('wheel', prevent);
      document.removeEventListener('touchmove', prevent);
    };
  }, [saveTarget]);

  const toggleLike = (id: string) => {
    setFeed(prev => prev.map(item =>
      item.id === id
        ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 }
        : item
    ));
  };

  const toggleSave = (id: string) => {
    setFeed(prev => prev.map(item =>
      item.id === id ? { ...item, saved: !item.saved } : item
    ));
  };

  const toggleSavePlace = (placeId: string) => {
    setSavedPlaces(prev => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId); else next.add(placeId);
      return next;
    });
  };

  const sendTo = (userId: string) => {
    setSentTo(prev => new Set(prev).add(userId));
  };

  const copyLink = () => {
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getUserById = (id: string) => users.find(u => u.id === id)!;
  const getPlaceById = (id: string) => places.find(p => p.id === id)!;

  const getPostPlaces = (item: FeedItem) => {
    const ids = item.placeIds ?? [item.placeId];
    return ids.map(id => getPlaceById(id)).filter(Boolean);
  };

  const friends = users.filter(u => u.id !== 'user-1' && u.id !== 'user-8');

  const saveToCollection = (collectionId: string | 'all') => {
    if (!saveTarget) return;
    if (collectionId === 'all') {
      if (saveTarget.type === 'post') toggleSave(saveTarget.id);
      else toggleSavePlace(saveTarget.id);
    } else {
      setCollectionSaves(prev => {
        const next = { ...prev };
        const set = new Set(next[collectionId] ?? []);
        set.add(saveTarget.id);
        next[collectionId] = set;
        return next;
      });
    }
    setSaveTarget(null);
    setShowNewList(false);
    setNewListName('');
  };

  const createAndSave = () => {
    if (!newListName.trim() || !saveTarget) return;
    const newCol: Collection = {
      id: `col-${Date.now()}`,
      name: newListName.trim(),
      emoji: '📌',
      placeIds: [],
      coverImage: '',
      description: '',
      curatorId: 'user-1',
    };
    setMyCollections(prev => [...prev, newCol]);
    setCollectionSaves(prev => ({ ...prev, [newCol.id]: new Set([saveTarget.id]) }));
    setSaveTarget(null);
    setShowNewList(false);
    setNewListName('');
  };

  const sendDM = () => {
    if (!activeChat || !dmText.trim()) return;
    setDmThreads(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] ?? []), { from: 'user-1', text: dmText.trim(), time: 'now', mine: true }],
    }));
    setDmText('');
  };

  // ── Chat View ────────────────────────────────────────────────────
  if (showInbox && activeChat) {
    const chatUser = users.find(u => u.id === activeChat)!;
    const messages = dmThreads[activeChat] ?? [];
    return (
      <div className="bg-white min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => setActiveChat(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <img src={chatUser.avatar} alt={chatUser.name} className="w-8 h-8 rounded-full object-cover object-top" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{chatUser.name}</p>
            <p className="text-xs text-gray-400">@{chatUser.username}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => {
            const sender = users.find(u => u.id === msg.from);
            return (
              <div key={i} className={`flex items-end gap-2 ${msg.mine ? 'flex-row-reverse' : ''}`}>
                {!msg.mine && <img src={sender?.avatar} alt="" className="w-7 h-7 rounded-full object-cover object-top flex-shrink-0 mb-0.5" />}
                <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-snug ${msg.mine ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-300 flex-shrink-0">{msg.time}</span>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-2">
          <input
            value={dmText}
            onChange={e => setDmText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendDM()}
            placeholder="Message..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-gray-400"
          />
          <button
            onClick={sendDM}
            disabled={!dmText.trim()}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${dmText.trim() ? 'bg-gray-900' : 'bg-gray-200'}`}
          >
            <Send size={15} strokeWidth={1.5} className={dmText.trim() ? 'text-white' : 'text-gray-400'} />
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
      />
    );
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
        <div className="divide-y divide-gray-50">
          {isNewUser ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Send size={22} strokeWidth={1.5} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">No messages yet</p>
              <p className="text-xs text-gray-400 leading-relaxed">Follow people to start conversations and share places you love.</p>
            </div>
          ) : (
            friends.map(friend => {
              const thread = dmThreads[friend.id] ?? [];
              const last = thread[thread.length - 1];
              return (
                <button
                  key={friend.id}
                  onClick={() => setActiveChat(friend.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
                >
                  <img src={friend.avatar} alt={friend.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ objectPosition: friend.avatarPosition ?? 'top' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{friend.name}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{last ? last.text : 'No messages yet'}</p>
                  </div>
                  {last && <span className="text-[11px] text-gray-300 flex-shrink-0">{last.time}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Share Sheet ─────────────────────────────────────────────────
  if (shareTarget) {
    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Share</h2>
          <button onClick={() => { setShareTarget(null); setSentTo(new Set()); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <X size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>

        {/* Preview of what's being shared */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
            <img src={shareTarget.image} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-900 truncate">{shareTarget.label}</p>
          </div>
        </div>

        {/* Send to friends */}
        <div className="px-4 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Send to</p>
          <div className="space-y-3">
            {friends.map(friend => {
              const sent = sentTo.has(friend.id);
              return (
                <div key={friend.id} className="flex items-center gap-3">
                  <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ objectPosition: friend.avatarPosition ?? 'top' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{friend.name}</p>
                    <p className="text-xs text-gray-400">@{friend.username}</p>
                  </div>
                  <button
                    onClick={() => sendTo(friend.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      sent ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    {sent ? 'Sent' : 'Send'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Other share options */}
        <div className="px-4 pt-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Other options</p>
          <div className="flex gap-3">
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                linkCopied ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {linkCopied ? <Copy size={14} strokeWidth={1.5} /> : <Link size={14} strokeWidth={1.5} />}
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl text-sm font-medium text-gray-700">
              <MapPin size={14} strokeWidth={1.5} />
              Share to story
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Story Viewer ────────────────────────────────────────────────
  if (storyUser) {
    const latestPost = feedItems.find(f => f.userId === storyUser.id);
    const latestPlace = latestPost ? getPlaceById(latestPost.placeId) : null;
    return (
      <div className="bg-black min-h-screen relative">
        <button
          onClick={() => setStoryUser(null)}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20"
        >
          <X size={16} strokeWidth={1.5} className="text-white" />
        </button>
        {latestPlace && (
          <img src={latestPlace.image} alt="" className="w-full h-full object-cover absolute inset-0 opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        {/* Story header */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <img src={storyUser.avatar} alt={storyUser.name} className="w-9 h-9 rounded-full object-cover object-top border-2 border-white" />
          <div>
            <p className="text-white text-sm font-semibold">{storyUser.name}</p>
            <p className="text-white/70 text-xs">{latestPost?.createdAt}</p>
          </div>
        </div>
        {/* Place info at bottom */}
        {latestPlace && (
          <div className="absolute bottom-24 left-4 right-4">
            <p className="text-white/70 text-xs mb-1">Latest place</p>
            <p className="text-white text-xl font-bold">{latestPlace.name}</p>
            <p className="text-white/70 text-sm flex items-center gap-1 mt-0.5">
              <MapPin size={12} strokeWidth={1.5} /> {latestPlace.city}, {latestPlace.country}
            </p>
            <button
              onClick={() => setStoryUser(null)}
              className="mt-4 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-bold"
            >
              See their map →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Save Sheet Overlay (shared) ──────────────────────────────────
  const saveSheet = saveTarget ? (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/40" onClick={() => { setSaveTarget(null); setShowNewList(false); setNewListName(''); }} />
      <div id="save-sheet" className="relative bg-white rounded-t-3xl h-[75vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 pt-2 pb-4">
          <h2 className="text-base font-bold text-gray-900">Save to</h2>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            <button onClick={() => saveToCollection('all')} className="text-left">
              <div className="rounded-xl aspect-square bg-gray-100 flex items-center justify-center">
                <span className="text-4xl">🔖</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-2">All Saved</p>
              <p className="text-xs text-gray-400">Default</p>
            </button>
            {myCollections.map(col => {
              const isSavedToCol = collectionSaves[col.id]?.has(saveTarget.id);
              return (
                <button key={col.id} onClick={() => saveToCollection(col.id)} className="text-left">
                  <div className="rounded-xl overflow-hidden aspect-square relative bg-gray-100">
                    {col.coverImage
                      ? <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" />
                      : <span className="text-4xl flex items-center justify-center w-full h-full">{col.emoji}</span>
                    }
                    {isSavedToCol && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                          <Check size={16} className="text-gray-900" strokeWidth={2.5} />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2 truncate">{col.name}</p>
                  <p className="text-xs text-gray-400">{col.placeIds.length} places</p>
                </button>
              );
            })}
            {showNewList ? (
              <div className="text-left">
                <div className="rounded-xl aspect-square bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 p-3">
                  <input
                    autoFocus
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createAndSave()}
                    placeholder="List name..."
                    className="w-full bg-white rounded-lg px-2 py-1.5 text-xs outline-none text-gray-900 placeholder-gray-400 text-center border border-gray-200"
                  />
                  <button
                    onClick={createAndSave}
                    disabled={!newListName.trim()}
                    className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${newListName.trim() ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'}`}
                  >
                    Create
                  </button>
                </div>
                <p className="text-sm font-semibold text-gray-400 mt-2">New list</p>
              </div>
            ) : (
              <button onClick={() => setShowNewList(true)} className="text-left">
                <div className="rounded-xl border-2 border-dashed border-gray-200 aspect-square flex items-center justify-center bg-gray-50">
                  <span className="text-3xl text-gray-300">+</span>
                </div>
                <p className="text-sm font-semibold text-gray-400 mt-2">New list</p>
                <p className="text-xs text-gray-300">Add a collection</p>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // ── Post Detail View ─────────────────────────────────────────────
  if (selectedPost) {
    const user = getUserById(selectedPost.userId);
    const postPlaces = getPostPlaces(selectedPost);
    const centerPlace = postPlaces[0];
    const comments = mockComments[selectedPost.id] ?? [];

    return (
      <>
      <div className="bg-white min-h-screen flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button
            onClick={() => { setSelectedPost(null); setShowMap(false); setCommentText(''); setShowAllComments(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              {user.name}
            </p>
            <p className="text-xs text-gray-400">{selectedPost.createdAt}</p>
          </div>
          {/* Share whole post */}
          <button
            onClick={() => setShareTarget({ type: 'post', label: selectedPost.caption.slice(0, 50) + '…', image: selectedPost.images[0] })}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0"
          >
            <Send size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          {/* Carousel */}
          <ImageCarousel images={selectedPost.images} labels={postPlaces.map(p => p.name)} scales={selectedPost.id === 'feed-8' ? [1.02, 1, 1, 1, 1.05] : selectedPost.id === 'feed-9' ? [1, 1, 1, 1, 1.07, 1] : undefined} />

          {/* Like / Comment / Save */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleLike(selectedPost.id)}
                className="flex items-center gap-1.5"
              >
                <Heart
                  size={22}
                  strokeWidth={1.5}
                  className={selectedPost.liked ? 'fill-gray-900 text-gray-900' : 'text-gray-700'}
                />
                <span className="text-xs text-gray-500">{selectedPost.likes.toLocaleString()}</span>
              </button>
              <div className="flex items-center gap-1.5 text-gray-700">
                <MessageCircle size={22} strokeWidth={1.5} />
                <span className="text-xs text-gray-500">{selectedPost.comments}</span>
              </div>
            </div>
            <button
              onClick={() => selectedPost.saved ? toggleSave(selectedPost.id) : setSaveTarget({ type: 'post', id: selectedPost.id })}
              className={`px-5 py-1.5 rounded-full border text-sm font-semibold transition-colors ${
                selectedPost.saved
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'border-gray-900 text-gray-900 bg-white'
              }`}
            >
              {selectedPost.saved ? 'Saved' : 'Save'}
            </button>
          </div>

          {/* Full caption */}
          <div className="px-4 pb-4 border-b border-gray-100">
            <p className="text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>
          </div>

          {/* Places in this post */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {postPlaces.length} Place{postPlaces.length !== 1 ? 's' : ''} in this post
              </p>
              {postPlaces.length >= 1 && (
                <button
                  onClick={() => setShowMap(p => !p)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    showMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Map size={12} strokeWidth={1.5} />
                  {showMap ? 'Hide map' : 'View on map'}
                </button>
              )}
            </div>

            {/* Mini map */}
            {showMap && postPlaces.length >= 1 && centerPlace && (
              <div className="mb-4 rounded-2xl overflow-hidden">
                <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse" />}>
                  <MapView
                    places={postPlaces}
                    center={[centerPlace.lat, centerPlace.lng]}
                    zoom={15}
                    height="200px"
                  />
                </Suspense>
              </div>
            )}

            {/* Individual place list */}
            <div className="space-y-3">
              {postPlaces.map(place => {
                const isSaved = savedPlaces.has(place.id);
                return (
                  <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                    <img
                      src={place.image}
                      alt={place.name}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
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
                        <button
                          onClick={() => setBookingPlace(place)}
                          className="text-xs font-bold bg-gray-900 text-white rounded-full px-2.5 py-1"
                        >
                          Book
                        </button>
                      )}
                      <button
                        onClick={() => isSaved ? toggleSavePlace(place.id) : setSaveTarget({ type: 'place', id: place.id })}
                        className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${
                          isSaved ? 'bg-gray-900 border-gray-900' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <Bookmark size={13} strokeWidth={1.5} className={isSaved ? 'fill-white text-white' : 'text-gray-600'} />
                      </button>
                      <button
                        onClick={() => setShareTarget({ type: 'place', label: `${place.name} · ${place.city}`, image: place.image })}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white"
                      >
                        <Send size={13} strokeWidth={1.5} className="text-gray-600" />
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
                {(showAllComments ? comments : comments.slice(0, 2)).map((c, i) => {
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
              {!showAllComments && selectedPost.comments > 2 && (
                <button
                  onClick={() => setShowAllComments(true)}
                  className="mt-3 text-xs text-gray-400 font-medium"
                >
                  See all {selectedPost.comments} comments
                </button>
              )}
            </div>
          )}
          {/* Comment input — inline, scrolls with content */}
          <div className="px-4 pt-2 pb-4 mt-1">
            <div className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
              <button onClick={() => setCommentText('')} className="text-xs font-semibold text-gray-400">
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
      {saveSheet}
      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />
      </>
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

      {/* Stories Row — only for demo users */}
      {!isNewUser && (
        <div className="bg-white px-4 pt-3 pb-3 border-b border-gray-100">
          <div className="flex gap-4 overflow-x-auto scrollbar-none">
            {friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => setStoryUser(friend)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-gray-400 to-gray-600">
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    className="w-full h-full rounded-full object-cover border-2 border-white"
                    style={{ objectPosition: friend.avatarPosition ?? 'top' }}
                  />
                </div>
                <span className="text-xs text-gray-600 font-medium">{friend.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="px-4 pt-3 space-y-4 pb-6">
        {/* Real posts from Supabase */}
        {realPosts.map(post => {
          const images = post.places.map(p => p.photoUrl).filter(Boolean);
          const firstPlace = post.places[0];
          if (!images.length || !firstPlace) return null;
          const locationLabel = post.places.length === 1
            ? `${firstPlace.name} · ${firstPlace.city}`
            : `${firstPlace.name} +${post.places.length - 1} · ${firstPlace.city}`;
          const timeAgo = (() => {
            const diff = Date.now() - new Date(post.createdAt).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `${mins}m`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h`;
            return `${Math.floor(hrs / 24)}d`;
          })();
          const avatarSrc = post.profile.avatarUrl ?? '/aitana-avatar.jpg';
          return (
            <div key={post.id} className="bg-white rounded-3xl overflow-hidden shadow-sm">
              <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                <img src={avatarSrc} alt={post.profile.name} className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{post.profile.name}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1 truncate">
                    <MapPin size={10} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                    {locationLabel}
                  </p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">{timeAgo}</p>
              </div>
              <ImageCarousel images={images} labels={post.places.map(p => p.name)} />
              <div className="px-4 pt-2 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <button
                      className="flex items-center gap-1.5"
                      onClick={() => {
                        if (!appUser || appUser.isDemo) return;
                        const isLiked = likedRealPosts.has(post.id);
                        setLikedRealPosts(prev => { const n = new Set(prev); isLiked ? n.delete(post.id) : n.add(post.id); return n; });
                        setRealPostLikeCounts(prev => ({ ...prev, [post.id]: (prev[post.id] ?? 0) + (isLiked ? -1 : 1) }));
                        isLiked ? unlikePost(appUser.id, post.id) : likePost(appUser.id, post.id);
                      }}
                    >
                      <Heart size={22} strokeWidth={1.5} className={likedRealPosts.has(post.id) ? 'fill-gray-900 text-gray-900' : 'text-gray-700'} />
                      <span className="text-xs text-gray-500">{realPostLikeCounts[post.id] ?? 0}</span>
                    </button>
                    <button className="flex items-center gap-1.5">
                      <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
                      <span className="text-xs text-gray-500">0</span>
                    </button>
                    <Send size={22} strokeWidth={1.5} className="text-gray-700" />
                  </div>
                  <button
                    className={`px-5 py-1.5 rounded-full border text-sm font-semibold transition-colors ${savedRealPosts.has(post.id) ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-900 text-gray-900 bg-white'}`}
                    onClick={() => {
                      if (!appUser || appUser.isDemo) return;
                      const isSaved = savedRealPosts.has(post.id);
                      setSavedRealPosts(prev => { const n = new Set(prev); isSaved ? n.delete(post.id) : n.add(post.id); return n; });
                      isSaved ? unsavePost(appUser.id, post.id) : savePost(appUser.id, post.id);
                    }}
                  >{savedRealPosts.has(post.id) ? 'Saved' : 'Save'}</button>
                </div>
                {post.caption ? (
                  <p className="text-sm text-gray-700 leading-snug line-clamp-2">{post.caption}</p>
                ) : null}
                {post.hashtags.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {post.hashtags.map(t => `#${t}`).join(' ')}
                  </p>
                )}
                {/* Places toggle */}
                {post.places.length > 0 && (
                  <button
                    onClick={() => setExpandedPlacesPostId(p => p === post.id ? null : post.id)}
                    className="mt-2 text-xs font-semibold text-gray-500 flex items-center gap-1"
                  >
                    <MapPin size={11} strokeWidth={1.5} />
                    {post.places.length} place{post.places.length !== 1 ? 's' : ''}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${expandedPlacesPostId === post.id ? 'rotate-180' : ''}`}>
                      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
                {expandedPlacesPostId === post.id && (
                  <div className="mt-2 space-y-2">
                    {post.places.map(place => (
                      <div key={place.id} className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-2.5 py-2">
                        {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{place.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ')}</p>
                        </div>
                        {userCollections.length > 0 && (
                          <button
                            onClick={() => {
                              setAddToColPlace({ id: place.id, name: place.name });
                              setLoadingPlaceCollections(true);
                              getPlaceCollectionIds(place.id).then(ids => {
                                setPlaceInCollections(ids);
                                setLoadingPlaceCollections(false);
                              });
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 bg-white flex-shrink-0"
                          >
                            <Bookmark size={12} strokeWidth={1.5} className="text-gray-500" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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

        {/* Mock feed — only for demo account */}
        {!isNewUser && feed.map(item => {
          const user = getUserById(item.userId);
          const place = getPlaceById(item.placeId);
          if (!user || !place) return null;

          const postPlaces = getPostPlaces(item);
          const friendsSavedUsers = (item.friendsSaved ?? [])
            .map(id => users.find(u => u.id === id))
            .filter(Boolean);

          return (
            <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm">
              {/* Post header */}
              <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" style={{ objectPosition: user.avatarPosition ?? 'top' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">
                    {user.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      onClick={() => { setSelectedPost(item); setShowAllComments(false); }}
                      className="flex items-center gap-1 min-w-0"
                    >
                      <MapPin size={10} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500 font-medium truncate">
                        {postPlaces.length === 1
                          ? `${postPlaces[0].name} · ${postPlaces[0].city}`
                          : `${postPlaces[0].name} +${postPlaces.length - 1} · ${postPlaces[0].city}`}
                      </p>
                    </button>
                    {place.bookingAvailable && (
                      <button
                        onClick={e => { e.stopPropagation(); setBookingPlace(place); }}
                        className="flex-shrink-0 text-[10px] font-bold text-gray-700 bg-gray-100 rounded-full px-2 py-0.5"
                      >
                        Book
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">{item.createdAt}</p>
              </div>

              {/* Carousel — tap to open detail */}
              <div className="cursor-pointer" onClick={() => { setSelectedPost(item); setShowAllComments(false); }}>
                <ImageCarousel images={item.images} scales={item.id === 'feed-8' ? [1.02, 1, 1, 1, 1.05] : item.id === 'feed-9' ? [1, 1, 1, 1, 1.07, 1] : undefined} />
              </div>

              {/* Actions */}
              <div className="px-4 pt-2 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleLike(item.id)} className="flex items-center gap-1.5">
                      <Heart
                        size={22}
                        strokeWidth={1.5}
                        className={item.liked ? 'fill-gray-900 text-gray-900' : 'text-gray-700'}
                      />
                      <span className="text-xs text-gray-500">{item.likes.toLocaleString()}</span>
                    </button>
                    <button onClick={() => { setSelectedPost(item); setShowAllComments(false); }} className="flex items-center gap-1.5">
                      <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
                      <span className="text-xs text-gray-500">{item.comments}</span>
                    </button>
                    <button
                      onClick={() => setShareTarget({ type: 'post', label: item.caption.slice(0, 50) + '…', image: item.images[0] })}
                    >
                      <Send size={22} strokeWidth={1.5} className="text-gray-700" />
                    </button>
                  </div>
                  <button
                    onClick={() => item.saved ? toggleSave(item.id) : setSaveTarget({ type: 'post', id: item.id })}
                    className={`px-5 py-1.5 rounded-full border text-sm font-semibold transition-colors ${
                      item.saved ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-900 text-gray-900 bg-white'
                    }`}
                  >
                    {item.saved ? 'Saved' : 'Save'}
                  </button>
                </div>

                {/* Friends saved */}
                {friendsSavedUsers.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex -space-x-1.5">
                      {friendsSavedUsers.slice(0, 3).map(friend => (
                        <img key={friend!.id} src={friend!.avatar} alt={friend!.name} className="w-5 h-5 rounded-full object-cover object-top border border-white" />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {friendsSavedUsers.length === 1
                        ? `${friendsSavedUsers[0]!.name.split(' ')[0]} saved this`
                        : `${friendsSavedUsers[0]!.name.split(' ')[0]} and ${friendsSavedUsers.length - 1} other${friendsSavedUsers.length > 2 ? 's' : ''} saved this`}
                    </p>
                  </div>
                )}

                {/* Caption */}
                <p className="text-sm text-gray-700 leading-snug line-clamp-2">{item.caption}</p>
                <button onClick={() => { setSelectedPost(item); setShowAllComments(false); }} className="text-xs font-semibold text-gray-400 mt-1">
                  See more
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {saveSheet}
      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />

      {/* Collection picker sheet */}
      {addToColPlace && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddToColPlace(null)} />
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
          </div>
        </div>
      )}
    </div>
  );
}
