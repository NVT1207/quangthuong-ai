export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <defs>
          <linearGradient id="qt-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <path
          d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z"
          fill="url(#qt-grad)"
          stroke="#78350f"
          strokeWidth="1.5"
        />
        <text x="20" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="#451a03" fontFamily="ui-sans-serif, system-ui">QT</text>
      </svg>
      <span className="font-bold text-lg tracking-tight">
        QUANG<span className="text-honey-400">THUONG</span> AI
      </span>
    </div>
  );
}
