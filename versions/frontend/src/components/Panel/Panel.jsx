import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import clsx from 'clsx';
import { Minus, Square, X } from 'lucide-react';
import { snapToGrid } from '../../hooks/useSnap';
import './Panel.css';

export function Panel({
  panel,
  onClose,
  onCollapse,
  onFocus,
  onUpdateGeometry,
  children,
}) {
  const { id, x, y, width, height, zIndex, isCollapsed, accentClass } = panel;
  
  // Drag and resize active states
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // Temporary drag/resize positions for rendering the snap ghost
  const [tempGeo, setTempGeo] = useState({ x, y, width, height });

  // Snap geometry for ghost positioning
  const ghostX = snapToGrid(tempGeo.x);
  const ghostY = snapToGrid(tempGeo.y);
  const ghostWidth = snapToGrid(tempGeo.width);
  const ghostHeight = isCollapsed ? 54 : snapToGrid(tempGeo.height);

  const handleDragStart = () => {
    onFocus();
    setIsDragging(true);
    setTempGeo({ x, y, width, height });
  };

  const handleDrag = (e, data) => {
    setTempGeo((prev) => ({
      ...prev,
      x: data.x,
      y: data.y,
    }));
  };

  const handleDragStop = (e, data) => {
    setIsDragging(false);
    const snappedX = snapToGrid(data.x);
    const snappedY = snapToGrid(data.y);
    onUpdateGeometry(id, { x: snappedX, y: snappedY });
  };

  const handleResizeStart = () => {
    onFocus();
    setIsResizing(true);
    setTempGeo({ x, y, width, height });
  };

  const handleResize = (e, direction, ref, delta, position) => {
    setTempGeo({
      x: position.x,
      y: position.y,
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    });
  };

  const handleResizeStop = (e, direction, ref, delta, position) => {
    setIsResizing(false);
    const snappedX = snapToGrid(position.x);
    const snappedY = snapToGrid(position.y);
    const snappedWidth = snapToGrid(ref.offsetWidth);
    const snappedHeight = snapToGrid(ref.offsetHeight);
    onUpdateGeometry(id, {
      x: snappedX,
      y: snappedY,
      width: snappedWidth,
      height: snappedHeight,
    });
  };

  // Enforce minimum height when collapsed vs expanded
  const minWidth = 288;
  const minHeight = isCollapsed ? 54 : 224;

  return (
    <>
      {/* Visual Snap Ghost Outline */}
      {(isDragging || isResizing) && (
        <div
          className="panel-snap-ghost"
          style={{
            transform: `translate(${ghostX}px, ${ghostY}px)`,
            width: `${ghostWidth}px`,
            height: `${ghostHeight}px`,
            zIndex: zIndex - 1,
          }}
        />
      )}

      {/* Actual Panel Card Wrapper */}
      <Rnd
        size={{
          width: width,
          height: isCollapsed ? 54 : height,
        }}
        position={{
          x: x,
          y: y,
        }}
        minWidth={minWidth}
        minHeight={minHeight}
        dragHandleClassName="panel-header"
        disableResizing={isCollapsed}
        enableResizing={{
          top: false,
          right: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: true, // Resize via bottom right corner
          bottomLeft: false,
          topLeft: false,
        }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        style={{ zIndex }}
      >
        <div
          className={clsx(
            'panel-chrome',
            accentClass,
            isCollapsed && 'collapsed',
            isDragging && 'dragging',
            isResizing && 'resizing'
          )}
          onClick={onFocus}
        >
          {/* Header Bar */}
          <div className="panel-header">
            <span className="panel-title font-display">{panel.name}</span>
            <div className="panel-controls">
              <button
                type="button"
                className="panel-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapse(id);
                }}
                title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
                aria-label="Collapse panel"
              >
                {isCollapsed ? <Square size={14} /> : <Minus size={14} />}
              </button>
              <button
                type="button"
                className="panel-btn close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(id);
                }}
                title="Close Panel"
                aria-label="Close panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Panel Body */}
          {!isCollapsed && <div className="panel-body-content">{children}</div>}
        </div>
      </Rnd>
    </>
  );
}
