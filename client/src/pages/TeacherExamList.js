import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../Teacher.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function TeacherExamList({ setPage, setActiveExamId }) {
  const [exams, setExams] = useState([]);
  const [workload, setWorkload] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', durationMinutes: 30 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchExams(); fetchWorkload(); }, []);

  function authHeader() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  async function fetchExams() {
    const res = await axios.get(`${API}/exams/my-exams`, authHeader());
    setExams(res.data);
  }

  async function fetchWorkload() {
    try {
      const res = await axios.get(`${API}/exams/workload`, authHeader());
      const byId = {};
      res.data.exams.forEach(w => { byId[w.examId] = w; });
      setWorkload(byId);
    } catch (err) {
      // non-fatal — badges just stay hidden
    }
  }

  async function handleCreate() {
    if (!form.title) return;
    setLoading(true);
    await axios.post(`${API}/exams/create`, form, authHeader());
    setForm({ title: '', description: '', durationMinutes: 30 });
    setShowCreate(false);
    setLoading(false);
    fetchExams();
    fetchWorkload();
  }

  function openExam(examId) {
    setActiveExamId(examId);
    setPage('teacherDashboard');
  }

  function openResults(examId) {
    setActiveExamId(examId);
    setPage('results');
  }

  return (
    <div className="teacher-page">
      <div className="t-glow"><span className="g1"></span><span className="g2"></span></div>

      <div className="teacher-inner">
        <div className="page-head">
          <div>
            <div className="eyebrow">Teacher workspace</div>
            <h1 className="page-h1">Your Exams</h1>
          </div>
          <button className="new-btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ New Exam'}
          </button>
        </div>

        {showCreate && (
          <div className="create-form">
            <label className="field-label" style={{ position: 'relative', zIndex: 1 }}>Exam Title</label>
            <input
              className="t-input"
              placeholder="e.g. Physics Midterm 2026"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ position: 'relative', zIndex: 1, marginBottom: '0.9rem' }}
            />
            <label className="field-label" style={{ position: 'relative', zIndex: 1 }}>Description (optional)</label>
            <textarea
              className="t-textarea"
              placeholder="Short description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ position: 'relative', zIndex: 1, marginBottom: '0.9rem' }}
            />
            <label className="field-label" style={{ position: 'relative', zIndex: 1 }}>Duration</label>
            <select
              className="t-select"
              value={form.durationMinutes}
              onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>
            <button className="gen-btn" onClick={handleCreate} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        )}

        {exams.length === 0 && !showCreate && (
          <div className="empty-state">No exams yet. Create your first one above.</div>
        )}

        <div className="exam-list">
          {exams.map((exam, i) => {
            const w = workload[exam._id];
            const hasBadges = w && (w.drifted || w.inProgress > 0 || w.timedOut > 0 || w.flaggedTabSwitches > 0);
            return (
              <div key={exam._id} className={`exam-card ${exam.locked ? 'sealed' : ''}`} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="exam-info">
                  <div className="exam-title">{exam.title}</div>
                  <div className="exam-meta">
                    <span className={`status-pill ${exam.locked ? 'sealed' : 'draft'}`}>
                      {exam.locked ? '🔒 Sealed' : '✏️ Draft'}
                    </span>
                    <span className="code-chip">Code <b>{exam.examCode}</b></span>
                    <span className="duration-chip">{exam.durationMinutes} min</span>
                  </div>
                  {hasBadges && (
                    <div className="workload-badges">
                      {w.drifted && <span className="workload-badge warn">⚠️ Drift ({w.driftedQuestionCount})</span>}
                      {w.inProgress > 0 && <span className="workload-badge progress">🟢 {w.inProgress} in progress</span>}
                      {w.timedOut > 0 && <span className="workload-badge timedout">⏰ {w.timedOut} timed out</span>}
                      {w.flaggedTabSwitches > 0 && <span className="workload-badge flagged">🚩 {w.flaggedTabSwitches} flagged</span>}
                    </div>
                  )}
                </div>
                <div className="exam-actions">
                  <button className="action-btn" onClick={() => openExam(exam._id)}>Manage</button>
                  <button className="action-btn results" onClick={() => openResults(exam._id)}>Results</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}