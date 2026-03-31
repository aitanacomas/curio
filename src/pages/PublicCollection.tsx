import { lazy, Suspense, useEffect, useState } from 'react';
import { MapPin, UserPlus, Check, ArrowLeft } from 'lucide-react';
import { getCollectionById, getCollectionPlaces, addCollaborator, getCollectionCollaborators, type RealCollection, type RealPostPlace } from '../lib/supabase';
import type { AppUser } from '../types';

const MapView = lazy(() => import('../components/MapView'));

interface Props {
  collectionId: string;
  appUser: AppUser | null;
  onBack: () => void;
  onSignUp: () => void;
}

export default function PublicCollection({ collectionId, appUser, onBack, onSignUp }: Props) {
  const [collection, setCollection] = useState<(RealCollection & { ownerName: string; ownerUsername: string; ownerAvatarUrl: string | null }) | null>(null);
  const [places, setPlaces] = useState<RealPostPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isAlreadyCollaborator, setIsAlreadyCollaborator] = useState(false);

  useEffect(() => {
    Promise.all([
      getCollectionById(collectionId),
      getCollectionPlaces(collectionId),
    ]).then(([col, pls]) => {
      setCollection(col);
      setPlaces(pls);
      setLoading(false);
    });
  }, [collectionId]);

  useEffect(() => {
    if (appUser && collectionId) {
      getCollectionCollaborators(collectionId).then(collabs => {
        setIsAlreadyCollaborator(collabs.some(c => c.userId === appUser.id));
      });
    }
  }, [appUser, collectionId]);

  const catEmoji = (cat: string) => {
    const m: Record<string, string> = { cafe: '☕', coffee: '☕', restaurant: '🍽️', bar: '🍸', hotel: '🏨', shop: '🛍️', attraction: '🏛️', nature: '🌿', experience: '✨', nightlife: '🌙' };
    return m[cat.toLowerCase()] ?? '📍';
  };

  const mapPlaces = places
    .filter(p => p.lat != null && p.lng != null)
    .map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name, city: p.city, country: p.country }));

  const isOwner = appUser && collection && appUser.id === collection.userId;

  const handleJoin = async () => {
    if (!appUser || !collection) return;
    setJoining(true);
    await addCollaborator(collection.id, appUser.id, collection.userId);
    setJoining(false);
    setJoined(true);
    setIsAlreadyCollaborator(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading collection…</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <span className="text-4xl mb-3">🔍</span>
        <p className="text-lg font-bold text-gray-900 mb-1">Collection not found</p>
        <p className="text-sm text-gray-400 mb-6">This collection may have been removed or made private.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold">Go home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero */}
      <div className="relative h-60 flex-shrink-0">
        {collection.coverImageUrl
          ? <img src={collection.coverImageUrl} alt={collection.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><span className="text-6xl">{collection.emoji || '🗂️'}</span></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <button onClick={onBack} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
          <ArrowLeft size={16} strokeWidth={1.5} className="text-gray-700" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-black text-white">{collection.name}</h1>
          {collection.description && <p className="text-white/70 text-xs mt-1">{collection.description}</p>}
        </div>
      </div>

      {/* Owner row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {collection.ownerAvatarUrl
          ? <img src={collection.ownerAvatarUrl} alt={collection.ownerName} className="w-8 h-8 rounded-full object-cover" />
          : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{collection.ownerName.charAt(0)}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{collection.ownerName}</p>
          <p className="text-xs text-gray-400">@{collection.ownerUsername}</p>
        </div>
        <p className="text-xs text-gray-400 font-medium">{collection.placesCount} place{collection.placesCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Map */}
      {mapPlaces.length > 0 && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl overflow-hidden">
            <Suspense fallback={<div className="h-52 bg-gray-100 animate-pulse" />}>
              <MapView places={mapPlaces} height="220px" />
            </Suspense>
          </div>
        </div>
      )}

      {/* Places */}
      <div className="px-4 pt-4 pb-32 space-y-3">
        {places.map(place => (
          <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
            {place.photoUrl && <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
              <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                {[place.neighborhood, place.city].filter(Boolean).join(', ')}
              </p>
              {place.category && <p className="text-xs text-gray-400 mt-0.5">{catEmoji(place.category)} {place.category.charAt(0).toUpperCase() + place.category.slice(1)}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto px-4 pb-8 pt-4 bg-white border-t border-gray-100">
          {appUser ? (
            isAlreadyCollaborator || joined ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-2xl">
                <Check size={16} className="text-green-600" />
                <p className="text-sm font-semibold text-green-700">You're a collaborator</p>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold disabled:opacity-60"
              >
                <UserPlus size={16} strokeWidth={1.5} />
                {joining ? 'Joining…' : 'Join as collaborator'}
              </button>
            )
          ) : (
            <div className="space-y-2">
              <button
                onClick={onSignUp}
                className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold"
              >Sign up to collaborate</button>
              <p className="text-xs text-gray-400 text-center">You'll be added to this collection after signing up</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
