import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Spinner } from '../common/Feedback';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, User, Sparkles } from 'lucide-react';
import './AuthScreen.css';

export function AuthScreen() {
  const { signIn, signUp, error, clearError } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  const [formLoading, setFormLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    // Client-side validations
    if (!email || !password || (isSignUp && !displayName)) {
      setLocalError('Please fill in all bricks of the form.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 blocks long.');
      return;
    }

    setFormLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
        setSignUpSuccess(true);
        setIsSignUp(false); // Switch to Sign In after registration
        setPassword('');
        setLocalError(null);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      // Errors handled by context or thrown
      setLocalError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setLocalError(null);
    clearError();
    setSignUpSuccess(false);
  };

  return (
    <div className="auth-screen-container">
      {/* Background visual elements representing floating bricks */}
      <div className="auth-background-decorations">
        <div className="auth-brick red bounce" style={{ animationDelay: '0.2s' }}>🔴</div>
        <div className="auth-brick yellow bounce" style={{ animationDelay: '0.5s' }}>🟡</div>
        <div className="auth-brick blue bounce" style={{ animationDelay: '0s' }}>🔵</div>
        <div className="auth-brick green bounce" style={{ animationDelay: '0.8s' }}>🟢</div>
      </div>

      <Card className="auth-card">
        {/* Logo Title */}
        <div className="auth-logo-section">
          <div className="logo-brick-stack">
            <div className="logo-brick yellow-brick" />
            <div className="logo-brick blue-brick" />
            <div className="logo-brick red-brick" />
          </div>
          <h1 className="logo-title font-display">
            BRICKED-UP
          </h1>
          <p className="logo-subtitle">LEGO Parts Scanner & Bin Manager</p>
        </div>

        {formLoading ? (
          <Spinner message={isSignUp ? "Building account..." : "Logging in..."} />
        ) : (
          <form className="auth-form font-body" onSubmit={handleSubmit}>
            {localError && <div className="auth-error font-display">{localError}</div>}
            {error && <div className="auth-error font-display">{error}</div>}
            
            {signUpSuccess && (
              <div className="auth-success font-display">
                <Sparkles size={16} /> Account created successfully! Please sign in.
              </div>
            )}

            {isSignUp && (
              <div className="input-group">
                <label className="input-label font-display">Display Name</label>
                <div className="input-wrapper">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="MasterBuilder"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label font-display">Email Address</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="builder@lego.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label font-display">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  className="auth-input"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="auth-submit-btn font-display"
            >
              {isSignUp ? 'Build Account' : 'Sign In'}
            </Button>

            <div className="auth-toggle-prompt">
              <span>{isSignUp ? 'Already a builder?' : 'New to Bricked-Up?'}</span>
              <button
                type="button"
                className="auth-toggle-link font-display"
                onClick={toggleAuthMode}
              >
                {isSignUp ? 'Login Here' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
export default AuthScreen;
