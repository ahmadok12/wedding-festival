const images=['01','02','04','06','08','10'];
const clips=['01-entrance','02-blessings-mehndi','03-mehndi-barat','04-barat-walima','05-walima-farewell'];
const chapters=[...document.querySelectorAll('.chapter')];
const still=document.querySelector('#still');
const canvas=document.querySelector('#sequence');
const ctx=canvas.getContext('2d',{alpha:false});
const bar=document.querySelector('#progressBar');
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let enableMotion=!motionPreference.matches;
let current=-1, frameLock=false,manifest={}, sceneSerial=0;
const cache=new Map();const LIMIT=40;const loading=new Set();
let audioEnabled=false;const music=new Audio('./media/ambient.mp3');music.loop=true;music.volume=.3;
const form=document.querySelector('#rsvpForm');const eventBox=document.querySelector('#rsvpEvents');
let token=new URL(location.href).searchParams.get('invite')||'';let allowed=[];
// GitHub Pages has no server-side API. Do not claim to save RSVPs.
const onGithubPages=location.hostname.endsWith('github.io');
if(onGithubPages) {
 document.querySelector('#rsvpNotice').textContent='Website preview: online RSVP submissions require a backend and are not available on GitHub Pages.';
}
fetch('./media/sequences/manifest.json').then(r=>{if(!r.ok)throw Error('no sequences');return r.json()}).then(data=>{manifest=data;update()}).catch(()=>{canvas.classList.remove('active')});
function setScene(i){
 if(current===i)return;
 current=i;sceneSerial++;
 still.src=`./media/frames/${images[i]}.jpg`;
 canvas.classList.remove('active');
 document.querySelectorAll('.footnav a').forEach((a,j)=>a.classList.toggle('active',j===i));
}
function draw(img){
 const w=img.naturalWidth,h=img.naturalHeight;
 if(!w||!h)return;
 const cw=canvas.clientWidth,ch=canvas.clientHeight;
 const dpr=Math.min(devicePixelRatio||1,1.5);
 const tw=Math.round(cw*dpr),th=Math.round(ch*dpr);
 if(canvas.width!==tw||canvas.height!==th){canvas.width=tw;canvas.height=th}
 const scale=Math.max(tw/w,th/h),dw=w*scale,dh=h*scale;
 ctx.drawImage(img,(tw-dw)/2,(th-dh)/2,dw,dh);
 canvas.classList.add('active');
}
function getFrame(name,idx,serial){
 const key=`${name}/${String(idx).padStart(4,'0')}`;
 const cached=cache.get(key);
 if(cached){cache.delete(key);cache.set(key,cached);if(serial===sceneSerial)draw(cached);return}
 if(loading.has(key))return;
 loading.add(key);
 const img=new Image();
 img.onload=()=>{
  loading.delete(key);cache.set(key,img);
  while(cache.size>LIMIT)cache.delete(cache.keys().next().value);
  if(serial===sceneSerial && current<5 && wantedKey===key)draw(img);
 };
 img.onerror=()=>{loading.delete(key)};
 img.src=`./media/sequences/${key}.webp`;
}
let wantedKey='';
function update(){
 const viewport=innerHeight;let active=0,smallest=Infinity;
 chapters.forEach((c,i)=>{const rect=c.getBoundingClientRect();const distance=Math.abs(rect.top-viewport*.14);if(distance<smallest){smallest=distance;active=i}});
 setScene(active);
 const rect=chapters[active].getBoundingClientRect();
 const fraction=Math.max(0,Math.min(1,(viewport*.75-rect.top)/(rect.height+viewport*.25)));
 const data=manifest[clips[active]];
 if(enableMotion && active<5 && data && data.count){
  const idx=Math.min(data.count-1,Math.floor(fraction*(data.count-1)));
  wantedKey=`${clips[active]}/${String(idx).padStart(4,'0')}`;
  getFrame(clips[active],idx,sceneSerial);
 } else canvas.classList.remove('active');
 const height=document.documentElement.scrollHeight-innerHeight;
 bar.style.width=`${height>0?scrollY/height*100:0}%`;
}
function schedule(){if(frameLock)return;frameLock=true;requestAnimationFrame(()=>{frameLock=false;update()})}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);update();
document.querySelector('#skip').addEventListener('click',e=>{
 enableMotion=!enableMotion;
 e.currentTarget.textContent=enableMotion?'Skip animation':'Enable animation';
 canvas.classList.remove('active');update();
});
document.querySelector('#audio').addEventListener('click',async e=>{if(audioEnabled){music.pause();audioEnabled=false}else{try{await music.play();audioEnabled=true}catch{audioEnabled=false}}e.currentTarget.textContent=audioEnabled?'♫ Sound on':'♫ Sound off';e.currentTarget.setAttribute('aria-pressed',String(audioEnabled))});
const labels={mehndi:'Mehndi · 9 December',barat:'Barat · 11 December',walima:'Walima · 12 December'};
function notice(t){document.querySelector('#rsvpNotice').textContent=t}
async function loadGuest(){if(onGithubPages){notice("Preview only — personalized guests and online RSVP need a backend. Do not share RSVP links yet.");return;}if(!token){notice('Preview mode — a personalized guest link is required to submit your RSVP.');return;}if(!/^[A-Za-z0-9_-]{32,128}$/.test(token)){notice('Invalid invitation link.');return;}try{const res=await fetch('./api/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Unable to load invitation');allowed=data.events||[];document.querySelector('#guestGreeting').textContent=`A special invitation for ${data.name}`;notice(`Dear ${data.name}, please confirm your attendance for each event below.`);eventBox.replaceChildren();for(const x of allowed){const line=document.createElement('label');line.className='rsvp-option';const label=document.createElement('span');label.textContent=labels[x.event];const select=document.createElement('select');select.name=x.event;for(const [value,title] of [['pending','Not decided'],['yes','Attending'],['no','Unable to attend']]){const o=document.createElement('option');o.value=value;o.textContent=title;select.append(o)}select.value=x.response;line.append(label,select);eventBox.append(line)}for(const id of ['mehndi','barat','walima']){if(!allowed.some(e=>e.event===id)){const panel=document.querySelector(`#${id} .panel`);panel.querySelectorAll('.date,.venue,.pending,.action').forEach(el=>el.hidden=true);const sub=document.createElement('p');sub.textContent='A celebration from our wedding festival';panel.append(sub)}}form.hidden=false;}catch(e){notice(e.message||'Unable to load invitation.')}}
form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('button');btn.disabled=true;document.querySelector('#rsvpStatus').textContent='Saving…';try{const responses=Object.fromEntries([...eventBox.querySelectorAll('select')].map(s=>[s.name,s.value]));const res=await fetch('./api/rsvp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,responses}),cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Failed to save RSVP');document.querySelector('#rsvpStatus').textContent='Your RSVP has been saved. Shukriya!';}catch(err){document.querySelector('#rsvpStatus').textContent=err.message}finally{btn.disabled=false}});
loadGuest();
