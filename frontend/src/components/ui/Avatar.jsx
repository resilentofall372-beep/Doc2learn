import React from 'react';

// Avatar colours a player can pick. Stored as a short key ("c0".."c7") so the backend stays tiny.
export const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
];

const hash = (text = '') => [...text].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

export const colorFor = (avatar, name) => {
  const match = /^c(\d)$/.exec(avatar || '');
  if (match) return AVATAR_COLORS[Number(match[1]) % AVATAR_COLORS.length];
  return AVATAR_COLORS[hash(name) % AVATAR_COLORS.length];
};

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

const Avatar = ({ name, avatar, size = 'sm', className = '' }) => (
  <span
    className={`inline-grid flex-shrink-0 place-items-center rounded-full font-semibold text-white ${SIZES[size]} ${colorFor(avatar, name)} ${className}`}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
);

export default Avatar;
