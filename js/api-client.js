(function () {
  'use strict';
  const root = new URL('../', document.currentScript.src);
  let csrfToken = '';
  async function request(path, options = {}) {
    if (location.protocol === 'file:') throw new Error('Open the site at a PHP-enabled web address to save or load live data.');
    const headers = { ...options.headers };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(new URL(path, root), { ...options, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('The data service is unavailable. Please try again.'); }
      if (!response.ok || data.success !== true) {
        const error = new Error(data.error || 'The server could not complete this request.');
        error.status = response.status;
        throw error;
      }
      if (data.token) csrfToken = data.token;
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The server took too long to respond. Retry with the same details.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function mutate(path, method, data) {
    return request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  const pending = new Map();
  function content(resource) {
    if (!pending.has(resource)) pending.set(resource, request('api/public/content.php?resource=' + encodeURIComponent(resource)));
    return pending.get(resource);
  }
  window.MallAPI = { request, mutate, content, root, setToken: value => { csrfToken = value; } };
})();
