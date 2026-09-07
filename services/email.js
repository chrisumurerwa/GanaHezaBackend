/**
 * GANA HEZA — Email Service (nodemailer + Gmail)
 *
 * Requires in .env:
 *   EMAIL_HOST=smtp.gmail.com
 *   EMAIL_PORT=587
 *   EMAIL_USER=chrisumurerwa1@gmail.com
 *   EMAIL_PASSWORD=<app_password>
 *   EMAIL_FROM=GANA HEZA <chrisumurerwa1@gmail.com>
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send a 6-digit OTP to the user's email for password reset.
 */
async function sendOtpEmail(toEmail, toName, otp) {
  const from = process.env.EMAIL_FROM || `GANA HEZA <${process.env.EMAIL_USER}>`;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'GANA HEZA — Password Reset Code',
    text: `Hello ${toName},\n\nYour password reset code is:\n\n${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nIf you did not request this, please ignore this email.\n\nGANA HEZA Team`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#2E7D32;margin:0;">GANA HEZA</h2>
          <p style="color:#666;margin:4px 0 0;">Password Reset</p>
        </div>
        <p style="color:#333;">Hello <strong>${toName}</strong>,</p>
        <p style="color:#333;">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f4f9f4;border:2px solid #2E7D32;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#2E7D32;">${otp}</span>
        </div>
        <p style="color:#666;font-size:13px;">If you did not request a password reset, please ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#999;font-size:12px;text-align:center;">GANA HEZA Company · Kayonza, Rwanda</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
