import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authApi.getCurrentUser().then(u => {
      setUser(u);
      setIsLoading(false);
    });
  }, []);

  const signIn = async (credentials) => {
    setIsLoading(true);
    try {
      const { user } = await authApi.signIn(credentials);
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data) => {
    setIsLoading(true);
    try {
      await authApi.signUp(data);
      // Auto sign in after sign up
      await signIn({ email: data.email, password: data.password });
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authApi.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
