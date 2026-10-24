'use strict';

const UPSTREAM =
  'https://buildseal-api-production-8d31.up.railway.app/seal/decision';

const hits = new Map();
const WINDOW = 10 * 60 * 1000;

// Instance-local limit; not a shared, persistent quota.
function limited(ip) {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now >= entry.until) hits.delete(key);
  }
  let entry = hits.get(ip);
  if (!entry) {
    if (hits.size >= 5000) return true;
    entry = { count: 0, until: now + WINDOW };
    hits.set(ip, entry);
  }
  return ++entry.count > 5;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const key = process.env.BUILDSEAL_API_KEY;
  if (!key) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: 'invalid_body' });
  }
  if (Object.keys(body).some(k =>
    !['decision', 'reason', 'input_ref'].includes(k))) {
    return res.status(400).json({ ok: false, error: 'unexpected_field' });
  }

  const decision = body.decision;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const ref = typeof body.input_ref === 'string' ? body.input_ref.trim() : '';

  if (!['APPROVE', 'REJECT'].includes(decision) ||
      !reason || reason.length > 200 ||
      !/^[A-Za-z0-9._:-]{1,64}$/.test(ref)) {
    return res.status(400).json({ ok: false, error: 'invalid_fields' });
  }

  const ip = String(req.headers['x-forwarded-for'] || 'unknown')
    .split(',')[0].trim();
  if (limited(ip)) {
    res.setHeader('Retry-After', '600');
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(UPSTREAM, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key
      },
      body: JSON.stringify({
        actor: 'buildseal-web-demo',
        decision_type: 'integration_demo',
        decision,
        reason_code: 'DEMO_REVIEW',
        reasons: [reason],
        input_ref: ref
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return res.status(response.status === 429 ? 429 : 502).json({
        ok: false,
        error: 'upstream_rejected',
        status: response.status
      });
    }

    const result = await response.json();
    if (result?.ok !== true ||
        result.verdict !== 'VALID' ||
        result.timestamped !== true ||
        result.tsa?.present !== true ||
        result.decision !== decision ||
        !/^seal_[A-Za-z0-9_-]+$/.test(result.seal_id || '') ||
        !/^[a-f0-9]{64}$/i.test(result.artifact_hash || '') ||
        !/^[a-f0-9]{64}$/i.test(result.root_hash || '')) {
      return res.status(502).json({
        ok: false,
        error: 'unconfirmed_seal_result'
      });
    }

    return res.status(200).json({ ok: true, upstream: result });
  } catch (error) {
    return res.status(error.name === 'AbortError' ? 504 : 502).json({
      ok: false,
      error: error.name === 'AbortError'
        ? 'upstream_timeout'
        : 'upstream_unreachable'
    });
  } finally {
    clearTimeout(timer);
  }
};
