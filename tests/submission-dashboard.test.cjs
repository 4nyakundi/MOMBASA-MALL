const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
function submissions({ fail = false, protocol = 'http:' } = {}) {
  const writes = [], cache = storage();
  const context = { window: {}, URL, location: { protocol }, localStorage: cache, console,
    document: { currentScript: { src: 'http://localhost/js/submissions.js' } },
    setTimeout, clearTimeout, BroadcastChannel: class { postMessage() {} close() {} },
    __import: async url => url.includes('firebase-config') ? { db: {} } : {
      doc: (_db, collection, id) => ({ collection, id }),
      setDoc: async (ref, data) => { if (fail) throw new Error('permission-denied'); writes.push({ ref, data }); }
    }
  };
  vm.runInNewContext(read('js/submissions.js').replaceAll('import(', '__import('), context);
  return { save: context.window.saveMallSubmission, writes, cache };
}
test('confirmation delivery path writes a stable ID and caches only acknowledged submissions', async () => {
  const { save, writes, cache } = submissions();
  const data = { id: 'contact-1', name: '<img src=x onerror=alert(1)>', submittedAt: '2026-10-14T03:00:00Z' };
  await save('contactLeads', data, 'contacts');
  assert.deepEqual(writes[0].ref, { collection: 'contactLeads', id: 'contact-1' });
  assert.equal(JSON.parse(cache.getItem('contacts'))[0].name, data.name);
});
test('database failures and file previews cannot produce a saved submission', async () => {
  const failed = submissions({ fail: true });
  await assert.rejects(failed.save('contactLeads', { id: 'test' }, 'contacts'), /permission-denied/);
  assert.equal(failed.cache.getItem('contacts'), null);
  const local = submissions({ protocol: 'file:' });
  await assert.rejects(local.save('contactLeads', { id: 'test' }, 'contacts'), /web address/);
  assert.equal(local.writes.length, 0);
});
function dashboard({ fail = false } = {}) {
  const writes = [], deletes = [], subscriptions = [];
  const context = { window: {}, localStorage: storage(), console, BroadcastChannel: undefined,
    document: { readyState: 'loading', addEventListener() {}, getElementById: () => null,
      querySelector: () => null, querySelectorAll: () => [] },
    setTimeout, clearTimeout, confirm: () => true };
  const source = read('admin/admin.js').replace(/\}\)\(\);\s*$/, `window.testHooks = {
    queueCloudChange, flushCloudChanges, syncWithFirestoreCloud, cloudCollections,
    setFirebase: value => Object.assign(fb, value), pending: () => outbox.length,
    setShops: rows => { shopsCache = rows; }, shops: () => shopsCache
  }; })();`);
  vm.runInNewContext(source, context);
  const api = context.window.testHooks;
  api.setFirebase({ isCloudReady: true, db: {}, auth: { currentUser: {} }, fsMod: {
    doc: (_db, collection, id) => ({ collection, id }), collection: (_db, name) => name,
    setDoc: async (ref, data) => { if (fail) throw new Error('permission-denied'); writes.push({ ref, data }); },
    deleteDoc: async ref => { deletes.push(ref); },
    onSnapshot: (collection, callback) => { subscriptions.push({ collection, callback }); return () => {}; }
  }});
  return { api, writes, deletes, subscriptions };
}
test('dashboard saves and deletes use the same database document ID', async () => {
  const { api, writes, deletes } = dashboard();
  api.setShops([{ id: 'shop-1', name: 'Store' }]);
  api.queueCloudChange('save_shop', 'shop-1');
  await api.flushCloudChanges();
  assert.equal(writes[0].ref.id, 'shop-1');
  api.queueCloudChange('delete_shop', 'shop-1');
  await api.flushCloudChanges();
  assert.equal(deletes[0].id, 'shop-1');
  assert.equal(api.pending(), 0);
});
test('failed dashboard writes remain queued for retry', async () => {
  const { api } = dashboard({ fail: true });
  api.setShops([{ id: 'shop-1', name: 'Store' }]);
  api.queueCloudChange('save_shop', 'shop-1');
  await assert.rejects(api.flushCloudChanges(), /permission-denied/);
  assert.equal(api.pending(), 1);
});
test('dashboard subscribes to every content and inquiry collection and accepts empty snapshots', () => {
  const { api, subscriptions } = dashboard();
  api.setShops([{ id: 'old' }]);
  api.syncWithFirestoreCloud();
  assert.equal(subscriptions.length, 9);
  for (const name of ['ledLeads', 'activationLeads', 'contactLeads', 'gallery', 'blogPosts', 'reviews']) {
    assert.ok(subscriptions.some(item => item.collection === name));
  }
  subscriptions.find(item => item.collection === 'shops').callback({ docs: [] });
  assert.equal(api.shops().length, 0);
});
test('all local JavaScript and inline page scripts parse', () => {
  for (const dir of ['js', 'admin', 'playon/js', 'led-advertising']) {
    for (const file of fs.readdirSync(path.join(root, dir)).filter(file => file.endsWith('.js'))) {
      let code = read(dir + '/' + file);
      // Native ES modules are checked with the Node parser separately below.
      if (!/^import\s/m.test(code)) new vm.Script(code, { filename: file });
    }
  }
  const pages = ['about-us.html', 'activations/index.html', 'led-advertising/index.html', 'playon/index.html', 'admin/index.html'];
  for (const file of pages) {
    for (const match of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[1].includes('type="module"') && !match[1].includes('application/ld+json')) new vm.Script(match[2], { filename: file });
    }
  }
});
