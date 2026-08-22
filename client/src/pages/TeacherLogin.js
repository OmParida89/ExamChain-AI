import React, { useState } from 'react';
import axios from 'axios';
import '../Auth.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function TeacherLogin({ setPage, setUser, setVerifyEmail }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        await axios.post(`${API}/auth/teacher/register`, form);
        setVerifyEmail(form.email);
        setPage('teacherOtpVerify');
      } else {
        const res = await axios.post(`${API}/auth/teacher/login`, form);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        setPage('teacherExams');
      }
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        setVerifyEmail(form.email);
        setPage('teacherOtpVerify');
      } else {
        setError(err.response?.data?.error || 'Something went wrong');
      }
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-glow"><span className="g1"></span><span className="g2"></span></div>
      <div className="auth-grain"></div>

      <div className="auth-page-inner">
        <div className="auth-card">
          <div className="auth-stamp">Teacher Portal</div>

          <div className="auth-card-head">
            <div className="auth-icon-row">
              <div className="auth-icon">🗂️</div>
              <div className="auth-h1">{mode === 'login' ? 'Welcome back' : 'Create account'}</div>
            </div>
            <div className="auth-sub">
              {mode === 'login' ? 'Login to manage your exams' : 'Register as a teacher'}
            </div>
          </div>

          <div className={`auth-tabs ${mode === 'register' ? 'register' : ''}`}>
            <div className="auth-slider"></div>
            <button className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
              Login
            </button>
            <button className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
              Register
            </button>
          </div>

          {error && <div className="auth-error">⚠ {error}</div>}

          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-field-label">Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-field-label">Email</label>
            <input
              type="email"
              placeholder="you@college.edu"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="auth-field">
            <label className="auth-field-label">Password</label>
            <div className="password-field-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
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

          {mode === 'login' && (
            <div className="auth-forgot-link" onClick={() => setPage('forgotPassword')}>
              Forgot password?
            </div>
          )}

          <button className="auth-submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>

          <div className="auth-switch-link teacher-variant">
            Are you a student? <span onClick={() => setPage('studentLogin')}>Student Login</span>
          </div>
        </div>
      </div>
    </div>
  );
}