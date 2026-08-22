require('dotenv').config({ path: __dirname + '/../.env' });
const dns = require('dns');
const nodemailer = require('nodemailer');

// Belt-and-suspenders IPv4 fix: Render (and similar PaaS hosts) don't support
// IPv6 egress, so letting Node resolve Gmail's IPv6 address first fails with
// ENETUNREACH. This forces IPv4 for every DNS lookup in the process, since
// the 'family' option on the transporter alone isn't reliably honored by
// Nodemailer's 'service: gmail' shorthand.
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  family: 4
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(toEmail, name, otp, purpose) {
  const subject = purpose === 'verify'
    ? 'Verify your ExamChain account'
    : 'Reset your ExamChain password';

  const heading = purpose === 'verify' ? 'Verify Your Email' : 'Reset Your Password';

  const message = purpose === 'verify'
    ? `Hi ${name}, use the code below to verify your ExamChain account.`
    : `Hi ${name}, use the code below to reset your ExamChain password.`;

  try {
    await transporter.sendMail({
      from: `"ExamChain" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1e293b;">⛓️ ExamChain</h2>
          <h3>${heading}</h3>
          <p>${message}</p>
          <div style="background: #f1f5f9; padding: 1rem; border-radius: 8px; text-align: center; margin: 1.5rem 0;">
            <span style="font-size: 2rem; font-weight: bold; letter-spacing: 0.3rem; color: #1e293b;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 0.85rem;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

module.exports = { generateOTP, sendOTPEmail };