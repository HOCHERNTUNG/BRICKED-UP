import { useState, useCallback, useMemo } from 'react';

// Centralised panel state management
export function usePanels() {
  const [panels, setPanels] = useState({
    scanner: { id: 'scanner', title: 'Scanner', x: 128, y: 128, width: 384, height: 480, zIndex: 1, isOpen: false, isCollapsed: false },
    inventory: { id: 'inventory', title: 'Inventory', x: 544, y: 128, width: 448, height: 512, zIndex: 2, isOpen: false, isCollapsed: false },
    builds: { id: 'builds', title: 'Build Ideas', x: 1024, y: 128, width: 384, height: 480, zIndex: 3, isOpen: false, isCollapsed: false },
  });

  const bringToFront = useCallback((id) => {
    setPanels(prev => {
      if (!prev[id]) return prev;
      const maxZ = Math.max(...Object.values(prev).map(p => p.zIndex));
      if (prev[id].zIndex === maxZ) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], zIndex: maxZ + 1 }
      };
    });
  }, []);

  const togglePanel = useCallback((id) => {
    setPanels(prev => {
      if (!prev[id]) return prev;
      const willBeOpen = !prev[id].isOpen;
      
      const newState = {
        ...prev,
        [id]: { ...prev[id], isOpen: willBeOpen }
      };

      if (willBeOpen) {
        // Find max Z to bring to front
        const maxZ = Math.max(...Object.values(prev).map(p => p.zIndex));
        newState[id].zIndex = maxZ + 1;
      }
      return newState;
    });
  }, []);

  const updatePanel = useCallback((id, updates) => {
    setPanels(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], ...updates } };
    });
  }, []);

  return {
    panels,
    bringToFront,
    togglePanel,
    updatePanel
  };
}
