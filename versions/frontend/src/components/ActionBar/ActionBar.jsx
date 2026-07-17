import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import clsx from 'clsx';
import { Camera, FolderOpen, Lightbulb, Settings, LogOut } from 'lucide-react';
import { useSnap } from '../../hooks/useSnap';
import { useAuth } from '../../context/AuthContext';
import './ActionBar.css';

export function ActionBar({
  panels,
  onTogglePanel,
  onOpenPanel,
  activeTheme,
  onChangeTheme,
  studStyle,
  onChangeStudStyle,
}) {
  const { signOut, user } = useAuth();
  const { getDockPosition } = useSnap();

  const [dockedEdge, setDockedEdge] = useState('bottom');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsMenuRef = useRef(null);

  // Set bar dimensions depending on orientation
  const isHorizontal = dockedEdge === 'top' || dockedEdge === 'bottom';
  const barWidth = isHorizontal ? 280 : 64;
  const barHeight = isHorizontal ? 64 : 280;

  // Initialize centred at the bottom on mount
  useEffect(() => {
    const handleInitialDock = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const startX = (windowWidth - 280) / 2;
      const startY = windowHeight - 64 - 16; // 16px offset from bottom edge
      
      setPosition({ x: startX, y: startY });
      setDockedEdge('bottom');
    };

    handleInitialDock();
    window.addEventListener('resize', handleInitialDock);
    return () => window.removeEventListener('resize', handleInitialDock);
  }, []);

  // Close settings popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStop = (e, data) => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Snap to the closest edge
    const dock = getDockPosition(
      data.x,
      data.y,
      barWidth,
      barHeight,
      windowWidth,
      windowHeight
    );

    // Apply edge margins
    let targetX = dock.x;
    let targetY = dock.y;
    const margin = 12;

    if (dock.edge === 'bottom') {
      targetY = windowHeight - barHeight - margin;
    } else if (dock.edge === 'top') {
      targetY = margin;
    } else if (dock.edge === 'left') {
      targetX = margin;
    } else if (dock.edge === 'right') {
      targetX = windowWidth - barWidth - margin;
    }

    setDockedEdge(dock.edge);
    setPosition({ x: targetX, y: targetY });
  };

  const navItems = [
    { id: 'scanner', icon: Camera, label: 'Scan' },
    { id: 'inventory', icon: FolderOpen, label: 'Inventory' },
    { id: 'buildIdeas', icon: Lightbulb, label: 'Ideas' },
  ];

  return (
    <div className="action-bar-wrapper">
      {/* Rnd Wrapper for Draggability */}
      <Rnd
        size={{ width: barWidth, height: barHeight }}
        position={position}
        disableResizing={true}
        onDragStop={handleDragStop}
        dragHandleClassName="action-bar-drag"
        bounds="window"
      >
        <div
          className={clsx(
            'action-bar-container',
            `docked-${dockedEdge}`,
            isHorizontal ? 'layout-row' : 'layout-col'
          )}
        >
          {/* Drag Handle Gimmick (LEGO bumps on action bar side) */}
          <div className="action-bar-drag" title="Drag to re-dock navigation bar">
            <div className="drag-studs" />
          </div>

          {/* Navigation Pill Items */}
          <div className="action-bar-buttons">
            {navItems.map((item) => {
              const panelState = panels[item.id];
              const isActive = panelState && panelState.isOpen;
              
              return (
                <button
                  key={item.id}
                  type="button"
                  className={clsx('action-btn', isActive && 'active')}
                  onClick={() => onTogglePanel(item.id)}
                  title={`${isActive ? 'Close' : 'Open'} ${item.label}`}
                  aria-label={`Toggle ${item.label} panel`}
                >
                  <item.icon size={20} />
                  <span className="tooltip font-display">{item.label}</span>
                </button>
              );
            })}

            {/* Settings Menu Button */}
            <div className="settings-trigger-wrapper" ref={settingsMenuRef}>
              <button
                type="button"
                className={clsx('action-btn', showSettingsMenu && 'active')}
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                title="Settings & Workspace Options"
                aria-label="Toggle settings menu"
              >
                <Settings size={20} />
                <span className="tooltip font-display">Settings</span>
              </button>

              {/* Settings Dropdown Popover */}
              {showSettingsMenu && (
                <div className={clsx('settings-popover', `popup-${dockedEdge}`)}>
                  <div className="settings-header">
                    <span className="settings-title font-display">Settings</span>
                    <span className="user-email">{user?.email}</span>
                  </div>
                  
                  {/* Theme Select */}
                  <div className="settings-section">
                    <label className="section-label font-display">Workspace Theme</label>
                    <div className="settings-options-grid">
                      {['classic', 'space-explorer', 'neon-cyber'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={clsx('option-btn', activeTheme === t && 'active')}
                          onClick={() => onChangeTheme(t)}
                        >
                          {t.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stud Pattern Select */}
                  <div className="settings-section">
                    <label className="section-label font-display">Baseplate Studs</label>
                    <div className="settings-options-grid">
                      {['circular', 'rounded-square'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={clsx('option-btn', studStyle === s && 'active')}
                          onClick={() => onChangeStudStyle(s)}
                        >
                          {s.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logout */}
                  <button
                    type="button"
                    className="logout-action-btn font-display"
                    onClick={signOut}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Rnd>
    </div>
  );
}
