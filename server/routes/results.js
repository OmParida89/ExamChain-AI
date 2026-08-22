const express = require('express');
const router = express.Router();
const Attempt = require('../models/Attempt');
const ExamRelease = require('../models/ExamRelease');
const Exam = require('../models/Exam');
const { normalizeScores } = require('../utils/normalize');
const { authMiddleware, teacherOnly, studentOnly } = require('../middleware/auth');

// TEACHER VIEW — full report, always visible regardless of release status
router.get('/teacher/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    // Only graded (submitted) attempts belong in the leaderboard/percentile math —
    // an in-progress attempt has no rawScore yet and would silently corrupt
    // normalizeScores()'s comparisons for everyone else.
    const attempts = await Attempt.find({ examId, submittedAt: { $ne: null } });

    if (attempts.length === 0) {
      return res.json({ attempts: [], released: false });
    }

    const normalized = normalizeScores(attempts.map(a => a.toObject()));

    // Safeguard: with more than one submission, the top percentile must be exactly 100.
    // If this ever fails, the normalization formula has regressed — fail loudly instead of
    // silently shipping wrong percentiles to students.
    if (normalized.length > 1) {
      const maxPercentile = Math.max(...normalized.map(a => a.normalizedScore));
      if (maxPercentile !== 100) {
        console.error(`[INTEGRITY] Percentile bug detected for exam ${examId}: max percentile is ${maxPercentile}, expected 100`);
        return res.status(500).json({ error: 'Score normalization error detected. Please contact support before releasing scores.' });
      }
    }

    for (const a of normalized) {
      await Attempt.findByIdAndUpdate(a._id, { normalizedScore: a.normalizedScore });
    }

    const releaseDoc = await ExamRelease.findOne({ examId });

    res.json({
      attempts: normalized,
      released: releaseDoc?.released || false,
      totalSubmissions: attempts.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RELEASE SCORES — teacher triggers this
router.post('/release/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    await ExamRelease.findOneAndUpdate(
      { examId },
      { released: true, releasedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true, message: 'Scores released to students' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UNDO RELEASE — optional, in case teacher wants to re-hide
router.post('/unrelease/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    await ExamRelease.findOneAndUpdate({ examId }, { released: false });
    res.json({ success: true, message: 'Scores hidden again' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEACHER VIEW — concept-wise weakness analytics
router.get('/analytics/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    const attempts = await Attempt.find({ examId, submittedAt: { $ne: null } });

    if (attempts.length === 0) {
      return res.json({ concepts: [], totalSubmissions: 0 });
    }

    const conceptStats = {};

    attempts.forEach(attempt => {
      attempt.answers.forEach(ans => {
        if (!ans.concept) return;
        if (!conceptStats[ans.concept]) {
          conceptStats[ans.concept] = { total: 0, correct: 0 };
        }
        conceptStats[ans.concept].total += 1;
        if (ans.correct) conceptStats[ans.concept].correct += 1;
      });
    });

    const concepts = Object.entries(conceptStats).map(([concept, stats]) => ({
      concept,
      totalAttempts: stats.total,
      correctCount: stats.correct,
      incorrectCount: stats.total - stats.correct,
      accuracyPercent: Math.round((stats.correct / stats.total) * 100)
    })).sort((a, b) => a.accuracyPercent - b.accuracyPercent);

    res.json({ concepts, totalSubmissions: attempts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STUDENT VIEW — only their own score, only if released
router.get('/student/:examId', authMiddleware, studentOnly, async (req, res) => {
  try {
    const { examId } = req.params;
    const rollNumber = req.user.rollNumber;

    const releaseDoc = await ExamRelease.findOne({ examId });

    if (!releaseDoc?.released) {
      return res.json({ released: false, message: 'Scores have not been released yet' });
    }

    const attempt = await Attempt.findOne({ examId, studentId: rollNumber });

    if (!attempt) {
      return res.status(404).json({ error: 'No submission found for this exam' });
    }

    res.json({
      released: true,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      percentileScore: attempt.normalizedScore
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STUDENT VIEW — every exam this student has submitted, so the navbar "Results"
// link works without needing an exam already active in the current session.
router.get('/my-history', authMiddleware, studentOnly, async (req, res) => {
  try {
    const rollNumber = req.user.rollNumber;

    const attempts = await Attempt.find({ studentId: rollNumber, submittedAt: { $ne: null } }).sort({ submittedAt: -1 });
    if (attempts.length === 0) return res.json({ history: [] });

    const examIds = attempts.map(a => a.examId);
    const exams = await Exam.find({ _id: { $in: examIds } });
    const examTitleById = {};
    exams.forEach(e => { examTitleById[e._id.toString()] = e.title; });

    const releaseDocs = await ExamRelease.find({ examId: { $in: examIds } });
    const releasedByExamId = {};
    releaseDocs.forEach(r => { releasedByExamId[r.examId] = r.released; });

    const history = attempts.map(a => ({
      examId: a.examId,
      examTitle: examTitleById[a.examId] || 'Untitled Exam',
      submittedAt: a.submittedAt,
      released: !!releasedByExamId[a.examId],
      correctCount: a.correctCount,
      totalQuestions: a.totalQuestions,
      percentileScore: a.normalizedScore
    }));

    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;