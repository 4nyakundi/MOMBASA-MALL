(function () {
  'use strict';
  const base = new URL('.', document.currentScript.src);

  function getLeadEndpoint(collectionName, data) {
    if (collectionName === 'ledLeads' || data.packageRequested || data.screenType) {
      return new URL('../api/leads/led.php', base).href;
    }
    if (collectionName === 'activationLeads' || data.activationType) {
      return new URL('../api/leads/activation.php', base).href;
    }
    if (collectionName === 'playonBookings' || (data.id && String(data.id).startsWith('playon-'))) {
      return new URL('../api/leads/playon.php', base).href;
    }
    return new URL('../api/leads/contact.php', base).href;
  }

  window.saveMallSubmission = async function (collectionName, data, cacheKey) {
    if (location.protocol === 'file:') {
      console.log('[Mombasa Mall] Local protocol active, saving lead to local state bus.');
    } else {
      // 1. Post to Primary MySQL Backend API
      try {
        const endpoint = getLeadEndpoint(collectionName, data);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const resJson = await res.json();
          if (resJson.ref_code) data.ref_code = resJson.ref_code;
          if (resJson.lead_id) data.numeric_id = resJson.lead_id;
        }
      } catch (sqlErr) {
        console.warn('[SQL Lead Submission] Direct MySQL submission note:', sqlErr.message);
      }

      // 2. Backup to Firebase Firestore (non-blocking fallback)
      try {
        const [{ db }, sdk] = await Promise.all([
          import(new URL('firebase-config.js', base).href),
          import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js')
        ]);
        await sdk.setDoc(sdk.doc(db, collectionName, data.id), data);
      } catch (fbErr) {
        console.warn('[Firebase Lead Submission] Cloud fallback note:', fbErr.message);
      }
    }

    // 3. Cache locally and broadcast across tabs for real-time admin sync
    if (cacheKey) {
      try {
        const list = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        localStorage.setItem(cacheKey, JSON.stringify([data, ...list.filter(item => item.id !== data.id)]));
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('mombasa_mall_sync_bus');
          channel.postMessage({ action: 'submission', entity: collectionName });
          channel.close();
        }
      } catch (error) {
        console.warn('Submission delivered; browser cache note.', error);
      }
    }
    return data.id;
  };
})();
