interface Props {
  objective: 'mark' | 'reset'
}

/** The board's vocabulary, drawn rather than described. */
export function Legend({ objective }: Props) {
  return (
    <div className="legend">
      <span>
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="11" fill="url(#legend-ghost)" />
          <defs>
            <radialGradient id="legend-ghost" cx="38%" cy="32%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#8fe6ff" />
              <stop offset="100%" stopColor="#2f7fb8" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
        a world you might be in
      </span>
      <span>
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="12" fill="rgba(160,180,210,0.18)" stroke="rgba(205,214,226,0.3)" />
        </svg>
        mud stops a slide
      </span>
      <span>
        <svg viewBox="0 0 40 40">
          <path d="M 8 26 L 20 12 L 32 26" fill="none" stroke="rgba(205,214,226,0.6)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        a ratchet opens one way only
      </span>
      <span>
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(180,165,255,0.7)" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="5" fill="rgba(180,165,255,0.45)" />
        </svg>
        a gate throws you to its twin
      </span>
      <span>
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="13" fill="rgba(5,3,8,0.9)" stroke="rgba(255,143,163,0.5)" strokeWidth="2" />
        </svg>
        a pit, fatal in any world
      </span>
      {objective === 'mark' ? (
        <span>
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="14" fill="none" stroke="#f2d8a0" strokeWidth="1.5" opacity="0.8" />
            <circle cx="20" cy="20" r="9" fill="none" stroke="#f2d8a0" strokeDasharray="3 5" />
          </svg>
          the mark: end here, alone
        </span>
      ) : (
        <span>
          <svg viewBox="0 0 40 40">
            <path d="M 8 20 h 24" stroke="#f2d8a0" strokeWidth="1.5" strokeDasharray="3 5" />
          </svg>
          no mark: collapse anywhere
        </span>
      )}
    </div>
  )
}
