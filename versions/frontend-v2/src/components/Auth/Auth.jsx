import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import './Auth.css';

export function Auth() {
  const { signIn, signUp, isLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password || (!isLogin && !displayName)) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      if (isLogin) {
        await signIn({ email, password });
      } else {
        await signUp({ email, password, displayName });
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <h1 className="auth-title">BRICKED-UP</h1>
        <p className="auth-subtitle">LEGO Parts Scanner & Bin Manager</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Display Name" 
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="auth-input"
            />
          )}
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="auth-input"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="auth-input"
          />
          
          {error && <div className="auth-error">{error}</div>}
          
          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? 'Wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        <button 
          className="auth-toggle" 
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          disabled={isLoading}
        >
          {isLogin ? 'Need an account? Sign up.' : 'Already have an account? Sign in.'}
        </button>
      </div>
    </div>
  );
}
