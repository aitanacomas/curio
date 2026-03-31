import { useState, useEffect } from 'react';
import type { Tab, AppUser } from './types';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Add from './pages/Add';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import { supabase, getProfile } from './lib/supabase';

type AuthStage = 'loading' | 'auth' | 'onboarding' | 'app';

interface PostToast {
  label: string;
  sub: string;
}

export default function App() {
  const [authStage, setAuthStage] = useState<AuthStage>('loading');
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showMessages, setShowMessages] = useState(false);
  const [postToast, setPostToast] = useState<PostToast | null>(null);

  // ── Restore session on mount ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await getProfile(session.user.id);
        if (profile) {
          setAppUser({
            id: session.user.id,
            name: profile.name,
            username: profile.username,
            avatar: profile.avatar_url ?? null,
            isDemo: false,
            followingCount: profile.following_count ?? 0,
          });
          setAuthStage('app');
          return;
        }
      }
      setAuthStage('auth');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAuthStage('auth');
        setAppUser(null);
        setActiveTab('home');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = (user: AppUser, isNewUser: boolean) => {
    setAppUser(user);
    setAuthStage(isNewUser ? 'onboarding' : 'app');
  };

  const handleOnboardingComplete = (followingCount: number) => {
    setAppUser(prev => prev ? { ...prev, followingCount } : prev);
    setAuthStage('app');
  };

  const handleLogout = async () => {
    if (appUser?.isDemo) {
      setAuthStage('auth');
      setAppUser(null);
      setActiveTab('home');
    } else {
      await supabase.auth.signOut();
    }
  };

  const openMessages = () => { setActiveTab('home'); setShowMessages(true); };

  // ── Loading ──────────────────────────────────────────────────────
  if (authStage === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-4xl font-black text-gray-900 tracking-tight animate-pulse">curio</p>
      </div>
    );
  }

  // ── Auth ─────────────────────────────────────────────────────────
  if (authStage === 'auth') {
    return (
      <div className="min-h-screen bg-slate-100 flex justify-center items-start">
        <div className="w-full max-w-sm bg-white min-h-screen relative shadow-2xl">
          <Auth onAuth={handleAuth} />
        </div>
      </div>
    );
  }

  // ── Onboarding ───────────────────────────────────────────────────
  if (authStage === 'onboarding' && appUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex justify-center items-start">
        <div className="w-full max-w-sm bg-white min-h-screen relative shadow-2xl overflow-y-auto">
          <Onboarding
            firstName={appUser.name.split(' ')[0]}
            onComplete={handleOnboardingComplete}
          />
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home':
        return <Home showMessages={showMessages} onMessagesClose={() => setShowMessages(false)} isNewUser={appUser?.isDemo === false} appUser={appUser ?? undefined} onNavigate={setActiveTab} />;
      case 'explore':
        return <Explore onOpenMessages={openMessages} appUser={appUser ?? undefined} />;
      case 'add':
        return (
          <Add
            userId={appUser?.id ?? ''}
            userAvatar={appUser?.avatar ?? null}
            onComplete={({ visibility, placesCount }) => {
              const label = visibility === 'feed' ? 'Posted to curio' : visibility === 'profile' ? 'Shared with followers' : 'Saved privately';
              setPostToast({ label, sub: `${placesCount} place${placesCount > 1 ? 's' : ''} tagged` });
              setActiveTab('home');
              setTimeout(() => setPostToast(null), 3500);
            }}
          />
        );
      case 'saved':
        return <Saved isNewUser={appUser?.isDemo === false} />;
      case 'profile':
        return <Profile onOpenMessages={openMessages} appUser={appUser ?? undefined} onLogout={handleLogout} onNavigate={setActiveTab} onProfileUpdate={(updates) => setAppUser(prev => prev ? { ...prev, ...updates } : prev)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start">
      <div className="w-full max-w-sm bg-white min-h-screen relative flex flex-col shadow-2xl">
        <main className="flex-1 overflow-y-auto pb-20">
          {renderPage()}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Post toast */}
        <div
          className="absolute top-4 left-4 right-4 z-50 pointer-events-none"
          style={{
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            opacity: postToast ? 1 : 0,
            transform: postToast ? 'translateY(0)' : 'translateY(-12px)',
          }}
        >
          <div className="flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-4 py-3.5 shadow-xl">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{postToast?.label}</p>
              <p className="text-xs text-white/60 mt-0.5">{postToast?.sub}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
