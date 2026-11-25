import { Loader2 } from 'lucide-react';

const SIZES = { small: 'h-4 w-4', medium: 'h-6 w-6', large: 'h-8 w-8' };

const LoadingSpinner = ({ size = 'medium', className = '', label }) => (
  <div className={`flex items-center justify-center gap-3 ${className}`} role="status">
    <Loader2 className={`animate-spin text-zinc-400 ${SIZES[size]}`} />
    {label ? <span className="muted text-sm">{label}</span> : <span className="sr-only">Loading</span>}
  </div>
);

export const PageLoader = ({ label }) => <LoadingSpinner size="medium" label={label} className="py-24" />;

export default LoadingSpinner;
