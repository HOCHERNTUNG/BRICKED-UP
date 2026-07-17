import { useState } from 'react';

const DEFAULT_PANELS = {
  scanner: {
    id: 'scanner',
    name: 'Scanner Panel',
    x: 64,
    y: 64,
    width: 384,
    height: 480,
    zIndex: 10,
    isOpen: true,
    isCollapsed: false,
    accentClass: 'border-scanner',
  },
  inventory: {
    id: 'inventory',
    name: 'User Inventory',
    x: 480,
    y: 64,
    width: 512,
    height: 512,
    zIndex: 10,
    isOpen: true,
    isCollapsed: false,
    accentClass: 'border-inventory',
  },
  buildIdeas: {
    id: 'buildIdeas',
    name: 'Build Ideas',
    x: 1024,
    y: 64,
    width: 384,
    height: 512,
    zIndex: 10,
    isOpen: true,
    isCollapsed: false,
    accentClass: 'border-builds',
  },
};

export function usePanels() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [maxZIndex, setMaxZIndex] = useState(10);

  const bringToFront = (id) => {
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setPanels((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        zIndex: nextZ,
      },
    }));
  };

  const openPanel = (id) => {
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setPanels((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isOpen: true,
        zIndex: nextZ,
      },
    }));
  };

  const closePanel = (id) => {
    setPanels((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isOpen: false,
      },
    }));
  };

  const togglePanel = (id) => {
    if (panels[id].isOpen) {
      closePanel(id);
    } else {
      openPanel(id);
    }
  };

  const toggleCollapse = (id) => {
    setPanels((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isCollapsed: !prev[id].isCollapsed,
      },
    }));
  };

  const updatePanelGeometry = (id, { x, y, width, height }) => {
    setPanels((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        x: x !== undefined ? x : prev[id].x,
        y: y !== undefined ? y : prev[id].y,
        width: width !== undefined ? width : prev[id].width,
        height: height !== undefined ? height : prev[id].height,
      },
    }));
  };

  const resetWorkspace = () => {
    setPanels(DEFAULT_PANELS);
    setMaxZIndex(10);
  };

  return {
    panels,
    openPanel,
    closePanel,
    togglePanel,
    toggleCollapse,
    bringToFront,
    updatePanelGeometry,
    resetWorkspace,
  };
}
