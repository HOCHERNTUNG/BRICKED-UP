import React from 'react';
import './Workspace.css';

export function Workspace({ children }) {
  return (
    <div className="workspace">
      {children}
    </div>
  );
}
