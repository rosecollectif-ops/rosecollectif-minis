const D=window.SITE_DATA;
document.documentElement.style.setProperty('--bg',D.appearance.background);
document.documentElement.style.setProperty('--text',D.appearance.text);
document.documentElement.style.setProperty('--accent',D.appearance.accent);
document.documentElement.style.setProperty('--card',D.appearance.card);

let albumsPromise=null;
const CACHE_MS=5*60*1000;

function common(){
  document.querySelectorAll('[data-site-name]').forEach(e=>e.textContent=D.siteName);
  document.querySelectorAll('[data-social=instagram]').forEach(e=>e.href=D.socials.instagram);
  document.querySelectorAll('[data-social=etsy]').forEach(e=>e.href=D.socials.etsy);
  document.querySelectorAll('[data-social=facebook]').forEach(e=>e.href=D.socials.facebook);
  const tagline=document.querySelector('#tagline');
  if(tagline) tagline.textContent=D.tagline;
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
}

function cacheGet(key){
  try{
    const item=JSON.parse(sessionStorage.getItem(key)||'null');
    if(item && Date.now()-item.time<CACHE_MS)return item.data;
  }catch(e){}
  return null;
}

function cacheSet(key,data){
  try{sessionStorage.setItem(key,JSON.stringify({time:Date.now(),data}));}catch(e){}
}

async function fetchJson(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{
    clearTimeout(timer);
  }
}

async function getAlbums(){
  if(albumsPromise)return albumsPromise;

  albumsPromise=(async()=>{
    const cached=cacheGet('rosecollectif-albums');
    if(cached)return cached;

    if(D.driveParentFolder && D.driveEndpoint){
      try{
        const data=await fetchJson(D.driveEndpoint+'?parent='+encodeURIComponent(D.driveParentFolder));
        if(!data.error && Array.isArray(data.folders)){
          const albums=data.folders.map(folder=>({
            title:folder.name,
            driveFolder:folder.id,
            thumbnail:folder.thumbnail || ''
          }));
          cacheSet('rosecollectif-albums',albums);
          return albums;
        }
      }catch(error){
        console.error('Album discovery error:',error);
      }
    }

    return D.albums || [];
  })();

  return albumsPromise;
}

function driveImageUrl(value){
  if(!value)return '';
  const text=String(value);

  // Our Apps Script currently returns Drive thumbnail URLs. Convert them
  // to the public Drive viewer endpoint, which is more reliable in <img>.
  let id='';
  const match=text.match(/[?&]id=([^&]+)/);
  if(match)id=decodeURIComponent(match[1]);

  if(!id && /^[A-Za-z0-9_-]{20,}$/.test(text))id=text;

  if(id)return 'https://drive.google.com/uc?export=view&id='+encodeURIComponent(id);
  return text;
}

function imageHtml(url,alt=''){
  const src=driveImageUrl(url);
  if(!src)return '<span class="thumb-placeholder">✦</span>';
  return '<img src="'+escapeHtml(src)+'" alt="'+escapeHtml(alt)+'" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'image-failed\')">';
}

async function getAlbumThumbnail(a){
  if(a.thumbnail)return driveImageUrl(a.thumbnail);
  if(!a.driveFolder || !D.driveEndpoint)return '';

  try{
    const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(a.driveFolder));
    const image=data.files?.find(f=>f.type?.indexOf('image/')===0);
    return image?.thumbnail ? driveImageUrl(image.thumbnail) : '';
  }catch(error){
    console.error('Thumbnail error:',error);
    return '';
  }
}

async function renderAlbums(){
  const el=document.querySelector('#album-grid');
  if(!el)return;

  el.innerHTML='<div class="album-empty"><p>Loading galleries...</p></div>';
  const albums=await getAlbums();

  if(!albums.length){
    el.innerHTML='<div class="album-empty"><h3>No galleries found</h3></div>';
    return;
  }

  el.innerHTML=albums.map((a,i)=>`<a class="card" id="album-card-${i}" href="album.html?album=${encodeURIComponent(a.title)}"><div class="thumb"><span class="thumb-placeholder">✦</span></div><div class="card-body"><h3>${escapeHtml(a.title)}</h3></div></a>`).join('');

  albums.forEach(async(a,i)=>{
    const thumb=await getAlbumThumbnail(a);
    if(!thumb)return;
    const box=document.querySelector('#album-card-'+i+' .thumb');
    if(box)box.innerHTML=imageHtml(thumb);
  });
}

function renderMediaFiles(files){
  return files.map(file=>{
    if(file.type.indexOf('video/')===0){
      return `<a class="media-card video-card" href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><div class="video-placeholder">Video</div></a>`;
    }
    return `<a class="media-card" href="${escapeHtml(file.url)}" target="_blank" rel="noopener">${imageHtml(file.thumbnail)}</a>`;
  }).join('');
}

async function getCommissionFolders(folderId){
  const key='rosecollectif-commission-'+folderId;
  const cached=cacheGet(key);
  if(cached)return cached;

  const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(folderId)+'&subalbums=1');
  if(data.error)throw new Error(data.error);

  const folders=data.folders||[];
  cacheSet(key,folders);
  return folders;
}

async function renderAlbum(){
  const el=document.querySelector('#album-view');
  if(!el)return;

  const albums=await getAlbums();
  const params=new URLSearchParams(location.search);
  const name=params.get('album')||albums[0]?.title;
  const sub=params.get('sub');
  const a=albums.find(x=>x.title===name)||albums[0];

  if(!a){
    document.querySelector('#album-title').textContent='Gallery not found';
    el.innerHTML='<div class="album-empty"><h3>Gallery not found</h3><p>Go back to the galleries and choose a gallery.</p></div>';
    return;
  }

  document.querySelector('#album-title').textContent=a.title;

  if(!a.driveFolder){
    el.innerHTML='<div class="album-empty"><h3>No photos in this gallery yet</h3></div>';
    return;
  }

  el.innerHTML='<div class="album-empty"><p>Loading photos...</p></div>';

  try{
    // Only Commissions can contain website sub-albums.
    if(a.title==='Commissions' && !sub){
      const folders=await getCommissionFolders(a.driveFolder);

      if(folders.length){
        el.innerHTML='<div class="grid">'+folders.map(folder=>`
          <a class="card" href="album.html?album=${encodeURIComponent(a.title)}&sub=${encodeURIComponent(folder.id)}">
            <div class="thumb">${folder.thumbnail?imageHtml(folder.thumbnail):'<span class="thumb-placeholder">✦</span>'}</div>
            <div class="card-body"><h3>${escapeHtml(folder.name)}</h3></div>
          </a>`).join('')+'</div>';
        return;
      }
    }

    const folderToLoad=sub||a.driveFolder;
    const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(folderToLoad));

    if(data.error)throw new Error(data.error);

    if(!data.files || !data.files.length){
      el.innerHTML='<div class="album-empty"><h3>No photos in this gallery yet</h3></div>';
      return;
    }

    el.innerHTML='<div class="media-grid">'+renderMediaFiles(data.files)+'</div>';
  }catch(error){
    console.error(error);
    el.innerHTML='<div class="album-empty"><h3>We could not load this gallery</h3><p>Please try refreshing the page.</p></div>';
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
      alert('Contact form is ready, but you need to add your free Formspree endpoint in site-data.js.');
    });
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  common();
  renderAlbums();
  renderAlbum();
  setupContact();
});