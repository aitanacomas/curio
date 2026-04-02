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

  // Own posts + posts where user is an accepted collaborator
  const [{ data: ownedPosts }, { data: collabRows }] = await Promise.all([
    supabase.from('posts').select(selectFields).eq('user_id', userId).order('position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    supabase.from('post_collaborators').select('post_id').eq('user_id', userId).eq('status', 'accepted'),
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
    .eq('status', 'accepted');

  const collabsByPost: Record<string, { id: string; name: string; username: string; avatarUrl: string | null }[]> = {};
  for (const c of (collabs ?? [])) {
    const pid = (c as any).post_id;
    const cUserId = (c as any).user_id;
    // Don't show the viewing user as a collaborator on their own grid
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

/** Geocode any places missing lat/lng in parallel, update DB, return updated array */
export async function geocodeMissingPlaces(places: RealPostPlace[], apiKey: string): Promise<RealPostPlace[]> {
  if (!apiKey) return places;
  const missing = places.filter(pl => pl.lat == null || pl.lng == null);
  if (missing.length === 0) return places;

  const results = await Promise.all(missing.map(async pl => {
    try {
      const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify({ input: `${pl.name}, ${pl.city}, ${pl.country}`, languageCode: 'en' }),
      });
      const acData = await acRes.json();
      const placeId = acData.suggestions?.[0]?.placePrediction?.placeId;
      if (!placeId) return null;
      const detRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'location' },
      });
      const det = await detRes.json();
      if (det.location?.latitude != null)
        return { id: pl.id, lat: det.location.latitude as number, lng: det.location.longitude as number };
      return null;
    } catch { return null; }
  }));

  const coords: Record<string, { lat: number; lng: number }> = {};
  results.forEach(r => { if (r) coords[r.id] = { lat: r.lat, lng: r.lng }; });
  if (Object.keys(coords).length === 0) return places;

  // Persist to DB (best-effort, fire-and-forget)
  Object.entries(coords).forEach(([id, c]) =>
    supabase.from('post_places').update({ lat: c.lat, lng: c.lng }).eq('id', id)
  );
  return places.map(pl => coords[pl.id] ? { ...pl, ...coords[pl.id] } : pl);
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
    .insert({ post_id: postId, user_id: userId, invited_by: invitedBy, status: 'pending' });
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
  data: { name: string; category: string; image_url: string; time_label: string; time_end?: string; notes?: string; address?: string; neighborhood?: string; status?: string; check_in?: string; check_out?: string; location?: string; position: number; added_by?: string }
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
