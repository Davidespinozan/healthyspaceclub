/** Elegant 3D-style SVG icons for the Nutrition card menu & sidebar */

const S = { width: 40, height: 40 };

/* ── Sidebar / general icons ── */

export function BookIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Book body */}
      <path d="M14 8h32c2 0 4 2 4 4v40c0 2-2 4-4 4H14V8z" fill="#4a8c5c" />
      {/* Spine shadow */}
      <path d="M14 8h5v48h-5V8z" fill="#3a7048" />
      {/* Spine highlight */}
      <path d="M14 8h2.5v48H14V8z" fill="#5a9e6c" opacity=".5" />
      {/* Cover shine */}
      <path d="M21 8h25c2 0 4 2 4 4v40c0 2-2 4-4 4H21V8z" fill="#52985e" opacity=".3" />
      {/* Pages edge (bottom) */}
      <rect x="16" y="50" width="30" height="3" rx="1" fill="#e8e2d4" />
      {/* Cover border lines */}
      <rect x="22" y="14" width="22" height="1.5" rx=".75" fill="#6ab47a" opacity=".6" />
      <rect x="22" y="48" width="22" height="1.5" rx=".75" fill="#6ab47a" opacity=".6" />
      {/* Title area */}
      <rect x="24" y="22" width="18" height="2" rx="1" fill="#d4e8d8" opacity=".7" />
      <rect x="26" y="27" width="14" height="1.5" rx=".75" fill="#d4e8d8" opacity=".5" />
      {/* Center emblem */}
      <circle cx="33" cy="36" r="5" fill="#3a7048" opacity=".3" />
      <path d="M31 35l2 2 4-4" stroke="#d4e8d8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
    </svg>
  );
}

export function ClipboardSmallIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Board */}
      <rect x="14" y="12" width="36" height="44" rx="4" fill="#b8a88a" />
      <rect x="16" y="14" width="32" height="40" rx="3" fill="#c4b496" />
      {/* Paper */}
      <rect x="19" y="19" width="26" height="33" rx="2" fill="#f5f0e6" />
      {/* Clip */}
      <rect x="25" y="7" width="14" height="11" rx="2.5" fill="#8a8a8a" stroke="#777" strokeWidth="1" />
      <rect x="28" y="7" width="8" height="4" rx="2" fill="#999" />
      {/* Checkbox lines */}
      <rect x="22" y="24" width="4" height="4" rx="1" fill="none" stroke="#c4baa8" strokeWidth="1.2" />
      <rect x="29" y="25" width="12" height="2" rx="1" fill="#c4baa8" />
      <rect x="22" y="32" width="4" height="4" rx="1" fill="none" stroke="#c4baa8" strokeWidth="1.2" />
      <rect x="29" y="33" width="10" height="2" rx="1" fill="#c4baa8" />
      <rect x="22" y="40" width="4" height="4" rx="1" fill="none" stroke="#c4baa8" strokeWidth="1.2" />
      <rect x="29" y="41" width="13" height="2" rx="1" fill="#c4baa8" />
    </svg>
  );
}

/* ── Nutrition card menu icons ── */

export function ClipboardIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Board */}
      <rect x="12" y="10" width="40" height="48" rx="4" fill="#c4a265" />
      <rect x="14" y="12" width="36" height="44" rx="3" fill="#d4b06a" />
      {/* Paper */}
      <rect x="18" y="18" width="28" height="36" rx="2" fill="#f5f0e6" />
      {/* Clip */}
      <rect x="24" y="6" width="16" height="12" rx="3" fill="#8a8a8a" />
      <rect x="26" y="8" width="12" height="8" rx="2" fill="#a0a0a0" />
      <rect x="28" y="6" width="8" height="4" rx="2" fill="#909090" />
      {/* Text lines */}
      <rect x="22" y="24" width="20" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="30" width="18" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="36" width="20" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="42" width="14" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="48" width="16" height="2.5" rx="1" fill="#c4baa8" />
    </svg>
  );
}

export function QuestionIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Question mark - bold 3D red */}
      <path
        d="M26 20c0-6 5-10 10-10s10 4 10 10c0 5-4 7-7 9-2 1.5-3 3-3 5v2"
        stroke="#cc2d2d" strokeWidth="7" strokeLinecap="round" fill="none"
      />
      {/* Shadow */}
      <path
        d="M26 20c0-6 5-10 10-10s10 4 10 10c0 5-4 7-7 9-2 1.5-3 3-3 5v2"
        stroke="#a01e1e" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".25" transform="translate(1.5,1.5)"
      />
      {/* Main stroke on top */}
      <path
        d="M26 20c0-6 5-10 10-10s10 4 10 10c0 5-4 7-7 9-2 1.5-3 3-3 5v2"
        stroke="#dd3333" strokeWidth="6" strokeLinecap="round" fill="none"
      />
      {/* Highlight */}
      <path
        d="M28 19c0-4.5 3.5-8 8-8"
        stroke="#ff6666" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".6"
      />
      {/* Dot */}
      <circle cx="36" cy="52" r="4.5" fill="#dd3333" />
      <circle cx="36" cy="52" r="4.5" fill="#a01e1e" opacity=".2" transform="translate(1,1)" />
      <circle cx="35" cy="51" r="2" fill="#ff6666" opacity=".4" />
    </svg>
  );
}

export function ScaleIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Base */}
      <rect x="20" y="54" width="24" height="4" rx="2" fill="#5a6e8a" />
      {/* Pillar */}
      <rect x="30" y="14" width="4" height="42" rx="1" fill="#708aaa" />
      {/* Top crown */}
      <circle cx="32" cy="13" r="4" fill="#5a6e8a" />
      <circle cx="32" cy="12.5" r="2.5" fill="#8aa0bb" />
      {/* Beam */}
      <rect x="8" y="16" width="48" height="3" rx="1.5" fill="#708aaa" />
      {/* Left chain */}
      <line x1="14" y1="19" x2="14" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      <line x1="8" y1="19" x2="8" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      {/* Left pan */}
      <path d="M4 32 Q11 42 18 32Z" fill="#5a6e8a" />
      <path d="M5 32 Q11 40 17 32Z" fill="#8aa0bb" opacity=".5" />
      {/* Right chain */}
      <line x1="50" y1="19" x2="50" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      <line x1="56" y1="19" x2="56" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      {/* Right pan */}
      <path d="M46 32 Q53 42 60 32Z" fill="#5a6e8a" />
      <path d="M47 32 Q53 40 59 32Z" fill="#8aa0bb" opacity=".5" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cart body */}
      <path d="M14 16h4l6 26h24l6-20H22" stroke="#7a7a7a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Cart body fill */}
      <path d="M20 24h30l-5 16H24Z" fill="#c0c0c0" opacity=".3" />
      {/* Cart basket wireframe */}
      <path d="M20 24h30l-5 16H24Z" stroke="#7a7a7a" strokeWidth="2" strokeLinejoin="round" fill="none" />
      {/* Vertical bars */}
      <line x1="26" y1="24" x2="25" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      <line x1="32" y1="24" x2="31" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      <line x1="38" y1="24" x2="37" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      <line x1="44" y1="24" x2="43" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      {/* Handle */}
      <path d="M14 16 L10 10" stroke="#7a7a7a" strokeWidth="3" strokeLinecap="round" />
      {/* Wheels */}
      <circle cx="26" cy="48" r="4" fill="#8a8a8a" />
      <circle cx="26" cy="48" r="2" fill="#b0b0b0" />
      <circle cx="42" cy="48" r="4" fill="#8a8a8a" />
      <circle cx="42" cy="48" r="2" fill="#b0b0b0" />
    </svg>
  );
}

export function JarIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Jar body */}
      <path d="M18 22 C18 20 20 18 22 18 L42 18 C44 18 46 20 46 22 L46 52 C46 56 44 58 40 58 L24 58 C20 58 18 56 18 52Z" fill="#e8e4dc" />
      {/* Glass reflection */}
      <path d="M20 22 C20 21 21 20 22 20 L28 20 L28 54 C28 55 26 56 24 56 C21 56 20 55 20 52Z" fill="#fff" opacity=".35" />
      {/* Jar outline */}
      <path d="M18 22 C18 20 20 18 22 18 L42 18 C44 18 46 20 46 22 L46 52 C46 56 44 58 40 58 L24 58 C20 58 18 56 18 52Z" stroke="#b0a890" strokeWidth="1.5" fill="none" />
      {/* Lid */}
      <rect x="20" y="10" width="24" height="8" rx="3" fill="#c8c0b0" />
      <rect x="20" y="10" width="24" height="8" rx="3" stroke="#a8a090" strokeWidth="1" fill="none" />
      {/* Lid thread lines */}
      <path d="M21 14.5h22" stroke="#a8a090" strokeWidth=".8" />
      <path d="M21 16.5h22" stroke="#a8a090" strokeWidth=".8" />
      {/* Lid top highlight */}
      <rect x="22" y="11" width="10" height="2" rx="1" fill="#ddd8cc" opacity=".6" />
      {/* Rim */}
      <rect x="17" y="17" width="30" height="3" rx="1.5" fill="#c0b8a8" />
    </svg>
  );
}
