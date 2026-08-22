const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const Attempt = require('../models/Attempt');
const { generateVariants } = require('../utils/llm');
const { createBlock, verifyChain } = require('../utils/hash');
const { authMiddleware, teacherOnly } = require('../middleware/auth');

// Step 1: Generate variants for preview only — NOT saved yet
router.post('/preview', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { original, concept, difficulty, examId } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });
    if (exam.locked) return res.status(400).json({ error: 'Exam is locked, cannot add questions' });

    const variants = await generateVariants(original, concept, difficulty);

    // Nothing saved to DB yet — just return for teacher review
    res.json({ success: true, variants, original, concept, difficulty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Teacher confirms (possibly edited) variants — NOW saved + hashed
router.post('/confirm', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { original, concept, difficulty, examId, variants } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });
    if (exam.locked) return res.status(400).json({ error: 'Exam is locked, cannot add questions' });

    if (!variants || variants.length === 0) {
      return res.status(400).json({ error: 'No variants to save' });
    }

    const lastQuestion = await Question.findOne({ examId }).sort({ timestamp: -1 });
    const prevHash = lastQuestion ? lastQuestion.hash : '0';
    const { hash } = createBlock(variants, prevHash);

    const question = new Question({
      concept,
      difficulty,
      original,
      variants,
      hash,
      prevHash,
      examId
    });

    await question.save();
    res.json({ success: true, question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Verify chain integrity for an exam — NOT exposed in teacher UI.
// Used internally / for demo purposes only (call directly via API or admin tool).
router.get('/verify/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    const questions = await Question.find({ examId: req.params.examId });
    const result = verifyChain(questions);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Capacity vs. demand for each question — flags when live student load has
// exceeded the number of unique variants recorded at question-creation time.
router.get('/drift/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    const questions = await Question.find({ examId: req.params.examId });
    const attempts = await Attempt.find({ examId: req.params.examId });

    const questionDrift = questions.map(q => {
      const qid = q._id.toString();
      const capacity = q.variants.length;

      const assignments = attempts
        .map(a => {
          const av = (a.assignedVariants || []).find(v => v.questionId === qid);
          return av ? { student: a.studentName || a.studentId, variantIndex: av.variantIndex } : null;
        })
        .filter(Boolean);

      const demand = assignments.length;
      const byVariant = {};
      assignments.forEach(a => { (byVariant[a.variantIndex] ||= []).push(a.student); });

      const collisions = Object.entries(byVariant)
        .filter(([, students]) => students.length > 1)
        .map(([variantIndex, students]) => ({ variantIndex: Number(variantIndex), students }));

      return {
        questionId: qid,
        concept: q.concept,
        capacity,
        demand,
        usagePercent: capacity === 0 ? 0 : Math.round((demand / capacity) * 100),
        drifted: collisions.length > 0,
        collisions
      };
    });

    res.json({
      examId: req.params.examId,
      examLocked: exam.locked,
      examDrifted: questionDrift.some(q => q.drifted),
      questions: questionDrift
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all questions for an exam (teacher dashboard list)
router.get('/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    const questions = await Question.find({ examId: req.params.examId });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset/delete all questions for an exam (used during testing)
router.delete('/reset/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    await Question.deleteMany({ examId: req.params.examId });
    res.json({ success: true, message: 'Reset done' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;