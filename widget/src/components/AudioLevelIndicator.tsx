// ─── Audio Level Indicator (VU Meter) ───
// Compact visual indicator showing real-time microphone audio level.
// Design: 5 thin vertical bars next to a mic icon, height proportional to audio level.
//
// Uses only inline styles + CSS variables (rc- prefix) for Shadow DOM compatibility.
// No Tailwind classes — the widget uses Shadow DOM IIFE build.

import React, { useMemo } from 'react';
import type { MicStatus } from '../lib/audio-level-monitor';

export interface AudioLevelIndicatorProps {
  /** Audio level 0.0 - 1.0 */
  level: number;
  /** Peak level 0.0 - 1.0 (shown as bright top on highest bar) */
  peak?: number;
  /** Current microphone status */
  micStatus: MicStatus;
  /** Smaller version for inline use */
  compact?: boolean;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

// ─── Bar configuration ───
const BAR_COUNT = 5;
const BAR_THRESHOLDS = [0.05, 0.2, 0.4, 0.6, 0.8]; // each bar activates at this level

// ─── Colors per status ───
const STATUS_COLORS: Record<MicStatus, { active: string; inactive: string; glow: string }> = {
  active: {
    active: '#00D084',    // var(--rc-success) green
    inactive: 'rgba(0, 208, 132, 0.2)',
    glow: 'rgba(0, 208, 132, 0.4)',
  },
  silent: {
    active: '#FCB900',    // var(--rc-warning) yellow
    inactive: 'rgba(252, 185, 0, 0.2)',
    glow: 'rgba(252, 185, 0, 0.3)',
  },
  muted: {
    active: '#CF2E2E',    // var(--rc-error) red
    inactive: 'rgba(207, 46, 46, 0.15)',
    glow: 'none',
  },
  disconnected: {
    active: '#8B92A8',    // var(--rc-text-tertiary) gray
    inactive: 'rgba(139, 146, 168, 0.15)',
    glow: 'none',
  },
};

// ─── Mic SVG Icons ───
function MicIcon({ status, size }: { status: MicStatus; size: number }) {
  const color = STATUS_COLORS[status].active;

  if (status === 'muted') {
    // Mic with strikethrough line
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
        <path d="M17 16.95A7 7 0 015 12" />
        <path d="M19 12a7 7 0 01-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  }

  if (status === 'disconnected') {
    // Mic with X overlay
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" opacity="0.4" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" opacity="0.4" />
        <line x1="12" y1="19" x2="12" y2="23" opacity="0.4" />
        <line x1="8" y1="23" x2="16" y2="23" opacity="0.4" />
        {/* X overlay */}
        <line x1="17" y1="7" x2="23" y2="13" stroke={color} strokeWidth="2.5" />
        <line x1="23" y1="7" x2="17" y2="13" stroke={color} strokeWidth="2.5" />
      </svg>
    );
  }

  // Normal mic (active or silent)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function AudioLevelIndicator({
  level,
  peak = 0,
  micStatus,
  compact = false,
  style,
}: AudioLevelIndicatorProps) {
  const colors = STATUS_COLORS[micStatus];
  const iconSize = compact ? 14 : 16;
  const barHeight = compact ? 16 : 22;
  const barWidth = compact ? 3 : 4;
  const barGap = compact ? 2 : 3;

  // Calculate which bars are active based on level
  const barStates = useMemo(() => {
    return BAR_THRESHOLDS.map((threshold, index) => {
      if (micStatus === 'muted') {
        return { height: 0.15, isActive: false, isPeak: false };
      }
      if (micStatus === 'disconnected') {
        return { height: 0.15, isActive: false, isPeak: false };
      }

      const isActive = level >= threshold;
      // Calculate proportional height within bar's range
      const nextThreshold = BAR_THRESHOLDS[index + 1] ?? 1.0;
      const range = nextThreshold - threshold;
      const withinRange = Math.max(0, Math.min(1, (level - threshold) / range));
      const height = isActive ? 0.2 + withinRange * 0.8 : 0.15;

      // Peak indicator — show on the bar closest to peak level
      const isPeak = peak > threshold && (index === BAR_COUNT - 1 || peak < (BAR_THRESHOLDS[index + 1] ?? 1.0));

      return { height, isActive, isPeak };
    });
  }, [level, peak, micStatus]);

  // Container styles
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: compact ? '4px' : '6px',
    padding: compact ? '2px 4px' : '3px 6px',
    borderRadius: '6px',
    background: 'rgba(0, 0, 0, 0.05)',
    userSelect: 'none',
    ...style,
  };

  // Bars container
  const barsContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: `${barGap}px`,
    height: `${barHeight}px`,
  };

  // Silent state has a subtle pulse animation via opacity cycling
  const silentPulse = micStatus === 'silent';

  return (
    <div style={containerStyle} role="meter" aria-label="Audio level" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
      <MicIcon status={micStatus} size={iconSize} />

      <div style={barsContainerStyle}>
        {barStates.map((bar, index) => {
          const heightPx = Math.round(bar.height * barHeight);
          const isActive = bar.isActive;

          const barStyle: React.CSSProperties = {
            width: `${barWidth}px`,
            height: `${heightPx}px`,
            minHeight: `${Math.round(0.15 * barHeight)}px`,
            borderRadius: `${barWidth / 2}px`,
            background: isActive ? colors.active : colors.inactive,
            transition: 'height 50ms ease-out, background 150ms ease',
            boxShadow: isActive && colors.glow !== 'none' ? `0 0 4px ${colors.glow}` : 'none',
            // Silent pulse: use CSS animation via opacity
            opacity: silentPulse ? undefined : 1,
            animation: silentPulse ? `rc-silent-pulse 2s ease-in-out infinite ${index * 0.15}s` : 'none',
          };

          // Peak dot overlay
          const showPeakDot = bar.isPeak && micStatus === 'active' && peak > 0.1;

          return (
            <div key={index} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', height: `${barHeight}px` }}>
              <div style={barStyle} />
              {showPeakDot && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${Math.round((1 - peak) * barHeight) - 2}px`,
                    left: '0',
                    width: `${barWidth}px`,
                    height: '2px',
                    borderRadius: '1px',
                    background: colors.active,
                    opacity: 0.7,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Inject keyframe for silent pulse if needed */}
      {silentPulse && (
        <style>{`
          @keyframes rc-silent-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      )}

      {/* Status label for muted state */}
      {micStatus === 'muted' && (
        <span
          style={{
            fontSize: compact ? '9px' : '10px',
            fontWeight: 600,
            color: colors.active,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}
        >
          muted
        </span>
      )}
    </div>
  );
}
