import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RealPostPlace {
  id: string;
  name: string;
  category: string;
  city: string;
  country: string;
  photoUrl: string;
  position: number;
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
      post_places ( id, name, category, city, country, photo_url, position )
    `)
    .eq('visibility', 'feed')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !posts) return [];

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
    places: (p.post_places ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((pl: any) => ({
        id: pl.id,
        name: pl.name ?? '',
        category: pl.category ?? '',
        city: pl.city ?? '',
        country: pl.country ?? '',
        photoUrl: pl.photo_url ?? '',
        position: pl.position ?? 0,
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

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

// ── Update profile ────────────────────────────────────────────────────────────
export async function updateProfile(userId: string, updates: { name?: string; username?: string; bio?: string; avatar_url?: string }) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  return error;
}

// ── Posts by a single user ────────────────────────────────────────────────────
export async function getUserPosts(userId: string): Promise<RealPost[]> {
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
      post_places ( id, name, category, city, country, photo_url, position )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !posts) return [];

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
    places: (p.post_places ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((pl: any) => ({
        id: pl.id,
        name: pl.name ?? '',
        category: pl.category ?? '',
        city: pl.city ?? '',
        country: pl.country ?? '',
        photoUrl: pl.photo_url ?? '',
        position: pl.position ?? 0,
      })),
  }));
}
