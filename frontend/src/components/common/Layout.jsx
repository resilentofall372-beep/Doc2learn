import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, LogOut, Menu, Radio, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../ui/Logo';
import Avatar from '../ui/Avatar';
import ThemeToggle from './ThemeToggle';
import Notification from './Notification';

const NAV = [
  { to: '/projects', label: 'Projects', icon: FolderOpen, match: ['/projects'] },
  { to: '/study-rooms', label: 'Live quizzes', icon: Radio, match: ['/study-rooms', '/create-quiz-room', '/room', '/join'] },
];

export const LogoutButton = ({ className = '', withLabel = false }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await logout();
        navigate('/', { replace: true });
      }}
      className={`btn btn-ghost ${withLabel ? '' : 'btn-icon'} ${className}`}
      aria-label="Log out"
      title="Log out"
    >
      <LogOut className="h-4 w-4" />
      {withLabel && 'Log out'}
    </button>
  );
};

const SidebarContent = ({ onNavigate }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo to="/projects" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, match }) => {
          const active = match.some((prefix) => pathname.startsWith(prefix));
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <ThemeToggle withLabel className="w-full" />
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.name}</p>
            <p className="muted truncate text-xs">{user?.email}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
};

const AppShell = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 lg:hidden">
        <Logo to="/projects" />
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-950/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              className="btn btn-ghost btn-icon absolute right-2 top-2.5"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
      <Notification />
    </div>
  );
};

/** Layout for visitors who are not signed in (guest players joining a live quiz). */
const PublicShell = ({ children }) => (
  <div className="min-h-screen">
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo to="/" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login" className="btn btn-ghost btn-sm">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-primary btn-sm">
            Sign up
          </Link>
        </div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    <Notification />
  </div>
);

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppShell>{children}</AppShell> : <PublicShell>{children}</PublicShell>;
};

export default Layout;
