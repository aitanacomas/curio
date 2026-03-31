import { useState, useRef } from 'react';
import { ArrowLeft, Eye, EyeOff, Camera } from 'lucide-react';
import type { AppUser } from '../types';
import { supabase, getPublicUrl } from '../lib/supabase';

type AuthStep = 'splash' | 'login' | 'signup-1' | 'signup-2' | 'signup-3';

interface AuthProps {
  onAuth: (user: AppUser, isNewUser: boolean) => void;
}

export default function Auth({ onAuth }: AuthProps) {
  const [step, setStep] = useState<AuthStep>('splash');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneDiscoverable, setPhoneDiscoverable] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const usernameEdited = useRef(false);

  const handleUsernameFromName = (first: string) => {
    if (!usernameEdited.current) {
      setUsername(first.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 99));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // ── Real login ───────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (authError) { setError(authError.message); setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    onAuth({
      id: data.user.id,
      name: profile?.name ?? data.user.email ?? '',
      username: profile?.username ?? '',
      avatar: profile?.avatar_url ?? null,
      bio: profile?.bio ?? '',
      isDemo: false,
      followingCount: profile?.following_count ?? 0,
    }, false);
    setLoading(false);
  };

  // ── Real sign-up ─────────────────────────────────────────────────
  const handleSignupComplete = async () => {
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    const userId = data.user!.id;

    // Upload avatar if provided
    let avatarUrl: string | null = null;
    if (avatarFile) {
      const ext = avatarFile.type.split('/')[1] ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });
      if (!uploadError) avatarUrl = getPublicUrl('avatars', path);
    }

    // Read referral param from URL (e.g. ?ref=<userId>)
    const referredBy = new URLSearchParams(window.location.search).get('ref') ?? null;

    // Create profile row — try with all fields, fall back to core fields if new columns don't exist yet
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      name: `${firstName} ${lastName}`.trim(),
      username,
      avatar_url: avatarUrl,
      email,
      phone: phone || null,
      phone_discoverable: phone ? phoneDiscoverable : false,
      referred_by: referredBy,
    });
    if (profileError) {
      // Fallback: insert without optional columns (in case DB migration hasn't run yet)
      await supabase.from('profiles').insert({
        id: userId,
        name: `${firstName} ${lastName}`.trim(),
        username,
        avatar_url: avatarUrl,
      });
    }

    onAuth({
      id: userId,
      name: `${firstName} ${lastName}`.trim(),
      username,
      avatar: avatarUrl,
      bio: '',
      isDemo: false,
      followingCount: 0,
    }, true);
    setLoading(false);
  };

  // ── Demo ─────────────────────────────────────────────────────────
  const handleDemoLogin = () => {
    onAuth({ id: 'demo-user', name: 'Aitana Comas', username: 'aitanacomas', avatar: '/aitana-avatar.jpg', bio: '', isDemo: false, followingCount: 0 }, true);
  };

  const StepDots = ({ current }: { current: number }) => (
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i <= current ? 'w-6 bg-slate-900' : 'w-3 bg-slate-200'}`} />
      ))}
    </div>
  );

  // ── SPLASH ───────────────────────────────────────────────────────
  if (step === 'splash') {
    return (
      <div className="min-h-screen bg-white flex flex-col px-6">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-6xl font-black text-gray-900 tracking-tight">curio</h1>
          <p style={{ color: '#94a3b8', fontSize: '11px', marginTop: '12px', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            collect the places that matter
          </p>
        </div>
        <div className="pb-12 space-y-3">
          <button onClick={() => setStep('signup-1')} className="w-full py-4 rounded-2xl font-semibold text-base" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
            Get started
          </button>
          <button onClick={() => setStep('login')} className="w-full py-4 rounded-2xl font-medium text-base" style={{ backgroundColor: 'transparent', color: '#334155', border: '1px solid #e2e8f0' }}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  // ── LOGIN ────────────────────────────────────────────────────────
  if (step === 'login') {
    const canLogin = loginEmail.includes('@') && loginPassword.length >= 6;
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
        <button onClick={() => setStep('splash')} className="self-start mb-8">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
        <p className="text-slate-500 text-sm mb-8">Log in to your curio account</p>
        <div className="space-y-4 flex-1">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com"
              className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 pr-12" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <button className="text-xs text-slate-400">Forgot password?</button>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        </div>
        <div className="mt-auto pb-10 space-y-3">
          <button onClick={handleLogin} disabled={!canLogin || loading}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base disabled:opacity-40">
            {loading ? 'Logging in…' : 'Log in'}
          </button>
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <button onClick={handleDemoLogin} className="w-full py-3 text-slate-500 text-sm font-medium bg-slate-50 rounded-2xl">
            Continue with demo account
          </button>
        </div>
      </div>
    );
  }

  // ── SIGNUP 1: Name ───────────────────────────────────────────────
  if (step === 'signup-1') {
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setStep('splash')}><ArrowLeft className="w-6 h-6 text-slate-700" /></button>
          <StepDots current={0} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">What's your name?</h1>
        <p className="text-slate-500 text-sm mb-8">How you'll appear to others on curio</p>
        <div className="space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">First name</label>
              <input type="text" value={firstName} placeholder="Sofia"
                onChange={e => { setFirstName(e.target.value); if (e.target.value) handleUsernameFromName(e.target.value); }}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Last name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Reyes"
                className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
              <input type="text" value={username} onChange={e => { usernameEdited.current = true; setUsername(e.target.value); }} placeholder="sofiareyes"
                className="w-full pl-8 pr-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </div>
          </div>
        </div>
        <div className="mt-auto pb-10">
          <button onClick={() => setStep('signup-2')} disabled={!firstName || !username}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base disabled:opacity-40">
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── SIGNUP 2: Email + Password ───────────────────────────────────
  if (step === 'signup-2') {
    const validEmail = email.includes('@') && email.includes('.');
    const validPassword = password.length >= 8;
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setStep('signup-1')}><ArrowLeft className="w-6 h-6 text-slate-700" /></button>
          <StepDots current={1} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
        <p className="text-slate-500 text-sm mb-8">You'll use this to log in</p>
        <div className="space-y-4 flex-1">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
                className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 pr-12" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && !validPassword && (
              <p className="text-xs text-red-400 mt-1.5">Must be at least 8 characters</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Phone number <span className="normal-case text-slate-400 font-normal">(optional)</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900"
              className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
            {phone && (
              <button
                type="button"
                onClick={() => setPhoneDiscoverable(!phoneDiscoverable)}
                className="mt-2.5 flex items-center gap-2.5 w-full"
              >
                <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${phoneDiscoverable ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${phoneDiscoverable ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-slate-500 text-left">Allow people to find me by my phone number</span>
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        </div>
        <div className="mt-auto pb-10">
          <button onClick={() => setStep('signup-3')} disabled={!validEmail || !validPassword}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base disabled:opacity-40">
            Continue
          </button>
          <p className="text-center text-xs text-slate-400 mt-4 px-4">By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    );
  }

  // ── SIGNUP 3: Photo ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => setStep('signup-2')}><ArrowLeft className="w-6 h-6 text-slate-700" /></button>
        <StepDots current={2} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Add a profile photo</h1>
      <p className="text-slate-500 text-sm mb-10">Let people know who you are</p>
      <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <button onClick={() => fileRef.current?.click()}
          className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300">
          {avatarPreview
            ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
            : <div className="flex flex-col items-center gap-2"><Camera className="w-8 h-8 text-slate-400" /><span className="text-xs text-slate-400">Add photo</span></div>
          }
        </button>
        {avatarPreview
          ? <button onClick={() => fileRef.current?.click()} className="text-sm text-slate-600 font-medium">Change photo</button>
          : <p className="text-sm text-slate-400">Tap to choose a photo</p>
        }
      </div>
      {error && <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-3 mb-3">{error}</p>}
      <div className="mt-auto pb-10 space-y-3">
        <button onClick={handleSignupComplete} disabled={loading}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base disabled:opacity-40">
          {loading ? 'Creating account…' : 'Continue'}
        </button>
        <button onClick={handleSignupComplete} disabled={loading} className="w-full py-3 text-slate-400 text-sm disabled:opacity-40">
          Skip for now
        </button>
      </div>
    </div>
  );
}
