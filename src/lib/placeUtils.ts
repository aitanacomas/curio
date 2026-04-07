import type { Category } from '../types';

/**
 * Extract neighborhood/district/area from Google Places address data.
 * Works for any city worldwide — arrondissements, wards, boroughs, barrios, etc.
 * Falls back to parsing formattedAddress when addressComponents lack sublocality data.
 */
export function extractNeighborhood(
  comps: { types: string[]; longText?: string; shortText?: string }[],
  formattedAddress?: string,
  city?: string
): string {
  const isLatin = (s: string) => /^[\u0000-\u024F\s,.\-'()&]+$/.test(s);
  const find = (...types: string[]) => {
    const c = comps.find(c => types.some(t => c.types?.includes(t)));
    return c ? (c.longText || c.shortText || '') : '';
  };
  const sublocal = find('sublocality_level_1') || find('neighborhood') || find('sublocality') || find('sublocality_level_2');
  const admin2 = find('administrative_area_level_2');
  const admin3 = find('administrative_area_level_3');
  // Reject non-Latin text (e.g. Amharic, Arabic script) and pure numbers (e.g. "4", "13" from Japanese ward IDs)
  const isUsable = (v: string) => isLatin(v) && !/^\d+$/.test(v.trim()) && v.trim().length > 1;
  const usableSublocal = isUsable(sublocal) ? sublocal : '';
  const raw = usableSublocal || [admin3, admin2].find(v => v && isUsable(v) && (!city || v.toLowerCase() !== city.toLowerCase())) || '';
  let neighborhood = raw ? raw : '';

  // Paris-specific: extract arrondissement from postal code (75001–75020)
  if (!neighborhood) {
    const postalCode = find('postal_code');
    if (postalCode && city && city.toLowerCase().includes('paris')) {
      const m = postalCode.match(/^750(\d{2})$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num >= 1 && num <= 20) {
          const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
          neighborhood = `${num}${suffix} Arr.`;
        }
      }
    }
  }

  // Fallback: parse formattedAddress — works for every city/naming convention worldwide
  if (!neighborhood && formattedAddress) {
    const parts = formattedAddress.split(',').map(s => s.trim()).filter(Boolean);
    const candidates = parts.slice(1, -2);
    for (const part of candidates) {
      // Strip leading digits (e.g. "75003 Paris" → "Paris")
      const stripped = part.replace(/^\d+\s*/, '').trim();
      let clean = stripped || part.replace(/\d+/g, '').trim();
      // Strip Japanese chōme address prefix (e.g. "6-chōme-4 Iidabashi" → "Iidabashi")
      const chomeStripped = clean.replace(/^[-\d\s]*ch[oō]me[-\d\s]*/i, '').trim();
      if (chomeStripped) clean = chomeStripped;
      // Skip if starts with hyphen/digit (unresolved address fragment), non-Latin, too short/long, or equals city
      if (!clean || clean.startsWith('-') || /^\d/.test(clean)) continue;
      if (!isLatin(clean) || clean.length <= 2 || clean.length >= 40) continue;
      if (city && clean.toLowerCase() === city.toLowerCase()) continue;
      neighborhood = clean;
      break;
    }
  }
  return neighborhood;
}

const BOOKABLE_CATS = ['restaurant', 'cafe', 'bar', 'treats', 'food', 'nightlife', 'hotel', 'stay', 'experience', 'sports', 'wellness', 'landmark', 'art', 'nature', 'beach'];

export function isBookable(category: string): boolean {
  return BOOKABLE_CATS.includes(category.toLowerCase());
}

export function getBookingUrl(name: string, city: string, category: string): string {
  const q = encodeURIComponent(`${name} ${city}`.trim());
  const cat = category.toLowerCase();
  if (['restaurant', 'cafe', 'bar', 'treats', 'food', 'nightlife'].includes(cat))
    return `https://resy.com/cities/search?query=${q}`;
  if (['hotel', 'stay'].includes(cat))
    return `https://www.booking.com/search.html?ss=${q}`;
  if (['experience', 'sports', 'wellness', 'landmark', 'art', 'nature', 'beach'].includes(cat))
    return `https://www.viator.com/search/${encodeURIComponent(name)}`;
  return `https://www.google.com/maps/search/${q}`;
}

export function googleTypesToCategory(types: string[]): Category {
  const has = (...t: string[]) => types.some(x => t.includes(x));
  if (has('lodging','hotel','motel','resort_hotel','hostel','bed_and_breakfast','extended_stay_hotel','guest_house','inn')) return 'hotel';
  if (has('restaurant','american_restaurant','barbecue_restaurant','brazilian_restaurant','breakfast_restaurant','brunch_restaurant','buffet_restaurant','chinese_restaurant','french_restaurant','greek_restaurant','indian_restaurant','indonesian_restaurant','italian_restaurant','japanese_restaurant','korean_restaurant','lebanese_restaurant','mediterranean_restaurant','mexican_restaurant','middle_eastern_restaurant','pizza_restaurant','ramen_restaurant','seafood_restaurant','spanish_restaurant','steak_house','sushi_restaurant','thai_restaurant','turkish_restaurant','vegan_restaurant','vegetarian_restaurant','vietnamese_restaurant')) return 'restaurant';
  if (has('bakery','patisserie','dessert_shop','ice_cream_shop','bagel_shop')) return 'treats';
  if (has('cafe','coffee_shop','tea_house')) return 'cafe';
  if (has('night_club','karaoke')) return 'nightlife';
  if (has('bar','wine_bar','cocktail_bar','sports_bar','pub','brewery','winery','distillery')) return 'bar';
  if (has('food_court','fast_food_restaurant','meal_takeaway','meal_delivery','sandwich_shop','hamburger_restaurant','supermarket','grocery_store','convenience_store','deli','food_delivery')) return 'food';
  if (has('airport','train_station','bus_station','subway_station','transit_station','light_rail_station','ferry_terminal','taxi_stand','car_rental','bus_stop','airport_terminal')) return 'transport';
  if (has('beach','marina','diving_center','water_park')) return 'beach';
  if (has('park','national_park','natural_feature','campground','hiking_area','rv_park','forest','nature_reserve','botanical_garden','wildlife_sanctuary')) return 'nature';
  if (has('stadium','sports_complex','gym','fitness_center','bowling_alley','golf_course','tennis_court','swimming_pool','ski_resort','rock_climbing_gym','cycling_studio','sports_club','athletic_field','race_track')) return 'sports';
  if (has('spa','beauty_salon','hair_salon','hair_care','nail_salon','physiotherapist','massage','yoga_studio','sauna','wellness_center','massage_therapist')) return 'wellness';
  if (has('store','shopping_mall','clothing_store','book_store','department_store','bicycle_store','electronics_store','furniture_store','home_goods_store','jewelry_store','shoe_store','pet_store','florist','gift_shop','market','liquor_store','toy_store','sporting_goods_store','pharmacy')) return 'shop';
  if (has('route','street_address','intersection')) return 'neighbourhood';
  if (has('event_venue','banquet_hall','convention_center','conference_center','wedding_venue','concert_hall')) return 'event';
  if (has('airline')) return 'flight';
  if (has('art_gallery','museum')) return 'art';
  if (has('tourist_attraction','landmark','historical_landmark','cultural_landmark','monument','castle','ruins','church','mosque','synagogue','hindu_temple','place_of_worship','embassy','city_hall','university','library')) return 'landmark';
  if (has('amusement_park','zoo','aquarium','movie_theater','performing_arts_theater','concert_hall')) return 'experience';
  return 'experience';
}
