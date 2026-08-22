import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../Teacher.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function TeacherDashboard({ examId, setPage }) {
  const [exam, setExam] = useState(null);
  const [form, setForm] = useState({ original: '', concept: '', difficulty: 3 });
  const [questions, setQuestions] = useState([]);
  const [previewVariants, setPreviewVariants] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [drift, setDrift] = useState(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    fetchExam();
    fetchQuestions();
    fetchDrift();
    fetchLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function authHeader() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  async function fetchExam() {
    const res = await axios.get(`${API}/exams/${examId}`, authHeader());
    setExam(res.data);
  }

  async function fetchQuestions() {
    const res = await axios.get(`${API}/questions/${examId}`, authHeader());
    setQuestions(res.data);
  }

  async function fetchDrift() {
    setDriftLoading(true);
    try {
      const res = await axios.get(`${API}/questions/drift/${examId}`, authHeader());
      setDrift(res.data);
    } catch (err) {
      // non-fatal — drift panel just stays hidden
    }
    setDriftLoading(false);
  }

  async function fetchLive() {
    setLiveLoading(true);
    try {
      const res = await axios.get(`${API}/exam/live/${examId}`, authHeader());
      setLive(res.data);
    } catch (err) {
      // non-fatal — live panel just stays hidden
    }
    setLiveLoading(false);
  }

  async function handleGeneratePreview() {
    if (!form.original || !form.concept) return;
    setLoading(true);
    setMessage('');
    setPreviewVariants(null);
    try {
      const res = await axios.post(`${API}/questions/preview`, { ...form, examId }, authHeader());
      setPreviewVariants(res.data.variants);
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  }

  function updateVariantField(index, field, value) {
    const updated = [...previewVariants];
    updated[index] = { ...updated[index], [field]: value };
    setPreviewVariants(updated);
  }

  function updateVariantOption(index, optIndex, value) {
    const updated = [...previewVariants];
    const opts = [...updated[index].options];
    opts[optIndex] = value;
    updated[index] = { ...updated[index], options: opts };
    setPreviewVariants(updated);
  }

  function discardVariant(index) {
    setPreviewVariants(previewVariants.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    if (!previewVariants || previewVariants.length === 0) {
      setMessage('No variants left to add. Generate again.');
      return;
    }
    setConfirming(true);
    try {
      await axios.post(`${API}/questions/confirm`, { ...form, examId, variants: previewVariants }, authHeader());
      setMessage('Question added ✅');
      setForm({ original: '', concept: '', difficulty: 3 });
      setPreviewVariants(null);
      fetchQuestions();
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    }
    setConfirming(false);
  }

  function handleCancelPreview() {
    setPreviewVariants(null);
    setMessage('');
  }

  async function handleLock() {
    await axios.post(`${API}/exams/lock/${examId}`, {}, authHeader());
    setMessage('Exam locked 🔒 — no further edits possible');
    fetchExam();
    fetchQuestions();
    fetchDrift();
    fetchLive();
  }

  if (!exam) return <div className="teacher-page"><div className="teacher-inner">Loading exam...</div></div>;

  return (
    <div className="teacher-page">
      <div className="t-glow"><span className="g1"></span><span className="g2"></span></div>

      <div className="teacher-inner">
        <button className="back-link" onClick={() => setPage('teacherExams')}>← Back to Exams</button>

        <div className="dash-head">
          <h1 className="dash-title">{exam.title}</h1>
          <span className="ticket">
            <span className="ticket-seg">
              <span className="ticket-label">Exam Code</span>
              <span className="ticket-val">{exam.examCode}</span>
            </span>
            <span className="ticket-perf"></span>
            <span className="ticket-seg">
              <span className="ticket-label">Duration</span>
              <span className="ticket-val">{exam.durationMinutes} min</span>
            </span>
          </span>
          {exam.locked && <span className="seal-badge">🔒 Sealed</span>}
        </div>

        {message && <div className="info-banner">{message}</div>}

        {!exam.locked && !previewVariants && (
          <>
            <div className="section-eyebrow">Add a question</div>
            <div className="form-card">
              <div className="form-card-title">New Question</div>
              <label className="field-label">Base Question</label>
              <textarea
                className="t-textarea"
                placeholder="Enter base question..."
                value={form.original}
                onChange={e => setForm({ ...form, original: e.target.value })}
                rows={3}
                style={{ position: 'relative', zIndex: 1 }}
              />
              <div className="form-row">
                <div>
                  <label className="field-label">Concept</label>
                  <input
                    className="t-input"
                    placeholder="e.g. Newton's Laws"
                    value={form.concept}
                    onChange={e => setForm({ ...form, concept: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Difficulty</label>
                  <select
                    className="t-select"
                    value={form.difficulty}
                    onChange={e => setForm({ ...form, difficulty: Number(e.target.value) })}
                  >
                    {[1,2,3,4,5].map(d => <option key={d} value={d}>Level {d}</option>)}
                  </select>
                </div>
              </div>
              <button className="gen-btn" onClick={handleGeneratePreview} disabled={loading}>
                {loading ? 'Generating...' : '⚡ Generate Variants for Review'}
              </button>
            </div>
          </>
        )}

        {previewVariants && (
          <div className="review-panel">
            <div className="review-title-row">
              <div className="review-title">📝 Review Before Adding</div>
              <span className="review-count">{previewVariants.length} variants</span>
            </div>
            <div className="review-sub">Edit wording or fix answers below. Nothing is saved until you confirm.</div>

            {previewVariants.map((v, i) => (
              <div key={i} className="slip">
                <div className="slip-head">
                  <span className="slip-num">Variant {i + 1}</span>
                  <button className="discard-btn" onClick={() => discardVariant(i)}>✕ Discard</button>
                </div>
                <textarea
                  className="slip-textarea"
                  value={v.questionText}
                  onChange={e => updateVariantField(i, 'questionText', e.target.value)}
                  rows={2}
                />
                {v.options.map((opt, j) => (
                  <input
                    key={j}
                    className="slip-option"
                    value={opt}
                    onChange={e => updateVariantOption(i, j, e.target.value)}
                  />
                ))}
                <div className="correct-row">
                  <span>Correct Answer:</span>
                  <select
                    className="correct-select"
                    value={v.correctAnswer}
                    onChange={e => updateVariantField(i, 'correctAnswer', e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              </div>
            ))}

            <div className="panel-actions">
              <button className="cancel-btn" onClick={handleCancelPreview}>Cancel</button>
              <button className="confirm-btn" onClick={handleConfirm} disabled={confirming}>
                {confirming ? 'Saving...' : '✓ Confirm & Add Question'}
              </button>
            </div>
          </div>
        )}

        <div className="q-list-head">
          <div className="section-eyebrow" style={{ marginBottom: 0 }}>Filed questions ({questions.length})</div>
          {!exam.locked && questions.length > 0 && (
            <button className="lock-btn" onClick={handleLock}>🔒 Lock Exam</button>
          )}
        </div>

        {questions.map((q, i) => (
          <div key={q._id} className="q-row" style={{ animationDelay: `${i * 0.08}s` }}>
            <div>
              <div className="q-row-title">Q{i + 1} — {q.concept}</div>
              <div className="q-row-meta">{q.variants?.length} variants generated</div>
            </div>
          </div>
        ))}

        {drift && drift.questions.length > 0 && (
          <div className="drift-panel">
            <div className="q-list-head">
              <div className="section-eyebrow" style={{ marginBottom: 0 }}>Capacity &amp; Drift</div>
              <button className="action-btn" onClick={fetchDrift} disabled={driftLoading}>
                {driftLoading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
            <div className="drift-explainer">
              Recorded when each question was added: every student gets a unique variant. This panel shows whether live demand has held to that.
            </div>

            <div className={`drift-banner ${drift.examDrifted ? 'warn' : 'ok'}`}>
              {drift.examDrifted
                ? `⚠️ Drift detected — demand has exceeded recorded variant capacity for ${drift.questions.filter(q => q.drifted).length} question(s).`
                : '✅ Within capacity — every student who has started has a unique variant.'}
            </div>

            {drift.questions.map((q, i) => (
              <div key={q.questionId} className="drift-row" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="drift-row-top">
                  <span className="drift-concept">{q.drifted ? '🚩 ' : ''}{q.concept}</span>
                  <span className="drift-stats">Capacity: {q.capacity} · Demand: {q.demand}</span>
                </div>
                <div className="drift-bar-track">
                  <div
                    className={`drift-bar-fill ${q.drifted ? 'over' : q.usagePercent >= 100 ? 'warn' : 'ok'}`}
                    style={{ width: `${Math.min(q.usagePercent, 100)}%` }}
                  ></div>
                </div>
                {q.drifted && (
                  <div className="collision-note">
                    {q.collisions.map(c => (
                      <div key={c.variantIndex}>Variant #{c.variantIndex + 1} shared by: {c.students.join(', ')}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {live && live.students.length > 0 && (
          <div className="drift-panel">
            <div className="q-list-head">
              <div className="section-eyebrow" style={{ marginBottom: 0 }}>Live Exam Activity</div>
              <button className="action-btn" onClick={fetchLive} disabled={liveLoading}>
                {liveLoading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
            <div className="drift-explainer">
              Who's mid-exam, who's finished, who ran out of time, and how many times each student has switched away from the exam tab.
            </div>

            {live.students.map((s, i) => {
              const statusLabel = !s.submitted ? '🟢 In Progress' : s.isLate ? '⏰ Timed Out' : '✅ Submitted';
              const statusClass = !s.submitted ? 'progress' : s.isLate ? 'timedout' : 'submitted';
              const tabClass = s.tabLeaveCount >= 3 ? 'severe' : s.tabLeaveCount > 0 ? 'warn' : '';
              return (
                <div key={s.studentId} className="live-row" style={{ animationDelay: `${i * 0.06}s` }}>
                  <span className="live-name">{s.studentName}</span>
                  <span className={`status-chip ${statusClass}`}>{statusLabel}</span>
                  <span className={`tab-count ${tabClass}`}>
                    {s.tabLeaveCount > 0 ? `⚠️ ${s.tabLeaveCount} tab switch${s.tabLeaveCount === 1 ? '' : 'es'}` : 'No tab switches'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}