import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import ActionModal from '../components/ActionModal';
import SondrrLogo from '../components/SondrLogo';
import UserProfile from './UserProfile';
import PlacePage from '../components/PlacePage';
import { Search, X, Mail, MapPin, Bookmark, BookmarkCheck, Map, LayoutGrid, Heart, MessageCircle, Send, Plus, Check, ChevronRight, Copy, Loader2, MoreHorizontal, Flag, UserX, Trash2 } from 'lucide-react';
import { supabase, getPublicUrl, getFeedPosts, getDiscoveryPosts, getLikedPosts, getPostLikeCounts, getFollowing, followUser, unfollowUser, smartFollow, searchProfiles, getSuggestedUsers, savePlace, unsavePlace, likePost, unlikePost, savePost, unsavePost, getPostComments, addComment, getSavedPlaces, getUserCollections, addPlaceToCollection, createCollection, getConversations, getOrCreateConversation, sendMessage, removePlaceFromCollection, getPlaceCollectionIds, buildTasteProfile, getGuides, globalSearch, getBlockedUsers, getBlockersOfUser, blockUser, unblockUser, reportContent, deletePost, getPlans, createPlan, createPlanDay, createPlanItem, subscribeToGuide, unsubscribeFromGuide, getSubscribedGuideIds, addGuideToCollection, removeGuideFromCollection, getGuideCollectionIds, type RealPost, type RealPostPlace, type FollowProfile, type PostComment, type RealCollection, type Conversation, type TasteProfile, type Guide, type Plan } from '../lib/supabase';
import { googleTypesToCategory, extractNeighborhood } from '../lib/placeUtils';
import GuideDetail from '../components/GuideDetail';
import CreateGuideSheet from '../components/CreateGuideSheet';
import SecretGuideSheet, { type SecretGuide } from '../components/SecretGuideSheet';
import type { MapBounds } from '../components/MapView';
import { SECRET_GUIDES } from '../lib/secretGuides';
import { gTextSearch, gNearbySearch, gAutocomplete, gPlaceDetails, TTL } from '../lib/googlePlaces';
import { US_STATES, CATEGORY_EMOJI } from '../lib/constants';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY as string;

const MapView = lazy(() => import('../components/MapView'));

function resolveCity(city: string | undefined): string {
  if (!city) return '';
  const c = city.trim();
  return (/^[A-Z]{2}$/.test(c) && US_STATES[c]) ? US_STATES[c] : c;
}
import type { AppUser } from '../types';

interface Props {
  onOpenMessages?: () => void;
  appUser?: AppUser;
}

interface FlatPlace {
  placeId: string;
  name: string;
  category: string;
  neighborhood?: string;
  city: string;
  country: string;
  photoUrl: string;
  indexInPost: number;
  post: RealPost;
}

// Cities rotated through for For You discover results — only the 30 curated featured cities.
// Users can search any city via the search bar to explore beyond this list.
const WORLD_CITIES_BASE = [
  'London', 'Los Angeles', 'Madrid', 'New York', 'Paris',
  'Adelaide', 'Amsterdam', 'Bali', 'Barcelona', 'Berlin',
  'Mexico City', 'Copenhagen', 'Dubai', 'Hamburg', 'Lisbon',
  'Melbourne', 'Miami', 'Milan', 'Montreal', 'Munich',
  'Rio de Janeiro', 'San Francisco', 'São Paulo', 'Seoul', 'Singapore',
  'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Zurich',
];

// Approximate coordinates for each city — used to pass locationBias to Places API
// so results are actually in the right city regardless of user's IP location.
const CITY_COORDS: Record<string, [number, number]> = {
  // Europe
  'London': [51.5074, -0.1278],
  'Paris': [48.8566, 2.3522], 'Barcelona': [41.3851, 2.1734], 'Rome': [41.9028, 12.4964],
  'Amsterdam': [52.3676, 4.9041], 'Lisbon': [38.7169, -9.1399], 'Copenhagen': [55.6761, 12.5683],
  'Berlin': [52.5200, 13.4050], 'Hamburg': [53.5511, 9.9937], 'Munich': [48.1351, 11.5820], 'Vienna': [48.2082, 16.3738], 'Prague': [50.0755, 14.4378],
  'Budapest': [47.4979, 19.0402], 'Athens': [37.9838, 23.7275], 'Reykjavik': [64.1355, -21.8954],
  'Dubrovnik': [42.6507, 18.0944], 'Florence': [43.7696, 11.2558], 'Milan': [45.4654, 9.1859],
  'Venice': [45.4408, 12.3155], 'Madrid': [40.4168, -3.7038], 'Seville': [37.3891, -5.9845],
  'Porto': [41.1579, -8.6291], 'Bruges': [51.2093, 3.2247], 'Edinburgh': [55.9533, -3.1883],
  'Dublin': [53.3498, -6.2603], 'Oslo': [59.9139, 10.7522], 'Stockholm': [59.3293, 18.0686],
  'Helsinki': [60.1699, 24.9384], 'Zurich': [47.3769, 8.5417], 'Geneva': [46.2044, 6.1432],
  'Lyon': [45.7640, 4.8357], 'Marseille': [43.2965, 5.3698], 'Nice': [43.7102, 7.2620],
  'Monaco': [43.7384, 7.4246], 'Valletta': [35.8997, 14.5147], 'Split': [43.5081, 16.4402],
  'Ljubljana': [46.0569, 14.5058], 'Tallinn': [59.4370, 24.7536], 'Riga': [56.9496, 24.1052],
  'Vilnius': [54.6872, 25.2797], 'Krakow': [50.0647, 19.9450], 'Warsaw': [52.2297, 21.0122],
  'Sofia': [42.6977, 23.3219], 'Bucharest': [44.4268, 26.1025], 'Thessaloniki': [40.6401, 22.9444],
  'Palermo': [38.1157, 13.3615], 'Naples': [40.8518, 14.2681],
  // Americas
  'New York': [40.7128, -74.0060], 'Mexico City': [19.4326, -99.1332], 'CDMX': [19.4326, -99.1332], 'Buenos Aires': [-34.6037, -58.3816],
  'Montreal': [45.5017, -73.5673], 'Havana': [23.1136, -82.3666], 'Tulum': [20.2114, -87.4654],
  'Cartagena': [10.3910, -75.4794], 'Bogotá': [4.7110, -74.0721], 'Rio de Janeiro': [-22.9068, -43.1729],
  'São Paulo': [-23.5558, -46.6396], 'Lima': [-12.0464, -77.0428], 'Santiago': [-33.4489, -70.6693],
  'Medellín': [6.2442, -75.5812], 'Oaxaca': [17.0732, -96.7266], 'Los Angeles': [34.0522, -118.2437],
  'San Francisco': [37.7749, -122.4194], 'Miami': [25.7617, -80.1918], 'Chicago': [41.8781, -87.6298],
  'New Orleans': [29.9511, -90.0715], 'Nashville': [36.1627, -86.7816], 'Austin': [30.2672, -97.7431],
  'Vancouver': [49.2827, -123.1207], 'Toronto': [43.6532, -79.3832], 'Quebec City': [46.8139, -71.2082],
  'Cancún': [21.1619, -86.8515], 'Puerto Vallarta': [20.6534, -105.2253], 'Cusco': [-13.5320, -71.9675],
  'Montevideo': [-34.9011, -56.1645], 'Quito': [-0.1807, -78.4678], 'La Paz': [-16.5000, -68.1193],
  'Asunción': [-25.2637, -57.5759],
  // Asia
  'Tokyo': [35.6762, 139.6503], 'Bangkok': [13.7563, 100.5018], 'Dubai': [25.2048, 55.2708],
  'Istanbul': [41.0082, 28.9784], 'Seoul': [37.5665, 126.9780], 'Singapore': [1.3521, 103.8198],
  'Kyoto': [35.0116, 135.7681], 'Taipei': [25.0330, 121.5654], 'Ho Chi Minh City': [10.8231, 106.6297],
  'Bali': [-8.3405, 115.0920], 'Hanoi': [21.0285, 105.8542], 'Chiang Mai': [18.7883, 98.9853],
  'Hong Kong': [22.3193, 114.1694], 'Kuala Lumpur': [3.1390, 101.6869], 'Jakarta': [-6.2088, 106.8456],
  'Manila': [14.5995, 120.9842], 'Osaka': [34.6937, 135.5023], 'Sapporo': [43.0642, 141.3469],
  'Fukuoka': [33.5904, 130.4017], 'Mumbai': [19.0760, 72.8777], 'Delhi': [28.7041, 77.1025],
  'Jaipur': [26.9124, 75.7873], 'Goa': [15.2993, 74.1240], 'Bangalore': [12.9716, 77.5946],
  'Colombo': [6.9271, 79.8612], 'Kathmandu': [27.7172, 85.3240], 'Dhaka': [23.8103, 90.4125],
  'Yangon': [16.8661, 96.1951], 'Phnom Penh': [11.5564, 104.9282], 'Luang Prabang': [19.8846, 102.1338],
  'Muscat': [23.5880, 58.3829], 'Doha': [25.2854, 51.5310], 'Abu Dhabi': [24.4539, 54.3773],
  'Amman': [31.9454, 35.9284], 'Beirut': [33.8938, 35.5018], 'Tel Aviv': [32.0853, 34.7818],
  'Tbilisi': [41.6938, 44.8015], 'Yerevan': [40.1872, 44.5152], 'Almaty': [43.2220, 76.8512],
  'Tashkent': [41.2995, 69.2401], 'Bishkek': [42.8746, 74.5698],
  // Africa
  'Cape Town': [-33.9249, 18.4241], 'Nairobi': [-1.2921, 36.8219], 'Lagos': [6.5244, 3.3792],
  'Marrakech': [31.6295, -7.9811], 'Casablanca': [33.5731, -7.5898], 'Cairo': [30.0444, 31.2357],
  'Accra': [5.6037, -0.1870], 'Addis Ababa': [9.0320, 38.7469], 'Kigali': [-1.9441, 30.0619],
  'Dar es Salaam': [-6.7924, 39.2083], 'Zanzibar': [-6.1659, 39.2026], 'Tunis': [36.8065, 10.1815],
  'Algiers': [36.7372, 3.0865], 'Johannesburg': [-26.2041, 28.0473], 'Durban': [-29.8587, 31.0218],
  'Dakar': [14.7645, -17.3660],
  // Oceania
  'Sydney': [-33.8688, 151.2093], 'Melbourne': [-37.8136, 144.9631], 'Brisbane': [-27.4698, 153.0251],
  'Auckland': [-36.8485, 174.7633], 'Wellington': [-41.2865, 174.7762], 'Queenstown': [-45.0312, 168.6626],
  'Perth': [-31.9505, 115.8605], 'Adelaide': [-34.9285, 138.6007], 'Christchurch': [-43.5321, 172.6362],
  // Islands
  'Santorini': [36.3932, 25.4615], 'Amalfi Coast': [40.6338, 14.6018], 'Maldives': [3.2028, 73.2207],
  'Phuket': [7.8804, 98.3923], 'Lombok': [-8.6500, 116.3242], 'Mykonos': [37.4467, 25.3289],
  'Ibiza': [38.9067, 1.4206], 'Mallorca': [39.6953, 3.0176], 'Corsica': [42.0396, 9.0129],
  'Sardinia': [40.1209, 9.0129], 'Malta': [35.8997, 14.5147], 'Cyprus': [35.1264, 33.4299],
  'Crete': [35.2401, 24.8093],
};

let _discoverCache: { results: any[]; tokens: (string | null)[]; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 50; // Max entries per cache to prevent memory leaks

/** Evict oldest entries when a cache exceeds MAX_CACHE_ENTRIES */
function evictOldest<V extends { ts?: number }>(cache: Record<string, V>, max: number) {
  const keys = Object.keys(cache);
  if (keys.length <= max) return;
  // Sort by timestamp (oldest first), remove half
  const sorted = keys.sort((a, b) => ((cache[a] as any).ts ?? 0) - ((cache[b] as any).ts ?? 0));
  const toRemove = sorted.slice(0, keys.length - Math.floor(max / 2));
  toRemove.forEach(k => delete cache[k]);
}

// Per-city discover results cache (search bar geo path) — keyed by "cityName_category"
const _cityDiscoverCache: Record<string, { results: RealPostPlace[]; tokens: (string | null)[]; ts: number }> = {};

// Per-city+category places cache (Cities tab) — keyed by "cityId_categoryId"
const _cityPlacesCache: Record<string, { places: RealPostPlace[]; nextToken: string | null; ts: number }> = {};

// Nearby search cache — keyed by "lat3dp_lng3dp_filterType", 15-min TTL
const _nearbyCache: Record<string, { places: RealPostPlace[]; ts: number }> = {};
const NEARBY_CACHE_TTL = 15 * 60 * 1000;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isLatinScript = (s: string) => /^[\u0000-\u024F\s,.\-'()&/:!?@#%+*[\]{}|~`^$]+$/.test(s);

// Scenic/panoramic queries — tuned for atmospheric, aesthetic city cover shots
// Hardcoded cover photos — these always take priority over API fetches.
// Drop in any URL (Unsplash direct link, hosted image, etc.) for a city to lock it in.
const PX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1`;

const CITY_COVER_OVERRIDES: Record<string, string> = {
  'London':        PX(460672),
  'Los Angeles':   PX(3652252),
  'Madrid':        PX(32469373),
  'New York':      PX(13259678),
  'Paris':         PX(165804),
  'Adelaide':      PX(3883319),
  'Amsterdam':     PX(851039),
  'Bali':          PX(15451778),
  'Barcelona':     PX(1388030),
  'Berlin':        PX(19096569),
  'CDMX':          PX(12316041),
  'Copenhagen':    PX(3783530),
  'Dubai':         PX(10593605),
  'Hamburg':       PX(36051425),
  'Lisbon':        PX(5069524),
  'Melbourne':     PX(18163161),
  'Miami':         PX(29360684),
  'Milan':         PX(8430364),
  'Montreal':      PX(33825324),
  'Munich':        PX(30944546),
  'Rio de Janeiro':PX(24742342),
  'San Francisco': PX(1485894),
  'São Paulo':     PX(29566356),
  'Seoul':         PX(29343916),
  'Singapore':     PX(1907050),
  'Stockholm':     PX(32158615),
  'Sydney':        PX(7549817),
  'Tokyo':         PX(19035807),
  'Toronto':       PX(374870),
  'Zurich':        PX(32008182),
};

const CITY_PHOTO_QUERIES: Record<string, string> = {
  'London':        'London skyline Thames aerial city',
  'Los Angeles':   'Los Angeles aerial skyline coast California',
  'Madrid':        'Madrid aerial cityscape Spain',
  'New York':      'New York City Manhattan skyline aerial',
  'Paris':         'Paris Eiffel Tower aerial Seine cityscape',
  'Adelaide':      'Adelaide South Australia city skyline',
  'Amsterdam':     'Amsterdam canals aerial Netherlands city',
  'Bali':          'Bali rice terraces temple tropical Indonesia',
  'Barcelona':     'Barcelona aerial Sagrada Familia Mediterranean',
  'Berlin':        'Berlin aerial cityscape Germany',
  'CDMX':          'Mexico City aerial skyline urban',
  'Copenhagen':    'Copenhagen Nyhavn colorful canal Denmark',
  'Dubai':         'Dubai aerial Burj Khalifa skyline desert',
  'Hamburg':       'Hamburg Speicherstadt port aerial Germany',
  'Lisbon':        'Lisbon aerial city hills Portugal',
  'Melbourne':     'Melbourne aerial cityscape Australia skyline',
  'Miami':         'Miami Beach aerial ocean city',
  'Milan':         'Milan Duomo cathedral Italy cityscape',
  'Montreal':      'Montreal aerial city Canada skyline',
  'Munich':        'Munich aerial Bavaria Germany city',
  'Rio de Janeiro':'Rio de Janeiro aerial Christ Redeemer Brazil',
  'San Francisco': 'San Francisco Golden Gate Bridge aerial bay',
  'São Paulo':     'São Paulo aerial skyline Brazil city',
  'Seoul':         'Seoul aerial cityscape South Korea',
  'Singapore':     'Singapore Marina Bay aerial skyline night',
  'Stockholm':     'Stockholm aerial archipelago Sweden city',
  'Sydney':        'Sydney Opera House Harbour Bridge aerial',
  'Tokyo':         'Tokyo aerial city skyline Japan',
  'Toronto':       'Toronto CN Tower skyline Canada aerial',
  'Zurich':        'Zurich aerial Switzerland lake Alps',
};

// Curated featured cities for the Activities tab
const FEATURED_CITIES = [
  { id: 'london',      name: 'London',        country: 'UK' },
  { id: 'la',          name: 'Los Angeles',   country: 'USA' },
  { id: 'madrid',      name: 'Madrid',        country: 'Spain' },
  { id: 'nyc',         name: 'New York',      country: 'USA' },
  { id: 'paris',       name: 'Paris',         country: 'France' },
  { id: 'adelaide',    name: 'Adelaide',      country: 'Australia' },
  { id: 'amsterdam',   name: 'Amsterdam',     country: 'Netherlands' },
  { id: 'bali',        name: 'Bali',          country: 'Indonesia' },
  { id: 'barcelona',   name: 'Barcelona',     country: 'Spain' },
  { id: 'berlin',      name: 'Berlin',        country: 'Germany' },
  { id: 'cdmx',        name: 'CDMX',          country: 'Mexico' },
  { id: 'copenhagen',  name: 'Copenhagen',    country: 'Denmark' },
  { id: 'dubai',       name: 'Dubai',         country: 'UAE' },
  { id: 'hamburg',     name: 'Hamburg',       country: 'Germany' },
  { id: 'lisbon',      name: 'Lisbon',        country: 'Portugal' },
  { id: 'melbourne',   name: 'Melbourne',     country: 'Australia' },
  { id: 'miami',       name: 'Miami',         country: 'USA' },
  { id: 'milan',       name: 'Milan',         country: 'Italy' },
  { id: 'montreal',    name: 'Montreal',      country: 'Canada' },
  { id: 'munich',      name: 'Munich',        country: 'Germany' },
  { id: 'rio',         name: 'Rio de Janeiro', country: 'Brazil' },
  { id: 'sf',          name: 'San Francisco', country: 'USA' },
  { id: 'saopaulo',    name: 'São Paulo',     country: 'Brazil' },
  { id: 'seoul',       name: 'Seoul',         country: 'South Korea' },
  { id: 'singapore',   name: 'Singapore',     country: 'Singapore' },
  { id: 'stockholm',   name: 'Stockholm',     country: 'Sweden' },
  { id: 'sydney',      name: 'Sydney',        country: 'Australia' },
  { id: 'tokyo',       name: 'Tokyo',         country: 'Japan' },
  { id: 'toronto',     name: 'Toronto',       country: 'Canada' },
  { id: 'zurich',      name: 'Zurich',        country: 'Switzerland' },
];

// Category searches paired with rotating world cities (8 per page)
const DEFAULT_CATEGORY_SEARCHES = [
  { textQuery: 'best restaurant', includedType: 'restaurant' },
  { textQuery: 'best cafe coffee shop', includedType: 'cafe' },
  { textQuery: 'famous museum', includedType: 'museum' },
  { textQuery: 'boutique hotel', includedType: 'lodging' },
  { textQuery: 'rooftop cocktail bar', includedType: 'bar' },
  { textQuery: 'art gallery', includedType: 'art_gallery' },
  { textQuery: 'national park', includedType: 'national_park' },
  { textQuery: 'famous beach', includedType: 'beach' },
];

const categoryChips = [
  { id: 'all',          label: 'All',           emoji: '✨' },
  { id: 'restaurant',   label: 'Restaurant',    emoji: '🍽️' },
  { id: 'cafe',         label: 'Cafe',          emoji: '☕' },
  { id: 'treats',       label: 'Treats',        emoji: '🍰' },
  { id: 'bar',          label: 'Bar',           emoji: '🍸' },
  { id: 'nightlife',    label: 'Nightlife',     emoji: '🎵' },
  { id: 'food',         label: 'Food',          emoji: '🍕' },
  { id: 'hotel',        label: 'Stay',          emoji: '🏨' },
  { id: 'landmark',     label: 'Landmark',      emoji: '🏛️' },
  { id: 'art',          label: 'Art',           emoji: '🎨' },
  { id: 'nature',       label: 'Nature',        emoji: '🌿' },
  { id: 'beach',        label: 'Beach',         emoji: '🏖️' },
  { id: 'shop',         label: 'Shop',          emoji: '🛍️' },
  { id: 'experience',   label: 'Experience',    emoji: '🎡' },
  { id: 'neighbourhood',label: 'Neighbourhood', emoji: '🏘️' },
  { id: 'sports',       label: 'Sports',        emoji: '🎾' },
  { id: 'wellness',     label: 'Wellness',      emoji: '💆' },
  { id: 'event',        label: 'Event',         emoji: '🎟️' },
];

type FeedTab = 'For You' | 'Cities';
type SearchTab = 'For You' | 'People' | 'Guides' | 'Posts' | 'Collections';

const EXP_CATEGORIES: { id: string; label: string; emoji: string; query: string; type: string }[] = [
  { id: 'art',       label: 'Art & Crafts',  emoji: '🎨', query: 'art workshop pottery painting class studio', type: 'art_gallery' },
  { id: 'outdoors',  label: 'Outdoors',       emoji: '🌿', query: 'nature hike trail scenic outdoor',          type: 'park' },
  { id: 'culture',   label: 'Culture',        emoji: '🏛️', query: 'cultural tour museum historic site',        type: 'museum' },
  { id: 'food',      label: 'Food & Drink',   emoji: '🍽️', query: 'food tour cooking class market tasting',   type: 'restaurant' },
  { id: 'music',     label: 'Music',          emoji: '🎵', query: 'live music jazz concert venue',             type: 'night_club' },
  { id: 'wellness',  label: 'Wellness',       emoji: '🧘', query: 'spa yoga retreat wellness meditation',      type: 'spa' },
  { id: 'adventure', label: 'Adventure',      emoji: '🏄', query: 'surfing diving adventure sport activity',   type: 'tourist_attraction' },
  { id: 'tours',     label: 'Tours',          emoji: '🗺️', query: 'guided city tour walking tour sightseeing', type: 'tourist_attraction' },
];

export default function Explore({ onOpenMessages, appUser }: Props) {
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [interestWeightedIds, setInterestWeightedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');
  const [activeSearchTab, setActiveSearchTab] = useState<SearchTab>('For You');
  const [query, setQuery] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [userResults, setUserResults] = useState<FollowProfile[]>([]);
  const [postResults, setPostResults] = useState<RealPost[]>([]);
  const [placeResults, setPlaceResults] = useState<RealPostPlace[]>([]);
  const [searchingContent, setSearchingContent] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<FlatPlace | null>(null);
  const [selectedPlacePage, setSelectedPlacePage] = useState<RealPostPlace | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreDiscoverRef = useRef<() => Promise<void>>(async () => {});
  const [discoverResults, setDiscoverResults] = useState<RealPostPlace[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [loadingMoreDiscover, setLoadingMoreDiscover] = useState(false);
  const [discoverGeoState, setDiscoverGeoState] = useState<{ lat: number; lng: number; city: string; country: string; radius: number } | null>(null);
  const [discoverTextToken, setDiscoverTextToken] = useState<string | null>(null);
  const [discoverDefaultTokens, setDiscoverDefaultTokens] = useState<(string | null)[]>([]);
  const [discoverCityPage, setDiscoverCityPage] = useState(0);
  // Shuffled once per mount so every refresh shows different places
  const WORLD_CITIES = useMemo(() => shuffleArray(WORLD_CITIES_BASE), []);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [exploreError, setExploreError] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [selectedSecretGuide, setSelectedSecretGuide] = useState<SecretGuide | null>(null);
  const [secretSavedIds, setSecretSavedIds] = useState<Set<string>>(new Set());
  const [exploreSubscribedGuideIds, setExploreSubscribedGuideIds] = useState<Set<string>>(new Set());
  const [exploreGuideColSheet, setExploreGuideColSheet] = useState<Guide | null>(null);
  const [exploreGuideColIds, setExploreGuideColIds] = useState<Set<string>>(new Set());
  const [exploreGuideColLoading, setExploreGuideColLoading] = useState(false);
  const [exploreUserCollections, setExploreUserCollections] = useState<RealCollection[]>([]);
  const [exploreShowNewColSheet, setExploreShowNewColSheet] = useState(false);
  const [exploreNewColName, setExploreNewColName] = useState('');
  const [exploreNewColSaving, setExploreNewColSaving] = useState(false);
  const [secretCovers, setSecretCovers] = useState<Record<string, string>>({});
  const [activeExpCategory, setActiveExpCategory] = useState('art');
  const [cityPageTab, setCityPageTab] = useState<'guides' | 'activities'>('activities');
  const [selectedExpCity, setSelectedExpCity] = useState<{ id: string; name: string; country: string; lat: number; lng: number } | null>(null);
  const [cityPlaces, setCityPlaces] = useState<RealPostPlace[]>([]);
  const [cityPlacesNextToken, setCityPlacesNextToken] = useState<string | null>(null);
  const [loadingCityPlaces, setLoadingCityPlaces] = useState(false);
  const [cityPlacesError, setCityPlacesError] = useState(false);
  const [loadingMoreCityPlaces, setLoadingMoreCityPlaces] = useState(false);
  const cityPlacesSentinelRef = useRef<HTMLDivElement | null>(null);
  const [cityCoverPhotos, setCityCoverPhotos] = useState<Record<string, string>>({});
  const [expCityQuery, setExpCityQuery] = useState('');
  const [expCitySuggestions, setExpCitySuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const expCityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expCitySessionTokenRef = useRef<string>(crypto.randomUUID());
  const [exploreMapMode, setExploreMapMode] = useState(false);
  const [selectedMapPin, setSelectedMapPin] = useState<{ id: string; name: string; city: string; neighborhood?: string; photoUrl: string; type: 'curio' | 'discover'; flatPlace?: FlatPlace; discoverPlace?: RealPostPlace } | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const handleBoundsChange = useCallback((b: MapBounds) => setMapBounds(b), []);

  // Fetch guide covers lazily — only for the selected city, not all 500+ guides at once
  useEffect(() => {
    if (!selectedExpCity) return;
    const cityGuides = SECRET_GUIDES.filter(g => g.city.toLowerCase() === selectedExpCity.name.toLowerCase());
    cityGuides.forEach(async (g) => {
      if (secretCovers[g.id]) return; // already fetched
      const cacheKey = `secret_cover_${g.id}`;
      const cachedUrl = sessionStorage.getItem(cacheKey);
      if (cachedUrl) {
        setSecretCovers(prev => ({ ...prev, [g.id]: cachedUrl }));
        return;
      }
      const firstPlace = g.places[0];
      if (!firstPlace) return;
      const query = `${firstPlace.name} ${firstPlace.neighborhood} ${g.city}`;
      try {
        const data = await gTextSearch(
          { textQuery: query, maxResultCount: 1, languageCode: 'en' },
          'places.photos',
          TTL.PHOTOS,
        );
        const photoName = data.places?.[0]?.photos?.[1]?.name ?? data.places?.[0]?.photos?.[0]?.name;
        if (photoName) {
          const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`;
          sessionStorage.setItem(cacheKey, photoUrl);
          setSecretCovers(prev => ({ ...prev, [g.id]: photoUrl }));
        }
      } catch {}
    });
  }, [selectedExpCity?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [suggestedUsers, setSuggestedUsers] = useState<FollowProfile[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [exploreSavedPlaces, setExploreSavedPlaces] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  // Place save sheet state (for PlacePage onToggleSave)
  const [explorePlaceSaveSheet, setExplorePlaceSaveSheet] = useState<{ id: string; name: string } | null>(null);
  const [explorePlaceInCollections, setExplorePlaceInCollections] = useState<Set<string>>(new Set());
  const [exploreLoadingPlaceCollections, setExploreLoadingPlaceCollections] = useState(false);
  const [exploreSavePlans, setExploreSavePlans] = useState<Plan[]>([]);
  const [exploreSavePlanAdded, setExploreSavePlanAdded] = useState<Set<string>>(new Set());
  const [exploreSavePlanAdding, setExploreSavePlanAdding] = useState<string | null>(null);
  const [exploreSaveShowNewTrip, setExploreSaveShowNewTrip] = useState(false);
  const [exploreSaveNewTripName, setExploreSaveNewTripName] = useState('');
  const [exploreSaveCreatingTrip, setExploreSaveCreatingTrip] = useState(false);

  useEffect(() => {
    setExploreError(false);
    Promise.all([
      appUser?.id ? getDiscoveryPosts(appUser.id) : Promise.resolve([]),
      appUser?.id ? getFollowing(appUser.id) : Promise.resolve(new Set<string>()),
      appUser?.id ? buildTasteProfile(appUser.id) : Promise.resolve(null),
      appUser?.id ? getSavedPlaces(appUser.id).then(sp => setExploreSavedPlaces(new Set(sp.map(p => p.id)))) : Promise.resolve(),
      appUser?.id
        ? Promise.all([getBlockedUsers(appUser.id), getBlockersOfUser(appUser.id)])
            .then(([blocked, blockers]) => setBlockedUsers(new Set([...blocked, ...blockers])))
        : Promise.resolve(),
      appUser?.id ? getLikedPosts(appUser.id).then(setLikedPostIds) : Promise.resolve(),
      appUser?.id ? supabase.from('profiles').select('interests').eq('id', appUser.id).single().then(({ data }) => {
        const interests: string[] = data?.interests ?? [];
        setUserInterests(interests);
      }) : Promise.resolve(),
    ]).then(([fetchedPosts, followingSet, profile]) => {
      setPosts(fetchedPosts as RealPost[]);
      setFollowing(followingSet as Set<string>);
      setTasteProfile(profile as TasteProfile | null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setExploreError(true);
    });
  }, [appUser?.id]);

  // Invalidate module-level caches when user changes (prevents stale data across logout/login)
  useEffect(() => {
    _discoverCache = null;
    Object.keys(_cityDiscoverCache).forEach(k => delete _cityDiscoverCache[k]);
    Object.keys(_cityPlacesCache).forEach(k => delete _cityPlacesCache[k]);
    Object.keys(_nearbyCache).forEach(k => delete _nearbyCache[k]);
  }, [appUser?.id]);

  useEffect(() => {
    if (!query.trim()) setActiveSearchTab('For You');
  }, [query]);

  // Fetch cover photos for featured cities — hardcoded overrides first, then Unsplash, then cached
  useEffect(() => {
    if (activeTab !== 'Cities') return;
    const LS_PREFIX = 'sondrr_city_cover_v3_';

    // Apply hardcoded overrides immediately (no API needed)
    FEATURED_CITIES.forEach(city => {
      const override = CITY_COVER_OVERRIDES[city.name];
      if (override) setCityCoverPhotos(prev => ({ ...prev, [city.id]: override }));
    });

    // Seed remaining from localStorage (instant)
    FEATURED_CITIES.forEach(city => {
      if (CITY_COVER_OVERRIDES[city.name]) return;
      const cached = localStorage.getItem(LS_PREFIX + city.id);
      if (cached) setCityCoverPhotos(prev => prev[city.id] ? prev : { ...prev, [city.id]: cached });
    });

    // Fetch any still missing from Unsplash, staggered
    let slot = 0;
    FEATURED_CITIES.forEach(city => {
      if (CITY_COVER_OVERRIDES[city.name]) return;
      if (localStorage.getItem(LS_PREFIX + city.id)) return;
      const delay = slot++ * 300;
      setTimeout(async () => {
        try {
          const query = encodeURIComponent(CITY_PHOTO_QUERIES[city.name] ?? `${city.name} city`);
          const res = await fetch(
            `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high`,
            { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
          );
          const data = await res.json();
          const url: string = data.urls?.regular ?? data.urls?.full ?? '';
          if (url) {
            localStorage.setItem(LS_PREFIX + city.id, url);
            setCityCoverPhotos(prev => ({ ...prev, [city.id]: url }));
          }
        } catch { /* ignore */ }
      }, delay);
    });
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch places for selected city + category
  useEffect(() => {
    if (activeTab !== 'Cities' || !selectedExpCity) return;
    const cat = EXP_CATEGORIES.find(c => c.id === activeExpCategory);
    if (!cat) return;

    // Check session cache first — switching categories / coming back to a city is free
    const cityPlacesCacheKey = `${selectedExpCity.id}_${activeExpCategory}`;
    if (_cityPlacesCache[cityPlacesCacheKey]) {
      setCityPlaces(shuffleArray(_cityPlacesCache[cityPlacesCacheKey].places));
      setCityPlacesNextToken(_cityPlacesCache[cityPlacesCacheKey].nextToken);
      return;
    }

    setLoadingCityPlaces(true);
    setCityPlacesError(false);
    setCityPlaces([]);
    setCityPlacesNextToken(null);
    const mapPlaces = (places: any[], cityFallback: string) =>
      (places ?? []).map((p: any) => {
        const comps: any[] = p.addressComponents ?? [];
        const find = (...types: string[]) => { const c = comps.find((c: any) => types.some(t => c.types?.includes(t))); return c ? (c.longText || c.shortText || '') : ''; };
        const cityName = find('locality') || find('administrative_area_level_1') || cityFallback;
        const country = find('country');
        const neighborhood = extractNeighborhood(comps, p.formattedAddress, cityName);
        const category = googleTypesToCategory(p.types ?? []);
        const photo = p.photos?.[1] ?? p.photos?.[0];
        const photoUrl = photo ? `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${GOOGLE_PLACES_KEY}` : '';
        const name = p.displayName?.text ?? '';
        if (!name || !isLatinScript(name)) return null;
        const desc: string = typeof p.editorialSummary === 'string' ? p.editorialSummary : (p.editorialSummary?.text ?? '');
        return { id: p.id ?? '', name, category, neighborhood: neighborhood || '', city: cityName, country, photoUrl, position: 0, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, description: desc || undefined } as RealPostPlace;
      }).filter(Boolean) as RealPostPlace[];
    gTextSearch(
      { textQuery: `${cat.query} in ${selectedExpCity.name}`, maxResultCount: 20, languageCode: 'en', locationBias: { circle: { center: { latitude: selectedExpCity.lat, longitude: selectedExpCity.lng }, radius: 40000 } } },
      'places.id,places.displayName,places.addressComponents,places.formattedAddress,places.types,places.photos,places.location,places.rating,places.editorialSummary,nextPageToken',
      TTL.DISCOVERY,
    ).then(data => {
      const mapped = mapPlaces(data.places, selectedExpCity!.name);
      const nextToken = data.nextPageToken ?? null;
      _cityPlacesCache[cityPlacesCacheKey] = { places: mapped, nextToken, ts: Date.now() };
      evictOldest(_cityPlacesCache, MAX_CACHE_ENTRIES);
      setCityPlaces(mapped);
      setCityPlacesNextToken(nextToken);
      setLoadingCityPlaces(false);
    }).catch(() => { setLoadingCityPlaces(false); setCityPlacesError(true); });
  }, [activeTab, selectedExpCity, activeExpCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll — fetch next page from Google Places when sentinel visible
  useEffect(() => {
    const sentinel = cityPlacesSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      if (!cityPlacesNextToken || loadingMoreCityPlaces || !selectedExpCity) return;
      const cat = EXP_CATEGORIES.find(c => c.id === activeExpCategory);
      if (!cat) return;
      setLoadingMoreCityPlaces(true);
      gTextSearch(
        { textQuery: `${cat.query} in ${selectedExpCity.name}`, maxResultCount: 20, pageToken: cityPlacesNextToken, languageCode: 'en', locationBias: { circle: { center: { latitude: selectedExpCity.lat, longitude: selectedExpCity.lng }, radius: 40000 } } },
        'places.id,places.displayName,places.addressComponents,places.formattedAddress,places.types,places.photos,places.location,places.rating,places.editorialSummary,nextPageToken',
        TTL.DISCOVERY,
      ).then(data => {
        const more = (data.places ?? []).map((p: any) => {
          const comps: any[] = p.addressComponents ?? [];
          const find = (...types: string[]) => { const c = comps.find((c: any) => types.some(t => c.types?.includes(t))); return c ? (c.longText || c.shortText || '') : ''; };
          const cityName = find('locality') || find('administrative_area_level_1') || selectedExpCity!.name;
          const country = find('country');
          const neighborhood = extractNeighborhood(comps, p.formattedAddress, cityName);
          const category = googleTypesToCategory(p.types ?? []);
          const photo = p.photos?.[1] ?? p.photos?.[0];
          const photoUrl = photo ? `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${GOOGLE_PLACES_KEY}` : '';
          const name = p.displayName?.text ?? '';
          if (!name || !isLatinScript(name)) return null;
          const desc: string = typeof p.editorialSummary === 'string' ? p.editorialSummary : (p.editorialSummary?.text ?? '');
          return { id: p.id ?? '', name, category, neighborhood: neighborhood || '', city: cityName, country, photoUrl, position: 0, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, description: desc || undefined } as RealPostPlace;
        }).filter(Boolean) as RealPostPlace[];
        setCityPlaces(prev => [...prev, ...more]);
        setCityPlacesNextToken(data.nextPageToken ?? null);
        setLoadingMoreCityPlaces(false);
      }).catch(() => setLoadingMoreCityPlaces(false));
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cityPlaces, cityPlacesNextToken, loadingMoreCityPlaces, selectedExpCity, activeExpCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced city autocomplete for Activities search
  useEffect(() => {
    if (expCityTimerRef.current) clearTimeout(expCityTimerRef.current);
    if (!expCityQuery.trim() || expCityQuery.trim().length < 3) { setExpCitySuggestions([]); return; }
    expCityTimerRef.current = setTimeout(async () => {
      try {
        const data = await gAutocomplete({ input: expCityQuery, languageCode: 'en', includedPrimaryTypes: ['locality', 'administrative_area_level_1'], sessionToken: expCitySessionTokenRef.current });
        setExpCitySuggestions((data.suggestions ?? []).slice(0, 5).map((s: any) => ({ placeId: s.placePrediction?.placeId ?? '', text: s.placePrediction?.text?.text ?? '' })).filter((s: any) => s.placeId));
      } catch { setExpCitySuggestions([]); }
    }, 300);
  }, [expCityQuery]);

  const handleExpCitySelect = async (placeId: string, text: string) => {
    setExpCityQuery('');
    setExpCitySuggestions([]);
    const token = expCitySessionTokenRef.current;
    expCitySessionTokenRef.current = crypto.randomUUID();
    try {
      const data = await gPlaceDetails(placeId, 'location,addressComponents,displayName', token, TTL.ENRICHMENT);
      const comps: any[] = data.addressComponents ?? [];
      const find = (...types: string[]) => { const c = comps.find((c: any) => types.some(t => c.types?.includes(t))); return c ? (c.longText || c.shortText || '') : ''; };
      const cityName = data.displayName?.text || find('locality') || find('administrative_area_level_1') || text;
      const country = find('country');
      const lat = data.location?.latitude;
      const lng = data.location?.longitude;
      if (lat && lng) setSelectedExpCity({ id: `custom_${placeId}`, name: cityName, country, lat, lng });
    } catch { /* ignore */ }
  };



  useEffect(() => {
    if (!appUser?.id) return;
    setLoadingGuides(true);
    getGuides(appUser.id).then(g => { setGuides(g); setLoadingGuides(false); });
    getSubscribedGuideIds(appUser.id).then(ids => setExploreSubscribedGuideIds(new Set(ids)));
  }, [appUser?.id]);

  // Debounced search — profiles + posts + places
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setUserResults([]); setPostResults([]); setPlaceResults([]); setSearchingContent(false); return; }
    setSearchingContent(true);
    searchTimerRef.current = setTimeout(async () => {
      const [profiles, { posts, places }] = await Promise.all([
        searchProfiles(query, appUser?.id ?? ''),
        globalSearch(query),
      ]);
      setUserResults(profiles);
      setPostResults(posts);
      setPlaceResults(places);
      setSearchingContent(false);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, appUser?.id]);

  const GEO_TYPES = new Set(['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country', 'political', 'colloquial_area', 'continent']);
  const FIELD_MASK = 'places.id,places.displayName,places.addressComponents,places.formattedAddress,places.types,places.photos,places.location,places.rating,places.editorialSummary';
  // Fetch up to `targetCount` results for one city+query by chaining nextPageToken (max 20 per page)
  const fetchCityPaginated = async (textQuery: string, includedType: string, city: string, targetCount: number): Promise<RealPostPlace[]> => {
    const places: RealPostPlace[] = [];
    let token: string | null = null;
    const pages = Math.ceil(targetCount / 20);
    for (let page = 0; page < pages; page++) {
      const body: Record<string, unknown> = { textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, maxResultCount: 20, languageCode: 'en' };
      if (token) body.pageToken = token;
      try {
        const d = await gTextSearch(body, FIELD_MASK, TTL.DISCOVERY);
        const mapped = byRating(d.places ?? []).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[];
        places.push(...mapped);
        token = d.nextPageToken ?? null;
        if (!token) break;
      } catch { break; }
    }
    return places;
  };

  const mapPlace = (p: any, cityOverride?: string, countryOverride?: string): RealPostPlace | null => {
    const comps: any[] = p.addressComponents ?? [];
    const find = (...types: string[]) => { const c = comps.find((c: any) => types.some(t => c.types?.includes(t))); return c ? (c.longText || c.shortText || '') : ''; };
    const rawCity = normalizeCity(cityOverride || find('postal_town') || find('locality') || find('administrative_area_level_1'));
    const isLatin = (s: string) => /^[\u0000-\u024F\s,.\-'()&]+$/.test(s);
    const city = isLatin(rawCity) ? rawCity : (cityOverride ?? '');
    const country = countryOverride || find('country');
    const neighborhood = extractNeighborhood(comps, p.formattedAddress, city);
    const category = googleTypesToCategory(p.types ?? []);
    // Prefer index 1 (often a user photo) over index 0 (often a business promo/logo image)
    const photoName = (p.photos?.[1] ?? p.photos?.[0])?.name;
    const photoUrl = photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=600&key=${GOOGLE_PLACES_KEY}` : '';
    const name = p.displayName?.text ?? '';
    // Reject places whose name is not in Latin script
    if (!isLatin(name)) return null;
    const description: string = typeof p.editorialSummary === 'string' ? p.editorialSummary : (p.editorialSummary?.text ?? '');
    return { id: p.id ?? `discover_${Math.random()}`, name, category, neighborhood: neighborhood || '', city: city || '', country, photoUrl, position: 0, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, description: description || undefined };
  };

  // Sort raw Google results by rating descending before mapping
  const byRating = (places: any[]) => [...places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  // Normalize city names to consistent short forms
  const normalizeCity = (city: string): string => {
    const map: Record<string, string> = {
      'ciudad de méxico': 'CDMX', 'ciudad de mexico': 'CDMX', 'mexico city': 'CDMX',
      'new york city': 'New York', 'nyc': 'New York',
      'los angeles': 'Los Angeles', 'la': 'Los Angeles',
      'san francisco': 'San Francisco', 'sf': 'San Francisco',
      'london': 'London', 'greater london': 'London',
      'paris': 'Paris', 'île-de-france': 'Paris',
      'tokyo': 'Tokyo', 'tokyo metropolis': 'Tokyo',
      'bangkok': 'Bangkok', 'krung thep maha nakhon': 'Bangkok',
    };
    return map[city.toLowerCase()] ?? city;
  };

  const nearbyGroups = [
    ['restaurant', 'cafe', 'bar', 'night_club', 'bakery'],
    ['lodging', 'resort_hotel'],
    ['museum', 'art_gallery', 'tourist_attraction', 'amusement_park', 'zoo'],
    ['spa', 'shopping_mall', 'park', 'clothing_store'],
  ];

  const fetchNearby = async (lat: number, lng: number, radius: number, city: string, country: string, filterType?: string): Promise<RealPostPlace[]> => {
    // Cache key: round lat/lng to 3 decimal places (~100m precision) + filter
    const latR = lat.toFixed(3);
    const lngR = lng.toFixed(3);
    const nearbyKey = `${latR}_${lngR}_${filterType ?? 'all'}`;
    if (_nearbyCache[nearbyKey] && Date.now() - _nearbyCache[nearbyKey].ts < NEARBY_CACHE_TTL) {
      return _nearbyCache[nearbyKey].places;
    }

    const groups = filterType ? [[filterType]] : nearbyGroups;
    const results = await Promise.all(groups.map(types =>
      gNearbySearch(
        { locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } }, includedTypes: types, maxResultCount: 10, languageCode: 'en', rankPreference: 'POPULARITY' },
        FIELD_MASK,
        TTL.NEARBY,
      ).then(d => byRating(d.places ?? []).slice(0, 8).map((p: any) => mapPlace(p, city, country)).filter(Boolean) as RealPostPlace[]).catch(() => [])
    ));
    // Interleave results so categories mix: take one from each group in turn
    const maxLen = Math.max(...results.map(r => r.length));
    const interleaved: RealPostPlace[] = [];
    for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r[i]) interleaved.push(r[i]); });
    const seenIds = new Set<string>(); const seenNames = new Set<string>();
    const places = interleaved.filter(p => {
      const nameKey = p.name.toLowerCase().slice(0, 30);
      if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
      seenIds.add(p.id); seenNames.add(nameKey); return true;
    });
    _nearbyCache[nearbyKey] = { places, ts: Date.now() };
    evictOldest(_nearbyCache, MAX_CACHE_ENTRIES);
    return places;
  };

  // Per-chip search config: specific text query + primary Google Places type
  const categoryChipSearchConfig: Record<string, { textQuery: string; includedType: string }> = {
    restaurant:    { textQuery: 'best restaurant',              includedType: 'restaurant' },
    cafe:          { textQuery: 'best cafe coffee shop',        includedType: 'cafe' },
    bar:           { textQuery: 'best cocktail bar',            includedType: 'bar' },
    treats:        { textQuery: 'best bakery pastry shop',      includedType: 'bakery' },
    nightlife:     { textQuery: 'best nightclub music venue',   includedType: 'night_club' },
    food:          { textQuery: 'best food market street food',  includedType: 'restaurant' },
    hotel:         { textQuery: 'best boutique hotel',          includedType: 'lodging' },
    landmark:      { textQuery: 'famous landmark monument',     includedType: 'tourist_attraction' },
    art:           { textQuery: 'best art gallery museum',      includedType: 'art_gallery' },
    nature:        { textQuery: 'best national park nature',    includedType: 'park' },
    beach:         { textQuery: 'best beach',                   includedType: 'beach' },
    shop:          { textQuery: 'best shopping street market',  includedType: 'shopping_mall' },
    experience:    { textQuery: 'best things to do unique experience', includedType: 'amusement_park' },
    neighbourhood: { textQuery: 'most famous neighbourhood area',      includedType: 'park' },
    sports:        { textQuery: 'best sports venue stadium',    includedType: 'stadium' },
    wellness:      { textQuery: 'best spa wellness retreat',    includedType: 'spa' },
  };

  // Google Places discover — always fires (default For You + search + category)
  useEffect(() => {
    if (discoverTimerRef.current) clearTimeout(discoverTimerRef.current);
    const hasQuery = query.trim().length >= 2;
    const hasCategoryFilter = activeCategory !== 'all';
    const delay = hasQuery || hasCategoryFilter ? 400 : 0;

    discoverTimerRef.current = setTimeout(async () => {
      setLoadingDiscover(true);
      setDiscoverGeoState(null);
      setDiscoverTextToken(null);
      setDiscoverDefaultTokens([]);
      setDiscoverCityPage(0);
      try {
        if (hasQuery) {
          // Text search path
          const data = await gTextSearch(
            { textQuery: query.trim(), maxResultCount: 20, languageCode: 'en' },
            FIELD_MASK,
            TTL.DISCOVERY,
          );
          const raw: any[] = data.places ?? [];
          const top = raw[0];
          const isGeo = top && (top.types ?? []).some((t: string) => GEO_TYPES.has(t));

          if (isGeo && top.location) {
            const comps: any[] = top.addressComponents ?? [];
            const find = (...types: string[]) => { const c = comps.find((c: any) => types.some(t => c.types?.includes(t))); return c ? (c.longText || c.shortText || '') : ''; };
            const city = top.displayName?.text || find('locality') || find('administrative_area_level_1');
            const country = find('country');
            setDiscoverGeoState({ lat: top.location.latitude, lng: top.location.longitude, city, country, radius: 0 });
            setDiscoverCityPage(0);
            if (hasCategoryFilter) {
              // Chip + city: targeted text search for this category in this city
              const chipCacheKey = `${city}_${activeCategory}`;
              if (_cityDiscoverCache[chipCacheKey] && Date.now() - _cityDiscoverCache[chipCacheKey].ts < CACHE_TTL) {
                setDiscoverResults(shuffleArray(_cityDiscoverCache[chipCacheKey].results));
                setDiscoverDefaultTokens(_cityDiscoverCache[chipCacheKey].tokens);
                setLoadingDiscover(false);
                return;
              }
              const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
              const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.slice(0, 4).map((_, i) => {
                const cfg = i === 0 ? chipCfg : chipCfg; // same chip, multiple fetches for volume
                return gTextSearch(
                  { textQuery: `${cfg.textQuery} ${city}`, includedType: cfg.includedType, minRating: 3.5, languageCode: 'en' },
                  FIELD_MASK,
                  TTL.DISCOVERY,
                ).then(d => ({ places: byRating(d.places ?? []).slice(0, 8).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
              }));
              const chipTokens = results.map(r => r.token);
              const all = results.flatMap(r => r.places);
              const seenIds = new Set<string>(); const seenNames = new Set<string>();
              const chipResults = shuffleArray(all.filter(p => { const k = p.name.toLowerCase().slice(0, 30); if (!p.name || seenIds.has(p.id) || seenNames.has(k)) return false; seenIds.add(p.id); seenNames.add(k); return true; }));
              _cityDiscoverCache[chipCacheKey] = { results: chipResults, tokens: chipTokens, ts: Date.now() }; evictOldest(_cityDiscoverCache, MAX_CACHE_ENTRIES);
              setDiscoverDefaultTokens(chipTokens);
              setDiscoverResults(chipResults);
            } else {
              // All + city: run all category searches for this city
              const allCacheKey = `${city}_all`;
              if (_cityDiscoverCache[allCacheKey] && Date.now() - _cityDiscoverCache[allCacheKey].ts < CACHE_TTL) {
                setDiscoverResults(shuffleArray(_cityDiscoverCache[allCacheKey].results));
                setDiscoverDefaultTokens(_cityDiscoverCache[allCacheKey].tokens);
                setLoadingDiscover(false);
                return;
              }
              const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }) =>
                gTextSearch(
                  { textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, languageCode: 'en' },
                  FIELD_MASK,
                  TTL.DISCOVERY,
                ).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }))
              ));
              const allTokens = results.map(r => r.token);
              const interleaved: RealPostPlace[] = [];
              const maxLen = Math.max(...results.map(r => r.places.length));
              for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
              const seenIds = new Set<string>(); const seenNames = new Set<string>();
              const allResults = shuffleArray(interleaved.filter(p => { const k = p.name.toLowerCase().slice(0, 30); if (!p.name || seenIds.has(p.id) || seenNames.has(k)) return false; seenIds.add(p.id); seenNames.add(k); return true; }));
              _cityDiscoverCache[allCacheKey] = { results: allResults, tokens: allTokens, ts: Date.now() }; evictOldest(_cityDiscoverCache, MAX_CACHE_ENTRIES);
              setDiscoverDefaultTokens(allTokens);
              setDiscoverResults(allResults);
            }
          } else {
            setDiscoverTextToken(data.nextPageToken ?? null);
            setDiscoverResults((raw.map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[]).filter(p => p.name));
          }
        } else if (hasCategoryFilter) {
          // Category chip path — start with 2 cities × 20 results each, load more on scroll
          setDiscoverCityPage(0);
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const { textQuery: chipQuery, includedType } = chipCfg;
          const cities = WORLD_CITIES.slice(0, 2);
          const results = await Promise.all(cities.map(city => fetchCityPaginated(chipQuery, includedType, city, 20)));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r[i]) interleaved.push(r[i]); });
          const seenIds = new Set<string>(); const seenNames = new Set<string>();
          setDiscoverResults(shuffleArray(interleaved.filter(p => {
            const nameKey = p.name.toLowerCase().slice(0, 30);
            if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
            seenIds.add(p.id); seenNames.add(nameKey); return true;
          })));
        } else {
          // Default "For You" — city-specific queries rotated through world cities
          setDiscoverCityPage(0);
          if (_discoverCache && Date.now() - _discoverCache.ts < CACHE_TTL) {
            setDiscoverResults(shuffleArray(_discoverCache.results));
            setDiscoverDefaultTokens(_discoverCache.tokens);
            setLoadingDiscover(false);
            return;
          }
          const cityOffset = 0;
          const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }, i) => {
            const city = WORLD_CITIES[(cityOffset * DEFAULT_CATEGORY_SEARCHES.length + i) % WORLD_CITIES.length];
            return gTextSearch(
              { textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, maxResultCount: 20, languageCode: 'en' },
              FIELD_MASK,
              TTL.DISCOVERY,
            ).then(d => ({ places: byRating(d.places ?? []).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.places.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
          const seenIds = new Set<string>(); const seenNames = new Set<string>();
          const shuffledResults = shuffleArray(interleaved.filter(p => {
            const nameKey = p.name.toLowerCase().slice(0, 30);
            if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
            seenIds.add(p.id); seenNames.add(nameKey); return true;
          }));
          setDiscoverResults(shuffledResults);
          _discoverCache = { results: shuffledResults, tokens: results.map(r => r.token), ts: Date.now() };
        }
      } catch { setDiscoverResults([]); }
      finally { setLoadingDiscover(false); }
    }, delay);
    return () => { if (discoverTimerRef.current) clearTimeout(discoverTimerRef.current); };
  }, [query, activeCategory]);

  // Infinite scroll — observe sentinel at bottom of grid
  useEffect(() => { loadMoreDiscoverRef.current = loadMoreDiscover; });
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMoreDiscoverRef.current();
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const loadMoreDiscover = async () => {
    if (loadingMoreDiscover) return;
    setLoadingMoreDiscover(true);
    try {
      if (discoverGeoState) {
        // Geo mode: paginate via tokens or next city page
        const { city } = discoverGeoState;
        const nextPage = discoverCityPage + 1;
        setDiscoverCityPage(nextPage);
        const existingIds = new Set(discoverResults.map(p => p.id));
        const existingNames = new Set(discoverResults.map(p => p.name.toLowerCase().slice(0, 30)));
        if (activeCategory !== 'all') {
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const results = await Promise.all(discoverDefaultTokens.map((token, i) => {
            const body = token
              ? { textQuery: `${chipCfg.textQuery} ${city}`, includedType: chipCfg.includedType, pageToken: token, languageCode: 'en' }
              : { textQuery: `${chipCfg.textQuery} ${city}`, includedType: chipCfg.includedType, minRating: 3.5, languageCode: 'en' };
            return gTextSearch(body, FIELD_MASK, TTL.DISCOVERY)
              .then(d => ({ places: byRating(d.places ?? []).slice(0, 8).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const more = results.flatMap(r => r.places).filter(p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase().slice(0, 30)));
          setDiscoverResults(prev => [...prev, ...more]);
        } else {
          const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }, i) => {
            const token = discoverDefaultTokens[i];
            const body = token
              ? { textQuery: `${textQuery} ${city}`, includedType, pageToken: token, languageCode: 'en' }
              : { textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, languageCode: 'en' };
            return gTextSearch(body, FIELD_MASK, TTL.DISCOVERY)
              .then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.places.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
          const more = interleaved.filter(p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase().slice(0, 30)));
          setDiscoverResults(prev => [...prev, ...more]);
        }
      } else if (discoverTextToken) {
        const data = await gTextSearch(
          { textQuery: query.trim(), languageCode: 'en', pageToken: discoverTextToken },
          FIELD_MASK,
          TTL.DISCOVERY,
        );
        setDiscoverTextToken(data.nextPageToken ?? null);
        const more: RealPostPlace[] = ((data.places ?? []).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[]).filter((p: RealPostPlace) => p.name);
        setDiscoverResults(prev => [...prev, ...more]);
      } else {
        // City rotation load more — covers both default "For You" and category chips
        const nextPage = discoverCityPage + 1;
        setDiscoverCityPage(nextPage);
        const existingIds = new Set(discoverResults.map(p => p.id));
        const existingNames = new Set(discoverResults.map(p => p.name.toLowerCase().slice(0, 30)));

        let morePlaces: RealPostPlace[] = [];

        if (activeCategory !== 'all' && query.trim().length < 2) {
          // Category chip load-more — next 2 cities × 20 results each
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const { textQuery: chipQuery, includedType } = chipCfg;
          const cityStart = (nextPage * 2) % WORLD_CITIES.length;
          const cities = [...WORLD_CITIES.slice(cityStart, cityStart + 2), ...WORLD_CITIES.slice(0, Math.max(0, cityStart + 2 - WORLD_CITIES.length))].slice(0, 2);
          const results = await Promise.all(cities.map(city => fetchCityPaginated(chipQuery, includedType, city, 20)));
          const maxLen = Math.max(...results.map(r => r.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r[i]) morePlaces.push(r[i]); });
        } else {
          // Default "For You" — next city set across all category searches
          const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }, i) => {
            const token = discoverDefaultTokens[i];
            if (token) {
              return gTextSearch(
                { textQuery, includedType, pageToken: token, languageCode: 'en' },
                FIELD_MASK,
                TTL.DISCOVERY,
              ).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
            }
            const city = WORLD_CITIES[(nextPage * DEFAULT_CATEGORY_SEARCHES.length + i) % WORLD_CITIES.length];
            return gTextSearch(
              { textQuery: `${textQuery} ${city}`, includedType, minRating: 3.8, languageCode: 'en' },
              FIELD_MASK,
              TTL.DISCOVERY,
            ).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const maxLen = Math.max(...results.map(r => r.places.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) morePlaces.push(r.places[i]); });
        }

        const deduped = morePlaces.filter(p => {
          const nameKey = p.name.toLowerCase().slice(0, 30);
          if (!p.name || existingIds.has(p.id) || existingNames.has(nameKey)) return false;
          existingIds.add(p.id); existingNames.add(nameKey); return true;
        });
        setDiscoverResults(prev => [...prev, ...deduped]);
      }
    } catch {}
    finally { setLoadingMoreDiscover(false); }
  };

  // Stable per-place pseudo-random tiebreaker (no Math.random in sort)
  const stableNoise = (id: string): number => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
    return ((h >>> 0) % 1000) / 1000;
  };

  // Score a place against the taste profile
  const tasteSore = (cat: string, city: string): number => {
    if (!tasteProfile || tasteProfile.totalSignals === 0) return 0;
    const catScore = tasteProfile.categoryWeights[cat] ?? 0;
    const cityBonus = tasteProfile.topCities.includes(city) ? 0.1 : 0;
    return catScore * 0.9 + cityBonus;
  };

  // Flatten posts → individual place cards
  const allPlaces: FlatPlace[] = useMemo(() => {
    const flat = posts.flatMap(post =>
      post.places.map((pl, i) => ({
        placeId: pl.id,
        name: pl.name,
        category: pl.category.toLowerCase(),
        neighborhood: pl.neighborhood,
        city: pl.city,
        country: pl.country,
        photoUrl: pl.photoUrl,
        indexInPost: i,
        post,
      }))
    );

    if (tasteProfile && tasteProfile.totalSignals > 0) {
      // Blend taste score (30%) with stable noise (70%) so it nudges rather than clusters
      return [...flat].sort((a, b) => {
        const sA = tasteSore(a.category, a.city) * 0.3 + stableNoise(a.placeId) * 0.7;
        const sB = tasteSore(b.category, b.city) * 0.3 + stableNoise(b.placeId) * 0.7;
        return sB - sA;
      });
    }

    // No profile yet — Fisher-Yates shuffle
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    return flat;
  }, [posts, tasteProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryFiltered = activeCategory === 'all'
    ? allPlaces
    : allPlaces.filter(p => p.category === activeCategory);

  const filteredDiscover = (() => {
    const byCategory = activeCategory === 'all'
      ? discoverResults
      : discoverResults.filter(p => p.category === activeCategory);

    // When showing "All", blend interest-matching places in at ~2:1 ratio
    const sorted = (activeCategory === 'all' && userInterests.length > 0)
      ? (() => {
          const matched = byCategory.filter(p => userInterests.includes(p.category ?? ''));
          const rest = byCategory.filter(p => !userInterests.includes(p.category ?? ''));
          const blended: typeof byCategory = [];
          let m = 0, r = 0;
          while (m < matched.length || r < rest.length) {
            if (m < matched.length) blended.push(matched[m++]);
            if (m < matched.length) blended.push(matched[m++]);
            if (r < rest.length) blended.push(rest[r++]);
          }
          return blended;
        })()
      : byCategory;

    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.neighborhood?.toLowerCase().includes(q)
    );
  })();

  // Search query applied on top of category filter (curio posts)
  const filtered = query
    ? categoryFiltered.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.city.toLowerCase().includes(query.toLowerCase()) ||
        p.post.profile.name.toLowerCase().includes(query.toLowerCase()) ||
        p.post.profile.username.toLowerCase().includes(query.toLowerCase())
      )
    : categoryFiltered;

  // Map places — search + category filtered, only those with valid coordinates
  type MapPlaceEntry = { id: string; lat: number; lng: number; name: string; neighborhood?: string; city: string; country: string; photoUrl: string; type: 'curio' | 'discover'; flatPlace?: FlatPlace; discoverPlace?: RealPostPlace };
  const exploreMapPlaces = useMemo((): MapPlaceEntry[] => {
    const places: MapPlaceEntry[] = [];
    for (const fp of filtered) {
      const pl = fp.post.places.find(p => p.id === fp.placeId);
      if (pl?.lat && pl?.lng) {
        places.push({ id: fp.placeId, lat: pl.lat, lng: pl.lng, name: fp.name, neighborhood: fp.neighborhood, city: fp.city, country: fp.country, photoUrl: fp.photoUrl, type: 'curio', flatPlace: fp });
      }
    }
    for (const dp of filteredDiscover) {
      if (dp.lat && dp.lng) {
        places.push({ id: dp.id, lat: dp.lat, lng: dp.lng, name: dp.name, neighborhood: dp.neighborhood, city: dp.city, country: dp.country, photoUrl: dp.photoUrl, type: 'discover', discoverPlace: dp });
      }
    }
    return places;
  }, [filtered, filteredDiscover]); // eslint-disable-line react-hooks/exhaustive-deps

  // Places visible in the current map viewport (updates on pan/zoom)
  const visibleMapPlaces = useMemo((): MapPlaceEntry[] => {
    if (!mapBounds) return exploreMapPlaces;
    return exploreMapPlaces.filter(p =>
      p.lat >= mapBounds.south && p.lat <= mapBounds.north &&
      p.lng >= mapBounds.west && p.lng <= mapBounds.east
    );
  }, [exploreMapPlaces, mapBounds]);

  // Unified interleaved grid — 1 curio : 2 discover so discovery content fills the feed
  type MixedCard = { type: 'curio'; place: FlatPlace } | { type: 'discover'; place: RealPostPlace };
  const mixedGrid = (curio: FlatPlace[], discover: RealPostPlace[]): MixedCard[] => {
    const out: MixedCard[] = [];
    let ci = 0, di = 0;
    while (ci < curio.length || di < discover.length) {
      if (curio[ci]) out.push({ type: 'curio', place: curio[ci++] });
      if (discover[di]) out.push({ type: 'discover', place: discover[di++] });
      if (discover[di]) out.push({ type: 'discover', place: discover[di++] });
    }
    return out;
  };

  const [unfollowConfirm, setUnfollowConfirm] = useState<{ userId: string; username: string } | null>(null);

  const toggleFollow = async (userId: string, username?: string) => {
    if (!appUser?.id) return;
    if (following.has(userId)) {
      setUnfollowConfirm({ userId, username: username || '' });
    } else {
      setFollowing(prev => new Set(prev).add(userId));
      await smartFollow(appUser.id, userId);
    }
  };

  if (viewingUserId && appUser) {
    return <UserProfile userId={viewingUserId} currentUserId={appUser.id} onBack={() => setViewingUserId(null)} onFollowChange={() => {}} onMessage={onOpenMessages} />;
  }

  if (exploreError) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center gap-4 px-8">
        <p className="text-sm text-gray-500 text-center">Something went wrong loading your feed.</p>
        <button
          onClick={() => { setExploreError(false); setLoading(true); }}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-full"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className={`sticky top-0 z-10 bg-white px-4 pt-5 ${exploreMapMode ? '' : 'border-b border-gray-100'} ${activeTab === 'Cities' ? 'pb-0' : 'pb-3'}`}>
        <div className="flex items-center justify-between mb-3">
          <SondrrLogo height={22} color="#0f172a" />
          <div className="flex items-center gap-2">
            {(activeTab === 'For You' || (query.trim() && activeSearchTab !== 'People')) && (
              <button
                onClick={() => { setExploreMapMode(m => !m); setSelectedMapPin(null); }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
              >
                {exploreMapMode
                  ? <LayoutGrid size={16} strokeWidth={1.5} className="text-gray-700" />
                  : <Map size={16} strokeWidth={1.5} className="text-gray-700" />
                }
              </button>
            )}
            {onOpenMessages && (
              <button onClick={onOpenMessages} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
                <Mail size={17} strokeWidth={1.5} className="text-gray-700" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cities, places, people..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Tabs */}
        {query.trim() ? (
          /* Search mode tabs */
          <div className="flex items-center gap-5 mb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {(['For You', 'People', 'Posts', 'Guides', 'Collections'] as SearchTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSearchTab(tab)}
                className={`text-sm font-medium pb-2.5 transition-colors whitespace-nowrap ${
                  activeSearchTab === tab ? 'text-gray-900 border-b-2 border-gray-900 -mb-px' : 'text-gray-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : (
          /* Default tabs */
          <div className={`flex items-center gap-5 ${activeTab === 'Cities' ? 'mb-0 pb-3' : 'mb-3'}`}>
            {(['For You', 'Cities'] as FeedTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab === 'Cities') { setExploreMapMode(false); setSelectedExpCity(null); setCityPlaces([]); } }}
                className={`text-sm font-medium pb-2.5 transition-colors ${
                  activeTab === tab ? 'text-gray-900 border-b-2 border-gray-900 -mb-px' : 'text-gray-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Category chips */}
        <div className={`flex gap-2 overflow-x-auto -mx-4 px-4 ${(query.trim() ? (activeSearchTab !== 'For You') : activeTab !== 'For You') ? 'hidden' : ''}`} style={{ scrollbarWidth: 'none' }}>
          {categoryChips.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveCategory(chip.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCategory === chip.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </div>



      {/* ── Search loading indicator ── */}
      {query.trim() && searchingContent && (
        <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
      )}

      {/* ── Posts search results ── */}
      {query.trim() && activeSearchTab === 'Posts' && !searchingContent && (
        <div className="px-4 pt-4 pb-8">
          {postResults.length === 0 && placeResults.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No results for "{query}"</p>
          ) : (
            <>
              {placeResults.length > 0 && (
                <>
                  <p className="text-sm font-bold text-gray-900 mb-3">Places</p>
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {placeResults.map(place => (
                      <button key={place.id} onClick={() => setSelectedPlacePage(place)}
                        className="relative aspect-square rounded-2xl overflow-hidden active:scale-[0.97] transition-all text-left">
                        {place.photoUrl
                          ? <img src={place.photoUrl} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
                          : <div className="absolute inset-0 bg-gray-200 flex items-center justify-center text-2xl">📍</div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <p className="text-xs font-bold text-white leading-tight truncate">{place.name}</p>
                          <p className="text-[10px] text-white/60 truncate mt-0.5">{[place.neighborhood, place.city].filter(Boolean).join(', ')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {postResults.filter(p => !blockedUsers.has(p.userId)).length > 0 && (
                <>
                  <p className="text-sm font-bold text-gray-900 mb-3">Posts</p>
                  <div className="space-y-3">
                    {postResults.filter(p => !blockedUsers.has(p.userId)).map(post => {
                      const firstPhoto = post.places.find(p => p.photoUrl)?.photoUrl;
                      return (
                        <div key={post.id} className="flex items-center gap-3 active:opacity-70">
                          {firstPhoto
                            ? <img src={firstPhoto} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
                            : <div className="w-14 h-14 rounded-2xl bg-gray-100 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">@{post.profile.username || post.profile.name}</p>
                            {post.caption && <p className="text-xs text-gray-500 truncate mt-0.5">{post.caption}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{post.places.map(p => p.name).filter(Boolean).slice(0, 2).join(' · ')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* People results — preview in For You, full list in People tab */}
      {query.trim() && (activeSearchTab === 'For You' || activeSearchTab === 'People') && userResults.filter(u => !blockedUsers.has(u.id)).length > 0 && (
        <div className="px-4 pt-4 pb-2">
          {activeSearchTab === 'For You' && <p className="text-sm font-bold text-gray-900 mb-3">People</p>}
          <div className="space-y-3">
            {(activeSearchTab === 'People' ? userResults.filter(u => !blockedUsers.has(u.id)) : userResults.filter(u => !blockedUsers.has(u.id)).slice(0, 3)).map(user => {
              const isFollowing = following.has(user.id);
              const isOwnProfile = appUser?.id === user.id;
              return (
                <div key={user.id} className="flex items-center gap-3">
                  <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setViewingUserId(user.id)}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-gray-400 text-sm font-semibold">{user.name?.[0]?.toUpperCase()}</span></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                    </div>
                  </button>
                  {!isOwnProfile && appUser?.id && (
                    <button
                      onClick={() => toggleFollow(user.id, user.username)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-gray-900 text-white'}`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {activeSearchTab === 'For You' && userResults.filter(u => !blockedUsers.has(u.id)).length > 3 && (
            <button onClick={() => setActiveSearchTab('People')} className="mt-3 text-xs font-semibold text-orange-500">
              See all {userResults.filter(u => !blockedUsers.has(u.id)).length} people →
            </button>
          )}
        </div>
      )}
      {query.trim() && activeSearchTab === 'People' && userResults.filter(u => !blockedUsers.has(u.id)).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <p className="text-sm font-bold text-gray-900 mb-1">No people found</p>
          <p className="text-xs text-gray-400">Try a different name or username</p>
        </div>
      )}

      {/* Grid — place cards (hidden on Guides tab) */}
      {(activeTab === 'For You' && !query.trim() || query.trim() && activeSearchTab === 'For You') && exploreMapMode && activeSearchTab !== 'People' && (
        <div>
          {/* Map — floats above the scrollable grid */}
          <div className="relative" style={{ height: 'calc(42dvh)' }}>
              {/* Hint badge */}
            {visibleMapPlaces.length > 0 && (
              <div className="absolute bottom-3 left-3 z-[999] bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
                <p className="text-[11px] font-semibold text-gray-700">Zoom in to explore</p>
              </div>
            )}

            <Suspense fallback={<div className="w-full h-full bg-gray-100 animate-pulse" />}>
              <MapView
                places={exploreMapPlaces.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, neighborhood: p.neighborhood, city: p.city, country: p.country }))}
                height="100%"
                selectedId={selectedMapPin?.id}
                onBoundsChange={handleBoundsChange}
                onPlaceClick={(mp) => {
                  const found = exploreMapPlaces.find(p => p.id === mp.id);
                  if (found) {
                    setSelectedMapPin(found);
                    setTimeout(() => cardRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 60);
                  }
                }}
              />
            </Suspense>
            {/* Pin preview card */}
            {selectedMapPin && (() => {
              const place = selectedMapPin;
              const emoji = ({ cafe: '☕', coffee: '☕', restaurant: '🍽️', bar: '🍸', hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️', nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙' } as Record<string, string>)[place.city?.toLowerCase()] ?? '📍';
              void emoji;
              return (
                <div
                  className="absolute bottom-3 left-3 right-3 z-[500]"
                  style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1), opacity 0.2s ease', transform: 'translateY(0)', opacity: 1 }}
                >
                  <div
                    className="bg-white rounded-2xl overflow-hidden flex items-stretch cursor-pointer active:scale-[0.98] transition-transform"
                    style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
                    onClick={() => {
                      if (place.flatPlace) setSelectedPlace(place.flatPlace);
                      else if (place.discoverPlace) setSelectedPlacePage(place.discoverPlace);
                    }}
                  >
                    {/* Photo */}
                    <div className="w-20 h-20 flex-shrink-0 bg-gray-200 relative">
                      {place.photoUrl
                        ? <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">📍</div>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                      <p className="text-sm font-bold text-gray-900 truncate leading-tight">{place.name.split(',')[0].trim()}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ')}</p>
                    </div>
                    {/* Chevron */}
                    <div className="flex items-center pr-3 pl-1">
                      <ChevronRight size={16} strokeWidth={2} className="text-gray-300" />
                    </div>
                    {/* Dismiss */}
                    <button
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center z-10"
                      onClick={e => { e.stopPropagation(); setSelectedMapPin(null); }}
                    >
                      <X size={11} strokeWidth={2.5} className="text-gray-500" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Grid of places visible in the current viewport */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">
              {visibleMapPlaces.length > 0 ? 'Places in view' : 'Pan or zoom to find places'}
            </p>
            {visibleMapPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-2xl mb-2">🗺️</p>
                <p className="text-sm font-semibold text-gray-700">No places in this area</p>
                <p className="text-xs text-gray-400 mt-1">Pan or zoom out to discover places</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleMapPlaces.map(place => (
                  <button
                    key={place.id}
                    ref={el => { cardRefs.current[place.id] = el; }}
                    onClick={() => {
                      if (place.type === 'curio' && place.flatPlace) setSelectedPlace(place.flatPlace);
                      else if (place.type === 'discover' && place.discoverPlace) setSelectedPlacePage(place.discoverPlace);
                    }}
                    className={`relative aspect-square rounded-2xl overflow-hidden active:scale-[0.97] transition-all text-left ${
                      selectedMapPin?.id === place.id ? 'ring-2 ring-orange-400' : ''
                    }`}
                  >
                    {place.photoUrl
                      ? <img src={place.photoUrl} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
                      : <div className="absolute inset-0 bg-gray-200" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="text-xs font-bold text-white leading-tight truncate">{place.name}</p>
                      <p className="text-[10px] text-white/60 truncate mt-0.5">{[place.neighborhood, place.city].filter(Boolean).join(', ')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(activeTab === 'For You' && !query.trim() || query.trim() && activeSearchTab === 'For You') && !exploreMapMode && (
        <div className="p-3">
          {query.trim() && userResults.length > 0 && (
            <p className="text-sm font-bold text-gray-900 mb-3 px-0.5">For You</p>
          )}
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Empty state */}
              {filtered.length === 0 && filteredDiscover.length === 0 && !loadingDiscover && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <p className="text-3xl mb-3">{query.trim().length >= 2 || activeCategory !== 'all' ? '🔍' : '🌍'}</p>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    {query.trim().length >= 2 || activeCategory !== 'all' ? 'No places found' : 'No places yet'}
                  </p>
                  <p className="text-xs text-gray-400 max-w-[200px]">
                    {query.trim().length >= 2 || activeCategory !== 'all' ? 'Try a different search term' : 'Be the first to share a place on sondrr'}
                  </p>
                </div>
              )}

              {/* Unified grid — curio shown immediately, discover mixed in when ready */}
              <div>
                {/* Loading skeleton — only when nothing to show at all */}
                {loadingDiscover && filtered.length === 0 && filteredDiscover.length === 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                )}
                {/* Grid */}
                {(filtered.length > 0 || filteredDiscover.length > 0) && (
                  <div className="grid grid-cols-2 gap-2">
                    {mixedGrid(filtered, filteredDiscover).map((card, idx) =>
                      card.type === 'curio' ? (
                        <PlaceCard
                          key={`curio-${card.place.placeId}`}
                          place={card.place}
                          onClick={() => setSelectedPlace(card.place)}
                        />
                      ) : (
                        <DiscoverCard
                          key={`discover-${card.place.id}-${idx}`}
                          place={card.place}
                          onClick={() => setSelectedPlacePage(card.place)}
                        />
                      )
                    )}
                  </div>
                )}
                {/* Infinite scroll sentinel */}
                <div ref={loadMoreSentinelRef} className="h-10 flex items-center justify-center mt-1">
                  {loadingMoreDiscover && (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search: Guides tab */}
      {query.trim() && activeSearchTab === 'Guides' && (() => {
        const q = query.trim().toLowerCase();
        const matchedCommunity = guides.filter(g =>
          g.title?.toLowerCase().includes(q) ||
          g.destination?.toLowerCase().includes(q)
        );
        const matchedSecret = SECRET_GUIDES.filter(g =>
          g.title?.toLowerCase().includes(q) ||
          g.city?.toLowerCase().includes(q)
        );
        const hasAny = matchedCommunity.length > 0 || matchedSecret.length > 0;
        return (
          <div className="px-4 pt-4 pb-8">
            {!hasAny ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <span className="text-3xl">📖</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No guides for "{query.trim()}" yet</p>
                <p className="text-xs text-gray-400 max-w-[220px] mb-5">Be the first to create a guide for this destination and help others discover it</p>
                <button
                  onClick={() => setEditingGuide({} as Guide)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold"
                >
                  <Plus size={14} strokeWidth={2} /> Create a guide
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {matchedSecret.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Curated</p>
                    <div className="grid grid-cols-2 gap-2">
                      {matchedSecret.map(g => {
                        const coverUrl = secretCovers[g.id];
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedSecretGuide(g)}
                            className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform aspect-square bg-gray-200"
                          >
                            {coverUrl && <img src={coverUrl} alt={g.title} className="absolute inset-0 w-full h-full object-cover" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                              <p className="text-xs font-bold text-white leading-tight">{g.title}</p>
                              <p className="text-[10px] text-white/60 mt-0.5">{g.places.length} places</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {matchedCommunity.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">From the Community</p>
                    <div className="space-y-3">
                      {matchedCommunity.map(guide => (
                        <button
                          key={guide.id}
                          onClick={() => setSelectedGuide(guide)}
                          className="w-full rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-[0.98] transition-transform"
                        >
                          {guide.coverUrl ? (
                            <div className="relative h-36">
                              <img src={guide.coverUrl} alt={guide.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 inline-block mb-1.5">{guide.format === 'itinerary' ? 'Itinerary' : 'Guide'}</span>
                                <div className="flex items-end justify-between gap-2">
                                  <p className="text-white text-sm font-bold leading-tight flex-1 min-w-0">{guide.title}</p>
                                  <span className="flex-shrink-0 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full border border-white/20">Read →</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="h-20 bg-gray-200 flex items-center justify-center"><p className="text-3xl">🗺️</p></div>
                          )}
                          <div className="px-3 py-2 flex items-center gap-2">
                            {guide.profile.avatarUrl
                              ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                              : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-gray-500">{guide.profile.name[0]?.toUpperCase()}</div>
                            }
                            <p className="text-xs text-gray-500 truncate">by @{guide.profile.username}</p>
                            <button className="ml-auto active:scale-90 transition-transform" onClick={async (e) => {
                              e.stopPropagation();
                              const uid = appUser?.id; if (!uid) return;
                              setExploreGuideColLoading(true);
                              if (!exploreSubscribedGuideIds.has(guide.id)) {
                                subscribeToGuide(uid, guide.id);
                                setExploreSubscribedGuideIds(prev => new Set(prev).add(guide.id));
                              }
                              const [ids, cols] = await Promise.all([
                                getGuideCollectionIds(guide.id, uid),
                                getUserCollections(uid),
                              ]);
                              setExploreGuideColIds(ids);
                              setExploreUserCollections(cols);
                              setExploreGuideColSheet(guide);
                              setExploreGuideColLoading(false);
                            }}>
                              {exploreGuideColLoading && exploreGuideColSheet?.id === guide.id
                                ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400" />
                                : exploreSubscribedGuideIds.has(guide.id)
                                  ? <BookmarkCheck size={20} strokeWidth={1.5} className="text-gray-900" />
                                  : <Bookmark size={20} strokeWidth={1.5} className="text-gray-600" />}
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Search: Posts tab */}
      {query.trim() && activeSearchTab === 'Posts' && (() => {
        const q = query.trim().toLowerCase();
        const matchedPosts = posts.filter(p =>
          p.places.some(pl =>
            pl.city?.toLowerCase().includes(q) ||
            pl.country?.toLowerCase().includes(q) ||
            pl.name?.toLowerCase().includes(q) ||
            pl.neighborhood?.toLowerCase().includes(q)
          )
        );
        return (
          <div className="px-4 pt-4 pb-8">
            {matchedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <span className="text-3xl">📸</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No posts from "{query.trim()}" yet</p>
                <p className="text-xs text-gray-400 max-w-[220px] mb-5">Visited this place? Share your favourite spots and inspire others</p>
                <button
                  onClick={() => {/* navigate to add */}}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold"
                >
                  <Plus size={14} strokeWidth={2} /> Share a post
                </button>
              </div>
            ) : (
              <div style={{ columns: 2, columnGap: 8 }}>
                {matchedPosts.map(post => {
                  const firstImage = post.places.map(pl => pl.photoUrl).find(url => url?.trim());
                  if (!firstImage) return null;
                  return (
                    <div key={post.id} className="break-inside-avoid mb-2 relative rounded-2xl overflow-hidden cursor-pointer active:opacity-90 transition-opacity">
                      <div style={{ aspectRatio: '4/5' }}>
                        <img src={firstImage} alt="" className="w-full h-full object-cover block" draggable={false} />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-white text-[11px] font-bold leading-tight truncate">
                          {post.places[0]?.city || post.places[0]?.name || ''}
                        </p>
                        <p className="text-white/70 text-[10px] mt-0.5 truncate">
                          {post.places.length} place{post.places.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Search: Collections tab */}
      {query.trim() && activeSearchTab === 'Collections' && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <span className="text-3xl">🗂️</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">No collections for "{query.trim()}" yet</p>
          <p className="text-xs text-gray-400 max-w-[220px]">Public collections will appear here once people start curating places in this destination</p>
        </div>
      )}

      {/* Activities tab — city-first */}
      {activeTab === 'Cities' && !selectedExpCity && !query.trim() && (
        <div className="pb-8">
          {/* City grid */}
          <div className="px-4 pt-2 grid grid-cols-2 gap-2">
            {FEATURED_CITIES.map(city => {
              const coords = CITY_COORDS[city.name] ?? [0, 0];
              return (
                <button
                  key={city.id}
                  onClick={() => setSelectedExpCity({ ...city, lat: coords[0], lng: coords[1] })}
                  className="relative rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform"
                  style={{ aspectRatio: '4/3' }}
                >
                  {cityCoverPhotos[city.id]
                    ? <img src={cityCoverPhotos[city.id]} alt={city.name} className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-bold text-white leading-tight">{city.name}</p>
                    <p className="text-[11px] text-white/60 mt-0.5">{city.country}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Activities tab — city homepage */}
      {activeTab === 'Cities' && selectedExpCity && !query.trim() && (
        <div className="pb-8">
          {/* Hero image + city name */}
          <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden aspect-[16/9]">
            {cityCoverPhotos[selectedExpCity.id]
              ? <img src={cityCoverPhotos[selectedExpCity.id]} alt={selectedExpCity.name} className="absolute inset-0 w-full h-full object-cover" />
              : <div className="absolute inset-0 bg-gray-200" />
            }
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Back button */}
            <button
              onClick={() => { setSelectedExpCity(null); setCityPlaces([]); setCityPageTab('activities'); }}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
            >
              <ChevronRight size={16} className="text-white rotate-180" />
            </button>
            {/* City label */}
            <div className="absolute bottom-0 left-0 right-0 p-3.5">
              <p className="text-xl font-bold text-white leading-tight">{selectedExpCity.name}</p>
              <p className="text-xs text-white/70 mt-0.5">{selectedExpCity.country}</p>
            </div>
          </div>

          {/* Tab bar: Guides · Activities · Posts */}
          <div className="flex border-b border-gray-100 px-4 mb-4">
            {(['guides', 'activities'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCityPageTab(tab)}
                className={`mr-5 text-sm pb-2.5 transition-colors capitalize ${cityPageTab === tab ? 'text-gray-900 font-semibold border-b-2 border-gray-900 -mb-px' : 'text-gray-400 font-medium'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── GUIDES tab ── */}
          {cityPageTab === 'guides' && (() => {
            const cityName = selectedExpCity.name.toLowerCase();
            const secretCityGuides = SECRET_GUIDES.filter(g => g.city.toLowerCase() === cityName);
            const communityCityGuides = guides.filter(g => g.destination?.toLowerCase().includes(cityName));
            const hasAny = secretCityGuides.length > 0 || communityCityGuides.length > 0;
            if (!hasAny) return (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <p className="text-3xl mb-3">📖</p>
                <p className="text-sm font-semibold text-gray-900 mb-1">No guides yet for {selectedExpCity.name}</p>
                <p className="text-xs text-gray-400">Check back soon — we're curating the best spots</p>
              </div>
            );
            return (
              <div className="px-4 space-y-4">
                {secretCityGuides.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Curated</p>
                    <div className="grid grid-cols-2 gap-2">
                      {secretCityGuides.map(g => {
                        const coverUrl = secretCovers[g.id];
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedSecretGuide(g)}
                            className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform aspect-square bg-gray-200"
                          >
                            {coverUrl && (
                              <img src={coverUrl} alt={g.title} className="absolute inset-0 w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                              <p className="text-xs font-bold text-white leading-tight">{g.title}</p>
                              <p className="text-[10px] text-white/60 mt-0.5">{g.places.length} places</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {communityCityGuides.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-1">From the Community</p>
                    <div className="grid grid-cols-2 gap-2">
                      {communityCityGuides.map(guide => (
                        <button
                          key={guide.id}
                          onClick={() => setSelectedGuide(guide)}
                          className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform aspect-square bg-gray-200"
                        >
                          {guide.coverUrl
                            ? <img src={guide.coverUrl} alt={guide.title} className="absolute inset-0 w-full h-full object-cover" />
                            : <div className="absolute inset-0 flex items-center justify-center text-4xl">🗺️</div>
                          }
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                          <button
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center active:scale-90 transition-transform z-10"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const uid = appUser?.id; if (!uid) return;
                              setExploreGuideColLoading(true);
                              if (!exploreSubscribedGuideIds.has(guide.id)) {
                                subscribeToGuide(uid, guide.id);
                                setExploreSubscribedGuideIds(prev => new Set(prev).add(guide.id));
                              }
                              const [ids, cols] = await Promise.all([
                                getGuideCollectionIds(guide.id, uid),
                                getUserCollections(uid),
                              ]);
                              setExploreGuideColIds(ids);
                              setExploreUserCollections(cols);
                              setExploreGuideColSheet(guide);
                              setExploreGuideColLoading(false);
                            }}
                          >
                            {exploreGuideColLoading && exploreGuideColSheet?.id === guide.id
                              ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-white" />
                              : exploreSubscribedGuideIds.has(guide.id)
                                ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                                : <Bookmark size={14} strokeWidth={1.5} className="text-white" />}
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 p-2.5">
                            <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 inline-block mb-1.5">{guide.format === 'itinerary' ? 'Itinerary' : 'Guide'}</span>
                            <div className="flex items-end justify-between gap-1.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white leading-tight">{guide.title}</p>
                                <p className="text-[10px] text-white/60 mt-0.5">
                                  {[guide.destination, `${guide.places?.length ?? 0} places`].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                              <span className="flex-shrink-0 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full border border-white/20">Read →</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* ── ACTIVITIES tab ── */}
          {cityPageTab === 'activities' && (
            <>
              {/* Category strip */}
              <div className="pb-3">
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingLeft: 16, paddingRight: 16 }}>
                  {EXP_CATEGORIES.map(cat => {
                    const isActive = activeExpCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveExpCategory(cat.id)}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {cat.emoji} {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Places grid */}
              {loadingCityPlaces ? (
                <div className="px-4 grid grid-cols-2 gap-2">
                  {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
              ) : cityPlacesError ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <p className="text-3xl mb-3">⚠️</p>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Couldn't load places</p>
                  <p className="text-xs text-gray-400">Check your connection and try again</p>
                </div>
              ) : cityPlaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-3xl mb-3">{EXP_CATEGORIES.find(c => c.id === activeExpCategory)?.emoji}</p>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Nothing found</p>
                  <p className="text-xs text-gray-400">Try another category</p>
                </div>
              ) : (
                <div className="px-4">
                  <div className="grid grid-cols-2 gap-2">
                    {cityPlaces.map(place => (
                      <button
                        key={place.id}
                        onClick={() => setSelectedPlacePage(place)}
                        className="relative aspect-square rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform bg-gray-100"
                      >
                        {place.photoUrl
                          ? <img
                              src={place.photoUrl}
                              alt={place.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          : null
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <p className="text-xs font-bold text-white leading-tight truncate">{place.name}</p>
                          <p className="text-[10px] text-white/60 truncate mt-0.5">{[place.neighborhood, place.city].filter(Boolean).join(', ')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div ref={cityPlacesSentinelRef} className="h-10 flex items-center justify-center mt-2">
                    {loadingMoreCityPlaces && (
                      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      )}


      {/* Unfollow confirmation sheet */}
      {unfollowConfirm && (
        <div className="fixed inset-0 z-[250] flex flex-col justify-end" style={{ maxWidth: '390px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setUnfollowConfirm(null)} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-4"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex flex-col items-center px-6 pb-2">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <span className="text-xl font-bold text-gray-400">{(unfollowConfirm.username || '?')[0]?.toUpperCase()}</span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">Unfollow @{unfollowConfirm.username}?</p>
              <p className="text-sm text-gray-400 text-center mb-6">Their posts will no longer appear in your feed.</p>
              <button className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
                onClick={async () => {
                  if (!appUser?.id) return;
                  setFollowing(prev => { const s = new Set(prev); s.delete(unfollowConfirm.userId); return s; });
                  await unfollowUser(appUser.id, unfollowConfirm.userId);
                  setUnfollowConfirm(null);
                }}>
                Unfollow
              </button>
              <button className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold"
                onClick={() => setUnfollowConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post modal */}
      {selectedPlace && (
        <PostModal
          place={selectedPlace}
          isFollowing={following.has(selectedPlace.post.userId)}
          isOwnPost={appUser?.id === selectedPlace.post.userId}
          onToggleFollow={() => toggleFollow(selectedPlace.post.userId, selectedPlace.post.profile.username)}
          onClose={() => setSelectedPlace(null)}
          userId={appUser?.id}
          userAvatar={appUser?.avatar}
          onViewUser={(uid) => { setSelectedPlace(null); setViewingUserId(uid); }}
          onOpenPlacePage={pl => setSelectedPlacePage(pl)}
          initialIsLiked={likedPostIds.has(selectedPlace.post.id)}
          onLikeToggle={(postId, liked) => setLikedPostIds(prev => { const n = new Set(prev); liked ? n.add(postId) : n.delete(postId); return n; })}
          blockedUsers={blockedUsers}
          setBlockedUsers={setBlockedUsers}
        />
      )}

      {/* Guide detail */}
      {selectedGuide && (
        <GuideDetail
          guide={selectedGuide}
          currentUserId={appUser?.id}
          onClose={() => setSelectedGuide(null)}
          onEditGuide={() => { setEditingGuide(selectedGuide); setSelectedGuide(null); }}
          onPlaceClick={(place) => setSelectedPlacePage(place)}
          onViewUser={(uid) => { setSelectedGuide(null); setViewingUserId(uid); }}
        />
      )}

      {editingGuide && appUser && (
        <CreateGuideSheet
          userId={appUser.id}
          editingGuide={editingGuide}
          onClose={() => setEditingGuide(null)}
          onCreated={() => setEditingGuide(null)}
          onUpdated={(updated) => {
            setGuides(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
            setEditingGuide(null);
          }}
        />
      )}

      {/* Secret Guide detail */}
      {selectedSecretGuide && (
        <SecretGuideSheet
          guide={selectedSecretGuide}
          savedPlaceIds={secretSavedIds}
          onClose={() => setSelectedSecretGuide(null)}
          onOpenPlace={pl => { setSelectedSecretGuide(null); setSelectedPlacePage(pl); }}
          onToggleSave={(placeId) => {
            setSecretSavedIds(prev => {
              const next = new Set(prev);
              if (next.has(placeId)) next.delete(placeId); else next.add(placeId);
              return next;
            });
          }}
        />
      )}

      {/* Place Page — rendered at page level so it's not clipped by PostModal */}
      {selectedPlacePage && (
        <PlacePage
          place={selectedPlacePage}
          onClose={() => setSelectedPlacePage(null)}
          isSaved={exploreSavedPlaces.has(selectedPlacePage.id)}
          onToggleSave={async () => {
            if (!appUser?.id) return;
            const id = selectedPlacePage.id;
            if (exploreSavedPlaces.has(id)) {
              // Unsave: optimistic remove
              setExploreSavedPlaces(prev => { const n = new Set(prev); n.delete(id); return n; });
              const ok = await unsavePlace(appUser.id, id);
              if (!ok) setExploreSavedPlaces(prev => new Set(prev).add(id));
            } else {
              // Save: optimistic add, then open collection sheet
              setExploreSavedPlaces(prev => new Set(prev).add(id));
              const ok = await savePlace(appUser.id, id);
              if (!ok) {
                setExploreSavedPlaces(prev => { const n = new Set(prev); n.delete(id); return n; });
              } else {
                setExplorePlaceSaveSheet({ id, name: selectedPlacePage.name });
                setExploreLoadingPlaceCollections(true);
                setExplorePlaceInCollections(new Set());
                setExploreSavePlanAdded(new Set());
                setExploreSaveShowNewTrip(false);
                setExploreSaveNewTripName('');
                getPlans(appUser.id).then(setExploreSavePlans);
                const [colIds, cols] = await Promise.all([
                  getPlaceCollectionIds(id),
                  getUserCollections(appUser.id),
                ]);
                setExplorePlaceInCollections(colIds);
                setExploreUserCollections(cols);
                setExploreLoadingPlaceCollections(false);
              }
            }
          }}
          appUser={appUser ?? undefined}
          onViewUser={(uid) => { setSelectedPlacePage(null); setViewingUserId(uid); }}
          onSelectPlace={(pl) => setSelectedPlacePage(pl)}
        />
      )}

      {/* Place → Save to Collection sheet (from PlacePage onToggleSave) */}
      {explorePlaceSaveSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setExplorePlaceSaveSheet(null); setExplorePlaceInCollections(new Set()); setExploreSavePlanAdded(new Set()); setExploreSaveShowNewTrip(false); setExploreSaveNewTripName(''); }} />
          <div className="relative bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-4 pb-4">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Saved to All Saved ✓</h3>
              <p className="text-xs text-gray-400 truncate">Also add "{explorePlaceSaveSheet.name}" to a collection?</p>
            </div>
            {exploreLoadingPlaceCollections ? (
              <div className="px-4 space-y-3 pb-4">
                {[0, 1].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
                {exploreUserCollections.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">No collections yet — create one below</p>
                )}
                {exploreUserCollections.map(col => {
                  const inCol = explorePlaceInCollections.has(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={async () => {
                        if (!appUser?.id || !explorePlaceSaveSheet) return;
                        if (inCol) {
                          setExplorePlaceInCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                          try { await removePlaceFromCollection(col.id, explorePlaceSaveSheet.id); } catch { setExplorePlaceInCollections(prev => new Set(prev).add(col.id)); }
                        } else {
                          setExplorePlaceInCollections(prev => new Set(prev).add(col.id));
                          try { await addPlaceToCollection(col.id, explorePlaceSaveSheet.id); } catch { setExplorePlaceInCollections(prev => { const n = new Set(prev); n.delete(col.id); return n; }); }
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                        <p className="text-xs text-gray-400">{col.placesCount} places</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                        {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* New collection */}
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => setExploreShowNewColSheet(true)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>

            {/* Trips section */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {exploreSavePlans.length === 0 && !exploreSaveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {exploreSavePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {exploreSavePlans.map(plan => {
                    const added = exploreSavePlanAdded.has(plan.id);
                    const adding = exploreSavePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!appUser?.id || !explorePlaceSaveSheet) return;
                          setExploreSavePlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              await createPlanItem(plan.id, day.id, {
                                name: explorePlaceSaveSheet.name,
                                category: '',
                                image_url: '',
                                time_label: '',
                                address: '',
                                neighborhood: '',
                                position: day.items.length,
                                lat: null,
                                lng: null,
                              });
                              setExploreSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setExploreSavePlanAdding(null);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                          {plan.coverImageUrl
                            ? <img src={plan.coverImageUrl} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.title}</p>
                          {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                        </div>
                        {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                        {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {exploreSaveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={exploreSaveNewTripName}
                    onChange={e => setExploreSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setExploreSaveShowNewTrip(false); setExploreSaveNewTripName(''); }
                      if (e.key === 'Enter' && exploreSaveNewTripName.trim() && appUser?.id) {
                        setExploreSaveCreatingTrip(true);
                        const newPlan = await createPlan(appUser.id, { title: exploreSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setExploreSavePlans(prev => [newPlan, ...prev]); setExploreSaveShowNewTrip(false); setExploreSaveNewTripName(''); }
                        setExploreSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!exploreSaveNewTripName.trim() || exploreSaveCreatingTrip}
                    onClick={async () => {
                      if (!exploreSaveNewTripName.trim() || !appUser?.id) return;
                      setExploreSaveCreatingTrip(true);
                      const newPlan = await createPlan(appUser.id, { title: exploreSaveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) { setExploreSavePlans(prev => [newPlan, ...prev]); setExploreSaveShowNewTrip(false); setExploreSaveNewTripName(''); }
                      setExploreSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {exploreSaveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setExploreSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>

            {/* Remove from Saved */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!appUser?.id || !explorePlaceSaveSheet) return;
                  setExploreSavedPlaces(prev => { const n = new Set(prev); n.delete(explorePlaceSaveSheet.id); return n; });
                  await unsavePlace(appUser.id, explorePlaceSaveSheet.id);
                  setExplorePlaceSaveSheet(null);
                  setExplorePlaceInCollections(new Set());
                  setExploreSavePlanAdded(new Set());
                  setExploreSaveShowNewTrip(false);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guide → Save to Collection sheet */}
      {exploreGuideColSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }} onClick={() => { setExploreGuideColSheet(null); setExploreGuideColIds(new Set()); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-64 overflow-y-auto">
              {exploreUserCollections.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No collections yet — create one below</p>
              )}
              {exploreUserCollections.map((col: RealCollection) => {
                const inCol = exploreGuideColIds.has(col.id);
                return (
                  <button key={col.id} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                    onClick={async () => {
                      const uid = appUser?.id; if (!uid) return;
                      if (inCol) {
                        setExploreGuideColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                        await removeGuideFromCollection(col.id, exploreGuideColSheet!.id);
                        const remaining = new Set(exploreGuideColIds); remaining.delete(col.id);
                        if (remaining.size === 0) { unsubscribeFromGuide(uid, exploreGuideColSheet!.id); setExploreSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(exploreGuideColSheet!.id); return n; }); }
                      } else {
                        setExploreGuideColIds(prev => new Set(prev).add(col.id));
                        await addGuideToCollection(col.id, exploreGuideColSheet!.id, uid);
                        if (!exploreSubscribedGuideIds.has(exploreGuideColSheet!.id)) {
                          subscribeToGuide(uid, exploreGuideColSheet!.id);
                          setExploreSubscribedGuideIds(prev => new Set(prev).add(exploreGuideColSheet!.id));
                        }
                      }
                    }}
                  >
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} items</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 pt-3">
              <button onClick={() => setExploreShowNewColSheet(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>
            <div className="mx-4 border-t border-gray-100" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  const uid = appUser?.id;
                  if (!uid || !exploreGuideColSheet) return;
                  unsubscribeFromGuide(uid, exploreGuideColSheet.id);
                  setExploreSubscribedGuideIds(prev => { const n = new Set(prev); n.delete(exploreGuideColSheet.id); return n; });
                  setExploreGuideColSheet(null);
                  setExploreGuideColIds(new Set());
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection sheet (from Place/Guide save sheets) */}
      {exploreShowNewColSheet && (
        <div className="fixed inset-0 z-[310] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setExploreShowNewColSheet(false); setExploreNewColName(''); }} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                disabled={!exploreNewColName.trim() || exploreNewColSaving}
                onClick={async () => {
                  if (!exploreNewColName.trim() || !appUser?.id) return;
                  setExploreNewColSaving(true);
                  try {
                    const { data, error } = await createCollection(appUser.id, { name: exploreNewColName.trim(), emoji: '', description: '', cover_image_url: null });
                    if (!error && data) {
                      if (explorePlaceSaveSheet) {
                        await addPlaceToCollection(data.id, explorePlaceSaveSheet.id);
                        setExplorePlaceInCollections(prev => new Set(prev).add(data.id));
                        setExploreUserCollections(prev => [{ ...data, placesCount: 1 }, ...prev]);
                      } else if (exploreGuideColSheet) {
                        await addGuideToCollection(data.id, exploreGuideColSheet.id, appUser.id);
                        setExploreGuideColIds(prev => new Set(prev).add(data.id));
                        setExploreUserCollections(prev => [{ ...data, placesCount: 0 }, ...prev]);
                      } else {
                        setExploreUserCollections(prev => [{ ...data, placesCount: 0 }, ...prev]);
                      }
                    }
                  } finally {
                    setExploreNewColSaving(false);
                    setExploreShowNewColSheet(false);
                    setExploreNewColName('');
                  }
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >
                {exploreNewColSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
            <div className="px-4 pb-6">
              <input
                autoFocus
                value={exploreNewColName}
                onChange={e => setExploreNewColName(e.target.value)}
                placeholder="Collection name"
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Place card ───────────────────────────────────────────────────────────────

function PlaceCard({ place, onClick }: { place: FlatPlace; onClick: () => void }) {
  const emoji = CATEGORY_EMOJI[place.category];
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <button onClick={onClick} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-95 transition-transform">
      {place.photoUrl && !imgFailed ? (
        <img src={place.photoUrl} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
          <span className="text-3xl">{emoji ?? '📍'}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Category badge — always shown when category exists */}
      {emoji && (
        <div className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
          <span className="text-sm leading-none">{emoji}</span>
        </div>
      )}

      {/* Place info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-xs font-bold leading-tight truncate">{place.name.split(',')[0].trim()}</p>
        <p className="text-white/70 text-[10px] truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}</p>
      </div>
    </button>
  );
}

// ── Discover card (Google Places) ────────────────────────────────────────────

function DiscoverCard({ place, onClick }: { place: RealPostPlace; onClick: () => void }) {
  const emoji = CATEGORY_EMOJI[place.category];
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <button onClick={onClick} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-95 transition-transform">
      {place.photoUrl && !imgFailed ? (
        <img src={place.photoUrl} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
          <span className="text-3xl">{emoji ?? '📍'}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      {emoji && (
        <div className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
          <span className="text-sm leading-none">{emoji}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-xs font-bold leading-tight truncate">{place.name.split(',')[0].trim()}</p>
        <p className="text-white/70 text-[10px] truncate">{[place.neighborhood, place.city].filter(Boolean).join(', ') || place.country}</p>
      </div>
    </button>
  );
}

// ── Post modal ───────────────────────────────────────────────────────────────

const modalCatEmoji: Record<string, string> = {
  cafe: '☕', coffee: '☕', restaurant: '🍽️', dining: '🍽️', bar: '🍸',
  hotel: '🏨', shop: '🛍️', shopping: '🛍️', attraction: '🏛️', museum: '🏛️',
  nature: '🌿', park: '🌿', experience: '✨', nightlife: '🌙', beach: '🏖️',
  sports: '🎾', wellness: '💆', street: '🏙️', event: '🎟️', food: '🍕',
};

function PostModal({ place, isFollowing, isOwnPost, onToggleFollow, onClose, userId, userAvatar, onViewUser, onOpenPlacePage, initialIsLiked, onLikeToggle, blockedUsers, setBlockedUsers }: {
  place: FlatPlace;
  isFollowing: boolean;
  isOwnPost: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  userId?: string;
  userAvatar?: string | null;
  onViewUser?: (userId: string) => void;
  onOpenPlacePage?: (place: RealPostPlace) => void;
  initialIsLiked?: boolean;
  onLikeToggle?: (postId: string, liked: boolean) => void;
  blockedUsers: Set<string>;
  setBlockedUsers: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const { post, indexInPost } = place;
  const [currentIndex, setCurrentIndex] = useState(indexInPost);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const commentsTopRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked ?? false);
  const [likeCount, setLikeCount] = useState(0);

  // Load like count from DB on mount
  useEffect(() => {
    getPostLikeCounts([post.id]).then(counts => setLikeCount(counts[post.id] ?? 0));
  }, [post.id]);
  const [isPostSaved, setIsPostSaved] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState<string | null>(null); // placeId being saved to collection
  const [saveSheetColIds, setSaveSheetColIds] = useState<Set<string>>(new Set());
  const [showNewSaveCol, setShowNewSaveCol] = useState(false);
  const [newSaveColName, setNewSaveColName] = useState('');
  const [savingNewSaveCol, setSavingNewSaveCol] = useState(false);
  const [userCollectionList, setUserCollectionList] = useState<RealCollection[]>([]);
  const [showNewColSheet, setShowNewColSheet] = useState(false);
  const [newColSheetName, setNewColSheetName] = useState('');
  const [newColSheetDesc, setNewColSheetDesc] = useState('');
  const [newColSheetCoverUrl, setNewColSheetCoverUrl] = useState<string | null>(null);
  const [newColSheetCoverUploading, setNewColSheetCoverUploading] = useState(false);
  const [newColSheetSaving, setNewColSheetSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareSearchResults, setShareSearchResults] = useState<FollowProfile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);
  const [shareSentTo, setShareSentTo] = useState<Set<string>>(new Set());
  const [showPostSaveColSheet, setShowPostSaveColSheet] = useState(false);
  const [postSaveColIds, setPostSaveColIds] = useState<Set<string>>(new Set());
  const [allPlacesSaved, setAllPlacesSaved] = useState(false);
  // Trips state — shared between individual-place sheet and post-save sheet
  const [savePlans, setSavePlans] = useState<Plan[]>([]);
  const [savePlanAdded, setSavePlanAdded] = useState<Set<string>>(new Set());
  const [savePlanAdding, setSavePlanAdding] = useState<string | null>(null);
  const [saveShowNewTrip, setSaveShowNewTrip] = useState(false);
  const [saveNewTripName, setSaveNewTripName] = useState('');
  const [saveCreatingTrip, setSaveCreatingTrip] = useState(false);
  // Options sheet (···)
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [postOptionsStep, setPostOptionsStep] = useState<'options' | 'reason' | 'done' | 'blockConfirm' | 'deleteConfirm'>('options');
  const [postOptionsReason, setPostOptionsReason] = useState('');
  const shareSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current); }, []);
  const initials = post.profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const [postActionModal, setPostActionModal] = useState<{
    avatarUrl?: string | null; iconType?: 'check'; title: string; subtitle: string;
    confirmLabel?: string; confirmVariant?: 'red' | 'dark'; onConfirm?: () => void;
  } | null>(null);

  // Deduplicate places by name
  const uniquePlaces = post.places.filter((pl, i, arr) =>
    arr.findIndex(x => x.name.split(',')[0].trim().toLowerCase() === pl.name.split(',')[0].trim().toLowerCase()) === i
  );

  // Load user's saved places, collections and conversations on mount
  const [conversations, setConversations] = useState<Conversation[]>([]);
  useEffect(() => {
    if (userId) {
      getSavedPlaces(userId).then(sp => {
        setSavedPlaceIds(new Set(sp.map(p => p.id)));
        setAllPlacesSaved(post.places.length > 0 && post.places.every(p => sp.some(s => s.id === p.id)));
      });
      getUserCollections(userId).then(setUserCollectionList);
      getConversations(userId).then(setConversations);
      getPlans(userId).then(setSavePlans);
    }
  }, [userId]);

  // Load comments on mount
  useEffect(() => {
    getPostComments(post.id).then(setComments);
  }, [post.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = indexInPost * scrollRef.current.offsetWidth;
    }
  }, [indexInPost]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
      setCurrentIndex(index);
    }
  };

  const scrollTo = (i: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' });
      setCurrentIndex(i);
    }
  };

  const toggleSavePlace = async (placeId: string) => {
    if (!userId) return;
    if (savedPlaceIds.has(placeId)) {
      setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(placeId); return n; });
      await unsavePlace(userId, placeId);
    } else {
      setSavedPlaceIds(prev => new Set(prev).add(placeId));
      await savePlace(userId, placeId);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full overflow-y-auto overflow-x-hidden rounded-t-3xl" style={{ maxWidth: '384px', maxHeight: '96vh' }} onClick={e => e.stopPropagation()}>

        {/* Sticky header — drag handle + X + ... always visible regardless of scroll */}
        <div className="sticky top-0 z-30 relative flex justify-between items-start px-3 pt-3 pointer-events-none" style={{ marginBottom: -44 }}>
          {/* Pill — always truly centered */}
          <div className="absolute left-1/2 -translate-x-1/2 top-3 w-9 h-1 bg-white/60 rounded-full" />
          <div className="w-8" />
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={() => { setPostOptionsStep('options'); setPostOptionsReason(''); setShowPostOptions(true); }} className="w-8 h-8 bg-black/55 backdrop-blur-md rounded-full flex items-center justify-center">
              <MoreHorizontal size={15} strokeWidth={2.5} className="text-white" />
            </button>
            <button onClick={onClose} className="w-8 h-8 bg-black/55 backdrop-blur-md rounded-full flex items-center justify-center">
              <X size={15} strokeWidth={2.5} className="text-white" />
            </button>
          </div>
        </div>

        <div className="bg-white w-full rounded-t-3xl">

          {/* Photo carousel — scrolls with the rest */}
          <div className="relative overflow-hidden rounded-t-3xl">

            {/* Profile pill — top left (owner + collaborators) */}
            <button
              onClick={() => onViewUser?.(post.userId)}
              className="absolute top-4 left-3 z-20 flex items-center gap-1.5 bg-black/55 backdrop-blur-md rounded-full pl-1 pr-3 py-1 active:opacity-80"
            >
              {post.profile.avatarUrl
                ? <img src={post.profile.avatarUrl} alt={post.profile.name} className="w-6 h-6 rounded-full object-cover object-top border border-white/30 flex-shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><span className="text-white text-[9px] font-bold">{initials}</span></div>
              }
              {(post.collaborators ?? []).slice(0, 2).map(c => (
                c.avatarUrl
                  ? <img key={c.id} src={c.avatarUrl} alt={c.name} className="-ml-2 w-6 h-6 rounded-full object-cover border border-white/30 flex-shrink-0" />
                  : <div key={c.id} className="-ml-2 w-6 h-6 rounded-full bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0"><span className="text-white text-[9px] font-bold">{c.name[0]?.toUpperCase()}</span></div>
              ))}
              <span className="text-white text-xs font-semibold leading-none ml-0.5">
                {(post.collaborators ?? []).length > 0
                  ? `${post.profile.username || post.profile.name} & ${(post.collaborators ?? []).map(c => c.username || c.name).join(' & ')}`
                  : (post.profile.username || post.profile.name)}
              </span>
            </button>

            {/* Swipeable photos */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {post.places.map((pl, i) => (
                <div key={`${pl.id}-${i}`} className="flex-shrink-0 w-full" style={{ aspectRatio: '3/4' }}>
                  {pl.photoUrl
                    ? <img src={pl.photoUrl} alt={pl.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-100" />
                  }
                </div>
              ))}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

            {/* Bottom bar: place name left, dots right — same row */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 flex items-end justify-between gap-3 pointer-events-none">
              <div className="min-w-0">
                <p className="text-white font-semibold text-xs leading-tight truncate">{post.places[currentIndex]?.name.split(',')[0].trim()}</p>
                <p className="text-white/70 text-[10px] mt-0.5 truncate">
                  {[resolveCity(post.places[currentIndex]?.city), post.places[currentIndex]?.country].filter(Boolean).join(', ')}
                </p>
              </div>
              {post.places.length > 1 && (
                <div className="flex gap-1.5 items-center flex-shrink-0 pointer-events-auto pb-0.5">
                  {post.places.length <= 5
                    ? post.places.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollTo(i)}
                          className={`rounded-full transition-all duration-200 ${i === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                        />
                      ))
                    : <span className="text-white text-[11px] font-semibold bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 leading-none">
                        {currentIndex + 1} / {post.places.length}
                      </span>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Content below photo — no inner scroll, flows naturally */}
          <div ref={scrollableRef}>

            {/* Actions row */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-5">
                <button
                  className="flex items-center gap-1.5"
                  onClick={() => {
                    if (!userId) return;
                    const nowLiked = !isLiked;
                    setIsLiked(nowLiked);
                    setLikeCount((p: number) => p + (isLiked ? -1 : 1));
                    isLiked ? unlikePost(userId, post.id) : likePost(userId, post.id);
                    onLikeToggle?.(post.id, nowLiked);
                  }}
                >
                  <Heart size={22} strokeWidth={1.5} className={isLiked ? 'fill-gray-900 text-gray-900' : 'text-gray-800'} />
                  <span className="text-sm font-medium text-gray-500">{likeCount}</span>
                </button>
                <button className="flex items-center gap-1.5" onClick={() => {
                  setShowComments(p => !p);
                }}>
                  <MessageCircle size={22} strokeWidth={1.5} className="text-gray-800" />
                  <span className="text-sm font-medium text-gray-500">{comments.length}</span>
                </button>
                <button onClick={() => setShowShareSheet(true)}>
                  <Send size={21} strokeWidth={1.5} className="text-gray-800" />
                </button>
              </div>
              <button
                onClick={async () => {
                  if (!userId) return;
                  if (allPlacesSaved) {
                    for (const p of post.places) {
                      setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                      unsavePlace(userId, p.id);
                    }
                    setAllPlacesSaved(false);
                  } else {
                    for (const p of post.places) {
                      setSavedPlaceIds(prev => new Set(prev).add(p.id));
                      savePlace(userId, p.id);
                    }
                    setAllPlacesSaved(true);
                    setShowPostSaveColSheet(true);
                  }
                }}
              >
                {allPlacesSaved
                  ? <BookmarkCheck size={22} strokeWidth={1.5} className="text-gray-900" />
                  : <Bookmark size={22} strokeWidth={1.5} className="text-gray-700" />
                }
              </button>
            </div>

            {/* Caption + hashtags */}
            {(post.caption || post.hashtags.length > 0) && (
              <div className="px-5 pt-4 pb-5">
                {post.caption && <p className="text-sm text-gray-800 leading-relaxed">{post.caption}</p>}
                {post.hashtags.length > 0 && (() => {
                  const seen = new Set<string>();
                  const unique = post.hashtags.filter(h => { const k = h.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
                  return <p className="text-xs text-orange-400 mt-2">{unique.map(h => `#${h.split(',')[0].trim().replace(/\s+/g, '')}`).join(' ')}</p>;
                })()}
              </div>
            )}

            {/* Places list */}
            {uniquePlaces.length > 0 && (
              <div className="px-5 pt-4 border-t border-gray-100">
                {(() => {
                  const mapPlaces = uniquePlaces.filter(p => p.lat && p.lng).map(p => ({
                    id: p.id, name: p.name.split(',')[0].trim(), lat: p.lat!, lng: p.lng!,
                    category: p.category, image: p.photoUrl, neighbourhood: p.neighborhood ?? '', city: p.city ?? '', country: p.country ?? '',
                    savedCount: 0, bookingAvailable: false, rating: null,
                  }));
                  const centerPlace = uniquePlaces.find(p => p.lat && p.lng);
                  const hasCoords = mapPlaces.length > 0 && centerPlace;
                  return (
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-900">
                        {uniquePlaces.length} place{uniquePlaces.length !== 1 ? 's' : ''}
                      </p>
                      {hasCoords && (
                        <button
                          onClick={() => setShowMap(p => !p)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${showMap ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <Map size={11} strokeWidth={1.5} />
                          {showMap ? 'Hide map' : 'View on map'}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Mini map */}
                {showMap && (() => {
                  const mapPlaces = uniquePlaces.filter(p => p.lat && p.lng).map(p => ({
                    id: p.id, name: p.name.split(',')[0].trim(), lat: p.lat!, lng: p.lng!,
                    category: p.category, image: p.photoUrl, neighbourhood: p.neighborhood ?? '', city: p.city ?? '', country: p.country ?? '',
                    savedCount: 0, bookingAvailable: false, rating: null,
                  }));
                  const centerPlace = uniquePlaces.find(p => p.lat && p.lng);
                  if (!centerPlace || mapPlaces.length === 0) return null;
                  return (
                    <div className="mb-3 rounded-2xl overflow-hidden">
                      <Suspense fallback={<div className="h-44 bg-gray-100 animate-pulse rounded-2xl" />}>
                        <MapView places={mapPlaces} center={[centerPlace.lat!, centerPlace.lng!]} zoom={13} height="176px" />
                      </Suspense>
                    </div>
                  );
                })()}
                <div className="space-y-2.5 pb-5">
                {uniquePlaces.map((pl, i) => {
                  const emoji = modalCatEmoji[pl.category?.toLowerCase() ?? ''] ?? '📍';
                  const isSaved = savedPlaceIds.has(pl.id);
                  return (
                    <div
                      key={pl.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3"
                    >
                      <button onClick={() => onOpenPlacePage?.(pl)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {pl.photoUrl
                          ? <img src={pl.photoUrl} alt={pl.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                          : <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-xl">{emoji}</span></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{pl.name.split(',')[0].trim()}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                            <MapPin size={9} strokeWidth={1.5} className="flex-shrink-0" />
                            {[pl.neighborhood, resolveCity(pl.city)].filter(Boolean).join(', ') || pl.country}
                          </p>
                          {pl.category && (
                            <p className="text-xs text-gray-400 mt-0.5">{emoji} {pl.category.charAt(0).toUpperCase() + pl.category.slice(1)}</p>
                          )}
                        </div>
                      </button>
                      {userId && (
                        <button
                          onClick={async () => {
                            if (!userId) return;
                            if (isSaved) {
                              toggleSavePlace(pl.id);
                            } else {
                              setSavedPlaceIds(prev => new Set(prev).add(pl.id));
                              savePlace(userId, pl.id);
                              setShowSaveSheet(pl.id);
                            }
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${isSaved ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                        >
                          {isSaved
                            ? <BookmarkCheck size={14} strokeWidth={1.5} className="text-white" />
                            : <Bookmark size={14} strokeWidth={1.5} className="text-gray-400" />
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Comments section */}
            <div ref={commentsTopRef} className="px-5 pt-5 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-900 mb-3">Comments</p>
              {comments.filter(c => !blockedUsers.has(c.userId)).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3">Be the first one to add a comment ✨</p>
              )}
              {comments.filter(c => !blockedUsers.has(c.userId)).length > 0 && (
                <div className="space-y-3 mb-4">
                  {comments.filter(c => !blockedUsers.has(c.userId)).map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      {c.profile.avatarUrl
                        ? <img src={c.profile.avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                        : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[10px] font-semibold text-gray-500">{c.profile.name[0]}</span></div>
                      }
                      <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl px-3 py-2.5">
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-xs font-semibold text-gray-900">{c.profile.name.split(' ')[0]}</p>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {userId && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 mt-3">
                  {userAvatar
                    ? <img src={userAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
                  }
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && commentText.trim() && !commentSending) {
                        setCommentSending(true);
                        const c = await addComment(userId, post.id, commentText.trim());
                        if (c) { setComments(prev => [...prev, c]); setShowComments(true); }
                        setCommentText('');
                        setCommentSending(false);
                      }
                    }}
                    placeholder="Add a comment…"
                    className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                  />
                  {commentText.trim() && (
                    <button
                      disabled={commentSending}
                      onClick={async () => {
                        if (!commentText.trim() || commentSending) return;
                        setCommentSending(true);
                        const c = await addComment(userId, post.id, commentText.trim());
                        if (c) { setComments(prev => [...prev, c]); setShowComments(true); }
                        setCommentText('');
                        setCommentSending(false);
                      }}
                      className="text-xs font-bold text-gray-900 disabled:text-gray-300"
                    >Post</button>
                  )}
                </div>
              )}
            </div>

            {/* Date — very end */}
            <p className="text-xs text-gray-400 px-5 pt-4 pb-8">
              {new Date(post.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div ref={commentsEndRef} />
          </div>
        </div>
      </div>

      {/* Save-to-collection sheet */}
      {showSaveSheet && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50" onClick={() => { setShowSaveSheet(null); setSaveSheetColIds(new Set()); setShowNewSaveCol(false); setNewSaveColName(''); setSavePlanAdded(new Set()); setSaveShowNewTrip(false); setSaveNewTripName(''); }}>
          <div className="w-full bg-white rounded-t-3xl pb-8" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add to a collection?</p>
            </div>
            {/* User's collections */}
            <div className="px-4 space-y-2 max-h-60 overflow-y-auto">
              {userCollectionList.map(col => {
                const inCol = saveSheetColIds.has(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={async () => {
                      if (!showSaveSheet) return;
                      if (inCol) {
                        setSaveSheetColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                      } else {
                        await addPlaceToCollection(col.id, showSaveSheet);
                        setSaveSheetColIds(prev => new Set(prev).add(col.id));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {col.coverImageUrl
                        ? <img src={col.coverImageUrl} className="w-full h-full object-cover" />
                        : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} places</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* New collection quick-create */}
            <div className="px-4 pt-3">
              <button onClick={() => setShowNewColSheet(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Plus size={15} strokeWidth={2} className="text-gray-600" />
                </div>
                New collection
              </button>
            </div>

            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {savePlans.length === 0 && !saveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {savePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {savePlans.map(plan => {
                    const added = savePlanAdded.has(plan.id);
                    const adding = savePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!userId || !showSaveSheet) return;
                          setSavePlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              const fullPlace = post.places.find(pl => pl.id === showSaveSheet);
                              await createPlanItem(plan.id, day.id, {
                                name: fullPlace?.name ?? showSaveSheet,
                                category: fullPlace?.category || '',
                                image_url: fullPlace?.photoUrl || '',
                                time_label: '',
                                address: fullPlace ? [fullPlace.neighborhood, fullPlace.city, fullPlace.country].filter(Boolean).join(', ') : '',
                                neighborhood: fullPlace?.neighborhood || '',
                                position: day.items.length,
                                lat: fullPlace?.lat ?? null,
                                lng: fullPlace?.lng ?? null,
                              });
                              setSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setSavePlanAdding(null);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                          {plan.coverImageUrl
                            ? <img src={plan.coverImageUrl} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.title}</p>
                          {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                        </div>
                        {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                        {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {saveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={saveNewTripName}
                    onChange={e => setSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setSaveShowNewTrip(false); setSaveNewTripName(''); }
                      if (e.key === 'Enter' && saveNewTripName.trim() && userId) {
                        setSaveCreatingTrip(true);
                        const newPlan = await createPlan(userId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                        setSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!saveNewTripName.trim() || saveCreatingTrip}
                    onClick={async () => {
                      if (!saveNewTripName.trim() || !userId) return;
                      setSaveCreatingTrip(true);
                      const newPlan = await createPlan(userId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                      setSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {saveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>

            {/* Remove from Saved */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!userId || !showSaveSheet) return;
                  await unsavePlace(userId, showSaveSheet);
                  setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(showSaveSheet); return n; });
                  setAllPlacesSaved(false);
                  setShowSaveSheet(null);
                  setSaveSheetColIds(new Set());
                  setSavePlanAdded(new Set());
                  setSaveShowNewTrip(false);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post save-to-collection sheet */}
      {showPostSaveColSheet && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50" onClick={() => { setShowPostSaveColSheet(false); setPostSaveColIds(new Set()); setSavePlanAdded(new Set()); setSaveShowNewTrip(false); setSaveNewTripName(''); }}>
          <div className="w-full bg-white rounded-t-3xl pb-8" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pt-2 pb-3">
              <p className="text-sm font-bold text-gray-900">Saved to All Saved ✓</p>
              <p className="text-xs text-gray-400 mt-0.5">Also add {post.places.length} place{post.places.length !== 1 ? 's' : ''} to a collection?</p>
            </div>
            <div className="px-4 space-y-2 max-h-60 overflow-y-auto">
              {userCollectionList.map(col => {
                const inCol = postSaveColIds.has(col.id);
                return (
                  <button key={col.id} onClick={async () => {
                    if (inCol) {
                      for (const p of post.places) await removePlaceFromCollection(col.id, p.id);
                      setPostSaveColIds(prev => { const n = new Set(prev); n.delete(col.id); return n; });
                    } else {
                      for (const p of post.places) await addPlaceToCollection(col.id, p.id);
                      setPostSaveColIds(prev => new Set(prev).add(col.id));
                    }
                  }} className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-2xl active:bg-gray-100 text-left">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {col.coverImageUrl ? <img src={col.coverImageUrl} className="w-full h-full object-cover" /> : <span className="text-xl">{col.emoji || '🗂️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{col.name}</p>
                      <p className="text-xs text-gray-400">{col.placesCount} places</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${inCol ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                      {inCol && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 pt-3">
              <button onClick={() => setShowNewColSheet(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>

            {/* ── Trips section ── */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add to a trip</p>
              {savePlans.length === 0 && !saveShowNewTrip && (
                <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
              )}
              {savePlans.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-2">
                  {savePlans.map(plan => {
                    const added = savePlanAdded.has(plan.id);
                    const adding = savePlanAdding === plan.id;
                    return (
                      <button
                        key={plan.id}
                        disabled={added || adding}
                        onClick={async () => {
                          if (!userId) return;
                          setSavePlanAdding(plan.id);
                          try {
                            const existingBrainstorm = plan.days.find(d => d.label === 'Brainstorm');
                            const day = existingBrainstorm ?? await createPlanDay(plan.id, 'Brainstorm', 0);
                            if (day) {
                              const startPos = day.items.length;
                              for (let i = 0; i < post.places.length; i++) {
                                const pl = post.places[i];
                                await createPlanItem(plan.id, day.id, {
                                  name: pl.name,
                                  category: pl.category || '',
                                  image_url: pl.photoUrl || '',
                                  time_label: '',
                                  address: [pl.neighborhood, pl.city, pl.country].filter(Boolean).join(', '),
                                  neighborhood: pl.neighborhood || '',
                                  position: startPos + i,
                                  lat: pl.lat ?? null,
                                  lng: pl.lng ?? null,
                                });
                              }
                              setSavePlanAdded(prev => new Set(prev).add(plan.id));
                            }
                          } finally {
                            setSavePlanAdding(null);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${added ? 'bg-gray-900' : 'bg-gray-50 active:bg-gray-100'}`}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                          {plan.coverImageUrl
                            ? <img src={plan.coverImageUrl} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">✈️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${added ? 'text-white' : 'text-gray-900'}`}>{plan.title}</p>
                          {plan.country && <p className={`text-xs truncate ${added ? 'text-gray-300' : 'text-gray-400'}`}>{plan.country}</p>}
                        </div>
                        {adding && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
                        {added && !adding && <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className="flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {!added && !adding && <Plus size={16} strokeWidth={2} className="text-gray-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {saveShowNewTrip ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={saveNewTripName}
                    onChange={e => setSaveNewTripName(e.target.value)}
                    placeholder="Trip name…"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-gray-400"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setSaveShowNewTrip(false); setSaveNewTripName(''); }
                      if (e.key === 'Enter' && saveNewTripName.trim() && userId) {
                        setSaveCreatingTrip(true);
                        const newPlan = await createPlan(userId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                        if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                        setSaveCreatingTrip(false);
                      }
                    }}
                  />
                  <button
                    disabled={!saveNewTripName.trim() || saveCreatingTrip}
                    onClick={async () => {
                      if (!saveNewTripName.trim() || !userId) return;
                      setSaveCreatingTrip(true);
                      const newPlan = await createPlan(userId, { title: saveNewTripName.trim(), country: '', dates: '', description: '', cover_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', status: 'dreaming' });
                      if (newPlan) { setSavePlans(prev => [newPlan, ...prev]); setSaveShowNewTrip(false); setSaveNewTripName(''); }
                      setSaveCreatingTrip(false);
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >
                    {saveCreatingTrip ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setSaveShowNewTrip(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                  New trip
                </button>
              )}
            </div>

            {/* Remove from Saved */}
            <div className="mx-4 border-t border-gray-100 mt-1" />
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={async () => {
                  if (!userId) return;
                  for (const p of post.places) {
                    await unsavePlace(userId, p.id);
                    setSavedPlaceIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                  }
                  setAllPlacesSaved(false);
                  setShowPostSaveColSheet(false);
                  setPostSaveColIds(new Set());
                  setSavePlanAdded(new Set());
                  setSaveShowNewTrip(false);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-red-500 py-2 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={15} strokeWidth={2} className="text-red-400" />
                </div>
                Remove from Saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection full modal sheet */}
      {showNewColSheet && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNewColSheet(false); setNewColSheetName(''); setNewColSheetDesc(''); setNewColSheetCoverUrl(null); }} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-base font-bold text-gray-900">New Collection</h3>
              <button
                disabled={!newColSheetName.trim() || newColSheetSaving || newColSheetCoverUploading}
                onClick={async () => {
                  if (!newColSheetName.trim() || !userId) return;
                  setNewColSheetSaving(true);
                  try {
                    const { data, error } = await createCollection(userId, { name: newColSheetName.trim(), emoji: '', description: newColSheetDesc.trim(), cover_image_url: newColSheetCoverUrl });
                    if (!error && data) {
                      if (showSaveSheet) {
                        await addPlaceToCollection(data.id, showSaveSheet);
                        setSaveSheetColIds(prev => new Set(prev).add(data.id));
                        setUserCollectionList(prev => [{ ...data, placesCount: 1 }, ...prev]);
                      } else {
                        setUserCollectionList(prev => [{ ...data, placesCount: 0 }, ...prev]);
                      }
                    }
                  } finally {
                    setNewColSheetSaving(false);
                    setShowNewColSheet(false);
                    setNewColSheetName('');
                    setNewColSheetDesc('');
                    setNewColSheetCoverUrl(null);
                  }
                }}
                className="text-sm font-bold text-gray-900 px-4 py-1.5 bg-gray-100 rounded-full disabled:opacity-40"
              >
                {newColSheetSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
            <div className="px-4 space-y-3 pb-6">
              <label className="w-full h-32 rounded-2xl bg-gray-100 flex items-center justify-center relative cursor-pointer overflow-hidden block">
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file || !userId) return;
                  setNewColSheetCoverUploading(true);
                  const path = `collections/${userId}/${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
                  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                  if (!error) setNewColSheetCoverUrl(getPublicUrl('avatars', path));
                  setNewColSheetCoverUploading(false);
                  e.target.value = '';
                }} />
                {newColSheetCoverUrl
                  ? <img src={newColSheetCoverUrl} className="w-full h-full object-cover" />
                  : newColSheetCoverUploading
                    ? <Loader2 size={20} className="text-gray-400 animate-spin" />
                    : <div className="flex flex-col items-center gap-1.5 text-gray-400"><Plus size={20} /><span className="text-xs font-medium">Add cover photo</span></div>
                }
                {newColSheetCoverUrl && !newColSheetCoverUploading && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change photo</span>
                  </div>
                )}
              </label>
              <input autoFocus value={newColSheetName} onChange={e => setNewColSheetName(e.target.value)} placeholder="Collection name" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
              <input value={newColSheetDesc} onChange={e => setNewColSheetDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:bg-gray-100 transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* Share sheet */}
      {showShareSheet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '384px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowShareSheet(false); setShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} />
          <div className="relative bg-white rounded-t-3xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h3 className="text-base font-bold text-gray-900">Send to</h3>
              <button onClick={() => { setShowShareSheet(false); setShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
                <X size={14} strokeWidth={2} className="text-gray-500" />
              </button>
            </div>
            {/* Search bar */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={shareSearchQuery}
                  onChange={e => {
                    const q = e.target.value;
                    setShareSearchQuery(q);
                    if (shareSearchTimerRef.current) clearTimeout(shareSearchTimerRef.current);
                    if (!q.trim()) { setShareSearchResults([]); setSearchingShare(false); return; }
                    setSearchingShare(true);
                    shareSearchTimerRef.current = setTimeout(async () => {
                      if (!userId) return;
                      const results = await searchProfiles(q, userId);
                      setShareSearchResults(results);
                      setSearchingShare(false);
                    }, 300);
                  }}
                  placeholder="Search people..."
                  className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                />
                {searchingShare && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
              </div>
            </div>
            {/* People list */}
            {(() => {
              const showSearch = shareSearchQuery.trim().length > 0;
              const list = showSearch ? shareSearchResults : conversations.map(c => ({ id: c.otherUser.id, name: c.otherUser.name, username: c.otherUser.username, avatarUrl: c.otherUser.avatarUrl }));
              if (showSearch && shareSearchResults.length === 0 && !searchingShare) return <p className="text-sm text-gray-400 text-center py-4 px-5">No users found</p>;
              if (!showSearch && conversations.length === 0) return null;
              return (
                <div className="px-3 max-h-44 overflow-y-auto">
                  {list.map(person => {
                    const sent = shareSentTo.has(person.id);
                    const ini = person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button key={person.id} onClick={async () => {
                        if (sent || !userId) return;
                        const convId = await getOrCreateConversation(userId, person.id);
                        if (convId) {
                          await sendMessage(convId, userId, `Check this out on sondrr: ${window.location.origin}/?post=${post.id}`);
                          setShareSentTo(prev => new Set(prev).add(person.id));
                        }
                      }} className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl active:bg-gray-50 text-left">
                        {person.avatarUrl
                          ? <img src={person.avatarUrl} className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0" />
                          : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">{ini}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
                          <p className="text-xs text-gray-400 truncate">@{person.username}</p>
                        </div>
                        <div className={`px-5 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${sent ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>
                          {sent ? 'Sent ✓' : 'Send'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {/* Divider + external options */}
            <div className="mt-2 border-t border-gray-100 px-3 pb-10">
              <button className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50" onClick={async () => {
                const url = `${window.location.origin}/?post=${post.id}`;
                if (navigator.share) { try { await navigator.share({ url, title: 'Check this out on sondrr' }); } catch {} }
                else { navigator.clipboard.writeText(url).catch(() => {}); }
              }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Send size={16} strokeWidth={1.5} className="text-gray-700" /></div>
                <span className="text-sm font-semibold text-gray-900">Share externally</span>
              </button>
              <button className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?post=${post.id}`).catch(() => {});
                setLinkCopied(true);
                if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
                linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 1500);
              }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {linkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={1.5} className="text-gray-700" />}
                </div>
                <span className="text-sm font-semibold text-gray-900">{linkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post options sheet (···) ── */}
      {showPostOptions && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: '390px', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPostOptions(false)} />
          <div className="relative bg-white rounded-t-3xl pb-10">
            <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-gray-200" /></div>
            {postOptionsStep === 'options' && (
              <>
                <div className="py-1">
                  {userId === post.userId ? (
                    <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                      onClick={() => setPostOptionsStep('deleteConfirm')}>
                      <Trash2 size={18} strokeWidth={1.5} className="text-gray-500" />
                      <span className="text-sm text-gray-900">Delete</span>
                    </button>
                  ) : (
                    <>
                      <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                        onClick={() => setPostOptionsStep('reason')}>
                        <Flag size={18} strokeWidth={1.5} className="text-gray-500" />
                        <span className="text-sm text-gray-900">Report</span>
                        <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400 ml-auto" />
                      </button>
                      {userId && (
                        <button className="w-full flex items-center gap-3 px-5 py-4 active:bg-gray-50"
                          onClick={() => {
                            const alreadyBlocked = blockedUsers.has(post.userId);
                            setShowPostOptions(false);
                            setPostActionModal({
                              avatarUrl: post.profile.avatarUrl,
                              title: alreadyBlocked ? `Unblock @${post.profile.username || post.profile.name}?` : `Block @${post.profile.username || post.profile.name}?`,
                              subtitle: alreadyBlocked
                                ? 'They will be able to see your posts and find your profile again.'
                                : "They won't be able to see your profile or posts, and you won't see theirs.",
                              confirmLabel: alreadyBlocked ? 'Unblock' : 'Block',
                              confirmVariant: alreadyBlocked ? 'dark' : 'red',
                              onConfirm: async () => {
                                if (alreadyBlocked) {
                                  await unblockUser(userId, post.userId);
                                  setBlockedUsers(prev => { const s = new Set(prev); s.delete(post.userId); return s; });
                                } else {
                                  await blockUser(userId, post.userId);
                                  setBlockedUsers(prev => new Set([...prev, post.userId]));
                                  onClose();
                                }
                                setPostActionModal(null);
                              },
                            });
                          }}>
                          <UserX size={18} strokeWidth={1.5} className="text-gray-500" />
                          <span className="text-sm text-gray-900">{blockedUsers.has(post.userId) ? 'Unblock' : 'Block'} @{post.profile.username || post.profile.name}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {postOptionsStep === 'reason' && (
              <>
                <div className="px-5 pb-3 border-b border-gray-100">
                  <p className="text-base font-bold text-gray-900">Report</p>
                  <p className="text-xs text-gray-400 mt-0.5">Why are you reporting this?</p>
                </div>
                <div className="py-1">
                  {['Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous content', 'Spam', 'Misinformation', 'Intellectual property violation', "Doesn't belong here"].map(reason => (
                    <button key={reason} className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50"
                      onClick={async () => {
                        if (!userId) return;
                        await reportContent(userId, { postId: post.id, userId: post.userId, reason });
                        setShowPostOptions(false);
                        setPostActionModal({
                          iconType: 'check',
                          title: 'Report submitted',
                          subtitle: "Thank you. We'll review this content and take action if it violates our guidelines.",
                        });
                      }}>
                      <span className="text-sm text-gray-900">{reason}</span>
                      <ChevronRight size={16} strokeWidth={1.5} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {postOptionsStep === 'deleteConfirm' && (
              <div className="flex flex-col items-center px-6 pb-2 pt-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Trash2 size={28} strokeWidth={1.5} className="text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Delete this post?</p>
                <p className="text-sm text-gray-400 text-center mb-6">This can't be undone.</p>
                <button className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-bold mb-3"
                  onClick={async () => {
                    await deletePost(post.id);
                    setShowPostOptions(false);
                    onClose();
                  }}>
                  Delete
                </button>
                <button className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold"
                  onClick={() => setPostOptionsStep('options')}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {postActionModal && (
        <div onClick={e => e.stopPropagation()}>
          <ActionModal
            avatarUrl={postActionModal.avatarUrl}
            iconType={postActionModal.iconType}
            title={postActionModal.title}
            subtitle={postActionModal.subtitle}
            confirmLabel={postActionModal.confirmLabel}
            confirmVariant={postActionModal.confirmVariant}
            onConfirm={postActionModal.onConfirm}
            onCancel={() => setPostActionModal(null)}
          />
        </div>
      )}
    </div>
  );
}
