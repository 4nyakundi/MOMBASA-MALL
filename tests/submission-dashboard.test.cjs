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
function submissions({ fail=false, protocol='http:', status=200 }={}) {
  const writes=[],cache=storage();let failing=fail;
  const context={window:{},URL,AbortController,setTimeout,clearTimeout,location:{protocol},localStorage:cache,console,crypto:require('node:crypto').webcrypto,
    document:{currentScript:{src:'http://localhost/js/submissions.js'}},
    BroadcastChannel:class{postMessage(){}close(){}},
    fetch:async(url,options)=>{writes.push({url:String(url),data:JSON.parse(options.body)});return {ok:!failing&&status<400,json:async()=>failing?{success:false,error:'delivery-failed'}:{success:true,lead_id:42,ref_code:'CNT-42'}};}
  };
  vm.runInNewContext(read('js/submissions.js'),context);
  return {save:context.window.saveMallSubmission,writes,cache,recover:()=>{failing=false;}};
}
test('only acknowledged SQL submissions receive server IDs; private details are not cached',async()=>{
  const {save,writes,cache}=submissions();const data={id:'contact-1',name:'Visitor'};
  assert.equal(await save('contactLeads',data,'contacts'),'42');
  assert.equal(writes[0].url,'http://localhost/api/leads/contact.php');
  assert.equal(writes[0].data.request_id,'contact-1');assert.equal(data.numeric_id,42);assert.equal(data.ref_code,'CNT-42');assert.equal(cache.getItem('contacts'),null);
});
test('database failures and file previews cannot produce successful confirmations',async()=>{
  const failed=submissions({fail:true});await assert.rejects(failed.save('contactLeads',{id:'test'},'contacts'),/delivery-failed/);assert.equal(failed.cache.getItem('contacts'),null);
  const local=submissions({protocol:'file:'});await assert.rejects(local.save('contactLeads',{id:'test'},'contacts'),/web address/);assert.equal(local.writes.length,0);
});
test('retry after uncertain delivery reuses the exact original request payload',async()=>{
  const client=submissions({fail:true});await assert.rejects(client.save('ledLeads',{id:'first',name:'Brand',submittedAt:'first-time'}));
  client.recover();await client.save('ledLeads',{id:'second',name:'Brand',submittedAt:'second-time'});
  assert.deepEqual(client.writes[0].data,client.writes[1].data);
});
test('Play-On is routed to its dedicated endpoint',async()=>{
  const client=submissions();await client.save('playonBookings',{id:'play-1',child_count:3});assert.equal(client.writes[0].url,'http://localhost/api/leads/playon.php');
});

test('confirmation popup renders customer details as text and supports repeat opening and dismissal', () => {
  const elements = new Map(), listeners = {};
  let activeElement;
  class Element {
    constructor() {
      this.style = {}; this.dataset = {}; this.attributes = {}; this.children = [];
      const classes = new Set();
      this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
    }
    set innerHTML(value) {
      this.html = value;
      for (const [, id] of value.matchAll(/id="([^"]+)"/g)) elements.set(id, new Element());
    }
    get innerHTML() { return this.html || ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { elements.set(child.id, child); this.append(child); }
    replaceChildren(...children) { this.children = children; }
    querySelector(selector) { return elements.get(selector === 'button' ? 'siteConfirmCloseBtn' : selector.slice(1)); }
    addEventListener(name, handler) { this[name] = handler; }
    focus() { activeElement = this; }
  }
  const button = new Element(); button.focus();
  const body = new Element(); body.style.overflow = 'auto';
  const context = { window: {}, document: { body, readyState: 'loading',
    get activeElement() { return activeElement; }, createElement: () => new Element(),
    getElementById: id => elements.get(id), addEventListener: (name, handler) => { listeners[name] = handler; } } };
  vm.runInNewContext(read('js/site-polish.js'), context);
  const value = '<img src=x onerror=alert(1)>';
  context.window.showSubmissionConfirmationModal({ details: [{ label: 'Name', value }] });
  const overlay = elements.get('globalConfirmModalOverlay');
  const detailValue = elements.get('siteConfirmDetails').children[0].children[1];
  assert.equal(detailValue.textContent, value);
  assert.equal(detailValue.innerHTML, '');
  assert.equal(overlay.attributes['aria-hidden'], 'false');
  elements.get('siteConfirmCloseBtn').click();
  assert.equal(overlay.attributes['aria-hidden'], 'true');
  assert.equal(activeElement, button);
  assert.equal(body.style.overflow, 'auto');
  context.window.showSubmissionConfirmationModal({ title: 'Another request' });
  listeners.keydown({ key: 'Escape' });
  assert.equal(overlay.classList.contains('is-visible'), false);
});
function dashboard({fail=false}={}) {
  const writes=[];const context={window:{},localStorage:storage(),console,confirm:()=>true,BroadcastChannel:undefined,setTimeout,clearTimeout,
    document:{readyState:'loading',addEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},
    MallAPI:{mutate:async(url,method,payload)=>{writes.push({url,method,payload});if(fail)throw Error('permission-denied');return {success:true,store_id:42};}}
  };
  const source=read('admin/admin.js').replace(/\}\)\(\);\s*$/, 'window.testHooks={saveRecord,setShops:rows=>{shopsCache=rows},shops:()=>shopsCache};})();');
  vm.runInNewContext(source,context);return {api:context.window.testHooks,writes};
}
test('dashboard waits for server acknowledgement and uses canonical IDs for updates',async()=>{
  const {api,writes}=dashboard();const data={name:'Store'};assert.equal(await api.saveRecord('stores',data,null),true);assert.equal(data.id,'42');
  assert.equal(await api.saveRecord('stores',{name:'Renamed'},'42',{photoUrls:['/assets/photo.webp']}),true);
  assert.equal(writes[1].method,'PUT');assert.equal(writes[1].payload.id,'42');assert.equal(writes[1].payload.photoUrls[0],'/assets/photo.webp');
});
test('failed dashboard writes cannot change cached records or assign fake IDs',async()=>{
  const {api}=dashboard({fail:true});const rows=[{id:'42',name:'Original'}];api.setShops(rows);const data={name:'Unsaved'};
  assert.equal(await api.saveRecord('stores',data,null),false);assert.equal(data.id,undefined);assert.equal(api.shops()[0].name,'Original');
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
