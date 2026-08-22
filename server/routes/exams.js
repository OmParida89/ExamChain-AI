const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const { computeQuestionDrift } = require('../utils/drift');
const { authMiddleware, teacherOnly } = require('../middleware/auth');

function generateExamCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Teacher creates a new exam
router.post('/create', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { title, description, durationMinutes } = req.body;

    let examCode = generateExamCode();
    let existing = await Exam.findOne({ examCode });
    while (existing) {
      examCode = generateExamCode();
      existing = await Exam.findOne({ examCode });
    }

    const exam = new Exam({
      title,
      description,
      durationMinutes: durationMinutes || 30,
      teacherId: req.user.id,
      teacherName: req.user.name,
      examCode
    });

    await exam.save();
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher gets all their exams
router.get('/my-exams', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exams = await Exam.find({ teacherId: req.user.id }).sort({ createdAt: -1 });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// At-a-glance rollup across ALL of a teacher's exams — drift, live activity, and
// proctoring flags — so they don't have to open each exam individually to see
// what needs attention. Declared before /:examId so it isn't swallowed by it.
router.get('/workload', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exams = await Exam.find({ teacherId: req.user.id });
    const examIds = exams.map(e => e._id.toString());

    const questions = await Question.find({ examId: { $in: examIds } });
    const attempts = await Attempt.find({ examId: { $in: examIds } });

    const summary = exams.map(exam => {
      const examId = exam._id.toString();
      const examQuestions = questions.filter(q => q.examId === examId);
      const examAttempts = attempts.filter(a => a.examId === examId);

      const drift = examQuestions.map(q => computeQuestionDrift(q, examAttempts));
      const inProgress = examAttempts.filter(a => !a.submittedAt).length;
      const timedOut = examAttempts.filter(a => a.submittedAt && a.isLate).length;
      const flaggedTabSwitches = examAttempts.filter(a => (a.tabLeaveCount || 0) >= 3).length;

      return {
        examId,
        drifted: drift.some(d => d.drifted),
        driftedQuestionCount: drift.filter(d => d.drifted).length,
        inProgress,
        timedOut,
        flaggedTabSwitches
      };
    });

    res.json({ exams: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single exam by ID (teacher only, for dashboard)
router.get('/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student looks up exam by code
router.get('/code/:examCode', authMiddleware, async (req, res) => {
  try {
    const exam = await Exam.findOne({ examCode: req.params.examCode.toUpperCase() });
    if (!exam) return res.status(404).json({ error: 'Invalid exam code' });
    if (!exam.locked) return res.status(400).json({ error: 'This exam has not started yet' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lock exam (also locks all its questions)
router.post('/lock/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    exam.locked = true;
    await exam.save();

    await Question.updateMany({ examId: exam._id.toString() }, { locked: true });

    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;