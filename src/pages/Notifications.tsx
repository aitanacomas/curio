import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, MapPin, Bookmark, Calendar, CheckCircle, Heart, MessageCircle, Users } from 'lucide-react';
import { getNotifications, updateItemInviteStatus, updatePlanCollaboratorStatus, updatePostCollaboratorStatus, type AppNotification } from '../lib/supabase';

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const typeIcon: Record<AppNotification['type'], JSX.Element> = {
  follow: <UserPlus size={14} strokeWidth={1.8} className="text-orange-500" />,
  item_invite: <Calendar size={14} strokeWidth={1.8} className="text-orange-500" />,
  plan_invite: <MapPin size={14} strokeWidth={1.8} className="text-orange-500" />,
  plan_accepted: <CheckCircle size={14} strokeWidth={1.8} className="text-orange-500" />,
  collection_invite: <Bookmark size={14} strokeWidth={1.8} className="text-orange-500" />,
  like: <Heart size={14} strokeWidth={1.8} className="text-red-500 fill-red-500" />,
  comment: <MessageCircle size={14} strokeWidth={1.8} className="text-blue-400" />,
  post_invite: <Users size={14} strokeWidth={1.8} className="text-orange-500" />,
};

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', food: '🍕',
  hotel: '🏨', attraction: '🏛️', nature: '🌿', beach: '🏖️',
  shop: '🛍️', experience: '🗺️', sports: '🎾', wellness: '💆',
  street: '🏙️', event: '🎟️', flight: '✈️', transport: '🚗',
};

const lsKey = (userId: string) => `notifs_last_seen_${userId}`;

export function getUnreadCount(userId: string, notifications: AppNotification[]): number {
  const lastSeen = parseInt(localStorage.getItem(lsKey(userId)) ?? '0', 10);
  return notifications.filter(n => new Date(n.createdAt).getTime() > lastSeen).length;
}

export function markAsSeen(userId: string) {
  localStorage.setItem(lsKey(userId), Date.now().toString());
}

export default function Notifications({ userId, onBack, onViewProfile }: { userId: string; onBack: () => void; onViewProfile?: (actorId: string) => void }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [lastSeen] = useState<number>(() => parseInt(localStorage.getItem(lsKey(userId)) ?? '0', 10));

  useEffect(() => {
    getNotifications(userId).then(n => {
      setNotifications(n);
      setLoading(false);
      // Mark as seen when opened
      markAsSeen(userId);
    });
  }, [userId]);

  const handleInviteAction = async (n: AppNotification, status: 'accepted' | 'declined') => {
    if (!n.inviteId) return;
    setActionPending(n.id);
    await updateItemInviteStatus(n.inviteId, status);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, inviteStatus: status } : x));
    setActionPending(null);
  };

  const handlePlanInviteAction = async (n: AppNotification, status: 'accepted' | 'declined') => {
    if (!n.planId) return;
    setActionPending(n.id);
    await updatePlanCollaboratorStatus(n.planId, userId, status);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, planInviteStatus: status } : x));
    setActionPending(null);
  };

  const handlePostInviteAction = async (n: AppNotification, status: 'accepted' | 'declined') => {
    if (!n.postId) return;
    setActionPending(n.id);
    await updatePostCollaboratorStatus(n.postId, userId, status);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, postInviteStatus: status } : x));
    setActionPending(null);
  };

  // Group into New (since last open) and Past
  const newNotifs = notifications.filter(n => n.createdAt && new Date(n.createdAt).getTime() > lastSeen);
  const pastNotifs = notifications.filter(n => !n.createdAt || new Date(n.createdAt).getTime() <= lastSeen);
  const groups: { label: string; items: AppNotification[] }[] = [
    { label: 'New', items: newNotifs },
    { label: 'Past', items: pastNotifs },
  ].filter(g => g.items.length > 0);

  const renderRow = (n: AppNotification) => (
    <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 transition-colors"
      onClick={() => onViewProfile?.(n.actorId)}
      style={{ cursor: onViewProfile ? 'pointer' : 'default' }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {n.actorAvatar
          ? <img src={n.actorAvatar} alt={n.actorName} className="w-11 h-11 rounded-full object-cover" />
          : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">{n.actorName[0]?.toUpperCase() || '?'}</div>
        }
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
          {typeIcon[n.type]}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm text-gray-900 leading-snug">
          <span className="font-semibold">{n.actorName || n.actorUsername}</span>
          {' '}{n.title}
          {n.subtitle ? <><span className="font-semibold"> {n.subtitle}</span></> : null}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">@{n.actorUsername} · {timeAgo(n.createdAt)}</p>

        {/* Plan invite: accept/decline */}
        {n.type === 'plan_invite' && n.planInviteStatus && (
          <div className="mt-2">
            {n.planInviteStatus === 'pending' ? (
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <button onClick={() => handlePlanInviteAction(n, 'accepted')} disabled={actionPending === n.id}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-full disabled:opacity-50">Accept</button>
                <button onClick={() => handlePlanInviteAction(n, 'declined')} disabled={actionPending === n.id}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full disabled:opacity-50">Decline</button>
              </div>
            ) : (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${n.planInviteStatus === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {n.planInviteStatus === 'accepted' ? '✓ Accepted' : 'Declined'}
              </span>
            )}
          </div>
        )}

        {/* Post invite: accept/decline */}
        {n.type === 'post_invite' && n.postInviteStatus && (
          <div className="mt-2">
            {n.postInviteStatus === 'pending' ? (
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <button onClick={() => handlePostInviteAction(n, 'accepted')} disabled={actionPending === n.id}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-full disabled:opacity-50">Accept</button>
                <button onClick={() => handlePostInviteAction(n, 'declined')} disabled={actionPending === n.id}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full disabled:opacity-50">Decline</button>
              </div>
            ) : (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${n.postInviteStatus === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {n.postInviteStatus === 'accepted' ? '✓ Accepted' : 'Declined'}
              </span>
            )}
          </div>
        )}

        {/* Item invite: thumbnail + accept/decline */}
        {n.type === 'item_invite' && (
          <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {n.itemImage
              ? <img src={n.itemImage} alt={n.subtitle} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              : <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{categoryEmoji[n.itemCategory ?? ''] ?? '📍'}</div>
            }
            {n.inviteStatus === 'pending' ? (
              <div className="flex gap-1.5">
                <button onClick={() => handleInviteAction(n, 'accepted')} disabled={actionPending === n.id}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-full disabled:opacity-50">Accept</button>
                <button onClick={() => handleInviteAction(n, 'declined')} disabled={actionPending === n.id}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full disabled:opacity-50">Decline</button>
              </div>
            ) : (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${n.inviteStatus === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {n.inviteStatus === 'accepted' ? '✓ Accepted' : 'Declined'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Post thumbnail for likes and comments */}
      {(n.type === 'like' || n.type === 'comment') && n.postImage && (
        <img src={n.postImage} alt="post" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
      )}

      {/* Time (right side for non-invite types) */}
      {n.type !== 'item_invite' && n.type !== 'plan_invite' && n.type !== 'post_invite' && (
        <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5">{timeAgo(n.createdAt)}</span>
      )}
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1">Activity</h1>
      </div>

      {loading ? (
        <div className="space-y-0">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-48" />
                <div className="h-2.5 bg-gray-100 rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 text-3xl">🔔</div>
          <p className="text-sm font-bold text-gray-900 mb-1">No activity yet</p>
          <p className="text-xs text-gray-400 text-center">When someone follows you, invites you to a trip or collection, you'll see it here.</p>
        </div>
      ) : (
        <div>
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4 pt-5 pb-2">{group.label}</p>
              {group.items.map(renderRow)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
