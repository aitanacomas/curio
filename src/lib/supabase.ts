import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RealPostPlace {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  city: string;
  country: string;
  photoUrl: string;
  position: number;
  lat?: number | null;
  lng?: number | null;
  addedBy?: string | null;
  addedByName?: string | null;
  addedByAvatar?: string | null;
}

export interface RealPost {
  id: string;
  userId: string;
  caption: string;
  locationLabel: string;
  createdAt: string;
  hashtags: string[];
  profile: {
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  places: RealPostPlace[];
  collaborators?: { id: string; name: string; username: string; avatarUrl: string | null }[];
}

// ── helpers ──────────────────────────────────────────────────────────────────
export async function getProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ── Feed posts (public, newest first) ────────────────────────────────────────
export async function getFeedPosts(): Promise<RealPost[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      user_id,
      caption,
      location_label,
      created_at,
      hashtags,
      profiles ( name, username, avatar_url ),
      post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )
    `)
    .eq('visibility', 'feed')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !posts) return [];

  // Fetch accepted collaborators for all feed posts
  const allPostIds = posts.map((p: any) => p.id);
  const { data: collabs } = allPostIds.length > 0 ? await supabase
    .from('post_collaborators')
    .select('post_id, user_id, profiles!user_id(name, username, avatar_url)')
    .in('post_id', allPostIds)
    .eq('status', 'accepted') : { data: [] };

  const collabsByPost: Record<string, { id: string; name: string; username: string; avatarUrl: string | null }[]> = {};
  for (const c of (collabs ?? [])) {
    const pid = (c as any).post_id;
    const cUserId = (c as any).user_id;
    if (!collabsByPost[pid]) collabsByPost[pid] = [];
    collabsByPost[pid].push({
      id: cUserId,
      name: (c as any).profiles?.name ?? '',
      username: (c as any).profiles?.username ?? '',
      avatarUrl: (c as any).profiles?.avatar_url ?? null,
    });
  }

  return posts.map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    caption: p.caption ?? '',
    locationLabel: p.location_label ?? '',
    createdAt: p.created_at,
    hashtags: p.hashtags ?? [],
    profile: {
      name: p.profiles?.name ?? 'Unknown',
      username: p.profiles?.username ?? '',
      avatarUrl: p.profiles?.avatar_url ?? null,
    },
    collaborators: collabsByPost[p.id] ?? [],
    places: (p.post_places ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((pl: any) => ({
        id: pl.id,
        name: pl.name ?? '',
        category: pl.category ?? '',
        neighborhood: pl.neighborhood ?? '',
        city: pl.city ?? '',
        country: pl.country ?? '',
        photoUrl: pl.photo_url ?? '',
        position: pl.position ?? 0,
        lat: pl.lat ?? null,
        lng: pl.lng ?? null,
      })),
  }));
}

// ── People discovery ─────────────────────────────────────────────────────────
export interface DiscoverProfile {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  phoneDiscoverable: boolean;
  referredBy: string | null;
}

export async function getDiscoverProfiles(currentUserId: string): Promise<DiscoverProfile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url, email, phone, phone_discoverable, referred_by')
    .neq('id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!data) return [];
  return data.map((p: any) => ({
    id: p.id,
    name: p.name ?? '',
    username: p.username ?? '',
    avatarUrl: p.avatar_url ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    phoneDiscoverable: p.phone_discoverable ?? false,
    referredBy: p.referred_by ?? null,
  }));
}

export async function getFollowing(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  return new Set((data ?? []).map((r: any) => r.following_id));
}

export async function followUser(followerId: string, followingId: string) {
  await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
}

export async function unfollowUser(followerId: string, followingId: string) {
  await supabase.from('follows').delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
}

export interface FollowProfile {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export async function getFollowerProfiles(userId: string): Promise<FollowProfile[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower:profiles!follower_id ( id, name, username, avatar_url )')
    .eq('following_id', userId);
  return (data ?? []).map((r: any) => ({
    id: r.follower.id,
    name: r.follower.name ?? '',
    username: r.follower.username ?? '',
    avatarUrl: r.follower.avatar_url ?? null,
  }));
}

export async function getFollowingProfiles(userId: string): Promise<FollowProfile[]> {
  const { data } = await supabase
    .from('follows')
    .select('following:profiles!following_id ( id, name, username, avatar_url )')
    .eq('follower_id', userId);
  return (data ?? []).map((r: any) => ({
    id: r.following.id,
    name: r.following.name ?? '',
    username: r.following.username ?? '',
    avatarUrl: r.following.avatar_url ?? null,
  }));
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

// ── Update profile ────────────────────────────────────────────────────────────
export async function updateProfile(userId: string, updates: { name?: string; username?: string; bio?: string; location?: string; avatar_url?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id');
  if (error) {
    console.error('[updateProfile] error:', error.message, error.details);
    return error;
  }
  if (!data || data.length === 0) {
    console.error('[updateProfile] 0 rows updated — RLS may be blocking this. userId:', userId);
    // Return a synthetic error so the UI shows a message
    return { message: 'Profile could not be saved. Check Supabase RLS policies on the profiles table.', details: '', hint: '', code: 'PGRST116' } as any;
  }
  console.log('[updateProfile] success, rows updated:', data.length);
  return null;
}

// ── Posts by a single user ────────────────────────────────────────────────────
export async function getUserPosts(userId: string): Promise<RealPost[]> {
  const selectFields = `
    id, user_id, caption, location_label, created_at, hashtags,
    profiles ( name, username, avatar_url ),
    post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )
  `;

  // Own posts + posts where user is a collaborator (any status — no acceptance flow exists yet)
  const [{ data: ownedPosts }, { data: collabRows }] = await Promise.all([
    supabase.from('posts').select(selectFields).eq('user_id', userId).order('position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    supabase.from('post_collaborators').select('post_id').eq('user_id', userId).in('status', ['accepted', 'pending']),
  ]);

  const collabPostIds = (collabRows ?? []).map((r: any) => r.post_id);
  let collabPosts: any[] = [];
  if (collabPostIds.length > 0) {
    const { data } = await supabase.from('posts').select(selectFields).in('id', collabPostIds).order('created_at', { ascending: false });
    collabPosts = data ?? [];
  }

  const allPosts = [...(ownedPosts ?? []), ...collabPosts];
  if (allPosts.length === 0) return [];

  // Fetch accepted collaborators for all posts to display avatars
  const allPostIds = allPosts.map((p: any) => p.id);
  const { data: collabs } = await supabase
    .from('post_collaborators')
    .select('post_id, user_id, profiles!user_id(name, username, avatar_url)')
    .in('post_id', allPostIds)
    .in('status', ['accepted', 'pending']);

  const ownPostIds = new Set((ownedPosts ?? []).map((p: any) => p.id));

  const collabsByPost: Record<string, { id: string; name: string; username: string; avatarUrl: string | null }[]> = {};
  for (const c of (collabs ?? [])) {
    const pid = (c as any).post_id;
    const cUserId = (c as any).user_id;
    // Skip the current user — they appear as the primary avatar in the pill
    if (cUserId === userId) continue;
    if (!collabsByPost[pid]) collabsByPost[pid] = [];
    collabsByPost[pid].push({
      id: cUserId,
      name: (c as any).profiles?.name ?? '',
      username: (c as any).profiles?.username ?? '',
      avatarUrl: (c as any).profiles?.avatar_url ?? null,
    });
  }

  return allPosts.map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    caption: p.caption ?? '',
    locationLabel: p.location_label ?? '',
    createdAt: p.created_at,
    hashtags: p.hashtags ?? [],
    profile: {
      name: p.profiles?.name ?? 'Unknown',
      username: p.profiles?.username ?? '',
      avatarUrl: p.profiles?.avatar_url ?? null,
    },
    collaborators: collabsByPost[p.id] ?? [],
    places: (p.post_places ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((pl: any) => ({
        id: pl.id,
        name: pl.name ?? '',
        category: pl.category ?? '',
        neighborhood: pl.neighborhood ?? '',
        city: pl.city ?? '',
        country: pl.country ?? '',
        photoUrl: pl.photo_url ?? '',
        position: pl.position ?? 0,
        lat: pl.lat ?? null,
        lng: pl.lng ?? null,
      })),
  }));
}

// ── Collections ───────────────────────────────────────────────────────────────
export interface RealCollection {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  description: string;
  coverImageUrl: string | null;
  placesCount: number;
  createdAt: string;
}

export async function getUserCollections(userId: string): Promise<RealCollection[]> {
  const { data } = await supabase
    .from('user_collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (!data) return [];

  // Try to get place counts — table may not exist yet
  const ids = data.map((r: any) => r.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: cp } = await supabase
      .from('collection_places')
      .select('collection_id')
      .in('collection_id', ids);
    for (const r of cp ?? []) counts[(r as any).collection_id] = (counts[(r as any).collection_id] ?? 0) + 1;
  }

  return data.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name ?? '',
    emoji: r.emoji ?? '',
    description: r.description ?? '',
    coverImageUrl: r.cover_image_url ?? null,
    placesCount: counts[r.id] ?? 0,
    createdAt: r.created_at,
  }));
}

// ── Collection Places ─────────────────────────────────────────────────────────
export async function getCollectionPlaces(collectionId: string): Promise<RealPostPlace[]> {
  // Try with added_by + profile join first; fall back to simple query if column doesn't exist
  const { data, error } = await supabase
    .from('collection_places')
    .select('added_by, profiles!added_by ( name, avatar_url ), post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )')
    .eq('collection_id', collectionId);

  if (error) {
    // Column or relationship missing — fall back to simple query without added_by
    const { data: fallback } = await supabase
      .from('collection_places')
      .select('post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )')
      .eq('collection_id', collectionId);
    return (fallback ?? [])
      .filter((r: any) => r.post_places)
      .map((r: any) => ({
        id: r.post_places.id,
        name: r.post_places.name ?? '',
        category: r.post_places.category ?? '',
        neighborhood: r.post_places.neighborhood ?? '',
        city: r.post_places.city ?? '',
        country: r.post_places.country ?? '',
        photoUrl: r.post_places.photo_url ?? '',
        position: r.post_places.position ?? 0,
        lat: r.post_places.lat ?? null,
        lng: r.post_places.lng ?? null,
        addedBy: null,
        addedByName: null,
        addedByAvatar: null,
      }));
  }

  return (data ?? [])
    .filter((r: any) => r.post_places)
    .map((r: any) => ({
      id: r.post_places.id,
      name: r.post_places.name ?? '',
      category: r.post_places.category ?? '',
      neighborhood: r.post_places.neighborhood ?? '',
      city: r.post_places.city ?? '',
      country: r.post_places.country ?? '',
      photoUrl: r.post_places.photo_url ?? '',
      position: r.post_places.position ?? 0,
      lat: r.post_places.lat ?? null,
      lng: r.post_places.lng ?? null,
      addedBy: r.added_by ?? null,
      addedByName: (r.profiles as any)?.name ?? null,
      addedByAvatar: (r.profiles as any)?.avatar_url ?? null,
    }));
}

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

/**
 * Scans all post_places rows where city is a 2-letter US state code and
 * updates them to the full state name directly in the database.
 * Call once on app start — safe to call multiple times (no-op when already fixed).
 */
export async function fixCityAbbreviationsInDB(): Promise<void> {
  // Fetch all post_places that have a 2-letter city (likely a state code)
  const { data } = await supabase
    .from('post_places')
    .select('id, city')
    .filter('city', 'neq', null);
  if (!data) return;
  const toFix = data.filter(row => /^[A-Z]{2}$/.test((row.city ?? '').trim()) && US_STATES[row.city.trim()]);
  if (toFix.length === 0) return;
  await Promise.all(
    toFix.map(row =>
      supabase.from('post_places').update({ city: US_STATES[row.city.trim()] }).eq('id', row.id)
    )
  );
}

// Module-level Nominatim rate limiter — enforces ≥1.1 s between ANY calls
let _lastNominatimMs = 0;

// Hardcoded neighborhood coords — precise areas so pins don't stack on city center
const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  // London areas
  'west end': { lat: 51.5117, lng: -0.1340 }, 'west end, london': { lat: 51.5117, lng: -0.1340 },
  'soho, london': { lat: 51.5136, lng: -0.1337 }, 'soho': { lat: 51.5136, lng: -0.1337 },
  'south bank': { lat: 51.5055, lng: -0.1132 }, 'south bank, london': { lat: 51.5055, lng: -0.1132 },
  'mayfair': { lat: 51.5117, lng: -0.1489 }, 'mayfair, london': { lat: 51.5117, lng: -0.1489 },
  'covent garden': { lat: 51.5117, lng: -0.1240 },
  'shoreditch': { lat: 51.5227, lng: -0.0793 }, 'brixton': { lat: 51.4613, lng: -0.1156 },
  'notting hill': { lat: 51.5154, lng: -0.2015 }, 'chelsea, london': { lat: 51.4875, lng: -0.1687 },
  'camden': { lat: 51.5390, lng: -0.1426 }, 'islington': { lat: 51.5362, lng: -0.1033 },
  'kensington': { lat: 51.4990, lng: -0.1940 }, 'knightsbridge': { lat: 51.4988, lng: -0.1598 },
  'canary wharf': { lat: 51.5054, lng: -0.0235 }, 'paddington': { lat: 51.5154, lng: -0.1755 },
  'southwark': { lat: 51.5035, lng: -0.0883 }, 'waterloo, london': { lat: 51.5031, lng: -0.1132 },
  'victoria, london': { lat: 51.4965, lng: -0.1447 }, 'hackney': { lat: 51.5450, lng: -0.0553 },
  'greenwich, london': { lat: 51.4769, lng: 0.0031 }, 'bermondsey': { lat: 51.4983, lng: -0.0782 },
  'fitzrovia': { lat: 51.5194, lng: -0.1378 }, 'bloomsbury': { lat: 51.5236, lng: -0.1232 },
  'city of london': { lat: 51.5155, lng: -0.0922 }, 'tower bridge': { lat: 51.5055, lng: -0.0754 },
  'east london': { lat: 51.5280, lng: -0.0560 }, 'north london': { lat: 51.5600, lng: -0.1200 },
  // Mexico City areas
  'polanco': { lat: 19.4319, lng: -99.1997 }, 'polanco iv sección': { lat: 19.4319, lng: -99.1997 },
  'polanco iv seccion': { lat: 19.4319, lng: -99.1997 }, 'polanco, cdmx': { lat: 19.4319, lng: -99.1997 },
  'condesa': { lat: 19.4120, lng: -99.1724 }, 'colonia condesa': { lat: 19.4120, lng: -99.1724 },
  'condesa, cdmx': { lat: 19.4120, lng: -99.1724 },
  'roma': { lat: 19.4160, lng: -99.1604 }, 'colonia roma': { lat: 19.4160, lng: -99.1604 },
  'roma norte': { lat: 19.4191, lng: -99.1594 }, 'roma sur': { lat: 19.4118, lng: -99.1605 },
  'roma, cdmx': { lat: 19.4160, lng: -99.1604 },
  'san angel': { lat: 19.3477, lng: -99.1902 }, 'san ángel': { lat: 19.3477, lng: -99.1902 },
  'san ángel inn': { lat: 19.3477, lng: -99.1902 }, 'san angel inn': { lat: 19.3477, lng: -99.1902 },
  'coyoacan': { lat: 19.3431, lng: -99.1625 }, 'coyoacán': { lat: 19.3431, lng: -99.1625 },
  'centro historico': { lat: 19.4336, lng: -99.1394 }, 'centro histórico': { lat: 19.4336, lng: -99.1394 },
  'centro': { lat: 19.4326, lng: -99.1332 },
  'santa fe': { lat: 19.3592, lng: -99.2612 }, 'lomas': { lat: 19.4284, lng: -99.2150 },
  'del valle': { lat: 19.3900, lng: -99.1600 }, 'narvarte': { lat: 19.3997, lng: -99.1624 },
  'juarez': { lat: 19.4271, lng: -99.1607 }, 'cuauhtémoc': { lat: 19.4236, lng: -99.1497 },
  'cuauhtemoc': { lat: 19.4236, lng: -99.1497 }, 'anzures': { lat: 19.4386, lng: -99.1791 },
  'escandón': { lat: 19.4048, lng: -99.1851 }, 'escandon': { lat: 19.4048, lng: -99.1851 },
  'tepito': { lat: 19.4468, lng: -99.1222 }, 'xochimilco': { lat: 19.2630, lng: -99.1019 },
  'tlalpan': { lat: 19.2975, lng: -99.1617 }, 'pedregal': { lat: 19.3347, lng: -99.1935 },
  'interlomas': { lat: 19.4389, lng: -99.2590 }, 'santa fe, cdmx': { lat: 19.3592, lng: -99.2612 },
  // Paris areas
  'le marais': { lat: 48.8545, lng: 2.3576 }, 'marais': { lat: 48.8545, lng: 2.3576 },
  'montmartre': { lat: 48.8867, lng: 2.3431 }, 'saint-germain': { lat: 48.8534, lng: 2.3325 },
  'latin quarter': { lat: 48.8514, lng: 2.3500 }, 'bastille': { lat: 48.8533, lng: 2.3692 },
  // New York areas
  'manhattan': { lat: 40.7831, lng: -73.9712 }, 'brooklyn': { lat: 40.6782, lng: -73.9442 },
  'williamsburg, new york': { lat: 40.7081, lng: -73.9571 },
  'soho, new york': { lat: 40.7233, lng: -74.0030 },
  'tribeca': { lat: 40.7163, lng: -74.0086 }, 'midtown': { lat: 40.7549, lng: -73.9840 },
  'upper east side': { lat: 40.7736, lng: -73.9566 }, 'upper west side': { lat: 40.7870, lng: -73.9754 },
  'harlem': { lat: 40.8116, lng: -73.9465 }, 'greenwich village': { lat: 40.7339, lng: -74.0022 },
  'lower east side': { lat: 40.7157, lng: -73.9863 }, 'chelsea, new york': { lat: 40.7465, lng: -74.0014 },
  // Barcelona areas
  'el born': { lat: 41.3840, lng: 2.1821 }, 'eixample': { lat: 41.3927, lng: 2.1556 },
  'gracia': { lat: 41.4033, lng: 2.1566 }, 'gràcia': { lat: 41.4033, lng: 2.1566 },
  'raval': { lat: 41.3804, lng: 2.1685 }, 'el raval': { lat: 41.3804, lng: 2.1685 },
};

// Hardcoded city coords — instant fallback so every place always gets a pin
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Mexico
  'mexico city': { lat: 19.4326, lng: -99.1332 }, 'ciudad de mexico': { lat: 19.4326, lng: -99.1332 },
  'cdmx': { lat: 19.4326, lng: -99.1332 }, 'guadalajara': { lat: 20.6597, lng: -103.3496 },
  'monterrey': { lat: 25.6866, lng: -100.3161 }, 'oaxaca': { lat: 17.0732, lng: -96.7266 },
  'cancun': { lat: 21.1619, lng: -86.8515 }, 'tulum': { lat: 20.2114, lng: -87.4654 },
  // USA
  'new york': { lat: 40.7128, lng: -74.0060 }, 'los angeles': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 }, 'miami': { lat: 25.7617, lng: -80.1918 },
  'san francisco': { lat: 37.7749, lng: -122.4194 }, 'las vegas': { lat: 36.1699, lng: -115.1398 },
  'seattle': { lat: 47.6062, lng: -122.3321 }, 'boston': { lat: 42.3601, lng: -71.0589 },
  'arizona': { lat: 33.4484, lng: -112.0740 }, 'utah': { lat: 40.7608, lng: -111.8910 },
  'page': { lat: 36.9147, lng: -111.4558 }, 'sedona': { lat: 34.8697, lng: -111.7609 },
  // Europe
  'london': { lat: 51.5074, lng: -0.1278 }, 'paris': { lat: 48.8566, lng: 2.3522 },
  'barcelona': { lat: 41.3851, lng: 2.1734 }, 'madrid': { lat: 40.4168, lng: -3.7038 },
  'rome': { lat: 41.9028, lng: 12.4964 }, 'milan': { lat: 45.4642, lng: 9.1900 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 }, 'berlin': { lat: 52.5200, lng: 13.4050 },
  'lisbon': { lat: 38.7223, lng: -9.1393 }, 'athens': { lat: 37.9838, lng: 23.7275 },
  'vienna': { lat: 48.2082, lng: 16.3738 }, 'prague': { lat: 50.0755, lng: 14.4378 },
  // Asia
  'tokyo': { lat: 35.6762, lng: 139.6503 }, 'osaka': { lat: 34.6937, lng: 135.5023 },
  'seoul': { lat: 37.5665, lng: 126.9780 }, 'bangkok': { lat: 13.7563, lng: 100.5018 },
  'singapore': { lat: 1.3521, lng: 103.8198 }, 'hong kong': { lat: 22.3193, lng: 114.1694 },
  'bali': { lat: -8.3405, lng: 115.0920 }, 'jakarta': { lat: -6.2088, lng: 106.8456 },
  'dubai': { lat: 25.2048, lng: 55.2708 }, 'istanbul': { lat: 41.0082, lng: 28.9784 },
  // South America
  'buenos aires': { lat: -34.6037, lng: -58.3816 }, 'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 }, 'bogota': { lat: 4.7110, lng: -74.0721 },
  'lima': { lat: -12.0464, lng: -77.0428 }, 'cartagena': { lat: 10.3910, lng: -75.4794 },
  // Other
  'sydney': { lat: -33.8688, lng: 151.2093 }, 'melbourne': { lat: -37.8136, lng: 144.9631 },
  'toronto': { lat: 43.6532, lng: -79.3832 }, 'montreal': { lat: 45.5017, lng: -73.5673 },
  'cape town': { lat: -33.9249, lng: 18.4241 }, 'marrakech': { lat: 31.6295, lng: -7.9811 },
};

/** Apply a small spiral jitter to a base coordinate so stacked pins separate. */
function applyJitter(base: { lat: number; lng: number }, idx: number): { lat: number; lng: number } {
  if (idx === 0) return base;
  const angle = idx * 2.4; // golden-angle-ish spread
  const radius = 0.002 * (1 + Math.floor(idx / 8)); // grow ring every 8 pins
  return { lat: base.lat + radius * Math.sin(angle), lng: base.lng + radius * Math.cos(angle) };
}

/**
 * Look up neighborhood-level coords first (precise), then city-level.
 * jitterIdx spreads multiple places that fall back to the same area so they
 * don't stack on the exact same pixel.
 */
function areaFallback(
  neighborhood?: string,
  city?: string,
  country?: string,
  jitterIdx = 0,
): { lat: number; lng: number } | null {
  const n = (neighborhood ?? '').toLowerCase().trim();
  const c = (city ?? '').toLowerCase().trim();

  // Try "neighborhood, city" compound key first (avoids Soho London vs NY ambiguity)
  if (n && c) {
    const compound = `${n}, ${c}`;
    if (NEIGHBORHOOD_COORDS[compound]) return applyJitter(NEIGHBORHOOD_COORDS[compound], jitterIdx);
  }

  // Try neighborhood alone
  if (n && NEIGHBORHOOD_COORDS[n]) return applyJitter(NEIGHBORHOOD_COORDS[n], jitterIdx);

  // Try city with jitter
  if (c && CITY_COORDS[c]) return applyJitter(CITY_COORDS[c], jitterIdx);

  // Try country
  const ckey = (country ?? '').toLowerCase().trim();
  if (ckey && CITY_COORDS[ckey]) return applyJitter(CITY_COORDS[ckey], jitterIdx);

  return null;
}

/** Geocode any places missing lat/lng. onProgress fires after each place resolves. */
export async function geocodeMissingPlaces(
  places: RealPostPlace[],
  apiKey: string,
  onProgress?: (updated: RealPostPlace[]) => void
): Promise<RealPostPlace[]> {
  // Detect places whose stored coords are clearly a city-center fallback.
  // We use a TIGHT radius (0.001° ≈ 111m) so real restaurant coords that happen
  // to be near a neighborhood center are NOT incorrectly flagged.
  const isBadFallbackCoord = (pl: RealPostPlace) => {
    if (pl.lat == null || pl.lng == null) return false;
    const cityKey = (pl.city ?? '').toLowerCase().trim();
    const cc = CITY_COORDS[cityKey];
    return cc != null && Math.abs(pl.lat - cc.lat) < 0.001 && Math.abs(pl.lng - cc.lng) < 0.001;
  };
  const missing = places.filter(pl => pl.lat == null || pl.lng == null || isBadFallbackCoord(pl));
  if (missing.length === 0) return places;

  // Rate-limited Nominatim wrapper — enforces ≥1.1 s between any two calls globally
  const nominatimSearch = async (q: string) => {
    const wait = Math.max(0, 1100 - (Date.now() - _lastNominatimMs));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _lastNominatimMs = Date.now();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'curio-app/1.0' } }
      );
      const data = await res.json();
      if (data[0]?.lat != null) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch { /* ignore */ }
    return null;
  };

  // Track how many places fell back to each neighborhood/city key (for jitter)
  // Key = "neighborhood,city" so two places in the same neighborhood get different offsets
  const fallbackJitterCount: Record<string, number> = {};

  // Returns coords + whether they came from real geocoding (save to DB) vs fallback (don't save)
  const geocodeOne = async (pl: RealPostPlace): Promise<{ lat: number; lng: number; real: boolean }> => {
    // 1. Google Places Text Search — same call Add.tsx uses, single request, exact coords
    if (apiKey) {
      try {
        const queries = [
          `${pl.name}, ${pl.neighborhood}, ${pl.city}, ${pl.country}`,
          `${pl.name}, ${pl.city}, ${pl.country}`,
          pl.name,
        ];
        for (const textQuery of queries) {
          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.location',
            },
            body: JSON.stringify({ textQuery, languageCode: 'en' }),
          });
          const data = await res.json();
          const loc = data.places?.[0]?.location;
          if (loc?.latitude != null)
            return { lat: loc.latitude as number, lng: loc.longitude as number, real: true };
        }
      } catch { /* fall through */ }
    }

    // 2. Nominatim: name + neighborhood + city (most specific)
    const nom1 = await nominatimSearch(`${pl.name}, ${pl.neighborhood}, ${pl.city}, ${pl.country}`);
    if (nom1) return { ...nom1, real: true };

    // 3. Nominatim: name + city
    const nom2 = await nominatimSearch(`${pl.name}, ${pl.city}, ${pl.country}`);
    if (nom2) return { ...nom2, real: true };

    // 4. Nominatim: name only
    const nom3 = await nominatimSearch(pl.name);
    if (nom3) return { ...nom3, real: true };

    // 5. Hardcoded neighborhood → city fallback with jitter (NOT saved to DB)
    // Use "neighborhood,city" as key so two places in the same area get distinct offsets
    const n = (pl.neighborhood ?? '').toLowerCase().trim();
    const c = (pl.city ?? '').toLowerCase().trim();
    const fallbackKey = n ? `${n},${c}` : c;
    const jIdx = fallbackJitterCount[fallbackKey] ?? 0;
    fallbackJitterCount[fallbackKey] = jIdx + 1;
    const area = areaFallback(pl.neighborhood, pl.city, pl.country, jIdx);
    if (area) return { ...area, real: false };

    // 6. Absolute last resort
    return { lat: 0, lng: 0, real: false };
  };

  let current = [...places];
  for (const pl of missing) {
    const { real, ...coords } = await geocodeOne(pl);
    // Only persist real geocoded coords — fallbacks stay in-memory so next load retries
    if (real) supabase.from('post_places').update({ lat: coords.lat, lng: coords.lng }).eq('id', pl.id);
    // Clear city-center fallback coords from DB so next load retries them
    else if (isBadFallbackCoord(pl)) supabase.from('post_places').update({ lat: null, lng: null }).eq('id', pl.id);
    current = current.map(p => p.id === pl.id ? { ...p, ...coords } : p);
    onProgress?.(current);
  }
  return current;
}

export async function addPlaceToCollection(collectionId: string, postPlaceId: string, addedBy?: string) {
  const base = { collection_id: collectionId, post_place_id: postPlaceId };
  if (addedBy) {
    const { error } = await supabase.from('collection_places').insert({ ...base, added_by: addedBy });
    // If added_by column doesn't exist yet, fall back to insert without it
    if (error) await supabase.from('collection_places').insert(base);
  } else {
    await supabase.from('collection_places').insert(base);
  }
}

export async function removePlaceFromCollection(collectionId: string, postPlaceId: string) {
  await supabase.from('collection_places').delete()
    .eq('collection_id', collectionId)
    .eq('post_place_id', postPlaceId);
}

export async function getPlaceCollectionIds(postPlaceId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('collection_places')
    .select('collection_id')
    .eq('post_place_id', postPlaceId);
  return new Set((data ?? []).map((r: any) => r.collection_id));
}

// ── Taste Profile ─────────────────────────────────────────────────────────────
export interface TasteProfile {
  categoryWeights: Record<string, number>; // normalised 0-1
  topCategories: string[];                 // sorted by weight, max 5
  topCities: string[];                     // sorted by frequency, max 5
  totalSignals: number;                    // total saved places used as input
}

export async function buildTasteProfile(userId: string): Promise<TasteProfile> {
  // Fetch saved places (weight 2) and liked-post places (weight 1) in parallel
  const [savedPlaces, likedData] = await Promise.all([
    getSavedPlaces(userId),
    supabase
      .from('post_likes')
      .select('post_id, posts!post_id(post_places(category, city))')
      .eq('user_id', userId)
      .limit(100),
  ]);

  const categoryCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};

  for (const place of savedPlaces) {
    const cat = (place.category ?? '').toLowerCase();
    if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 2;
    if (place.city) cityCounts[place.city] = (cityCounts[place.city] ?? 0) + 2;
  }

  for (const row of ((likedData.data ?? []) as any[])) {
    const places: any[] = row.posts?.post_places ?? [];
    for (const pl of places) {
      const cat = (pl.category ?? '').toLowerCase();
      if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      if (pl.city) cityCounts[pl.city] = (cityCounts[pl.city] ?? 0) + 1;
    }
  }

  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const categoryWeights: Record<string, number> = {};
  for (const [cat, count] of Object.entries(categoryCounts)) {
    categoryWeights[cat] = total > 0 ? count / total : 0;
  }

  const topCategories = Object.entries(categoryWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat]) => cat);

  const topCities = Object.entries(cityCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([city]) => city);

  return { categoryWeights, topCategories, topCities, totalSignals: savedPlaces.length };
}

// ── Likes ─────────────────────────────────────────────────────────────────────
export async function getLikedPosts(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', userId);
  return new Set((data ?? []).map((r: any) => r.post_id));
}

export async function getPostLikeCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {};
  const { data } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);
  const counts: Record<string, number> = {};
  for (const id of postIds) counts[id] = 0;
  for (const r of data ?? []) counts[(r as any).post_id] = (counts[(r as any).post_id] ?? 0) + 1;
  return counts;
}

export async function likePost(userId: string, postId: string) {
  await supabase.from('post_likes').insert({ user_id: userId, post_id: postId });
}

export async function unlikePost(userId: string, postId: string) {
  await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
}

// ── Saves ─────────────────────────────────────────────────────────────────────
export async function getSavedPosts(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('post_saves').select('post_id').eq('user_id', userId);
  return new Set((data ?? []).map((r: any) => r.post_id));
}

export async function savePost(userId: string, postId: string) {
  await supabase.from('post_saves').insert({ user_id: userId, post_id: postId });
}

export async function unsavePost(userId: string, postId: string) {
  await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', postId);
}

export async function updateCollection(id: string, payload: { name?: string; description?: string; cover_image_url?: string | null }): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_collections').update(payload).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteCollection(id: string) {
  await supabase.from('user_collections').delete().eq('id', id);
}

export async function getCollectionById(id: string): Promise<(RealCollection & { ownerName: string; ownerUsername: string; ownerAvatarUrl: string | null }) | null> {
  const { data } = await supabase
    .from('user_collections')
    .select('*, profiles!user_id ( name, username, avatar_url )')
    .eq('id', id)
    .single();
  if (!data) return null;
  const { data: cp } = await supabase.from('collection_places').select('collection_id').eq('collection_id', id);
  return {
    id: data.id, userId: data.user_id, name: data.name ?? '', emoji: data.emoji ?? '',
    description: data.description ?? '', coverImageUrl: data.cover_image_url ?? null,
    placesCount: (cp ?? []).length, createdAt: data.created_at,
    ownerName: data.profiles?.name ?? '', ownerUsername: data.profiles?.username ?? '', ownerAvatarUrl: data.profiles?.avatar_url ?? null,
  };
}

export async function createCollection(userId: string, payload: { name: string; emoji: string; description: string; cover_image_url?: string | null }): Promise<{ data: RealCollection | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_collections')
    .insert({ user_id: userId, name: payload.name, emoji: payload.emoji, description: payload.description, cover_image_url: payload.cover_image_url ?? null })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return {
    data: { id: data.id, userId: data.user_id, name: data.name, emoji: data.emoji, description: data.description ?? '', coverImageUrl: data.cover_image_url ?? null, placesCount: 0, createdAt: data.created_at },
    error: null,
  };
}

// ── Collaborative collections ─────────────────────────────────────────────────
export interface CollectionCollaborator {
  id: string;
  collectionId: string;
  userId: string;
  invitedBy: string;
  createdAt: string;
  profile: { name: string; username: string; avatarUrl: string | null };
}

export async function getCollectionCollaborators(collectionId: string): Promise<CollectionCollaborator[]> {
  const { data } = await supabase
    .from('collection_collaborators')
    .select('id, collection_id, user_id, invited_by, created_at, profiles!user_id ( name, username, avatar_url )')
    .eq('collection_id', collectionId);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    collectionId: r.collection_id,
    userId: r.user_id,
    invitedBy: r.invited_by,
    createdAt: r.created_at,
    profile: { name: r.profiles?.name ?? '', username: r.profiles?.username ?? '', avatarUrl: r.profiles?.avatar_url ?? null },
  }));
}

export async function addCollaborator(collectionId: string, userId: string, invitedBy: string): Promise<string | null> {
  const { error } = await supabase.from('collection_collaborators').insert({ collection_id: collectionId, user_id: userId, invited_by: invitedBy });
  return error?.message ?? null;
}

export async function removeCollaborator(collectionId: string, userId: string) {
  await supabase.from('collection_collaborators').delete().eq('collection_id', collectionId).eq('user_id', userId);
}

export async function getSharedCollections(userId: string): Promise<RealCollection[]> {
  const { data } = await supabase
    .from('collection_collaborators')
    .select('collection_id, user_collections ( id, user_id, name, emoji, description, cover_image_url, created_at )')
    .eq('user_id', userId);
  if (!data) return [];
  const cols = (data ?? []).map((r: any) => r.user_collections).filter(Boolean);
  const ids = cols.map((c: any) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: cp } = await supabase.from('collection_places').select('collection_id').in('collection_id', ids);
    for (const r of cp ?? []) counts[(r as any).collection_id] = (counts[(r as any).collection_id] ?? 0) + 1;
  }
  return cols.map((c: any) => ({ id: c.id, userId: c.user_id, name: c.name ?? '', emoji: c.emoji ?? '', description: c.description ?? '', coverImageUrl: c.cover_image_url ?? null, placesCount: counts[c.id] ?? 0, createdAt: c.created_at }));
}

// ── Collection Subscriptions ──────────────────────────────────────────────────
export async function subscribeToCollection(userId: string, collectionId: string): Promise<void> {
  await supabase.from('collection_subscriptions').insert({ user_id: userId, collection_id: collectionId });
}

export async function unsubscribeFromCollection(userId: string, collectionId: string): Promise<void> {
  await supabase.from('collection_subscriptions').delete()
    .eq('user_id', userId)
    .eq('collection_id', collectionId);
}

export async function isSubscribedToCollection(userId: string, collectionId: string): Promise<boolean> {
  const { data } = await supabase.from('collection_subscriptions')
    .select('id').eq('user_id', userId).eq('collection_id', collectionId).maybeSingle();
  return !!data;
}

export async function getSubscribedCollections(userId: string): Promise<RealCollection[]> {
  const { data } = await supabase
    .from('collection_subscriptions')
    .select('collection_id, user_collections ( id, user_id, name, emoji, description, cover_image_url, created_at )')
    .eq('user_id', userId);
  if (!data) return [];
  const cols = (data ?? []).map((r: any) => r.user_collections).filter(Boolean);
  const ids = cols.map((c: any) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: cp } = await supabase.from('collection_places').select('collection_id').in('collection_id', ids);
    for (const r of cp ?? []) counts[(r as any).collection_id] = (counts[(r as any).collection_id] ?? 0) + 1;
  }
  return cols.map((c: any) => ({
    id: c.id, userId: c.user_id, name: c.name ?? '', emoji: c.emoji ?? '',
    description: c.description ?? '', coverImageUrl: c.cover_image_url ?? null,
    placesCount: counts[c.id] ?? 0, createdAt: c.created_at,
  }));
}

export async function deletePostPlace(postPlaceId: string) {
  await supabase.from('post_places').delete().eq('id', postPlaceId);
}

export async function deletePost(postId: string) {
  await supabase.from('posts').delete().eq('id', postId);
}

// ── Comments ──────────────────────────────────────────────────────────────────
export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
  profile: { name: string; username: string; avatarUrl: string | null };
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, post_id, user_id, text, created_at, profiles!user_id(name, username, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((c: any) => ({
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    text: c.text,
    createdAt: c.created_at,
    profile: { name: c.profiles?.name ?? '', username: c.profiles?.username ?? '', avatarUrl: c.profiles?.avatar_url ?? null },
  }));
}

export async function addComment(userId: string, postId: string, text: string): Promise<PostComment | null> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, text })
    .select('id, post_id, user_id, text, created_at, profiles!user_id(name, username, avatar_url)')
    .single();
  if (error || !data) { console.error('[addComment]', error?.message); return null; }
  return {
    id: data.id, postId: data.post_id, userId: data.user_id, text: data.text, createdAt: data.created_at,
    profile: { name: (data as any).profiles?.name ?? '', username: (data as any).profiles?.username ?? '', avatarUrl: (data as any).profiles?.avatar_url ?? null },
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('post_comments').delete().eq('id', commentId);
}

// ── Post Collaborators ────────────────────────────────────────────────────────
export interface PostCollaborator {
  id: string;
  postId: string;
  userId: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  profile: { name: string; username: string; avatarUrl: string | null };
}

export async function getPostCollaborators(postId: string): Promise<PostCollaborator[]> {
  const { data } = await supabase
    .from('post_collaborators')
    .select('id, post_id, user_id, invited_by, status, created_at, profiles!user_id(name, username, avatar_url)')
    .eq('post_id', postId);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    postId: r.post_id,
    userId: r.user_id,
    invitedBy: r.invited_by,
    status: r.status ?? 'pending',
    createdAt: r.created_at,
    profile: { name: r.profiles?.name ?? '', username: r.profiles?.username ?? '', avatarUrl: r.profiles?.avatar_url ?? null },
  }));
}

export async function addPostCollaborator(postId: string, userId: string, invitedBy: string): Promise<string | null> {
  const { error } = await supabase
    .from('post_collaborators')
    .insert({ post_id: postId, user_id: userId, invited_by: invitedBy, status: 'accepted' });
  return error?.message ?? null;
}

export async function removePostCollaborator(postId: string, userId: string): Promise<void> {
  await supabase.from('post_collaborators').delete().eq('post_id', postId).eq('user_id', userId);
}

export async function updatePostCollaboratorStatus(postId: string, userId: string, status: 'accepted' | 'declined'): Promise<void> {
  await supabase.from('post_collaborators').update({ status }).eq('post_id', postId).eq('user_id', userId);
}

export async function updatePostOrder(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) =>
    supabase.from('posts').update({ position: i }).eq('id', id)
  ));
}

export async function updatePostCaption(postId: string, caption: string, hashtags?: string[], locationLabel?: string) {
  const update: Record<string, unknown> = { caption };
  if (hashtags !== undefined) update.hashtags = hashtags;
  if (locationLabel !== undefined) update.location_label = locationLabel;
  const { error } = await supabase.from('posts').update(update).eq('id', postId);
  if (error) console.error('[updatePostCaption] error:', error.message, error.details);
}

export async function reorderPostPlaces(orderedIds: string[]) {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[reorderPostPlaces] user:', session?.user?.id ?? 'NO SESSION');
  const results = await Promise.all(orderedIds.map((id, i) =>
    supabase.from('post_places').update({ position: i }).eq('id', id).select('id, position')
  ));
  results.forEach(({ data, error }, i) => {
    if (error) console.error(`[reorderPostPlaces] id=${orderedIds[i]} pos=${i} error:`, error.message);
    else console.log(`[reorderPostPlaces] id=${orderedIds[i]} pos=${i} updated rows:`, data?.length ?? 0, data);
  });
}

export async function updatePostPlace(id: string, data: { name?: string; neighborhood?: string; city?: string; country?: string; category?: string }): Promise<void> {
  const { error, data: rows } = await supabase.from('post_places').update(data).eq('id', id).select();
  if (error) console.error('[updatePostPlace] error:', error.message, error.details, error.hint);
  else console.log('[updatePostPlace] updated rows:', rows?.length, 'id:', id, 'data:', data);
}

export async function searchProfiles(query: string, excludeId: string): Promise<FollowProfile[]> {
  if (!query.trim()) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .neq('id', excludeId)
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(10);
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.name ?? '', username: p.username ?? '', avatarUrl: p.avatar_url ?? null }));
}

// ── Plans ─────────────────────────────────────────────────────────────────────
export interface PlanCollaboratorProfile {
  id: string;
  name: string;
  avatar: string;
  pending?: boolean;
}

export interface PlanItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  timeLabel: string;
  timeEnd: string;
  notes: string;
  address: string;
  neighborhood: string;
  location: string;
  status: 'none' | 'pending' | 'booked';
  checkIn: string;
  checkOut: string;
  booked: boolean;
  position: number;
  lat?: number | null;
  lng?: number | null;
  addedBy?: string | null;
  addedByName?: string | null;
  addedByAvatar?: string | null;
}

export interface PlanDay {
  id: string;
  label: string;
  position: number;
  items: PlanItem[];
}

export interface Plan {
  id: string;
  userId: string;
  ownerName?: string | null;
  ownerAvatar?: string | null;
  title: string;
  country: string;
  dates: string;
  coverImageUrl: string;
  description: string;
  status: 'dreaming' | 'planning' | 'upcoming' | 'past';
  createdAt: string;
  days: PlanDay[];
  collaborators: PlanCollaboratorProfile[];
}

export type BookingType = 'flight' | 'stay' | 'restaurant' | 'activity';

export interface PlanBooking {
  id: string;
  planId: string;
  type: BookingType;
  title: string;
  confirmationNumber: string;
  notes: string;
  // Flight
  flightNumber: string;
  airline: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  // Stay
  checkInDate: string;
  checkOutDate: string;
  address: string;
  // Restaurant / Activity
  reservationDate: string;
  reservationTime: string;
  partySize: number | null;
  addedBy: string | null;
  createdAt: string;
}

export async function getPlans(userId: string): Promise<Plan[]> {
  // Fetch plans owned by user AND plans where user is an accepted collaborator
  const { data: collabRows } = await supabase
    .from('plan_collaborators')
    .select('plan_id')
    .eq('user_id', userId)
    .eq('status', 'accepted');

  const collabPlanIds = (collabRows ?? []).map((r: any) => r.plan_id);

  const { data: ownedPlans } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const ownedPlanIds = (ownedPlans ?? []).map((p: any) => p.id);

  // Fetch shared plans (not already owned) with owner profile
  const sharedIds = collabPlanIds.filter((id: string) => !ownedPlanIds.includes(id));
  const { data: sharedPlans } = sharedIds.length > 0
    ? await supabase.from('plans').select('*, profiles!user_id(name, avatar_url)').in('id', sharedIds).order('created_at', { ascending: false })
    : { data: [] };

  const plans = [...(ownedPlans ?? []), ...(sharedPlans ?? [])];
  if (plans.length === 0) return [];

  const planIds = plans.map((p: any) => p.id);

  const [{ data: days }, { data: items }, { data: collabs }] = await Promise.all([
    supabase.from('plan_days').select('*').in('plan_id', planIds).order('position'),
    supabase.from('plan_items').select('*, profiles!added_by(name, avatar_url)').in('plan_id', planIds).order('position'),
    supabase
      .from('plan_collaborators')
      .select('id, plan_id, user_id, status, profiles!user_id(name, avatar_url)')
      .in('plan_id', planIds),
  ]);

  return plans.map((p: any) => {
    const planDays = (days ?? [])
      .filter((d: any) => d.plan_id === p.id)
      .map((d: any) => ({
        id: d.id,
        label: d.label ?? '',
        position: d.position ?? 0,
        items: (items ?? [])
          .filter((i: any) => i.plan_day_id === d.id)
          .sort((a: any, b: any) => a.position - b.position)
          .map((i: any) => ({
            id: i.id,
            name: i.name ?? '',
            category: i.category ?? '',
            imageUrl: i.image_url ?? '',
            timeLabel: i.time_label ?? '',
            timeEnd: i.time_end ?? '',
            notes: i.notes ?? '',
            address: i.address ?? '',
            neighborhood: i.neighborhood ?? '',
            location: i.location ?? '',
            status: i.status ?? 'none',
            checkIn: i.check_in ?? '',
            checkOut: i.check_out ?? '',
            booked: i.booked ?? false,
            position: i.position ?? 0,
            lat: i.lat ?? null,
            lng: i.lng ?? null,
            addedBy: i.added_by ?? null,
            addedByName: (i.profiles as any)?.name ?? null,
            addedByAvatar: (i.profiles as any)?.avatar_url ?? null,
          })),
      }));

    const planCollabs = (collabs ?? [])
      .filter((c: any) => c.plan_id === p.id)
      .map((c: any) => ({
        id: c.user_id,
        name: (c.profiles as any)?.name ?? '',
        avatar: (c.profiles as any)?.avatar_url ?? '',
        pending: (c.status ?? 'pending') !== 'accepted',
      }));

    return {
      id: p.id,
      userId: p.user_id,
      ownerName: (p.profiles as any)?.name ?? null,
      ownerAvatar: (p.profiles as any)?.avatar_url ?? null,
      title: p.title ?? '',
      country: p.country ?? '',
      dates: p.dates ?? '',
      coverImageUrl: p.cover_image_url ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
      description: p.description ?? '',
      status: (p.status ?? 'dreaming') as Plan['status'],
      createdAt: p.created_at,
      days: planDays,
      collaborators: planCollabs,
    };
  });
}

export async function createPlan(
  userId: string,
  data: {
    title: string;
    country?: string;
    dates?: string;
    cover_image_url?: string;
    description?: string;
    status?: string;
  }
): Promise<Plan | null> {
  const { data: plan, error } = await supabase
    .from('plans')
    .insert({ user_id: userId, ...data })
    .select()
    .single();
  if (error || !plan) return null;
  return {
    id: plan.id,
    userId: plan.user_id,
    title: plan.title ?? '',
    country: plan.country ?? '',
    dates: plan.dates ?? '',
    coverImageUrl: plan.cover_image_url ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
    description: plan.description ?? '',
    status: (plan.status ?? 'dreaming') as Plan['status'],
    createdAt: plan.created_at,
    days: [],
    collaborators: [],
  };
}

export async function updatePlan(
  planId: string,
  data: Partial<{
    title: string;
    country: string;
    dates: string;
    cover_image_url: string;
    description: string;
    status: string;
  }>
) {
  await supabase
    .from('plans')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', planId);
}

export async function deletePlan(planId: string) {
  await supabase.from('plans').delete().eq('id', planId);
}

/** Sync the full collaborator list for a plan.
 *  Removes anyone no longer in the list and adds anyone new. */
export async function syncPlanCollaborators(
  planId: string,
  collaboratorIds: string[],
  invitedBy: string
): Promise<void> {
  // Fetch existing collaborators
  const { data: existing } = await supabase
    .from('plan_collaborators')
    .select('user_id')
    .eq('plan_id', planId);

  const existingIds = (existing ?? []).map((r: any) => r.user_id as string);

  // Remove collaborators no longer in the list
  const toRemove = existingIds.filter(id => !collaboratorIds.includes(id));
  if (toRemove.length > 0) {
    await supabase
      .from('plan_collaborators')
      .delete()
      .eq('plan_id', planId)
      .in('user_id', toRemove);
  }

  // Add new collaborators as pending
  const toAdd = collaboratorIds.filter(id => !existingIds.includes(id));
  if (toAdd.length > 0) {
    await supabase.from('plan_collaborators').insert(
      toAdd.map(userId => ({ plan_id: planId, user_id: userId, invited_by: invitedBy, status: 'pending' }))
    );
  }
}

export async function updatePlanCollaboratorStatus(
  planId: string,
  userId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  await supabase
    .from('plan_collaborators')
    .update({ status })
    .eq('plan_id', planId)
    .eq('user_id', userId);
}

export async function createPlanDay(planId: string, label: string, position: number): Promise<PlanDay | null> {
  const { data, error } = await supabase
    .from('plan_days')
    .insert({ plan_id: planId, label, position })
    .select()
    .single();
  if (error || !data) return null;
  return { id: data.id, label: data.label, position: data.position, items: [] };
}

export async function createPlanItem(
  planId: string,
  planDayId: string,
  data: { name: string; category: string; image_url: string; time_label: string; time_end?: string; notes?: string; address?: string; neighborhood?: string; status?: string; check_in?: string; check_out?: string; location?: string; position: number; added_by?: string; lat?: number | null; lng?: number | null }
): Promise<PlanItem | null> {
  const payload = { plan_id: planId, plan_day_id: planDayId, ...data };
  console.log('[createPlanItem] inserting:', { name: data.name, address: data.address, image_url: data.image_url?.slice(0, 60) });
  let { data: item, error } = await supabase
    .from('plan_items')
    .insert(payload)
    .select()
    .single();
  console.log('[createPlanItem] result — item.address:', item?.address, '| error:', error?.message);
  // Retry stripping only truly optional columns (status, check_in, check_out, time_end, location)
  // address, neighborhood, image_url, notes are confirmed columns — keep them
  if (error || !item) {
    console.error('[createPlanItem] initial insert error:', error?.message);
    const { status: _s, check_in: _ci, check_out: _co, time_end: _te, location: _loc, ...minimal } = payload as any;
    const retry = await supabase.from('plan_items').insert(minimal).select().single();
    if (retry.error) console.error('[createPlanItem] retry error:', retry.error.message);
    item = retry.data;
    error = retry.error;
  }
  if (error || !item) return null;
  return {
    id: item.id, name: item.name, category: item.category, imageUrl: item.image_url,
    timeLabel: item.time_label ?? '', timeEnd: item.time_end ?? '',
    notes: item.notes ?? '', address: item.address ?? '', neighborhood: item.neighborhood ?? '',
    location: item.location ?? '', status: item.status ?? 'none',
    checkIn: item.check_in ?? '', checkOut: item.check_out ?? '',
    booked: item.booked ?? false, position: item.position ?? 0,
    lat: item.lat ?? null, lng: item.lng ?? null,
  };
}

export async function updatePlanItem(
  itemId: string,
  data: Partial<{ name: string; category: string; image_url: string; time_label: string; time_end: string; notes: string; address: string; neighborhood: string; status: string; check_in: string; check_out: string; location: string; booked: boolean; plan_day_id: string }>
): Promise<boolean> {
  const { error } = await supabase.from('plan_items').update(data).eq('id', itemId);
  if (!error) return true;
  console.error('[updatePlanItem] error:', error.message, '| data keys:', Object.keys(data));
  // Retry without newer columns in case migration hasn't run yet
  const { address: _a, neighborhood: _nb, time_end: _te, location: _loc,
          notes: _n, status: _s, check_in: _ci, check_out: _co, ...minimal } = data as any;
  if (Object.keys(minimal).length === 0) return false;
  const { error: retryError } = await supabase.from('plan_items').update(minimal).eq('id', itemId);
  if (retryError) console.error('[updatePlanItem] retry error:', retryError.message);
  return !retryError;
}

export async function deletePlanDay(dayId: string) {
  await supabase.from('plan_days').delete().eq('id', dayId);
}

export async function updatePlanDay(dayId: string, data: { label?: string; position?: number }) {
  await supabase.from('plan_days').update(data).eq('id', dayId);
}

export async function deletePlanItem(itemId: string) {
  await supabase.from('plan_items').delete().eq('id', itemId);
}

// ── Item Invites ──────────────────────────────────────────────────────────────
export interface ItemInvite {
  id: string;
  planItemId: string;
  planId: string;
  invitedBy: string;
  invitedByName: string;
  invitedByAvatar: string;
  itemName: string;
  itemCategory: string;
  itemImageUrl: string;
  itemTime: string;
  itemTimeEnd: string;
  itemAddress: string;
  itemNeighborhood: string;
  itemNotes: string;
  eventDate: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export async function createItemInvite(data: {
  planItemId: string;
  planId: string;
  invitedBy: string;
  invitedUserId: string;
  itemName: string;
  itemCategory: string;
  itemImageUrl: string;
  itemTime: string;
  itemTimeEnd: string;
  itemAddress: string;
  itemNeighborhood: string;
  itemNotes: string;
  eventDate: string;
}): Promise<ItemInvite | null> {
  const { data: row, error } = await supabase
    .from('plan_item_invites')
    .insert({
      plan_item_id: data.planItemId, plan_id: data.planId,
      invited_by: data.invitedBy, invited_user_id: data.invitedUserId,
      item_name: data.itemName, item_category: data.itemCategory,
      item_image_url: data.itemImageUrl, item_time: data.itemTime,
      item_time_end: data.itemTimeEnd, item_address: data.itemAddress,
      item_neighborhood: data.itemNeighborhood, item_notes: data.itemNotes,
      event_date: data.eventDate,
    })
    .select('*, profiles!invited_by(name, avatar_url)')
    .single();
  if (error || !row) return null;
  return mapInviteRow(row);
}

export async function getItemInvites(userId: string): Promise<ItemInvite[]> {
  const { data } = await supabase
    .from('plan_item_invites')
    .select('*, profiles!invited_by(name, avatar_url)')
    .eq('invited_user_id', userId)
    .neq('status', 'declined')
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapInviteRow);
}

export async function updateItemInviteStatus(inviteId: string, status: 'accepted' | 'declined') {
  await supabase.from('plan_item_invites').update({ status }).eq('id', inviteId);
}

function mapInviteRow(row: any): ItemInvite {
  const p = row.profiles ?? {};
  return {
    id: row.id, planItemId: row.plan_item_id, planId: row.plan_id,
    invitedBy: row.invited_by, invitedByName: p.name ?? '', invitedByAvatar: p.avatar_url ?? '',
    itemName: row.item_name ?? '', itemCategory: row.item_category ?? '',
    itemImageUrl: row.item_image_url ?? '', itemTime: row.item_time ?? '',
    itemTimeEnd: row.item_time_end ?? '', itemAddress: row.item_address ?? '',
    itemNeighborhood: row.item_neighborhood ?? '', itemNotes: row.item_notes ?? '',
    eventDate: row.event_date ?? '', status: row.status ?? 'pending',
    createdAt: row.created_at ?? '',
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  type: 'follow' | 'item_invite' | 'plan_invite' | 'plan_accepted' | 'collection_invite' | 'like' | 'comment' | 'post_invite';
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorAvatar: string | null;
  title: string;
  subtitle?: string;
  createdAt: string;
  // item_invite specific
  inviteId?: string;
  inviteStatus?: 'pending' | 'accepted' | 'declined';
  itemCategory?: string;
  itemImage?: string;
  // plan_invite / plan_accepted specific
  planId?: string;
  planInviteStatus?: 'pending' | 'accepted' | 'declined';
  // like / comment specific
  postId?: string;
  postImage?: string;
  // post_invite specific
  postInviteStatus?: 'pending' | 'accepted' | 'declined';
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  // First get the user's post IDs so we can fetch likes on them
  const { data: userPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', userId);
  const userPostIds = (userPosts ?? []).map((p: any) => p.id);

  const [followsRes, itemInvitesRes, planCollabsRes, colCollabsRes, likesRes, commentsRes, postCollabsRes] = await Promise.all([
    supabase
      .from('follows')
      .select('follower_id, created_at, profiles!follower_id(name, username, avatar_url)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('plan_item_invites')
      .select('*, profiles!invited_by(name, username, avatar_url)')
      .eq('invited_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('plan_collaborators')
      .select('plan_id, invited_by, created_at, status, plans!plan_id(title), profiles!invited_by(name, username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('collection_collaborators')
      .select('collection_id, invited_by, created_at, user_collections!collection_id(name), profiles!invited_by(name, username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    userPostIds.length > 0
      ? supabase
          .from('post_likes')
          .select('user_id, post_id, created_at, profiles!user_id(name, username, avatar_url)')
          .in('post_id', userPostIds)
          .neq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    userPostIds.length > 0
      ? supabase
          .from('post_comments')
          .select('id, user_id, post_id, text, created_at, profiles!user_id(name, username, avatar_url)')
          .in('post_id', userPostIds)
          .neq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    supabase
      .from('post_collaborators')
      .select('post_id, invited_by, created_at, status, posts!post_id(caption, location_label), profiles!invited_by(name, username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  // Fetch cover photos for liked/commented posts separately (avoid broken FK join)
  const notifPostIds = [...new Set([
    ...((likesRes as any).data ?? []).map((r: any) => r.post_id),
    ...((commentsRes as any).data ?? []).map((r: any) => r.post_id),
  ])];
  const postCoverPhotos: Record<string, string> = {};
  if (notifPostIds.length > 0) {
    const { data: coverData } = await supabase
      .from('post_places')
      .select('post_id, photo_url')
      .in('post_id', notifPostIds)
      .eq('position', 0);
    (coverData ?? []).forEach((pl: any) => {
      if (pl.photo_url) postCoverPhotos[pl.post_id] = pl.photo_url;
    });
  }

  const list: AppNotification[] = [];

  for (const r of (followsRes.data ?? [])) {
    const p = (r as any).profiles ?? {};
    list.push({
      id: `follow-${(r as any).follower_id}`,
      type: 'follow',
      actorId: (r as any).follower_id,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: 'started following you',
      createdAt: (r as any).created_at ?? '',
    });
  }

  for (const r of (itemInvitesRes.data ?? [])) {
    const p = (r as any).profiles ?? {};
    list.push({
      id: `item-${(r as any).id}`,
      type: 'item_invite',
      actorId: (r as any).invited_by,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: 'invited you to join',
      subtitle: (r as any).item_name ?? '',
      createdAt: (r as any).created_at ?? '',
      inviteId: (r as any).id,
      inviteStatus: (r as any).status ?? 'pending',
      itemCategory: (r as any).item_category ?? '',
      itemImage: (r as any).item_image_url ?? '',
    });
  }

  for (const r of (planCollabsRes.data ?? [])) {
    const p = (r as any).profiles ?? {};
    const status = (r as any).status ?? 'pending';
    list.push({
      id: `plan-${(r as any).plan_id}-${(r as any).invited_by}`,
      type: 'plan_invite',
      actorId: (r as any).invited_by,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: status === 'pending' ? 'invited you to their trip' : 'added you to their trip',
      subtitle: (r as any).plans?.title ?? '',
      createdAt: (r as any).created_at ?? '',
      planId: (r as any).plan_id,
      planInviteStatus: status as 'pending' | 'accepted' | 'declined',
    });
  }

  for (const r of (colCollabsRes.data ?? [])) {
    const p = (r as any).profiles ?? {};
    list.push({
      id: `col-${(r as any).collection_id}-${(r as any).invited_by}`,
      type: 'collection_invite',
      actorId: (r as any).invited_by,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: 'added you to their collection',
      subtitle: (r as any).user_collections?.name ?? '',
      createdAt: (r as any).created_at ?? '',
    });
  }

  for (const r of ((likesRes as any).data ?? [])) {
    const p = (r as any).profiles ?? {};
    list.push({
      id: `like-${(r as any).post_id}-${(r as any).user_id}`,
      type: 'like',
      actorId: (r as any).user_id,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: 'liked your post',
      createdAt: (r as any).created_at ?? '',
      postId: (r as any).post_id,
      postImage: postCoverPhotos[(r as any).post_id] ?? null,
    });
  }

  for (const r of ((commentsRes as any).data ?? [])) {
    const p = (r as any).profiles ?? {};
    list.push({
      id: `comment-${(r as any).id}`,
      type: 'comment',
      actorId: (r as any).user_id,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: 'commented on your post',
      subtitle: (r as any).text ?? '',
      createdAt: (r as any).created_at ?? '',
      postId: (r as any).post_id,
      postImage: postCoverPhotos[(r as any).post_id] ?? null,
    });
  }

  for (const r of ((postCollabsRes as any).data ?? [])) {
    const p = (r as any).profiles ?? {};
    const status = (r as any).status ?? 'pending';
    const postTitle = (r as any).posts?.location_label || (r as any).posts?.caption?.slice(0, 40) || 'a post';
    list.push({
      id: `post-invite-${(r as any).post_id}-${(r as any).invited_by}`,
      type: 'post_invite',
      actorId: (r as any).invited_by,
      actorName: p.name ?? '',
      actorUsername: p.username ?? '',
      actorAvatar: p.avatar_url ?? null,
      title: status === 'pending' ? 'invited you to collaborate on' : 'added you as a collaborator on',
      subtitle: postTitle,
      createdAt: (r as any).created_at ?? '',
      postId: (r as any).post_id,
      postInviteStatus: status as 'pending' | 'accepted' | 'declined',
    });
  }

  // Fetch accepted collaborators on plans YOU own
  const { data: ownedPlans } = await supabase
    .from('plans')
    .select('id, title')
    .eq('user_id', userId);
  const ownedPlanIds = (ownedPlans ?? []).map((p: any) => p.id);
  if (ownedPlanIds.length > 0) {
    const { data: acceptedCollabs } = await supabase
      .from('plan_collaborators')
      .select('user_id, plan_id, created_at, plans!plan_id(title), profiles!user_id(name, username, avatar_url)')
      .in('plan_id', ownedPlanIds)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(30);
    for (const r of (acceptedCollabs ?? [])) {
      const p = (r as any).profiles ?? {};
      list.push({
        id: `plan-accepted-${(r as any).plan_id}-${(r as any).user_id}`,
        type: 'plan_accepted',
        actorId: (r as any).user_id,
        actorName: p.name ?? '',
        actorUsername: p.username ?? '',
        actorAvatar: p.avatar_url ?? null,
        title: 'accepted your trip invitation to',
        subtitle: (r as any).plans?.title ?? '',
        createdAt: (r as any).created_at ?? '',
        planId: (r as any).plan_id,
      });
    }
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const notifications = await getNotifications(userId);
  // Unread = pending plan/item invites + follows in last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return notifications.filter(n => {
    if (n.type === 'plan_invite') return n.planInviteStatus === 'pending';
    if (n.type === 'item_invite') return n.inviteStatus === 'pending';
    if (n.type === 'follow') return new Date(n.createdAt).getTime() > weekAgo;
    return false;
  }).length;
}

export async function leavePlan(planId: string, userId: string): Promise<void> {
  await supabase.from('plan_collaborators').delete().eq('plan_id', planId).eq('user_id', userId);
}

// ── Saved Places ──────────────────────────────────────────────────────────────
export interface SavedPlace {
  id: string;
  postId: string;
  name: string;
  category: string;
  neighborhood: string;
  city: string;
  country: string;
  photoUrl: string;
  lat: number | null;
  lng: number | null;
}

export async function getSavedPlaces(userId: string): Promise<SavedPlace[]> {
  const { data } = await supabase
    .from('saved_places')
    .select('post_place_id, post_places(id, post_id, name, category, neighborhood, city, country, photo_url, lat, lng)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? [])
    .map((r: any) => r.post_places)
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      postId: p.post_id ?? '',
      name: p.name ?? '',
      category: p.category ?? '',
      neighborhood: p.neighborhood ?? '',
      city: p.city ?? '',
      country: p.country ?? '',
      photoUrl: p.photo_url ?? '',
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    }));
}

export async function getPostById(postId: string): Promise<RealPost | null> {
  const { data: p, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, caption, location_label, created_at, hashtags,
      profiles ( name, username, avatar_url ),
      post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )
    `)
    .eq('id', postId)
    .single();
  if (error || !p) return null;
  return {
    id: p.id,
    userId: p.user_id,
    caption: p.caption ?? '',
    locationLabel: p.location_label ?? '',
    createdAt: p.created_at,
    hashtags: p.hashtags ?? [],
    profile: {
      name: (p.profiles as any)?.name ?? 'Unknown',
      username: (p.profiles as any)?.username ?? '',
      avatarUrl: (p.profiles as any)?.avatar_url ?? null,
    },
    places: ((p.post_places ?? []) as any[])
      .sort((a, b) => a.position - b.position)
      .map(pl => ({
        id: pl.id,
        name: pl.name ?? '',
        category: pl.category ?? '',
        neighborhood: pl.neighborhood ?? '',
        city: pl.city ?? '',
        country: pl.country ?? '',
        photoUrl: pl.photo_url ?? '',
        position: pl.position ?? 0,
        lat: pl.lat ?? null,
        lng: pl.lng ?? null,
      })),
  };
}

export async function getSavedPlaceIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('saved_places')
    .select('post_place_id')
    .eq('user_id', userId);
  return new Set((data ?? []).map((r: any) => r.post_place_id as string));
}

export async function savePlace(userId: string, postPlaceId: string) {
  await supabase.from('saved_places').insert({ user_id: userId, post_place_id: postPlaceId });
}

export async function unsavePlace(userId: string, postPlaceId: string) {
  await supabase
    .from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('post_place_id', postPlaceId);
}

// ── Direct Messaging ──────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  otherUser: { id: string; name: string; username: string; avatarUrl: string | null };
  lastMessage: { text: string; senderId: string; createdAt: string } | null;
  unread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export async function getOrCreateConversation(userId1: string, userId2: string): Promise<string | null> {
  const [u1, u2] = [userId1, userId2].sort();
  console.log('[getOrCreateConversation] u1:', u1, 'u2:', u2);
  // Try existing
  const { data: existing, error: findErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle();
  if (findErr) console.error('[getOrCreateConversation] find error:', findErr.message);
  if (existing) { console.log('[getOrCreateConversation] found existing:', existing.id); return existing.id; }
  // Create new
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user1_id: u1, user2_id: u2 })
    .select('id')
    .single();
  if (error) {
    console.error('[getOrCreateConversation] insert error:', error.message, error.details);
    // Race condition: try fetching again
    const { data: retry } = await supabase.from('conversations').select('id').eq('user1_id', u1).eq('user2_id', u2).maybeSingle();
    return retry?.id ?? null;
  }
  console.log('[getOrCreateConversation] created:', created?.id);
  return created?.id ?? null;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user1_id, user2_id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
  if (error) { console.error('[getConversations]', error.message); return []; }
  if (!data || data.length === 0) return [];

  // Fetch the other user's profile for each conversation
  const otherUserIds = [...new Set(data.map((c: any) => c.user1_id === userId ? c.user2_id : c.user1_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .in('id', otherUserIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles ?? [])) profileMap[(p as any).id] = p;

  // Fetch last message per conversation
  const convIds = data.map((c: any) => c.id);
  const { data: msgs } = await supabase
    .from('messages')
    .select('conversation_id, text, sender_id, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false });
  const lastByConv: Record<string, any> = {};
  for (const msg of (msgs ?? [])) {
    if (!lastByConv[(msg as any).conversation_id]) lastByConv[(msg as any).conversation_id] = msg;
  }

  return data.map((c: any) => {
    const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;
    const other = profileMap[otherId] ?? {};
    const last = lastByConv[c.id] ?? null;
    return {
      id: c.id,
      otherUser: { id: otherId, name: other.name ?? '', username: other.username ?? '', avatarUrl: other.avatar_url ?? null },
      lastMessage: last ? { text: last.text, senderId: last.sender_id, createdAt: last.created_at } : null,
      unread: last ? last.sender_id !== userId : false,
    };
  }).sort((a, b) => {
    const ta = a.lastMessage?.createdAt ?? '0';
    const tb = b.lastMessage?.createdAt ?? '0';
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((m: any) => ({ id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, text: m.text, createdAt: m.created_at }));
}

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select('id, conversation_id, sender_id, text, created_at')
    .single();
  if (error || !data) { console.error('[sendMessage]', error?.message); return null; }
  return { id: data.id, conversationId: data.conversation_id, senderId: data.sender_id, text: data.text, createdAt: data.created_at };
}

// ── Plan Bookings ─────────────────────────────────────────────────────────────
function rowToBooking(r: any): PlanBooking {
  return {
    id: r.id,
    planId: r.plan_id,
    type: r.type ?? 'activity',
    title: r.title ?? '',
    confirmationNumber: r.confirmation_number ?? '',
    notes: r.notes ?? '',
    flightNumber: r.flight_number ?? '',
    airline: r.airline ?? '',
    departureAirport: r.departure_airport ?? '',
    arrivalAirport: r.arrival_airport ?? '',
    departureTime: r.departure_time ?? '',
    arrivalTime: r.arrival_time ?? '',
    checkInDate: r.check_in_date ?? '',
    checkOutDate: r.check_out_date ?? '',
    address: r.address ?? '',
    reservationDate: r.reservation_date ?? '',
    reservationTime: r.reservation_time ?? '',
    partySize: r.party_size ?? null,
    addedBy: r.added_by ?? null,
    createdAt: r.created_at ?? '',
  };
}

export async function getPlanBookings(planId: string): Promise<PlanBooking[]> {
  const { data, error } = await supabase
    .from('plan_bookings')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  if (error) { console.error('[getPlanBookings]', error.message); return []; }
  return (data ?? []).map(rowToBooking);
}

export async function createPlanBooking(
  planId: string,
  addedBy: string,
  booking: Omit<PlanBooking, 'id' | 'planId' | 'addedBy' | 'createdAt'>
): Promise<PlanBooking | null> {
  const { data, error } = await supabase
    .from('plan_bookings')
    .insert({
      plan_id: planId,
      added_by: addedBy,
      type: booking.type,
      title: booking.title,
      confirmation_number: booking.confirmationNumber,
      notes: booking.notes,
      flight_number: booking.flightNumber,
      airline: booking.airline,
      departure_airport: booking.departureAirport,
      arrival_airport: booking.arrivalAirport,
      departure_time: booking.departureTime,
      arrival_time: booking.arrivalTime,
      check_in_date: booking.checkInDate,
      check_out_date: booking.checkOutDate,
      address: booking.address,
      reservation_date: booking.reservationDate,
      reservation_time: booking.reservationTime,
      party_size: booking.partySize,
    })
    .select()
    .single();
  if (error || !data) { console.error('[createPlanBooking]', error?.message); return null; }
  return rowToBooking(data);
}

export async function updatePlanBooking(
  id: string,
  booking: Partial<Omit<PlanBooking, 'id' | 'planId' | 'addedBy' | 'createdAt'>>
): Promise<void> {
  const { error } = await supabase
    .from('plan_bookings')
    .update({
      ...(booking.type !== undefined && { type: booking.type }),
      ...(booking.title !== undefined && { title: booking.title }),
      ...(booking.confirmationNumber !== undefined && { confirmation_number: booking.confirmationNumber }),
      ...(booking.notes !== undefined && { notes: booking.notes }),
      ...(booking.flightNumber !== undefined && { flight_number: booking.flightNumber }),
      ...(booking.airline !== undefined && { airline: booking.airline }),
      ...(booking.departureAirport !== undefined && { departure_airport: booking.departureAirport }),
      ...(booking.arrivalAirport !== undefined && { arrival_airport: booking.arrivalAirport }),
      ...(booking.departureTime !== undefined && { departure_time: booking.departureTime }),
      ...(booking.arrivalTime !== undefined && { arrival_time: booking.arrivalTime }),
      ...(booking.checkInDate !== undefined && { check_in_date: booking.checkInDate }),
      ...(booking.checkOutDate !== undefined && { check_out_date: booking.checkOutDate }),
      ...(booking.address !== undefined && { address: booking.address }),
      ...(booking.reservationDate !== undefined && { reservation_date: booking.reservationDate }),
      ...(booking.reservationTime !== undefined && { reservation_time: booking.reservationTime }),
      ...(booking.partySize !== undefined && { party_size: booking.partySize }),
    })
    .eq('id', id);
  if (error) console.error('[updatePlanBooking]', error.message);
}

export async function deletePlanBooking(id: string): Promise<void> {
  const { error } = await supabase.from('plan_bookings').delete().eq('id', id);
  if (error) console.error('[deletePlanBooking]', error.message);
}
