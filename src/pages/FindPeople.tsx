import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, UserPlus, Check, Share2, Phone, Clock, MessageCircle, MapPin } from 'lucide-react';
import { supabase, getDiscoverProfiles, getFollowing, getUserPosts, getFollowCounts, type DiscoverProfile, type RealPost } from '../lib/supabase';
import ImageCarousel from '../components/ImageCarousel';

const MapView = lazy(() => import('../components/MapView'));

interface Props {
  currentUserId: string;
  onBack: () => void;
  onFollowChange?: (delta: number) => void;
}

interface PendingInvite {
  name: string;
  email?: string;
  phone?: string;
  sentAt: string;
}

export default function FindPeople({ currentUserId, onBack, onFollowChange }: Props) {
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewingProfile, setViewingProfile] = useState<DiscoverProfile | null>(null);
  const [contactsSupported] = useState(() => 'contacts' in navigator);
  const [contactMatches, setContactMatches] = useState<DiscoverProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(() => {
    try { return JSON.parse(localStorage.getItem('curio_pending_invites') ?? '[]'); } catch { return []; }
  });
  const [showContactMatches, setShowContactMatches] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showWhoDidYouSend, setShowWhoDidYouSend] = useState(false);
  const [whoName, setWhoName] = useState('');
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      getDiscoverProfiles(currentUserId),
      getFollowing(currentUserId),
    ]).then(([p, f]) => {
      setProfiles(p);
      setFollowing(f);
      setLoading(false);
    });
  }, [currentUserId]);

  const toggleFollow = async (profileId: string) => {
    if (!currentUserId) return;
    if (following.has(profileId)) {
      setFollowing(prev => { const s = new Set(prev); s.delete(profileId); return s; });
      onFollowChange?.(-1);
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', currentUserId).eq('following_id', profileId);
      if (error) {
        console.error('Unfollow error:', error.message, error.code);
        setFollowing(prev => new Set(prev).add(profileId));
        onFollowChange?.(1);
      }
    } else {
      setFollowing(prev => new Set(prev).add(profileId));
      onFollowChange?.(1);
      const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: profileId });
      if (error) {
        console.error('Follow error:', error.message, error.code);
        setFollowing(prev => { const s = new Set(prev); s.delete(profileId); return s; });
        onFollowChange?.(-1);
      }
    }
  };

  const handleContactsPicker = async () => {
    setContactsLoading(true);
    try {
      // @ts-ignore — Contact Picker API
      const contacts = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: true });
      const emails = new Set<string>();
      const phones = new Set<string>();
      contacts.forEach((c: any) => {
        (c.email ?? []).forEach((e: string) => emails.add(e.toLowerCase().trim()));
        (c.tel ?? []).forEach((t: string) => phones.add(t.replace(/\D/g, '')));
      });
      const matched = profiles.filter(p => {
        const emailMatch = p.email && emails.has(p.email.toLowerCase());
        const phoneMatch = p.phoneDiscoverable && p.phone && phones.has(p.phone.replace(/\D/g, ''));
        return emailMatch || phoneMatch;
      });
      setContactMatches(matched);
      setShowContactMatches(true);
    } catch {
      // User dismissed or API unavailable
    }
    setContactsLoading(false);
  };

  // ── Primary invite: SMS ──────────────────────────────────────────────────────
  const handleSmsInvite = async () => {
    const referralUrl = `https://curio-travel-app.vercel.app?ref=${currentUserId}`;
    const msg = encodeURIComponent(`Hey! I'm using curio to save and share the places I love. Come join me: ${referralUrl}`);
    const sep = /iPhone|iPad/.test(navigator.userAgent) ? '&' : '?';

    if (contactsSupported) {
      // Contact Picker available (Safari iOS / Chrome Android) — pick contact, auto-track
      try {
        // @ts-ignore — Contact Picker API
        const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        const contact = contacts[0];
        if (!contact) return;

        const name: string = contact.name?.[0] ?? '';
        const phone: string = (contact.tel?.[0] ?? '').trim();

        if (phone) {
          const digits = phone.replace(/\D/g, '');
          const existing = profiles.find(p => p.phoneDiscoverable && p.phone?.replace(/\D/g, '') === digits);
          if (existing) {
            if (!following.has(existing.id)) toggleFollow(existing.id);
            return;
          }
          savePendingInvite({ name: name || phone, phone });
          window.open(`sms:${phone}${sep}body=${msg}`, '_blank');
        }
      } catch {
        // Dismissed — fall through to open SMS without pre-filled number
        window.open(`sms:${sep}body=${msg}`, '_blank');
      }
    } else {
      // No Contact Picker — open SMS app directly, user picks contact inside Messages
      window.open(`sms:${sep}body=${msg}`, '_blank');
      // Show prompt to track who they sent it to
      setShowWhoDidYouSend(true);
    }
  };

  const handleWhoDidYouSend = (name?: string) => {
    const n = (name ?? whoName).trim();
    if (n) savePendingInvite({ name: n });
    setWhoName('');
    setShowWhoDidYouSend(false);
  };

  // ── Secondary invite: generic share sheet ────────────────────────────────────
  const handleShareInvite = async () => {
    const url = `https://curio-travel-app.vercel.app?ref=${currentUserId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on curio',
          text: "I'm using curio to collect and share the places I love — restaurants, hotels, hidden gems. Come join me.",
          url,
        });
      } catch { /* dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    }
  };

  const savePendingInvite = (invite: Omit<PendingInvite, 'sentAt'>) => {
    const newInvite: PendingInvite = { ...invite, sentAt: new Date().toISOString() };
    setPendingInvites(prev => {
      const updated = [newInvite, ...prev.filter(i =>
        !(i.phone && i.phone === invite.phone) && !(i.email && i.email === invite.email)
      )];
      localStorage.setItem('curio_pending_invites', JSON.stringify(updated));
      return updated;
    });
  };

  const removePending = (invite: PendingInvite) => {
    setPendingInvites(prev => {
      const updated = prev.filter(i =>
        !(i.name === invite.name && i.email === invite.email && i.phone === invite.phone)
      );
      localStorage.setItem('curio_pending_invites', JSON.stringify(updated));
      return updated;
    });
  };

  // Filter: name, username, email, or phone (phone only if discoverable)
  const filtered = profiles.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    const qDigits = query.replace(/\D/g, '');
    return (
      p.name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      (p.email?.toLowerCase().includes(q) ?? false) ||
      (p.phoneDiscoverable && qDigits.length >= 4 && (p.phone?.replace(/\D/g, '').includes(qDigits) ?? false))
    );
  });

  // People who signed up via your referral link
  const referredProfiles = profiles.filter(p => p.referredBy === currentUserId);

  // Split pending invites: joined (matched by email/phone) vs still pending
  const joinedInvites = pendingInvites.filter(i =>
    (i.email && profiles.some(p => p.email?.toLowerCase() === i.email)) ||
    (i.phone && profiles.some(p => p.phoneDiscoverable && p.phone?.replace(/\D/g, '') === i.phone!.replace(/\D/g, '')))
  );
  const stillPending = pendingInvites.filter(i => !joinedInvites.includes(i));

  // ── View individual profile ─────────────────────────────────────
  if (viewingProfile) {
    return (
      <UserProfileView
        profile={viewingProfile}
        isFollowing={following.has(viewingProfile.id)}
        onToggleFollow={() => toggleFollow(viewingProfile.id)}
        onBack={() => setViewingProfile(null)}
      />
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">Find people</h2>
        </div>
        <div className="relative">
          <Search size={15} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, @username or email"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>
      </div>

      <div className="pb-10">
        {/* Action buttons */}
        {!query && (
          <div className="px-4 pt-4 pb-2 space-y-2">
            {/* Primary: SMS invite */}
            <button
              onClick={handleSmsInvite}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-900 rounded-2xl text-left active:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={18} strokeWidth={1.5} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Invite via SMS</p>
                <p className="text-xs text-white/60 mt-0.5">
                  {contactsSupported ? 'Pick a contact — tracked automatically' : 'Open in Safari to auto-track contacts'}
                </p>
              </div>
            </button>

            {/* Who did you send it to? (shown after SMS opens without Contact Picker) */}
            {showWhoDidYouSend && (
              <div className="bg-slate-50 rounded-2xl px-4 py-3.5">
                <p className="text-sm font-semibold text-slate-900 mb-0.5">Who did you send it to?</p>
                <p className="text-xs text-slate-400 mb-3">Helps you track when they join</p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={whoName}
                    onChange={e => setWhoName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleWhoDidYouSend()}
                    placeholder="Their name"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none text-slate-900 placeholder-slate-400"
                  />
                  <button
                    onClick={() => handleWhoDidYouSend()}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl"
                  >
                    Save
                  </button>
                </div>
                <button onClick={() => setShowWhoDidYouSend(false)} className="text-xs text-slate-400 mt-2">Skip</button>
              </div>
            )}

            {/* Find from contacts (existing users) */}
            {contactsSupported && (
              <button
                onClick={handleContactsPicker}
                disabled={contactsLoading}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-2xl text-left active:bg-slate-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} strokeWidth={1.5} className="text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Find from contacts</p>
                  <p className="text-xs text-slate-400 mt-0.5">See which of your contacts are on curio</p>
                </div>
              </button>
            )}

            {/* Secondary: share another way */}
            <button
              onClick={handleShareInvite}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-2xl text-left active:bg-slate-100 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${inviteCopied ? 'bg-green-500' : 'bg-slate-200'}`}>
                {inviteCopied
                  ? <Check size={18} strokeWidth={2} className="text-white" />
                  : <Share2 size={18} strokeWidth={1.5} className="text-slate-600" />
                }
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {inviteCopied ? 'Link copied!' : 'Share another way'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {inviteCopied ? 'curio-travel-app.vercel.app' : 'AirDrop, WhatsApp, email and more'}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Joined via your referral link */}
        {!query && referredProfiles.length > 0 && (
          <div className="px-4 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Joined via your link</p>
            <div className="space-y-1">
              {referredProfiles.map(p => (
                <div key={p.id} className="relative">
                  <ProfileRow profile={p} isFollowing={following.has(p.id)} onToggle={() => toggleFollow(p.id)} onViewProfile={() => setViewingProfile(p)} />
                  <span className="absolute top-3 right-14 text-[10px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">Joined</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invited — now joined (matched by email/phone) */}
        {!query && joinedInvites.length > 0 && (
          <div className="px-4 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Joined curio</p>
            <div className="space-y-1">
              {joinedInvites.map(invite => {
                const profile = profiles.find(p => p.email?.toLowerCase() === invite.email)!;
                return (
                  <div key={invite.email} className="relative">
                    <ProfileRow profile={profile} isFollowing={following.has(profile.id)} onToggle={() => toggleFollow(profile.id)} onViewProfile={() => setViewingProfile(profile)} />
                    <span className="absolute top-3 right-14 text-[10px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">Joined</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending invites */}
        {!query && stillPending.length > 0 && (
          <div className="px-4 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Invited · pending</p>
            <div className="space-y-1">
              {stillPending.map(invite => (
                <div key={`${invite.name}-${invite.phone ?? invite.email ?? ''}`} className="flex items-center gap-3 py-2.5">
                  <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-400">
                      {invite.name[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">{invite.name}</p>
                    <p className="text-xs text-gray-400 truncate">{invite.phone ?? invite.email ?? 'Link shared'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
                      <Clock size={10} strokeWidth={2} />Pending
                    </span>
                    <button onClick={() => removePending(invite)} className="text-[11px] text-slate-400">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact matches */}
        {showContactMatches && !query && (
          <div className="px-4 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {contactMatches.length > 0 ? 'From your contacts' : 'None of your contacts are on curio yet'}
            </p>
            <div className="space-y-1">
              {contactMatches.map(p => (
                <ProfileRow key={p.id} profile={p} isFollowing={following.has(p.id)} onToggle={() => toggleFollow(p.id)} onViewProfile={() => setViewingProfile(p)} />
              ))}
            </div>
          </div>
        )}

        {/* People on curio */}
        <div className="px-4 pt-4">
          {!query && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {loading ? 'Loading…' : `People on curio${profiles.length > 0 ? ` · ${profiles.length}` : ''}`}
            </p>
          )}

          {loading ? (
            <div className="space-y-3 pt-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-28" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                  <div className="w-20 h-8 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserPlus size={28} strokeWidth={1.5} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                {query ? 'No one found' : 'No one here yet'}
              </p>
              <p className="text-xs text-gray-400">
                {query ? 'Try their name, @username or email address' : 'Invite your friends to join curio'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(p => (
                <ProfileRow key={p.id} profile={p} isFollowing={following.has(p.id)} onToggle={() => toggleFollow(p.id)} onViewProfile={() => setViewingProfile(p)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ profile, isFollowing, onToggle, onViewProfile }: { profile: DiscoverProfile; isFollowing: boolean; onToggle: () => void; onViewProfile: () => void }) {
  const initials = profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 py-2.5 cursor-pointer" onClick={onViewProfile}>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt={profile.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-slate-500">{initials || '?'}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{profile.name}</p>
        <p className="text-xs text-gray-400 truncate">@{profile.username}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-slate-900 text-white'
        }`}
      >
        {isFollowing ? <><Check size={12} strokeWidth={2} />Following</> : <>Follow</>}
      </button>
    </div>
  );
}

function UserProfileView({ profile, isFollowing, onToggleFollow, onBack }: { profile: DiscoverProfile; isFollowing: boolean; onToggleFollow: () => void; onBack: () => void }) {
  const [posts, setPosts] = useState<RealPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [following, setFollowing] = useState(isFollowing);
  const [selectedPost, setSelectedPost] = useState<RealPost | null>(null);
  const [activeTab, setActiveTab] = useState<'Posts' | 'Map' | 'Collections'>('Posts');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const [followerList, setFollowerList] = useState<{ id: string; name: string; username: string; avatarUrl: string | null }[]>([]);
  const [followingList, setFollowingList] = useState<{ id: string; name: string; username: string; avatarUrl: string | null }[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const initials = profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    Promise.all([
      getUserPosts(profile.id),
      getFollowCounts(profile.id),
    ]).then(([p, counts]) => {
      setPosts(p);
      setFollowerCount(counts.followers);
      setFollowingCount(counts.following);
      setLoadingPosts(false);
    });
  }, [profile.id]);

  const openFollowList = async (type: 'followers' | 'following') => {
    setShowFollowList(type);
    setLoadingList(true);
    if (type === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('follower:profiles!follower_id ( id, name, username, avatar_url )')
        .eq('following_id', profile.id);
      setFollowerList((data ?? []).map((r: any) => ({ id: r.follower.id, name: r.follower.name ?? '', username: r.follower.username ?? '', avatarUrl: r.follower.avatar_url ?? null })));
    } else {
      const { data } = await supabase
        .from('follows')
        .select('following:profiles!following_id ( id, name, username, avatar_url )')
        .eq('follower_id', profile.id);
      setFollowingList((data ?? []).map((r: any) => ({ id: r.following.id, name: r.following.name ?? '', username: r.following.username ?? '', avatarUrl: r.following.avatar_url ?? null })));
    }
    setLoadingList(false);
  };

  const handleFollow = () => {
    const nowFollowing = !following;
    setFollowing(nowFollowing);
    setFollowerCount(c => c + (nowFollowing ? 1 : -1));
    onToggleFollow();
  };

  const totalPlaces = posts.reduce((n, p) => n + p.places.length, 0);

  // ── Post detail view ─────────────────────────────────────────────
  if (selectedPost) {
    const images = selectedPost.places.map(pl => pl.photoUrl).filter(Boolean);
    const labels = selectedPost.places.map(pl => pl.name);
    return (
      <div className="bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
          <button onClick={() => setSelectedPost(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-slate-400">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{profile.name}</p>
            <p className="text-xs text-gray-400">{new Date(selectedPost.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        {images.length > 0 && <ImageCarousel images={images} labels={labels} />}

        <div className="px-4 pt-3 pb-4 border-b border-gray-100">
          <p className="text-sm text-gray-800 leading-relaxed">{selectedPost.caption}</p>
          {selectedPost.locationLabel && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <MapPin size={10} strokeWidth={1.5} />{selectedPost.locationLabel}
            </p>
          )}
        </div>

        <div className="px-4 pt-4 pb-10">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {selectedPost.places.length} Place{selectedPost.places.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            {selectedPost.places.map(place => (
              <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-3">
                {place.photoUrl && (
                  <img src={place.photoUrl} alt={place.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                    <MapPin size={10} strokeWidth={1.5} className="flex-shrink-0" />
                    {place.city}, {place.country}
                  </p>
                  {place.category && <p className="text-xs text-gray-400 mt-0.5">{place.category}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Follow list view ─────────────────────────────────────────────
  if (showFollowList) {
    const list = showFollowList === 'followers' ? followerList : followingList;
    const title = showFollowList === 'followers' ? 'Followers' : 'Following';
    return (
      <div className="bg-white min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-gray-100">
          <button onClick={() => setShowFollowList(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">{title}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {loadingList ? (
            <div className="space-y-4 px-4 pt-4">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-28" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length > 0 ? list.map(u => {
            const ini = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-400">{ini || '?'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400">@{u.username}</p>
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-3xl mb-3">{showFollowList === 'followers' ? '👥' : '🔍'}</p>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {showFollowList === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Top nav — mirrors Profile.tsx */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
          <ArrowLeft size={18} strokeWidth={1.5} className="text-gray-700" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-900 leading-tight">{profile.name}</h2>
          <p className="text-xs text-gray-400">@{profile.username}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Profile header */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-16 h-16 rounded-full object-cover object-top flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-slate-400">{initials || '?'}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <button
              onClick={handleFollow}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                following ? 'bg-gray-100 text-gray-600' : 'bg-slate-900 text-white'
              }`}
            >
              {following ? <><Check size={13} strokeWidth={2} />Following</> : <>Follow</>}
            </button>
          </div>
        </div>

        {/* Stats — Posts / Places / Followers / Following */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { value: posts.length, label: 'Posts', action: null },
            { value: totalPlaces, label: 'Places', action: null },
            { value: followerCount, label: 'Followers', action: () => openFollowList('followers') },
            { value: followingCount, label: 'Following', action: () => openFollowList('following') },
          ].map(stat => (
            <button key={stat.label} onClick={stat.action ?? undefined} className="text-center">
              <p className="text-base font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs — identical to Profile.tsx */}
      <div className="grid grid-cols-3 border-b border-gray-100 border-t">
        {(['Posts', 'Map', 'Collections'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-gray-900 font-bold border-b-2 border-gray-900 -mb-px' : 'text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {activeTab === 'Posts' && (
        loadingPosts ? (
          <div className="grid grid-cols-3 gap-px bg-gray-100 mt-px">
            {[0,1,2,3,4,5].map(i => <div key={i} className="aspect-square bg-gray-50 animate-pulse" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <span className="text-3xl">📍</span>
            </div>
            <p className="text-slate-800 font-semibold text-base mb-1.5">No posts yet</p>
            <p className="text-slate-400 text-sm text-center max-w-[200px]">
              When {profile.name.split(' ')[0]} posts, you'll see them here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-px bg-gray-100">
            {posts.map(post => {
              const firstImage = post.places[0]?.photoUrl;
              if (!firstImage) return null;
              return (
                <button key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-white relative">
                  <img src={firstImage} alt="" className="w-full h-full object-cover" />
                  {post.places.length > 1 && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="grid grid-cols-2 gap-px w-2.5 h-2.5">
                        <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                        <div className="bg-white rounded-[1px]" /><div className="bg-white rounded-[1px]" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Map tab */}
      {activeTab === 'Map' && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <span className="text-3xl">🗺️</span>
          </div>
          <p className="text-slate-800 font-semibold text-base mb-1.5">Travel map</p>
          <p className="text-slate-400 text-sm text-center max-w-[200px]">
            {profile.name.split(' ')[0]}'s travel map will appear here
          </p>
        </div>
      )}

      {/* Collections tab */}
      {activeTab === 'Collections' && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <span className="text-3xl">🗂️</span>
          </div>
          <p className="text-slate-800 font-semibold text-base mb-1.5">No collections yet</p>
          <p className="text-slate-400 text-sm text-center max-w-[200px]">
            Collections {profile.name.split(' ')[0]} creates will appear here
          </p>
        </div>
      )}
    </div>
  );
}
