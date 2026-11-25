import { useEffect, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, FolderOpen, LogOut, Menu, Plus, Radio, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectData } from '../../services/projectStore';
import { SECTIONS, sectionFor } from '../projects/sections';
import Logo from '../ui/Logo';
import Avatar, { colorFor } from '../ui/Avatar';
import ThemeToggle from './ThemeToggle';
import Notification from './Notification';

const GLOBAL_NAV = [
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

const navItem = (active, nested = false) =>
  `flex items-center gap-3 rounded-lg ${nested ? 'py-1.5 pl-9 pr-3 text-[13px]' : 'px-3 py-2 text-sm'} font-medium transition-colors ${
    active
      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
      : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
  }`;

/** The project's own menu: its sections in study order. */
const ProjectNav = ({ projectId, pathname, onNavigate }) => {
  const data = useProjectData(projectId);
  const base = `/projects/${projectId}`;
  const { section: current, page } = sectionFor(pathname.slice(base.length));
  const project = data?.project;
  const count = data?.documents?.length;

  return (
    <div className="px-3 pt-3">
      <Link to="/projects" onClick={onNavigate} className="muted mb-3 inline-flex items-center gap-1 px-1 text-xs font-medium hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="h-3.5 w-3.5" />
        All projects
      </Link>
      <Link to={base} onClick={onNavigate} className="mb-3 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800">
        <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-sm font-semibold text-white ${project ? colorFor(project.color, project.name) : 'bg-zinc-300 dark:bg-zinc-700'}`}>
          {project?.name?.slice(0, 1).toUpperCase() || ''}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{project?.name || 'Loading…'}</span>
          <span className="muted block text-xs">{count == null ? ' ' : `${count} ${count === 1 ? 'document' : 'documents'}`}</span>
        </span>
      </Link>

      <nav className="space-y-0.5" aria-label="Project">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = current.key === section.key;
          return (
            <div key={section.key}>
              <Link to={`${base}${section.path}`} onClick={onNavigate} className={navItem(active && !section.children)} aria-current={active ? 'page' : undefined}>
                <Icon className="h-4 w-4" strokeWidth={2} />
                {section.label}
              </Link>
              {section.children && (
                <div className="mt-0.5 space-y-0.5">
                  {section.children.map((child) => {
                    const childActive = page.child?.key === child.key;
                    return (
                      <Link key={child.key} to={`${base}${child.path}`} onClick={onNavigate} className={navItem(childActive, true)} aria-current={childActive ? 'page' : undefined}>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <Link to={`${pathname}?add=1`} onClick={onNavigate} className="btn btn-secondary btn-sm mt-4 w-full">
        <Plus className="h-3.5 w-3.5" />
        Add documents
      </Link>
    </div>
  );
};

const SidebarContent = ({ onNavigate }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const inProject = matchPath('/projects/:projectId/*', pathname);
  const projectId = inProject?.params.projectId;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 flex-shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Logo to="/projects" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {projectId && <ProjectNav projectId={projectId} pathname={pathname} onNavigate={onNavigate} />}

        <nav className={`space-y-0.5 px-3 ${projectId ? 'mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800' : 'py-4'}`} aria-label="Main">
          {projectId && <p className="eyebrow mb-1 px-3 text-[11px]">Workspace</p>}
          {GLOBAL_NAV.map(({ to, label, icon: Icon, match }) => {
            const active = !projectId && match.some((prefix) => pathname.startsWith(prefix));
            return (
              <Link key={to} to={to} onClick={onNavigate} className={navItem(active)}>
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-shrink-0 space-y-1 border-t border-zinc-200 p-3 dark:border-zinc-800">
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
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
            <button type="button" className="btn btn-ghost btn-icon absolute right-2 top-2.5 z-10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
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
