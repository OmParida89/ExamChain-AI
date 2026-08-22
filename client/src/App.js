import React, { useState, useEffect } from 'react';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherExamList from './pages/TeacherExamList';
import StudentExam from './pages/StudentExam';
import StudentExamEntry from './pages/StudentExamEntry';
import StudentResults from './pages/StudentResults';
import Results from './pages/Results';
import Home from './pages/Home';
import TeacherLogin from './pages/TeacherLogin';
import StudentLogin from './pages/StudentLogin';
import OTPVerify from './pages/OTPVerify';
import ForgotPassword from './pages/ForgotPassword';
import './Teacher.css';

export default function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);
  const [activeExamId, setActiveExamId] = useState(null);
  const [verifyEmail, setVerifyEmail] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveExamId(null);
    setPage('home');
  }

  return (
    <div>
      <nav className="navbar">
        <span className="nav-brand" onClick={() => setPage('home')}>
          Exam<span>Chain</span>
        </span>

        <button className="nav-btn" onClick={() => setPage('home')}>Home</button>

        {user?.role === 'teacher' && (
          <button className="nav-btn" onClick={() => setPage('teacherExams')}>Teacher Dashboard</button>
        )}

        {user?.role === 'student' && (
          <>
            <button className="nav-btn student-variant" onClick={() => setPage('studentEntry')}>Student Dashboard</button>
            <button className="nav-btn student-variant" onClick={() => setPage('studentResults')}>Results</button>
          </>
        )}

        <div className="nav-right">
          {user && (
            <>
              <span className="nav-user">
                {user.role === 'student' ? `🎓 ${user.name} (${user.rollNumber})` : `🗂️ ${user.name}`}
              </span>
              <button className="nav-logout" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </nav>

      {page === 'home' && <Home setPage={setPage} user={user} />}
      {page === 'teacherLogin' && <TeacherLogin setPage={setPage} setUser={setUser} setVerifyEmail={setVerifyEmail} />}
      {page === 'studentLogin' && <StudentLogin setPage={setPage} setUser={setUser} setVerifyEmail={setVerifyEmail} />}

      {page === 'teacherOtpVerify' && (
        <OTPVerify email={verifyEmail} setPage={setPage} setUser={setUser} redirectTo="teacherExams" />
      )}
      {page === 'studentOtpVerify' && (
        <OTPVerify email={verifyEmail} setPage={setPage} setUser={setUser} redirectTo="studentEntry" />
      )}
      {page === 'forgotPassword' && <ForgotPassword setPage={setPage} />}

      {page === 'teacherExams' && user?.role === 'teacher' && (
        <TeacherExamList setPage={setPage} setActiveExamId={setActiveExamId} />
      )}
      {page === 'teacherDashboard' && user?.role === 'teacher' && activeExamId && (
        <TeacherDashboard examId={activeExamId} setPage={setPage} />
      )}
      {page === 'results' && user?.role === 'teacher' && activeExamId && (
        <Results examId={activeExamId} />
      )}

      {page === 'studentEntry' && user?.role === 'student' && (
        <StudentExamEntry setPage={setPage} setActiveExamId={setActiveExamId} />
      )}
      {page === 'studentExam' && user?.role === 'student' && activeExamId && (
        <StudentExam examId={activeExamId} user={user} setPage={setPage} />
      )}
      {page === 'studentResults' && user?.role === 'student' && (
        <StudentResults />
      )}

      {!user && (page === 'teacherExams' || page === 'teacherDashboard' || page === 'results') && (
        <TeacherLogin setPage={setPage} setUser={setUser} setVerifyEmail={setVerifyEmail} />
      )}
      {!user && (page === 'studentEntry' || page === 'studentExam' || page === 'studentResults') && (
        <StudentLogin setPage={setPage} setUser={setUser} setVerifyEmail={setVerifyEmail} />
      )}
    </div>
  );
}