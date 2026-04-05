import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { followUser, unfollowUser, getDiscoverProfiles, type DiscoverProfile } from '../lib/supabase';

const interests = [
  { id: 'cities', label: 'Cities', emoji: '🏙️' },
  { id: 'food', label: 'Food & Drink', emoji: '🍽️' },
  { id: 'art', label: 'Art & Culture', emoji: '🎨' },
  { id: 'architecture', label: 'Architecture', emoji: '🏛️' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'hotels', label: 'Hotels', emoji: '🏨' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌙' },
  { id: 'cafes', label: 'Cafes', emoji: '☕' },
  { id: 'beaches', label: 'Beaches', emoji: '🌊' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'events', label: 'Events', emoji: '🎭' },
];

interface OnboardingProps {
  firstName: string;
  currentUserId: string;
  onComplete: (followingCount: number) => void;
}

export default function Onboarding({ firstName, currentUserId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'interests' | 'follow'>('interests');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [suggestedUsers, setSuggestedUsers] = useState<DiscoverProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    setLoadingUsers(true);
    getDiscoverProfiles(currentUserId).then(profiles => {
      setSuggestedUsers(profiles.slice(0, 4));
      setLoadingUsers(false);
    });
  }, [currentUserId]);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleFollow = async (userId: string) => {
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
    if (following.has(userId)) {
      await unfollowUser(currentUserId, userId);
    } else {
      await followUser(currentUserId, userId);
    }
  };

  if (step === 'interests') {
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-6">
        <div className="mb-8">
          <p className="text-slate-400 text-sm mb-1">Hey {firstName || 'there'} 👋</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">What are you into?</h1>
          <p className="text-slate-500 text-sm">
            Select at least 3 · <span className={selectedInterests.length >= 3 ? 'text-green-500' : ''}>{selectedInterests.length} selected</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5 flex-1">
          {interests.map(interest => {
            const selected = selectedInterests.includes(interest.id);
            return (
              <button key={interest.id} onClick={() => toggleInterest(interest.id)}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>
                <span className="text-2xl">{interest.emoji}</span>
                <span className="text-xs font-medium leading-tight text-center">{interest.label}</span>
              </button>
            );
          })}
        </div>
        <div className="pt-6">
          <button onClick={() => setStep('follow')} disabled={selectedInterests.length < 3}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base disabled:opacity-40">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Follow some travelers</h1>
        <p className="text-slate-500 text-sm">Get inspired by people with great taste</p>
      </div>
      <div className="space-y-3 flex-1">
        {loadingUsers ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          </div>
        ) : suggestedUsers.map(user => {
          const isFollowing = following.has(user.id);
          return (
            <div key={user.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-lg font-bold text-slate-400">{user.name?.[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                </div>
                <p className="text-xs text-slate-400">@{user.username}</p>
              </div>
              <button onClick={() => toggleFollow(user.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${isFollowing ? 'bg-slate-200 text-slate-600' : 'bg-slate-900 text-white'}`}>
                {isFollowing && <Check className="w-3 h-3" />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="py-6">
        <button onClick={() => onComplete(following.size)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base">
          Start exploring →
        </button>
      </div>
    </div>
  );
}
