(function () {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  window.saveMallSubmission = async function (collectionName, data, cacheKey) {
    if (location.protocol === 'file:') throw new Error('Please open the website through its web address to submit details.');
    let timer;
    const delivery = (async () => {
      const [{ db }, sdk] = await Promise.all([
        import(new URL('firebase-config.js', base).href),
        import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js')
      ]);
      await sdk.setDoc(sdk.doc(db, collectionName, data.id), data);
    })();
    await Promise.race([delivery, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Delivery could not be confirmed. Please contact the team before submitting again.')), 20000);
    })]).finally(() => clearTimeout(timer));
    if (cacheKey) {
      try {
        const list = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        localStorage.setItem(cacheKey, JSON.stringify([data, ...list.filter(item => item.id !== data.id)]));
        const channel = new BroadcastChannel('mombasa_mall_sync_bus');
        channel.postMessage({ action: 'submission', entity: collectionName });
        channel.close();
      } catch (error) { console.warn('Submission delivered; browser cache unavailable.', error); }
    }
    return data.id;
  };
})();
