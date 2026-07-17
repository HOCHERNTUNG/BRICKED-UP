import React, { useState } from 'react';
import { Panel } from '../Panel/Panel';
import { ActionBar } from '../ActionBar/ActionBar';
import { ScannerPanel } from '../Scanner/ScannerPanel';
import { InventoryPanel } from '../Inventory/InventoryPanel';
import { BuildIdeasPanel } from '../BuildIdeas/BuildIdeasPanel';
import { usePanels } from '../../hooks/usePanels';
import './Workspace.css';

export function Workspace() {
  const {
    panels,
    openPanel,
    closePanel,
    togglePanel,
    toggleCollapse,
    bringToFront,
    updatePanelGeometry,
  } = usePanels();

  // Active theme and stud grid customizations
  const [theme, setTheme] = useState('classic');
  const [studStyle, setStudStyle] = useState('circular');

  // Triggered when adding elements from scanner into inventory to sync the lists
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const handleInventoryUpdate = () => {
    setInventoryRefreshKey((prev) => prev + 1);
  };

  return (
    <div
      className="workspace-container"
      data-theme={theme}
      data-studs={studStyle}
    >
      {/* Scrollable LEGO Stud Baseplate Canvas */}
      <div className="workspace-baseplate">
        <div className="workspace-dots" />

        {/* Floating Panel: Scanner */}
        {panels.scanner.isOpen && (
          <Panel
            panel={panels.scanner}
            onClose={closePanel}
            onCollapse={toggleCollapse}
            onFocus={() => bringToFront('scanner')}
            onUpdateGeometry={updatePanelGeometry}
          >
            <ScannerPanel onAddInventory={handleInventoryUpdate} />
          </Panel>
        )}

        {/* Floating Panel: Inventory */}
        {panels.inventory.isOpen && (
          <Panel
            panel={panels.inventory}
            onClose={closePanel}
            onCollapse={toggleCollapse}
            onFocus={() => bringToFront('inventory')}
            onUpdateGeometry={updatePanelGeometry}
          >
            <InventoryPanel
              refreshKey={inventoryRefreshKey}
              onInventoryChange={handleInventoryUpdate}
            />
          </Panel>
        )}

        {/* Floating Panel: Build Ideas */}
        {panels.buildIdeas.isOpen && (
          <Panel
            panel={panels.buildIdeas}
            onClose={closePanel}
            onCollapse={toggleCollapse}
            onFocus={() => bringToFront('buildIdeas')}
            onUpdateGeometry={updatePanelGeometry}
          >
            <BuildIdeasPanel inventoryRefreshKey={inventoryRefreshKey} />
          </Panel>
        )}
      </div>

      {/* Floating Pill Action Bar */}
      <ActionBar
        panels={panels}
        onTogglePanel={togglePanel}
        onOpenPanel={openPanel}
        activeTheme={theme}
        onChangeTheme={setTheme}
        studStyle={studStyle}
        onChangeStudStyle={setStudStyle}
      />
    </div>
  );
}
export default Workspace;
