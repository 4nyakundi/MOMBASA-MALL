(async function () {
  'use strict';
  let data;
  try { data=(await window.MallAPI.content('site')).site; }
  catch {
    try {const response=await fetch(new URL('json/site-data.json',window.MallAPI.root));data=await response.json();}
    catch {return;}
  }
  if(!data)return;
  const fields={'site-name':'siteName','site-tagline':'tagline','site-description':'description','contact-address':'address','contact-phone':'phone','contact-email':'email','open-hours':'openingHours','domain':'domain'};
  for(const [id,key] of Object.entries(fields)){const el=document.getElementById(id);if(el&&data[key])el.textContent=data[key];}
  for(const name of ['facebook','instagram','twitter']){const el=document.getElementById('social-'+name);const url=data.social?.[name];if(el&&/^https?:\/\//i.test(url||''))el.href=url;}
})();
