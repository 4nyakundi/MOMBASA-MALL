const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const php=process.env.PHP_BIN||'C:/xampp/php/php.exe';
const password=process.env.MALL_TEST_PASSWORD||crypto.randomBytes(18).toString('hex');
const env={...process.env,DB_HOST:'127.0.0.1',DB_PORT:'33317',DB_NAME:'mall_alignment_test',DB_USER:'root',DB_PASS:process.env.MALL_TEST_DB_PASSWORD||'',MALL_TEST_PASSWORD:password};
const base='http://127.0.0.1:18817/';
let server,cookie='',token='',errors='';
async function request(url,{method='GET',body,anonymous=false,csrf=true}={}){
  const headers={};if(!anonymous&&cookie)headers.Cookie=cookie;if(!anonymous&&csrf&&token)headers['X-CSRF-Token']=token;
  if(body)headers['Content-Type']='application/json';
  const response=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined});
  const set=response.headers.get('set-cookie');if(set&&!anonymous)cookie=set.split(';')[0];
  const data=await response.json();if(data.token&&!anonymous)token=data.token;
  return {status:response.status,data};
}
before(async()=>{
  if(process.env.MALL_EXTERNAL_TEST_SERVER==='1')return;
  fs.mkdirSync(path.join(root,'tmp/test-sessions'),{recursive:true});
  execFileSync(php,['tests/setup-integration.php'],{cwd:root,env,windowsHide:true});
  server=spawn(php,['-d','display_errors=0','-d','sys_temp_dir='+path.join(root,'tmp/test-sessions'),'-d','upload_tmp_dir='+path.join(root,'tmp/test-sessions'),'-d','session.save_path='+path.join(root,'tmp/test-sessions'),'-S','127.0.0.1:18817','-t',root],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',chunk=>{errors+=chunk;});
  for(let i=0;i<40;i++){try{await fetch(base+'api/admin/auth.php');return;}catch{await new Promise(r=>setTimeout(r,100));}}
  throw Error('PHP server did not start: '+errors);
});
after(()=>{server?.kill();});
test('anonymous access is limited to filtered public content',async()=>{
  const health=await request('api/public/health.php',{anonymous:true});assert.equal(health.status,200);assert.deepEqual(health.data,{success:true,code:'ready',forms_ready:true});
  for(const resource of ['stores','events','blog','gallery','reviews','leads','users','dashboard']){
    assert.equal((await request('api/admin/'+resource+'.php',{anonymous:true})).status,401,resource);
  }
  const stores=await request('api/public/content.php?resource=stores',{anonymous:true});assert.equal(stores.status,200);assert.equal(stores.data.stores.length,46);
  const reviews=await request('api/public/content.php?resource=reviews',{anonymous:true});assert.ok(reviews.data.reviews.every(r=>r.approved&&!('email'in r)));
  assert.equal((await request('api/public/content.php?resource=users',{anonymous:true})).status,404);
  assert.equal((await request('api/public/content.php?resource=stores',{method:'POST',body:{},anonymous:true})).status,405);
});
test('login rejects the removed master passwords and requires CSRF for mutations',async()=>{
  assert.equal((await request('api/admin/auth.php',{method:'POST',body:{email:'admin@mombasamall.co.ke',password:'Mall@2024'}})).status,401);
  const login=await request('api/admin/auth.php',{method:'POST',body:{email:'admin@mombasamall.co.ke',password}});assert.equal(login.status,200);
  assert.equal((await request('api/admin/stores.php',{method:'POST',body:{name:'Forbidden'},csrf:false})).status,403);
});
let contactId,playonId;
test('all four inquiry contracts preserve details and retry without duplicates',async()=>{
  const contact={id:'contract-contact-1',name:'Test Visitor',email:'visitor@example.test',phone:'+254700000001',subject:'Leasing',message:'Original inquiry'};
  const first=await request('api/leads/contact.php',{method:'POST',body:contact,anonymous:true});assert.equal(first.status,201);contactId=first.data.lead_id;
  const retry=await request('api/leads/contact.php',{method:'POST',body:contact,anonymous:true});assert.equal(retry.data.lead_id,contactId);
  assert.equal((await request('api/leads/contact.php',{method:'POST',body:{...contact,message:'Changed'},anonymous:true})).status,409);
  const led=await request('api/leads/led.php',{method:'POST',anonymous:true,body:{id:'contract-led-1',businessName:'Brand',contactName:'Contact',email:'brand@example.test',phone:'0700000002',package_code:'outdoor',duration_code:'2w',packageRequested:'Outdoor Mega Screen',durationRequested:'2 Weeks',estimatedCost:'KES 1'}});assert.equal(led.status,201);
  const activation=await request('api/leads/activation.php',{method:'POST',anonymous:true,body:{id:'contract-act-1',companyName:'Activation Company',contactName:'Applicant',email:'act@example.test',phone:'0700000003',activationType:'Pop-up',bookingStartDate:'2026-11-20',durationDays:3,message:'Launch concept'}});assert.equal(activation.status,201);
  const play=await request('api/leads/playon.php',{method:'POST',anonymous:true,body:{id:'contract-play-1',name:'Parent',email:'parent@example.test',phone:'0700000004',booking_type:'session',booking_date:'2026-11-21',session_time:'14:00 – 16:00',child_count:3,adult_count:2,special_requests:'Birthday visit'}});assert.equal(play.status,201);playonId=play.data.lead_id;
  const all=(await request('api/admin/leads.php')).data;
  assert.equal(all.contactLeads.length,1);assert.equal(all.ledLeads[0].estimated_cost_total,81200);assert.equal(all.ledLeads[0].packageRequested,'Outdoor Mega Screen (1280×720px)');assert.equal(all.ledLeads[0].estimatedCost,'KES 81,200.00');
  assert.equal(all.activationLeads[0].companyName,'Activation Company');assert.equal(all.activationLeads[0].durationDays,3);assert.equal(all.activationLeads[0].bookingStartDate,'2026-11-20');assert.equal(all.activationLeads[0].message,'Launch concept');
  assert.equal(all.playonBookings[0].booking_date,'2026-11-21');assert.equal(all.playonBookings[0].child_count,3);assert.equal(all.playonBookings[0].estimated_total_kes,5500);
});
test('content edits update the same IDs, preserve media, and public reads respect status',async()=>{
  const store=await request('api/admin/stores.php',{method:'POST',body:{name:'Integration Store',room:'TEST-1',floor:'1st Floor',category:'retail',isActive:true,logoUrl:'/assets/test.webp',photoUrls:['/assets/first.webp'],socialHandle:'@test'}});assert.equal(store.status,201);
  const storeId=String(store.data.store_id);
  assert.equal((await request('api/admin/stores.php',{method:'PUT',body:{id:storeId,name:'Updated Store',room:'TEST-1',floor:'First Floor',category:'retail',isActive:false,photoUrls:['/assets/new.webp']}})).status,200);
  const publicStores=(await request('api/public/content.php?resource=stores')).data.stores;assert.ok(!publicStores.some(row=>row.id===storeId));
  const event={title:'Integration Event',date:'2026-11-20',eventTime:'10:00 AM – 7:00 PM',type:'upcoming',summary:'Event description',photoUrls:['/assets/event.webp'],videoUrl:'/uploads/example.mp4'};
  const created=await request('api/admin/events.php',{method:'POST',body:event});assert.equal(created.status,201);
  const eventId=String(created.data.event_id);
  assert.equal((await request('api/admin/events.php',{method:'PUT',body:{...event,id:eventId,title:'Updated Event'}})).status,200);
  const events=(await request('api/public/content.php?resource=events')).data.events;assert.equal(events.filter(row=>row.id===eventId).length,1);assert.equal(events.find(row=>row.id===eventId).photoUrls[0],'/assets/event.webp');assert.equal(events.find(row=>row.id===eventId).summary,'Event description');
  const blog=await request('api/admin/blog.php',{method:'POST',body:{title:'Draft',slug:'integration-draft',content:'Body',status:'draft'}});assert.equal(blog.status,201);
  assert.ok(!(await request('api/public/content.php?resource=blog')).data.posts.some(row=>row.id===String(blog.data.post_id)));
  const blogId=String(blog.data.post_id);assert.equal((await request('api/admin/blog.php',{method:'PUT',body:{id:blogId,title:'Published',slug:'integration-draft',content:'Updated body',status:'published'}})).status,200);
  assert.equal((await request('api/public/content.php?resource=blog')).data.posts.filter(row=>row.id===blogId).length,1);
  const gallery=await request('api/admin/gallery.php',{method:'POST',body:{imageUrl:'/assets/gallery.webp',caption:'Caption',category:'spaces',sortOrder:4}});assert.equal(gallery.status,201);
  assert.ok((await request('api/public/content.php?resource=gallery')).data.gallery.some(row=>row.imageUrl==='/assets/gallery.webp'&&row.sortOrder===4));
  assert.equal((await request('api/admin/gallery.php',{method:'POST',body:{imageUrl:'data:image/png;base64,AAAA'}})).status,422);
});
test('Play-On management and dashboard totals use the same database',async()=>{
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{type:'playon',id:playonId,status:'confirmed',admin_notes:'Confirmed by staff'}})).status,200);
  const bookings=(await request('api/admin/leads.php?type=playon')).data.playonBookings;assert.equal(bookings[0].status,'confirmed');assert.equal(bookings[0].admin_notes,'Confirmed by staff');
  assert.equal((await request('api/admin/dashboard.php')).data.metrics.total_playon_bookings,1);
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{type:'unknown',id:contactId,status:'closed'}})).status,422);
  const ledId=(await request('api/admin/leads.php?type=led')).data.ledLeads[0].id;
  for(const status of ['won','lost'])assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{type:'led',id:ledId,status}})).status,200);
});
test('uploads use validated media files and reject executable content',async()=>{
  const send=async(blob,name)=>{const body=new FormData();body.append('file',blob,name);const response=await fetch(base+'api/admin/upload.php',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':token},body});return {status:response.status,data:await response.json()};};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  const uploaded=await send(new Blob([png],{type:'image/png'}),'test.png');assert.equal(uploaded.status,201);assert.match(uploaded.data.url,/^\/uploads\/[a-f0-9]+\.png$/);
  const local=path.join(root,uploaded.data.url);assert.ok(fs.existsSync(local));fs.unlinkSync(local);
  const rejected=await send(new Blob(['<?php echo "unsafe"; ?>'],{type:'image/png'}),'fake.png');assert.equal(rejected.status,422);
});
test('staff can create, retry, edit and reload all three manual inquiry types',async()=>{
  const contact={type:'contact',request_id:'manual-contact',name:'Walk-in tenant',phone:'0700123000',email:'',subject:'Leasing',message:'Needs a shop on level one.',status:'contacted',admin_notes:'Visit arranged'};
  assert.equal((await request('api/admin/leads.php',{method:'POST',body:contact,anonymous:true})).status,401);
  assert.equal((await request('api/admin/leads.php',{method:'POST',body:contact,csrf:false})).status,403);
  const created=await request('api/admin/leads.php',{method:'POST',body:contact});assert.equal(created.status,201,JSON.stringify(created.data));
  const retry=await request('api/admin/leads.php',{method:'POST',body:contact});assert.equal(retry.data.lead_id,created.data.lead_id);
  assert.equal((await request('api/admin/leads.php',{method:'POST',body:{...contact,message:'Different inquiry'}})).status,409);
  const activation={type:'activation',request_id:'manual-activation',companyName:'Walk-in Events',contactName:'Event planner',email:'planner@example.test',phone:'',activationType:'Forecourt roadshow',bookingStartDate:'2026-12-30',durationDays:4,concept:'Power and two gazebos',status:'won'};
  const act=await request('api/admin/leads.php',{method:'POST',body:activation});assert.equal(act.status,201,JSON.stringify(act.data));
  const led={type:'led',request_id:'manual-led',businessName:'Billboard client',contactName:'Campaign contact',email:'campaign@example.test',phone:'0700123001',packageRequested:'Outdoor + indoor',campaignStartDate:'2026-12-28',durationDays:14,slotLength:'30 seconds',cost:10000,notes:'Evening campaign',referralCompany:'Introducing Agency',mediaAssets:[{url:'https://example.test/approved-creative.mp4',name:'Approved creative'}],status:'won',admin_notes:'Approved by client'};
  const ad=await request('api/admin/leads.php',{method:'POST',body:led});assert.equal(ad.status,201,JSON.stringify(ad.data));
  let all=(await request('api/admin/leads.php')).data;
  const savedAd=all.ledLeads.find(row=>row.id===String(ad.data.lead_id));assert.equal(savedAd.campaignEndDate,'2027-01-10');assert.equal(savedAd.referralCompany,'Introducing Agency');assert.equal(savedAd.mediaAssets[0].url,led.mediaAssets[0].url);assert.equal(savedAd.estimated_cost_total,11600);assert.equal(savedAd.source,'admin');
  const savedAct=all.activationLeads.find(row=>row.id===String(act.data.lead_id));assert.equal(savedAct.bookingEndDate,'2027-01-02');assert.equal(savedAct.message,activation.concept);assert.equal(savedAct.source,'admin');
  const savedContact=all.contactLeads.find(row=>row.id===String(created.data.lead_id));assert.equal(savedContact.email,'');assert.equal(savedContact.admin_notes,'Visit arranged');
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{...led,id:ad.data.lead_id,request_id:undefined,durationDays:3,referralCompany:'Updated Agency'}})).status,200);
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{...activation,id:act.data.lead_id,request_id:undefined,durationDays:2,concept:'Revised requirements'}})).status,200);
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{...contact,id:created.data.lead_id,request_id:undefined,message:'Updated message'}})).status,200);
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{type:'led',id:ad.data.lead_id,status:'completed'}})).status,200);
  all=(await request('api/admin/leads.php')).data;
  assert.equal(all.ledLeads.find(row=>row.id===String(ad.data.lead_id)).campaignEndDate,'2026-12-30');
  assert.equal(all.ledLeads.find(row=>row.id===String(ad.data.lead_id)).mediaAssets.length,1);
  assert.equal(all.activationLeads.find(row=>row.id===String(act.data.lead_id)).bookingEndDate,'2026-12-31');
  assert.equal(all.contactLeads.find(row=>row.id===String(created.data.lead_id)).message,'Updated message');
  const metrics=(await request('api/admin/dashboard.php')).data.metrics;assert.ok(Number(metrics.total_led_leads)>=2);assert.ok(Number(metrics.total_activation_leads)>=2);assert.ok(Number(metrics.total_contact_leads)>=2);
  assert.equal((await request('api/public/content.php?resource=leads',{anonymous:true})).status,404);
});
test('uploaded artwork remains attached after reload and can be unlinked without deleting the file',async()=>{
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  const body=new FormData();body.append('file',new Blob([bytes],{type:'image/png'}),'campaign.png');
  const uploaded=await fetch(base+'api/admin/upload.php',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':token},body});assert.equal(uploaded.status,201);const media=await uploaded.json();
  try {
    const input={type:'led',request_id:'manual-uploaded-artwork',businessName:'Artwork test',contactName:'Contact',email:'art@example.test',packageRequested:'Indoor',durationDays:7,mediaAssets:[{url:media.url,name:'Campaign artwork'}]};
    const created=await request('api/admin/leads.php',{method:'POST',body:input});assert.equal(created.status,201,JSON.stringify(created.data));
    const id=String(created.data.lead_id);let rows=(await request('api/admin/leads.php?type=led')).data.ledLeads;assert.equal(rows.find(row=>row.id===id).mediaAssets[0].url,media.url);
    assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{type:'led',id,mediaAssets:[]}})).status,200);
    rows=(await request('api/admin/leads.php?type=led')).data.ledLeads;assert.equal(rows.find(row=>row.id===id).mediaAssets.length,0);assert.ok(fs.existsSync(path.join(root,media.url)));
    assert.equal((await request('api/admin/leads.php?type=led&id='+id,{method:'DELETE'})).status,200);
  } finally {fs.unlinkSync(path.join(root,media.url));}
});

test('manual inquiry validation rejects bad dates, contacts and media without inserting records',async()=>{
  const valid={type:'activation',request_id:'invalid-manual',companyName:'Validation test',contactName:'Person',phone:'0700123002',activationType:'Pop-up',bookingStartDate:'2026-11-30',durationDays:2,concept:'Sample'};
  const before=(await request('api/admin/leads.php?type=activation')).data.activationLeads.length;
  for(const patch of [{durationDays:0},{durationDays:2.5},{bookingStartDate:'2026-02-30'},{email:'invalid'},{phone:'',email:''},{type:'unknown'}])assert.equal((await request('api/admin/leads.php',{method:'POST',body:{...valid,...patch}})).status,422,JSON.stringify(patch));
  assert.equal((await request('api/admin/leads.php?type=activation')).data.activationLeads.length,before);
  const led={type:'led',request_id:'invalid-led',businessName:'Validation client',contactName:'Contact',phone:'0700123002',packageRequested:'Outdoor',durationDays:2};
  for(const mediaAssets of [[{url:'javascript:alert(1)'}],[{url:'/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp4'}]])assert.equal((await request('api/admin/leads.php',{method:'POST',body:{...led,mediaAssets}})).status,422);
  const fixed=await request('api/admin/leads.php',{method:'POST',body:valid});assert.equal(fixed.status,201,'Invalid attempt must roll back its request ID.');
  const removed=await request('api/admin/leads.php?type=activation&id='+fixed.data.lead_id,{method:'DELETE'});assert.equal(removed.status,200);
  assert.equal((await request('api/admin/leads.php',{method:'PUT',body:{...valid,id:fixed.data.lead_id}})).status,404);
});

test('legacy imports preview without writes and repeated merges preserve IDs',async()=>{
  const data={shops:[{name:'Imported Shop',room:'IMPORT-1',floor:'2nd Floor',category:'dining',logo:'/assets/import.webp'}],events:[{title:'Imported Event',date:'2026-12-01',summary:'Imported description',type:'upcoming',photoUrls:['/assets/import-event.webp']}],blog:[{title:'Imported Article',slug:'imported-article',content:'Import body',status:'published'}]};
  const preview=await request('api/admin/reconcile.php',{method:'POST',body:{data,dry_run:true}});assert.equal(preview.status,200);assert.equal(preview.data.report.shops.inserted,1);
  assert.ok(!(await request('api/admin/stores.php')).data.stores.some(s=>s.room==='IMPORT-1'));
  const merge=await request('api/admin/reconcile.php',{method:'POST',body:{data,dry_run:false}});assert.equal(merge.status,200);
  const again=await request('api/admin/reconcile.php',{method:'POST',body:{data,dry_run:false}});assert.equal(again.status,200);assert.equal(again.data.report.shops.updated,1);
  const shops=(await request('api/admin/stores.php')).data.stores.filter(s=>s.room==='IMPORT-1');assert.equal(shops.length,1);assert.equal(shops[0].floor,'Second Floor');assert.equal(shops[0].category,'food');
});
test('complete published snapshots merge without duplicating the seed records',async()=>{
  const json=name=>JSON.parse(fs.readFileSync(path.join(root,'json',name+'.json'),'utf8'));
  const events=json('events'),reviews=json('reviews');
  const data={shops:json('stores').floors.flatMap(f=>f.shops.map(row=>({...row,floor:f.name}))),events:[...events.upcoming.map(row=>({...row,type:'upcoming'})),...events.past.map(row=>({...row,type:'past'}))],blog:json('blog').posts,gallery:json('gallery').images,reviews:[...reviews.testimonials.map(row=>({...row,type:'testimonial'})),...reviews.customerFeedback.map(row=>({...row,type:'feedback'}))],site:json('site-data')};
  const preview=await request('api/admin/reconcile.php',{method:'POST',body:{data,dry_run:true}});
  assert.equal(preview.status,200,JSON.stringify(preview.data));assert.equal(preview.data.report.shops.updated,46);assert.equal(preview.data.report.shops.inserted,0);assert.equal(preview.data.report.events.updated,5);assert.equal(preview.data.report.reviews.updated,7);
  const applied=await request('api/admin/reconcile.php',{method:'POST',body:{data,dry_run:false}});assert.equal(applied.status,200,JSON.stringify(applied.data));
  const rows=(await request('api/admin/stores.php')).data.stores;assert.equal(rows.filter(row=>row.room==='G-01').length,1);assert.equal(rows.find(row=>row.room==='G-01').socialHandle,'@naivas_supermarket');
  assert.equal((await request('api/public/content.php?resource=site')).data.site.siteName,'Mombasa Mall');
  const invalid=await request('api/admin/reconcile.php',{method:'POST',body:{dry_run:false,data:{shops:[{name:'Must Roll Back',room:'ROLLBACK-1',floor:'Ground Floor',category:'retail'}],events:[{title:'Invalid Date',date:'not-a-date'}]}}});assert.equal(invalid.status,422);
  assert.ok(!(await request('api/admin/stores.php')).data.stores.some(row=>row.room==='ROLLBACK-1'));
});
test('staff authorization, password change, and logout apply to SQL sessions',async()=>{
  await request('api/admin/auth.php?action=logout',{method:'POST',body:{}});
  assert.equal((await request('api/admin/leads.php')).status,401);
  await request('api/admin/auth.php',{method:'POST',body:{email:'events@mombasamall.co.ke',password}});
  assert.equal((await request('api/admin/users.php')).status,403);assert.equal((await request('api/admin/leads.php')).status,403);assert.equal((await request('api/admin/leads.php',{method:'POST',body:{type:'contact',request_id:'editor-forbidden',name:'Denied',phone:'0700',subject:'Denied',message:'Denied'}})).status,403);
  assert.deepEqual((await request('api/admin/dashboard.php')).data.recent_leads,[]);
  assert.equal((await request('api/admin/stores.php')).status,200);
  const changed=await request('api/admin/auth.php?action=password',{method:'POST',body:{current_password:password,password:password+'changed'}});assert.equal(changed.status,200);
  await request('api/admin/auth.php?action=logout',{method:'POST',body:{}});
  assert.equal((await request('api/admin/auth.php',{method:'POST',body:{email:'events@mombasamall.co.ke',password:password+'changed'}})).status,200);
});
