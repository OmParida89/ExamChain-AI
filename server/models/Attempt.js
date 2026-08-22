const mongoose = require('mongoose');

const AttemptSchema = new mongoose.Schema({
  studentId: String,
  studentName: String,
  examId: String,
  startedAt: Date,
  submittedAt: Date,
  assignedVariants: [
    {
      _id: false,
      questionId: String,
      variantIndex: Number
    }
  ],
  answers: [
    {
      questionId: String,
      concept: String,
      variantIndex: Number,
      selectedAnswer: String,
      correct: Boolean,
      difficulty: Number
    }
  ],
  correctCount: Number,
  totalQuestions: Number,
  rawScore: Number,
  normalizedScore: Number,
  tabLeaveCount: { type: Number, default: 0 },
  isLate: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attempt', AttemptSchema);