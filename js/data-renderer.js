// Public content shares the same SQL records as the staff dashboard.
const text = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(resource, field, fallback) {
  try { return (await window.MallAPI.content(resource))[field]; }
  catch (error) {
    console.warn('Live content unavailable:', resource, error.message);
    const section = document.getElementById(resource === 'blog' ? 'blog-list' : 'customer-feedback');
    if (section) { const notice = document.createElement('p'); notice.setAttribute('role','status'); notice.textContent='Live content unavailable. Showing the published snapshot.'; section.before(notice); }
    try { const response=await fetch(new URL('json/'+fallback, window.MallAPI.root));return await response.json(); }
    catch { return []; }
  }
}
async function renderContent() {
  if (document.getElementById('blog-list')) {
    const result=await load('blog','posts','blog.json');
    const posts=(Array.isArray(result)?result:result.posts||[]).filter(p=>!p.status||p.status==='published');
    const list=document.getElementById('blog-list');
    list.innerHTML=posts.map(p=>`<article class="post glow-card" style="padding:28px;border-radius:16px"><small>${text(p.date)}</small><h3>${text(p.title)}</h3><p>${text(p.excerpt)}</p><details id="read-${text(p.slug)}"><summary>Read article</summary><div style="white-space:pre-wrap">${text(p.body||p.content||p.excerpt)}</div></details></article>`).join('');
    if(!posts.length)list.textContent='No published articles yet.';
  }
  if(document.getElementById('customer-feedback')||document.querySelector('.testimonials-swiper')) {
    const result=await load('reviews','reviews','reviews.json');
    const reviews=Array.isArray(result)?result:[...(result.testimonials||[]).map(r=>({...r,type:'testimonial'})),...(result.customerFeedback||[]).map(r=>({...r,type:'feedback'}))];
    const approved=reviews.filter(r=>r.approved===true||r.status==='approved'||(!('approved'in r)&&!r.status));
    const testimonial=document.querySelector('.testimonials-swiper .swiper-wrapper');
    const feedback=document.getElementById('customer-feedback');
    const testimonials=approved.filter(r=>r.type==='testimonial');
    const remaining=approved.filter(r=>r.type!=='testimonial');
    if(testimonial)testimonial.innerHTML=testimonials.map(r=>`<div class="swiper-slide"><blockquote>“${text(r.quote||r.review_text||r.comment)}”</blockquote><div class="quote-author">${text(r.author||r.name)} — ${'★'.repeat(Math.max(1,Math.min(5,Number(r.rating)||5)))}</div></div>`).join('');
    if(feedback)feedback.innerHTML=remaining.map(r=>`<div class="feedback glow-card" style="padding:20px 24px"><strong>${text(r.author||r.name)}</strong><p>${text(r.quote||r.review_text||r.comment)}</p></div>`).join('');
  }
  const clients=document.querySelector('.clients-swiper .swiper-wrapper');
  if(clients){try{const response=await fetch(new URL('json/clients.json',window.MallAPI.root));const data=await response.json();clients.replaceChildren();for(const client of data.clients||[]){const slide=document.createElement('div');slide.className='swiper-slide';const img=document.createElement('img');img.src=client.logo;img.alt=client.name;img.style.maxWidth='160px';slide.append(img);clients.append(slide);}}catch{}}
  document.dispatchEvent(new CustomEvent('lifestyle-content-updated'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderContent,{once:true});else renderContent();
