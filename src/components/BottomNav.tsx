import { Home, Compass, Plus, Bookmark, User } from 'lucide-react';
import type { Tab } from '../types';
import type { LucideIcon } from 'lucide-react';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; icon: LucideIcon; label: string }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'explore', icon: Compass, label: 'Explore' },
  { id: 'add', icon: Plus, label: 'Add' },
  { id: 'saved', icon: Bookmark, label: 'Saved' },
  { id: 'profile', icon: User, label: 'Profile' },
];

export default function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white border-t border-gray-100 z-50">
      <div className="flex items-center justify-around px-2 pt-2 pb-3">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-col items-center gap-1 px-3 relative"
            >
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-gray-900 rounded-full" />
              )}
              <Icon
                size={22}
                strokeWidth={1.5}
                className={isActive ? 'text-gray-900' : 'text-gray-400'}
              />
              <span className={`text-xs ${isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
