const D=window.SITE_DATA;
document.documentElement.style.setProperty('--bg',D.appearance.background);
document.documentElement.style.setProperty('--text',D.appearance.text);
document.documentElement.style.setProperty('--accent',D.appearance.accent);
document.documentElement.style.setProperty('--card',D.appearance.card);

let albumsPromise=null;
const CACHE_MS=10*60*1000;
let parentFoldersPromise=null;

function common(){
  document.querySelectorAll('[data-site-name]').forEach(e=>e.textContent=D.siteName);
  document.querySelectorAll('[data-social=instagram]').forEach(e=>e.href=D.socials.instagram);
  document.querySelectorAll('[data-social=etsy]').forEach(e=>e.href=D.socials.etsy);
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
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
  }finally{clearTimeout(timer);}
}

function imageSource(fileOrValue){
  if(!fileOrValue)return '';
  if(typeof fileOrValue==='string')return fileOrValue;
  return fileOrValue.thumbnailData || fileOrValue.thumbnail || '';
}

function isUsableImageSource(src){
  return !!src && (src.startsWith('data:image/') || src.startsWith('https://') || src.startsWith('http://'));
}

function imageHtml(value,alt=''){
  const src=imageSource(value);
  if(!isUsableImageSource(src))return '<span class="thumb-placeholder">✦</span>';
  return '<img src="'+escapeHtml(src)+'" alt="'+escapeHtml(alt)+'" decoding="async">';
}

function staticAlbums(){
  return (D.albums||[]).map(a=>({
    ...a,
    thumbnail:(window.ROSE_THUMBS&&window.ROSE_THUMBS[a.title])||a.thumbnail||''
  }));
}

async function getParentFolders(){
  if(parentFoldersPromise)return parentFoldersPromise;
  parentFoldersPromise=(async()=>{
    const cached=cacheGet('rosecollectif-parent-folders-v4');
    if(cached)return cached;
    if(!D.driveParentFolder || !D.driveEndpoint)return [];
    try{
      const data=await fetchJson(D.driveEndpoint+'?parent='+encodeURIComponent(D.driveParentFolder));
      const folders=Array.isArray(data.folders)?data.folders:[];
      cacheSet('rosecollectif-parent-folders-v4',folders);
      return folders;
    }catch(error){
      console.error('Drive folder discovery error:',error);
      return [];
    }
  })();
  return parentFoldersPromise;
}

async function getAlbums(){
  if(albumsPromise)return albumsPromise;
  albumsPromise=Promise.resolve(staticAlbums());
  return albumsPromise;
}

async function resolveAlbum(name){
  const albums=staticAlbums();
  const local=albums.find(x=>x.title===name);
  if(local && local.driveFolder)return local;

  // Lightweight lookup avoids downloading all album thumbnails just to find one folder.
  if(D.driveParentFolder && D.driveEndpoint){
    try{
      const data=await fetchJson(
        D.driveEndpoint+
        '?lookup='+encodeURIComponent(name)+
        '&parent='+encodeURIComponent(D.driveParentFolder)
      );
      if(data && data.id){
        return {
          title:data.name||name,
          driveFolder:data.id,
          thumbnail:(window.ROSE_THUMBS&&window.ROSE_THUMBS[name])||''
        };
      }
    }catch(error){
      console.warn('Lightweight folder lookup unavailable, trying parent list.',error);
    }
  }

  const folders=await getParentFolders();
  const match=folders.find(x=>x.name===name);
  if(match){
    return {
      title:match.name,
      driveFolder:match.id,
      thumbnail:(window.ROSE_THUMBS&&window.ROSE_THUMBS[match.name])||''
    };
  }
  return local||null;
}

async function getAlbumThumbnail(a){
  if(a.thumbnail)return a.thumbnail;
  if(!a.driveFolder || !D.driveEndpoint)return '';
  try{
    const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(a.driveFolder));
    const image=data.files?.find(f=>f.type?.indexOf('image/')===0);
    return imageSource(image);
  }catch(error){
    console.error('Thumbnail error:',error);
    return '';
  }
}

async function applyDriveBackground(){
  if(!D.driveEndpoint || !D.driveParentFolder)return;
  const cached=cacheGet('rosecollectif-background-v2');
  if(cached){
    document.body.style.backgroundImage='linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url("'+cached+'")';
    document.body.classList.add('has-drive-background');
    return;
  }
  try{
    const parent=await getParentFolders();
    const backgroundFolder=parent.find(folder=>folder.name.toLowerCase()==='background');
    if(!backgroundFolder)return;
    const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(backgroundFolder.id));
    const image=data.files?.find(file=>file.type?.indexOf('image/')===0);
    const src=imageSource(image);
    if(!isUsableImageSource(src))return;
    cacheSet('rosecollectif-background-v2',src);
    document.body.style.backgroundImage='linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url("'+src+'")';
    document.body.classList.add('has-drive-background');
  }catch(error){
    console.error('Background error:',error);
  }
}

function renderAlbumCards(el,albums){
  el.innerHTML=albums.map((a,i)=>`<a class="card" id="album-card-${i}" data-folder="${escapeHtml(a.driveFolder||'')}" href="./album.html?album=${encodeURIComponent(a.title)}"><div class="thumb"><span class="thumb-placeholder">✦</span></div><div class="card-body"><h3>${escapeHtml(a.title)}</h3></div></a>`).join('');
}

function loadVisibleAlbumThumbnails(el,albums){
  const load=async card=>{
    const i=Number(card.id.replace('album-card-',''));
    const a=albums[i];
    if(!a)return;
    const thumb=await getAlbumThumbnail(a);
    if(!thumb)return;
    const box=card.querySelector('.thumb');
    if(box)box.innerHTML=imageHtml(thumb,a.title);
  };
  if(!('IntersectionObserver' in window)){
    [...el.querySelectorAll('.card')].forEach(load);
    return;
  }
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        observer.unobserve(entry.target);
        load(entry.target);
      }
    });
  },{rootMargin:'500px 0px'});
  el.querySelectorAll('.card').forEach(card=>observer.observe(card));
}

async function renderAlbums(){
  const el=document.querySelector('#album-grid');
  if(!el)return;
  const albums=staticAlbums();
  if(!albums.length){
    el.innerHTML='<div class="album-empty"><h3>No galleries found</h3></div>';
    return;
  }
  el.innerHTML=albums.map((a,i)=>`<a class="card" id="album-card-${i}" href="album.html?album=${encodeURIComponent(a.title)}"><div class="thumb">${a.thumbnail?imageHtml(a.thumbnail,a.title):'<span class="thumb-placeholder">✦</span>'}</div><div class="card-body"><h3>${escapeHtml(a.title)}</h3></div></a>`).join('');
}

function renderMediaFiles(files){
  return files.map(file=>{
    if(file.type.indexOf('video/')===0){
      return `<a class="media-card video-card" href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><div class="video-placeholder">Video</div></a>`;
    }
    return `<a class="media-card" href="${escapeHtml(file.url)}" target="_blank" rel="noopener">${imageHtml(file,file.name||'')}</a>`;
  }).join('');
}

async function getCommissionFolders(folderId){
  const key='rosecollectif-commission-v4-'+folderId;
  const cached=cacheGet(key);
  if(cached)return cached;
  const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(folderId)+'&subalbums=1');
  if(data.error)throw new Error(data.error);
  const folders=data.folders||[];
  cacheSet(key,folders);
  return folders;
}

async function renderFeatured(){
  const el=document.querySelector('#featured-slider');
  if(!el || !D.driveEndpoint || !D.driveParentFolder)return;
  try{
    const data=await fetchJson(D.driveEndpoint+'?featured='+encodeURIComponent(D.driveParentFolder));
    const files=data.files||[];
    if(!files.length){
      el.innerHTML='<div class="featured-empty"><div><strong>Featured banner</strong><span>Create a folder called <b>Featured Banner</b> inside the website gallery folder, then add your banner images.</span></div></div>';
      return;
    }

    el.innerHTML='<div class="featured-track">'+files.map((file,i)=>`<a class="featured-slide" href="${escapeHtml(file.url)}" target="_blank" rel="noopener">${imageHtml(file,file.name||'')}</a>`).join('')+'</div><button class="featured-arrow prev" type="button" aria-label="Previous">‹</button><button class="featured-arrow next" type="button" aria-label="Next">›</button><div class="featured-dots">'+files.map((_,i)=>`<button class="featured-dot${i===0?' active':''}" type="button" aria-label="Slide ${i+1}"></button>`).join('')+'</div>';

    let index=0;
    const track=el.querySelector('.featured-track');
    const dots=[...el.querySelectorAll('.featured-dot')];
    const show=n=>{
      index=(n+files.length)%files.length;
      track.style.transform='translateX(-'+(index*100)+'%)';
      dots.forEach((d,i)=>d.classList.toggle('active',i===index));
    };
    el.querySelector('.prev').onclick=()=>show(index-1);
    el.querySelector('.next').onclick=()=>show(index+1);
    dots.forEach((d,i)=>d.onclick=()=>show(i));
    if(files.length>1){
      let timer=setInterval(()=>show(index+1),5000);
      el.addEventListener('mouseenter',()=>clearInterval(timer));
      el.addEventListener('mouseleave',()=>{timer=setInterval(()=>show(index+1),5000);});
    }
  }catch(error){
    console.error('Featured error:',error);
    el.innerHTML='<div class="featured-empty"><div><strong>Featured banner</strong><span>We could not load the featured images yet.</span></div></div>';
  }
}

async function renderAlbum(){
  const el=document.querySelector('#album-view');
  if(!el)return;
  const params=new URLSearchParams(location.search);
  const name=params.get('album')||(D.albums||[])[0]?.title;
  const sub=params.get('sub');

  const a=await resolveAlbum(name);
  if(!a){
    document.querySelector('#album-title').textContent='Gallery not found';
    el.innerHTML='<div class="album-empty"><h3>Gallery not found</h3></div>';
    return;
  }

  document.querySelector('#album-title').textContent=a.title;
  el.innerHTML='<div class="album-empty"><p>Loading photos...</p></div>';

  if(!a.driveFolder || !D.driveEndpoint){
    el.innerHTML='<div class="album-empty"><h3>This gallery is not connected yet</h3><p>The gallery cover is ready, but the photo folder could not be found.</p></div>';
    return;
  }

  try{
    if(a.title==='Commissions' && !sub){
      const folders=await getCommissionFolders(a.driveFolder);
      if(folders.length){
        el.innerHTML='<div class="grid">'+folders.map(folder=>`<a class="card" href="album.html?album=${encodeURIComponent(a.title)}&sub=${encodeURIComponent(folder.id)}"><div class="thumb">${folder.thumbnailData?imageHtml(folder.thumbnailData,folder.name):'<span class="thumb-placeholder">✦</span>'}</div><div class="card-body"><h3>${escapeHtml(folder.name)}</h3></div></a>`).join('')+'</div>';
        return;
      }
    }

    const folderToLoad=sub||a.driveFolder;
    const data=await fetchJson(D.driveEndpoint+'?folder='+encodeURIComponent(folderToLoad));
    if(data.error)throw new Error(data.error);
    if(!data.files||!data.files.length){
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
  if(D.contact.formspreeEndpoint)f.action=D.contact.formspreeEndpoint;
  else f.addEventListener('submit',e=>{e.preventDefault();alert('Contact form is ready, but you need to add your free Formspree endpoint in site-data.js.');});
}

document.addEventListener('DOMContentLoaded',()=>{
  common();
  applyDriveBackground();
  renderAlbums();
  renderFeatured();
  renderAlbum();
  setupContact();
});