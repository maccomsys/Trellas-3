import React from 'react';

interface TrellasLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const TrellasLogo: React.FC<TrellasLogoProps> = ({ size = 'md', showText = true }) => {
  const boxClass = size === 'sm' ? 'w-7 h-7 rounded-md' : size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg';
  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <span
        className={`${boxClass} bg-[#1B3B2B] dark:bg-[#234E39] text-[#FAF9F6] flex items-center justify-center shadow-xs shrink-0`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 7h14M5 12h14M5 17h14" opacity="0.5" />
          <path d="M8 4v16M16 4v16" />
        </svg>
      </span>
      {showText && (
        <span className={`font-semibold tracking-tight text-[#1C1F1D] dark:text-[#F1F2EE] ${textClass}`}>
          Trellas
        </span>
      )}
    </span>
  );
};
