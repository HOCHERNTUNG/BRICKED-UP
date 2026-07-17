import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/Auth/AuthScreen';
import { Workspace } from './components/Workspace/Workspace';
import { Spinner } from './components/common/Feedback';
import './styles/tokens.css';
import './styles/global.css';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--cream-100)',
        }}
      >
        <Spinner size="large" message="Loading BRICKED-UP Workspace..." />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <Workspace />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
