import React from 'react';
import { usePanels } from './hooks/usePanels';
import { Workspace } from './components/Workspace/Workspace';
import { ActionBar } from './components/ActionBar/ActionBar';
import { Scanner } from './components/Scanner/Scanner';
import { Inventory } from './components/Inventory/Inventory';
import { BuildIdeas } from './components/BuildIdeas/BuildIdeas';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { Auth } from './components/Auth/Auth';
import './styles/global.css';

function MainApp() {
  const { user, isLoading } = useAuth();
  const { panels, bringToFront, togglePanel, updatePanel } = usePanels();

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Workspace>
      <Scanner 
        panelState={panels.scanner} 
        onUpdate={updatePanel}
        onBringToFront={bringToFront}
        onClose={togglePanel}
      />
      
      <Inventory 
        panelState={panels.inventory} 
        onUpdate={updatePanel}
        onBringToFront={bringToFront}
        onClose={togglePanel}
      />
      
      <BuildIdeas 
        panelState={panels.builds} 
        onUpdate={updatePanel}
        onBringToFront={bringToFront}
        onClose={togglePanel}
      />

      <ActionBar onOpenPanel={togglePanel} />
    </Workspace>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
