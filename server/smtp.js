// A minimal SMTP client (implicit TLS, AUTH PLAIN) for the sign-in email, using only Node's own modules.
// Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=<address>, SMTP_PASS=<an app password>.
import net from 'node:net';
import tls from 'node:tls';
import {randomBytes} from 'node:crypto';

const CRLF = '\r\n';
const clean = text => String(text).replace(/[\r\n]+/g, ' ').trim(); // no header injection
const wrap64 = text => Buffer.from(text, 'utf8').toString('base64').replace(/.{76}/g, '$&' + CRLF);

/** Builds a multipart (plain text + HTML) message, both parts base64 so any character and line length is safe. */
export function buildMessage({from, to, subject, text, html, now = new Date(), id = randomBytes(12).toString('hex')}) {
  const boundary = 'ashes-' + id;
  const domain = /@([^>\s]+)/.exec(from)?.[1] ?? 'localhost';
  return [
    `From: ${clean(from)}`, `To: <${clean(to)}>`, `Subject: =?UTF-8?B?${Buffer.from(clean(subject)).toString('base64')}?=`,
    `Date: ${now.toUTCString()}`, `Message-ID: <${id}@${domain}>`, 'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap64(text),
    ...(html ? [`--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap64(html)] : []),
    `--${boundary}--`, '',
  ].join(CRLF);
}

/** Sends one message. `secure: false` speaks plain TCP (tests only). Throws with the server's reply on any refusal. */
export async function smtpSend({host, port = 465, user, pass, from, to, subject, text, html, secure = true, timeoutMs = 15_000}) {
  const socket = secure ? tls.connect({host, port, servername: host}) : net.connect({host, port});
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('smtp timeout')));
  let buffer = '', waiting = null;
  const replies = [];
  const settle = () => {
    // A reply is complete at a line "NNN text" (a hyphen after the code means more lines follow).
    let match;
    while ((match = /(?:^|\r\n)(\d{3}) [^\r\n]*\r\n/.exec(buffer))) {
      const end = match.index + match[0].length;
      replies.push({code: Number(match[1]), text: buffer.slice(0, end).trim()});
      buffer = buffer.slice(end);
    }
    if (waiting && replies.length) { const w = waiting; waiting = null; w.resolve(replies.shift()); }
  };
  socket.on('data', chunk => { buffer += chunk.toString('utf8'); settle(); });
  socket.on('error', error => { if (waiting) { const w = waiting; waiting = null; w.reject(error); } });
  const reply = () => new Promise((resolve, reject) => { waiting = {resolve, reject}; settle(); });
  const expect = async (want, line) => {
    if (line !== undefined) socket.write(line + CRLF);
    const r = await reply();
    if (r.code !== want) throw new Error(`smtp ${line?.split(' ')[0] ?? 'greeting'}: ${r.text.slice(0, 200)}`);
    return r;
  };
  try {
    await expect(220);
    await expect(250, 'EHLO ashes-ninth');
    await expect(235, 'AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`).toString('base64'));
    await expect(250, `MAIL FROM:<${clean(user)}>`);
    await expect(250, `RCPT TO:<${clean(to)}>`);
    await expect(354, 'DATA');
    const body = buildMessage({from, to, subject, text, html}).split(CRLF).map(l => (l.startsWith('.') ? '.' + l : l)).join(CRLF);
    await expect(250, body + CRLF + '.');
    socket.write('QUIT' + CRLF);
  } finally {
    socket.end();
  }
}
