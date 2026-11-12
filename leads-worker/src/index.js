// Coll Business Solutions LLC: website request form handler (Cloudflare Worker, free plan).
//
// The "Request a free mockup" form on websites.html posts here. Each request is checked and then
// emailed to the company inbox through Resend (free plan). Nothing is stored.
//
//   POST /api/lead    {name, business, phone, email, city, website, needs[], message, hp, t}
//   GET  /api/health  {ok:true, email:true|false}   email:false = RESEND_API_KEY isn't set yet
//
// Settings (wrangler.toml [vars]): LEAD_TO (who gets the emails), LEAD_FROM (the sender).
// Secret (set by .github/workflows/leads-worker.yml): RESEND_API_KEY.
//
// If email isn't set up, or Resend refuses, the API answers 503 and the page falls back to opening
// the visitor's email app with the request filled in, so no request is lost.

const SITE_ORIGINS = ['https://collbusinesssolutions.com', 'https://www.collbusinesssolutions.com'];
const NEEDS = ['New website', 'Redo my website', 'Bid app', 'AI phone assistant', 'Coll Timeclock', 'Cleanroom Control', 'Not sure yet'];
const LIMITS = { name: 80, business: 120, phone: 40, email: 254, city: 80, website: 300, message: 2000 };

export function allowedOrigin(origin, env = {}) {
  if (!origin) return '';
  const extra = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (SITE_ORIGINS.includes(origin) || extra.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return '';
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

// Checks a request. Returns {spam:true}, {error:'...'} or {lead:{...}}.
export function checkLead(body) {
  if (!body || typeof body !== 'object') return { error: 'Please fill out the form.' };
  // Spam traps: a hidden field people never see, and a form sent faster than a person can type.
  if (clean(body.hp, 200)) return { spam: true };
  const t = Number(body.t);
  if (Number.isFinite(t) && t >= 0 && t < 3000) return { spam: true };

  const lead = {};
  for (const [k, max] of Object.entries(LIMITS)) lead[k] = clean(body[k], max);
  lead.email = lead.email.toLowerCase();
  lead.needs = (Array.isArray(body.needs) ? body.needs : []).map(x => clean(x, 40)).filter(x => NEEDS.includes(x));

  if (!lead.name) return { error: 'Please enter your name.' };
  if (!lead.business) return { error: 'Please enter your business name.' };
  if (!lead.phone && !lead.email) return { error: 'Please enter a phone number or an email address.' };
  if (lead.email && !/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z0-9-]{2,}$/i.test(lead.email)) return { error: 'Please check your email address.' };
  if (lead.phone && lead.phone.replace(/\D/g, '').length < 7) return { error: 'Please check your phone number.' };
  if (/https?:\/\//i.test(lead.message) && (lead.message.match(/https?:\/\//gi) || []).length > 2) return { spam: true };
  return { lead };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function leadEmail(lead) {
  const rows = [
    ['Name', lead.name], ['Business', lead.business], ['Phone', lead.phone], ['Email', lead.email],
    ['City', lead.city], ['Current website', lead.website], ['Wants', lead.needs.join(', ')], ['Message', lead.message]
  ].filter(([, v]) => v);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nSent from the request form on collbusinesssolutions.com/websites.html';
  const html = '<h2 style="font-family:Arial,sans-serif">New website request</h2><table style="font-family:Arial,sans-serif;font-size:15px;border-collapse:collapse">' +
    rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#555;vertical-align:top"><b>${esc(k)}</b></td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('') +
    '</table><p style="font-family:Arial,sans-serif;color:#777;font-size:13px">Sent from the request form on collbusinesssolutions.com/websites.html. Reply to this email to answer them directly.</p>';
  return { subject: `New website request: ${lead.business}`, text, html };
}

function json(status, body, origin) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin) Object.assign(h, { 'access-control-allow-origin': origin, vary: 'Origin' });
  return new Response(JSON.stringify(body), { status, headers: h });
}

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get('origin'), env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: origin ? {
        'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin'
      } : {} });
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json(200, { ok: true, email: !!env.RESEND_API_KEY }, origin);
    }

    if (url.pathname === '/api/lead' && request.method === 'POST') {
      if (request.headers.get('origin') && !origin) return json(403, { ok: false, error: 'Not allowed.' }, '');
      const len = Number(request.headers.get('content-length') || 0);
      if (len > 20000) return json(413, { ok: false, error: 'That message is too long.' }, origin);
      let body;
      try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Please fill out the form.' }, origin); }

      const r = checkLead(body);
      if (r.spam) return json(200, { ok: true }, origin); // look normal to bots
      if (r.error) return json(400, { ok: false, error: r.error }, origin);

      if (!env.RESEND_API_KEY) return json(503, { ok: false, error: 'email_not_set_up' }, origin);
      const mail = leadEmail(r.lead);
      const payload = {
        from: env.LEAD_FROM || 'Coll Website <onboarding@resend.dev>',
        to: [env.LEAD_TO || 'collbusinesssolutions@gmail.com'],
        subject: mail.subject, text: mail.text, html: mail.html
      };
      if (r.lead.email) payload.reply_to = r.lead.email;
      let sent = false;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        sent = res.ok;
        if (!res.ok) console.log('Resend refused the email', res.status, await res.text());
      } catch (e) { console.log('Resend unreachable', String(e)); }
      if (!sent) return json(503, { ok: false, error: 'email_failed' }, origin);
      return json(200, { ok: true }, origin);
    }

    return json(404, { ok: false, error: 'Not found.' }, origin);
  }
};
