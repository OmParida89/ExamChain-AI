require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

// Sent over HTTPS via SendGrid's transactional email API — not raw SMTP.
// Render (and many PaaS hosts) block or silently drop outbound SMTP ports
// (465/587), which is what caused ETIMEDOUT failures when this used Nodemailer
// + Gmail. HTTPS (443) is never blocked, since the whole app depends on it.
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const SENDER_EMAIL = process.env.SENDGRID_SENDER_EMAIL || process.env.GMAIL_USER;

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
    await axios.post(SENDGRID_API_URL, {
      personalizations: [{ to: [{ email: toEmail, name }] }],
      from: { email: SENDER_EMAIL, name: 'ExamChain' },
      subject,
      content: [{
        type: 'text/html',
        value: `
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
      }]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err.response?.data || err.message);
    return false;
  }
}

module.exports = { generateOTP, sendOTPEmail };
