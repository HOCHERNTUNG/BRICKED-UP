import React from 'react';
import clsx from 'clsx';
import './common.css';

export function Card({
  children,
  className,
  header,
  footer,
  interactive = false,
  onClick,
  ...props
}) {
  const cardClass = clsx(
    'brick-card',
    interactive && 'brick-card-interactive',
    className
  );

  return (
    <div className={cardClass} onClick={interactive ? onClick : undefined} {...props}>
      {header && <div className="brick-card-header">{header}</div>}
      <div className="brick-card-body">{children}</div>
      {footer && <div className="brick-card-footer">{footer}</div>}
    </div>
  );
}
