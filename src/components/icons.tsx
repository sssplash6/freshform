/** Shared 24-viewBox stroke icons; size with h-/w- classes. */

function Svg({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 12h16" />
      <path d="m13 5 7 7-7 7" />
    </Svg>
  );
}

export function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M20 12H4" />
      <path d="m11 19-7-7 7-7" />
    </Svg>
  );
}

export function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </Svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

/** Filled star (rating control), unlike the stroke icons above. */
export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.5c.3 0 .58.17.71.45l2.6 5.27 5.82.85c.65.09.9.89.44 1.34l-4.21 4.1 1 5.8a.79.79 0 0 1-1.15.83L12 18.4l-5.2 2.74a.79.79 0 0 1-1.15-.83l.99-5.8-4.21-4.1a.79.79 0 0 1 .44-1.34l5.82-.85 2.6-5.27a.79.79 0 0 1 .71-.45Z" />
    </svg>
  );
}
