export const EXAMPLE_ID = 'seal_1791376574481_7dd1b36d671b';
const SERVICES = [
  'https://buildseal-api-production-8d31.up.railway.app',
  'https://buildseal-api-production-3ca5.up.railway.app'
];
export const validId = id => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(id);

export function requestedId(search, pathname) {
  const query = new URLSearchParams(search).get('id');
  if (query) return query;
  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 2 && parts[0] === 'release' ? parts[1] : '';
}

export function interpretRecord(data, id) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.seal_id !== id) {
    throw new Error('RESPONSE_ID_MISMATCH');
  }
  const detail = data.verify_detail && typeof data.verify_detail === 'object' ? data.verify_detail : {};
  const checks = {
    root: detail.root_match,
    signature: detail.sig_valid,
    tsa: detail.tsa_verified,
    payload: detail.payload_binding_verified
  };
  let state = 'incomplete';
  let label = 'Not fully verified';
  let description = 'The service did not report a complete passing result.';
  if (data.verdict === 'INVALID') {
    state = 'invalid'; label = 'Service result: INVALID';
    description = 'The service returned INVALID. Read the individual checks and response for the reported reason.';
  } else if (data.verdict === 'VALID') {
    if (Object.values(checks).every(value => value === true) && detail.verified !== false && detail.verdict !== 'INVALID') {
      state = 'valid'; label = 'Service result: VALID';
      description = 'The service reports that root, signature, TSA and payload-binding checks passed. Content-file and strict verification are reported separately below. This browser has not independently verified the evidence.';
    } else {
      label = 'Incomplete or conflicting result';
      description = 'The service returned VALID without consistent passing details. This page does not display it as verified.';
    }
  }
  const summary = data.decision_summary && typeof data.decision_summary === 'object' ? data.decision_summary : {};
  const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : 'Not reported';
  return {
    state, label, description, checks,
    scopeChecks: {
      content: detail.content_hash_valid,
      strict: detail.strict_verified
    },
    id, decision: text(summary.decision),
    policy: text(summary.policy_version || summary.execution_context?.policy_version),
    date: text(data.sealed_at || data.created_at),
    root: text(data.root_hash || data.artifact_hash)
  };
}

export function publicCheckSummary(data) {
  const detail = data.verify_detail || {};
  return {
    seal_id: data.seal_id,
    verdict: data.verdict,
    verify_detail: {
      verified: detail.verified,
      verdict: detail.verdict,
      root_match: detail.root_match,
      sig_valid: detail.sig_valid,
      tsa_verified: detail.tsa_verified,
      payload_binding_verified: detail.payload_binding_verified,
      content_hash_valid:
        typeof detail.content_hash_valid === 'boolean'
          ? detail.content_hash_valid : null,
      strict_verified:
        typeof detail.strict_verified === 'boolean'
          ? detail.strict_verified : null,
      pack_version: detail.pack_version,
      issuer_trusted: detail.issuer_trusted ?? detail.fields?.issuer_trusted
    }
  };
}

export function failureMessage(error) {
  if (error.name === 'AbortError') return 'The service request timed out. Try again.';
  switch (error.message) {
    case 'HTTP_404': return 'No record was found in the current or legacy record service. Check the Proof ID.';
    case 'HTTP_401': case 'HTTP_403': return 'The record service requires access. No verification result is available.';
    case 'HTTP_429': return 'The record service is limiting requests. Try again later.';
    case 'RESPONSE_ID_MISMATCH': return 'The response did not identify the requested record. It is not displayed as verified.';
    case 'INVALID_JSON': return 'The service did not return a readable record. No verification result is available.';
    default: return 'The record service could not be reached or returned an error. No verification result is available.';
  }
}

export async function fetchRecord(id, signal, fetcher = fetch) {
  if (!validId(id)) throw new Error('INVALID_ID');
  for (let i = 0; i < SERVICES.length; i++) {
    const base = SERVICES[i];
    const response = await fetcher(base + '/verify/' + encodeURIComponent(id), {
      signal, cache: 'no-store', headers: {Accept: 'application/json'}
    });
    // Preserve lookup for older file records, but never mask an error or INVALID result.
    if (response.status === 404 && i === 0) continue;
    if (!response.ok) throw new Error('HTTP_' + response.status);
    let data;
    try { data = await response.json(); } catch { throw new Error('INVALID_JSON'); }
    return {data, base};
  }
  throw new Error('HTTP_404');
}

if (typeof document !== 'undefined') {
  const byId = id => document.getElementById(id);
  const form = document.querySelector('.lookup-form');
  const input = byId('proof-id');
  const card = byId('verification-card');
  let generation = 0;
  let controller;

  function clearResult() {
    for (const key of ['id','decision','policy','date','root']) byId('record-'+key).textContent = '—';
    byId('result-json').textContent = 'No result loaded.';
    byId('result-source').textContent = '';
    for (const key of ['root','signature','tsa','payload','content','strict']) {
      const node = byId('check-'+key);
      node.textContent = 'Not reported'; node.dataset.state = 'idle';
    }
  }

  function status(state, label, description) {
    byId('result-status').dataset.state = state;
    byId('result-status').textContent = label;
    byId('result-description').textContent = description;
  }

  async function load(id, updateUrl = false) {
    if (!form || !input || !card) return;
    const current = ++generation;
    controller?.abort();
    const errorNode = byId('lookup-error');
    clearResult(); errorNode.hidden = true; errorNode.textContent = '';
    if (!validId(id)) {
      const message = 'Enter a Proof ID using letters, numbers, underscores, dots, colons or hyphens (up to 200 characters).';
      errorNode.textContent = message; errorNode.hidden = false;
      status('error', 'Invalid Proof ID', 'No request was sent.');
      card.setAttribute('aria-busy','false');
      form.querySelector('button').disabled = false;
      return;
    }
    input.value = id;
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('id',id);
      url.hash = 'record';
      history.replaceState(null,'',url);
    }
    status('loading','Checking the service…','Waiting for a hosted response. No checks have passed yet.');
    card.setAttribute('aria-busy','true');
    form.querySelector('button').disabled = true;
    controller = new AbortController();
    const activeController = controller;
    const timeout = setTimeout(() => activeController.abort(), 18000);
    try {
      const {data,base} = await fetchRecord(id,controller.signal);
      const result = interpretRecord(data,id);
      if (current !== generation) return;
      status(result.state,result.label,result.description);
      for (const key of ['id','decision','policy','date','root']) byId('record-'+key).textContent = result[key];
      for (const [key,value] of Object.entries(result.checks)) {
        const node = byId('check-'+key);
        node.textContent = value === true ? 'Passed' : value === false ? 'Not passed' : 'Not reported';
        node.dataset.state = value === true ? 'pass' : value === false ? 'fail' : 'idle';
      }
      for (const [key, value] of Object.entries(result.scopeChecks)) {
        const node = byId('check-' + key);
        node.textContent = value === true ? 'Passed' :
          value === false
            ? (key === 'content' ? 'Not compared' : 'Not used')
            : 'Not reported';
        node.dataset.state = value === true ? 'pass' : 'idle';
      }
      byId('result-source').textContent = 'Response source: '+base+'/verify/'+encodeURIComponent(id);
      // Never dump payload_json, subject identifiers, TSA tokens or personal inputs.
      byId('result-json').textContent = JSON.stringify(publicCheckSummary(data),null,2);
    } catch (error) {
      if (current !== generation) return;
      status('error','No verified result',failureMessage(error));
    } finally {
      clearTimeout(timeout);
      if (current === generation) {
        card.setAttribute('aria-busy','false');
        form.querySelector('button').disabled = false;
      }
    }
  }

  form?.addEventListener('submit',event => {event.preventDefault();load(input.value.trim(),true);});
  document.querySelectorAll('[data-load-example]').forEach(button => button.addEventListener('click',() => load(EXAMPLE_ID,true)));
  const initial = requestedId(location.search,location.pathname);
  if (initial) load(initial);
  else if (document.body.dataset.page !== 'verify') load(EXAMPLE_ID);
  document.querySelector('[data-copy-request]')?.addEventListener('click',async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(byId('lookup-command').textContent);
      button.textContent = 'Copied';
    } catch { button.textContent = 'Select the command to copy'; }
  });
}
