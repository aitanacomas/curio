import { useState, lazy, Suspense } from 'react';
import { Search, SlidersHorizontal, Heart, MessageCircle, Send, Bookmark, MapPin, X, Navigation, BadgeCheck, Star, CalendarCheck, Check, Mail, CalendarDays, Clock, Ticket, ChevronRight, Minus, Plus } from 'lucide-react';
import { places, users } from '../data/mockData';
import type { Category, Place } from '../types';

const MapView = lazy(() => import('../components/MapView'));

interface Event {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  image: string;
  price: string;
  tag: string;
  description: string;
}

const mockEvents: Event[] = [
  {
    id: 'evt-6',
    name: 'Uncle Paul\'s Ceramics',
    venue: 'Uncle Paul\'s',
    city: 'San Francisco',
    date: 'Every Sat',
    time: '10:00 AM',
    image: '/uncle-pauls-ceramics.webp',
    price: 'from $65',
    tag: 'Experience',
    description: 'A ceramics studio in North Beach with wheel-throwing classes for all levels. The terracotta-painted walls, pottery wheels, and neighbourhood energy make it one of the most charming spots in the city.',
  },
  {
    id: 'evt-7',
    name: 'KAWS: What Party',
    venue: 'SFMOMA',
    city: 'San Francisco',
    date: 'May 3',
    time: '10:00 AM',
    image: '/sfmoma-kaws.jpg',
    price: 'from $25',
    tag: 'Art',
    description: 'A landmark survey of KAWS\'s practice spanning paintings, sculptures, and works on paper. The exhibition traces the artist\'s evolution from street art to major museum commissions, with several large-scale works making their West Coast debut.',
  },
];

type FeedTab = 'For You' | 'Following' | 'Friends' | 'Nearby';
type SortOption = 'Most saved' | 'Newest' | 'Highest rated';

const feedTabs: FeedTab[] = ['For You', 'Following', 'Friends', 'Nearby'];

const categoryFilters: { id: Category | 'all'; label: string; emoji: string }[] = [
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

const sortOptions: SortOption[] = ['Most saved', 'Newest', 'Highest rated'];

// Simulated: which users the current user (user-1) follows
const followingIds = ['user-2', 'user-3', 'user-4'];
// Simulated: friend-saved place IDs
const friendSavedIds = ['place-3', 'place-6', 'place-9', 'place-13', 'place-16', 'place-5'];
// Simulated nearby city
const nearbyCity = 'Tokyo';

function applyTab(tab: FeedTab, all: Place[]): Place[] {
  switch (tab) {
    case 'For You': return all;
    case 'Following': return all.filter(p => followingIds.includes(p.postedBy));
    case 'Friends': return all.filter(p => friendSavedIds.includes(p.id));
    case 'Nearby': return all.filter(p => p.city === nearbyCity);
    default: return all;
  }
}

function applySort(sort: SortOption, all: Place[]): Place[] {
  const copy = [...all];
  if (sort === 'Most saved') return copy.sort((a, b) => b.savedCount - a.savedCount);
  if (sort === 'Highest rated') return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  // Newest — use postedAt
  return copy.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

export default function Explore({ onOpenMessages }: { onOpenMessages?: () => void }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());
  const [bookedEvents, setBookedEvents] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('Most saved');
  // Restaurant reservation state
  const [resDateIdx, setResDateIdx] = useState(0);
  const [resParty, setResParty] = useState(2);
  const [resTime, setResTime] = useState('');

  const toggleSave = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBook = (id: string) => {
    setBooked(prev => new Set(prev).add(id));
  };

  // Build filtered list
  let filtered = applyTab(activeTab, places);
  if (activeCategory !== 'all') filtered = filtered.filter(p => p.category === activeCategory);
  if (search) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase()) ||
    p.country.toLowerCase().includes(search.toLowerCase())
  );
  filtered = applySort(activeSort, filtered);

  const isBookable = (place: Place) =>
    place.bookingAvailable && ['hotel', 'restaurant', 'attraction', 'experience'].includes(place.category);

  const resDates = ['Today', 'Tomorrow', 'Sat Apr 5', 'Sun Apr 6', 'Mon Apr 7'];
  const resTimes = ['6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM'];

  // ── Event Detail ─────────────────────────────────────────────
  if (selectedEvent) {
    const isSaved = savedEvents.has(selectedEvent.id);
    const isBooked = bookedEvents.has(selectedEvent.id);
    return (
      <div className="bg-white min-h-screen pb-6">
        <div className="relative">
          <img src={selectedEvent.image} alt={selectedEvent.name} className="w-full h-64 object-cover" />
          <button
            onClick={() => setSelectedEvent(null)}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
          >
            <X size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <div className="absolute top-4 right-4">
            <span className="bg-white/90 backdrop-blur-sm text-xs font-bold text-gray-800 px-2.5 py-1 rounded-full">{selectedEvent.tag}</span>
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Heart size={22} strokeWidth={1.5} className="text-gray-700" />
            <Send size={22} strokeWidth={1.5} className="text-gray-700" />
          </div>
          <button
            onClick={() => setSavedEvents(prev => { const n = new Set(prev); if (n.has(selectedEvent.id)) n.delete(selectedEvent.id); else n.add(selectedEvent.id); return n; })}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-xs font-medium transition-colors ${isSaved ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-gray-700'}`}
          >
            <Bookmark size={11} strokeWidth={1.5} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="px-4 pb-4">
          <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedEvent.name}</h2>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin size={11} strokeWidth={1.5} />{selectedEvent.venue} · {selectedEvent.city}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <CalendarDays size={11} strokeWidth={1.5} />{selectedEvent.date}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={11} strokeWidth={1.5} />{selectedEvent.time}
            </p>
          </div>

          <p className="text-sm text-gray-600 mt-4 leading-relaxed">{selectedEvent.description}</p>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400">Price per person</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{selectedEvent.price}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Available</p>
                <p className="text-sm font-semibold text-green-600 mt-0.5">Tickets left</p>
              </div>
            </div>
            {isBooked ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5">
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Ticket size={18} strokeWidth={1.5} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800">Tickets Confirmed!</p>
                  <p className="text-xs text-green-600 mt-0.5">Check your email for your tickets.</p>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setBookedEvents(prev => new Set(prev).add(selectedEvent.id))}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  Get Tickets
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Sold through Curio · Small service fee applies</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Place Detail ─────────────────────────────────────────────
  if (selectedPlace) {
    const poster = users.find(u => u.id === selectedPlace.postedBy);
    const bookingConfirmed = booked.has(selectedPlace.id);

    return (
      <div className="bg-white min-h-screen pb-6">
        <div className="relative">
          <img src={selectedPlace.image} alt={selectedPlace.name} className="w-full h-72 object-cover" />
          <button
            onClick={() => setSelectedPlace(null)}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
          >
            <X size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
          {selectedPlace.rating && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1">
              <Star size={12} strokeWidth={1.5} className="fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-gray-800">{selectedPlace.rating}</span>
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Heart size={22} strokeWidth={1.5} className="text-gray-700" />
            <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
            <Send size={22} strokeWidth={1.5} className="text-gray-700" />
          </div>
          <button
            onClick={() => toggleSave(selectedPlace.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-xs font-medium transition-colors ${
              saved.has(selectedPlace.id) ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-gray-700'
            }`}
          >
            <Bookmark size={11} strokeWidth={1.5} />
            {saved.has(selectedPlace.id) ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="px-4 pb-4">
          <h2 className="text-lg font-bold text-gray-900 mt-1">{selectedPlace.name}</h2>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <MapPin size={11} strokeWidth={1.5} />{selectedPlace.city}, {selectedPlace.country}
          </p>
          <p className="text-xs text-gray-400 mt-1">Saved by {selectedPlace.savedCount.toLocaleString()} people</p>

          {poster && (
            <div className="flex items-center gap-2 mt-3">
              <img src={poster.avatar} alt={poster.name} className="w-6 h-6 rounded-full object-cover object-top" />
              <p className="text-xs text-gray-500">
                Posted by <span className="font-semibold text-gray-800">{poster.name}</span>
                {poster.isCreator && <BadgeCheck size={12} className="inline ml-1 text-blue-500 fill-blue-500" strokeWidth={1.5} />}
              </p>
            </div>
          )}

          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{selectedPlace.description}</p>

          {selectedPlace.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedPlace.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">#{tag}</span>
              ))}
            </div>
          )}

          {isBookable(selectedPlace) && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              {selectedPlace.category === 'restaurant' ? (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Reserve a Table</p>
                  {bookingConfirmed ? (
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5">
                      <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <CalendarCheck size={18} strokeWidth={1.5} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-800">Reservation Confirmed!</p>
                        <p className="text-xs text-green-600 mt-0.5">Check your email for details.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Date */}
                      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-3">
                        {resDates.map((d, i) => (
                          <button key={i} onClick={() => { setResDateIdx(i); setResTime(''); }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${resDateIdx === i ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600'}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                      {/* Party size */}
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-xs font-medium text-gray-600">Party size</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setResParty(Math.max(1, resParty - 1))} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                            <Minus size={12} strokeWidth={2} className="text-gray-700" />
                          </button>
                          <span className="text-sm font-bold text-gray-900 w-4 text-center">{resParty}</span>
                          <button onClick={() => setResParty(Math.min(12, resParty + 1))} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                            <Plus size={12} strokeWidth={2} className="text-gray-700" />
                          </button>
                        </div>
                      </div>
                      {/* Time slots */}
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {resTimes.map(t => (
                          <button key={t} onClick={() => setResTime(t)}
                            className={`py-2 rounded-xl text-xs font-semibold border transition-all ${resTime === t ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-700'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => resTime && handleBook(selectedPlace.id)}
                        className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all ${resTime ? 'bg-gray-900 text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-400'}`}
                      >
                        Reserve a Table
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-2">Powered by Curio · No booking fees</p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Book This Place</p>
                  {bookingConfirmed ? (
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5">
                      <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <CalendarCheck size={18} strokeWidth={1.5} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-800">Booking Confirmed!</p>
                        <p className="text-xs text-green-600 mt-0.5">Check your email for details.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        {selectedPlace.price && <p className="text-base font-bold text-gray-900">{selectedPlace.price}</p>}
                        {selectedPlace.rating && (
                          <div className="flex items-center gap-1">
                            <Star size={13} strokeWidth={1.5} className="fill-amber-400 text-amber-400" />
                            <span className="text-sm font-semibold text-gray-700">{selectedPlace.rating}</span>
                            <span className="text-xs text-gray-400">/ 5</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleBook(selectedPlace.id)}
                        className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
                      >
                        Book Now
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-2">Booking through Curio · No extra fees</p>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Location</p>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-700 font-medium mb-3">
              <Navigation size={14} strokeWidth={1.5} />Get directions
            </button>
            <Suspense fallback={<div className="h-36 bg-gray-100 rounded-xl animate-pulse" />}>
              <MapView places={[selectedPlace]} center={[selectedPlace.lat, selectedPlace.lng]} zoom={13} height="150px" />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  // ── Filter Panel ─────────────────────────────────────────────
  if (showFilters) {
    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          <button onClick={() => setShowFilters(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <X size={16} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>

        <div className="px-4 pt-5 space-y-6 pb-8">
          {/* Show places from */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Show places from</p>
            <div className="flex flex-wrap gap-2">
              {feedTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-gray-50 border-gray-100 text-gray-600'
                  }`}
                >
                  {tab === 'For You' && '✨'}
                  {tab === 'Following' && '👥'}
                  {tab === 'Friends' && '🤝'}
                  {tab === 'Nearby' && '📍'}
                  {' '}{tab}
                  {activeTab === tab && <Check size={13} strokeWidth={1.5} />}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sort by</p>
            <div className="space-y-2">
              {sortOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setActiveSort(opt)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                    activeSort === opt
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-gray-50 border-gray-100 text-gray-700'
                  }`}
                >
                  <span>{opt}</span>
                  {activeSort === opt && <Check size={15} strokeWidth={1.5} />}
                </button>
              ))}
            </div>
          </div>

          {/* Bookable only */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Availability</p>
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border bg-gray-50 border-gray-100 text-gray-600 text-sm font-medium">
              Bookable on Curio
            </button>
          </div>
        </div>

        <div className="px-4 pb-6">
          <button
            onClick={() => setShowFilters(false)}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm"
          >
            Show {filtered.length} results
          </button>
        </div>
      </div>
    );
  }

  // Detect if search matches a known city
  const searchedCity = search.length > 1
    ? places.find(p => p.city.toLowerCase().startsWith(search.toLowerCase()))?.city ?? null
    : null;

  const visibleEvents = searchedCity
    ? mockEvents.filter(e => e.city.toLowerCase() === searchedCity.toLowerCase())
    : mockEvents;

  const activeCatLabel = categoryFilters.find(c => c.id === activeCategory)?.label ?? 'Places';

  // ── Main Explore Grid ─────────────────────────────────────────
  return (
    <div className="bg-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        {/* Top row */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">curio</h1>
          <button onClick={onOpenMessages} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <Mail size={17} strokeWidth={1.5} className="text-gray-700" />
          </button>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <Search size={15} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cities, places, people..."
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X size={14} strokeWidth={1.5} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              activeSort !== 'Most saved' || activeTab !== 'For You' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Category chips — always visible */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 pb-3">
          {categoryFilters.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as Category | 'all')}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'bg-gray-50 border-gray-100 text-gray-600'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* City context banner */}
      {searchedCity && (
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">
            Exploring <span className="text-violet-600">{searchedCity}</span>
          </p>
          <button onClick={() => setSearch('')} className="text-xs text-gray-400 font-medium">Clear</button>
        </div>
      )}

      {/* Sort chip */}
      {activeSort !== 'Most saved' && (
        <div className="px-4 pt-2.5">
          <button
            onClick={() => setActiveSort('Most saved')}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
          >
            {activeSort} <X size={11} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Events section — only in 'All' browse mode */}
      {activeCategory === 'all' && (
        <>
          <div className="pt-4 pb-1">
            <div className="flex items-center justify-between px-4 mb-3">
              <p className="text-sm font-bold text-gray-900">
                {searchedCity ? `What's On in ${searchedCity}` : "What's On"}
              </p>
              <button className="flex items-center gap-0.5 text-xs text-gray-400 font-medium">
                See all <ChevronRight size={13} strokeWidth={1.5} />
              </button>
            </div>
            {visibleEvents.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 pb-1">
                {visibleEvents.map(event => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="flex-shrink-0 w-44 rounded-2xl overflow-hidden bg-gray-100 relative text-left"
                  >
                    <img src={event.image} alt={event.name} className="w-full h-32 object-cover" />
                    <div className="absolute top-2 left-2">
                      <span className="bg-white/90 backdrop-blur-sm text-xs font-bold text-gray-800 px-2 py-0.5 rounded-full">{event.tag}</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setSavedEvents(prev => { const n = new Set(prev); if (n.has(event.id)) n.delete(event.id); else n.add(event.id); return n; }); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center"
                    >
                      <Bookmark size={11} strokeWidth={1.5} className={savedEvents.has(event.id) ? 'fill-gray-900 text-gray-900' : 'text-gray-600'} />
                    </button>
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-gray-900 leading-tight line-clamp-1">{event.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{event.venue}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-gray-500 flex items-center gap-0.5">
                          <CalendarDays size={10} strokeWidth={1.5} />{event.date}
                        </p>
                        <p className="text-xs font-bold text-gray-900">{event.price}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-4 text-sm text-gray-400 pb-2">No events found in {searchedCity}.</p>
            )}
          </div>
          <div className="mx-4 border-t border-gray-100 mt-3" />
        </>
      )}

      {/* Places header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-sm font-bold text-gray-900">
          {activeCategory === 'all' ? 'Places' : `${activeCatLabel}s`}
        </p>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <p className="text-4xl mb-3">{categoryFilters.find(c => c.id === activeCategory)?.emoji ?? '🗺'}</p>
          <p className="text-base font-bold text-gray-900">No {activeCatLabel.toLowerCase()}s found</p>
          <p className="text-sm text-gray-400 mt-1">Try a different search or category.</p>
        </div>
      )}

      {/* Masonry Grid */}
      {filtered.length > 0 && (
        <div className="px-3 pt-2 pb-4 columns-2 gap-2">
          {filtered.map((place, i) => {
            const aspectClass = i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-square' : 'aspect-[4/5]';
            return (
              <div
                key={place.id}
                className="break-inside-avoid mb-2 relative cursor-pointer"
                onClick={() => setSelectedPlace(place)}
              >
                <img src={place.image} alt={place.name} className={`w-full object-cover rounded-xl ${aspectClass}`} />
                <div className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-gradient-to-t from-black/50 to-transparent px-2.5 pb-2 pt-6">
                  <p className="text-white text-xs font-semibold leading-tight truncate">{place.name}</p>
                  <p className="text-white/70 text-xs">{place.city}</p>
                </div>
                {place.bookingAvailable && (
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <p className="text-xs font-semibold text-gray-800">Book</p>
                  </div>
                )}
                <button
                  onClick={e => toggleSave(place.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center"
                >
                  <Bookmark
                    size={13}
                    strokeWidth={1.5}
                    className={saved.has(place.id) ? 'fill-gray-900 text-gray-900' : 'text-gray-600'}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
