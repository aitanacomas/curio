import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X, MapPin, Loader2, Play, Pause, Map, Share2, Send, Copy, Check, Search, UserPlus } from 'lucide-react';
import type { Guide, Plan, RealPostPlace, Conversation, FollowProfile, GuideCollaborator } from '../lib/supabase';
import {
  getPlans,
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
}

export default function GuideDetail({ guide, currentUserId, onClose, onDeleteGuide, onEditGuide, onPlaceClick }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  // Subscribe
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [togglingSubscribe, setTogglingSubscribe] = useState(false);

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
    }
  }, [guide.id, currentUserId, isOwn]);

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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="flex-1 overflow-y-auto">
          {/* Cover — full bleed */}
          {guide.coverUrl && (
            <div className="relative flex-shrink-0" style={{ height: guide.description ? 260 : 220 }}>
              <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
              <div className="absolute top-3 left-0 right-0 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-white/50" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                <h2 className="text-xl font-black text-white leading-tight">{guide.title}</h2>
                {guide.description && (
                  <p className="text-white/80 text-xs mt-1.5 leading-snug line-clamp-2">{guide.description}</p>
                )}
              </div>
              <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                <X size={14} strokeWidth={2} className="text-white" />
              </button>
            </div>
          )}

          {!guide.coverUrl && (
            <>
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pt-2 pb-3 flex items-start justify-between flex-shrink-0">
                <div className="flex-1 min-w-0 pr-3">
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">{guide.title}</h2>
                  {guide.destination && (
                    <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                      <MapPin size={11} strokeWidth={1.5} />{guide.destination}
                    </p>
                  )}
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                  <X size={14} strokeWidth={2} className="text-gray-600" />
                </button>
              </div>
            </>
          )}

          {/* Author row */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
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
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowShare(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                <Share2 size={14} strokeWidth={1.8} className="text-gray-600" />
              </button>
              {!isOwn && currentUserId && (
                <button
                  disabled={togglingSubscribe}
                  onClick={async () => {
                    setTogglingSubscribe(true);
                    if (subscribed) {
                      await unsubscribeFromGuide(currentUserId, guide.id);
                      setSubscribed(false);
                      setSubscriberCount(c => Math.max(0, c - 1));
                    } else {
                      await subscribeToGuide(currentUserId, guide.id);
                      setSubscribed(true);
                      setSubscriberCount(c => c + 1);
                    }
                    setTogglingSubscribe(false);
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                    subscribed
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {togglingSubscribe ? '…' : subscribed ? 'Following' : 'Follow'}
                </button>
              )}
              {isOwn && (
                <>
                  <button onClick={() => setShowCollabSheet(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                    <UserPlus size={14} strokeWidth={1.8} className="text-gray-600" />
                  </button>
                  {onEditGuide && (
                    <button onClick={() => { onEditGuide(); onClose(); }} className="text-xs text-gray-700 font-semibold px-3 py-1.5 rounded-full bg-gray-100">
                      Edit
                    </button>
                  )}
                  {onDeleteGuide && (
                    <button onClick={() => { onDeleteGuide(guide.id); onClose(); }} className="text-xs text-red-400 font-semibold px-3 py-1.5 rounded-full bg-red-50">
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>


          {/* Map toggle */}
          {mapPlaces.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-semibold text-gray-700">Places map</span>
                <button
                  onClick={() => setShowMap(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Map size={11} strokeWidth={1.5} />
                  {showMap ? 'Hide map' : 'Show map'}
                </button>
              </div>
              {showMap && (
                <div className="px-4 pb-4">
                  <Suspense fallback={<div className="h-52 bg-gray-100 animate-pulse rounded-2xl" />}>
                    <div className="rounded-2xl overflow-hidden">
                      <MapView places={mapPlaces} height="220px" hideZoomControls zoom={12} center={[mapPlaces[0].lat, mapPlaces[0].lng]} />
                    </div>
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* Places */}
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

                    return (
                      <div key={place.id ?? i} className="rounded-2xl overflow-hidden bg-gray-50">
                        {photos.length > 0 && <PlaceCarousel photos={photos} name={place.name} />}
                        <button
                          className="w-full text-left px-3 py-2.5 active:bg-gray-100 transition-colors"
                          onClick={() => onPlaceClick?.(mappedPlace)}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-gray-900 leading-tight flex-1 truncate">{place.name}</p>
                            {place.category && (
                              <span className="text-sm flex-shrink-0">{categoryEmoji[place.category.toLowerCase()] ?? ''}</span>
                            )}
                          </div>
                          {(place.neighborhood || place.city) && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {[place.neighborhood, place.city].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {(place.description || place.note) && (
                            <p className="text-xs text-gray-500 leading-relaxed mt-1.5">{place.description || place.note}</p>
                          )}
                          {place.audioUrl && <AudioPlayer src={place.audioUrl} />}
                        </button>
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
                            const text = `📖 Guide: "${guide.title}"${guide.destination ? ` — ${guide.destination}` : ''}`;
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
