const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOTP, sendOTPEmail } = require('../utils/email');

const JWT_SECRET = require('../config/jwtSecret');
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// ---------- TEACHER REGISTER ----------
router.post('/teacher/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'student') {
        return res.status(400).json({ error: 'This email is already registered as a student account. Use a different email.' });
      }
      if (existing.verified) {
        return res.status(400).json({ error: 'Email already registered. Please login instead.' });
      }
      // Unverified existing account — allow re-registration to resend OTP
      await User.deleteOne({ _id: existing._id });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    const user = new User({
      name, email, password: hashed, role: 'teacher',
      verified: false, otp, otpExpiry: new Date(Date.now() + OTP_EXPIRY_MS)
    });
    await user.save();

    const sent = await sendOTPEmail(email, name, otp, 'verify');
    if (!sent) return res.status(500).json({ error: 'Failed to send verification email' });

    res.json({ success: true, email, message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- STUDENT REGISTER ----------
router.post('/student/register', async (req, res) => {
  try {
    const { name, email, rollNumber, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'teacher') {
        return res.status(400).json({ error: 'This email is already registered as a teacher account. Use a different email.' });
      }
      if (existing.verified) {
        return res.status(400).json({ error: 'Email already registered. Please login instead.' });
      }
      await User.deleteOne({ _id: existing._id });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    const user = new User({
      name, email, password: hashed, role: 'student', rollNumber,
      verified: false, otp, otpExpiry: new Date(Date.now() + OTP_EXPIRY_MS)
    });
    await user.save();

    const sent = await sendOTPEmail(email, name, otp, 'verify');
    if (!sent) return res.status(500).json({ error: 'Failed to send verification email' });

    res.json({ success: true, email, message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- VERIFY OTP (shared for both roles) ----------
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (user.verified) return res.status(400).json({ error: 'Already verified. Please login.' });

    if (user.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'OTP expired. Please register again.' });

    user.verified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const tokenPayload = { id: user._id, name: user.name, email: user.email, role: user.role };
    if (user.role === 'student') tokenPayload.rollNumber = user.rollNumber;

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        name: user.name, email: user.email, role: user.role,
        ...(user.role === 'student' && { rollNumber: user.rollNumber })
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- RESEND OTP ----------
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (user.verified) return res.status(400).json({ error: 'Already verified' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    await sendOTPEmail(email, user.name, otp, 'verify');
    res.json({ success: true, message: 'New OTP sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- TEACHER LOGIN ----------
router.post('/teacher/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'teacher' });
    if (!user) return res.status(400).json({ error: 'Teacher not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });

    if (!user.verified) {
      return res.status(403).json({ error: 'Please verify your email first', needsVerification: true, email });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email, role: 'teacher' },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { name: user.name, email, role: 'teacher' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- STUDENT LOGIN ----------
router.post('/student/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'student' });
    if (!user) return res.status(400).json({ error: 'Student not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });

    if (!user.verified) {
      return res.status(403).json({ error: 'Please verify your email first', needsVerification: true, email });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email, role: 'student', rollNumber: user.rollNumber },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { name: user.name, email, role: 'student', rollNumber: user.rollNumber } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- FORGOT PASSWORD: REQUEST OTP ----------
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'No account found with this email' });

    const otp = generateOTP();
    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    const sent = await sendOTPEmail(email, user.name, otp, 'reset');
    if (!sent) return res.status(500).json({ error: 'Failed to send reset email' });

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- FORGOT PASSWORD: RESET WITH OTP ----------
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (user.resetOtp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
    if (new Date() > user.resetOtpExpiry) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;