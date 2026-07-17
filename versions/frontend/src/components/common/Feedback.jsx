import React from 'react';
import { Button } from './Button';
import { AlertCircle, FileQuestion, RefreshCw } from 'lucide-react';
import './common.css';

export function Spinner({ size = 'medium', className, message }) {
  return (
    <div className={`brick-spinner-container ${className || ''}`}>
      <div className={`brick-stud-spinner ${size}`}>
        <div className="stud-spinner-top" />
        <div className="stud-spinner-body" />
      </div>
      {message && <p className="brick-spinner-message font-display">{message}</p>}
    </div>
  );
}

export function EmptyState({
  title = 'No pieces found',
  description = 'Add some items to get started!',
  icon: Icon = FileQuestion,
  actionText,
  onAction,
}) {
  return (
    <div className="brick-feedback-state empty">
      <div className="feedback-icon-wrapper">
        <Icon size={40} className="feedback-icon" />
      </div>
      <h3 className="feedback-title font-display">{title}</h3>
      <p className="feedback-desc">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" size="small" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Oh brick, something broke!',
  message = 'Failed to load details. Please try again.',
  onRetry,
}) {
  return (
    <div className="brick-feedback-state error">
      <div className="feedback-icon-wrapper error-icon">
        <AlertCircle size={40} />
      </div>
      <h3 className="feedback-title font-display text-danger">{title}</h3>
      <p className="feedback-desc">{message}</p>
      {onRetry && (
        <Button variant="danger" size="small" onClick={onRetry} className="mt-2">
          <RefreshCw size={16} className="inline mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
