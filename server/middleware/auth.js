const jwt = require('jsonwebtoken');

const JWT_SECRET = require('../config/jwtSecret');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access only' });
  }
  next();
}

function studentOnly(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access only' });
  }
  next();
}

module.exports = { authMiddleware, teacherOnly, studentOnly };