import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../Results.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Results({ examId }) {
  const [attempts, setAttempts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [released, setReleased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchResults();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function authHeader() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  async function fetchResults() {
    try {
      const res = await axios.get(`${API}/results/teacher/${examId}`, authHeader());
      setAttempts(res.data.attempts);
      setReleased(res.data.released);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load results');
    }
  }

  async function fetchAnalytics() {
    const res = await axios.get(`${API}/results/analytics/${examId}`, authHeader());
    setAnalytics(res.data);
  }

  async function handleRelease() {
    setLoading(true);
    await axios.post(`${API}/results/release/${examId}`, {}, authHeader());
    setReleased(true);
    setLoading(false);
  }

  async function handleUnrelease() {
    setLoading(true);
    await axios.post(`${API}/results/unrelease/${examId}`, {}, authHeader());
    setReleased(false);
    setLoading(false);
  }

  if (errorMsg) return (
    <div className="results-page">
      <div className="r-inner">
        <div className="empty-state" style={{ color: '#E7A0A2' }}>{errorMsg}</div>
      </div>
    </div>
  );

  if (attempts.length === 0) return (
    <div className="results-page">
      <div className="r-glow"><span className="g1"></span><span className="g2"></span></div>
      <div className="r-inner">
        <div className="empty-state">No submissions yet.</div>
      </div>
    </div>
  );

  const sorted = [...attempts].sort((a, b) => b.normalizedScore - a.normalizedScore);
  const avgPercentile = Math.round(attempts.reduce((a, b) => a + b.normalizedScore, 0) / attempts.length);
  const topPercentile = Math.max(...attempts.map(a => a.normalizedScore));

  return (
    <div className="results-page">
      <div className="r-glow"><span className="g1"></span><span className="g2"></span></div>

      <div className="r-inner">
        <div className="t-head">
          <div>
            <div className="eyebrow">Gradebook</div>
            <div className="t-title">Results</div>
          </div>
          {!released ? (
            <button className="release-btn locked" onClick={handleRelease} disabled={loading}>
              {loading ? 'Releasing...' : '🔓 Release Scores to Students'}
            </button>
          ) : (
            <button className="release-btn live" onClick={handleUnrelease} disabled={loading}>
              {loading ? 'Hiding...' : '🔒 Hide Scores'}
            </button>
          )}
        </div>

        <div className={`status-banner ${released ? 'live' : 'hidden'}`}>
          {released
            ? '✅ Scores are LIVE — students can see their individual results now'
            : '🔒 Scores are HIDDEN — students cannot see their results yet'}
        </div>

        <div className="stat-grid">
          <div className="stat-tile" style={{ animationDelay: '0.05s' }}>
            <div className="stat-val">{attempts.length}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-tile" style={{ animationDelay: '0.1s' }}>
            <div className="stat-val">{avgPercentile}</div>
            <div className="stat-label">Avg. Percentile</div>
          </div>
          <div className="stat-tile" style={{ animationDelay: '0.15s' }}>
            <div className="stat-val">{topPercentile}</div>
            <div className="stat-label">Top Percentile</div>
          </div>
        </div>

        {analytics && analytics.concepts.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: '1rem' }}>Concept-wise performance</div>
            {analytics.concepts.map((c, i) => (
              <div key={c.concept} className="concept-row" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="concept-top">
                  <span className="concept-name">
                    {c.accuracyPercent < 50 ? '🚩 ' : ''}{c.concept}
                  </span>
                  <span
                    className="concept-pct"
                    style={{ color: c.accuracyPercent < 50 ? '#E7A0A2' : c.accuracyPercent < 75 ? '#E5C158' : '#6FBF96' }}
                  >
                    {c.accuracyPercent}%
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${c.accuracyPercent}%`,
                      background: c.accuracyPercent < 50 ? '#9B2226' : c.accuracyPercent < 75 ? '#C9A227' : '#2D6A4F'
                    }}
                  ></div>
                </div>
                <div className="concept-note">
                  {c.correctCount} correct / {c.incorrectCount} incorrect out of {c.totalAttempts} attempts
                </div>
              </div>
            ))}
          </>
        )}

        <div className="eyebrow" style={{ margin: '2rem 0 1rem' }}>Leaderboard</div>
        <table>
          <thead>
            <tr>
              <th>Rank</th><th>Student</th><th>Roll No.</th><th>Score</th><th>Percentile</th><th>Tab Switches</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => (
              <tr key={a._id} className={i % 2 !== 0 ? 'row-odd' : ''}>
                <td><span className={`rank-stamp ${i === 0 ? 'top' : ''}`}>{i + 1}</span></td>
                <td>{a.studentName}</td>
                <td>{a.studentId}</td>
                <td>{a.isLate && <span title="Submitted after the deadline">⏰ </span>}{a.correctCount}/{a.totalQuestions}</td>
                <td>
                  <span className={`pctl-pill ${a.normalizedScore >= 50 ? 'high' : 'low'}`}>
                    {a.normalizedScore}th
                  </span>
                </td>
                <td className={a.tabLeaveCount >= 3 ? 'tab-switch-severe' : a.tabLeaveCount > 0 ? 'tab-switch-warn' : ''}>
                  {a.tabLeaveCount > 0 ? `⚠️ ${a.tabLeaveCount}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}