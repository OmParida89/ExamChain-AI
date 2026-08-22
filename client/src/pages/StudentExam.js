import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../Exam.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function StudentExam({ examId, user, setPage }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [tabLeaveCount, setTabLeaveCount] = useState(0);
  const [tabWarning, setTabWarning] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => { startExam(); }, []);

  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) {
      setTimedOut(true);
      handleAutoSubmit();
      return;
    }
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, submitted]);

  // Proctoring: count and warn every time the student leaves this tab
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !submittedRef.current) {
        axios.post(`${API}/exam/heartbeat/${examId}`, {}, authHeader())
          .then(res => {
            setTabLeaveCount(res.data.tabLeaveCount);
            setTabWarning(`⚠️ Tab switch detected — this has been recorded (${res.data.tabLeaveCount} so far).`);
          })
          .catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    if (!tabWarning) return;
    const t = setTimeout(() => setTabWarning(''), 5000);
    return () => clearTimeout(t);
  }, [tabWarning]);

  function authHeader() {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  async function startExam() {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/exam/start/${examId}/${user.rollNumber}`, authHeader());
      setQuestions(res.data.questions);
      setTabLeaveCount(res.data.tabLeaveCount || 0);
      const deadline = new Date(res.data.deadline).getTime();
      const now = Date.now();
      setTimeLeft(Math.max(0, Math.floor((deadline - now) / 1000)));
    } catch (err) {
      setError(err.response?.data?.expired ? 'Time is up for this exam. You can no longer attempt it.' : (err.response?.data?.error || 'Failed to load exam'));
    }
    setLoading(false);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function submitExam() {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const answerArray = questions.map(q => ({
      questionId: q.questionId,
      variantIndex: q.variantIndex,
      selectedAnswer: answers[q.questionId] || ''
    }));

    try {
      const res = await axios.post(`${API}/exam/submit`, { studentId: user.rollNumber, studentName: user.name, examId, answers: answerArray }, authHeader());
      if (res.data.isLate) setTimedOut(true);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
      submittedRef.current = false;
    }
  }

  async function handleAutoSubmit() {
    if (submittedRef.current) return;
    await submitExam();
  }

  if (loading) return <div className="exam-take-page"><div className="ex-inner"><div className="ex-center-msg">Loading your exam...</div></div></div>;

  if (error) return (
    <div className="exam-take-page">
      <div className="ex-inner">
        <div className="ex-center-msg">
          <p style={{ color: '#E7A0A2', marginBottom: '1.2rem' }}>{error}</p>
          <button className="ex-error-btn" onClick={() => setPage('studentEntry')}>Try Another Code</button>
        </div>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="exam-take-page">
      <div className="ex-inner">
        <div className="ex-center-msg">
          {timedOut ? (
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.8rem', color: '#E5C158', marginBottom: '1rem' }}>
              ⏰ Time's up! Your exam was automatically submitted.
            </h2>
          ) : (
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.8rem', color: '#6FBF96', marginBottom: '1rem' }}>
              ✅ Thank you for appearing in the exam
            </h2>
          )}
          <p style={{ color: 'rgba(245,240,230,0.7)', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
            Your responses have been recorded.
          </p>
          <p style={{ color: 'rgba(245,240,230,0.45)' }}>
            Your score and percentile will be available once your teacher releases results.
          </p>
        </div>
      </div>
    </div>
  );

  const isLowTime = timeLeft !== null && timeLeft <= 60;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);
  const q = questions[currentIndex];

  return (
    <div className="exam-take-page">
      <div className="ex-glow"><span className="g1"></span><span className="g2"></span></div>

      <div className="ex-inner">
        <div className="exam-header">
          <div className="header-left">
            <div className="exam-name">📝 {user.name}'s Exam</div>
            <div className="progress-text">Question {currentIndex + 1} of {questions.length}</div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {tabLeaveCount > 0 && (
              <div className={`tab-warning-chip ${tabLeaveCount >= 3 ? 'severe' : ''}`}>
                ⚠️ Tab left: {tabLeaveCount}
              </div>
            )}
            <div className={`timer ${isLowTime ? 'urgent' : ''}`}>
              ⏱ {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
          </div>
        </div>

        {tabWarning && <div className="tab-warning-toast">{tabWarning}</div>}

        {q && (
          <div className="q-card" key={q.questionId}>
            <div className="q-label">Question {currentIndex + 1}</div>
            <div className="q-text">{q.questionText}</div>
            {q.options.map((opt, j) => (
              <div
                key={j}
                className={`opt ${answers[q.questionId] === opt[0] ? 'selected' : ''}`}
                onClick={() => setAnswers({ ...answers, [q.questionId]: opt[0] })}
              >
                <span className="opt-letter">{opt[0]}</span>
                <span className="opt-text">{opt.slice(3)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="q-nav">
          {questions.map((qq, i) => (
            <div
              key={qq.questionId}
              className={`dot ${answers[qq.questionId] ? 'answered' : ''} ${i === currentIndex ? 'current' : ''}`}
              onClick={() => setCurrentIndex(i)}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="submit-row">
          {currentIndex < questions.length - 1 ? (
            <button className="exam-submit-btn" onClick={() => setCurrentIndex(i => i + 1)}>Next →</button>
          ) : (
            <button className="exam-submit-btn" onClick={submitExam}>Submit Exam</button>
          )}
        </div>
      </div>
    </div>
  );
}