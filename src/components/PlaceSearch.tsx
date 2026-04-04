import { useState, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { googleTypesToCategory } from '../lib/placeUtils';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

const shortName = (name: string) => name.split(',')[0].trim();

export interface PlaceResult {
  name: string;
  category: string;
  neighborhood: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
  address?: string;
  photo?: string;
  placeId?: string;
}

interface Props {
  onSelect: (result: PlaceResult) => void;
  placeholder?: string;
}

interface Suggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

// Parse city and country from Google's secondaryText (e.g. "Broad Street, Seattle, WA, USA")
function parseCityCountry(secondary: string): { city: string; country: string } {
  const parts = secondary.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { city: '', country: '' };
  const country = parts[parts.length - 1];
  // If second-to-last looks like a state/province code (≤3 chars all uppercase), skip it
  const maybeCityIdx = parts.length >= 2 && /^[A-Z]{1,3}$/.test(parts[parts.length - 2])
    ? parts.length - 3
    : parts.length - 2;
  const city = maybeCityIdx >= 0 ? parts[maybeCityIdx] : '';
  return { city, country };
}

export default function PlaceSearch({ onSelect, placeholder = 'Search for this place…' }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY },
          body: JSON.stringify({ input: val, languageCode: 'en' }),
        });
        const data = await res.json();
        setSuggestions(
          (data.suggestions ?? [])
            .map((s: any) => ({
              placeId: s.placePrediction?.placeId ?? '',
              text: s.placePrediction?.text?.text ?? '',
              mainText: s.placePrediction?.structuredFormat?.mainText?.text ?? '',
              secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
              types: s.placePrediction?.types ?? [],
            }))
            .filter((s: Suggestion) => s.placeId)
            .slice(0, 5)
        );
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 400);
  };

  const handleSelect = async (s: Suggestion) => {
    const { placeId, text, mainText, secondaryText, types } = s;
    const name = mainText || text.split(',')[0].trim();
    setQuery(name);
    setSuggestions([]);

    // Immediately fill with data we already have from the autocomplete response
    const { city, country } = parseCityCountry(secondaryText);
    const category = googleTypesToCategory(types);
    onSelect({ name, category, neighborhood: '', city, country, placeId });

    // Then enrich with full details (neighborhood, lat/lng, address) via a second call
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.addressComponents,places.location,places.formattedAddress',
        },
        body: JSON.stringify({ textQuery: text, languageCode: 'en' }),
      });
      const data = await res.json();
      const place = data.places?.find((p: any) => p.id === placeId) ?? data.places?.[0];
      if (!place) return;
      const enrichedName = shortName(place.displayName?.text ?? name);
      const enrichedTypes: string[] = place.types ?? types;
      const enrichedCategory = googleTypesToCategory(enrichedTypes);
      const comps: { types: string[]; longText?: string; shortText?: string }[] = place.addressComponents ?? [];
      const compVal = (comp: typeof comps[0]) => comp.longText || comp.shortText || '';
      const find = (...t: string[]) => { const c = comps.find(c => t.some(x => c.types?.includes(x))); return c ? compVal(c) : ''; };
      const neighborhood =
        find('sublocality_level_1') ||
        find('sublocality_level_2') ||
        find('neighborhood') ||
        find('sublocality');
      const enrichedCity =
        find('postal_town') ||
        find('locality') ||
        find('administrative_area_level_2') ||
        find('administrative_area_level_1') ||
        city;
      const enrichedCountry = find('country') || country;
      const lat: number | undefined = place.location?.latitude;
      const lng: number | undefined = place.location?.longitude;
      const address: string | undefined = place.formattedAddress;
      onSelect({ name: enrichedName, category: enrichedCategory, neighborhood, city: enrichedCity, country: enrichedCountry, lat, lng, address, placeId: place.id ?? placeId });
    } catch { /* keep the initial fill from autocomplete data */ }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
        <Search size={13} className="text-gray-400 flex-shrink-0" />
        <input
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm text-gray-900 bg-transparent outline-none placeholder-gray-400"
        />
        {searching && <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />}
      </div>
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          {suggestions.map(s => (
            <button
              key={s.placeId}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-800 active:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              <span className="font-medium">{s.mainText || s.text.split(',')[0]}</span>
              {s.secondaryText && <span className="text-gray-400 ml-1">{s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
