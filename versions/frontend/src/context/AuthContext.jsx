import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await authApi.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          // Set a fake token for in-memory active sessions
          setIdToken('jwt_restored_session');
        }
      } catch (err) {
        console.error('Failed to load authenticated user state:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const signIn = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authApi.signIn({ email, password });
      setUser(result.user);
      setIdToken(result.idToken);
      return result.user;
    } catch (err) {
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email, password, displayName) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authApi.signUp({ email, password, displayName });
      return result;
    } catch (err) {
      setError(err.message || 'Failed to sign up');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authApi.signOut();
      setUser(null);
      setIdToken(null);
    } catch (err) {
      console.error('Failed to sign out:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
