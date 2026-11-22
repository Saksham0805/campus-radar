const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
  return process.env.JWT_SECRET;
};

const hashOtp = (email, otp) =>
  crypto.createHmac('sha256', secret()).update(email + ':' + otp).digest('hex');

const isEmail = (s) =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "2026-12-05" means 11:59 PM IST that day
function parseDeadline(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) d += 'T23:59:00+05:30';
  const t = new Date(d);
  return isNaN(t) ? null : t;
}

function signToken(email) {
  return jwt.sign({ email }, secret(), { expiresIn: '30d' });
}

// returns { email } or null
function getUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, secret()); } catch { return null; }
}

let transporter;
function sendMail(to, subject, html) {
  transporter = transporter || nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
}

const wrap = (inner) => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e3f5;border-radius:16px">
  <h2 style="margin:0 0 16px;color:#1e1b3a">Campus <span style="color:#6654e8">Radar</span></h2>
  ${inner}
  <p style="color:#999;font-size:12px;margin-top:24px">If this wasn't you, ignore this email.</p>
</div>`;

module.exports = { hashOtp, isEmail, escapeHtml, parseDeadline, signToken, getUser, sendMail, wrap };
