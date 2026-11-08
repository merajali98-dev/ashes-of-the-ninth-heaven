// The sign-in email's SMTP client, against a fake SMTP server on this machine (plain TCP; production uses TLS).
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {buildMessage, smtpSend} from '../server/smtp.js';

function fakeServer({authOk = true} = {}) {
  const seen = [];
  const server = net.createServer(socket => {
    let buffer = '', data = false;
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', chunk => {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (data) {
          if (line === '.') { data = false; socket.write('250 2.0.0 queued\r\n'); } else seen.push('BODY ' + line);
          continue;
        }
        seen.push(line);
        if (line.startsWith('EHLO')) socket.write('250-fake\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');
        else if (line.startsWith('AUTH')) socket.write(authOk ? '235 2.7.0 Accepted\r\n' : '535 5.7.8 Username and Password not accepted\r\n');
        else if (line.startsWith('MAIL') || line.startsWith('RCPT')) socket.write('250 OK\r\n');
        else if (line === 'DATA') { data = true; socket.write('354 Go ahead\r\n'); }
        else if (line === 'QUIT') socket.end('221 bye\r\n');
      }
    });
  });
  return {server, seen};
}

test('the SMTP client signs in, sends one message and quits', async () => {
  const {server, seen} = fakeServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await smtpSend({host: '127.0.0.1', port: server.address().port, secure: false, user: 'game@example.com', pass: 'app-pass',
      from: 'Ashes <game@example.com>', to: 'player@example.com', subject: 'Your seal code: 123456', text: 'Your code is 123456.\n.hidden line', html: '<b>123456</b>'});
    assert.deepEqual(seen.filter(l => !l.startsWith('BODY')).slice(0, 5), ['EHLO ashes-ninth',
      'AUTH PLAIN ' + Buffer.from('\0game@example.com\0app-pass').toString('base64'), 'MAIL FROM:<game@example.com>', 'RCPT TO:<player@example.com>', 'DATA']);
    const body = seen.filter(l => l.startsWith('BODY ')).map(l => l.slice(5)).join('\n');
    assert.match(body, /^To: <player@example.com>$/m);
    assert.match(body, /Content-Type: multipart\/alternative/);
    const text = Buffer.from(/text\/plain[\s\S]*?base64\n\n([\s\S]*?)\n--/.exec(body)[1].replace(/\n/g, ''), 'base64').toString();
    assert.equal(text, 'Your code is 123456.\n.hidden line');
  } finally { server.close(); }
});

test('a refused password is an error, and a header cannot be injected through the address', async () => {
  const {server} = fakeServer({authOk: false});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await assert.rejects(smtpSend({host: '127.0.0.1', port: server.address().port, secure: false, user: 'u', pass: 'wrong', from: 'u', to: 'p@example.com',
      subject: 's', text: 't'}), /Username and Password not accepted/);
  } finally { server.close(); }
  const message = buildMessage({from: 'A <a@x.y>', to: 'p@example.com\r\nBcc: evil@example.com', subject: 'Hi\r\nBcc: evil@example.com', text: 'x'});
  assert.doesNotMatch(message, /\r\nBcc:/);
});
