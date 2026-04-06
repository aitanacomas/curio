import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import UserProfile from './UserProfile';
import PlacePage from '../components/PlacePage';
import { Search, X, Mail, MapPin, Bookmark, BookmarkCheck, Map, Heart, MessageCircle, Send, Plus, Check } from 'lucide-react';
import { getFeedPosts, getFollowing, followUser, unfollowUser, searchProfiles, savePlace, unsavePlace, likePost, unlikePost, savePost, unsavePost, getPostComments, addComment, getSavedPlaces, getUserCollections, addPlaceToCollection, createCollection, getConversations, getOrCreateConversation, sendMessage, removePlaceFromCollection, buildTasteProfile, getGuides, type RealPost, type RealPostPlace, type FollowProfile, type PostComment, type RealCollection, type Conversation, type TasteProfile, type Guide } from '../lib/supabase';
import { googleTypesToCategory } from '../lib/placeUtils';
import GuideDetail from '../components/GuideDetail';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

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

// World cities rotated through for global discover results
const WORLD_CITIES_BASE = [
  'Tokyo', 'Paris', 'New York', 'London', 'Mexico City',
  'Barcelona', 'Rome', 'Bangkok', 'Sydney', 'Dubai',
  'Istanbul', 'Amsterdam', 'Singapore', 'Buenos Aires', 'Lisbon',
  'Copenhagen', 'Seoul', 'Berlin', 'Vienna', 'Prague',
  'Marrakech', 'Kyoto', 'Cape Town', 'Montreal', 'Havana',
  'Bali', 'Santorini', 'Amalfi Coast', 'Tulum', 'Cartagena',
  'Taipei', 'Ho Chi Minh City', 'Nairobi', 'Lagos', 'Bogotá',
  'Athens', 'Budapest', 'Reykjavik', 'Dubrovnik', 'Florence',
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

type FeedTab = 'For You' | 'Following' | 'Guides';

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

  useEffect(() => {
    if (activeTab !== 'Guides') return;
    setLoadingGuides(true);
    getGuides().then(g => { setGuides(g); setLoadingGuides(false); });
  }, [activeTab]);

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
  const FIELD_MASK = 'places.id,places.displayName,places.addressComponents,places.types,places.photos,places.location,places.rating';
  const HEADERS = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': FIELD_MASK };

  const mapPlace = (p: any, cityOverride?: string, countryOverride?: string): RealPostPlace | null => {
    const comps: any[] = p.addressComponents ?? [];
    const find = (...types: string[]) => { const c = comps.find((c: any) => types.some(t => c.types?.includes(t))); return c ? (c.longText || c.shortText || '') : ''; };
    const rawCity = normalizeCity(cityOverride || find('postal_town') || find('locality') || find('administrative_area_level_1'));
    const isLatin = (s: string) => /^[\u0000-\u024F\s,.\-'()&]+$/.test(s);
    const city = isLatin(rawCity) ? rawCity : (cityOverride ?? '');
    const country = countryOverride || find('country');
    const sublocal = find('sublocality_level_1') || find('neighborhood') || find('sublocality');
    const admin2 = find('administrative_area_level_2');
    const admin3 = find('administrative_area_level_3');
    // Use admin subdivisions as neighborhood fallback (e.g. Paris arrondissements, Tokyo wards, Istanbul districts)
    // Drop any value containing non-Latin script (Arabic, Chinese, Cyrillic, etc.) — Google ignores languageCode for some regions
    const rawNeighborhood = sublocal || [admin3, admin2].find(v => v && v.toLowerCase() !== city.toLowerCase()) || '';
    const neighborhood = isLatin(rawNeighborhood) ? rawNeighborhood : '';
    const category = googleTypesToCategory(p.types ?? []);
    // Prefer index 1 (often a user photo) over index 0 (often a business promo/logo image)
    const photoName = (p.photos?.[1] ?? p.photos?.[0])?.name;
    const photoUrl = photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=600&key=${GOOGLE_PLACES_KEY}` : '';
    const name = p.displayName?.text ?? '';
    // Reject places whose name is not in Latin script
    if (!isLatin(name)) return null;
    return { id: p.id ?? `discover_${Math.random()}`, name, category, neighborhood: neighborhood || null, city, country, photoUrl, position: 0, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null };
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
    experience:    { textQuery: 'best things to do activity',    includedType: 'tourist_attraction' },
    neighbourhood: { textQuery: 'best neighbourhood area to explore', includedType: 'tourist_attraction' },
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
            body: JSON.stringify({ textQuery: query.trim(), languageCode: 'en' }),
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
              setDiscoverResults(all.filter(p => { const k = p.name.toLowerCase().slice(0, 30); if (!p.name || seenIds.has(p.id) || seenNames.has(k)) return false; seenIds.add(p.id); seenNames.add(k); return true; }));
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
              setDiscoverResults(interleaved.filter(p => { const k = p.name.toLowerCase().slice(0, 30); if (!p.name || seenIds.has(p.id) || seenNames.has(k)) return false; seenIds.add(p.id); seenNames.add(k); return true; }));
            }
          } else {
            setDiscoverTextToken(data.nextPageToken ?? null);
            setDiscoverResults((raw.slice(0, 10).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[]).filter(p => p.name));
          }
        } else if (hasCategoryFilter) {
          // Category chip path — parallel queries across multiple world cities for global variety
          setDiscoverCityPage(0);
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const { textQuery: chipQuery, includedType } = chipCfg;
          const cities = WORLD_CITIES.slice(0, 6);
          const results = await Promise.all(cities.map(city =>
            fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST', headers: HEADERS,
              body: JSON.stringify({ textQuery: `${chipQuery} ${city}`, includedType, minRating: 3.8, languageCode: 'en' }),
            }).then(r => r.json()).then(d => byRating(d.places ?? []).slice(0, 3).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[]).catch(() => [])
          ));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r[i]) interleaved.push(r[i]); });
          const seenIds = new Set<string>(); const seenNames = new Set<string>();
          setDiscoverResults(interleaved.filter(p => {
            const nameKey = p.name.toLowerCase().slice(0, 30);
            if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
            seenIds.add(p.id); seenNames.add(nameKey); return true;
          }));
        } else {
          // Default "For You" — city-specific queries rotated through world cities
          setDiscoverCityPage(0);
          const cityOffset = 0;
          const results = await Promise.all(DEFAULT_CATEGORY_SEARCHES.map(({ textQuery, includedType }, i) => {
            const city = WORLD_CITIES[(cityOffset * DEFAULT_CATEGORY_SEARCHES.length + i) % WORLD_CITIES.length];
            return fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST', headers: HEADERS,
              body: JSON.stringify({ textQuery: `${textQuery} ${city}`, includedType, minRating: 3.8, languageCode: 'en' }),
            }).then(r => r.json()).then(d => ({ places: byRating(d.places ?? []).slice(0, 5).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[], token: d.nextPageToken ?? null })).catch(() => ({ places: [], token: null }));
          }));
          setDiscoverDefaultTokens(results.map(r => r.token));
          const interleaved: RealPostPlace[] = [];
          const maxLen = Math.max(...results.map(r => r.places.length));
          for (let i = 0; i < maxLen; i++) results.forEach(r => { if (r.places[i]) interleaved.push(r.places[i]); });
          const seenIds = new Set<string>(); const seenNames = new Set<string>();
          setDiscoverResults(interleaved.filter(p => {
            const nameKey = p.name.toLowerCase().slice(0, 30);
            if (!p.name || seenIds.has(p.id) || seenNames.has(nameKey)) return false;
            seenIds.add(p.id); seenNames.add(nameKey); return true;
          }));
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
          // Category chip — next 6 cities for this category
          const chipCfg = categoryChipSearchConfig[activeCategory] ?? { textQuery: 'popular place', includedType: 'tourist_attraction' };
          const { textQuery: chipQuery, includedType } = chipCfg;
          const cityStart = (nextPage * 6) % WORLD_CITIES.length;
          const cities = [...WORLD_CITIES.slice(cityStart, cityStart + 6), ...WORLD_CITIES.slice(0, Math.max(0, cityStart + 6 - WORLD_CITIES.length))].slice(0, 6);
          const results = await Promise.all(cities.map(city =>
            fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST', headers: HEADERS,
              body: JSON.stringify({ textQuery: `${chipQuery} ${city}`, includedType, minRating: 3.8, languageCode: 'en' }),
            }).then(r => r.json()).then(d => byRating(d.places ?? []).slice(0, 3).map((p: any) => mapPlace(p)).filter(Boolean) as RealPostPlace[]).catch(() => [])
          ));
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

  const tabFiltered = activeTab === 'Following'
    ? allPlaces.filter(p => following.has(p.post.userId))
    : allPlaces;

  const categoryFiltered = activeCategory === 'all'
    ? tabFiltered
    : tabFiltered.filter(p => p.category === activeCategory);

  const filteredDiscover = activeCategory === 'all'
    ? discoverResults
    : discoverResults.filter(p => p.category === activeCategory);

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

  const filtered = query
    ? categoryFiltered.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.city.toLowerCase().includes(query.toLowerCase()) ||
        p.post.profile.name.toLowerCase().includes(query.toLowerCase()) ||
        p.post.profile.username.toLowerCase().includes(query.toLowerCase())
      )
    : categoryFiltered;

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
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-3 border-b border-gray-100">
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
        <div className="flex gap-5 mb-3">
          {(['For You', 'Following', 'Guides'] as FeedTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === tab ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
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
      {activeTab !== 'Guides' && (
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
                    {activeTab === 'Following' && query.trim().length < 2 && activeCategory === 'all'
                      ? 'No places from people you follow'
                      : query.trim().length >= 2 || activeCategory !== 'all'
                      ? 'No places found'
                      : 'No places yet'}
                  </p>
                  <p className="text-xs text-gray-400 max-w-[200px]">
                    {activeTab === 'Following' && query.trim().length < 2 && activeCategory === 'all'
                      ? 'Follow more people to see their places here'
                      : query.trim().length >= 2 || activeCategory !== 'all'
                      ? 'Try a different search term'
                      : 'Be the first to share a place on curio'}
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

      {/* Guides list */}
      {activeTab === 'Guides' && (
        <div className="p-3 space-y-3">
          {loadingGuides ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
            ))
          ) : guides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-3xl mb-3">📖</p>
              <p className="text-sm font-semibold text-gray-900 mb-1">No guides yet</p>
              <p className="text-xs text-gray-400 max-w-[200px]">Publish a trip from your Saved tab to create a guide</p>
            </div>
          ) : (
            guides.map(guide => (
              <button
                key={guide.id}
                onClick={() => setSelectedGuide(guide)}
                className="w-full rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-[0.98] transition-transform"
              >
                {guide.coverUrl ? (
                  <div className="relative h-40">
                    <img src={guide.coverUrl} alt={guide.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-base font-bold leading-tight">{guide.title}</p>
                      {guide.destination && (
                        <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
                          <MapPin size={10} strokeWidth={1.5} />
                          {guide.destination}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-24 bg-gray-200 flex items-center justify-center">
                    <p className="text-4xl">🗺️</p>
                  </div>
                )}
                <div className="px-3 py-2.5 flex items-center gap-2">
                  {guide.profile.avatarUrl
                    ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-500">{guide.profile.name[0]?.toUpperCase()}</div>
                  }
                  <p className="text-xs text-gray-600 font-medium truncate">by @{guide.profile.username}</p>
                </div>
              </button>
            ))
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
      {selectedGuide && <GuideDetail guide={selectedGuide} currentUserId={appUser?.id} onClose={() => setSelectedGuide(null)} />}

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
  return (
    <button onClick={onClick} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-95 transition-transform">
      {place.photoUrl ? (
        <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
          <span className="text-slate-400 text-xs">No photo</span>
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
  return (
    <button onClick={onClick} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 text-left active:scale-95 transition-transform">
      {place.photoUrl ? (
        <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
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
      <div className="w-full overflow-y-auto" style={{ maxWidth: '384px', maxHeight: '96vh' }} onClick={e => e.stopPropagation()}>
        <div className="bg-white w-full rounded-t-[2rem]">

          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="w-9 h-1 bg-white/70 rounded-full" />
          </div>

          {/* Photo carousel — scrolls with the rest */}
          <div className="relative overflow-hidden rounded-t-[2rem]">

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
            {/* Close button — top right */}
            <button
              onClick={onClose}
              className="absolute top-4 right-3 z-20 w-8 h-8 bg-black/55 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <X size={15} strokeWidth={2.5} className="text-white" />
            </button>

            {/* Swipeable photos */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {uniquePlaces.map((pl) => (
                <div key={pl.id} className="flex-shrink-0 w-full" style={{ aspectRatio: '3/4' }}>
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
                <p className="text-white font-semibold text-xs leading-tight truncate">{uniquePlaces[currentIndex]?.name.split(',')[0].trim()}</p>
                <p className="text-white/70 text-[10px] mt-0.5 truncate">
                  {[resolveCity(uniquePlaces[currentIndex]?.city), uniquePlaces[currentIndex]?.country].filter(Boolean).join(', ')}
                </p>
              </div>
              {uniquePlaces.length > 1 && (
                <div className="flex gap-1.5 items-center flex-shrink-0 pointer-events-auto pb-0.5">
                  {uniquePlaces.length <= 5
                    ? uniquePlaces.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollTo(i)}
                          className={`rounded-full transition-all duration-200 ${i === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                        />
                      ))
                    : <span className="text-white text-[11px] font-semibold bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 leading-none">
                        {currentIndex + 1} / {uniquePlaces.length}
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
              <div className="px-5 pb-5">
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
