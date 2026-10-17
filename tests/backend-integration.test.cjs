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
  assert.equal((await request('api/admin/users.php')).status,403);assert.equal((await request('api/admin/leads.php')).status,403);
  assert.deepEqual((await request('api/admin/dashboard.php')).data.recent_leads,[]);
  assert.equal((await request('api/admin/stores.php')).status,200);
  const changed=await request('api/admin/auth.php?action=password',{method:'POST',body:{current_password:password,password:password+'changed'}});assert.equal(changed.status,200);
  await request('api/admin/auth.php?action=logout',{method:'POST',body:{}});
  assert.equal((await request('api/admin/auth.php',{method:'POST',body:{email:'events@mombasamall.co.ke',password:password+'changed'}})).status,200);
});
