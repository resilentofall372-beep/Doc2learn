import { Link } from 'react-router-dom';

export const LogoMark = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="7" className="fill-primary-600" />
    <path
      d="M9 9.5c2.6-.9 5-.6 7 1v12c-2-1.6-4.4-1.9-7-1zM23 9.5c-2.6-.9-5-.6-7 1v12c2-1.6 4.4-1.9 7-1z"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const Logo = ({ to = '/', className = '' }) => (
  <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark />
    <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Doc2Learn</span>
  </Link>
);

export default Logo;
