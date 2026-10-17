(function () {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const attempts = new Map();
  window.saveMallSubmission = async function (collectionName, data) {
    if (location.protocol === 'file:') throw new Error('Use a PHP-enabled web address to submit this form.');
    const types = { contactLeads: 'contact', ledLeads: 'led', activationLeads: 'activation', playonBookings: 'playon' };
    const type = types[collectionName];
    if (!type) throw new Error('Unknown submission type.');
    // Keep the same request identity after a timeout/lost acknowledgement.
    const { id, submittedAt, ref_code, numeric_id, ...details } = data;
    const fingerprint = type + JSON.stringify(details);
    if (!attempts.has(fingerprint)) attempts.set(fingerprint, { ...data, request_id: id || crypto.randomUUID() });
    const payload = attempts.get(fingerprint);
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),20000);
    let response;
    try { response = await fetch(new URL('api/leads/' + type + '.php', base), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin', signal: controller.signal
    }); } catch(error) { throw new Error('We could not confirm delivery. Please retry with the same details.'); } finally { clearTimeout(timer); }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('We could not confirm delivery. Please try again.'); }
    if (!response.ok || result.success !== true) throw new Error(result.error || 'We could not confirm delivery. Please try again.');
    const serverId = result.lead_id || result.booking_id;
    if (!serverId || !result.ref_code) throw new Error('The server did not acknowledge your request. Please retry.');
    data.id = String(serverId);
    data.numeric_id = Number(serverId);
    data.ref_code = result.ref_code;
    attempts.delete(fingerprint);
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('mombasa_mall_sync_bus');
      channel.postMessage({ action: 'submission', entity: collectionName });
      channel.close();
    }
    return data.id;
  };
})();
