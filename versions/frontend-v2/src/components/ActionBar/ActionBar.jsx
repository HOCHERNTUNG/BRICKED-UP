import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Camera, Grid, Lightbulb, User } from 'lucide-react';
import { clsx } from 'clsx';
import './ActionBar.css';

export function ActionBar({ onOpenPanel }) {
  const [dockEdge, setDockEdge] = useState('bottom'); // top, right, bottom, left
  const [position, setPosition] = useState({ x: 0, y: 0 }); // We will center it initially in useEffect
  const [isDragging, setIsDragging] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Initial position centered at bottom
    setPosition({
      x: window.innerWidth / 2 - 120, // rough half width of action bar
      y: window.innerHeight - 100
    });
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragStop = (e, data) => {
    setIsDragging(false);
    
    // Calculate distances to edges
    const x = data.x;
    const y = data.y;
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    const distTop = y;
    const distBottom = h - y;
    const distLeft = x;
    const distRight = w - x;

    const minDist = Math.min(distTop, distBottom, distLeft, distRight);
    
    let newEdge = dockEdge;
    if (minDist === distTop) newEdge = 'top';
    else if (minDist === distBottom) newEdge = 'bottom';
    else if (minDist === distLeft) newEdge = 'left';
    else if (minDist === distRight) newEdge = 'right';

    setDockEdge(newEdge);

    // Snap to edge coordinates
    let snapX = x;
    let snapY = y;

    if (newEdge === 'top') snapY = 32;
    if (newEdge === 'bottom') snapY = h - 96; // 96 = approx height + padding
    if (newEdge === 'left') snapX = 32;
    if (newEdge === 'right') snapX = w - 96;

    setPosition({ x: snapX, y: snapY });
  };

  const isVertical = dockEdge === 'left' || dockEdge === 'right';

  return (
    <Rnd
      position={position}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      enableResizing={false}
      bounds="parent"
      style={{ zIndex: 9999 }} // always on top
      className={clsx('action-bar-container', { 'is-dragging': isDragging })}
    >
      <div className={clsx('action-bar', { 'is-vertical': isVertical })}>
        <button className="action-btn" onClick={() => onOpenPanel('scanner')} aria-label="Scanner">
          <Camera size={24} />
        </button>
        <button className="action-btn" onClick={() => onOpenPanel('inventory')} aria-label="Inventory">
          <Grid size={24} />
        </button>
        <button className="action-btn" onClick={() => onOpenPanel('builds')} aria-label="Build Ideas">
          <Lightbulb size={24} />
        </button>
        <button className="action-btn" onClick={() => onOpenPanel('auth')} aria-label="Profile">
          <User size={24} />
        </button>
      </div>
    </Rnd>
  );
}
