import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Logo from '../ui/Logo';
import ThemeToggle from './ThemeToggle';
import Notification from './Notification';
import { PRODUCT_POINTS } from '../../utils/productPoints';

const POINTS = PRODUCT_POINTS.slice(1);

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <div className="flex flex-col px-6 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo to="/" />
          <Link to="/" className="muted hidden items-center gap-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-100 sm:inline-flex">
            <ChevronLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="muted mt-2 text-sm">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="muted mt-8 text-center text-sm">{footer}</div>}
        </div>
      </div>
    </div>

    <div className="relative hidden overflow-hidden border-l border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 lg:flex lg:items-center">
      <div
        className="absolute inset-0 opacity-60 dark:opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(161 161 170 / 0.35) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="relative mx-auto max-w-md px-10">
        <p className="eyebrow">Doc2Learn</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
          Turn your notes into a tutor that shows its sources.
        </h2>
        <ul className="mt-10 space-y-6">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-primary-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="muted mt-0.5 text-sm">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
    <Notification />
  </div>
);

export default AuthLayout;
