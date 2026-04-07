import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X, Phone, Globe, Star, ExternalLink, Bookmark, BookmarkCheck, Loader2, Navigation, Heart, MessageCircle, Send, MapPin, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { supabase, getPostsAtPlace, getFollowing, getConversations, getOrCreateConversation, sendMessage, likePost, unlikePost, savePost, unsavePost, getLikedPosts, getSavedPosts, getPostLikeCounts, getPostComments, addComment, type Conversation, type PostComment, type RealPostPlace, type RealPost } from '../lib/supabase';
import { getBookingUrl, isBookable } from '../lib/placeUtils';
import type { AppUser } from '../types';

const MapView = lazy(() => import('./MapView'));

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', treats: '🍰', bar: '🍸', nightlife: '🎵',
  food: '🍕', hotel: '🏨', landmark: '🏛️', art: '🎨', nature: '🌿',
  beach: '🏖️', shop: '🛍️', experience: '🎡', neighbourhood: '🏘️',
  sports: '🎾', wellness: '💆', event: '🎟️', flight: '✈️', transport: '🚗',
};

interface Props {
  place: RealPostPlace;
  appUser?: AppUser;
  isSaved?: boolean;
  onClose: () => void;
  onToggleSave?: () => void;
  onViewUser?: (userId: string) => void;
  onSelectPlace?: (place: RealPostPlace) => void;
}

export default function PlacePage({ place, appUser, isSaved, onClose, onToggleSave, onViewUser, onSelectPlace }: Props) {
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [googlePhotos, setGooglePhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [todayHours, setTodayHours] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [placeLocation, setPlaceLocation] = useState<{ lat: number; lng: number } | null>(
    place.lat && place.lng ? { lat: place.lat, lng: place.lng } : null
  );
  const [selectedPost, setSelectedPost] = useState<RealPost | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [postPhotoIndex, setPostPhotoIndex] = useState(0);
  const [postIsLiked, setPostIsLiked] = useState(false);
  const [postLikeCount, setPostLikeCount] = useState(0);
  const [postIsSaved, setPostIsSaved] = useState(false);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const heroScrollRef = useRef<HTMLDivElement>(null);

  // New enrichment state
  const [description, setDescription] = useState<string | null>(place.description ?? null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [priceLevel, setPriceLevel] = useState<number | null>(null);
  const [weekdayDescriptions, setWeekdayDescriptions] = useState<string[]>([]);
  const [showAllHours, setShowAllHours] = useState(false);
  const [reviews, setReviews] = useState<{ rating: number; text: string; author: string; time: string }[]>([]);
  const [followSaves, setFollowSaves] = useState<{ id: string; name: string; username: string; avatarUrl: string | null }[]>([]);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [cityPlaces, setCityPlaces] = useState<RealPostPlace[]>([]);

  const curioPhotos = posts
    .map(p => p.places.find(pl => pl.name === place.name && pl.photoUrl))
    .filter((pl): pl is NonNullable<typeof pl> => !!pl)
    .map(pl => pl.photoUrl);
  const allPhotos = [...curioPhotos, ...googlePhotos];

  useEffect(() => {
    setLoadingPosts(true);
    getPostsAtPlace(place.name).then(results => {
      setPosts(results);
      setLoadingPosts(false);
    });
  }, [place.name]);

  useEffect(() => {
    setLoadingPhotos(true);
    const query = [place.name, place.neighborhood, place.city].filter(Boolean).join(', ');
    fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'places.regularOpeningHours,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.photos,places.location,places.editorialSummary,places.priceLevel,places.reviews',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
    })
      .then(r => r.json())
      .then(data => {
        const p = data.places?.[0];
        if (!p) return;
        if (p.regularOpeningHours) {
          setOpenNow(p.regularOpeningHours.openNow ?? null);
          const dayIdx = new Date().getDay();
          const desc: string[] = p.regularOpeningHours.weekdayDescriptions ?? [];
          const adjusted = dayIdx === 0 ? desc[6] : desc[dayIdx - 1];
          if (adjusted) {
            const parts = adjusted.split(': ');
            setTodayHours(parts[1] ?? adjusted);
          }
        }
        if (p.rating) setRating(p.rating);
        if (p.userRatingCount) setReviewCount(p.userRatingCount);
        if (p.nationalPhoneNumber) setPhone(p.nationalPhoneNumber);
        if (p.websiteUri) setWebsite(p.websiteUri);
        if (p.editorialSummary) setDescription(typeof p.editorialSummary === 'string' ? p.editorialSummary : (p.editorialSummary.text ?? null));
        if (p.priceLevel !== undefined && p.priceLevel !== null) {
          if (typeof p.priceLevel === 'number' && p.priceLevel > 0) {
            setPriceLevel(p.priceLevel);
          } else if (typeof p.priceLevel === 'string') {
            const map: Record<string, number> = {
              PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1,
              PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
            };
            const val = map[p.priceLevel];
            if (val !== undefined) setPriceLevel(val);
          }
        }
        if (p.regularOpeningHours?.weekdayDescriptions) setWeekdayDescriptions(p.regularOpeningHours.weekdayDescriptions);
        if (p.reviews) {
          setReviews((p.reviews as any[]).slice(0, 3).map((r: any) => ({
            rating: r.rating ?? 5,
            text: r.text?.text ?? '',
            author: r.authorAttribution?.displayName ?? 'Anonymous',
            time: r.relativePublishTimeDescription ?? '',
          })));
        }
        if (p.location && !placeLocation) {
          setPlaceLocation({ lat: p.location.latitude, lng: p.location.longitude });
        }
        const photoNames: string[] = (p.photos ?? []).slice(1, 11).map((ph: any) => ph.name);
        const urls = photoNames.map(name =>
          `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`
        );
        setGooglePhotos(urls);
      })
      .catch(() => {})
      .finally(() => setLoadingPhotos(false));
  }, [place.name, place.neighborhood, place.city]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate AI description when Google has no editorial summary
  useEffect(() => {
    if (loadingPhotos) return;
    if (description) return;
    const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY as string;
    if (!GEMINI_KEY) return;
    // Check sessionStorage cache first
    const cacheKey = `desc:${place.name}:${place.city}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { setAiDescription(cached); return; }
    const loc = [place.neighborhood, place.city, place.country].filter(Boolean).join(', ');
    const ratingHint = rating ? ` It has a ${rating}★ rating from ${reviewCount?.toLocaleString() ?? 'many'} visitors.` : '';
    const prompt = `Write one concise sentence (max 20 words) describing "${placeName}", a ${place.category || 'place'} located in ${loc}.${ratingHint} Only use the facts provided. Do not invent details. No quotes, no hashtags, no filler phrases like "hidden gem" or "must-visit".`;
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 40, temperature: 0.2 } }),
    })
      .then(r => { if (r.status === 429) throw new Error('rate_limit'); return r.json(); })
      .then(data => {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) { sessionStorage.setItem(cacheKey, text); setAiDescription(text); }
      })
      .catch(() => {});
  }, [loadingPhotos, description]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load other places in the same city
  useEffect(() => {
    if (!place.city) return;
    supabase
      .from('post_places')
      .select('id, name, category, neighborhood, city, country, photo_url, position, lat, lng')
      .eq('city', place.city)
      .not('photo_url', 'is', null)
      .limit(30)
      .then(({ data }) => {
        if (!data) return;
        const normalizedCurrent = place.name.split(',')[0].trim().toLowerCase();
        const seen = new Set<string>();
        const result: RealPostPlace[] = [];
        for (const pl of data as any[]) {
          const key = (pl.name as string).split(',')[0].trim().toLowerCase();
          if (key !== normalizedCurrent && !seen.has(key)) {
            seen.add(key);
            result.push({
              id: pl.id, name: pl.name, category: pl.category ?? '',
              neighborhood: pl.neighborhood ?? '', city: pl.city ?? '',
              country: pl.country ?? '', photoUrl: pl.photo_url ?? '',
              position: pl.position ?? 0, lat: pl.lat ?? null, lng: pl.lng ?? null,
            });
          }
        }
        setCityPlaces(result.slice(0, 8));
      });
  }, [place.city, place.name]); // eslint-disable-line react-hooks/exhaustive-deps


  // Load who among following saved this place
  useEffect(() => {
    if (!appUser?.id) return;
    Promise.all([
      supabase.from('saved_places').select('user_id, profiles!user_id(id, name, username, avatar_url)').eq('post_place_id', place.id).neq('user_id', appUser.id),
      getFollowing(appUser.id),
    ]).then(([{ data }, following]) => {
      if (!data) return;
      const mutual = (data as any[]).filter(d => following.has(d.user_id));
      setFollowSaves(mutual.slice(0, 5).map(d => ({
        id: d.user_id,
        name: d.profiles?.name ?? '',
        username: d.profiles?.username ?? '',
        avatarUrl: d.profiles?.avatar_url ?? null,
      })));
    });
  }, [place.id, appUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load like/save/comment state when a post is selected
  useEffect(() => {
    if (!selectedPost) return;
    setPostIsLiked(false);
    setPostLikeCount(0);
    setPostIsSaved(false);
    setPostComments([]);
    setShowCommentInput(false);
    setCommentText('');

    const userId = appUser?.id;
    getPostLikeCounts([selectedPost.id]).then(counts => setPostLikeCount(counts[selectedPost.id] ?? 0));
    getPostComments(selectedPost.id).then(setPostComments);
    if (userId) {
      getLikedPosts(userId).then(liked => setPostIsLiked(liked.has(selectedPost.id)));
      getSavedPosts(userId).then(saved => setPostIsSaved(saved.has(selectedPost.id)));
    }
  }, [selectedPost?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookable = isBookable(place.category);
  const placeName = place.name.split(',')[0].trim();

  const openDirections = () => {
    const q = encodeURIComponent(`${place.name} ${place.city}`);
    window.open(`https://maps.google.com/?q=${q}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="flex flex-col justify-end w-full h-full" style={{ maxWidth: 384, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
      <div
        className="relative bg-white rounded-t-3xl"
        style={{ maxHeight: '96vh', transform: 'translateZ(0)', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
      >
        {/* Single scrollable column — corners clipped by container */}
        <div className="overflow-y-auto overflow-x-hidden rounded-t-3xl" style={{ maxHeight: '96vh', paddingBottom: 80 }}>

          {/* Sticky header — drag handle + X always visible */}
          <div className="sticky top-0 z-30 flex justify-between items-start px-3 pt-3 pointer-events-none" style={{ marginBottom: -44 }}>
            <div className="w-8" />
            <div className="w-9 h-1 bg-white/60 rounded-full mt-0.5" />
            <button onClick={onClose} className="pointer-events-auto w-8 h-8 bg-black/40 rounded-full flex items-center justify-center">
              <X size={14} strokeWidth={2} className="text-white" />
            </button>
          </div>

          {/* Hero photos — scroll-snap carousel */}
          <div className="relative rounded-t-3xl overflow-hidden bg-gray-100" style={{ aspectRatio: '3/4' }}>
            {loadingPhotos && allPhotos.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-gray-300" />
              </div>
            ) : allPhotos.length > 0 ? (
              <>
                <div
                  ref={heroScrollRef}
                  className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory"
                  style={{ scrollbarWidth: 'none' }}
                  onScroll={e => {
                    const el = e.currentTarget;
                    setPhotoIndex(Math.round(el.scrollLeft / el.offsetWidth));
                  }}
                >
                  {allPhotos.map((src, i) => (
                    <div key={i} className="flex-shrink-0 w-full h-full snap-start">
                      <img src={src} alt={placeName} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                {/* Gradient + title overlay — matches ImageCarousel style */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 flex items-end justify-between gap-3 pointer-events-none">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-[15px] leading-tight truncate drop-shadow-sm">{placeName}</p>
                    <p className="text-white/80 text-xs mt-0.5 truncate drop-shadow-sm">
                      {[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}
                    </p>
                  </div>
                  {allPhotos.length > 1 && (
                    <span className="text-white text-[11px] font-semibold bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 leading-none flex-shrink-0">
                      {photoIndex + 1} / {allPhotos.length}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">
                {categoryEmoji[place.category] ?? '📍'}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="px-5 pt-4 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-2">
              {place.category && (
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 font-medium">
                  {categoryEmoji[place.category] ?? '📍'} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
                </span>
              )}
              {priceLevel !== null && priceLevel > 0 && (
                <span className="text-xs font-semibold text-gray-500 flex-shrink-0">
                  {'$'.repeat(priceLevel)}
                </span>
              )}
            </div>

            {(description ?? aiDescription) && (
              <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">{description ?? aiDescription}</p>
            )}

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {rating !== null && (
                <div className="flex items-center gap-1">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-gray-800">{rating.toFixed(1)}</span>
                  {reviewCount !== null && (
                    <span className="text-xs text-gray-400">({reviewCount.toLocaleString()})</span>
                  )}
                </div>
              )}
              {openNow !== null && (
                <button
                  onClick={() => weekdayDescriptions.length > 0 && setShowAllHours(h => !h)}
                  className="flex items-center gap-1.5"
                >
                  <span className={`text-xs font-semibold ${openNow ? 'text-green-600' : 'text-red-500'}`}>
                    {openNow ? 'Open now' : 'Closed'}
                  </span>
                  {todayHours && <span className="text-xs text-gray-400">· {todayHours}</span>}
                  {weekdayDescriptions.length > 0 && (
                    showAllHours ? <ChevronUp size={11} className="text-gray-400" /> : <ChevronDown size={11} className="text-gray-400" />
                  )}
                </button>
              )}
            </div>

            {showAllHours && weekdayDescriptions.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {weekdayDescriptions.map((d, i) => {
                  const [day, ...rest] = d.split(': ');
                  const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                  return (
                    <div key={i} className={`flex justify-between text-xs ${isToday ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                      <span>{day}</span>
                      <span>{rest.join(': ')}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {(phone || website) && (
              <div className="flex items-center gap-3 mt-2.5">
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone size={11} strokeWidth={1.5} />
                    <span>{phone}</span>
                  </a>
                )}
                {website && !/instagram|facebook|twitter|tiktok|yelp|tripadvisor|youtube|snapchat|linkedin/.test(website) && (
                  <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500">
                    <Globe size={11} strokeWidth={1.5} />
                    <span className="truncate max-w-[140px]">{website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                    <ExternalLink size={9} strokeWidth={1.5} />
                  </a>
                )}
              </div>
            )}

            {/* Who saved this */}
            {followSaves.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex -space-x-1.5">
                  {followSaves.slice(0, 4).map(u => (
                    u.avatarUrl
                      ? <img key={u.id} src={u.avatarUrl} className="w-5 h-5 rounded-full border-2 border-white object-cover" alt={u.name} />
                      : <div key={u.id} className="w-5 h-5 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[7px] font-bold text-gray-600">{u.name[0]?.toUpperCase()}</div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {followSaves.length === 1
                    ? <><span className="font-semibold">{followSaves[0].username}</span> saved this</>
                    : <><span className="font-semibold">{followSaves[0].username}</span> and {followSaves.length - 1} other{followSaves.length > 2 ? 's' : ''} saved this</>
                  }
                </p>
              </div>
            )}
          </div>

          {/* Map */}
          {placeLocation && (
            <div className="px-5 pt-4 pb-2">
              <div className="rounded-2xl overflow-hidden" style={{ height: 140 }}>
                <Suspense fallback={<div className="h-full bg-gray-100 animate-pulse rounded-2xl" />}>
                  <MapView
                    places={[{
                      id: place.id, name: placeName, lat: placeLocation.lat, lng: placeLocation.lng,
                      neighbourhood: place.neighborhood ?? '', city: place.city ?? '', country: place.country ?? '',
                    }]}
                    center={[placeLocation.lat, placeLocation.lng]}
                    zoom={15}
                    height="140px"
                  />
                </Suspense>
              </div>
              {bookable && (
                <button
                  onClick={openDirections}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700"
                >
                  <Navigation size={12} strokeWidth={1.5} />
                  Get directions
                </button>
              )}
            </div>
          )}

          {/* Reviews — hidden by default */}
          {reviews.length > 0 && (
            <div className="px-5 pt-4 pb-4 border-b border-gray-100">
              <button
                onClick={() => setShowReviews(r => !r)}
                className="flex items-center justify-between w-full"
              >
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Reviews {reviewCount !== null ? `(${reviewCount.toLocaleString()})` : ''}
                </p>
                {showReviews ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {showReviews && (
                <div className="space-y-3 mt-3">
                  {reviews.map((r, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star key={s} size={9} className={s < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{r.author}</span>
                        <span className="text-xs text-gray-400 ml-auto">{r.time}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* More in same city — DB places only (no Google photos to avoid Street View imagery with text) */}
          {!loadingPosts && (() => {
            const currentKey = place.name.split(',')[0].trim().toLowerCase();
            const postPlaceKeys = new Set(posts.flatMap(p => p.places.map(pl => pl.name.split(',')[0].trim().toLowerCase())));
            const dbFiltered = cityPlaces.filter(pl => {
              const key = pl.name.split(',')[0].trim().toLowerCase();
              return key !== currentKey && !postPlaceKeys.has(key);
            });
            const combined = dbFiltered.slice(0, 8);
            if (combined.length === 0) return null;
            return (
              <div className="pt-4 pb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-5">More in {place.city}</p>
                <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
                  {combined.map(pl => (
                    <button
                      key={pl.id}
                      className="flex-shrink-0 w-28 text-left active:scale-95 transition-transform"
                      onClick={() => onSelectPlace?.(pl)}
                    >
                      <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 mb-1.5">
                        <img src={pl.photoUrl} alt={pl.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate">{pl.name.split(',')[0].trim()}</p>
                      <p className="text-[10px] text-gray-400 truncate">{pl.neighborhood || pl.city}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Curio posts */}
          {!loadingPosts && posts.length > 0 && (
            <div className="pt-4 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-5">Curio posts</p>
              <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
                {posts.map(post => {
                  const cover = post.places.find(pl => pl.name === place.name)?.photoUrl || post.places[0]?.photoUrl;
                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="flex-shrink-0 w-28 text-left active:scale-95 transition-transform"
                    >
                      <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 mb-1.5">
                        {cover
                          ? <img src={cover} alt={post.profile.username} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-2xl">{categoryEmoji[place.category] ?? '📍'}</div>
                        }
                        {post.profile.avatarUrl
                          ? <img src={post.profile.avatarUrl} className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full border-2 border-white object-cover" alt="" />
                          : <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-600">{post.profile.name[0]?.toUpperCase()}</div>
                        }
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate">@{post.profile.username}</p>
                      <p className="text-[10px] text-gray-400 truncate">{post.places.length} place{post.places.length !== 1 ? 's' : ''}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions pinned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex gap-2.5 px-5 py-4 bg-white border-t border-gray-100">
          {onToggleSave && (
            <button
              onClick={onToggleSave}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold transition-colors ${
                isSaved ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700'
              }`}
            >
              {isSaved ? <BookmarkCheck size={15} strokeWidth={1.5} /> : <Bookmark size={15} strokeWidth={1.5} />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
          )}
          <button
            onClick={() => {
              setShowShareSheet(true);
              if (appUser?.id && conversations.length === 0) {
                getConversations(appUser.id).then(setConversations);
              }
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 text-gray-700"
          >
            <Share2 size={15} strokeWidth={1.5} />
          </button>
          {bookable ? (
            <button
              onClick={() => window.open(getBookingUrl(place.name, place.city, place.category), '_blank')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 text-sm font-bold"
            >
              Book
              <ExternalLink size={13} strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={openDirections}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 text-sm font-bold"
            >
              <Navigation size={13} strokeWidth={2} />
              Directions
            </button>
          )}
        </div>

        {/* Share sheet */}
        {showShareSheet && (
          <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={() => setShowShareSheet(false)}>
            <div className="bg-white rounded-t-3xl px-5 pt-4 pb-8 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-4 flex-shrink-0">
                <div className="w-9 h-1 bg-gray-200 rounded-full" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex-shrink-0">Share {placeName}</h3>

              {/* In-app: send to conversations */}
              {conversations.length > 0 && (
                <div className="mb-3 flex-shrink-0">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Send in Curio</p>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {conversations.map(c => (
                      <button
                        key={c.id}
                        onClick={async () => {
                          if (!appUser?.id || sentTo.has(c.id)) return;
                          const msg = `📍 ${placeName}${place.city ? ` · ${place.city}` : ''}${place.category ? ` · ${place.category}` : ''}`;
                          await sendMessage(c.id, appUser.id, msg);
                          setSentTo(prev => new Set(prev).add(c.id));
                        }}
                        className="flex-shrink-0 flex flex-col items-center gap-1"
                      >
                        {c.otherUser.avatarUrl
                          ? <img src={c.otherUser.avatarUrl} className={`w-12 h-12 rounded-full object-cover border-2 ${sentTo.has(c.id) ? 'border-green-400' : 'border-transparent'}`} alt={c.otherUser.name} />
                          : <div className={`w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 border-2 ${sentTo.has(c.id) ? 'border-green-400' : 'border-transparent'}`}>{c.otherUser.name[0]?.toUpperCase()}</div>
                        }
                        <span className="text-[10px] text-gray-500 truncate w-12 text-center">{sentTo.has(c.id) ? '✓ Sent' : c.otherUser.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1 flex-shrink-0">
                <button
                  onClick={() => {
                    const text = `Check out ${placeName}${place.city ? ` in ${place.city}` : ''} on Curio!`;
                    if (navigator.share) {
                      navigator.share({ title: placeName, text }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(text);
                    }
                    setShowShareSheet(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 text-sm font-semibold text-gray-800"
                >
                  <Share2 size={16} strokeWidth={1.5} className="text-gray-500" />
                  Share externally
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`${placeName}${place.city ? ` · ${place.city}` : ''}`);
                    setShowShareSheet(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 text-sm font-semibold text-gray-800"
                >
                  <Globe size={16} strokeWidth={1.5} className="text-gray-500" />
                  Copy place name
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Inline post detail — exact PostModal layout */}
      {selectedPost && (() => {
        const seen = new Set<string>();
        const uniquePlaces = selectedPost.places.filter(pl => {
          const key = pl.name.split(',')[0].trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        const catEmoji: Record<string, string> = {
          cafe: '☕', restaurant: '🍽️', bar: '🍸', hotel: '🏨', shop: '🛍️',
          attraction: '🏛️', nature: '🌿', experience: '✨', nightlife: '🌙',
          beach: '🏖️', sports: '🎾', wellness: '💆', street: '🏙️', food: '🍕',
          landmark: '🏛️', art: '🎨', neighbourhood: '🏘️',
        };
        const allPlaces = selectedPost.places;
        const pi = Math.min(postPhotoIndex, allPlaces.length - 1);
        return (
          <div className="fixed inset-0 z-[400] flex items-end justify-center" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="w-full overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white" style={{ maxHeight: '96vh' }}>

            {/* Sticky X */}
            <div className="sticky top-0 z-30 flex justify-between items-start px-3 pt-3 pointer-events-none" style={{ marginBottom: -44 }}>
              <div className="w-8" />
              <div className="w-9 h-1 bg-white/60 rounded-full mt-0.5" />
              <button onClick={() => { setSelectedPost(null); setPostPhotoIndex(0); }} className="pointer-events-auto w-8 h-8 bg-black/55 backdrop-blur-md rounded-full flex items-center justify-center">
                <X size={15} strokeWidth={2.5} className="text-white" />
              </button>
            </div>

            {/* Photo carousel */}
            <div className="relative overflow-hidden rounded-t-3xl">
              {/* Profile pill */}
              <button
                className="absolute top-4 left-3 z-20 flex items-center gap-1.5 bg-black/55 backdrop-blur-md rounded-full pl-1 pr-3 py-1"
                onClick={() => { onViewUser?.(selectedPost.userId); setSelectedPost(null); }}
              >
                {selectedPost.profile.avatarUrl
                  ? <img src={selectedPost.profile.avatarUrl} alt={selectedPost.profile.name} className="w-6 h-6 rounded-full object-cover object-top border border-white/30 flex-shrink-0" />
                  : <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white">{selectedPost.profile.name[0]?.toUpperCase()}</div>
                }
                <span className="text-white text-xs font-semibold leading-none ml-0.5">{selectedPost.profile.username || selectedPost.profile.name}</span>
              </button>

              {/* Swipeable photos */}
              <div
                className="flex overflow-x-auto snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none' }}
                onScroll={e => {
                  const el = e.currentTarget;
                  setPostPhotoIndex(Math.round(el.scrollLeft / el.offsetWidth));
                }}
              >
                {allPlaces.map((pl, i) => (
                  <div key={`${pl.id}-${i}`} className="flex-shrink-0 w-full snap-start" style={{ aspectRatio: '3/4' }}>
                    {pl.photoUrl
                      ? <img src={pl.photoUrl} alt={pl.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-4xl">{catEmoji[pl.category] ?? '📍'}</div>
                    }
                  </div>
                ))}
              </div>

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

              {/* Bottom bar: place name + counter/dots */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 flex items-end justify-between gap-3 pointer-events-none">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-xs leading-tight truncate">{allPlaces[pi]?.name.split(',')[0].trim()}</p>
                  <p className="text-white/70 text-[10px] mt-0.5 truncate">{[allPlaces[pi]?.neighborhood, allPlaces[pi]?.city].filter(Boolean).join(', ') || allPlaces[pi]?.country}</p>
                </div>
                {allPlaces.length > 1 && (
                  <span className="text-white text-[11px] font-semibold bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 leading-none flex-shrink-0">
                    {pi + 1} / {allPlaces.length}
                  </span>
                )}
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-5">
                <button
                  className="flex items-center gap-1.5"
                  onClick={() => {
                    if (!appUser?.id) return;
                    setPostIsLiked(p => !p);
                    setPostLikeCount(p => p + (postIsLiked ? -1 : 1));
                    postIsLiked ? unlikePost(appUser.id, selectedPost.id) : likePost(appUser.id, selectedPost.id);
                  }}
                >
                  <Heart size={22} strokeWidth={1.5} className={postIsLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-800'} />
                  <span className="text-sm font-medium text-gray-500">{postLikeCount}</span>
                </button>
                <button
                  className="flex items-center gap-1.5"
                  onClick={() => {
                    setShowCommentInput(p => !p);
                    setTimeout(() => commentInputRef.current?.focus(), 100);
                  }}
                >
                  <MessageCircle size={22} strokeWidth={1.5} className="text-gray-800" />
                  <span className="text-sm font-medium text-gray-500">{postComments.length}</span>
                </button>
                <button onClick={() => {
                  const url = `${window.location.origin}?post=${selectedPost.id}`;
                  navigator.share?.({ url }) ?? navigator.clipboard?.writeText(url);
                }}>
                  <Send size={21} strokeWidth={1.5} className="text-gray-800" />
                </button>
              </div>
              <button onClick={() => {
                if (!appUser?.id) return;
                setPostIsSaved(p => !p);
                postIsSaved ? unsavePost(appUser.id, selectedPost.id) : savePost(appUser.id, selectedPost.id);
              }}>
                <Bookmark size={22} strokeWidth={1.5} className={postIsSaved ? 'fill-gray-900 text-gray-900' : 'text-gray-700'} />
              </button>
            </div>

            {/* Comments */}
            {(showCommentInput || postComments.length > 0) && (
              <div className="px-5 pt-3 pb-2">
                {postComments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 mb-2">
                    {c.profile.avatarUrl
                      ? <img src={c.profile.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" alt="" />
                      : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-bold text-gray-500">{c.profile.name[0]?.toUpperCase()}</div>
                    }
                    <div>
                      <span className="text-xs font-semibold text-gray-900 mr-1.5">{c.profile.username || c.profile.name}</span>
                      <span className="text-xs text-gray-700">{c.text}</span>
                    </div>
                  </div>
                ))}
                {showCommentInput && appUser && (
                  <div className="flex items-center gap-2 mt-2 border-t border-gray-100 pt-2">
                    {appUser.avatar
                      ? <img src={appUser.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-500">{appUser.name[0]?.toUpperCase()}</div>
                    }
                    <input
                      ref={commentInputRef}
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Add a comment…"
                      className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && commentText.trim() && !commentSending) {
                          setCommentSending(true);
                          const c = await addComment(appUser.id, selectedPost.id, commentText.trim());
                          if (c) setPostComments(prev => [...prev, c]);
                          setCommentText('');
                          setCommentSending(false);
                        }
                      }}
                    />
                    <button
                      disabled={!commentText.trim() || commentSending}
                      onClick={async () => {
                        if (!commentText.trim() || commentSending) return;
                        setCommentSending(true);
                        const c = await addComment(appUser.id, selectedPost.id, commentText.trim());
                        if (c) setPostComments(prev => [...prev, c]);
                        setCommentText('');
                        setCommentSending(false);
                      }}
                      className="text-xs font-bold text-orange-400 disabled:opacity-40"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Caption + hashtags */}
            {(selectedPost.caption || (selectedPost.hashtags ?? []).length > 0) && (
              <div className="px-5 pt-4 pb-4">
                {selectedPost.caption && <p className="text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>}
                {(selectedPost.hashtags ?? []).length > 0 && (
                  <p className="text-xs text-orange-400 mt-2">
                    {[...new Set((selectedPost.hashtags ?? []).map(h => h.split(',')[0].trim().replace(/\s+/g, '')))].map(h => `#${h}`).join(' ')}
                  </p>
                )}
              </div>
            )}

            {/* Places list */}
            {uniquePlaces.length > 0 && (
              <div className="px-5 pt-2 pb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {uniquePlaces.length} place{uniquePlaces.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-2.5">
                  {uniquePlaces.map(pl => (
                    <div key={pl.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                      {pl.photoUrl
                        ? <img src={pl.photoUrl} alt={pl.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        : <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-xl">{catEmoji[pl.category] ?? '📍'}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{pl.name.split(',')[0].trim()}</p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5 truncate">
                          <MapPin size={9} strokeWidth={1.5} className="flex-shrink-0" />
                          {[pl.neighborhood, pl.city].filter(Boolean).join(', ') || pl.country}
                        </p>
                        {pl.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji[pl.category] ?? '📍'} {pl.category.charAt(0).toUpperCase() + pl.category.slice(1)}</p>}
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 flex-shrink-0">
                        <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        );
      })()}
    </div>
  );
}
