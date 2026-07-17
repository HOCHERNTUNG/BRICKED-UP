import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Square } from 'lucide-react';
import { snapToGrid } from '../../hooks/useSnap';
import './Panel.css';
import { clsx } from 'clsx';

export function Panel({ 
  id, 
  title, 
  x, 
  y, 
  width, 
  height, 
  zIndex, 
  isOpen, 
  isCollapsed, 
  onUpdate, 
  onBringToFront, 
  onClose,
  accentColor = 'var(--brick-red)',
  children 
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // Ghost position state
  const [ghost, setGhost] = useState(null);

  if (!isOpen) return null;

  const handleDragStart = () => {
    onBringToFront(id);
    setIsDragging(true);
  };

  const handleDrag = (e, data) => {
    setGhost({
      x: snapToGrid(data.x),
      y: snapToGrid(data.y),
      width,
      height
    });
  };

  const handleDragStop = (e, data) => {
    setIsDragging(false);
    setGhost(null);
    onUpdate(id, { 
      x: snapToGrid(data.x), 
      y: snapToGrid(data.y) 
    });
  };

  const handleResizeStart = () => {
    onBringToFront(id);
    setIsResizing(true);
  };

  const handleResize = (e, direction, ref, delta, position) => {
    setGhost({
      x: snapToGrid(position.x),
      y: snapToGrid(position.y),
      width: snapToGrid(ref.offsetWidth),
      height: snapToGrid(ref.offsetHeight)
    });
  };

  const handleResizeStop = (e, direction, ref, delta, position) => {
    setIsResizing(false);
    setGhost(null);
    onUpdate(id, {
      width: snapToGrid(ref.offsetWidth),
      height: snapToGrid(ref.offsetHeight),
      x: snapToGrid(position.x),
      y: snapToGrid(position.y)
    });
  };

  return (
    <>
      {ghost && (
        <div 
          className="panel-ghost"
          style={{
            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
            width: ghost.width,
            height: isCollapsed ? 48 : ghost.height, // 48 is header height
            zIndex: zIndex - 1
          }}
        />
      )}
      
      <Rnd
        size={{ width, height: isCollapsed ? 48 : height }}
        position={{ x, y }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        minWidth={288}
        minHeight={isCollapsed ? 48 : 224}
        bounds="parent"
        dragHandleClassName="panel-header"
        enableResizing={!isCollapsed}
        style={{ zIndex }}
        className={clsx('panel-container', { 'is-dragging': isDragging, 'is-resizing': isResizing })}
        disableDragging={false}
      >
        <div 
          className="panel-wrapper"
          style={{ '--panel-accent': accentColor }}
          onClick={() => onBringToFront(id)}
        >
          <div className="panel-header">
            <h3 className="panel-title">{title}</h3>
            <div className="panel-actions">
              <button 
                className="panel-btn" 
                onClick={(e) => { e.stopPropagation(); onUpdate(id, { isCollapsed: !isCollapsed }); }}
                aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
              >
                {isCollapsed ? <Square size={16} /> : <Minus size={16} />}
              </button>
              <button 
                className="panel-btn" 
                onClick={(e) => { e.stopPropagation(); onClose(id); }}
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          {!isCollapsed && (
            <div className="panel-content">
              {children}
            </div>
          )}
        </div>
      </Rnd>
    </>
  );
}
