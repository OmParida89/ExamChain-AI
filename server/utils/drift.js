// Capacity vs. demand for a single question — flags when live student load has
// exceeded the number of unique variants recorded at question-creation time.
function computeQuestionDrift(question, attempts) {
  const qid = question._id.toString();
  const capacity = question.variants.length;

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
    concept: question.concept,
    capacity,
    demand,
    usagePercent: capacity === 0 ? 0 : Math.round((demand / capacity) * 100),
    drifted: collisions.length > 0,
    collisions
  };
}

module.exports = { computeQuestionDrift };
