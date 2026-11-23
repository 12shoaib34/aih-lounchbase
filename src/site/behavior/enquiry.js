let provider;
function loadProvider() {
  if (window.turnstile) return Promise.resolve();
  if (!provider) provider = new Promise((resolve,reject) => {
    const script = document.createElement("script");
    const fail = () => { clearTimeout(timeout); script.remove(); provider = undefined; reject(new Error("Verification unavailable")); };
    const timeout = setTimeout(fail,12000);
    script.onerror = fail;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    document.head.append(script);
  });
  return provider;
}
export default function mount(scope) {
  const form = document.querySelector('#brief');
  const send = document.querySelector('#send-enquiry');
  const status = document.querySelector('#send-status');
  const verification = document.querySelector('#verification');
  const submissionId = crypto.randomUUID();
  let widget, token = '', busy = false, received = false;
  let failure = '', original, uncertain = false;
  let lockedFields = [];

  function lockDetails() {
    if (original) return;
    const fields = new FormData(form);
    const arrangement = fields.get('supportArrangement');
    if (arrangement) fields.set('service', arrangement);
    fields.delete('supportArrangement');
    original = Object.fromEntries(fields);
    if (window.BriefContext) original.message = window.BriefContext.message();
    lockedFields = [...form.elements].filter(field => field.name && !field.disabled && !verification.contains(field));
    for (const field of lockedFields) field.disabled = true;
    form.dataset.submissionLocked = 'true';
  }

  function releaseDetails() {
    for (const field of lockedFields) field.disabled = false;
    lockedFields = [];
    original = undefined;
    delete form.dataset.submissionLocked;
  }

  function unavailable() {
    if (!scope.active || received || busy) return;
    token = '';
    send.disabled = true;
    const email = document.createElement('a');
    email.href = 'mailto:inquiry@appsinhours.com';
    email.textContent = 'inquiry@appsinhours.com';
    form.querySelector('label').before(status);
    status.replaceChildren('Online enquiries are unavailable. Email ', email, ' to contact the studio.');
  }

  async function prepare() {
    status.textContent = 'Loading enquiry verification…';
    try {
      const response = await fetch('/api/enquiry', { signal: AbortSignal.timeout(10000) });
      const config = response.ok && await response.json();
      if (!scope.active) return;
      if (!config?.enabled || !config.siteKey) return unavailable();
      status.textContent = 'Complete the verification to send your enquiry.';
      await loadProvider();
      if (!scope.active) return;
      widget = window.turnstile.render(verification, {
        sitekey: config.siteKey,
        action: 'enquiry',
        callback(value) {
          if (!scope.active || received || busy || verification.hidden) return;
          send.after(status);
          token = value;
          send.disabled = false;
          status.textContent = failure ? failure + ' Ready to retry.' : 'Ready to send.';
        },
        'expired-callback'() {
          if (!scope.active || received || busy || verification.hidden) return;
          token = '';
          send.disabled = true;
          status.textContent = 'Verification expired. Please verify again.';
        },
        'error-callback': unavailable,
      });
    } catch { unavailable(); }
  }

  scope.dispose(() => { if (widget !== undefined) window.turnstile?.remove(widget); });

  // The homepage form is several sections below the hero. Start the provider only
  // near the form, or immediately when a keyboard user reaches a field.
  if (document.querySelector('.op-hero') && 'IntersectionObserver' in window) {
    const observer = scope.observe(IntersectionObserver, entries => {
      if (entries.some(entry => entry.isIntersecting)) start();
    }, { rootMargin: '500px' });
    function start() {
      observer.disconnect();
      form.removeEventListener('focusin', start);
      if (!started) { started = true; prepare(); }
    }
    let started = false;
    observer.observe(form);
    scope.on(form, 'focusin', start);
  } else {
    prepare();
  }

  scope.on(form, 'submit', async event => {
    event.preventDefault();
    if (busy || received) return;
    if (!token || !form.reportValidity()) return;
    busy = true;
    failure = '';
    send.disabled = true;
    send.textContent = 'Sending…';
    status.textContent = 'Sending your enquiry…';
    form.setAttribute('aria-busy', 'true');
    lockDetails();
    const data = { ...original, token, submissionId };
    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!scope.active) return;
      if (response.ok && result.ok) {
        received = true;
        status.textContent = result.message || 'Thank you. Your enquiry has been received.';
        send.textContent = 'Enquiry submitted';
        verification.hidden = true;
      } else if (response.status === 503) {
        busy = false;
        verification.hidden = true;
        unavailable();
        return;
      } else {
        if (response.status >= 500) uncertain = true;
        failure = result.error || 'Sending could not be confirmed. Your details are preserved.';
      }
    } catch {
      uncertain = true;
      failure = 'Sending could not be confirmed.';
    } finally {
      busy = false;
      token = '';
      form.removeAttribute('aria-busy');
      if (scope.active && !received) {
        if (!uncertain) releaseDetails();
        send.textContent = uncertain ? 'Retry original enquiry ↗' : 'Send enquiry ↗';
        if (failure) {
          if (uncertain) failure += ' Retry to confirm the original enquiry. Its details are locked to avoid sending a different request.';
          status.textContent = failure;
          if (widget !== undefined) window.turnstile.reset(widget);
        }
      }
    }
  });
}
