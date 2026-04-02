import { useState } from 'react';
import { Bookmark, MapPin } from 'lucide-react';
import type { Place } from '../types';

interface Props {
  place: Place;
  compact?: boolean;
}

const categoryColors: Record<string, string> = {
  restaurant: 'bg-rose-100 text-rose-700',
  cafe: 'bg-amber-100 text-amber-700',
  bar: 'bg-indigo-100 text-indigo-700',
  food: 'bg-orange-100 text-orange-700',
  hotel: 'bg-blue-100 text-blue-700',
  attraction: 'bg-violet-100 text-violet-700',
  nature: 'bg-emerald-100 text-emerald-700',
  beach: 'bg-cyan-100 text-cyan-700',
  shop: 'bg-pink-100 text-pink-700',
  experience: 'bg-purple-100 text-purple-700',
  sports: 'bg-lime-100 text-lime-700',
  wellness: 'bg-teal-100 text-teal-700',
  street: 'bg-yellow-100 text-yellow-700',
  event: 'bg-fuchsia-100 text-fuchsia-700',
  flight: 'bg-sky-100 text-sky-700',
  transport: 'bg-gray-100 text-gray-600',
};

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
};

export default function PlaceCard({ place, compact = false }: Props) {
  const [saved, setSaved] = useState(false);

  if (compact) {
    return (
      <div className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
        <img src={place.image} alt={place.name} className="w-full h-28 object-cover" />
        <div className="p-2">
          <p className="text-xs font-semibold text-gray-900 truncate">{place.name.split(',')[0].trim()}</p>
          <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
            <MapPin size={10} strokeWidth={1.5} />
            {[place.neighbourhood, place.city].filter(Boolean).join(', ') || place.country}
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
        <span className={`absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${categoryColors[place.category] ?? 'bg-gray-100 text-gray-600'}`}>
          {categoryEmoji[place.category] ?? '📍'} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900">{place.name.split(',')[0].trim()}</h3>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
          <MapPin size={12} strokeWidth={1.5} />
          {[place.neighbourhood, place.city].filter(Boolean).join(', ') || place.country}
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
