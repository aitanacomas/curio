// One-time script: backfill neighborhood + city for post_places rows missing them
// Run with: node scripts/backfill-neighborhoods.mjs

const SUPABASE_URL = 'https://leooulgankktjapregei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_byPxk92XCaVuWKbmOObd2w_lG304vRd';
const GOOGLE_KEY   = 'AIzaSyAj0eDf6_qT-suH_6wiJlvb9AJ_4zd8KyM';

function parseAddressComponents(comps) {
  let neighborhood = '', city = '', country = '';
  let hasPostalTown = false;
  for (const comp of comps) {
    const t = comp.types ?? [];
    const text = comp.longText ?? comp.long_name ?? '';
    if (t.includes('sublocality_level_1') || (!neighborhood && (t.includes('sublocality_level_2') || t.includes('sublocality') || t.includes('neighborhood'))))
      neighborhood = text;
    if (t.includes('postal_town')) { city = text; hasPostalTown = true; }
    else if (!hasPostalTown && t.includes('locality')) city = text;
    else if (!city && t.includes('administrative_area_level_2')) city = text;
    if (t.includes('country')) country = text;
  }
  return { neighborhood, city, country };
}

async function lookupPlace(name, contextCity) {
  // Build the most specific query we can
  const query = contextCity ? `${name}, ${contextCity}` : name;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.addressComponents',
      'Referer': 'https://curio-travel-app.vercel.app',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
  });
  const data = await res.json();
  if (data.error) { console.log('  API error:', data.error.message); return null; }
  const place = data.places?.[0];
  if (!place) return null;
  return parseAddressComponents(place.addressComponents ?? []);
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.headers.get('content-type')?.includes('json') ? res.json() : null;
}

async function main() {
  // Fetch post_places missing city or neighborhood, joining with posts to get location_label for context
  const rows = await supabaseFetch(
    `post_places?select=id,name,city,country,neighborhood,post_id,posts(location_label)&or=(city.is.null,city.eq.,neighborhood.is.null,neighborhood.eq.)&limit=100`
  );

  console.log(`Found ${rows.length} rows to backfill\n`);

  for (const row of rows) {
    // Extract city context from the post's location_label (e.g. "Chinatown Gate · London" → "London")
    const locationLabel = row.posts?.location_label ?? '';
    const afterDot = locationLabel.split('·').pop()?.trim() ?? '';
    const contextCity = row.city || afterDot || '';

    console.log(`Looking up: "${row.name}" (context: "${contextCity}")`);

    let result = await lookupPlace(row.name, contextCity);

    // If no result with context, try without
    if (!result && contextCity) {
      result = await lookupPlace(row.name, '');
    }

    if (!result) {
      console.log(`  ⚠️  No result found\n`);
      continue;
    }

    console.log(`  → neighborhood: "${result.neighborhood}", city: "${result.city}", country: "${result.country}"`);

    const update = {};
    if (result.neighborhood && !row.neighborhood) update.neighborhood = result.neighborhood;
    if (result.city && !row.city)                 update.city = result.city;
    if (result.country && !row.country)           update.country = result.country;

    if (Object.keys(update).length === 0) {
      console.log(`  ✓ Nothing to update\n`);
      continue;
    }

    await supabaseFetch(`post_places?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
    console.log(`  ✓ Updated: ${JSON.stringify(update)}\n`);

    await new Promise(r => setTimeout(r, 250));
  }

  // Also rebuild location_label on affected posts
  console.log('Rebuilding location labels...');
  const postIds = [...new Set(rows.map(r => r.post_id))];
  for (const postId of postIds) {
    const places = await supabaseFetch(
      `post_places?select=name,city,neighborhood&post_id=eq.${postId}&order=position`
    );
    if (!places?.length) continue;
    const first = places[0];
    const locationLabel = places.length === 1
      ? `${first.name} · ${first.city}`
      : `${first.name} +${places.length - 1} · ${first.city}`;
    await supabaseFetch(`posts?id=eq.${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ location_label: locationLabel }),
    });
    console.log(`  ✓ Updated post ${postId}: "${locationLabel}"`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
