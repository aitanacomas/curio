import { X, MapPin, Star } from 'lucide-react';
import { useEffect } from 'react';
import type { Place } from '../types';

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
};

const bookingCTA: Record<string, string> = {
  restaurant: 'Reserve a table →',
  cafe: 'See on Google →',
  bar: 'Reserve a spot →',
  food: 'Order now →',
  hotel: 'Check availability →',
  attraction: 'Buy tickets →',
  nature: 'Book your visit →',
  beach: 'Plan your visit →',
  shop: 'Book appointment →',
  experience: 'Book experience →',
  sports: 'Book activity →',
  wellness: 'Book session →',
  street: 'Explore area →',
  event: 'Get tickets →',
  flight: 'Search flights →',
  transport: 'Book transport →',
};

interface Props {
  place: Place | null;
  onClose: () => void;
}

export default function BookingSheet({ place, onClose }: Props) {
  // Lock background scroll while sheet is open
  useEffect(() => {
    if (!place) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [place]);

  if (!place) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header row: spacer | handle | X */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
          <div className="w-8 h-8" />
          <div className="w-10 h-1 rounded-full bg-gray-200" />
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
          >
            <X size={15} strokeWidth={2} className="text-gray-600" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* Hero */}
          <div className="relative h-48 mx-4 rounded-2xl overflow-hidden">
            <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 rounded-full px-2.5 py-1">
              {categoryEmoji[place.category] ?? '📍'} {place.category}
            </span>
            {place.rating && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-white text-xs font-bold">{place.rating}</span>
              </div>
            )}
          </div>

          {/* Name + location */}
          <div className="px-4 pt-4 pb-1">
            <h2 className="text-xl font-black text-gray-900 leading-tight">{place.name.split(',')[0].trim()}</h2>
            <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
              <MapPin size={12} strokeWidth={1.5} />
              {[place.neighbourhood, place.city].filter(Boolean).join(', ') || place.country}
            </p>
          </div>

          {/* Description */}
          <p className="px-4 pt-2 pb-4 text-sm text-gray-600 leading-relaxed">{place.description}</p>

          {/* Price + saves */}
          {place.price && (
            <div className="mx-4 mb-4 bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Starting from</p>
                <p className="text-lg font-black text-gray-900">{place.price.replace('from ', '')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Curio saves</p>
                <p className="text-sm font-bold text-gray-900">{place.savedCount.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA — always pinned at bottom */}
        <div className="flex-shrink-0 px-4 pt-3 pb-6 border-t border-gray-100 bg-white">
          <button className="w-full bg-gray-900 text-white font-bold text-sm rounded-2xl py-4">
            {bookingCTA[place.category] ?? 'Check availability →'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">Opens partner site · free to book</p>
        </div>
      </div>
    </div>
  );
}
