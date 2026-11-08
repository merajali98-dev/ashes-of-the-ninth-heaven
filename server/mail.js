// Sends the sign-in email: through any SMTP server when SMTP_USER and SMTP_PASS are set (Gmail with an app password by
// default), or through Resend when RESEND_API_KEY is set. With neither, the server is in "development sign-in" mode:
// the link and code are returned to the page and shown on screen, so nobody needs an inbox.
import {smtpSend} from './smtp.js';

const smtp = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
export const mailConfigured = () => smtp() || Boolean(process.env.RESEND_API_KEY);

function content({code, link}) {
  const text = `Your code is ${code}.\n\nOr open this link to enter the Night Bazaar:\n${link}\n\n`
    + 'It works once and expires in 15 minutes. If you did not ask for it, ignore this email.\n\nAshes of the Ninth Heaven';
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;padding:24px;background:#16141b;color:#e9e2d6;border-radius:12px">
<p style="letter-spacing:4px;color:#c8a064;font-size:12px;margin:0">ASHES OF THE NINTH HEAVEN</p>
<h1 style="font-size:22px;margin:12px 0">Your seal code</h1>
<p style="font-size:34px;letter-spacing:8px;color:#ffe1a2;margin:8px 0"><b>${code}</b></p>
<p>Or <a href="${link}" style="color:#ffe1a2">open the Night Bazaar</a> directly.</p>
<p style="color:#b3ab9e;font-size:13px">It works once and expires in 15 minutes. If you did not ask for it, ignore this email.</p></div>`;
  return {subject: `Your seal code: ${code}`, text, html};
}

export async function sendSignInMail({to, code, link}) {
  const message = content({code, link});
  if (smtp()) {
    const user = process.env.SMTP_USER;
    await smtpSend({host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), user, pass: process.env.SMTP_PASS,
      from: process.env.ASHES_MAIL_FROM || `Ashes of the Ninth Heaven <${user}>`, to, ...message});
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: process.env.ASHES_MAIL_FROM || 'Ashes of the Ninth Heaven <onboarding@resend.dev>', to: [to], ...message}),
  });
  if (!res.ok) throw new Error('mail ' + res.status);
}
