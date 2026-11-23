import React, { useState } from 'react';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-16 h-16 text-lg',
};

const BG_PALETTE = [
  'bg-[#1B3B2B] text-[#FAF9F6]',
  'bg-[#2C4A6E] text-white',
  'bg-[#5B427A] text-white',
  'bg-[#7C5A2B] text-white',
  'bg-[#2C6B5B] text-white',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
}

function getColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % BG_PALETTE.length;
  }
  return BG_PALETTE[Math.abs(hash)];
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-[#E6E4DC] dark:border-[#2C312E] shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      title={name}
      className={`${SIZE_CLASSES[size]} ${getColorClass(name)} rounded-full inline-flex items-center justify-center font-semibold shrink-0 border border-white/40 dark:border-[#2C312E] ${className}`}
    >
      {getInitials(name)}
    </span>
  );
};
