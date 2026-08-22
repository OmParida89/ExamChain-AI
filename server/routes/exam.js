const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const Exam = require('../models/Exam');
const { difficultyWeightedScore } = require('../utils/normalize');
const { authMiddleware, studentOnly, teacherOnly } = require('../middleware/auth');

// Auto-submissions can land slightly after the nominal deadline due to network
// latency. This window keeps an honest on-time student from being scored 0
// just because their auto-submit request took a couple seconds to arrive.
const LATE_GRACE_MS = 8000;

// Student gets their unique variant set
router.get('/start/:examId/:studentId', authMiddleware, studentOnly, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.rollNumber;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const questions = await Question.find({ examId, locked: true });

    if (questions.length === 0) {
      return res.status(400).json({ error: 'Exam not found or not locked yet' });
    }

    let attempt = await Attempt.findOne({ examId, studentId });

    if (attempt && attempt.submittedAt) {
      return res.status(400).json({ error: 'Already attempted this exam' });
    }

    // If no attempt exists yet, this is the first time they're starting — record start time
    if (!attempt) {
      attempt = new Attempt({
        studentId,
        studentName: req.user.name,
        examId,
        startedAt: new Date(),
        answers: []
      });
      await attempt.save();
    }

    const deadline = new Date(attempt.startedAt.getTime() + exam.durationMinutes * 60000);
    const now = new Date();

    if (now >= deadline) {
      return res.status(400).json({ error: 'Time is up for this exam', expired: true });
    }

    // Assign variants once per attempt and pin them on the attempt itself, so a page
    // refresh never reshuffles questions and /submit always grades against the exact
    // variant the student was shown (instead of trusting a client-supplied index).
    if (!attempt.assignedVariants || attempt.assignedVariants.length === 0) {
      const allAttempts = await Attempt.find({ examId, submittedAt: { $ne: null } });

      attempt.assignedVariants = questions.map(q => {
        const usedVariantIndexes = allAttempts
          .flatMap(a => a.answers)
          .filter(ans => ans.questionId === q._id.toString())
          .map(ans => ans.variantIndex);

        const availableIndexes = q.variants
          .map((_, idx) => idx)
          .filter(idx => !usedVariantIndexes.includes(idx));

        const pool = availableIndexes.length > 0
          ? availableIndexes
          : q.variants.map((_, idx) => idx);

        const variantIndex = pool[Math.floor(Math.random() * pool.length)];
        return { questionId: q._id.toString(), variantIndex };
      });

      await attempt.save();
    }

    const studentExamQuestions = questions.map(q => {
      const { variantIndex } = attempt.assignedVariants.find(v => v.questionId === q._id.toString());
      return {
        questionId: q._id,
        concept: q.concept,
        difficulty: q.difficulty,
        variantIndex,
        questionText: q.variants[variantIndex].questionText,
        options: q.variants[variantIndex].options
      };
    });

    res.json({
      questions: studentExamQuestions,
      startedAt: attempt.startedAt,
      durationMinutes: exam.durationMinutes,
      deadline,
      tabLeaveCount: attempt.tabLeaveCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student's tab lost visibility (switched tabs, minimized, etc.) — count it
// and hand back the running total so the UI can show a live warning.
router.post('/heartbeat/:examId', authMiddleware, studentOnly, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.rollNumber;

    const attempt = await Attempt.findOneAndUpdate(
      { examId, studentId, submittedAt: null },
      { $inc: { tabLeaveCount: 1 } },
      { new: true }
    );

    if (!attempt) return res.status(400).json({ error: 'No active attempt to record against' });

    res.json({ tabLeaveCount: attempt.tabLeaveCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher's live view of who's mid-exam, submitted, timed out, or switching tabs
router.get('/live/:examId', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your exam' });

    const attempts = await Attempt.find({ examId });

    res.json({
      examId,
      students: attempts.map(a => ({
        studentId: a.studentId,
        studentName: a.studentName || a.studentId,
        startedAt: a.startedAt,
        submitted: !!a.submittedAt,
        isLate: !!a.isLate,
        tabLeaveCount: a.tabLeaveCount || 0
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student submits answers
router.post('/submit', authMiddleware, studentOnly, async (req, res) => {
  try {
    const studentId = req.user.rollNumber;
    const studentName = req.user.name;
    const { examId, answers } = req.body;

    const exam = await Exam.findById(examId);
    const attempt = await Attempt.findOne({ examId, studentId });

    if (!attempt) return res.status(400).json({ error: 'No active attempt found. Start the exam first.' });
    if (attempt.submittedAt) return res.status(400).json({ error: 'Already submitted' });

    // Server-side deadline check — cannot be bypassed by editing frontend.
    // A grace window absorbs auto-submit network latency so an honest
    // on-time student isn't zeroed just because the request arrived late.
    const deadline = new Date(attempt.startedAt.getTime() + exam.durationMinutes * 60000);
    const now = new Date();
    const isLate = now > new Date(deadline.getTime() + LATE_GRACE_MS);

    const questions = await Question.find({ examId });
    const questionMap = {};
    questions.forEach(q => { questionMap[q._id.toString()] = q; });

    const assignedMap = {};
    (attempt.assignedVariants || []).forEach(v => { assignedMap[v.questionId] = v.variantIndex; });

    const gradedAnswers = answers.map(ans => {
      const q = questionMap[ans.questionId];
      // Grade against the variant the server assigned at /start — never trust
      // a client-supplied variantIndex, or a student could pick any variant's answer key.
      const variantIndex = assignedMap[ans.questionId];
      const correctAnswer = q.variants[variantIndex].correctAnswer;
      return {
        questionId: ans.questionId,
        concept: q.concept,
        variantIndex,
        selectedAnswer: ans.selectedAnswer,
        correct: ans.selectedAnswer === correctAnswer,
        difficulty: q.difficulty
      };
    });

    const rawScore = isLate ? 0 : difficultyWeightedScore(gradedAnswers);
    const correctCount = gradedAnswers.filter(a => a.correct).length;
    const totalQuestions = gradedAnswers.length;

    attempt.studentName = studentName;
    attempt.answers = gradedAnswers;
    attempt.rawScore = rawScore;
    attempt.correctCount = isLate ? 0 : correctCount;
    attempt.totalQuestions = totalQuestions;
    attempt.normalizedScore = rawScore;
    attempt.submittedAt = now;
    attempt.isLate = isLate;

    await attempt.save();
    res.json({ success: true, isLate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;