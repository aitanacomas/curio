import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import UserProfile from './UserProfile';
import PlacePage from '../components/PlacePage';
import { Search, X, Mail, MapPin, Bookmark, BookmarkCheck, Map, LayoutGrid, Heart, MessageCircle, Send, Plus, Check, ChevronRight } from 'lucide-react';
import { getFeedPosts, getFollowing, followUser, unfollowUser, searchProfiles, getSuggestedUsers, savePlace, unsavePlace, likePost, unlikePost, savePost, unsavePost, getPostComments, addComment, getSavedPlaces, getUserCollections, addPlaceToCollection, createCollection, getConversations, getOrCreateConversation, sendMessage, removePlaceFromCollection, buildTasteProfile, getGuides, type RealPost, type RealPostPlace, type FollowProfile, type PostComment, type RealCollection, type Conversation, type TasteProfile, type Guide } from '../lib/supabase';
import { googleTypesToCategory, extractNeighborhood } from '../lib/placeUtils';
import GuideDetail from '../components/GuideDetail';
import CreateGuideSheet from '../components/CreateGuideSheet';
import SecretGuideSheet, { type SecretGuide } from '../components/SecretGuideSheet';
import type { MapBounds } from '../components/MapView';
import { SECRET_GUIDES } from '../lib/secretGuides';


const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY as string;

const MapView = lazy(() => import('../components/MapView'));

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington DC',
};

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
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState<FollowProfile[]>([]);
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
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [selectedSecretGuide, setSelectedSecretGuide] = useState<SecretGuide | null>(null);
  const [secretSavedIds, setSecretSavedIds] = useState<Set<string>>(new Set());
  const [secretCovers, setSecretCovers] = useState<Record<string, string>>({});
  const [activeExpCategory, setActiveExpCategory] = useState('art');
  const [cityPageTab, setCityPageTab] = useState<'guides' | 'activities'>('activities');
  const [selectedExpCity, setSelectedExpCity] = useState<{ id: string; name: string; country: string; lat: number; lng: number } | null>(null);
  const [cityPlaces, setCityPlaces] = useState<RealPostPlace[]>([]);
  const [cityPlacesNextToken, setCityPlacesNextToken] = useState<string | null>(null);
  const [loadingCityPlaces, setLoadingCityPlaces] = useState(false);
  const [loadingMoreCityPlaces, setLoadingMoreCityPlaces] = useState(false);
  const cityPlacesSentinelRef = useRef<HTMLDivElement | null>(null);
  const [cityCoverPhotos, setCityCoverPhotos] = useState<Record<string, string>>({});
  const [expCityQuery, setExpCityQuery] = useState('');
  const [expCitySuggestions, setExpCitySuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const expCityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const firstPlace = g.places[0];
      if (!firstPlace) return;
      const query = `${firstPlace.name} ${firstPlace.neighborhood} ${g.city}`;
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
        const photoName = data.places?.[0]?.photos?.[1]?.name ?? data.places?.[0]?.photos?.[0]?.name;
        if (photoName) {
          setSecretCovers(prev => ({
            ...prev,
            [g.id]: `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${GOOGLE_PLACES_KEY}`,
          }));
        }
      } catch {}
    });
  }, [selectedExpCity?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [suggestedUsers, setSuggestedUsers] = useState<FollowProfile[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [exploreSavedPlaces, setExploreSavedPlaces] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      getFeedPosts(),
      appUser?.id ? getFollowing(appUser.id) : Promise.resolve(new Set<string>()),
      appUser?.id ? buildTasteProfile(appUser.id) : Promise.resolve(null),
      appUser?.id ? getSavedPlaces(appUser.id).then(sp => setExploreSavedPlaces(new Set(sp.map(p => p.id)))) : Promise.resolve(),
    ]).then(([fetchedPosts, followingSet, profile]) => {
      setPosts(fetchedPosts);
      setFollowing(followingSet);
      setTasteProfile(profile);
      setLoading(false);
    });
  }, [appUser?.id]);

  // Fetch community guides once when Cities tab is opened
  useEffect(() => {
    if (activeTab !== 'Cities') return;
    getGuides().then(setGuides);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cover photos for featured cities — hardcoded overrides first, then Unsplash, then cached
  useEffect(() => {
    if (activeTab !== 'Cities') return;
    const LS_PREFIX = 'curio_city_cover_v3_';

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
    setLoadingCityPlaces(true);
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
    fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.addressComponents,places.formattedAddress,places.types,places.photos,places.location,places.rating,places.editorialSummary,nextPageToken' },
      body: JSON.stringify({ textQuery: `${cat.query} in ${selectedExpCity.name}`, maxResultCount: 20, languageCode: 'en', locationBias: { circle: { center: { latitude: selectedExpCity.lat, longitude: selectedExpCity.lng }, radius: 40000 } } }),
    }).then(r => r.json()).then(data => {
      setCityPlaces(mapPlaces(data.places, selectedExpCity!.name));
      setCityPlacesNextToken(data.nextPageToken ?? null);
      setLoadingCityPlaces(false);
    }).catch(() => setLoadingCityPlaces(false));
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
      fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.addressComponents,places.formattedAddress,places.types,places.photos,places.location,places.rating,places.editorialSummary,nextPageToken' },
        body: JSON.stringify({ textQuery: `${cat.query} in ${selectedExpCity.name}`, maxResultCount: 20, pageToken: cityPlacesNextToken, languageCode: 'en', locationBias: { circle: { center: { latitude: selectedExpCity.lat, longitude: selectedExpCity.lng }, radius: 40000 } } }),
      }).then(r => r.json()).then(data => {
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
    if (!expCityQuery.trim()) { setExpCitySuggestions([]); return; }
    expCityTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
          body: JSON.stringify({ input: expCityQuery, languageCode: 'en', includedPrimaryTypes: ['locality', 'administrative_area_level_1'] }),
        });
        const data = await res.json();
        setExpCitySuggestions((data.suggestions ?? []).slice(0, 5).map((s: any) => ({ placeId: s.placePrediction?.placeId ?? '', text: s.placePrediction?.text?.text ?? '' })).filter((s: any) => s.placeId));
      } catch { setExpCitySuggestions([]); }
    }, 300);
  }, [expCityQuery]);

  const handleExpCitySelect = async (placeId: string, text: string) => {
    setExpCityQuery('');
    setExpCitySuggestions([]);
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'location,addressComponents,displayName', 'X-Goog-LanguageCode': 'en' },
      });
      const data = await res.json();
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
    setLoadingGuides(true);
    getGuides().then(g => { setGuides(g); setLoadingGuides(false); });
  }, []);

  // Debounced user search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setUserResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchProfiles(query, appUser?.id ?? '');
      setUserResults(results);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, appUser?.id]);

  const GEO_TYPES = new Set(['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country', 'political', 'colloquial_area', 'continent']);
  const FIELD_MASK = 'places.id,places.displayName,places.addressComponents,places.formattedAddress,places.types,places.photos,places.location,places.rating,places.editorialSummary';
  const HEADERS = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': FIELD_MASK };

  // Fetch up to `targetCount` results for one city+query by chaining nextPageToken (max 20 per page)
  const fetchCityPaginated = async (textQuery: string, includedType: string, city: string, targetCount: number): Promise<RealPostPlace[]> => {
    const places: RealPostPlace[] = [];
    let token: string | null = null;
    const pages = Math.ceil(targetCount / 20);
    for (let page = 0; page < pages; page++) {
      const body: Record<string, unknown> = { textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, maxResultCount: 20, languageCode: 'en' };
      if (token) body.pageToken = token;
      try {
        const d = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) }).then(r => r.json());
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
    const groups = filterType ? [[filterType]] : nearbyGroups;
    const results = await Promise.all(groups.map(types =>
      fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } }, includedTypes: types, maxResultCount: 10, languageCode: 'en', rankPreference: 'POPULARITY' }),
      }).then(r => r.json()).then(d => byRating(d.places ?? []).slice(0, 8).map((p: any) => mapPlace(p, city, country)).filter(Boolean) as RealPostPlace[]).catch(() => [])
    ));
    // Interleave results so categories mix: take one from each group in turn
    const maxLen = Math.max(...results.map(r => r.length));
    const interleaved: RealPostPlace[] = [];
    for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r[i]) interleaved.push(r[i]); });
    const seenIds = new Set<string>(); const seenNames = new Set<string>();
    return interleaved.filter(p => {
      const nameKey = p.name.toLowerCase().slice(0, 30);
      if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
      seenIds.add(p.id); seenNames.add(nameKey); return true;
    });
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
          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({ textQuery: query.trim(), maxResultCount: 20, languageCode: 'en' }),
          });
          const data = await res.json();
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
              const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
              const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.slice(0, 4).map((_, i) => {
                const cfg = i === 0 ? chipCfg : chipCfg; // same chip, multiple fetches for volume
                return fetch('https://places.googleapis.com/v1/places:searchText', {
                  method: 'POST', headers: HEADERS,
                  body: JSON.stringify({ textQuery: `${cfg.textQuery} ${city}`, includedType: cfg.includedType, minRating: 3.5, languageCode: 'en' }),
                }).then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 8).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
              }));
              setDiscoverDefaultTokens(results.map(r => r.token));
              const all = results.flatMap(r => r.places);
              const seenIds = new Set<string>(); const seenNames = new Set<string>();
              setDiscoverResults(shuffleArray(all.filter(p => { const k = p.name.toLowerCase().slice(0, 30); if (!p.name || seenIds.has(p.id) || seenNames.has(k)) return false; seenIds.add(p.id); seenNames.add(k); return true; })));
            } else {
              // All + city: run all category searches for this city
              const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }) =>
                fetch('https://places.googleapis.com/v1/places:searchText', {
                  method: 'POST', headers: HEADERS,
                  body: JSON.stringify({ textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, languageCode: 'en' }),
                }).then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }))
              ));
              setDiscoverDefaultTokens(results.map(r => r.token));
              const interleaved: RealPostPlace[] = [];
              const maxLen = Math.max(...results.map(r => r.places.length));
              for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
              const seenIds = new Set<string>(); const seenNames = new Set<string>();
              setDiscoverResults(shuffleArray(interleaved.filter(p => { const k = p.name.toLowerCase().slice(0, 30); if (!p.name || seenIds.has(p.id) || seenNames.has(k)) return false; seenIds.add(p.id); seenNames.add(k); return true; })));
            }
          } else {
            setDiscoverTextToken(data.nextPageToken ?? null);
            setDiscoverResults((raw.map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[]).filter(p => p.name));
          }
        } else if (hasCategoryFilter) {
          // Category chip path — 10 cities × 200 results each = ~2000 places initial load
          setDiscoverCityPage(0);
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const { textQuery: chipQuery, includedType } = chipCfg;
          const cities = WORLD_CITIES.slice(0, 10);
          const results = await Promise.all(cities.map(city => fetchCityPaginated(chipQuery, includedType, city, 200)));
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
          const cityOffset = 0;
          const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }, i) => {
            const city = WORLD_CITIES[(cityOffset * DEFAULT_CATEGORY_SEARCHES.length + i) % WORLD_CITIES.length];
            return fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST', headers: HEADERS,
              body: JSON.stringify({ textQuery: `${textQuery} ${city}`, includedType, minRating: 3.5, maxResultCount: 20, languageCode: 'en' }),
            }).then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.places.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
          const seenIds = new Set<string>(); const seenNames = new Set<string>();
          setDiscoverResults(shuffleArray(interleaved.filter(p => {
            const nameKey = p.name.toLowerCase().slice(0, 30);
            if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
            seenIds.add(p.id); seenNames.add(nameKey); return true;
          })));
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
            return fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) })
              .then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 8).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
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
            return fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) })
              .then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.places.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
          const more = interleaved.filter(p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase().slice(0, 30)));
          setDiscoverResults(prev => [...prev, ...more]);
        }
      } else if (discoverTextToken) {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ textQuery: query.trim(), languageCode: 'en', pageToken: discoverTextToken }),
        });
        const data = await res.json();
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
          // Category chip load-more — next 10 cities × 200 results each
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const { textQuery: chipQuery, includedType } = chipCfg;
          const cityStart = (nextPage * 10) % WORLD_CITIES.length;
          const cities = [...WORLD_CITIES.slice(cityStart, cityStart + 10), ...WORLD_CITIES.slice(0, Math.max(0, cityStart + 10 - WORLD_CITIES.length))].slice(0, 10);
          const results = await Promise.all(cities.map(city => fetchCityPaginated(chipQuery, includedType, city, 200)));
          const maxLen = Math.max(...results.map(r => r.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r[i]) morePlaces.push(r[i]); });
        } else {
          // Default "For You" — next city set across all category searches
          const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }, i) => {
            const token = discoverDefaultTokens[i];
            if (token) {
              return fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST', headers: HEADERS,
                body: JSON.stringify({ textQuery, includedType, pageToken: token, languageCode: 'en' }),
              }).then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
            }
            const city = WORLD_CITIES[(nextPage * DEFAULT_CATEGORY_SEARCHES.length + i) % WORLD_CITIES.length];
            return fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST', headers: HEADERS,
              body: JSON.stringify({ textQuery: `${textQuery} ${city}`, includedType, minRating: 3.8, languageCode: 'en' }),
            }).then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
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

  const filteredDiscover = activeCategory === 'all'
    ? discoverResults
    : discoverResults.filter(p => p.category === activeCategory);

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

  const toggleFollow = async (userId: string) => {
    if (!appUser?.id) return;
    if (following.has(userId)) {
      setFollowing(prev => { const s = new Set(prev); s.delete(userId); return s; });
      await unfollowUser(appUser.id, userId);
    } else {
      setFollowing(prev => new Set(prev).add(userId));
      await followUser(appUser.id, userId);
    }
  };

  if (viewingUserId && appUser) {
    return <UserProfile userId={viewingUserId} currentUserId={appUser.id} onBack={() => setViewingUserId(null)} onFollowChange={() => {}} onMessage={onOpenMessages} />;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className={`sticky top-0 z-10 bg-white px-4 pt-5 ${exploreMapMode ? '' : 'border-b border-gray-100'} ${activeTab === 'Cities' ? 'pb-0' : 'pb-3'}`}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">curio</h1>
          {onOpenMessages && (
            <button onClick={onOpenMessages} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
              <Mail size={17} strokeWidth={1.5} className="text-gray-700" />
            </button>
          )}
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
          {/* Map/Grid toggle — only on For You / Following */}
          {activeTab === 'For You' && (
            <button
              onClick={() => { setExploreMapMode(m => !m); setSelectedMapPin(null); }}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-gray-500 pb-1"
            >
              {exploreMapMode
                ? <><LayoutGrid size={14} strokeWidth={1.5} /><span>Grid</span></>
                : <><Map size={14} strokeWidth={1.5} /><span>Map</span></>
              }
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className={`flex gap-2 overflow-x-auto -mx-4 px-4 ${activeTab !== 'For You' ? 'hidden' : ''}`} style={{ scrollbarWidth: 'none' }}>
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

      {/* User search results */}
      {query.trim() && userResults.length > 0 && (
        <div className="px-4 pt-3 pb-4 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">People</p>
          <div className="space-y-3">
            {userResults.map(user => {
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
                      onClick={() => toggleFollow(user.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-gray-900 text-white'}`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Grid — place cards (hidden on Guides tab) */}
      {activeTab === 'For You' && exploreMapMode && (
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

      {activeTab === 'For You' && !exploreMapMode && (
        <div className="p-3">
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
                    {query.trim().length >= 2 || activeCategory !== 'all' ? 'Try a different search term' : 'Be the first to share a place on curio'}
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

      {/* Activities tab — city-first */}
      {activeTab === 'Cities' && !selectedExpCity && (
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
      {activeTab === 'Cities' && selectedExpCity && (
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
                    <div className="space-y-3">
                      {communityCityGuides.map(guide => (
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
                                <p className="text-white text-sm font-bold leading-tight">{guide.title}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="h-20 bg-gray-200 flex items-center justify-center">
                              <p className="text-3xl">🗺️</p>
                            </div>
                          )}
                          <div className="px-3 py-2 flex items-center gap-2">
                            {guide.profile.avatarUrl
                              ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                              : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-gray-500">{guide.profile.name[0]?.toUpperCase()}</div>
                            }
                            <p className="text-xs text-gray-500 truncate">by @{guide.profile.username}</p>
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


      {/* Post modal */}
      {selectedPlace && (
        <PostModal
          place={selectedPlace}
          isFollowing={following.has(selectedPlace.post.userId)}
          isOwnPost={appUser?.id === selectedPlace.post.userId}
          onToggleFollow={() => toggleFollow(selectedPlace.post.userId)}
          onClose={() => setSelectedPlace(null)}
          userId={appUser?.id}
          userAvatar={appUser?.avatar}
          onViewUser={(uid) => { setSelectedPlace(null); setViewingUserId(uid); }}
          onOpenPlacePage={pl => setSelectedPlacePage(pl)}
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
              setExploreSavedPlaces(prev => { const n = new Set(prev); n.delete(id); return n; });
              await unsavePlace(appUser.id, id);
            } else {
              setExploreSavedPlaces(prev => new Set(prev).add(id));
              await savePlace(appUser.id, id);
            }
          }}
          appUser={appUser ?? undefined}
          onViewUser={(uid) => { setSelectedPlacePage(null); setViewingUserId(uid); }}
          onSelectPlace={(pl) => setSelectedPlacePage(pl)}
        />
      )}
    </div>
  );
}

// ── Place card ───────────────────────────────────────────────────────────────

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', treats: '🍰', bar: '🍸', nightlife: '🎵', food: '🍕', hotel: '🏨',
  landmark: '🏛️', art: '🎨', attraction: '🏛️', // fallback for legacy posts
  nature: '🌿', beach: '🏖️', shop: '🛍️',
  experience: '🎡', neighbourhood: '🏘️', street: '🏙️',
  sports: '🎾', wellness: '💆', event: '🎟️',
};

function PlaceCard({ place, onClick }: { place: FlatPlace; onClick: () => void }) {
  const emoji = categoryEmoji[place.category];
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
  const emoji = categoryEmoji[place.category];
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

function PostModal({ place, isFollowing, isOwnPost, onToggleFollow, onClose, userId, userAvatar, onViewUser, onOpenPlacePage }: {
  place: FlatPlace;
  isFollowing: boolean;
  isOwnPost: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  userId?: string;
  userAvatar?: string | null;
  onViewUser?: (userId: string) => void;
  onOpenPlacePage?: (place: RealPostPlace) => void;
}) {
  const { post, indexInPost } = place;
  const [currentIndex, setCurrentIndex] = useState(indexInPost);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const commentsTopRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareSearchResults, setShareSearchResults] = useState<FollowProfile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);
  const [shareSentTo, setShareSentTo] = useState<Set<string>>(new Set());
  const [showPostSaveColSheet, setShowPostSaveColSheet] = useState(false);
  const [postSaveColIds, setPostSaveColIds] = useState<Set<string>>(new Set());
  const [allPlacesSaved, setAllPlacesSaved] = useState(false);
  const shareSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initials = post.profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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

        {/* Sticky header — drag handle + X always visible regardless of scroll */}
        <div className="sticky top-0 z-30 flex justify-between items-start px-3 pt-3 pointer-events-none" style={{ marginBottom: -44 }}>
          <div className="w-8" />
          <div className="w-9 h-1 bg-white/60 rounded-full mt-0.5" />
          <button onClick={onClose} className="pointer-events-auto w-8 h-8 bg-black/55 backdrop-blur-md rounded-full flex items-center justify-center">
            <X size={15} strokeWidth={2.5} className="text-white" />
          </button>
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
                    setIsLiked(p => !p);
                    setLikeCount((p: number) => p + (isLiked ? -1 : 1));
                    isLiked ? unlikePost(userId, post.id) : likePost(userId, post.id);
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
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
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
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</p>
              {comments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3">Be the first one to add a comment ✨</p>
              )}
              {comments.length > 0 && (
                <div className="space-y-3 mb-4">
                  {comments.map(c => (
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
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50" onClick={() => { setShowSaveSheet(null); setSaveSheetColIds(new Set()); setShowNewSaveCol(false); setNewSaveColName(''); }}>
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
              {showNewSaveCol ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newSaveColName}
                    onChange={e => setNewSaveColName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newSaveColName.trim() && userId) {
                        setSavingNewSaveCol(true);
                        const { data, error } = await createCollection(userId, { name: newSaveColName.trim(), emoji: '', description: '', cover_image_url: null });
                        setSavingNewSaveCol(false);
                        if (!error && data) { setUserCollectionList(prev => [data, ...prev]); setNewSaveColName(''); setShowNewSaveCol(false); }
                      }
                      if (e.key === 'Escape') { setShowNewSaveCol(false); setNewSaveColName(''); }
                    }}
                    placeholder="Collection name…"
                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none"
                  />
                  <button
                    disabled={!newSaveColName.trim() || savingNewSaveCol}
                    onClick={async () => {
                      if (!newSaveColName.trim() || !userId) return;
                      setSavingNewSaveCol(true);
                      const { data, error } = await createCollection(userId, { name: newSaveColName.trim(), emoji: '', description: '', cover_image_url: null });
                      setSavingNewSaveCol(false);
                      if (!error && data) { setUserCollectionList(prev => [data, ...prev]); setNewSaveColName(''); setShowNewSaveCol(false); }
                    }}
                    className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                  >{savingNewSaveCol ? '…' : 'Create'}</button>
                </div>
              ) : (
                <button onClick={() => setShowNewSaveCol(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Plus size={15} strokeWidth={2} className="text-gray-600" />
                  </div>
                  New collection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post save-to-collection sheet */}
      {showPostSaveColSheet && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50" onClick={() => { setShowPostSaveColSheet(false); setPostSaveColIds(new Set()); }}>
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
              <button onClick={() => setShowNewSaveCol(true)} className="flex items-center gap-2 text-sm font-semibold text-gray-700 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Plus size={15} strokeWidth={2} className="text-gray-600" /></div>
                New collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share sheet */}
      {showShareSheet && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={() => { setShowShareSheet(false); setShareSentTo(new Set()); setShareSearchQuery(''); setShareSearchResults([]); }}>
          <div className="w-full bg-white rounded-t-3xl" style={{ maxWidth: '384px' }} onClick={e => e.stopPropagation()}>
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
                          await sendMessage(convId, userId, `Check this out on curio: ${window.location.origin}/?post=${post.id}`);
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
                if (navigator.share) { try { await navigator.share({ url, title: 'Check this out on curio' }); } catch {} }
                else { navigator.clipboard.writeText(url).catch(() => {}); }
              }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Send size={16} strokeWidth={1.5} className="text-gray-700" /></div>
                <span className="text-sm font-semibold text-gray-900">Share externally</span>
              </button>
              <button className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl active:bg-gray-50" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?post=${post.id}`).catch(() => {});
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 1500);
              }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {linkCopied ? <Check size={16} strokeWidth={2} className="text-green-500" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-700"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                </div>
                <span className="text-sm font-semibold text-gray-900">{linkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
