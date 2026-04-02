// Full backfill: neighborhood + city for ALL post_places and plan_items
// Fixes rows that are null, empty, or have only a bare city (no comma = no district)
// Outputs SQL — paste into Supabase SQL Editor
// Run with: node scripts/backfill-all-neighborhoods.mjs

const SUPABASE_URL = 'https://leooulgankktjapregei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_byPxk92XCaVuWKbmOObd2w_lG304vRd';
const GOOGLE_KEY   = 'AIzaSyAj0eDf6_qT-suH_6wiJlvb9AJ_4zd8KyM';

// Known manual overrides where Google doesn't return sublocality
const MANUAL = {
  'chinatown gate':          { neighborhood: 'Soho',      city: 'London' },
  'piccadilly circus':       { neighborhood: 'West End',  city: 'London' },
  "the queen's walk":        { neighborhood: 'South Bank',city: 'London' },
  'regent street':           { neighborhood: 'Mayfair',   city: 'London' },
  'chiltern st':             { neighborhood: 'Marylebone',city: 'London' },
  'chiltern street':         { neighborhood: 'Marylebone',city: 'London' },
  'southbank centre winter market': { neighborhood: 'South Bank', city: 'London' },
};

function parseAddressComponents(comps) {
  let neighborhood = '', city = '', country = '', hasPostalTown = false;
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

async function lookup(name, city, country) {
  const key = name.toLowerCase().trim();
  if (MANUAL[key]) return { ...MANUAL[key], country: country || '' };

  const query = [name, city, country].filter(Boolean).join(', ');
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

function needsEnrichment(neighborhood, city) {
  if (!neighborhood && !city) return true;
  if (!neighborhood) return true;
  // Only a bare city stored (no comma = no district)
  if (neighborhood && !neighborhood.includes(',') && neighborhood === city) return true;
  // Has neighborhood but no city
  if (neighborhood && !city) return true;
  return false;
}

// plan_items store combined "neighbourhood, city" in one field
function planItemNeedsEnrichment(neighborhood) {
  if (!neighborhood) return true;
  // No comma means just a city or just a district — not the full "District, City" format
  if (!neighborhood.includes(',')) return true;
  return false;
}

async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const sql = [];

  // ── 1. post_places ─────────────────────────────────────────────────────────
  console.log('Fetching all post_places...');
  const postPlaces = await supabaseFetch(
    'post_places?select=id,name,city,country,neighborhood&limit=1000'
  );
  console.log(`  ${postPlaces.length} rows\n`);

  for (const row of postPlaces) {
    const shortName = row.name?.split(',')[0]?.trim() ?? '';
    if (!shortName) continue;

    if (!needsEnrichment(row.neighborhood, row.city)) {
      console.log(`✓ "${shortName}" — already has "${row.neighborhood}, ${row.city}"`);
      continue;
    }

    console.log(`Looking up post_place: "${shortName}" (neighborhood="${row.neighborhood}", city="${row.city}")`);
    const result = await lookup(shortName, row.city, row.country);
    await new Promise(r => setTimeout(r, 250));

    if (!result) { console.log('  ⚠️  No result\n'); continue; }

    const newNeighborhood = result.neighborhood || row.neighborhood || '';
    const newCity         = result.city         || row.city         || '';
    const newCountry      = result.country       || row.country      || '';

    console.log(`  → neighborhood="${newNeighborhood}", city="${newCity}"`);

    const sets = [];
    if (newNeighborhood && newNeighborhood !== row.neighborhood) sets.push(`neighborhood = '${newNeighborhood.replace(/'/g, "''")}'`);
    if (newCity         && newCity         !== row.city)         sets.push(`city = '${newCity.replace(/'/g, "''")}'`);
    if (newCountry      && newCountry      !== row.country)      sets.push(`country = '${newCountry.replace(/'/g, "''")}'`);

    if (sets.length) {
      sql.push(`UPDATE post_places SET ${sets.join(', ')} WHERE id = '${row.id}'; -- ${shortName}`);
      console.log(`  ✓ Will update\n`);
    } else {
      console.log(`  ✓ Nothing new\n`);
    }
  }

  // ── 2. plan_items ──────────────────────────────────────────────────────────
  console.log('\nFetching all plan_items...');
  let planItems = [];
  try {
    planItems = await supabaseFetch(
      'plan_items?select=id,name,neighborhood,address&limit=1000'
    );
    console.log(`  ${planItems.length} rows\n`);
  } catch (e) {
    console.log(`  ⚠️  Could not fetch plan_items (RLS): ${e.message}\n`);
  }

  for (const row of planItems) {
    const shortName = row.name?.split(',')[0]?.trim() ?? '';
    if (!shortName) continue;

    if (!planItemNeedsEnrichment(row.neighborhood)) {
      console.log(`✓ "${shortName}" — already has "${row.neighborhood}"`);
      continue;
    }

    // Extract city from address string
    const addrParts = (row.address ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const cityFromAddr = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : '';
    const countryFromAddr = addrParts.length >= 1 ? addrParts[addrParts.length - 1] : '';
    const existingCity = row.neighborhood?.includes(',') ? row.neighborhood.split(',').pop()?.trim() : row.neighborhood;

    console.log(`Looking up plan_item: "${shortName}" (neighborhood="${row.neighborhood}", city="${existingCity || cityFromAddr}")`);
    const result = await lookup(shortName, existingCity || cityFromAddr, countryFromAddr);
    await new Promise(r => setTimeout(r, 250));

    if (!result) { console.log('  ⚠️  No result\n'); continue; }

    let combined = '';
    if (result.neighborhood && result.city && result.neighborhood !== result.city) {
      combined = `${result.neighborhood}, ${result.city}`;
    } else if (result.neighborhood) {
      combined = result.neighborhood;
    } else if (result.city) {
      combined = result.city;
    }

    console.log(`  → combined="${combined}"`);

    if (combined && combined !== row.neighborhood) {
      sql.push(`UPDATE plan_items SET neighborhood = '${combined.replace(/'/g, "''")}' WHERE id = '${row.id}'; -- ${shortName}`);
      console.log(`  ✓ Will update\n`);
    } else {
      console.log(`  ✓ Nothing new\n`);
    }
  }

  // ── Output ─────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log(`  ${sql.length} rows need updating`);
  console.log('════════════════════════════════════════════════════\n');

  if (sql.length === 0) {
    console.log('✅ Everything is already correct!');
    return;
  }

  console.log('── SQL for Supabase SQL Editor ──────────────────────\n');
  console.log(sql.join('\n'));
  console.log('\n─────────────────────────────────────────────────────');
  console.log('✅ Copy the SQL above and run it in Supabase SQL Editor.');
}

main().catch(console.error);
