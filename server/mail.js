// Sends the sign-in email through Resend when RESEND_API_KEY is set. Without it the server is in "development
// sign-in" mode: the link and code are returned to the page and shown on screen, so nobody needs an inbox.
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendSignInMail({to, code, link}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      from: process.env.ASHES_MAIL_FROM || 'Ashes of the Ninth Heaven <onboarding@resend.dev>',
      to: [to], subject: `Your seal code: ${code}`,
      text: `Your code is ${code}.\n\nOr open this link to enter the Ash Market:\n${link}\n\nIt works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error('mail ' + res.status);
}
