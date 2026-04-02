// Backfill categories for all post_places and plan_items using Google Places API
// Outputs SQL UPDATE statements — paste them into Supabase SQL Editor to apply
// Run with: node scripts/backfill-categories.mjs

const SUPABASE_URL = 'https://leooulgankktjapregei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_byPxk92XCaVuWKbmOObd2w_lG304vRd';
const GOOGLE_KEY   = 'AIzaSyAj0eDf6_qT-suH_6wiJlvb9AJ_4zd8KyM';

function googleTypesToCategory(types) {
  const has = (...t) => types.some(x => t.includes(x));
  if (has('lodging','hotel','motel','resort_hotel','hostel','bed_and_breakfast','extended_stay_hotel','guest_house','inn')) return 'hotel';
  if (has('restaurant','american_restaurant','barbecue_restaurant','brazilian_restaurant','breakfast_restaurant','brunch_restaurant','buffet_restaurant','chinese_restaurant','french_restaurant','greek_restaurant','indian_restaurant','indonesian_restaurant','italian_restaurant','japanese_restaurant','korean_restaurant','lebanese_restaurant','mediterranean_restaurant','mexican_restaurant','middle_eastern_restaurant','pizza_restaurant','ramen_restaurant','seafood_restaurant','spanish_restaurant','steak_house','sushi_restaurant','thai_restaurant','turkish_restaurant','vegan_restaurant','vegetarian_restaurant','vietnamese_restaurant')) return 'restaurant';
  if (has('cafe','coffee_shop','bakery','bagel_shop','tea_house','patisserie','dessert_shop','ice_cream_shop')) return 'cafe';
  if (has('bar','night_club','wine_bar','cocktail_bar','sports_bar','pub','brewery','winery','distillery','karaoke')) return 'bar';
  if (has('food_court','fast_food_restaurant','meal_takeaway','meal_delivery','sandwich_shop','hamburger_restaurant','supermarket','grocery_store','convenience_store','deli','food_delivery')) return 'food';
  if (has('airport','train_station','bus_station','subway_station','transit_station','light_rail_station','ferry_terminal','taxi_stand','car_rental','bus_stop','airport_terminal')) return 'transport';
  if (has('beach','marina','diving_center','water_park')) return 'beach';
  if (has('park','national_park','natural_feature','campground','hiking_area','rv_park','forest','nature_reserve','botanical_garden','wildlife_sanctuary')) return 'nature';
  if (has('stadium','sports_complex','gym','fitness_center','bowling_alley','golf_course','tennis_court','swimming_pool','ski_resort','rock_climbing_gym','cycling_studio','sports_club','athletic_field','race_track')) return 'sports';
  if (has('spa','beauty_salon','hair_salon','hair_care','nail_salon','physiotherapist','massage','yoga_studio','sauna','wellness_center','massage_therapist')) return 'wellness';
  if (has('store','shopping_mall','clothing_store','book_store','department_store','bicycle_store','electronics_store','furniture_store','home_goods_store','jewelry_store','shoe_store','pet_store','florist','gift_shop','market','liquor_store','toy_store','sporting_goods_store','pharmacy')) return 'shop';
  if (has('route','street_address','intersection')) return 'street';
  if (has('event_venue','banquet_hall','convention_center','conference_center','wedding_venue','concert_hall')) return 'event';
  if (has('airline')) return 'flight';
  if (has('museum','art_gallery','tourist_attraction','landmark','historical_landmark','cultural_landmark','monument','amusement_park','zoo','aquarium','movie_theater','performing_arts_theater','library','church','mosque','synagogue','hindu_temple','place_of_worship','embassy','city_hall','university','castle','ruins')) return 'attraction';
  return 'experience';
}

async function lookupTypes(name, city, country) {
  const query = [name, city, country].filter(Boolean).join(', ');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.types',
      'Referer': 'https://curio-travel-app.vercel.app',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
  });
  const data = await res.json();
  if (data.error) { console.log('  API error:', data.error.message); return null; }
  const place = data.places?.[0];
  return place?.types ?? null;
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
  const sqlUpdates = [];

  // ── 1. post_places ──────────────────────────────────────────────────────────
  console.log('Fetching all post_places...');
  const postPlaces = await supabaseFetch(
    `post_places?select=id,name,city,country,category&limit=1000`
  );
  console.log(`  ${postPlaces.length} rows found\n`);

  for (const row of postPlaces) {
    const shortName = row.name?.split(',')[0]?.trim() ?? row.name;
    console.log(`post_places: "${shortName}" (current: ${row.category ?? 'null'}, city: ${row.city ?? '—'})`);

    const types = await lookupTypes(shortName, row.city, row.country);
    if (!types) {
      console.log('  ⚠️  No result\n');
      await new Promise(r => setTimeout(r, 250));
      continue;
    }

    const newCategory = googleTypesToCategory(types);
    console.log(`  types: [${types.slice(0, 4).join(', ')}...]`);
    console.log(`  ${row.category} → ${newCategory}`);

    if (newCategory !== row.category) {
      sqlUpdates.push(`UPDATE post_places SET category = '${newCategory}' WHERE id = '${row.id}';`);
      console.log(`  ✓ Will update\n`);
    } else {
      console.log(`  ✓ Already correct\n`);
    }

    await new Promise(r => setTimeout(r, 250));
  }

  // ── 2. plan_items ────────────────────────────────────────────────────────────
  console.log('\nFetching all plan_items...');
  const planItems = await supabaseFetch(
    `plan_items?select=id,name,category,address,neighborhood&limit=1000`
  );
  console.log(`  ${planItems.length} rows found\n`);

  for (const row of planItems) {
    const shortName = row.name?.split(',')[0]?.trim() ?? row.name;
    // Extract city from address if available (e.g. "123 Main St, London, UK" → "London")
    const addressParts = (row.address ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : '';
    const country = addressParts.length >= 1 ? addressParts[addressParts.length - 1] : '';

    console.log(`plan_items: "${shortName}" (current: ${row.category ?? 'null'}, city: ${city || '—'})`);

    const types = await lookupTypes(shortName, city, country);
    if (!types) {
      console.log('  ⚠️  No result\n');
      await new Promise(r => setTimeout(r, 250));
      continue;
    }

    const newCategory = googleTypesToCategory(types);
    console.log(`  types: [${types.slice(0, 4).join(', ')}...]`);
    console.log(`  ${row.category} → ${newCategory}`);

    if (newCategory !== row.category) {
      sqlUpdates.push(`UPDATE plan_items SET category = '${newCategory}' WHERE id = '${row.id}';`);
      console.log(`  ✓ Will update\n`);
    } else {
      console.log(`  ✓ Already correct\n`);
    }

    await new Promise(r => setTimeout(r, 250));
  }

  // ── Output SQL ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log(`  ${sqlUpdates.length} rows need updating`);
  console.log('════════════════════════════════════════════════════\n');

  if (sqlUpdates.length === 0) {
    console.log('✅ All categories are already correct!');
    return;
  }

  console.log('── SQL to run in Supabase SQL Editor ───────────────\n');
  console.log(sqlUpdates.join('\n'));
  console.log('\n────────────────────────────────────────────────────');
  console.log('✅ Copy the SQL above and run it in Supabase SQL Editor.');
}

main().catch(console.error);
