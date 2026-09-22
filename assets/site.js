const D=window.SITE_DATA;
document.documentElement.style.setProperty('--bg',D.appearance.background);
document.documentElement.style.setProperty('--text',D.appearance.text);
document.documentElement.style.setProperty('--accent',D.appearance.accent);
document.documentElement.style.setProperty('--card',D.appearance.card);

let albumsPromise=null;

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
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[char]));
}

async function getAlbums(){
  if(albumsPromise)return albumsPromise;

  albumsPromise=(async()=>{
    if(D.driveParentFolder && D.driveEndpoint){
      try{
        const response=await fetch(D.driveEndpoint+'?parent='+encodeURIComponent(D.driveParentFolder));
        const data=await response.json();

        if(!data.error && Array.isArray(data.folders)){
          return data.folders.map(folder=>({
            title:folder.name,
            driveFolder:folder.id,
            thumbnail:folder.thumbnail || ''
          }));
        }
      }catch(error){
        console.error('Album discovery error:',error);
      }
    }

    return D.albums || [];
  })();

  return albumsPromise;
}

function driveImageUrl(url){
  if(!url)return '';
  const match=url.match(/[?&]id=([^&]+)/);
  if(match)return 'https://drive.google.com/uc?export=view&id='+encodeURIComponent(match[1]);
  return url;
}

async function getAlbumThumbnail(a){
  if(a.thumbnail) return driveImageUrl(a.thumbnail);
  if(!a.driveFolder || !D.driveEndpoint)return '';

  try{
    const response=await fetch(D.driveEndpoint+'?folder='+encodeURIComponent(a.driveFolder));
    const data=await response.json();
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

  const albums=await getAlbums();

  if(!albums.length){
    el.innerHTML='<div class="album-empty"><h3>No albums found</h3><p></p></div>';
    return;
  }

  el.innerHTML=albums.map((a,i)=>`<a class="card" id="album-card-${i}" href="album.html?album=${encodeURIComponent(a.title)}"><div class="thumb"><span class="thumb-placeholder">✦</span></div><div class="card-body"><h3>${escapeHtml(a.title)}</h3></div></a>`).join('');

  albums.forEach(async(a,i)=>{
    const thumb=await getAlbumThumbnail(a);
    if(!thumb)return;
    const box=document.querySelector('#album-card-'+i+' .thumb');
    if(box)box.innerHTML=`<img src="${thumb}" alt="" loading="lazy">`;
  });
}

function renderMediaFiles(files){
  return files.map(file=>{
    if(file.type.indexOf('video/')===0){
      return `<a class="media-card video-card" href="${file.url}" target="_blank" rel="noopener"><div class="video-placeholder">Video</div></a>`;
    }
    return `<a class="media-card" href="${file.url}" target="_blank" rel="noopener"><img src="${driveImageUrl(file.thumbnail)}" alt="" loading="lazy"></a>`;
  }).join('');
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
    document.querySelector('#album-title').textContent='Album not found';
    el.innerHTML='<div class="album-empty"><h3>Album not found</h3><p>Go back to the galleries and choose an album.</p></div>';
    return;
  }

  document.querySelector('#album-title').textContent=a.title;

  if(!a.driveFolder){
    el.innerHTML='<div class="album-empty"><h3>No photos added yet</h3><p>This album is ready for its Google Drive folder.</p></div>';
    return;
  }

  el.innerHTML='<div class="album-empty"><p>Loading photos...</p></div>';

  try{
    // Only the Commissions album can contain website sub-albums.
    if(a.title==='Commissions' && !sub){
      const response=await fetch(D.driveEndpoint+'?folder='+encodeURIComponent(a.driveFolder)+'&subalbums=1');
      const data=await response.json();

      if(data.error)throw new Error(data.error);

      if(data.folders && data.folders.length){
        el.innerHTML=`<div class="grid">${data.folders.map((folder,i)=>`
          <a class="card" href="album.html?album=${encodeURIComponent(a.title)}&sub=${encodeURIComponent(folder.id)}">
            <div class="thumb">${folder.thumbnail ? `<img src="${driveImageUrl(folder.thumbnail)}" alt="" loading="lazy">` : '<span class="thumb-placeholder">✦</span>'}</div>
            <div class="card-body"><h3>${escapeHtml(folder.name)}</h3></div>
          </a>`).join('')}</div>`;
        return;
      }
    }

    const folderToLoad=sub || a.driveFolder;
    const response=await fetch(D.driveEndpoint+'?folder='+encodeURIComponent(folderToLoad));
    const data=await response.json();

    if(data.error)throw new Error(data.error);

    if(!data.files || !data.files.length){
      el.innerHTML='<div class="album-empty"><h3>No photos in this folder</h3></div>';
      return;
    }

    el.innerHTML=`<div class="media-grid">${renderMediaFiles(data.files)}</div>`;
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
      alert('Contact form is ready, but you need to add your free Formspree endpoint in site-data.js?v=4 first.');
    });
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  common();
  renderAlbums();
  renderAlbum();
  setupContact();
});