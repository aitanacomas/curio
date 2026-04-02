// One-time backfill script: enrich all post_places rows missing neighborhood, city, or category
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://leooulgankktjapregei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_byPxk92XCaVuWKbmOObd2w_lG304vRd';
const GOOGLE_KEY = 'AIzaSyAj0eDf6_qT-suH_6wiJlvb9AJ_4zd8KyM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Normalize common city shorthand that Google Places doesn't understand
function normalizeCity(city) {
  const map = {
    'cdmx': 'Mexico City',
    'ciudad de mexico': 'Mexico City',
    'ciudad de méxico': 'Mexico City',
    'nyc': 'New York City',
    'la': 'Los Angeles',
    'sf': 'San Francisco',
    'dc': 'Washington DC',
    'uk': '',   // country, not city
    'usa': '',  // country, not city
  };
  return map[city?.toLowerCase?.() ?? ''] ?? city;
}

async function searchPlace(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.addressComponents,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
  });
  const data = await res.json();
  return data.places?.[0] ?? null;
}

async function main() {
  console.log('Fetching all post_places...');
  const { data: allPlaces, error } = await supabase
    .from('post_places')
    .select('id, name, city, country, neighborhood, category')
    .or('neighborhood.is.null,city.is.null,category.is.null');

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  if (!allPlaces || allPlaces.length === 0) { console.log('All places already enriched! Nothing to do.'); return; }

  console.log(`Found ${allPlaces.length} places to enrich...`);

  let fixed = 0;
  let skipped = 0;

  for (const pl of allPlaces) {
    if (!pl.name) { skipped++; continue; }
    try {
      const normalCity = normalizeCity(pl.city);
      // Try multiple query strategies until one works
      let place = null;
      const queries = [
        [pl.name, normalCity, pl.country].filter(Boolean).join(', '),
        [pl.name, pl.country].filter(Boolean).join(', '),
        pl.name,
      ];
      for (const query of queries) {
        place = await searchPlace(query);
        if (place) { console.log(`  → found via: "${query}"`); break; }
      }
      if (!place) { console.log(`  ⚠ No result for: ${pl.name}`); skipped++; continue; }

      const comps = place.addressComponents ?? [];
      const types = place.types ?? [];
      const find = (...t) => comps.find(c => t.some(x => c.types?.includes(x)))?.longText ?? '';
      const hasPostalTown = comps.some(c => c.types?.includes('postal_town'));
      const neighborhood = find('sublocality_level_1') || find('sublocality_level_2') || find('neighborhood') || find('sublocality');
      const city = find('postal_town') || (!hasPostalTown ? find('locality') : '') || find('administrative_area_level_2');
      const country = find('country');
      const category = googleTypesToCategory(types);

      const update = {};
      if (!pl.neighborhood && neighborhood) update.neighborhood = neighborhood;
      if (!pl.city && city) update.city = city;
      if (!pl.category && category) update.category = category;
      // Always update country if missing
      if (!pl.country && country) update.country = country;

      if (Object.keys(update).length === 0) { skipped++; continue; }

      const { error: updateErr } = await supabase.from('post_places').update(update).eq('id', pl.id);
      if (updateErr) {
        console.log(`  ✗ Failed to update ${pl.name}: ${updateErr.message}`);
      } else {
        console.log(`  ✓ ${pl.name} → ${neighborhood || '—'}, ${city || pl.city || '—'} [${category}]`);
        fixed++;
      }
    } catch (e) {
      console.log(`  ✗ Error for ${pl.name}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}`);
}

main();
