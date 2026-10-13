const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const XIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const UpIcon = () => (
  <svg {...base}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);
export const DownIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);
export const SwapIcon = () => (
  <svg {...base}>
    <path d="M7 7h12l-4-4M17 17H5l4 4" />
  </svg>
);
export const PaletteIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);
export const GripIcon = () => (
  <svg {...base} strokeWidth={0} fill="currentColor">
    {[6, 12, 18].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.6" />
        <circle cx="15" cy={y} r="1.6" />
      </g>
    ))}
  </svg>
);
export const PrintIcon = () => (
  <svg {...base}>
    <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v7H6z" />
  </svg>
);
export const StickyIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden focusable={false}>
    <path
      d="M4 4h16v10l-6 6H4z"
      fill="#ffdc83"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
    />
    <path d="M14 20v-6h6" fill="#f5c04a" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" />
    <path d="M8 9h8M8 12.5h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);
export const MoveIcon = () => (
  <svg {...base}>
    <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </svg>
);
export const ExternalIcon = () => (
  <svg {...base} width={14} height={14}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
