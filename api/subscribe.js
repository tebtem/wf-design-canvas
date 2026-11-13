// Vercel function: adds an email to the MailerLite "Canvas" group (the course and bootcamp waitlist).
// The MailerLite key stays on the server. Settings (Vercel > Project > Environment Variables):
//   MAILERLITE_API_KEY   required, a MailerLite API token (keep it a Secret)
//   MAILERLITE_GROUP_ID  optional; otherwise the group named MAILERLITE_GROUP_NAME (default "Canvas") is used
const API = 'https://connect.mailerlite.com/api';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
let cachedGroupId = null;

const allowedOrigin = (origin) => {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return host === 'womenfacilitating.com' || host.endsWith('.womenfacilitating.com') || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

async function groupId(headers) {
  if (process.env.MAILERLITE_GROUP_ID) return process.env.MAILERLITE_GROUP_ID;
  if (cachedGroupId) return cachedGroupId;
  const name = process.env.MAILERLITE_GROUP_NAME || 'Canvas';
  const res = await fetch(`${API}/groups?filter[name]=${encodeURIComponent(name)}&limit=25`, { headers });
  if (!res.ok) throw new Error(`groups ${res.status}`);
  const { data } = await res.json();
  const match = (data ?? []).find((g) => g.name.toLowerCase() === name.toLowerCase());
  if (!match) throw new Error(`group "${name}" not found`);
  cachedGroupId = match.id;
  return cachedGroupId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!allowedOrigin(req.headers.origin)) return res.status(403).json({ error: 'Not allowed.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  // Bots fill in the hidden "company" field; people never see it.
  if (body.company) return res.status(200).json({ ok: true });
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });

  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return res.status(503).json({ error: 'The waitlist is not set up yet.' });
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json' };

  try {
    const group = await groupId(headers);
    const ml = await fetch(`${API}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, groups: [group] }),
    });
    if (!ml.ok) throw new Error(`subscribers ${ml.status}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('waitlist', err.message);
    return res.status(502).json({ error: 'Could not join the waitlist right now. Please try again later.' });
  }
}
