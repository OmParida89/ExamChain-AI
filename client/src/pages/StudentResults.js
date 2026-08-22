import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../Results.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function StudentResults() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchHistory(); }, []);

  async function fetchHistory() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/results/my-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data.history);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not fetch your results');
    }
  }

  if (error) return (
    <div className="student-results-page">
      <div className="student-reveal">
        <p style={{ color: '#E7A0A2' }}>{error}</p>
      </div>
    </div>
  );

  if (!history) return (
    <div className="student-results-page">
      <div className="student-reveal">Loading...</div>
    </div>
  );

  if (history.length === 0) return (
    <div className="student-results-page">
      <div className="student-reveal">
        <div className="locked-card">
          <div className="lock-icon">📭</div>
          <div className="locked-title">No Exams Yet</div>
          <div className="locked-sub">Once you submit an exam, it'll show up here.</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="student-results-page">
      <div className="student-reveal">
        <div className="reveal-h1">Your Results</div>

        <div className="history-list">
          {history.map((h, i) => (
            <div key={h.examId} className="history-row" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="history-row-top">
                <span className="history-exam-title">{h.examTitle}</span>
                <span className="history-date">{new Date(h.submittedAt).toLocaleDateString()}</span>
              </div>
              {h.released ? (
                <div className="history-score-row">
                  <span className="history-score">{h.correctCount}/{h.totalQuestions} correct</span>
                  <span className="pctl-pill high">{h.percentileScore}th percentile</span>
                </div>
              ) : (
                <div className="history-locked">🔒 Scores not released yet</div>
              )}
            </div>
          ))}
        </div>

        <div className="reveal-foot">
          Percentiles reflect how you ranked among your peers, accounting for question difficulty.
        </div>
      </div>
    </div>
  );
}
