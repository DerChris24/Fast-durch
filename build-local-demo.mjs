import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=new URL('./',import.meta.url);
const read=n=>readFileSync(new URL(n,root),'utf8');
let core=read('tournament-core.mjs').replace(/^import .*\r?\n/,'').replace(/export /g,'');
core='const localCore=(()=>{const randomUUID=()=>crypto.randomUUID();const randomInt=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return Math.floor(a[0]/4294967296*n)};'+core+';return {fresh,mutate,advanceDue};})();';
let client=read('sync-client.js');
const begin=client.indexOf('async function api('),end=client.indexOf('async function command(',begin);
client=client.slice(0,begin)+`const demoKey='pokemon-juz-local-demo-v1';
const demoOwner='local-demo';
const demoPasswordHash='265e131c5b3acf5fa21c8d5fa28dd37a5069a9f9c313e8730ecc243b5afa17bb';
const demoAuthKey=demoKey+'-admin';let demoAdmin=false;
try{localStorage.removeItem(demoAuthKey);}catch{}
let demoState;try{demoState=JSON.parse(localStorage.getItem(demoKey));}catch{}
if(!demoState?.divisions)demoState=localCore.fresh();
function demoSave(next){localStorage.setItem(demoKey,JSON.stringify(next));demoState=next;}
function demoPayload(){const view=structuredClone(demoState);for(const d of Object.values(view.divisions)){for(const p of d.players)p.owned=p.owner===demoOwner;for(const i of d.interest||[])i.owned=i.owner===demoOwner;}for(const i of view.tradeInterest||[])i.owned=i.owner===demoOwner;for(const r of view.deckReservations||[])r.owned=r.owner===demoOwner;return {state:view,isAdmin:demoAdmin,setupRequired:false};}
async function api(url,data){
 const advanced=localCore.advanceDue(demoState);if(advanced!==demoState)demoSave(advanced);
 if(url==='/api/login'){if(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.password)))).map(n=>n.toString(16).padStart(2,'0')).join('')!==demoPasswordHash)throw new Error('Passwort nicht korrekt.');demoAdmin=true;}
 else if(url==='/api/logout'){demoAdmin=false;}
 else if(url==='/api/action')demoSave(localCore.mutate(demoState,data.action,data,demoOwner,demoAdmin));
 else if(url!=='/api/state')throw new Error('Unbekannte Demo-Aktion.');
 return demoPayload();
}
`+client.slice(end);
const saveStart=client.indexOf('const passwordPreferenceKey=');
const saveEnd=client.indexOf('async function unlock(',saveStart);
client=client.slice(0,saveStart)+"const passwordPreferenceKey=demoKey+'-password';\nlet passwordSaveEnabled=false,savedDemoPassword='';\ntry{const stored=localStorage.getItem(passwordPreferenceKey);if(stored==='TCGCOMMUNITYLAUF'){savedDemoPassword=stored;passwordSaveEnabled=true;}else if(stored!==null)localStorage.removeItem(passwordPreferenceKey);}catch{}\nfunction restoreAdminPassword(){const field=document.querySelector('#pin'),button=document.querySelector('#passwordSave');if(field&&!field.value&&passwordSaveEnabled)field.value=savedDemoPassword;if(button){button.setAttribute('aria-pressed',String(passwordSaveEnabled));button.textContent=(passwordSaveEnabled?'✓ ':'')+'Passwort speichern';}}\nasync function saveAdminPassword(){\n if(passwordSaveEnabled){try{localStorage.removeItem(passwordPreferenceKey);if(localStorage.getItem(passwordPreferenceKey)!==null)throw Error();passwordSaveEnabled=false;savedDemoPassword='';const field=document.querySelector('#pin');if(field)field.value='';restoreAdminPassword();showToast('Gespeichertes Demo-Passwort in diesem Browser vergessen.');}catch{showToast('Gespeichertes Passwort konnte nicht entfernt werden.');}return;}\n await unlock(true);\n}\nasync function rememberAdminPassword(password){localStorage.setItem(passwordPreferenceKey,password);if(localStorage.getItem(passwordPreferenceKey)!==password)throw Error();savedDemoPassword=password;passwordSaveEnabled=true;showToast('Demo-Passwort nur in diesem Browser gespeichert, auch nach Abmelden.');}\n"+client.slice(saveEnd);
client=client.replace("'Verbunden · Änderungen werden automatisch synchronisiert'","'Lokale Demo · in diesem Browser gespeichert'");
client=client.replace("window.addEventListener('offline',()=>{clearTimeout(pollTimer);syncOnline=false;render();pollTimer=setTimeout(connect,3000);});",'');
client=client.replace('render(); connect();','syncOnline=true; applyRemote(demoPayload()); connect();');
let html=read('index.html').replace('<title>','<title>Lokale Demo · ');
html=html.replace('<link rel="stylesheet" href="theme.css">','<style>'+read('theme.css')+'</style>');
html=html.replace('<script src="bracket-view.js"></script>','<script>'+read('bracket-view.js')+'</script>');
html=html.replace('<script src="sync-client.js"></script>','<script>'+core+'\n'+client+'</script>');
html=html.replace('Nur die Turnierleitung kann Ergebnisse und Einstellungen ändern.','Lokale Demo: Daten bleiben in diesem Browser. Passwort: TCGCOMMUNITYLAUF<br>Passwort speichern merkt das geprüfte Demo-Passwort im Klartext nur in diesem Browser, auch nach Abmelden. Erneut anklicken zum Vergessen.');
mkdirSync(new URL('local-demo/',root),{recursive:true});
writeFileSync(new URL('local-demo/index.html',root),html);
console.log('Lokale Demo erstellt');
