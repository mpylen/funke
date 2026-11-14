'use strict';
/* E-Mail-Versand über Resend (https://resend.com). Ohne RESEND_API_KEY wird nur ins Log geschrieben (Entwicklung). */
async function sendMail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`[mail:dev] an ${to}: ${subject}\n${text}`); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Funke <hallo@example.com>', to: [to], subject, text })
  });
  if (!r.ok) console.error('[mail] Versand fehlgeschlagen', r.status, (await r.text()).slice(0, 200));
}
module.exports = { sendMail };
