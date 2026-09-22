const D=window.SITE_DATA;
document.documentElement.style.setProperty('--bg',D.appearance.background);
document.documentElement.style.setProperty('--text',D.appearance.text);
document.documentElement.style.setProperty('--accent',D.appearance.accent);
document.documentElement.style.setProperty('--card',D.appearance.card);

function common(){
  document.querySelectorAll('[data-site-name]').forEach(e=>e.textContent=D.siteName);
  document.querySelectorAll('[data-social=instagram]').forEach(e=>e.href=D.socials.instagram);
  document.querySelectorAll('[data-social=etsy]').forEach(e=>e.href=D.socials.etsy);
  document.querySelectorAll('[data-social=facebook]').forEach(e=>e.href=D.socials.facebook);
}

function slug(s){return s.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}

function renderAlbums(){
  const el=document.querySelector('#album-grid');
  if(!el)return;
  el.innerHTML=D.albums.map(a=>`<a class="card" href="album.html?album=${encodeURIComponent(a.title)}"><div class="thumb">${a.driveFolder?'View photos':'✦'}</div><div class="card-body"><span class="badge">${a.category}</span><h3>${a.title}</h3><p class="muted">Open album</p></div></a>`).join('');
}

function renderTicker(){
  const el=document.querySelector('#ticker');
  if(!el)return;
  const names=D.albums.map(a=>`<span class="ticker-item">${a.title}</span>`).join('<span>•</span>');
  el.innerHTML=`<div class="ticker-track">${names}<span>•</span>${names}</div>`;
}

async function renderAlbum(){
  const el=document.querySelector('#album-view');
  if(!el)return;

  const name=new URLSearchParams(location.search).get('album')||D.albums[0].title;
  const a=D.albums.find(x=>x.title===name)||D.albums[0];

  document.querySelector('#album-title').textContent=a.title;
  document.querySelector('#album-category').textContent=a.category;

  if(!a.driveFolder){
    el.innerHTML='<div class="album-empty"><h3>No photos added yet</h3><p>This album is ready for its Google Drive folder.</p></div>';
    return;
  }

  el.innerHTML='<div class="album-empty"><p>Loading photos...</p></div>';

  try{
    const response=await fetch(D.driveEndpoint+'?folder='+encodeURIComponent(a.driveFolder));
    const data=await response.json();

    if(data.error) throw new Error(data.error);

    if(!data.files || !data.files.length){
      el.innerHTML='<div class="album-empty"><h3>No web photos in this folder</h3><p>Add JPG, PNG or WebP files directly to the main Google Drive folder. Subfolders are ignored.</p></div>';
      return;
    }

    const items=data.files.map(file=>{
      if(file.type.indexOf('video/')===0){
        return `<a class="media-card video-card" href="${file.url}" target="_blank" rel="noopener"><div class="video-placeholder">Video</div><div class="media-name">${file.name}</div></a>`;
      }
      return `<a class="media-card" href="${file.url}" target="_blank" rel="noopener"><img src="${file.thumbnail}" alt="${file.name}" loading="lazy"><div class="media-name">${file.name}</div></a>`;
    }).join('');

    el.innerHTML=`<div class="media-grid">${items}</div>`;
  }catch(error){
    console.error(error);
    el.innerHTML='<div class="album-empty"><h3>We could not load this gallery</h3><p>Please check the Google Drive folder permissions and Apps Script deployment.</p></div>';
  }
}

function setupContact(){
  const f=document.querySelector('#contact-form');
  if(!f)return;
  if(D.contact.formspreeEndpoint){
    f.action=D.contact.formspreeEndpoint;
  }else{
    f.addEventListener('submit',e=>{
      e.preventDefault();
      alert('Contact form is ready, but you need to add your free Formspree endpoint in site-data.js first.');
    });
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  common();
  renderAlbums();
  renderTicker();
  renderAlbum();
  setupContact();
});
