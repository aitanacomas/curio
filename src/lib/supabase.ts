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
      post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )
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
      post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )
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
  const { data } = await supabase
    .from('collection_places')
    .select('post_places ( id, name, category, neighborhood, city, country, photo_url, position, lat, lng )')
    .eq('collection_id', collectionId);
  return (data ?? [])
    .map((r: any) => r.post_places)
    .filter(Boolean)
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

export async function deletePostPlace(postPlaceId: string) {
  await supabase.from('post_places').delete().eq('id', postPlaceId);
}

export async function deletePost(postId: string) {
  await supabase.from('posts').delete().eq('id', postId);
}

export async function updatePostCaption(postId: string, caption: string) {
  await supabase.from('posts').update({ caption }).eq('id', postId);
}

export async function reorderPostPlaces(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, i) =>
    supabase.from('post_places').update({ sort_order: i }).eq('id', id)
  ));
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

export async function getPlans(userId: string): Promise<Plan[]> {
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p: any) => p.id);

  const [{ data: days }, { data: items }, { data: collabs }] = await Promise.all([
    supabase.from('plan_days').select('*').in('plan_id', planIds).order('position'),
    supabase.from('plan_items').select('*').in('plan_id', planIds).order('position'),
    supabase
      .from('plan_collaborators')
      .select('id, plan_id, user_id, profiles!user_id(name, avatar_url)')
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
          })),
      }));

    const planCollabs = (collabs ?? [])
      .filter((c: any) => c.plan_id === p.id)
      .map((c: any) => ({
        id: c.user_id,
        name: (c.profiles as any)?.name ?? '',
        avatar: (c.profiles as any)?.avatar_url ?? `https://i.pravatar.cc/150?u=${c.user_id}`,
      }));

    return {
      id: p.id,
      userId: p.user_id,
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
  data: { name: string; category: string; image_url: string; time_label: string; time_end?: string; notes?: string; address?: string; neighborhood?: string; status?: string; check_in?: string; check_out?: string; location?: string; position: number }
): Promise<PlanItem | null> {
  const payload = { plan_id: planId, plan_day_id: planDayId, ...data };
  let { data: item, error } = await supabase
    .from('plan_items')
    .insert(payload)
    .select()
    .single();
  // Retry stripping optional columns that may not be migrated yet
  if (error || !item) {
    console.error('[createPlanItem] initial insert error:', error?.message);
    const { notes: _n, status: _s, check_in: _ci, check_out: _co,
            address: _a, neighborhood: _nb, time_end: _te, location: _loc, ...minimal } = payload as any;
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
  };
}

export async function updatePlanItem(
  itemId: string,
  data: Partial<{ name: string; category: string; image_url: string; time_label: string; time_end: string; notes: string; address: string; neighborhood: string; status: string; check_in: string; check_out: string; location: string; booked: boolean }>
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

// ── Saved Places ──────────────────────────────────────────────────────────────
export interface SavedPlace {
  id: string;
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
    .select('post_place_id, post_places(id, name, category, neighborhood, city, country, photo_url, lat, lng)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? [])
    .map((r: any) => r.post_places)
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
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
