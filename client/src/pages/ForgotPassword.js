import React, { useState } from 'react';
import axios from 'axios';
import '../Auth.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ForgotPassword({ setPage }) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleRequest() {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      setStep('reset');
      setMessage('OTP sent to your email');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!otp || !newPassword) return;
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/auth/reset-password`, { email, otp, newPassword });
      setMessage('Password reset! Redirecting to login...');
      setTimeout(() => setPage('home'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-glow"><span className="g1"></span><span className="g2"></span></div>
      <div className="auth-grain"></div>

      <div className="auth-page-inner">
        <div className="auth-card">
          <div className="auth-card-head">
            <div className="auth-h1">🔑 Reset Password</div>
          </div>

          {step === 'request' && (
            <>
              <div className="auth-sub" style={{ marginBottom: '1.4rem' }}>
                Enter your email to receive a reset code
              </div>
              <div className="auth-field">
                <label className="auth-field-label">Email</label>
                <input
                  type="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {error && <div className="auth-error">⚠ {error}</div>}
              <button className="auth-submit-btn" onClick={handleRequest} disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </>
          )}

          {step === 'reset' && (
            <>
              {message && <div className="auth-success">✓ {message}</div>}
              <div className="auth-field">
                <label className="auth-field-label">OTP</label>
                <input
                  type="text"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <div className="auth-field">
                <label className="auth-field-label">New Password</label>
                <div className="password-field-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              {error && <div className="auth-error">⚠ {error}</div>}
              <button className="auth-submit-btn" onClick={handleReset} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </>
          )}

          <div className="auth-back-link" onClick={() => setPage('home')}>
            ← Back to home
          </div>
        </div>
      </div>
    </div>
  );
}