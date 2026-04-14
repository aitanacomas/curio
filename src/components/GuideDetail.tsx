import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import ActionModal from './ActionModal';
import ImageCarousel from './ImageCarousel';
import { X, MapPin, Loader2, Play, Pause, Map, Share2, Send, Copy, Check, Search, UserPlus, Bookmark, BookmarkCheck, ChevronRight, MoreHorizontal, List, Heart, MessageCircle, Flag, UserX, Trash2, Edit3, Plus } from 'lucide-react';
import type { Guide, Plan, RealPostPlace, Conversation, FollowProfile, GuideCollaborator, GuideComment } from '../lib/supabase';
import {
  getPlans,
  createPlan,
  createPlanDay,
  createPlanItem,
  addPlaceToCollection,
  removePlaceFromCollection,
  getPlaceCollectionIds,
  getConversations,
  getOrCreateConversation,
  sendMessage,
  searchProfiles,
  getGuideCollaborators,
  addGuideCollaborator,
  removeGuideCollaborator,
  subscribeToGuide,
  unsubscribeFromGuide,
  isSubscribedToGuide,
  getGuideSubscriberCount,
  getSavedPlaceIds,
  savePlace,
  unsavePlace,
  likeGuide,
  unlikeGuide,
  getGuideLikeCounts,
  getUserLikedGuides,
  addGuideComment,
  getGuideComments,
  getGuideCommentCounts,
  blockUser,
  getBlockedUsers,
  getBlockersOfUser,
  reportContent,
  deleteGuide,
  followUser,
  unfollowUser,
  getFollowing,
  getUserCollections,
  addGuideToCollection,
  removeGuideFromCollection,
  getGuideCollectionIds,
  createCollection,
  type RealCollection,
} from '../lib/supabase';

const MapView = lazy(() => import('./MapView'));

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', treats: '🍰', bar: '🍸', nightlife: '🎵',
  food: '🍕', hotel: '🏨', landmark: '🏛️', art: '🎨', nature: '🌿',
  beach: '🏖️', shop: '🛍️', experience: '🎡', neighbourhood: '🏘️',
  sports: '🎾', wellness: '💆', event: '🎟️', flight: '✈️', transport: '🚗',
};

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="mt-2 flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2">
      <button onClick={toggle}
        className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
        {playing
          ? <Pause size={10} strokeWidth={2.5} className="text-white" />
          : <Play size={10} strokeWidth={2.5} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 h-1 bg-orange-200 rounded-full overflow-hidden">
        <div className="h-full bg-orange-500 rounded-full transition-all"
          style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
      </div>
      <span className="text-[10px] text-orange-400 flex-shrink-0 font-medium">
        {playing ? fmt(progress) : fmt(duration)}
      </span>
      <audio ref={audioRef} src={src}
        onTimeUpdate={e => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
    </div>
  );
}

function PlaceCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <div className="w-full aspect-[3/4]">
        <img
          src={photos[0]} alt={name}
          className="w-full h-full object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        onScroll={e => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.offsetWidth));
        }}
      >
        {photos.map((url, i) => (
          <div key={i} className="flex-shrink-0 w-full aspect-[3/4] snap-start">
            <img src={url} alt={`${name} ${i + 1}`}
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
        {photos.map((_, i) => (
          <div key={i} className={`rounded-full transition-all ${i === index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/60'}`} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  guide: Guide;
  currentUserId?: string;
  onClose: () => void;
  onDeleteGuide?: (guideId: string) => void;
  onEditGuide?: () => void;
  onPlaceClick?: (place: RealPostPlace) => void;
  onViewUser?: (userId: string) => void;
}

export default function GuideDetail({ guide, currentUserId, onClose, onDeleteGuide, onEditGuide, onPlaceClick, onViewUser }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);

  // Follow author
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Subscribe
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [togglingSubscribe, setTogglingSubscribe] = useState(false);

  // Save to collection sheet
  const [showColSheet, setShowColSheet] = useState(false);
  const [colSheetCollections, setColSheetCollections] = useState<RealCollection[]>([]);
  const [colSheetIds, setColSheetIds] = useState<Set<string>>(new Set());
  const [colSheetLoading, setColSheetLoading] = useState(false);
  const [colSheetShowNew, setColSheetShowNew] = useState(false);
  const [colSheetNewName, setColSheetNewName] = useState('');
  const [colSheetCreating, setColSheetCreating] = useState(false);
  // Place save sheet (for individual place bookmarks inside a guide)
  const [placeSaveSheet, setPlaceSaveSheet] = useState<{ id: string; name: string; category?: string; photoUrl?: string; neighborhood?: string; city?: string; country?: string; lat?: number | null; lng?: number | null } | null>(null);
  const [placeSaveColIds, setPlaceSaveColIds] = useState<Set<string>>(new Set());
  const [placeSaveCollections, setPlaceSaveCollections] = useState<RealCollection[]>([]);
  const [placeSaveColLoading, setPlaceSaveColLoading] = useState(false);
  const [placeSaveShowNewCol, setPlaceSaveShowNewCol] = useState(false);
  const [placeSaveNewColName, setPlaceSaveNewColName] = useState('');
  const [placeSaveCreatingCol, setPlaceSaveCreatingCol] = useState(false);
  const [placeSavePlans, setPlaceSavePlans] = useState<Plan[]>([]);
  const [placeSavePlanAdded, setPlaceSavePlanAdded] = useState<Set<string>>(new Set());
  const [placeSavePlanAdding, setPlaceSavePlanAdding] = useState<string | null>(null);
  const [placeSaveShowNewTrip, setPlaceSaveShowNewTrip] = useState(false);
  const [placeSaveNewTripName, setPlaceSaveNewTripName] = useState('');
  const [placeSaveCreatingTrip, setPlaceSaveCreatingTrip] = useState(false);

  // Toast for subscribe errors
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Share sheet
  const [showShare, setShowShare] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [shareResults, setShareResults] = useState<FollowProfile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);
  const [shareSentTo, setShareSentTo] = useState<Set<string>>(new Set());
  const [linkCopied, setLinkCopied] = useState(false);
  const shareSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collaborators
  const [collaborators, setCollaborators] = useState<GuideCollaborator[]>([]);
  const [showCollabSheet, setShowCollabSheet] = useState(false);
  const [collabSearch, setCollabSearch] = useState('');
  const [collabResults, setCollabResults] = useState<FollowProfile[]>([]);
  const [searchingCollab, setSearchingCollab] = useState(false);
  const [invitingCollab, setInvitingCollab] = useState<string | null>(null);
  const collabSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Options sheet (···)
  const [showOptions, setShowOptions] = useState(false);
  const [optionsReportStep, setOptionsReportStep] = useState<'options' | 'reason' | 'deleteConfirm'>('options');
  const [optionsReportReason, setOptionsReportReason] = useState('');
  const [guideActionModal, setGuideActionModal] = useState<{ avatarUrl?: string | null; iconType?: 'check'; title: string; subtitle: string; confirmLabel?: string; confirmVariant?: 'red' | 'dark'; onConfirm?: () => void } | null>(null);

  // Likes
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likingGuide, setLikingGuide] = useState(false);

  // Block set (combined: who I blocked + who blocked me)
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUserId) return;
    Promise.all([getBlockedUsers(currentUserId), getBlockersOfUser(currentUserId)])
      .then(([blocked, blockers]) => setBlockedUsers(new Set([...blocked, ...blockers])));
  }, [currentUserId]);

  // Comments
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<GuideComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const isOwn = currentUserId === guide.userId;

  useEffect(() => {
    if (!guide.planId || !currentUserId) { setLoading(false); return; }
    getPlans(guide.userId).then(plans => {
      const found = plans.find(p => p.id === guide.planId) ?? null;
      setPlan(found);
      setLoading(false);
    });
  }, [guide.planId, guide.userId, currentUserId]);

  // Load collaborators
  useEffect(() => {
    getGuideCollaborators(guide.id).then(setCollaborators);
  }, [guide.id]);

  // Load subscription status + count
  useEffect(() => {
    getGuideSubscriberCount(guide.id).then(setSubscriberCount);
    if (currentUserId && !isOwn) {
      isSubscribedToGuide(currentUserId, guide.id).then(setSubscribed);
      getFollowing(currentUserId).then(set => setIsFollowing(set.has(guide.userId)));
    }
  }, [guide.id, currentUserId, isOwn]);

  // Load saved place IDs + user's trips for place save sheet
  useEffect(() => {
    if (!currentUserId) return;
    getSavedPlaceIds(currentUserId)
      .then(setSavedPlaceIds)
      .catch(err => { console.error('getSavedPlaceIds failed:', err); });
    getPlans(currentUserId)
      .then(setPlaceSavePlans)
      .catch(err => { console.error('getPlans failed:', err); });
  }, [currentUserId]);

  // Load like count + liked status
  useEffect(() => {
    getGuideLikeCounts([guide.id]).then(counts => setLikeCount(counts[guide.id] ?? 0));
    if (currentUserId) {
      getUserLikedGuides(currentUserId).then(ids => setLiked(ids.has(guide.id)));
    }
  }, [guide.id, currentUserId]);

  // Load comment count
  useEffect(() => {
    getGuideCommentCounts([guide.id]).then(counts => setCommentCount(counts[guide.id] ?? 0));
  }, [guide.id]);

  // Load conversations for share sheet
  useEffect(() => {
    if (currentUserId && showShare) {
      getConversations(currentUserId).then(setConversations);
    }
  }, [currentUserId, showShare]);

  const timeAgo = (() => {
    const diff = Date.now() - new Date(guide.publishedAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  })();

  const mapPlaces = (guide.places ?? [])
    .filter((p: any) => p.lat != null && p.lng != null)
    .map((p: any) => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, city: p.city ?? '', country: '' }));

  const closeShare = () => {
    setShowShare(false);
    setShareSearch('');
    setShareResults([]);
    setShareSentTo(new Set());
  };

  const closeCollabSheet = () => {
    setShowCollabSheet(false);
    setCollabSearch('');
    setCollabResults([]);
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
      {/* Inline toast */}
      {toastMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toastMsg}
        </div>
      )}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Fixed close button — always visible above scroll */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full ${guide.coverUrl ? 'bg-black/40 backdrop-blur-sm' : 'bg-gray-100'}`}
        >
          <X size={14} strokeWidth={2} className={guide.coverUrl ? 'text-white' : 'text-gray-600'} />
        </button>

        <div className="flex-1 overflow-y-auto">
          {/* Cover — full bleed */}
          {guide.coverUrl && (
            <>
              <div className="relative flex-shrink-0" style={{ height: 220 }}>
                <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
                <div className="absolute top-3 left-0 right-0 flex justify-center">
                  <div className="w-10 h-1 rounded-full bg-white/50" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                  <h2 className="text-xl font-black text-white leading-tight">{guide.title}</h2>
                  {guide.destination && (
                    <p className="text-white/70 text-[11px] flex items-center gap-0.5 mt-1">
                      <MapPin size={9} strokeWidth={1.5} className="inline" />{guide.destination}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {!guide.coverUrl && (
            <>
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pt-2 pb-3 pr-14 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{guide.title}</h2>
                {guide.destination && (
                  <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin size={11} strokeWidth={1.5} />{guide.destination}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Author row */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
            <button
              className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 text-left"
              onClick={() => { if (onViewUser && guide.userId !== currentUserId) onViewUser(guide.userId); }}
            >
            {guide.profile.avatarUrl
              ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">{guide.profile.name[0]?.toUpperCase()}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{guide.profile.name}</p>
                {collaborators.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">&</span>
                    {collaborators.slice(0, 2).map(c => (
                      <span key={c.userId} className="text-xs text-gray-600 font-medium truncate">{c.profile.name.split(' ')[0]}</span>
                    ))}
                    {collaborators.length > 2 && <span className="text-xs text-gray-400">+{collaborators.length - 2}</span>}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">
                @{guide.profile.username} · {timeAgo}
                {subscriberCount > 0 && ` · ${subscriberCount} follower${subscriberCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            </button>
            <div className="flex items-center gap-1.5">
              {/* Follow button — only show for other users' guides */}
              {!isOwn && currentUserId && (
                <button
                  disabled={followLoading}
                  onClick={async () => {
                    setFollowLoading(true);
                    const wasFollowing = isFollowing;
                    setIsFollowing(!wasFollowing);
                    const ok = await (wasFollowing
                      ? unfollowUser(currentUserId, guide.userId)
                      : followUser(currentUserId, guide.userId));
                    if (!ok) setIsFollowing(wasFollowing);
                    setFollowLoading(false);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    isFollowing
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-gray-900 text-white'
                  }`}
                >
                  {followLoading ? <Loader2 size={11} className="animate-spin" /> : isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              {isOwn && (
                <button onClick={() => setShowCollabSheet(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                  <UserPlus size={14} strokeWidth={1.8} className="text-gray-600" />
                </button>
              )}
              <button
                onClick={() => { setOptionsReportStep('options'); setOptionsReportReason(''); setShowOptions(true); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
              >
                <MoreHorizontal size={15} strokeWidth={1.8} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* Action row: like · comment · send · save */}
          <div className="px-5 py-3 flex items-center gap-4 border-b border-gray-100">
            {/* Like */}
            <button
              disabled={!currentUserId || likingGuide}
              className="flex items-center gap-1.5 active:scale-90 transition-transform"
              onClick={async () => {
                if (!currentUserId || likingGuide) return;
                const wasLiked = liked;
                setLiked(!wasLiked);
                setLikeCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);
                setLikingGuide(true);
                try {
                  if (wasLiked) await unlikeGuide(currentUserId, guide.id);
                  else await likeGuide(currentUserId, guide.id);
                } catch {
                  setLiked(wasLiked);
                  setLikeCount(c => wasLiked ? c + 1 : Math.max(0, c - 1));
                } finally {
                  setLikingGuide(false);
                }
              }}
            >
              <Heart
                size={20}
                strokeWidth={1.5}
                className={liked ? 'fill-gray-900 text-gray-900' : 'text-gray-500'}
              />
              {likeCount > 0 && <span className="text-sm text-gray-500">{likeCount}</span>}
            </button>

            {/* Comment */}
            <button
              className="flex items-center gap-1.5 active:scale-90 transition-transform"
              onClick={async () => {
                setShowComments(v => !v);
                if (!commentsLoaded) {
                  const loaded = await getGuideComments(guide.id);
                  setComments(loaded);
                  setCommentCount(loaded.length);
                  setCommentsLoaded(true);
                }
              }}
            >
              <MessageCircle
                size={20}
                strokeWidth={1.5}
                className={showComments ? 'text-gray-900' : 'text-gray-500'}
              />
              {commentCount > 0 && <span className="text-sm text-gray-500">{commentCount}</span>}
            </button>

            {/* Send / Share */}
            <button
              className="active:scale-90 transition-transform"
              onClick={() => setShowShare(true)}
            >
              <Send size={20} strokeWidth={1.5} className="text-gray-500" />
            </button>

            {/* Save / Subscribe — for non-owners only */}
            {!isOwn && currentUserId && (
              <button
                disabled={colSheetLoading}
                className="ml-auto active:scale-90 transition-transform"
                onClick={async () => {
                  setColSheetLoading(true);
                  // Auto-save to All Saved immediately
                  if (!subscribed) {
                    setSubscribed(true);
                    setSubscriberCount(c => c + 1);
                    subscribeToGuide(currentUserId, guide.id);
                  }
                  const [cols, ids] = await Promise.all([
                    getUserCollections(currentUserId),
                    getGuideCollectionIds(guide.id, currentUserId),
                  ]);
                  setColSheetCollections(cols);
                  setColSheetIds(ids);
                  setShowColSheet(true);
                  setColSheetLoading(false);
                }}
              >
                {colSheetLoading
                  ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400" />
                  : (subscribed || colSheetIds.size > 0)
                    ? <BookmarkCheck size={20} strokeWidth={1.5} className="text-gray-900" />
                    : <Bookmark size={20} strokeWidth={1.5} className="text-gray-500" />}
              </button>
            )}
          </div>

          {/* Comments panel */}
          {showComments && (
            <div className="border-b border-gray-100">
              {comments.filter(c => !blockedUsers.has(c.userId)).length > 0 && (
                <div className="px-5 pt-3 space-y-3">
                  {comments.filter(c => !blockedUsers.has(c.userId)).map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      {c.profile.avatarUrl
                        ? <img src={c.profile.avatarUrl} alt={c.profile.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                        : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-gray-500">{c.profile.name[0]?.toUpperCase()}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-gray-900 mr-1.5">{c.profile.name}</span>
                        <span className="text-xs text-gray-700">{c.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {currentUserId && (
                <div className="flex items-center gap-2.5 px-5 py-3">
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && commentText.trim() && !submittingComment) {
                        setSubmittingComment(true);
                        const added = await addGuideComment(guide.id, currentUserId, commentText.trim());
                        if (added) {
                          setComments(prev => [...prev, added]);
                          setCommentCount(c => c + 1);
                          setCommentText('');
                        }
                        setSubmittingComment(false);
                      }
                    }}
                    placeholder="Add a comment…"
                    className="flex-1 text-sm bg-gray-50 rounded-full px-3.5 py-2 outline-none focus:bg-gray-100 transition-colors"
                  />
                  <button
                    disabled={!commentText.trim() || submittingComment}
                    onClick={async () => {
                      if (!commentText.trim() || submittingComment) return;
                      setSubmittingComment(true);
                      const added = await addGuideComment(guide.id, currentUserId, commentText.trim());
                      if (added) {
                        setComments(prev => [...prev, added]);
                        setCommentCount(c => c + 1);
                        setCommentText('');
                      }
                      setSubmittingComment(false);
                    }}
                    className="text-xs font-bold text-gray-900 disabled:text-gray-300"
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          )}

          {guide.description && (
            <p className="px-5 py-3 text-sm text-gray-600 leading-relaxed border-b border-gray-100">{guide.description}</p>
          )}

          {/* Places header + map toggle — sticky */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {guide.places?.length ?? 0} place{(guide.places?.length ?? 0) !== 1 ? 's' : ''}
            </p>
            {mapPlaces.length > 0 && (
              <button
                onClick={() => setShowMap(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <Map size={11} strokeWidth={1.5} />
                {showMap ? 'Hide map' : 'Show map'}
              </button>
            )}
          </div>

          {/* Map view */}
          {showMap && mapPlaces.length > 0 && (
            <div className="px-4 pb-4">
              <Suspense fallback={<div className="h-52 bg-gray-100 animate-pulse rounded-2xl" />}>
                <div className="rounded-2xl overflow-hidden">
                  <MapView places={mapPlaces} height="300px" hideZoomControls zoom={12} center={[mapPlaces[0].lat, mapPlaces[0].lng]} />
                </div>
              </Suspense>
            </div>
          )}

          {/* Places list */}
          <div className="py-4">
            {!guide.planId ? (
              guide.places && guide.places.length > 0 ? (
                <div className="space-y-3 px-4">
                  {guide.places.map((place: any, i: number) => {
                    const photos: string[] = place.photoUrls?.length > 0
                      ? place.photoUrls
                      : (place.photoUrl ? [place.photoUrl] : []);

                    const mappedPlace: RealPostPlace = {
                      id: place.id ?? `place-${i}`,
                      name: place.name,
                      category: place.category ?? '',
                      neighborhood: place.neighborhood ?? '',
                      city: place.city ?? guide.destination ?? '',
                      country: '',
                      photoUrl: photos[0] ?? '',
                      position: i,
                      lat: place.lat ?? null,
                      lng: place.lng ?? null,
                      description: place.description || place.note || '',
                    };

                    const sublabel = [place.neighborhood, place.city].filter(Boolean).join(', ');
                    const isSaved = savedPlaceIds.has(place.id ?? '');

                    return (
                      <div key={place.id ?? i} className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
                        {/* Photo carousel or tap zone */}
                        <div className="relative">
                          <button
                            className="w-full text-left active:opacity-90 transition-opacity"
                            onClick={() => onPlaceClick?.(mappedPlace)}
                          >
                            {photos.length > 0
                              ? <ImageCarousel
                                  images={photos}
                                  labels={[`${i + 1}. ${place.name}`]}
                                  sublabels={sublabel ? [sublabel] : undefined}
                                  aspectRatio="3/2"
                                />
                              : (
                                <div className="px-3 pt-3 pb-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-900 leading-tight flex-1 truncate">{place.name}</p>
                                    {place.category && <span className="text-sm flex-shrink-0">{categoryEmoji[place.category.toLowerCase()] ?? ''}</span>}
                                  </div>
                                  {sublabel && <p className="text-xs text-gray-400 mt-0.5 truncate">{sublabel}</p>}
                                </div>
                              )
                            }
                          </button>
                          {/* Save bookmark */}
                          {currentUserId && place.id && (
                            <button
                              className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (isSaved) {
                                  // Already saved — open sheet so user can remove or add to trip/collection
                                  setPlaceSaveColLoading(true);
                                  setPlaceSaveSheet({ id: place.id, name: place.name, category: place.category, photoUrl: photos[0], neighborhood: place.neighborhood, city: place.city, lat: place.lat, lng: place.lng });
                                  const [cols, colIds] = await Promise.all([
                                    getUserCollections(currentUserId),
                                    getPlaceCollectionIds(place.id),
                                  ]);
                                  setPlaceSaveCollections(cols);
                                  setPlaceSaveColIds(colIds);
                                  setPlaceSaveColLoading(false);
                                } else {
                                  await savePlace(currentUserId, place.id);
                                  setSavedPlaceIds(prev => new Set([...prev, place.id]));
                                  setPlaceSaveColLoading(true);
                                  setPlaceSaveSheet({ id: place.id, name: place.name, category: place.category, photoUrl: photos[0], neighborhood: place.neighborhood, city: place.city, lat: place.lat, lng: place.lng });
                                  const [cols, colIds] = await Promise.all([
                                    getUserCollections(currentUserId),
                                    getPlaceCollectionIds(place.id),
                                  ]);
                                  setPlaceSaveCollections(cols);
                                  setPlaceSaveColIds(colIds);
                                  setPlaceSaveColLoading(false);
                                }
                              }}
                            >
                              {isSaved
                                ? <BookmarkCheck size={12} strokeWidth={2} className="text-white" />
                                : <Bookmark size={12} strokeWidth={2} className="text-white" />
                              }
                            </button>
                          )}
                        </div>
                        {/* Caption + audio */}
                        {(place.description || place.note || place.audioUrl) && (
                          <div className="px-3 pt-2.5 pb-3">
                            {(place.description || place.note) && (
                              <p className="text-xs text-gray-500 leading-relaxed">{place.description || place.note}</p>
                            )}
                            {place.audioUrl && <AudioPlayer src={place.audioUrl} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No places added yet.</p>
              )
            ) : loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            ) : !plan ? (
              <p className="text-sm text-gray-400 text-center py-8">No itinerary available</p>
            ) : (
              <div className="space-y-5 px-5">
                {plan.days.map(day => (
                  day.items.length > 0 && (
                    <div key={day.id ?? day.label}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{day.label}</p>
                      <div className="space-y-2">
                        {day.items.map(item => (
                          <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                              : <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-lg">{categoryEmoji[item.category?.toLowerCase() ?? ''] ?? '📍'}</div>
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                              {item.neighborhood && <p className="text-xs text-gray-400 truncate">{item.neighborhood}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
          <div className="h-6" />
        </div>
      </div>

      {/* ── Options sheet (···) ─────────────────────────────────── */}
      {showOptions && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowOptions(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            {optionsReportStep === 'options' && (
              <>
                <div className="py-1">
                  {isOwn ? (
                    <>
                      {onEditGuide && (
                        <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                          onClick={() => { setShowOptions(false); onEditGuide(); onClose(); }}>
                          <Edit3 size={18} strokeWidth={1.5} className="text-gray-700" />
                          <span className="text-sm text-gray-900">Edit</span>
                        </button>
                      )}
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => setOptionsReportStep('deleteConfirm')}>
                        <Trash2 size={18} strokeWidth={1.5} className="text-red-500" />
                        <span className="text-sm text-red-500">Delete</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => setOptionsReportStep('reason')}>
                        <Flag size={18} strokeWidth={1.5} className="text-gray-500" />
                        <span className="text-sm text-gray-900">Report</span>
                        <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto" />
                      </button>
                      {currentUserId && (
                        <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                          onClick={() => {
                            setShowOptions(false);
                            setGuideActionModal({
                              avatarUrl: guide.profile.avatarUrl,
                              title: `Block @${guide.profile.username || guide.profile.name}?`,
                              subtitle: "They won't be able to see your profile or posts, and you won't see theirs.",
                              confirmLabel: 'Block',
                              confirmVariant: 'red',
                              onConfirm: async () => {
                                if (!currentUserId) return;
                                await blockUser(currentUserId, guide.userId);
                                setGuideActionModal(null);
                                onClose();
                              },
                            });
                          }}>
                          <UserX size={18} strokeWidth={1.5} className="text-gray-500" />
                          <span className="text-sm text-gray-900">Block @{guide.profile.username || guide.profile.name}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {optionsReportStep === 'reason' && (
              <>
                <div className="px-5 pb-3 border-b border-gray-100">
                  <p className="text-base font-bold text-gray-900">Report</p>
                  <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
                </div>
                <div className="py-1">
                  {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(reason => (
                    <button key={reason} className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50"
                      onClick={async () => {
                        if (!currentUserId) return;
                        setOptionsReportReason(reason);
                        await reportContent(currentUserId, { userId: guide.userId, reason });
                        setShowOptions(false);
                        setGuideActionModal({
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
            {optionsReportStep === 'deleteConfirm' && (
              <div className="flex flex-col items-center px-6 pb-2 pt-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Trash2 size={28} strokeWidth={1.5} className="text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Delete this guide?</p>
                <p className="text-sm text-gray-400 text-center mb-6">This can't be undone.</p>
                <button className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
                  onClick={async () => {
                    await deleteGuide(guide.id);
                    onDeleteGuide?.(guide.id);
                    setShowOptions(false);
                    onClose();
                  }}>
                  Delete
                </button>
                <button className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold"
                  onClick={() => setOptionsReportStep('options')}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {guideActionModal && (
        <ActionModal
          avatarUrl={guideActionModal.avatarUrl}
          iconType={guideActionModal.iconType}
          title={guideActionModal.title}
          subtitle={guideActionModal.subtitle}
          confirmLabel={guideActionModal.confirmLabel}
          confirmVariant={guideActionModal.confirmVariant}
          onConfirm={guideActionModal.onConfirm}
          onCancel={() => setGuideActionModal(null)}
        />
      )}

      {/* ── Save to Collection sheet ─────────────────────────── */}
      {showColSheet && currentUserId && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end" onClick={() => { setShowColSheet(false); setColSheetShowNew(false); setColSheetNewName(''); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
              {colSheetCollections.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No collections yet — create one first</p>
              )}
              {colSheetCollections.map(col => {
                const inCol = colSheetIds.has(col.id);
                return (
                  <button key={col.id} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                    onClick={async () => {
                      if (inCol) {
                        setColSheetIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        await removeGuideFromCollection(col.id, guide.id);
                        const remaining = new Set(colSheetIds); remaining.delete(col.id);
                        if (remaining.size === 0 && subscribed) {
                          setSubscribed(false);
                          setSubscriberCount(c => Math.max(0, c - 1));
                          unsubscribeFromGuide(currentUserId, guide.id);
                        }
                      } else {
                        setColSheetIds(prev => new Set(prev).add(col.id));
                        await addGuideToCollection(col.id, guide.id, currentUserId);
                        if (!subscribed) {
                          setSubscribed(true);
                          setSubscriberCount(c => c + 1);
                          subscribeToGuide(currentUserId, guide.id);
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
            {/* New collection */}
            <div className="px-4 pt-3 pb-2">
              {colSheetShowNew ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={colSheetNewName}
                    onChange={e => setColSheetNewName(e.target.value)}
                    placeholder="Collection name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setColSheetShowNew(false); setColSheetNewName(''); }
                      if (e.key === 'Enter' && colSheetNewName.trim() && currentUserId) {
                        setColSheetCreating(true);
                        const { data: col } = await createCollection(currentUserId, { name: colSheetNewName.trim(), emoji: '🗂️', description: '' });
                        if (col) {
                          setColSheetCollections(prev => [{ ...col, placesCount: 0 }, ...prev]);
                          // Auto-add the guide to this new collection
                          await addGuideToCollection(col.id, guide.id, currentUserId);
                          setColSheetIds(prev => new Set(prev).add(col.id));
                          if (!subscribed) { setSubscribed(true); setSubscriberCount(c => c + 1); subscribeToGuide(currentUserId, guide.id); }
                        }
                        setColSheetNewName('');
                        setColSheetShowNew(false);
                        setColSheetCreating(false);
                      }
                    }}
                  />
                  <button
                    disabled={!colSheetNewName.trim() || colSheetCreating}
                    onClick={async () => {
                      if (!colSheetNewName.trim() || !currentUserId) return;
                      setColSheetCreating(true);
                      const { data: col } = await createCollection(currentUserId, { name: colSheetNewName.trim(), emoji: '🗂️', description: '' });
                      if (col) {
                        setColSheetCollections(prev => [{ ...col, placesCount: 0 }, ...prev]);
                        await addGuideToCollection(col.id, guide.id, currentUserId);
                        setColSheetIds(prev => new Set(prev).add(col.id));
                        if (!subscribed) { setSubscribed(true); setSubscriberCount(c => c + 1); subscribeToGuide(currentUserId, guide.id); }
                      }
                      setColSheetNewName('');
                      setColSheetShowNew(false);
                      setColSheetCreating(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {colSheetCreating ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setColSheetShowNew(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Plus size={15} strokeWidth={2} className="text-gray-600" />
                  </div>
                  New collection
                </button>
              )}
            </div>
            <div className="mx-4 border-t border-gray-100" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={() => {
                  if (!currentUserId) return;
                  unsubscribeFromGuide(currentUserId, guide.id);
                  setSubscribed(false);
                  setSubscriberCount(c => Math.max(0, c - 1));
                  setShowColSheet(false);
                  setColSheetIds(new Set());
                  setColSheetShowNew(false);
                  setColSheetNewName('');
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

      {/* ── Place Save Sheet (individual place bookmark) ─────── */}
      {placeSaveSheet && currentUserId && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end" onClick={() => { setPlaceSaveSheet(null); setPlaceSaveColIds(new Set()); setPlaceSaveShowNewCol(false); setPlaceSaveNewColName(''); setPlaceSavePlanAdded(new Set()); setPlaceSaveShowNewTrip(false); setPlaceSaveNewTripName(''); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">Also add "{placeSaveSheet.name}" to a collection?</p>
            </div>
            {placeSaveColLoading ? (
              <div className="px-4 space-y-3 pb-4">
                {[0, 1].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="px-4 space-y-2 max-h-48 overflow-y-auto">
                {placeSaveCollections.map(col => {
                  const inCol = placeSaveColIds.has(col.id);
                  return (
                    <button key={col.id}
                      onClick={async () => {
                        if (!placeSaveSheet) return;
                        if (inCol) {
                          await removePlaceFromCollection(col.id, placeSaveSheet.id);
                          setPlaceSaveColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        } else {
                          await addPlaceToCollection(col.id, placeSaveSheet.id);
                          setPlaceSaveColIds(prev => new Set(prev).add(col.id));
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
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
            <div className="px-4 pt-3">
              {placeSaveShowNewCol ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={placeSaveNewColName}
                    onChange={e => setPlaceSaveNewColName(e.target.value)}
                    placeholder="Collection name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setPlaceSaveShowNewCol(false); setPlaceSaveNewColName(''); }
                      if (e.key === 'Enter' && placeSaveNewColName.trim() && placeSaveSheet) {
                        setPlaceSaveCreatingCol(true);
                        const { data: col } = await createCollection(currentUserId, { name: placeSaveNewColName.trim(), emoji: '🗂️', description: '' });
                        if (col) {
                          await addPlaceToCollection(col.id, placeSaveSheet.id);
                          setPlaceSaveCollections(prev => [{ ...col, placesCount: 1 }, ...prev]);
                          setPlaceSaveColIds(prev => new Set(prev).add(col.id));
                        }
                        setPlaceSaveNewColName(''); setPlaceSaveShowNewCol(false); setPlaceSaveCreatingCol(false);
                      }
                    }}
                  />
                  <button
                    disabled={!placeSaveNewColName.trim() || placeSaveCreatingCol}
                    onClick={async () => {
                      if (!placeSaveNewColName.trim() || !placeSaveSheet) return;
                      setPlaceSaveCreatingCol(true);
                      const { data: col } = await createCollection(currentUserId, { name: placeSaveNewColName.trim(), emoji: '🗂️', description: '' });
                      if (col) {
                        await addPlaceToCollection(col.id, placeSaveSheet.id);
                        setPlaceSaveCollections(prev => [{ ...col, placesCount: 1 }, ...prev]);
                        setPlaceSaveColIds(prev => new Set(prev).add(col.id));
                      }
                      setPlaceSaveNewColName(''); setPlaceSaveShowNewCol(false); setPlaceSaveCreatingCol(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {placeSaveCreatingCol ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setPlaceSaveShowNewCol(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New collection
                </button>
              )}
            </div>

            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {placeSavePlans.length === 0 && !placeSaveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {placeSavePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {placeSavePlans.map(plan => {
                    const added = placeSavePlanAdded.has(plan.id);
                    const adding = placeSavePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!placeSaveSheet) return;
                          setPlaceSavePlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              await createPlanItem(plan.id, day.id, {
                                name: placeSaveSheet.name,
                                category: placeSaveSheet.category || '',
                                image_url: placeSaveSheet.photoUrl || '',
                                time_label: '',
                                address: [placeSaveSheet.neighborhood, placeSaveSheet.city].filter(Boolean).join(', '),
                                neighborhood: placeSaveSheet.neighborhood || '',
                                position: day.items.length,
                                lat: placeSaveSheet.lat ?? null,
                                lng: placeSaveSheet.lng ?? null,
                              });
                              setPlaceSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setPlaceSavePlanAdding(null);
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
              {placeSaveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={placeSaveNewTripName}
                    onChange={e => setPlaceSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setPlaceSaveShowNewTrip(false); setPlaceSaveNewTripName(''); }
                      if (e.key === 'Enter' && placeSaveNewTripName.trim()) {
                        setPlaceSaveCreatingTrip(true);
                        const newPlan = await createPlan(currentUserId, { title: placeSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setPlaceSavePlans(prev => [newPlan, ...prev]); setPlaceSaveShowNewTrip(false); setPlaceSaveNewTripName(''); }
                        setPlaceSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!placeSaveNewTripName.trim() || placeSaveCreatingTrip}
                    onClick={async () => {
                      if (!placeSaveNewTripName.trim()) return;
                      setPlaceSaveCreatingTrip(true);
                      const newPlan = await createPlan(currentUserId, { title: placeSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) { setPlaceSavePlans(prev => [newPlan, ...prev]); setPlaceSaveShowNewTrip(false); setPlaceSaveNewTripName(''); }
                      setPlaceSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {placeSaveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setPlaceSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
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
                  if (!placeSaveSheet) return;
                  await unsavePlace(currentUserId, placeSaveSheet.id);
                  setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(placeSaveSheet.id); return n; });
                  setPlaceSaveSheet(null);
                  setPlaceSavePlanAdded(new Set());
                  setPlaceSaveShowNewTrip(false);
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

      {/* ── Share sheet ───────────────────────────────────────── */}
      {showShare && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeShare} />
          <div className="relative bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={closeShare} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={shareSearch}
                  onChange={e => {
                    const q = e.target.value;
                    setShareSearch(q);
                    if (shareSearchRef.current) clearTimeout(shareSearchRef.current);
                    if (!q.trim()) { setShareResults([]); setSearchingShare(false); return; }
                    setSearchingShare(true);
                    shareSearchRef.current = setTimeout(async () => {
                      if (!currentUserId) return;
                      const r = await searchProfiles(q, currentUserId);
                      setShareResults(r);
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
              const showSearch = shareSearch.trim().length > 0;
              const list = showSearch
                ? shareResults.map(u => ({ id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl }))
                : conversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && list.length === 0 && !searchingShare) {
                return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              }
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const sent = shareSentTo.has(person.id);
                    const initials = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button key={person.id}
                        onClick={async () => {
                          if (sent || !currentUserId) return;
                          const convId = await getOrCreateConversation(currentUserId, person.id);
                          if (convId) {
                            const text = `Guide: "${guide.title}"${guide.destination ? ` — ${guide.destination}` : ''}`;
                            await sendMessage(convId, currentUserId, text);
                            setShareSentTo(prev => new Set(prev).add(person.id));
                          }
                        }}
                        className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl active:bg-gray-50 text-left"
                      >
                        {person.avatarUrl
                          ? <img src={person.avatarUrl} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{initials}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
                          <p className="text-xs text-gray-400 truncate">@{person.username}</p>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${sent ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>
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
                onClick={() => {
                  const text = `📖 "${guide.title}"${guide.destination ? ` — ${guide.destination}` : ''}`;
                  navigator.clipboard.writeText(text).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 1500);
                  }).catch(() => {});
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {linkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                </div>
                <span className="text-sm font-semibold text-gray-900">{linkCopied ? 'Copied!' : 'Copy guide name'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collaborators sheet ───────────────────────────────── */}
      {showCollabSheet && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeCollabSheet} />
          <div className="relative bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Collaborators</h3>
              <button onClick={closeCollabSheet} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>

            {/* Current collaborators */}
            {collaborators.length > 0 && (
              <div className="px-5 mb-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Added</p>
                <div className="space-y-1">
                  {collaborators.map(c => (
                    <div key={c.userId} className="flex items-center gap-3 py-2">
                      {c.profile.avatarUrl
                        ? <img src={c.profile.avatarUrl} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">{c.profile.name[0]?.toUpperCase()}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.profile.name}</p>
                        <p className="text-xs text-gray-400">@{c.profile.username}</p>
                      </div>
                      {isOwn && (
                        <button
                          onClick={async () => {
                            await removeGuideCollaborator(guide.id, c.userId);
                            setCollaborators(prev => prev.filter(x => x.userId !== c.userId));
                          }}
                          className="text-xs text-red-400 font-semibold px-3 py-1.5 rounded-full bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search to add */}
            {isOwn && (
              <>
                <div className="px-5 pb-3">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                    <Search size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={collabSearch}
                      onChange={e => {
                        const q = e.target.value;
                        setCollabSearch(q);
                        if (collabSearchRef.current) clearTimeout(collabSearchRef.current);
                        if (!q.trim()) { setCollabResults([]); return; }
                        setSearchingCollab(true);
                        collabSearchRef.current = setTimeout(async () => {
                          if (!currentUserId) return;
                          const r = await searchProfiles(q, currentUserId);
                          setCollabResults(r.filter(u => u.id !== currentUserId && !collaborators.find(c => c.userId === u.id)));
                          setSearchingCollab(false);
                        }, 300);
                      }}
                      placeholder="Add collaborator..."
                      className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                    />
                    {searchingCollab && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
                  </div>
                </div>
                <div className="px-3 max-h-48 overflow-y-auto pb-10">
                  {collabResults.map(u => {
                    const adding = invitingCollab === u.id;
                    return (
                      <button key={u.id}
                        disabled={adding}
                        onClick={async () => {
                          if (!currentUserId) return;
                          setInvitingCollab(u.id);
                          const err = await addGuideCollaborator(guide.id, u.id, currentUserId);
                          if (!err) {
                            setCollaborators(prev => [...prev, {
                              id: `${guide.id}-${u.id}`,
                              guideId: guide.id,
                              userId: u.id,
                              invitedBy: currentUserId,
                              createdAt: new Date().toISOString(),
                              profile: { name: u.name, username: u.username, avatarUrl: u.avatarUrl },
                            }]);
                            setCollabResults(prev => prev.filter(x => x.id !== u.id));
                            setCollabSearch('');
                          }
                          setInvitingCollab(null);
                        }}
                        className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl active:bg-gray-50 text-left"
                      >
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{u.name[0]?.toUpperCase()}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400">@{u.username}</p>
                        </div>
                        <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-gray-900 text-white flex-shrink-0">
                          {adding ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
                        </div>
                      </button>
                    );
                  })}
                  {collaborators.length === 0 && !collabSearch && (
                    <p className="text-sm text-gray-400 text-center py-4">Search for people to add as collaborators</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
