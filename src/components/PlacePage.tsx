import { useState, useEffect, lazy, Suspense } from 'react';
import { X, MapPin, Clock, Phone, Globe, Star, ExternalLink, Bookmark, BookmarkCheck, Loader2, Navigation } from 'lucide-react';
import { getPostsAtPlace, type RealPostPlace, type RealPost } from '../lib/supabase';
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
}

export default function PlacePage({ place, appUser, isSaved, onClose, onToggleSave }: Props) {
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

  // All photos combined: curio first, then Google
  const curioPhotos = posts.flatMap(p => p.places.filter(pl => pl.photoUrl).map(pl => ({ url: pl.photoUrl, type: 'curio' as const, post: p })));
  const allPhotos = [
    ...curioPhotos.map(c => c.url),
    ...googlePhotos,
  ];

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
        'X-Goog-FieldMask': 'places.regularOpeningHours,places.rating,places.nationalPhoneNumber,places.websiteUri,places.photos,places.location',
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
        if (p.nationalPhoneNumber) setPhone(p.nationalPhoneNumber);
        if (p.websiteUri) setWebsite(p.websiteUri);
        if (p.location && !placeLocation) {
          setPlaceLocation({ lat: p.location.latitude, lng: p.location.longitude });
        }
        // Build photo URLs — skip index 0 (often logo/promo), use 1–10
        const photoNames: string[] = (p.photos ?? []).slice(1, 11).map((ph: any) => ph.name);
        const urls = photoNames.map(name =>
          `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`
        );
        setGooglePhotos(urls);
      })
      .catch(() => {})
      .finally(() => setLoadingPhotos(false));
  }, [place.name, place.neighborhood, place.city]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookable = isBookable(place.category);
  const placeName = place.name.split(',')[0].trim();

  const openDirections = () => {
    const q = encodeURIComponent(`${place.name} ${place.city}`);
    window.open(`https://maps.google.com/?q=${q}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: '94vh' }}>

        {/* Hero photo carousel */}
        <div className="relative flex-shrink-0 bg-gray-100" style={{ height: 240 }}>
          {loadingPhotos && allPhotos.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          ) : allPhotos.length > 0 ? (
            <>
              <img
                src={allPhotos[photoIndex]}
                alt={placeName}
                className="w-full h-full object-cover"
                onError={e => {
                  // Try next photo on error
                  if (photoIndex < allPhotos.length - 1) setPhotoIndex(i => i + 1);
                  else (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Photo dots */}
              {allPhotos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {allPhotos.slice(0, 8).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={`rounded-full transition-all ${i === photoIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
              {/* Swipe areas */}
              <button
                className="absolute left-0 top-0 h-full w-1/3"
                onClick={() => setPhotoIndex(i => Math.max(0, i - 1))}
              />
              <button
                className="absolute right-0 top-0 h-full w-1/3"
                onClick={() => setPhotoIndex(i => Math.min(allPhotos.length - 1, i + 1))}
              />
              {/* Photo count */}
              <div className="absolute top-3 right-12 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                <span className="text-white text-[10px] font-medium">{photoIndex + 1}/{Math.min(allPhotos.length, 8)}</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              {categoryEmoji[place.category] ?? '📍'}
            </div>
          )}
          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <X size={14} strokeWidth={2} className="text-white" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{placeName}</h2>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-sm">{categoryEmoji[place.category] ?? '📍'}</span>
                  <span className="text-xs text-gray-500 capitalize">{place.category}</span>
                  {(place.neighborhood || place.city) && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-0.5 text-xs text-gray-400">
                        <MapPin size={9} strokeWidth={1.5} />
                        {[place.neighborhood, place.city].filter(Boolean).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div className="px-5 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-100">
            {rating !== null && (
              <div className="flex items-center gap-1">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
              </div>
            )}
            {openNow !== null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${openNow ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {openNow ? 'Open now' : 'Closed'}
              </span>
            )}
            {todayHours && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={10} strokeWidth={1.5} />
                <span>{todayHours}</span>
              </div>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-gray-400">
                <Phone size={10} strokeWidth={1.5} />
                <span>{phone}</span>
              </a>
            )}
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500">
                <Globe size={10} strokeWidth={1.5} />
                <span className="truncate max-w-[120px]">{website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                <ExternalLink size={9} strokeWidth={1.5} />
              </a>
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
              <button
                onClick={openDirections}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700"
              >
                <Navigation size={12} strokeWidth={1.5} />
                Get directions
              </button>
            </div>
          )}

          {/* People who've been here */}
          {!loadingPosts && posts.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Curio posts</p>
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {posts.map(post => {
                  const cover = post.places.find(pl => pl.name === place.name)?.photoUrl || post.places[0]?.photoUrl;
                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gray-100">
                        {cover
                          ? <img src={cover} alt={post.profile.username} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xl">{categoryEmoji[place.category] ?? '📍'}</div>
                        }
                        {post.profile.avatarUrl
                          ? <img src={post.profile.avatarUrl} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white object-cover" alt="" />
                          : <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[8px] font-bold text-gray-600">{post.profile.name[0]?.toUpperCase()}</div>
                        }
                      </div>
                      <p className="text-[10px] text-gray-500 truncate w-16 text-center">@{post.profile.username}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-4" />
        </div>

        {/* Actions pinned at bottom */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-gray-100 flex-shrink-0">
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
          {bookable && (
            <button
              onClick={() => window.open(getBookingUrl(place.name, place.city, place.category), '_blank')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-900 text-white text-sm font-bold"
            >
              Book
              <ExternalLink size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Inline post detail overlay */}
      {selectedPost && (
        <div className="absolute inset-0 z-10 bg-white rounded-t-3xl overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3">
            <button onClick={() => setSelectedPost(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
              <X size={14} strokeWidth={2} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              {selectedPost.profile.avatarUrl
                ? <img src={selectedPost.profile.avatarUrl} alt={selectedPost.profile.name} className="w-7 h-7 rounded-full object-cover" />
                : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{selectedPost.profile.name[0]?.toUpperCase()}</div>
              }
              <p className="text-sm font-semibold text-gray-900">@{selectedPost.profile.username}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {selectedPost.places.filter(pl => pl.photoUrl).map(pl => (
              <img key={pl.id} src={pl.photoUrl} alt={pl.name} className="w-full aspect-square object-cover rounded-xl" />
            ))}
          </div>
          {selectedPost.caption && (
            <p className="px-4 pt-3 pb-2 text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>
          )}
          <div className="px-4 pb-6 space-y-2">
            {selectedPost.places.map(pl => (
              <div key={pl.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                {pl.photoUrl && <img src={pl.photoUrl} alt={pl.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{pl.name}</p>
                  <p className="text-xs text-gray-400 truncate">{[pl.neighborhood, pl.city].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
