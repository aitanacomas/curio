import { useState, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { googleTypesToCategory, extractNeighborhood } from '../lib/placeUtils';

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

export default function PlaceSearch({ onSelect, placeholder = 'Search for this place…' }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ placeId: string; mainText: string; secondaryText: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
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
              mainText: s.placePrediction?.structuredFormat?.mainText?.text ?? s.placePrediction?.text?.text ?? '',
              secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
            }))
            .filter((s: any) => s.placeId)
            .slice(0, 5)
        );
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 400);
  };

  const handleSelect = async (placeId: string, mainText: string, secondaryText: string) => {
    setQuery(mainText);
    setSuggestions([]);
    setLoading(true);
    try {
      const fullText = secondaryText ? `${mainText}, ${secondaryText}` : mainText;
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.addressComponents,places.location,places.formattedAddress',
        },
        body: JSON.stringify({ textQuery: fullText, languageCode: 'en' }),
      });
      const data = await res.json();
      const place = data.places?.find((p: any) => p.id === placeId) ?? data.places?.[0];
      if (!place) throw new Error('no result');

      const name = shortName(place.displayName?.text ?? mainText);
      const types: string[] = place.types ?? [];
      const category = googleTypesToCategory(types);
      const comps: { types: string[]; longText?: string; shortText?: string }[] = place.addressComponents ?? [];
      const compVal = (c: typeof comps[0]) => c.longText || c.shortText || '';
      const find = (...t: string[]) => { const c = comps.find(c => t.some(x => c.types?.includes(x))); return c ? compVal(c) : ''; };
      const city = find('postal_town') || find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1');
      const country = find('country');
      const neighborhood = extractNeighborhood(comps, place.formattedAddress, city);
      const lat: number | undefined = place.location?.latitude;
      const lng: number | undefined = place.location?.longitude;
      const address: string | undefined = place.formattedAddress;
      onSelect({ name, category, neighborhood, city, country, lat, lng, address, placeId: place.id ?? placeId });
    } catch {
      // Fallback: parse what we can from the autocomplete text
      const parts = secondaryText.split(',').map((s: string) => s.trim()).filter(Boolean);
      const country = parts[parts.length - 1] ?? '';
      // Skip state/province codes (e.g. "WA", "CA") to get city
      const maybeState = parts[parts.length - 2] ?? '';
      const city = /^[A-Z]{1,3}$/.test(maybeState)
        ? (parts[parts.length - 3] ?? '')
        : maybeState;
      onSelect({ name: mainText, category: '', neighborhood: '', city, country });
    }
    setLoading(false);
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
        {(searching || loading) && <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />}
      </div>
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          {suggestions.map(s => (
            <button
              key={s.placeId}
              onClick={() => handleSelect(s.placeId, s.mainText, s.secondaryText)}
              className="w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 active:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-900">{s.mainText}</p>
              {s.secondaryText && <p className="text-xs text-gray-400 mt-0.5">{s.secondaryText}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
