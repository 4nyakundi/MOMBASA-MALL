(function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titles={led:'LED campaign',activation:'Activation booking',contact:'Contact / leasing inquiry'};
  let modal, form, type, recordId, media=[], busy=false, uploading=false, returnFocus, user, pending=null;
  const common=[['contactName','Contact person',150,true,'text'],['email','Email',200,false,'email'],['phone','Phone',30,false,'tel']];
  function field(name,label,max,required=false,inputType='text',value='') {
    return `<div class="form-group"><label for="lead-${name}">${label}${required?' *':''}</label><input class="form-control" id="lead-${name}" name="${name}" type="${inputType}" maxlength="${max}" ${required?'required':''} value="${escape(value)}"></div>`;
  }
  function area(name,label,value='',required=false) {return `<div class="form-group col-2"><label for="lead-${name}">${label}${required?' *':''}</label><textarea class="form-control" id="lead-${name}" name="${name}" maxlength="20000" rows="4" ${required?'required':''}>${escape(value)}</textarea></div>`;}
  function statusOptions(value) {
    const options={new:'New',contacted:'Contacted',won:'Booked / won',lost:'Declined / lost',quoted:'Quoted',approved:'Approved',confirmed:'Confirmed',completed:'Completed',closed:'Closed',cancelled:'Cancelled',rejected:'Rejected','in-progress':'In progress',reviewed:'Reviewed'};
    if(value==='in_progress') {delete options['in-progress'];options.in_progress='In progress';}
    return Object.entries(options).map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${label}</option>`).join('');
  }
  function init() {
    modal=document.createElement('div');modal.id='leadEntryModal';modal.className='modal-backdrop lead-entry-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','leadEntryTitle');modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="modal-card"><header class="modal-header"><h3 id="leadEntryTitle"></h3><button type="button" class="modal-close" data-lead-close aria-label="Close inquiry form">×</button></header><form id="leadEntryForm"><div class="modal-body"><p class="lead-entry-intro">Record a phone call, walk-in or confirmed booking here. Provide a phone number or email for follow-up.</p><div class="form-grid" id="leadEntryFields"></div><p id="leadEntryError" class="lead-entry-error" role="alert"></p></div><footer class="modal-footer"><button type="button" class="btn-cancel" data-lead-close>Cancel</button><button class="btn-primary" type="submit" id="saveLeadEntry">Save inquiry</button></footer></form></div>';
    document.body.append(modal);form=modal.querySelector('form');form.addEventListener('submit',save);
    modal.querySelectorAll('[data-lead-close]').forEach(button=>button.addEventListener('click',close));
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const controls=[...modal.querySelectorAll('input,select,textarea,button,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
    for(const id of ['ledStatusFilter','activationStatusFilter','contactStatusFilter']){const select=document.getElementById(id);if(select)select.innerHTML='<option value="all">All statuses</option>'+statusOptions('');}
    document.querySelectorAll('[data-add-inquiry]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.addInquiry)));
  }
  function error(message) {document.getElementById('leadEntryError').textContent=message;}
  function close() {if(busy||uploading)return;if(pending){error('The last save has not been confirmed. Retry it before closing to avoid creating a duplicate.');return;}modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');returnFocus?.focus();}
  function open(kind,row={}) {
    if(!modal)init(); if(busy||uploading)return;
    type=kind;recordId=row.id||null;pending=null;media=(row.mediaAssets||[]).map(asset=>({...asset}));returnFocus=document.activeElement;
    document.getElementById('leadEntryTitle').textContent=(recordId?'Edit ':'Add ')+titles[type];
    const fields=[];
    if(type==='led') fields.push(field('businessName','Company / client',200,true,'text',row.businessName));
    if(type==='activation') fields.push(field('companyName','Company / client',200,true,'text',row.companyName));
    if(type==='contact') fields.push(field('name','Sender name',150,true,'text',row.name));
    for(const config of common) {if(type==='contact'&&config[0]==='contactName')continue;fields.push(field(...config,row[config[0]]));}
    if(type==='led') {
      fields.push(field('packageRequested','Screen package / placement',120,true,'text',row.packageRequested||'Outdoor billboard'));
      fields.push(field('campaignStartDate','Campaign start date',10,false,'date',row.campaignStartDate));
      fields.push(`<div class="form-group"><label for="lead-durationDays">Duration (days) *</label><input id="lead-durationDays" name="durationDays" class="form-control" type="number" min="1" max="3650" required value="${escape(row.durationDays||30)}"><small id="leadWindowPreview"></small></div>`);
      fields.push(field('slotLength','Ad slot / rotation',80,false,'text',row.slotLength||'15s every 3m (24/7)'));
      fields.push(field('referralCompany','Referred by / agency / introducing company',200,false,'text',row.referralCompany));
      fields.push(`<div class="form-group"><label for="lead-cost">Campaign amount before VAT (KES)</label><input class="form-control" id="lead-cost" name="cost" type="number" min="0" max="8000000000" step="0.01" value="${escape(row.estimated_cost_kes||0)}"><small>16% VAT is calculated when saved. Leave 0 until quoted.</small></div>`);
      fields.push(area('notes','Campaign notes & requirements',row.notes||row.message));
      fields.push(`<div class="form-group col-2 lead-media"><label for="leadMediaFiles">Campaign media</label><input id="leadMediaFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"><small>Images or MP4/MOV, up to 20 MB each. For larger files, add a media link. Removing an attachment here does not delete the uploaded file.</small><div class="lead-media-link"><input class="form-control" id="leadMediaLink" type="url" placeholder="https://…" aria-label="Campaign media link"><button type="button" class="btn-secondary" id="leadAddMediaLink">Attach link</button></div><p id="leadUploadStatus" role="status"></p><ul id="leadMediaList"></ul></div>`);
    }
    if(type==='activation') {
      fields.push(field('activationType','Activation type / space',120,true,'text',row.activationType||'Central Atrium Showcase'));
      fields.push(field('bookingStartDate','Booking start date',10,true,'date',row.bookingStartDate));
      fields.push(`<div class="form-group"><label for="lead-durationDays">Duration (days) *</label><input id="lead-durationDays" name="durationDays" class="form-control" type="number" min="1" max="3650" required value="${escape(row.durationDays||1)}"><small id="leadWindowPreview"></small></div>`);
      fields.push(area('concept','Concept & requirements',row.concept||row.message,true));
    }
    if(type==='contact') {fields.push(field('subject','Subject',100,true,'text',row.subject||'General Inquiry'));fields.push(area('message','Message',row.message,true));}
    fields.push(`<div class="form-group"><label for="lead-status">Status</label><select class="form-control" id="lead-status" name="status">${statusOptions(row.status||(type==='led'?'won':'new'))}</select></div>`);
    fields.push(area('admin_notes','Internal notes',row.admin_notes));
    document.getElementById('leadEntryFields').innerHTML=fields.join('');error('');modal.querySelector('#saveLeadEntry').textContent='Save inquiry';
    if(type==='led') {
      renderMedia();
      const upload=document.getElementById('leadMediaFiles');
      if(user && !['admin','superadmin'].includes(user.role)){upload.disabled=true;upload.title='A media administrator can upload files; you can attach an existing media link.';}
      upload.addEventListener('change',uploadMedia);
      document.getElementById('leadAddMediaLink').addEventListener('click',()=>{const input=document.getElementById('leadMediaLink');let url;try{url=new URL(input.value);if(!['http:','https:'].includes(url.protocol))throw Error();}catch{error('Enter an HTTP(S) media link.');return;}if(media.length>=12){error('Attach up to 12 media files or links.');return;}media.push({url:url.href,name:'Campaign media link'});input.value='';error('');renderMedia();});
    }
    form.querySelectorAll('[type="date"],[name="durationDays"]').forEach(input=>input.addEventListener('input',previewWindow));previewWindow();
    modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');requestAnimationFrame(()=>modal.querySelector('input')?.focus());
  }
  function previewWindow() {const start=form.querySelector('[type="date"]')?.value;const days=Number(form.elements.durationDays?.value);const out=document.getElementById('leadWindowPreview');if(!out)return;if(!start||!Number.isInteger(days)||days<1){out.textContent='';return;}const date=new Date(start+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days-1);out.textContent='Through '+date.toISOString().slice(0,10)+' (start and end dates included)';}
  function renderMedia() {
    const list=document.getElementById('leadMediaList');list.replaceChildren();
    media.forEach((asset,index)=>{const li=document.createElement('li'),link=document.createElement('a'),remove=document.createElement('button');link.href=asset.url;link.target='_blank';link.rel='noopener';link.textContent=asset.name||'Campaign media';remove.type='button';remove.className='btn-secondary btn-sm';remove.textContent='Remove';remove.addEventListener('click',()=>{media.splice(index,1);renderMedia();});li.append(link,remove);list.append(li);});
  }
  async function uploadMedia(event) {
    const files=[...event.target.files];event.target.value='';if(!files.length)return;
    if(media.length+files.length>12){error('Attach up to 12 media files or links.');return;}
    if(files.some(file=>file.size>20*1024*1024)){error('Each upload must be 20 MB or smaller. Use a media link for a larger file.');return;}
    uploading=true;setBusy(true);error('');
    try {for(const file of files){document.getElementById('leadUploadStatus').textContent='Uploading '+file.name+'…';const body=new FormData();body.append('file',file);const response=await MallAPI.request('api/admin/upload.php',{method:'POST',body});media.push({url:response.url,name:file.name});renderMedia();}document.getElementById('leadUploadStatus').textContent='Media uploaded. Save the inquiry to attach it.';}
    catch(err){error(err.message);document.getElementById('leadUploadStatus').textContent='Upload stopped. Successfully uploaded files remain attached below.';}
    finally{uploading=false;setBusy(false);}
  }
  function setBusy(value) {modal.querySelectorAll('button').forEach(button=>button.disabled=value);document.getElementById('saveLeadEntry').textContent=value?'Saving…':pending?'Retry save':'Save inquiry';}
  async function save(event) {
    event.preventDefault();if(busy||uploading||!form.reportValidity())return;
    const payload=pending||Object.fromEntries(new FormData(form));
    if(!pending) {payload.type=type;if(recordId)payload.id=recordId;else payload.request_id=crypto.randomUUID();if(type!=='contact')payload.durationDays=Number(payload.durationDays);if(type==='led'){payload.cost=Number(payload.cost);payload.mediaAssets=media.map(asset=>({...asset}));}}
    if(!payload.email&&!payload.phone){error('Enter a phone number or email address for follow-up.');return;}
    busy=true;setBusy(true);error('');
    try {
      await MallAPI.mutate('api/admin/leads.php',recordId?'PUT':'POST',payload);pending=null;
      const refreshed=await window.syncFromBackendSQL(true);
      busy=false;setBusy(false);close();
      window.dispatchEvent(new CustomEvent('mall-inquiry-saved',{detail:{refreshed}}));
    } catch(err) {
      // An uncertain POST retry keeps the exact request ID and payload.
      if(!recordId&&(!err.status||err.status>=500)){pending=payload;form.querySelectorAll('input,textarea,select').forEach(input=>input.disabled=true);error(err.message+' Save not confirmed. Retry saves the same details.');}
      else {pending=null;form.querySelectorAll('input,textarea,select').forEach(input=>input.disabled=false);error(err.message);}
    } finally {busy=false;setBusy(false);}
  }
  window.MallLeadEditor={open,setUser:value=>{user=value;},statuses:statusOptions};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
