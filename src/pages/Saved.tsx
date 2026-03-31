import { lazy, Suspense, useState } from 'react';
import { Search, Plus, BadgeCheck, Lock, ArrowLeft, CalendarDays, MapPin, ChevronRight, Clock, Plane, Share2, Bookmark, BookmarkCheck, X } from 'lucide-react';
import { collections, places, users } from '../data/mockData';
import type { Category, Collection, Place } from '../types';
import BookingSheet from '../components/BookingSheet';

const MapView = lazy(() => import('../components/MapView'));

type SavedTab = 'Places' | 'Collections' | 'Trips' | 'Map';

interface TripItem {
  id: string;
  name: string;
  category: string;
  image: string;
  time?: string;
  booked?: boolean;
}

interface TripDay {
  label: string;
  items: TripItem[];
}

interface Trip {
  id: string;
  destination: string;
  country: string;
  dates: string;
  coverImage: string;
  status: 'upcoming' | 'planning' | 'past';
  days: TripDay[];
}

const mockTrips: Trip[] = [
  {
    id: 'trip-2',
    destination: 'Tokyo',
    country: 'Japan',
    dates: 'May 16 – May 28, 2025',
    coverImage: '/shibuya-crossing.jpg',
    status: 'upcoming',
    days: [
      {
        label: 'Day 1 · Thu Apr 10',
        items: [
          { id: 'ti-7', name: 'Shibuya Coffee Festival', category: 'Event', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80', time: '10:00 AM', booked: true },
          { id: 'ti-8', name: 'Ichiran Ramen', category: 'Restaurant', image: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&q=80', time: '7:00 PM' },
        ],
      },
      {
        label: 'Day 2 · Fri Apr 11',
        items: [],
      },
    ],
  },
  {
    id: 'trip-4',
    destination: 'Seattle',
    country: 'USA',
    dates: 'Apr 15 – Apr 18, 2025',
    coverImage: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=600&q=80',
    status: 'upcoming',
    days: [
      { label: 'Day 1 · Tue Apr 15', items: [] },
      { label: 'Day 2 · Wed Apr 16', items: [] },
      { label: 'Day 3 · Thu Apr 17', items: [] },
      { label: 'Day 4 · Fri Apr 18', items: [] },
    ],
  },
  {
    id: 'trip-3',
    destination: 'Miami',
    country: 'USA',
    dates: 'Mar 11 – Mar 16, 2026',
    coverImage: '/miami-IMG_7402.jpg',
    status: 'past',
    days: [
      {
        label: 'Day 1 · Tue Mar 11',
        items: [
          { id: 'ti-9', name: 'Museum Garage', category: 'Attraction', image: '/miami-IMG_7402.jpg', time: '11:00 AM' },
          { id: 'ti-10', name: 'Bigface Coffee', category: 'Cafe', image: '/miami-bigface-coffee.jpg', time: '9:00 AM' },
          { id: 'ti-11', name: 'Bodega Taqueria', category: 'Restaurant', image: '/miami-IMG_7463.jpg', time: '1:00 PM', booked: true },
        ],
      },
    ],
  },
  {
    id: 'trip-5',
    destination: 'San Diego',
    country: 'USA',
    dates: 'Feb 6 – Feb 9, 2026',
    coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&q=80',
    status: 'past',
    days: [
      { label: 'Day 1 · Thu Feb 6', items: [] },
      { label: 'Day 2 · Fri Feb 7', items: [] },
      { label: 'Day 3 · Sat Feb 8', items: [] },
      { label: 'Day 4 · Sun Feb 9', items: [] },
    ],
  },
  {
    id: 'trip-1',
    destination: 'London',
    country: 'UK',
    dates: 'Dec 15 – Dec 22, 2025',
    coverImage: '/moco-5.jpg',
    status: 'past',
    days: [
      {
        label: 'Day 1 · Sun Dec 15',
        items: [
          { id: 'ti-1', name: 'MOCO Museum', category: 'Attraction', image: '/moco-love.jpg', time: '11:00 AM', booked: true },
          { id: 'ti-2', name: 'Dishoom Shoreditch', category: 'Restaurant', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80', time: '1:30 PM', booked: true },
          { id: 'ti-3', name: 'Sketch London', category: 'Bar', image: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?w=400&q=80', time: '8:00 PM' },
        ],
      },
      {
        label: 'Day 2 · Mon Dec 16',
        items: [
          { id: 'ti-4', name: 'Borough Market', category: 'Food', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80', time: '10:00 AM' },
          { id: 'ti-5', name: 'Tate Modern', category: 'Attraction', image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&q=80', time: '2:00 PM', booked: true },
          { id: 'ti-6', name: 'The Shard Bar', category: 'Bar', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', time: '7:30 PM' },
        ],
      },
    ],
  },
];

const savedPlaceIds = ['place-28', 'place-29', 'place-30', 'place-31', 'place-32', 'place-33'];

const placeCategories: { id: Category | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'cafe', label: 'Cafe', emoji: '☕' },
  { id: 'restaurant', label: 'Food', emoji: '🍽' },
  { id: 'hotel', label: 'Stay', emoji: '🏨' },
  { id: 'attraction', label: 'Attraction', emoji: '🗺' },
  { id: 'bar', label: 'Bar', emoji: '🍸' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'shop', label: 'Shop', emoji: '🛍' },
  { id: 'experience', label: 'Experience', emoji: '🎭' },
];

const categoryEmoji: Record<string, string> = {
  cafe: '☕', restaurant: '🍽', hotel: '🏨', attraction: '🗺', bar: '🍸', nature: '🌿', shop: '🛍', experience: '🎭',
  Attraction: '🗺', Restaurant: '🍽', Bar: '🍸', Food: '🍽', Cafe: '☕', Event: '🎟', Hotel: '🏨',
};

function PlaceRow({ place, isLocked, isSaved, onToggleSave, onBook }: {
  place: Place;
  isLocked: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onBook?: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 bg-gray-50 rounded-2xl p-3 transition-opacity ${isLocked ? 'opacity-40 pointer-events-none select-none' : ''}`}>
      <img src={place.image} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
        <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
          <MapPin size={9} strokeWidth={1.5} />
          {place.neighbourhood ?? place.city}
          <span className="mx-1">·</span>
          {categoryEmoji[place.category] ?? '📍'} {place.category}
        </p>
        {place.rating && <p className="text-xs text-amber-500 font-semibold mt-0.5">★ {place.rating}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {place.bookingAvailable && (
          <button onClick={onBook} className="text-xs font-bold bg-gray-900 text-white rounded-full px-2.5 py-1">Book</button>
        )}
        <button onClick={onToggleSave}>
          {isSaved
            ? <BookmarkCheck size={17} strokeWidth={1.5} className="text-gray-900" />
            : <Bookmark size={17} strokeWidth={1.5} className="text-gray-300" />}
        </button>
      </div>
    </div>
  );
}

export default function Saved({ isNewUser }: { isNewUser?: boolean }) {
  const [activeTab, setActiveTab] = useState<SavedTab>('Places');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [placeCategory, setPlaceCategory] = useState<Category | 'all'>('all');
  const [savedPlaceSet, setSavedPlaceSet] = useState<Set<string>>(new Set(isNewUser ? [] : savedPlaceIds));
  const [colViewMode, setColViewMode] = useState<'list' | 'area'>('list');
  const [colCategoryFilter, setColCategoryFilter] = useState<Category | 'all'>('all');
  const [bookingPlace, setBookingPlace] = useState<Place | null>(null);
  const [showAddPlaces, setShowAddPlaces] = useState(false);
  const [colAdditions, setColAdditions] = useState<Record<string, string[]>>({});
  const [addSearch, setAddSearch] = useState('');
  const [addCatFilter, setAddCatFilter] = useState('all');

  const savedPlaces = isNewUser
    ? places.filter(p => savedPlaceSet.has(p.id))
    : places.filter(p => savedPlaceIds.includes(p.id));
  const myCollections = isNewUser ? [] : collections.filter(c => c.curatorId === 'user-1');
  const followingCollections = collections.filter(c => c.curatorId !== 'user-1');

  // ── Trip Detail ───────────────────────────────────────────────
  if (selectedTrip) {
    const totalItems = selectedTrip.days.reduce((acc, d) => acc + d.items.length, 0);
    const bookedCount = selectedTrip.days.reduce((acc, d) => acc + d.items.filter(i => i.booked).length, 0);
    return (
      <div className="bg-white min-h-screen">
        {/* Hero */}
        <div className="relative h-52">
          <img src={selectedTrip.coverImage} alt={selectedTrip.destination} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
          <button
            onClick={() => setSelectedTrip(null)}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                selectedTrip.status === 'upcoming' ? 'bg-violet-500 text-white' :
                selectedTrip.status === 'planning' ? 'bg-amber-400 text-white' :
                'bg-white/30 text-white'
              }`}>
                {selectedTrip.status === 'upcoming' ? 'Upcoming' : selectedTrip.status === 'planning' ? 'Planning' : 'Past trip'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">{selectedTrip.destination}</h2>
            <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
              <CalendarDays size={11} strokeWidth={1.5} />{selectedTrip.dates}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center divide-x divide-gray-100 border-b border-gray-100">
          {[
            { value: selectedTrip.days.length, label: 'Days' },
            { value: totalItems, label: 'Places' },
            { value: bookedCount, label: 'Booked' },
          ].map(s => (
            <div key={s.label} className="flex-1 py-3 text-center">
              <p className="text-base font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="px-4 pt-4 pb-8 space-y-6">
          {selectedTrip.days.map((day, di) => (
            <div key={di}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{day.label}</p>
              <div className="space-y-3">
                {day.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                    <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        {item.booked && (
                          <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">Booked</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{categoryEmoji[item.category] ?? '📍'} {item.category}</p>
                      {item.time && (
                        <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-0.5">
                          <Clock size={10} strokeWidth={1.5} />{item.time}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {day.items.length === 0 && (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl py-5 flex items-center justify-center">
                    <p className="text-sm text-gray-400">Nothing planned yet</p>
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-500 font-medium">
                  <Plus size={14} strokeWidth={1.5} /> Add place
                </button>
              </div>
            </div>
          ))}

          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium">
            <Plus size={14} strokeWidth={1.5} /> Add a day
          </button>
        </div>
      </div>
    );
  }

  // ── Collection Detail ─────────────────────────────────────────
  if (selectedCollection) {
    const extraIds = colAdditions[selectedCollection.id] ?? [];
    const colPlaces = places.filter(p => [...selectedCollection.placeIds, ...extraIds].includes(p.id));
    const curator = selectedCollection.curatorId ? users.find(u => u.id === selectedCollection.curatorId) : null;
    const isOwn = selectedCollection.curatorId === 'user-1';
    const isPremium = selectedCollection.isPremium && !isOwn;
    const countries = [...new Set(colPlaces.map(p => p.country))].length;

    return (
      <>
      <div className="bg-white min-h-screen">
        {/* Hero */}
        <div className="relative h-64">
          <img src={selectedCollection.coverImage} alt={selectedCollection.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          <button
            onClick={() => setSelectedCollection(null)}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
            <Share2 size={15} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-black text-white">{selectedCollection.name}</h2>
            <p className="text-white/70 text-xs mt-1">{selectedCollection.description}</p>
          </div>
        </div>

        {/* Curator row */}
        {curator && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <img src={curator.avatar} alt={curator.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold text-gray-900">{curator.name}</p>
                {curator.isCreator && <BadgeCheck size={13} className="text-blue-500 fill-blue-500" strokeWidth={1.5} />}
              </div>
              <p className="text-xs text-gray-400">@{curator.username}</p>
            </div>
            {!isOwn ? (
              <button className="text-xs font-bold bg-gray-900 text-white rounded-full px-3 py-1.5 flex-shrink-0">
                Follow
              </button>
            ) : (
              <button className="text-xs font-medium text-gray-400 border border-gray-200 rounded-full px-3 py-1.5 flex-shrink-0">
                Edit
              </button>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center divide-x divide-gray-100 border-b border-gray-100">
          {[
            { value: colPlaces.length, label: 'Places' },
            { value: (selectedCollection.followerCount ?? 0).toLocaleString(), label: 'Subscribers' },
            { value: countries, label: countries === 1 ? 'Country' : 'Countries' },
          ].map(s => (
            <div key={s.label} className="flex-1 py-3 text-center">
              <p className="text-base font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="px-4 pt-4">
          <Suspense fallback={<div className="h-48 bg-gray-100 rounded-xl animate-pulse" />}>
            <MapView places={colPlaces} height="200px" />
          </Suspense>
        </div>

        {/* Filter bar */}
        {(() => {
          const cats = [...new Set(colPlaces.map(p => p.category))];
          const hasNeighbourhoods = colPlaces.some(p => p.neighbourhood);
          const filtered = colCategoryFilter === 'all' ? colPlaces : colPlaces.filter(p => p.category === colCategoryFilter);

          // Group by neighbourhood or city for area view
          const grouped: { label: string; items: typeof colPlaces }[] = [];
          if (colViewMode === 'area') {
            const areaMap = new Map<string, typeof colPlaces>();
            filtered.forEach(p => {
              const key = p.neighbourhood ?? p.city;
              if (!areaMap.has(key)) areaMap.set(key, []);
              areaMap.get(key)!.push(p);
            });
            areaMap.forEach((items, label) => grouped.push({ label, items }));
          }

          return (
            <div className="pt-3 pb-10 px-4">
              {/* Places count + view toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{filtered.length} places</p>
                  {isOwn && (
                    <button onClick={() => setShowAddPlaces(true)} className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                      <Plus size={11} strokeWidth={2.5} className="text-gray-500" />
                    </button>
                  )}
                </div>
                {hasNeighbourhoods && (
                  <div className="flex bg-gray-100 rounded-full p-0.5">
                    {(['list', 'area'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setColViewMode(mode)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          colViewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                        }`}
                      >
                        {mode === 'list' ? 'List' : 'Area'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category chips — scrollable, bleeds to edge */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 mb-3">
                {[{ id: 'all' as const, label: 'All' }, ...cats.map(c => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setColCategoryFilter(cat.id)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      colCategoryFilter === cat.id
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-gray-50 border-gray-100 text-gray-500'
                    }`}
                  >
                    {cat.id !== 'all' && <span>{categoryEmoji[cat.id] ?? '📍'}</span>}
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Places */}
              <div className="relative">
                {colViewMode === 'area' ? (
                  <div className="space-y-5">
                    {grouped.map(({ label, items }, gi) => (
                      <div key={label}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                          📍 {label}
                        </p>
                        <div className="space-y-2.5">
                          {items.map((place, i) => <PlaceRow key={place.id} place={place} isLocked={!!(isPremium && gi === 0 && i >= 2)} isSaved={savedPlaceSet.has(place.id)} onToggleSave={() => setSavedPlaceSet(prev => { const next = new Set(prev); savedPlaceSet.has(place.id) ? next.delete(place.id) : next.add(place.id); return next; })} onBook={() => setBookingPlace(place)} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filtered.map((place, i) => <PlaceRow key={place.id} place={place} isLocked={!!(isPremium && i >= 2)} isSaved={savedPlaceSet.has(place.id)} onToggleSave={() => setSavedPlaceSet(prev => { const next = new Set(prev); savedPlaceSet.has(place.id) ? next.delete(place.id) : next.add(place.id); return next; })} onBook={() => setBookingPlace(place)} />)}
                  </div>
                )}

                {/* Premium paywall */}
                {isPremium && colPlaces.length > 2 && (
                  <div className="absolute bottom-0 left-0 right-0 h-44 flex flex-col items-center justify-end">
                    <div className="w-full bg-gradient-to-t from-white via-white/95 to-transparent h-full absolute bottom-0" />
                    <div className="relative z-10 w-full bg-gray-900 rounded-2xl px-5 py-4 text-center">
                      <Lock size={16} className="text-amber-400 mx-auto mb-1" strokeWidth={1.5} />
                      <p className="text-white text-sm font-bold">Unlock the full guide</p>
                      <p className="text-white/60 text-xs mt-0.5">{colPlaces.length - 2} more places · one-time access</p>
                      <button className="mt-3 w-full bg-white text-gray-900 text-sm font-bold rounded-full py-2.5">
                        Subscribe for ${selectedCollection.price}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Add all to trip */}
        {!isPremium && (
          <div className="px-4 pb-8">
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium">
              <Plane size={14} strokeWidth={1.5} /> Add all to a trip
            </button>
          </div>
        )}
      </div>

      {/* Booking Sheet */}
      <BookingSheet place={bookingPlace} onClose={() => setBookingPlace(null)} />

      {/* Add Places Sheet */}
      {showAddPlaces && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowAddPlaces(false); setAddSearch(''); setAddCatFilter('all'); }} />
          <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <button
              onClick={() => { setShowAddPlaces(false); setAddSearch(''); setAddCatFilter('all'); }}
              className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
            >
              <X size={15} strokeWidth={2} className="text-gray-600" />
            </button>
            <div className="px-4 pt-1 pb-3 flex-shrink-0 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900 mb-3">Add places</h3>
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                <Search size={14} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  placeholder="Search places..."
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2.5 -mx-4 px-4">
                {['all','cafe','restaurant','hotel','attraction','bar','nature','shop','experience'].map(c => (
                  <button
                    key={c}
                    onClick={() => setAddCatFilter(c)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${addCatFilter === c ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                  >
                    {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 pb-8">
              {(() => {
                const currentIds = new Set([...selectedCollection.placeIds, ...(colAdditions[selectedCollection.id] ?? [])]);
                const sl = addSearch.toLowerCase();
                const candidates = places.filter(p =>
                  !currentIds.has(p.id) &&
                  (addCatFilter === 'all' || p.category === addCatFilter) &&
                  (!addSearch || p.name.toLowerCase().includes(sl) || p.city.toLowerCase().includes(sl))
                );
                if (!candidates.length) return <p className="text-sm text-gray-400 text-center py-8">No places found</p>;
                return (
                  <div className="space-y-2.5">
                    {candidates.map(p => (
                      <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                        <img src={p.image} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                            <MapPin size={9} strokeWidth={1.5} />
                            {p.neighbourhood ?? p.city} · {categoryEmoji[p.category] ?? '📍'} {p.category}
                          </p>
                        </div>
                        <button
                          onClick={() => setColAdditions(prev => ({
                            ...prev,
                            [selectedCollection!.id]: [...(prev[selectedCollection!.id] ?? []), p.id],
                          }))}
                          className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0"
                        >
                          <Plus size={13} strokeWidth={2.5} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">curio</h1>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={15} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
          <input
            placeholder="Search saved places, trips..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-100">
          {(['Places', 'Collections', 'Trips', 'Map'] as SavedTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-gray-900 border-b-2 border-gray-900 -mb-px'
                  : 'text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Places Tab */}
      {activeTab === 'Places' && (
        <div className="pb-6">
          {isNewUser && savedPlaces.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🔖</span>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-1.5">Nothing saved yet</p>
              <p className="text-slate-400 text-sm text-center max-w-[200px]">Tap the bookmark icon on any place to save it here</p>
            </div>
          )}
          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 pt-3 pb-3">
            {placeCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setPlaceCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all ${
                  placeCategory === cat.id
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'bg-gray-50 border-gray-100 text-gray-600'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {(() => {
            const filtered = placeCategory === 'all'
              ? savedPlaces
              : savedPlaces.filter(p => p.category === placeCategory);
            return filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <p className="text-4xl mb-3">{placeCategories.find(c => c.id === placeCategory)?.emoji ?? '🔖'}</p>
                <p className="text-base font-bold text-gray-900">{placeCategory === 'all' ? 'No saved places' : `No saved ${placeCategories.find(c => c.id === placeCategory)?.label.toLowerCase()}s`}</p>
                <p className="text-sm text-gray-400 mt-1">Save places from the explore page to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-4">
                {filtered.map(place => (
                  <div key={place.id} className="relative rounded-2xl overflow-hidden cursor-pointer">
                    <img src={place.image} alt={place.name} className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2.5 pt-6">
                      <p className="text-white text-xs font-semibold leading-tight truncate">{place.name}</p>
                      <p className="text-white/70 text-xs flex items-center gap-0.5 mt-0.5">
                        <MapPin size={9} strokeWidth={1.5} />{place.city}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Collections Tab */}
      {activeTab === 'Collections' && (
        isNewUser && myCollections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">🗂️</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">Curate your favourite places into shareable collections</p>
          </div>
        ) : (
        <div className="px-4 pt-4 pb-6 space-y-6">
          {/* Mine */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mine</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {myCollections.map(col => (
                <div key={col.id} className="cursor-pointer" onClick={() => setSelectedCollection(col)}>
                  <div className="rounded-xl overflow-hidden aspect-square relative">
                    <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" style={col.id === 'col-8' ? { transform: 'scale(1.11)' } : undefined} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                  <p className="text-xs text-gray-400">{col.placeIds.length} places</p>
                </div>
              ))}
              <div className="cursor-pointer">
                <div className="rounded-xl border-2 border-dashed border-gray-200 aspect-square flex items-center justify-center bg-gray-50">
                  <Plus size={24} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 mt-2">New Collection</p>
              </div>
            </div>
          </div>

          {/* Following */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subscribed</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {followingCollections.map(col => {
                const curator = col.curatorId ? users.find(u => u.id === col.curatorId) : null;
                return (
                  <div key={col.id} className="cursor-pointer" onClick={() => setSelectedCollection(col)}>
                    <div className="rounded-xl overflow-hidden aspect-square relative">
                      <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" />
                      {col.isPremium && (
                        <div className="absolute top-2 left-2 bg-amber-400 rounded-full px-2 py-0.5 flex items-center gap-1">
                          <Lock size={9} strokeWidth={1.5} className="text-white" />
                          <p className="text-xs font-bold text-white">Premium · ${col.price}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-2">{col.name}</p>
                    {curator && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                        by {curator.name}
                        {curator.isCreator && <BadgeCheck size={11} className="text-blue-500 fill-blue-500" strokeWidth={1.5} />}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">{col.placeIds.length} places · {col.followerCount?.toLocaleString()} subscribers</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )
      )}

      {/* Trips Tab */}
      {activeTab === 'Trips' && (
        isNewUser ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">✈️</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No trips planned</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">Start planning your next adventure and it'll appear here</p>
          </div>
        ) : (
        <div className="px-4 pt-4 pb-6 space-y-6">

          {/* Upcoming */}
          {mockTrips.some(t => t.status === 'upcoming' || t.status === 'planning') && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming</p>
              <div className="space-y-3">
                {mockTrips.filter(t => t.status === 'upcoming' || t.status === 'planning').map(trip => (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 text-left"
                  >
                    <img src={trip.coverImage} alt={trip.destination} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{trip.destination}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          trip.status === 'upcoming' ? 'bg-violet-100 text-violet-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {trip.status === 'upcoming' ? 'Upcoming' : 'Planning'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <CalendarDays size={10} strokeWidth={1.5} />{trip.dates}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {trip.days.length} days · {trip.days.reduce((a, d) => a + d.items.length, 0)} places
                      </p>
                    </div>
                    <ChevronRight size={16} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New Trip */}
          <button className="w-full flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl p-4">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Plane size={22} strokeWidth={1.5} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400">Plan a new trip</p>
              <p className="text-xs text-gray-300 mt-0.5">Add destinations, days & places</p>
            </div>
          </button>

          {/* Past */}
          {mockTrips.some(t => t.status === 'past') && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Past</p>
              <div className="space-y-3">
                {mockTrips.filter(t => t.status === 'past').map(trip => (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 text-left opacity-50"
                  >
                    <img src={trip.coverImage} alt={trip.destination} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{trip.destination}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <CalendarDays size={10} strokeWidth={1.5} />{trip.dates}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {trip.days.length} days · {trip.days.reduce((a, d) => a + d.items.length, 0)} places
                      </p>
                    </div>
                    <ChevronRight size={16} strokeWidth={1.5} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
        )
      )}

      {/* Map Tab */}
      {activeTab === 'Map' && (
        <div className="pt-4 pb-6 px-4">
          <p className="text-sm font-bold text-gray-900 mb-1">Your Saved Map</p>
          <p className="text-xs text-gray-400 mb-3">All the places you want to visit.</p>
          <Suspense fallback={<div className="h-64 bg-gray-100 rounded-xl animate-pulse" />}>
            <MapView places={savedPlaces} height="260px" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
