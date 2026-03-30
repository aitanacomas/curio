import { useState } from 'react';
import { Bookmark, MapPin } from 'lucide-react';
import type { Place } from '../types';

interface Props {
  place: Place;
  compact?: boolean;
}

const categoryColors: Record<string, string> = {
  cafe: 'bg-amber-100 text-amber-700',
  restaurant: 'bg-rose-100 text-rose-700',
  hotel: 'bg-blue-100 text-blue-700',
  attraction: 'bg-violet-100 text-violet-700',
  bar: 'bg-indigo-100 text-indigo-700',
  nature: 'bg-emerald-100 text-emerald-700',
  shop: 'bg-pink-100 text-pink-700',
};

export default function PlaceCard({ place, compact = false }: Props) {
  const [saved, setSaved] = useState(false);

  if (compact) {
    return (
      <div className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
        <img src={place.image} alt={place.name} className="w-full h-28 object-cover" />
        <div className="p-2">
          <p className="text-xs font-semibold text-gray-900 truncate">{place.name}</p>
          <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
            <MapPin size={10} strokeWidth={1.5} />
            {place.city}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
      <div className="relative">
        <img src={place.image} alt={place.name} className="w-full h-48 object-cover" />
        <button
          onClick={() => setSaved(!saved)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm"
        >
          <Bookmark size={16} strokeWidth={1.5} className={saved ? 'fill-violet-600 text-violet-600' : 'text-gray-600'} />
        </button>
        <span className={`absolute top-3 left-3 text-xs font-medium px-2 py-1 rounded-full ${categoryColors[place.category]}`}>
          {place.category}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900">{place.name}</h3>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
          <MapPin size={12} strokeWidth={1.5} />
          {place.city}, {place.country}
        </p>
        <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{place.description}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1 flex-wrap">
            {place.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-400">{place.savedCount.toLocaleString()} saves</span>
        </div>
      </div>
    </div>
  );
}
