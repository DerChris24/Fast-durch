import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const html=read('local-demo/index.html'),online=read('sync-client.js'),source=read('index.html');
const full=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
const core=full.slice(0,full.indexOf('// All writes'));
const api=full.slice(full.indexOf('const demoKey='),full.indexOf('async function command('));
const auth=full.slice(full.indexOf('const passwordPreferenceKey='),full.indexOf("document.querySelector('#joinBtn').onclick"));
function context(memory=new Map(),blocked=false){
 const field={value:''},button={setAttribute(k,v){this[k]=v;}},toasts=[];
 const storage={getItem:k=>memory.get(k)??null,setItem(k,v){if(!blocked)memory.set(k,v);},removeItem(k){memory.delete(k);}};
 const ctx={crypto:globalThis.crypto,structuredClone,TextEncoder,localStorage:storage,document:{querySelector:s=>s==='#pin'?field:button},showToast:m=>toasts.push(m),closeAdmin(){},field,button,toasts};
 vm.createContext(ctx);vm.runInContext(core+api+`let syncOnline=true,syncBusy=false,syncSetupRequired=false;const adminDrafts=new Map();function render(){restoreAdminPassword();}function applyRemote(payload){globalThis.admin=payload.isAdmin;render();}`+auth,ctx);
 ctx.run=s=>vm.runInContext(s,ctx);ctx.run('applyRemote(demoPayload())');return ctx;
}
const memory=new Map(),c=context(memory);
c.field.value='falsch';await c.run('saveAdminPassword()');assert.equal(memory.size,0);assert.equal(c.admin,false);
c.field.value='TCGCOMMUNITYLAUF';await c.run('saveAdminPassword()');assert.equal(c.admin,true);assert.equal(c.button['aria-pressed'],'true');assert.equal(memory.get('pokemon-juz-local-demo-v1-password'),'TCGCOMMUNITYLAUF');
await c.run('logoutAdmin()');assert.equal(c.admin,false);c.field.value='';c.run('render()');assert.equal(c.field.value,'TCGCOMMUNITYLAUF');
const reload=context(memory);assert.equal(reload.admin,false);assert.equal(reload.field.value,'TCGCOMMUNITYLAUF');assert.equal(reload.button['aria-pressed'],'true');await reload.run('unlock()');assert.equal(reload.admin,true);await reload.run('logoutAdmin()');await reload.run('saveAdminPassword()');assert.equal(memory.size,0);assert.equal(reload.field.value,'');assert.equal(reload.button['aria-pressed'],'false');
const stale=new Map([['pokemon-juz-local-demo-v1-password','old-password']]);assert.equal(context(stale).field.value,'');assert.equal(stale.size,0);
const blocked=context(new Map(),true);blocked.field.value='TCGCOMMUNITYLAUF';await blocked.run('saveAdminPassword()');assert.equal(blocked.admin,true);assert.equal(blocked.button['aria-pressed'],'false');assert(blocked.toasts.at(-1).includes('nicht verfügbar'));
const eventCase=context();eventCase.field.value='TCGCOMMUNITYLAUF';await eventCase.run('unlock({type:"submit"})');assert.equal(eventCase.button['aria-pressed'],'false');
for(const doc of [html,source]){assert(doc.indexOf('id="passwordSave"')<doc.indexOf('id="passwordVisibility"'));assert(doc.indexOf('id="passwordVisibility"')<doc.indexOf('type="submit" class="btn primary"'));assert.equal((doc.match(/onsubmit="event.preventDefault\(\);unlock\(\)"/g)||[]).length,1);assert(!/id="pin"[^>]*onkeydown/.test(doc));assert(doc.includes('restoreAdminPassword();'));}
assert(!source.includes('TCGCOMMUNITYLAUF'));assert(!online.includes('TCGCOMMUNITYLAUF'));assert(!/localStorage\.setItem\([^;]*password\)/.test(online));assert(!online.includes('preventSilentAccess'));assert(online.includes("localStorage.setItem(passwordPreferenceKey,'true')"));
// Exercise online handlers with real DOM event argument and password-manager stub.
const onlineMemory=new Map(),calls=[];const o=context(onlineMemory);o.window={isSecureContext:true,PasswordCredential:function(){}};o.PasswordCredential=function(data){Object.assign(this,data)};o.navigator={credentials:{store:async value=>calls.push(value)}};
o.run(online.slice(online.indexOf('const passwordPreferenceKey='),online.indexOf("document.querySelector('#joinBtn').onclick")).replace('const passwordPreferenceKey=', 'globalThis.onlinePreferenceKey=').replaceAll('passwordPreferenceKey','onlinePreferenceKey').replaceAll('let passwordSaveEnabled=false','passwordSaveEnabled=false'));
o.field.value='TCGCOMMUNITYLAUF';await o.run('saveAdminPassword({type:"click"})');assert.equal(calls.length,1);assert.equal(onlineMemory.get('tcg-admin-save-password'),'true');await o.run('logoutAdmin()');assert.equal(onlineMemory.get('tcg-admin-save-password'),'true');await o.run('unlock()');assert.equal(calls.length,1);
for(const name of ['index.html','sync-client.js','theme.css','bracket-view.js'])assert.equal(read(name),read('dist/'+name));
console.log('PASS: Demo Save/Login/Logout/Render/Reload/Opt-out, invalid/stale/blocked storage, event arguments, online credential storage and logout, button order, single Enter submit, no online demo password/plaintext storage, dist consistency.');
