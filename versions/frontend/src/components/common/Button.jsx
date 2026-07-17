import React from 'react';
import clsx from 'clsx';
import './common.css';

/**
 * Tactile, chunky LEGO-themed button component
 * Supports variants: 'primary' (red), 'secondary' (ink/grey), 'yellow' (highlight), 'success' (green), 'danger' (red)
 */
export function Button({
  children,
  variant = 'secondary',
  size = 'medium',
  className,
  type = 'button',
  disabled = false,
  onClick,
  ...props
}) {
  const buttonClass = clsx(
    'brick-btn',
    `brick-btn-${variant}`,
    `brick-btn-${size}`,
    disabled && 'brick-btn-disabled',
    className
  );

  return (
    <button
      type={type}
      className={buttonClass}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      <span className="brick-btn-content">{children}</span>
    </button>
  );
}
