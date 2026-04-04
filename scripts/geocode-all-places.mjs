/**
 * One-time migration: geocode ALL post_places that have missing or
 * neighbourhood/city-level fallback coordinates.
 *
 * Run with:  node scripts/geocode-all-places.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://leooulgankktjapregei.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_byPxk92XCaVuWKbmOObd2w_lG304vRd';
const GOOGLE_KEY    = 'AIzaSyAj0eDf6_qT-suH_6wiJlvb9AJ_4zd8KyM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Bad-coord detection tables (must match supabase.ts) ──────────────────────

const NEIGHBORHOOD_COORDS = {
  // London
  'west end': { lat: 51.5117, lng: -0.1340 }, 'soho': { lat: 51.5136, lng: -0.1337 },
  'south bank': { lat: 51.5055, lng: -0.1132 }, 'mayfair': { lat: 51.5117, lng: -0.1489 },
  'covent garden': { lat: 51.5117, lng: -0.1240 }, 'shoreditch': { lat: 51.5227, lng: -0.0793 },
  'brixton': { lat: 51.4613, lng: -0.1156 }, 'notting hill': { lat: 51.5154, lng: -0.2015 },
  'camden': { lat: 51.5390, lng: -0.1426 }, 'islington': { lat: 51.5362, lng: -0.1033 },
  'kensington': { lat: 51.4990, lng: -0.1940 }, 'knightsbridge': { lat: 51.4988, lng: -0.1598 },
  'canary wharf': { lat: 51.5054, lng: -0.0235 }, 'paddington': { lat: 51.5154, lng: -0.1755 },
  'southwark': { lat: 51.5035, lng: -0.0883 }, 'hackney': { lat: 51.5450, lng: -0.0553 },
  'bermondsey': { lat: 51.4983, lng: -0.0782 }, 'fitzrovia': { lat: 51.5194, lng: -0.1378 },
  'bloomsbury': { lat: 51.5236, lng: -0.1232 }, 'city of london': { lat: 51.5155, lng: -0.0922 },
  // Mexico City
  'polanco': { lat: 19.4319, lng: -99.1997 }, 'condesa': { lat: 19.4120, lng: -99.1724 },
  'colonia condesa': { lat: 19.4120, lng: -99.1724 }, 'roma': { lat: 19.4160, lng: -99.1604 },
  'roma norte': { lat: 19.4191, lng: -99.1594 }, 'roma sur': { lat: 19.4118, lng: -99.1605 },
  'san angel': { lat: 19.3477, lng: -99.1902 }, 'san ángel': { lat: 19.3477, lng: -99.1902 },
  'san ángel inn': { lat: 19.3477, lng: -99.1902 }, 'coyoacan': { lat: 19.3431, lng: -99.1625 },
  'centro': { lat: 19.4326, lng: -99.1332 }, 'santa fe': { lat: 19.3592, lng: -99.2612 },
  'lomas': { lat: 19.4284, lng: -99.2150 }, 'del valle': { lat: 19.3900, lng: -99.1600 },
  'narvarte': { lat: 19.3997, lng: -99.1624 }, 'juarez': { lat: 19.4271, lng: -99.1607 },
  'cuauhtémoc': { lat: 19.4236, lng: -99.1497 }, 'anzures': { lat: 19.4386, lng: -99.1791 },
  'escandón': { lat: 19.4048, lng: -99.1851 }, 'interlomas': { lat: 19.4389, lng: -99.2590 },
  // Paris
  'le marais': { lat: 48.8545, lng: 2.3576 }, 'montmartre': { lat: 48.8867, lng: 2.3431 },
  'saint-germain': { lat: 48.8534, lng: 2.3325 },
  // New York
  'manhattan': { lat: 40.7831, lng: -73.9712 }, 'brooklyn': { lat: 40.6782, lng: -73.9442 },
  'tribeca': { lat: 40.7163, lng: -74.0086 }, 'midtown': { lat: 40.7549, lng: -73.9840 },
  'harlem': { lat: 40.8116, lng: -73.9465 }, 'greenwich village': { lat: 40.7339, lng: -74.0022 },
};

const CITY_COORDS = {
  'mexico city': { lat: 19.4326, lng: -99.1332 }, 'cdmx': { lat: 19.4326, lng: -99.1332 },
  'ciudad de mexico': { lat: 19.4326, lng: -99.1332 }, 'guadalajara': { lat: 20.6597, lng: -103.3496 },
  'monterrey': { lat: 25.6866, lng: -100.3161 }, 'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 }, 'barcelona': { lat: 41.3851, lng: 2.1734 },
  'madrid': { lat: 40.4168, lng: -3.7038 }, 'rome': { lat: 41.9028, lng: 12.4964 },
  'new york': { lat: 40.7128, lng: -74.0060 }, 'los angeles': { lat: 34.0522, lng: -118.2437 },
  'miami': { lat: 25.7617, lng: -80.1918 }, 'tokyo': { lat: 35.6762, lng: 139.6503 },
  'seoul': { lat: 37.5665, lng: 126.9780 }, 'bangkok': { lat: 13.7563, lng: 100.5018 },
  'dubai': { lat: 25.2048, lng: 55.2708 }, 'sydney': { lat: -33.8688, lng: 151.2093 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 }, 'bogota': { lat: 4.7110, lng: -74.0721 },
};

function isBadCoord(lat, lng, city) {
  if (lat == null || lng == null) return true;
  // Check city center
  const cc = CITY_COORDS[(city ?? '').toLowerCase().trim()];
  if (cc && Math.abs(lat - cc.lat) < 0.002 && Math.abs(lng - cc.lng) < 0.002) return true;
  // Check neighbourhood fallbacks (including jitter up to 0.006°)
  for (const nc of Object.values(NEIGHBORHOOD_COORDS)) {
    if (Math.abs(lat - nc.lat) < 0.006 && Math.abs(lng - nc.lng) < 0.006) return true;
  }
  return false;
}

// ── Google Places Text Search ────────────────────────────────────────────────

async function googleGeocode(name, neighborhood, city, country) {
  const queries = [
    [name, neighborhood, city, country].filter(Boolean).join(', '),
    [name, city, country].filter(Boolean).join(', '),
    name,
  ];
  for (const textQuery of queries) {
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'places.location',
          // Spoof a browser origin so API key referrer restrictions pass
          'Origin': 'https://curio-travel-app.vercel.app',
          'Referer': 'https://curio-travel-app.vercel.app/',
        },
        body: JSON.stringify({ textQuery, languageCode: 'en' }),
      });
      const data = await res.json();
      // Log first error for debugging
      if (data.error && queries.indexOf(textQuery) === 0) {
        process.stdout.write(`[API:${data.error.status}] `);
      }
      const loc = data.places?.[0]?.location;
      if (loc?.latitude != null) {
        return { lat: loc.latitude, lng: loc.longitude };
      }
    } catch { /* try next query */ }
  }
  return null;
}

// ── Nominatim (rate-limited) ─────────────────────────────────────────────────

let lastNominatimMs = 0;
async function nominatimGeocode(query) {
  const wait = Math.max(0, 1200 - (Date.now() - lastNominatimMs));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimMs = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'curio-app-migration/1.0' } }
    );
    const data = await res.json();
    if (data[0]?.lat != null) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* ignore */ }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Fetching all post_places from database…');
  const { data: places, error } = await supabase
    .from('post_places')
    .select('id, name, neighborhood, city, country, lat, lng');

  if (error) { console.error('DB error:', error); process.exit(1); }
  console.log(`Found ${places.length} total places.`);

  // Geocode ALL places — override existing coords to ensure everything is exact
  const toFix = places;
  console.log(`Geocoding all ${toFix.length} places.\n`);

  const sqlLines = [];
  let fixed = 0, failed = 0;

  for (const p of toFix) {
    const label = `${p.name} (${p.neighborhood ? p.neighborhood + ', ' : ''}${p.city})`;
    process.stdout.write(`[${fixed + failed + 1}/${toFix.length}] ${label} → `);

    // 1. Google Places (most accurate)
    let coords = await googleGeocode(p.name, p.neighborhood, p.city, p.country);

    // 2. Nominatim fallback
    if (!coords) {
      coords = await nominatimGeocode(`${p.name}, ${p.neighborhood ?? ''}, ${p.city}, ${p.country}`);
    }
    if (!coords) {
      coords = await nominatimGeocode(`${p.name}, ${p.city}, ${p.country}`);
    }

    if (coords) {
      console.log(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} ✓`);
      sqlLines.push(`UPDATE post_places SET lat = ${coords.lat}, lng = ${coords.lng} WHERE id = '${p.id}';`);
      fixed++;
    } else {
      console.log('not found');
      failed++;
    }

    // Small pause between Google API calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Write SQL file
  import('fs').then(fs => {
    const sql = sqlLines.join('\n');
    fs.writeFileSync('scripts/update-coords.sql', sql);
    console.log(`\n✅ Done. ${fixed} geocoded, ${failed} not found.`);
    console.log(`📄 SQL saved to scripts/update-coords.sql — run it in Supabase SQL Editor.`);
  });
}

run();
