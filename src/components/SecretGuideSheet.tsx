import { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark, BookmarkCheck } from 'lucide-react';
import type { RealPostPlace } from '../lib/supabase';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

export interface SecretPlace {
  name: string;
  neighborhood: string;
  category: string;
  description: string;
}

export interface SecretGuide {
  id: string;
  city: string;
  title: string;
  subtitle: string;
  emoji: string;
  places: SecretPlace[];
}

interface Props {
  guide: SecretGuide;
  savedPlaceIds: Set<string>;
  onClose: () => void;
  onOpenPlace: (place: RealPostPlace) => void;
  onToggleSave: (placeId: string) => void;
}

export default function SecretGuideSheet({ guide, savedPlaceIds, onClose, onOpenPlace, onToggleSave }: Props) {
  const [photos, setPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    guide.places.forEach(async (p) => {
      const query = `${p.name} ${p.neighborhood} ${guide.city}`;
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
            'X-Goog-FieldMask': 'places.photos',
          },
          body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: 'en' }),
        });
        const data = await res.json();
        const photoName = data.places?.[0]?.photos?.[0]?.name;
        if (photoName) {
          setPhotos(prev => ({
            ...prev,
            [p.name]: `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`,
          }));
        }
      } catch {}
    });
  }, [guide.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const makePlace = (p: SecretPlace, photoUrl: string): RealPostPlace => ({
    id: `secret-${guide.id}-${p.name.replace(/\s+/g, '-').toLowerCase()}`,
    name: p.name,
    category: p.category,
    neighborhood: p.neighborhood,
    city: 'San Francisco',
    country: 'United States',
    photoUrl,
    position: 0,
    lat: null,
    lng: null,
  });

  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col" style={{ maxWidth: 384, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b border-gray-100">
        <button onClick={onClose} className="flex items-center gap-2 mb-4">
          <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Secret {guide.city}</p>
        </div>
        <p className="text-2xl font-black text-gray-900 leading-tight">{guide.title}</p>
        <p className="text-sm text-gray-400 mt-1">{guide.places.length} places · {guide.subtitle}</p>
      </div>

      {/* Place list */}
      <div className="flex-1 overflow-y-auto">
        {guide.places.map((p, i) => {
          const photoUrl = photos[p.name] ?? '';
          const placeObj = makePlace(p, photoUrl);
          const isSaved = savedPlaceIds.has(placeObj.id);
          return (
            <div key={p.name} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => onOpenPlace(placeObj)}
                className="w-full text-left active:bg-gray-50"
              >
                {/* Photo */}
                <div className="relative w-full bg-gray-100" style={{ aspectRatio: '3/2' }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">
                      {guide.emoji}
                    </div>
                  )}
                  <div className="absolute top-3 left-3 w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-[10px] font-black text-gray-800">{i + 1}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="px-4 pt-3 pb-2">
                  <p className="text-base font-bold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{p.neighborhood} · {p.category}</p>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{p.description}</p>
                </div>
              </button>

              {/* Save */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => onToggleSave(placeObj.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${
                    isSaved
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-200 text-gray-600 bg-white'
                  }`}
                >
                  {isSaved ? <BookmarkCheck size={12} strokeWidth={2} /> : <Bookmark size={12} strokeWidth={1.5} />}
                  {isSaved ? 'Saved' : 'Save place'}
                </button>
              </div>
            </div>
          );
        })}

        {/* Attribution footer */}
        <div className="px-4 py-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
          <p className="text-[10px] text-gray-300">
            Curated by <span className="text-gray-400 font-medium">Secret {guide.city}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
