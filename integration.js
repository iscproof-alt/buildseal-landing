(function () {
  'use strict';
  var host = document.querySelector('#pricing .wrap');
  if (!host || document.getElementById('integration-live')) return;

  var style = document.createElement('style');
  style.textContent = `
    .integration-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:32px}
    .integration-grid>*{min-width:0}
    .integration-grid label{display:block;margin:16px 0}
    .integration-grid input,.integration-grid select,.integration-grid textarea{
      display:block;box-sizing:border-box;width:100%;margin-top:8px;
      padding:12px;border:1px solid #87939e;border-radius:6px;
      background:#fff;color:#17212b;font:inherit}
    .integration-grid pre{white-space:pre-wrap;overflow-wrap:anywhere;
      padding:16px;background:#13202b;color:#eef7ff;border-radius:8px}
    .integration-grid button{cursor:pointer}
    .integration-grid button:disabled{opacity:.6;cursor:wait}
    #integration-result{overflow-wrap:anywhere;margin-top:20px}
    @media(max-width:760px){.integration-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  var panel = document.createElement('div');
  panel.id = 'integration-live';
  panel.innerHTML = `
    <div class="integration-grid">
      <article class="plan">
        <p class="eyebrow">Live API request</p>
        <h3>Create your own decision record.</h3>
        <p>This sends a real request. Use fictional data only.
        Submitted values are stored by the service and may be accessible
        through the record link. This demo is not a separate storage environment.</p>
        <form id="integration-form">
          <label>Decision
            <select name="decision">
              <option value="APPROVE">APPROVE</option>
              <option value="REJECT">REJECT</option>
            </select>
          </label>
          <label>Reason
            <textarea name="reason" required maxlength="200" rows="3">Required documents were reviewed.</textarea>
          </label>
          <label>Input reference
            <input name="input_ref" required maxlength="64"
              pattern="[A-Za-z0-9._:\\-]+"
              value="demo-document-001">
          </label>
          <p class="fineprint">Actor: buildseal-web-demo · Type: integration_demo · Reason code: DEMO_REVIEW</p>
          <label><input type="checkbox" required style="display:inline;width:auto">
            I am submitting fictional, non-sensitive data.
          </label>
          <button class="btn" type="submit">Seal this decision</button>
        </form>
        <div id="integration-result" role="status" aria-live="polite"></div>
      </article>
      <article class="plan">
        <p class="eyebrow">Use from your server</p>
        <h3>Connect your application.</h3>
        <p>This request uses your own API key. Keep it on your server.
        The browser demo uses the fixed actor shown on the left;
        your application supplies its own actor.</p>
        <pre><code id="integration-curl"></code></pre>
        <details id="integration-response" hidden>
          <summary>Actual proxy response</summary>
          <pre id="integration-json"></pre>
        </details>
      </article>
    </div>`;
  host.appendChild(panel);

  var form = document.getElementById('integration-form');
  var out = document.getElementById('integration-result');
  var button = form.querySelector('button');
  var details = document.getElementById('integration-response');
  function values() {
    return {
      decision: form.elements.decision.value,
      reason: form.elements.reason.value.trim(),
      input_ref: form.elements.input_ref.value.trim()
    };
  }
  function renderCurl() {
    var v = values();
    var payload = {
      actor: 'your-app',
      decision_type: 'integration_demo',
      decision: v.decision,
      reason_code: 'DEMO_REVIEW',
      reasons: [v.reason],
      input_ref: v.input_ref
    };
    var body = JSON.stringify(payload, null, 2).replace(/'/g, "'\\''");
    document.getElementById('integration-curl').textContent = [
      "curl --fail-with-body --silent --show-error \\",
      "  -X POST 'https://buildseal-api-production-8d31.up.railway.app/seal/decision' \\",
      "  -H 'Content-Type: application/json' \\",
      '  -H "x-api-key: $BUILDSEAL_API_KEY" \\',
      "  --data-raw '" + body + "'"
    ].join('\n');
  }
  form.addEventListener('input', renderCurl);
  renderCurl();

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled) return;
    var submitted = values();
    if (!submitted.reason) {
      out.textContent = 'Enter a reason.';
      return;
    }
    button.disabled = true;
    details.hidden = true;
    out.textContent = 'Processing — waiting for the service to confirm the record.';
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 35000);
    try {
      var response = await fetch('/api/seal-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitted),
        signal: ctrl.signal
      });
      var data = await response.json();
      document.getElementById('integration-json').textContent =
        JSON.stringify(data, null, 2);
      details.hidden = false;
      var record = data && data.upstream;
      if (!response.ok || data.ok !== true ||
          !record || record.ok !== true ||
          record.verdict !== 'VALID' ||
          record.timestamped !== true ||
          !record.tsa || record.tsa.present !== true ||
          record.decision !== submitted.decision ||
          !/^seal_[A-Za-z0-9_-]+$/.test(record.seal_id || '') ||
          !/^[a-f0-9]{64}$/i.test(record.artifact_hash || '') ||
          !/^[a-f0-9]{64}$/i.test(record.root_hash || '')) {
        var message = response.status === 429
          ? 'Too many requests. Please try later.'
          : 'The record could not be confirmed.';
        out.textContent = message +
          ' No sealed result is displayed. Error: ' +
          String(data.error || 'unexpected_response') +
          '. Do not automatically retry: the outcome may be uncertain.';
        return;
      }
      out.textContent = 'Sealed — service confirmed. Record ID: ' +
        record.seal_id + ' ';
      var link = document.createElement('a');
      link.href = '/verify?id=' + encodeURIComponent(record.seal_id);
      link.textContent = 'Open verification';
      link.target = '_blank';
      link.rel = 'noopener';
      out.appendChild(link);
    } catch (error) {
      out.textContent =
        'The outcome could not be confirmed. The request may have reached the service. ' +
        'No sealed result is displayed; do not automatically retry.';
    } finally {
      clearTimeout(timer);
      button.disabled = false;
    }
  });
})();
