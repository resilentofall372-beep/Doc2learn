// The API sends UTC times, some without a zone suffix; treat those as UTC too.
const asUtc = (iso) => (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

/** Milliseconds since the epoch for an API timestamp (0 when missing). */
export const toTime = (iso) => (iso ? new Date(asUtc(iso)).getTime() || 0 : 0);

/** Documents (in `documents`) uploaded after `generatedAt`: new material something was made without. */
export const newerDocuments = (documents, generatedAt) => {
  const since = toTime(generatedAt);
  return since ? documents.filter((d) => toTime(d.uploaded_on) > since) : [];
};

/** "just now", "5 min ago", "3 h ago", "2 days ago", or a date for anything older than a week. */
export const timeAgo = (iso) => {
  if (!iso) return '';
  const value = asUtc(iso);
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) {
    const days = Math.floor(seconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
