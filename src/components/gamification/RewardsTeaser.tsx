"use client";

/**
 * RewardsTeaser — Task 3.4
 *
 * Gamification placeholder shown in P1 (feature-flagged).
 * Visible but locked — teases P2 rewards programme.
 * When gamification_phase_a flag turns ON in P2, this is replaced
 * by the live LeaderboardWidget + StreakBadge components.
 */
export function RewardsTeaser() {
  return (
    <div
      className="rewards-teaser"
      aria-label="Rewards programme — coming soon"
    >
      <div className="rewards-teaser-header">
        <span className="rewards-teaser-trophy" aria-hidden="true">🏆</span>
        <div>
          <h3 className="rewards-teaser-title">Points &amp; Rewards</h3>
          <p className="rewards-teaser-sub">Launching soon in your city</p>
        </div>
        <span className="rewards-teaser-badge">Beta</span>
      </div>

      <p className="rewards-teaser-desc">
        Earn points for every health action — searching, booking, staying
        informed. Top patients in your city get featured on the leaderboard.
      </p>

      {/* Locked stats preview */}
      <div className="rewards-teaser-stats" aria-hidden="true">
        <div className="rewards-stat">
          <span className="rewards-stat-value">—</span>
          <span className="rewards-stat-label">Your Points</span>
        </div>
        <div className="rewards-stat">
          <span className="rewards-stat-value">—</span>
          <span className="rewards-stat-label">City Rank</span>
        </div>
        <div className="rewards-stat">
          <span className="rewards-stat-value">—</span>
          <span className="rewards-stat-label">🔥 Streak</span>
        </div>
      </div>

      <p className="rewards-teaser-cta">
        Rewards programme launching soon. Stay tuned!
      </p>

      <style>{`
        .rewards-teaser {
          border-radius: 16px;
          border: 1.5px solid #bfdbfe;
          background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
          padding: 20px;
          margin: 0;
        }

        .rewards-teaser-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .rewards-teaser-trophy {
          font-size: 1.75rem;
          flex-shrink: 0;
        }

        .rewards-teaser-title {
          font-size: 1rem;
          font-weight: 700;
          color: #1e3a5f;
          margin: 0;
        }

        .rewards-teaser-sub {
          font-size: 0.8125rem;
          color: #2563eb;
          margin: 2px 0 0;
          font-weight: 600;
        }

        .rewards-teaser-badge {
          margin-left: auto;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #2563eb;
          background: #dbeafe;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 3px 10px;
          white-space: nowrap;
        }

        .rewards-teaser-desc {
          font-size: 0.875rem;
          color: #374151;
          line-height: 1.65;
          margin: 0 0 16px;
        }

        .rewards-teaser-stats {
          display: flex;
          gap: 0;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 12px;
          opacity: 0.55;
          pointer-events: none;
          user-select: none;
        }

        .rewards-stat {
          flex: 1;
          text-align: center;
          padding: 12px 8px;
          border-right: 1px solid #dbeafe;
          background: rgba(255,255,255,0.7);
        }

        .rewards-stat:last-child { border-right: none; }

        .rewards-stat-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 800;
          color: #2563eb;
        }

        .rewards-stat-label {
          display: block;
          font-size: 0.7rem;
          color: #6b7280;
          margin-top: 2px;
          font-weight: 600;
        }

        .rewards-teaser-cta {
          font-size: 0.75rem;
          color: #9ca3af;
          text-align: center;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
