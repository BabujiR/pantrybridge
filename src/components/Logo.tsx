import React from 'react';

/** PantryBridge mark: a bridge arch over a bowl of produce. Inline SVG so it works offline. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#1F6F4A" />
      <path d="M7 24 Q24 6 41 24" fill="none" stroke="#F28C28" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M13 18.5v5.5M19 14.5v9.5M24 13v11M29 14.5v9.5M35 18.5v5.5" stroke="#F8D9B6" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="19" cy="28.5" r="3.6" fill="#F28C28" />
      <circle cx="25.5" cy="27.5" r="3.9" fill="#9BD27A" />
      <circle cx="31" cy="29" r="3.2" fill="#F5C04A" />
      <path d="M10 30h28a14 9 0 0 1-28 0Z" fill="#fff" />
      <path d="M17 40h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <LogoMark size={size} />
      <span className="logo-text"><b>Pantry</b>Bridge</span>
    </span>
  );
}
