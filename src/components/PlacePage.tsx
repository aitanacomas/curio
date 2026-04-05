import { useState, useEffect } from 'react';
import { X, MapPin, Clock, Phone, Globe, Star, ExternalLink, Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { getPostsAtPlace, type RealPostPlace, type RealPost } from '../lib/supabase';
import { getBookingUrl, isBookable } from '../lib/placeUtils';
import type { AppUser } from '../types';

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
  const [activeTab, setActiveTab] = useState<'Posts' | 'Photos'>('Posts');
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  // Auto-switch to Photos when no curio posts exist
  useEffect(() => {
    if (!loadingPosts && posts.length === 0) setActiveTab('Photos');
  }, [loadingPosts, posts.length]);
  const [googlePhotos, setGooglePhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [todayHours, setTodayHours] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<RealPost | null>(null);

  // Fetch Curio posts at this place
  useEffect(() => {
    setLoadingPosts(true);
    getPostsAtPlace(place.name).then(results => {
      setPosts(results);
      setLoadingPosts(false);
    });
  }, [place.name]);

  // Fetch Google Places details + photos
  useEffect(() => {
    setLoadingPhotos(true);
    const query = [place.name, place.neighborhood, place.city].filter(Boolean).join(', ');
    fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'places.regularOpeningHours,places.rating,places.nationalPhoneNumber,places.websiteUri,places.photos',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
    })
      .then(r => r.json())
      .then(data => {
        const p = data.places?.[0];
        if (!p) return;
        if (p.regularOpeningHours) {
          setOpenNow(p.regularOpeningHours.openNow ?? null);
          const dayIdx = new Date().getDay(); // 0=Sun
          const desc: string[] = p.regularOpeningHours.weekdayDescriptions ?? [];
          // weekdayDescriptions is Mon-Sun (0=Mon), so adjust
          const adjusted = dayIdx === 0 ? desc[6] : desc[dayIdx - 1];
          if (adjusted) {
            const parts = adjusted.split(': ');
            setTodayHours(parts[1] ?? adjusted);
          }
        }
        if (p.rating) setRating(p.rating);
        if (p.nationalPhoneNumber) setPhone(p.nationalPhoneNumber);
        if (p.websiteUri) setWebsite(p.websiteUri);
        // Build photo URLs (up to 6)
        const photoNames: string[] = (p.photos ?? []).slice(0, 6).map((ph: any) => ph.name);
        const urls = photoNames.map(name =>
          `https://places.googleapis.com/v1/${name}/media?maxWidthPx=600&key=${GOOGLE_PLACES_KEY}`
        );
        setGooglePhotos(urls);
      })
      .catch(() => {})
      .finally(() => setLoadingPhotos(false));
  }, [place.name, place.neighborhood, place.city]);

  const bookable = isBookable(place.category);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-3 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{place.name.split(',')[0].trim()}</h2>
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
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
            <X size={14} strokeWidth={2} className="text-gray-600" />
          </button>
        </div>

        {/* Google info strip */}
        <div className="px-5 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 flex-shrink-0 border-b border-gray-100">
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

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(['Posts', 'Photos'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeTab === tab ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}
            >
              {tab === 'Posts' ? `Curio Posts${posts.length > 0 ? ` (${posts.length})` : ''}` : 'Photos'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'Posts' && (
            <div className="p-3">
              {loadingPosts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-gray-300" />
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-2xl mb-2">📸</p>
                  <p className="text-sm font-semibold text-gray-700">No posts yet</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to post about this place</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {posts.map(post => {
                    const cover = post.places.find(pl => pl.name === place.name)?.photoUrl || post.places[0]?.photoUrl;
                    return (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className="relative rounded-2xl overflow-hidden aspect-square bg-gray-100 active:scale-95 transition-transform"
                      >
                        {cover ? (
                          <img src={cover} alt={post.places[0]?.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            {categoryEmoji[place.category] ?? '📍'}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2">
                          <p className="text-white text-[10px] font-semibold truncate">@{post.profile.username}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Photos' && (
            <div className="p-3">
              {loadingPhotos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-gray-300" />
                </div>
              ) : googlePhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-2xl mb-2">🖼️</p>
                  <p className="text-sm font-semibold text-gray-700">No photos available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {googlePhotos.map((url, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden aspect-square bg-gray-100">
                      <img src={url} alt={place.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
              {isSaved
                ? <BookmarkCheck size={15} strokeWidth={1.5} />
                : <Bookmark size={15} strokeWidth={1.5} />}
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
