import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileUp, FolderPlus, MessageSquareText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LogoutButton } from '../components/common/Layout';
import ThemeToggle from '../components/common/ThemeToggle';
import Notification from '../components/common/Notification';
import Logo from '../components/ui/Logo';
import { PRODUCT_POINTS } from '../utils/productPoints';

const STEPS = [
  { icon: FolderPlus, title: 'Create a project', text: 'One for each subject, e.g. "Biology 101".' },
  { icon: FileUp, title: 'Add your material', text: 'Upload PDFs, slides, Word files, notes or photos of pages.' },
  { icon: MessageSquareText, title: 'Study it', text: 'Ask the tutor, take quizzes, flip flashcards, explore the concept map.' },
];

const Home = () => {
  const { isAuthenticated, user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/" />
          <nav className="flex items-center gap-2" aria-label="Account">
            <ThemeToggle />
            {loading ? null : isAuthenticated ? (
              <>
                <span className="muted hidden text-sm sm:inline">{user?.name}</span>
                <Link to="/projects" className="btn btn-primary btn-sm">
                  Open projects
                </Link>
                <LogoutButton withLabel className="btn-sm" />
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Log in
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <p className="eyebrow">Study with your own material</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Turn your notes into a tutor that shows its sources.
          </h1>
          <p className="muted mx-auto mt-5 max-w-2xl text-base sm:text-lg">
            Organise each subject as a project, upload your documents, and get answers, quizzes and flashcards that
            point back to the exact file and page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {isAuthenticated ? (
              <Link to="/projects" className="btn btn-primary btn-lg">
                Open your projects
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Create a free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg">
                  Log in
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">How it works</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="muted text-xs font-medium">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{title}</h3>
                  <p className="muted mt-1 text-sm">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-primary-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="muted mt-0.5 text-sm">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="muted mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs sm:px-6">
          <span>Doc2Learn</span>
          <span>Answers come only from your documents.</span>
        </div>
      </footer>
      <Notification />
    </div>
  );
};

export default Home;
