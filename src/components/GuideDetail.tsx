import { useState, useEffect } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import type { Guide, Plan } from '../lib/supabase';
import { getPlans } from '../lib/supabase';

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', treats: '🍰', bar: '🍸', nightlife: '🎵',
  food: '🍕', hotel: '🏨', landmark: '🏛️', art: '🎨', nature: '🌿',
  beach: '🏖️', shop: '🛍️', experience: '🎡', neighbourhood: '🏘️',
  sports: '🎾', wellness: '💆', event: '🎟️', flight: '✈️', transport: '🚗',
};

interface Props {
  guide: Guide;
  currentUserId?: string;
  onClose: () => void;
  onDeleteGuide?: (guideId: string) => void;
}

export default function GuideDetail({ guide, currentUserId, onClose, onDeleteGuide }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guide.planId || !currentUserId) { setLoading(false); return; }
    // Try to fetch the plan via getPlans (works for owner's plans)
    getPlans(guide.userId).then(plans => {
      const found = plans.find(p => p.id === guide.planId) ?? null;
      setPlan(found);
      setLoading(false);
    });
  }, [guide.planId, guide.userId, currentUserId]);

  const isOwn = currentUserId === guide.userId;
  const timeAgo = (() => {
    const diff = Date.now() - new Date(guide.publishedAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  })();

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover image */}
          {guide.coverUrl && (
            <div className="relative h-48 bg-gray-100 flex-shrink-0">
              <img src={guide.coverUrl} alt={guide.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                <h2 className="text-xl font-black text-white leading-tight">{guide.title}</h2>
                {guide.destination && (
                  <p className="text-white/80 text-sm flex items-center gap-1 mt-0.5">
                    <MapPin size={11} strokeWidth={1.5} />
                    {guide.destination}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                <X size={14} strokeWidth={2} className="text-white" />
              </button>
            </div>
          )}

          {!guide.coverUrl && (
            <div className="px-5 pt-2 pb-3 flex items-start justify-between flex-shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{guide.title}</h2>
                {guide.destination && (
                  <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin size={11} strokeWidth={1.5} />
                    {guide.destination}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                <X size={14} strokeWidth={2} className="text-gray-600" />
              </button>
            </div>
          )}

          {/* Author + meta */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
            {guide.profile.avatarUrl
              ? <img src={guide.profile.avatarUrl} alt={guide.profile.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">{guide.profile.name[0]?.toUpperCase()}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{guide.profile.name}</p>
              <p className="text-xs text-gray-400">@{guide.profile.username} · {timeAgo}</p>
            </div>
            {isOwn && onDeleteGuide && (
              <button
                onClick={() => { onDeleteGuide(guide.id); onClose(); }}
                className="text-xs text-red-400 font-semibold px-3 py-1.5 rounded-full bg-red-50"
              >
                Remove
              </button>
            )}
          </div>

          {/* Description */}
          {guide.description && (
            <p className="px-5 py-3 text-sm text-gray-700 leading-relaxed border-b border-gray-100">{guide.description}</p>
          )}

          {/* Plan days */}
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            ) : !plan ? (
              <p className="text-sm text-gray-400 text-center py-8">No itinerary available</p>
            ) : (
              <div className="space-y-5">
                {plan.days.map(day => (
                  day.items.length > 0 && (
                    <div key={day.id ?? day.label}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{day.label}</p>
                      <div className="space-y-2">
                        {day.items.map(item => (
                          <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                              : <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 text-lg">{categoryEmoji[item.category?.toLowerCase() ?? ''] ?? '📍'}</div>
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                              {item.neighborhood && (
                                <p className="text-xs text-gray-400 truncate">{item.neighborhood}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
