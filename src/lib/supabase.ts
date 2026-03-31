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
  lat?: number | null;
  lng?: number | null;
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
      post_places ( id, name, category, city, country, photo_url, position, lat, lng )
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
      post_places ( id, name, category, city, country, photo_url, position, lat, lng )
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
  const { data } = await supabase
    .from('collection_places')
    .select('post_places ( id, name, category, city, country, photo_url, position, lat, lng )')
    .eq('collection_id', collectionId);
  return (data ?? [])
    .map((r: any) => r.post_places)
    .filter(Boolean)
    .map((pl: any) => ({
      id: pl.id,
      name: pl.name ?? '',
      category: pl.category ?? '',
      city: pl.city ?? '',
      country: pl.country ?? '',
      photoUrl: pl.photo_url ?? '',
      position: pl.position ?? 0,
      lat: pl.lat ?? null,
      lng: pl.lng ?? null,
    }));
}

export async function addPlaceToCollection(collectionId: string, postPlaceId: string) {
  await supabase.from('collection_places').insert({ collection_id: collectionId, post_place_id: postPlaceId });
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
