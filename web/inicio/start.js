// The start screen: the Moon in 3D with a ring on every landing site. It shares three.js with the app (Vite bundles
// both pages, so the library is downloaded once) and lives in its own page so the app itself opens straight on a site.
import * as THREE from 'three';
const $=id=>document.getElementById(id),rnd=(a,b)=>a+Math.random()*(b-a),KEY='inside-moon-153.lang';
let lang='es';
try{const q=new URLSearchParams(location.search).get('lang'),s=localStorage.getItem(KEY);lang=q==='en'||q==='es'?q:(s==='en'||s==='es'?s:'es');}catch{}
const T={es:{t0:'Polo Sur Lunar',t:'Elige un sitio de aterrizaje',h:[['drag','Arrastra','girar'],['wheel','Rueda','acercar'],['tap','Clic','ver el sitio'],['dbl','Doble clic','entrar']],ht:[['drag','Arrastra','girar'],['tap','Toca un anillo','ver el sitio'],['dbl','Doble toque','entrar']],co:'Coordenadas',key:'Dato clave',sub:'Exploración del Polo Sur Lunar',pl:'Iniciar exploración',err:'No se pudieron cargar los sitios. Abre la página desde el servidor del proyecto (npm run dev).',w:'O'},
 en:{t0:'Lunar South Pole',t:'Pick a landing site',h:[['drag','Drag','rotate'],['wheel','Scroll','zoom'],['tap','Click','see details'],['dbl','Double-click','enter']],ht:[['drag','Drag','rotate'],['tap','Tap a ring','see details'],['dbl','Double-tap','enter']],co:'Coordinates',key:'Key data',sub:'Lunar South Pole Exploration',pl:'Start exploring',err:'Could not load the sites. Open the page from the project server (npm run dev).',w:'W'}};
const ICON={drag:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',wheel:'<rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 7v4"/>',tap:'<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',dbl:'<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8.5"/>'};
const BRIEF={
 'site01-connecting-ridge':{es:{k:'POLO SUR · CRESTA DE ALTA ILUMINACIÓN',d:'Hasta ~90 % de luz (LROC); >70 % a 1 m del suelo',b:'Une los bordes de Shackleton y de Gerlache; hay cráteres en sombra permanente cerca.'},en:{k:'SOUTH POLE · HIGHLY ILLUMINATED RIDGE',d:'Up to ~90 % sunlit (LROC); >70 % at 1 m above ground',b:'Links the rims of Shackleton and de Gerlache craters; permanently shadowed craters nearby.'}},
 'site04-shackleton-rim':{es:{k:'POLO SUR · BORDE DE CRÁTER',d:'Cráter de ~21 km y más de 4 km de profundidad',b:'Interior casi todo en sombra permanente; los picos del borde reciben luz solar.'},en:{k:'SOUTH POLE · CRATER RIM',d:'Crater ~21 km wide, over 4 km deep',b:'Interior almost entirely in permanent shadow; rim peaks receive sunlight.'}},
 'site06-nobile-rim-1':{es:{k:'POLO SUR · BORDE DE CRÁTER',d:'Cráter Nobile de ~79 km de diámetro',b:'La luz y la visibilidad de la Tierra dependen mucho del punto exacto.'},en:{k:'SOUTH POLE · CRATER RIM',d:'Nobile crater, ~79 km across',b:'Light and Earth visibility depend strongly on the exact spot.'}},
 'haworth':{es:{k:'POLO SUR · CRÁTER EN SOMBRA PERMANENTE',d:'Cráter de ~50 km de diámetro',b:'Gran parte del interior no recibe luz solar; zona de búsqueda de hielo de agua.'},en:{k:'SOUTH POLE · PERMANENTLY SHADOWED CRATER',d:'Crater ~50 km across',b:'Much of the interior never sees sunlight; a search area for water ice.'}},
 'site23-malapert-massif':{es:{k:'POLO SUR · MACIZO MONTAÑOSO',d:'Posible resto del borde de la cuenca Polo Sur–Aitken',b:'Montaña alta con buena visibilidad de la Tierra y luz en su borde.'},en:{k:'SOUTH POLE · MOUNTAIN MASSIF',d:'Possible remnant of the South Pole–Aitken basin rim',b:'Tall mountain with good Earth visibility and sunlight on its rim.'}},
'dm2-nobile-rim-2':{es:{k:'POLO SUR · BORDE DE CRÁTER · ARTEMIS III',d:'Segunda región del borde del cráter Nobile',b:'Una de las nueve regiones de NASA (2024); compárala con Nobile Rim 1.'},en:{k:'SOUTH POLE · CRATER RIM · ARTEMIS III',d:'Second region on the rim of Nobile crater',b:'One of the nine NASA regions (2024); compare it with Nobile Rim 1.'}},
 'site11-de-gerlache-rim':{es:{k:'POLO SUR · BORDE DE CRÁTER · ARTEMIS III',d:'Cráter de ~32 km junto a Shackleton',b:'Su borde se une a Connecting Ridge; hay zonas en sombra permanente cerca.'},en:{k:'SOUTH POLE · CRATER RIM · ARTEMIS III',d:'Crater ~32 km wide, next to Shackleton',b:'Its rim joins Connecting Ridge; permanently shadowed areas nearby.'}},
 'site07-peak-near-shackleton':{es:{k:'POLO SUR · PICO · LISTA 2022',d:'Terreno elevado a pocos km de Shackleton',b:'Pico casi en el polo, con cráteres en sombra permanente alrededor.'},en:{k:'SOUTH POLE · PEAK · 2022 LIST',d:'Raised terrain a few km from Shackleton',b:'A peak almost at the pole, with permanently shadowed craters around it.'}},
 'site20-leibnitz-beta-plateau':{es:{k:'POLO SUR · MESETA · LISTA 2022',d:'Meseta alta del terreno montañoso Leibnitz, a ~85° S',b:'Suele ser más llana que la pared de un cráter, pero está lejos de los cráteres con hielo.'},en:{k:'SOUTH POLE · PLATEAU · 2022 LIST',d:'High plateau in the Leibnitz mountains, at ~85° S',b:'Tends to be more level than a crater wall, but is far from the ice craters.'}}};
const rd=new THREE.WebGLRenderer({canvas:$('c'),antialias:true});rd.setPixelRatio(Math.min(devicePixelRatio,2));
const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(45,1,.05,2000);
const resize=()=>{rd.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();};addEventListener('resize',resize);resize();
{const a=[];for(let i=0;i<1500;i++){const u=Math.random()*2-1,t=Math.random()*6.2832,q=Math.sqrt(1-u*u);a.push(q*Math.cos(t)*600,u*600,q*Math.sin(t)*600);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));sc.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1.4,sizeAttenuation:false})));}
const tex=new THREE.TextureLoader().load('./moon.jpg');tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
const R=10,mg=new THREE.Group(),moon=new THREE.Mesh(new THREE.SphereGeometry(R,96,64),new THREE.MeshStandardMaterial({map:tex,roughness:1}));
mg.add(moon);sc.add(mg);const dl=new THREE.DirectionalLight(0xffffff,3.2);dl.position.set(30,12,40);sc.add(dl,new THREE.AmbientLight(0xdbe4ff,.5));
/* Misma convención de la textura: longitud 0 en +x, el este hacia -z */
const ll=(la,lo)=>{const f=(90-la)*Math.PI/180,t=(lo+180)*Math.PI/180;return new THREE.Vector3(-Math.sin(f)*Math.cos(t),Math.cos(f),Math.sin(f)*Math.sin(t));};
let S=[];
try{const base='../sites/',list=await(await fetch(base+'index.json')).json();
 const infos=await Promise.all(list.map(s=>fetch(`${base}${s.id}/info.json`).then(r=>r.json())));
 S=list.map((s,i)=>({id:s.id,info:infos[i]}));}catch(e){$('err').style.display='block';$('err').textContent=T[lang].err;}
const picks=[];
S.forEach((s,i)=>{const v=ll(s.info.lat_deg,s.info.lon_deg);
 const r=new THREE.Mesh(new THREE.RingGeometry(.16,.22,32),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));
 r.position.copy(v).multiplyScalar(R*1.012);r.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v);mg.add(r);
 const p=new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
 p.position.copy(r.position);p.userData.i=i;mg.add(p);picks.push(p);
 const t=document.createElement('div');t.className='tag';$('tags').appendChild(t);Object.assign(s,{ring:r,pick:p,tag:t});});
function texts(){const L=T[lang];document.documentElement.lang=lang;$('t0').textContent=L.t0;$('t1').textContent=L.t;$('hints').innerHTML=(matchMedia('(hover:none)').matches?L.ht:L.h).map(([i,k,v])=>`<li><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[i]}</svg><span><b>${k}</b> · ${v}</span></li>`).join('');$('introS').textContent=L.sub;$('play').setAttribute('aria-label',L.pl);$('iCk').textContent=L.co;$('iDk').textContent=L.key;
 S.forEach(s=>s.tag.textContent=s.info.sign[lang].title);if(sel>=0)fill(sel);}
mg.rotation.set(-.35,.5,0);cam.position.set(0,0,40);
let sel=-1,tgt=null,zoomT=40,down=null,moved=false,started=false;const sp=new THREE.Vector3(),rc=new THREE.Raycaster(),m2=new THREE.Vector2();
function hit(e){m2.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);rc.setFromCamera(m2,cam);const h=rc.intersectObjects([moon,...picks])[0];return h&&h.object.userData.i!==undefined?h.object.userData.i:-1;}
function fill(i){const s=S[i],d=s.info,g=d.sign[lang],br=(BRIEF[s.id]||{})[lang]||{k:'',d:'—',b:g.body.split('. ')[0]+'.'};
 $('iK').textContent=br.k;$('iK').style.display=br.k?'inline-block':'none';$('iN').textContent=g.title;
 $('iC').textContent=Math.abs(d.lat_deg).toFixed(2)+'° S, '+Math.abs(d.lon_deg).toFixed(2)+'° '+(d.lon_deg<0?T[lang].w:'E');$('iD').textContent=br.d;$('iB').textContent=br.b;}
function select(i){sel=i;const v=ll(S[i].info.lat_deg,S[i].info.lon_deg);tgt={rx:Math.atan2(v.y,Math.hypot(v.x,v.z)),ry:Math.atan2(-v.x,v.z)};zoomT=11.6;fill(i);$('info').style.display='block';}
/* Entering a site: the camera dives towards it while the screen fades to the colour of the app's loading screen, so the
   two pages read as one movement (no animation for those who asked for less motion) */
let leaving=false;
const enter=i=>{if(leaving)return;leaving=true;try{localStorage.setItem(KEY,lang);}catch{}
 const go='../index.html?site='+encodeURIComponent(S[i].id)+'&lang='+lang;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){location.href=go;return;}
 const v=ll(S[i].info.lat_deg,S[i].info.lon_deg);tgt={rx:Math.atan2(v.y,Math.hypot(v.x,v.z)),ry:Math.atan2(-v.x,v.z)};zoomT=10.4;
 document.body.classList.add('leaving');setTimeout(()=>{location.href=go;},700);};
const close=()=>{sel=-1;tgt=null;zoomT=28;$('info').style.display='none';};$('x').onclick=close;
/* Play: de la Luna completa gira y se acerca al polo sur, y aparecen los sitios */
function startPlay(){if(started)return;started=true;document.body.classList.remove('intro');$('intro').classList.add('off');setTimeout(()=>{$('intro').style.display='none';},700);
 tgt={rx:-1.25,ry:mg.rotation.y};zoomT=28;setTimeout(()=>{if(sel<0)tgt=null;},2400);}
addEventListener('keydown',e=>{if(!started){if(e.key==='Enter'||e.key===' '){e.preventDefault();startPlay();}return;}if(sel<0)return;if(e.key==='Enter')enter(sel);else if(e.key==='Escape')close();});
$('lang').onclick=()=>{lang=lang==='es'?'en':'es';try{localStorage.setItem(KEY,lang);}catch{}texts();};
const cv=$('c');
cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};moved=false;});
cv.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
 if(moved){tgt=null;mg.rotation.y+=dx*.006*(cam.position.z/28);mg.rotation.x=Math.max(-1.57,Math.min(1.57,mg.rotation.x+dy*.006*(cam.position.z/28)));down={x:e.clientX,y:e.clientY};}});
let last=null; /* doble toque en pantallas táctiles; el ratón usa el evento dblclick */
addEventListener('pointerup',e=>{if(down&&!moved&&started){const i=hit(e);if(i>=0){if(last&&last.i===i&&e.timeStamp-last.t<450)enter(i);else select(i);last={i,t:e.timeStamp};}}down=null;});
cv.addEventListener('dblclick',e=>{if(!started)return;const i=hit(e);if(i>=0)enter(i);});
cv.addEventListener('wheel',e=>{zoomT=Math.max(11.3,Math.min(40,zoomT+e.deltaY*.02));},{passive:true});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
(function tick(){
 if(tgt){mg.rotation.x+=(tgt.rx-mg.rotation.x)*.08;mg.rotation.y+=wrap(tgt.ry-mg.rotation.y)*.08;}else if(!down&&sel<0)mg.rotation.y+=.0012;
 cam.position.z+=(zoomT-cam.position.z)*.08;
 const k=Math.max(.06,Math.min(1.2,(cam.position.z-10)/16));
 S.forEach((s,i)=>{s.ring.scale.setScalar(k*(i===sel?1.4:1));s.pick.scale.setScalar(k);s.ring.material.color.set(i===sel?0xd4ad5b:0xffffff);
  s.ring.getWorldPosition(sp);const front=sp.clone().normalize().dot(cam.position.clone().normalize())>.15,q=sp.clone().project(cam);
  s.tag.style.display=started&&front&&(cam.position.z<24||i===sel)?'block':'none';s.tag.style.left=((q.x+1)/2*innerWidth)+'px';s.tag.style.top=((1-q.y)/2*innerHeight)+'px';s.tag.className='tag'+(i===sel?' on':'');});
 rd.render(sc,cam);requestAnimationFrame(tick);})();
texts();
$('play').onclick=startPlay;$('play').focus();
