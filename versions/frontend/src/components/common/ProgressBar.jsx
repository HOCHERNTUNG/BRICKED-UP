import React from 'react';
import clsx from 'clsx';
import './common.css';

/**
 * LEGO Brick style segmented progress bar
 * @param {number} value - percentage between 0 and 100
 */
export function ProgressBar({ value = 0, className, showText = true, color = 'var(--brick-green)' }) {
  const percent = Math.min(100, Math.max(0, value));
  
  // Calculate how many brick segments are active out of a total of 10 segments
  const totalSegments = 10;
  const activeSegments = Math.round((percent / 100) * totalSegments);

  return (
    <div className={clsx('brick-progress-container', className)}>
      <div className="brick-progress-bar-wrapper">
        <div className="brick-progress-bar-studs">
          {Array.from({ length: totalSegments }).map((_, idx) => {
            const isActive = idx < activeSegments;
            return (
              <div
                key={idx}
                className={clsx('brick-progress-segment', isActive && 'active')}
                style={{
                  backgroundColor: isActive ? color : 'transparent',
                  borderColor: isActive ? 'var(--ink-900)' : 'transparent',
                }}
              >
                <div className="brick-progress-segment-stud" />
              </div>
            );
          })}
        </div>
      </div>
      {showText && (
        <span className="brick-progress-text font-display">
          {percent}%
        </span>
      )}
    </div>
  );
}
