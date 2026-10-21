import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fresh,mutate} from '../tournament-core.mjs';

let s=fresh();
const act=(action,data={},owner='guest',admin=false)=>s=mutate(s,action,{division:'junior',revision:s.revision,...data},owner,admin);
act('interest',{interested:true});act('interest',{interested:true});
assert.equal(s.divisions.junior.interest.length,1,'Retry must not cancel an interest');
act('interest',{interested:true},'second');act('interest',{division:'adult',interested:true});
assert.equal(s.divisions.junior.interest.length,2);assert.equal(s.divisions.adult.interest.length,1);
act('interest',{interested:false});assert.equal(s.divisions.junior.interest.length,1);
assert.throws(()=>act('tournamentReset'),e=>e.status===403);

for(const count of [2,3,4,5,8,9]){
 s=fresh();s.divisions.junior.players=Array.from({length:count},(_,i)=>({id:'test-'+i,name:'Player '+i,owner:'owner-'+i}));
 const players=structuredClone(s.divisions.junior.players);
 act('nextRound',{},'admin',true);
 let done=false;
 for(let step=0;step<300;step++){
  const d=s.divisions.junior;
  if(d.breakUntil){act('skipPause',{},'admin',true);continue;}
  if(d.grandFinal){act('grandWinner',{id:d.grandFinal.a},'admin',true);done=true;break;}
  let moved=false;
  for(const [field,action] of [['rounds','winner'],['loserRounds','loserWinner']]){
   const rounds=d[field]||[],round=rounds.at(-1),mi=round?.matches.findIndex(m=>!m.bye&&!m.winner)??-1;
   if(mi>=0){act(action,{round:rounds.length-1,match:mi,id:round.matches[mi].a},'admin',true);moved=true;break;}
  }
  if(!moved){if(count===2){done=true;break;}act('nextRound',{},'admin',true);}
 }
 assert.ok(done,'Tournament finishes with '+count+' entrants');
 if(s.divisions.junior.rounds.length>1){
  act('rewind',{roundsToKeep:1},'admin',true);assert.equal(s.divisions.junior.rounds.length,1);assert.equal(s.divisions.junior.loserRounds.length,0);
  act('nextRound',{},'admin',true);assert.equal(s.divisions.junior.rounds.length,2);
 }
 act('tournamentReset',{},'admin',true);assert.deepEqual(s.divisions.junior.players,players);assert.equal(s.divisions.junior.rounds.length,0);
}
console.log('PASS: interest, authorization, tournaments (2/3/4/5/8/9 players), rewind/resume, reset keeps players');

const html=fs.readFileSync('index.html','utf8');
for(const [,body] of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))if(body.trim())new vm.Script(body);
const client=fs.readFileSync('sync-client.js','utf8');
const renderInterest=client.slice(client.indexOf('function renderInterest(){'),client.indexOf('render = function () {'));
const nodes=new Map();
const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}});return nodes.get(selector);}};
const context=vm.createContext({document,state:{divisions:{junior:{interest:[{owned:true}]},adult:{interest:[]}}},pendingInterest:null,interestError:'',syncOnline:true});
vm.runInContext(renderInterest+';renderInterest();',context);
assert.equal(nodes.get('#interestCountJunior').textContent,1);
assert.equal(nodes.get('[data-interest="junior"]').attrs['aria-pressed'],'true');
assert.match(nodes.get('#interestStateJunior').textContent,/Interesse angegeben/);
context.pendingInterest='adult';vm.runInContext('renderInterest()',context);assert.match(nodes.get('#interestStateAdult').textContent,/gespeichert/);
context.pendingInterest=null;context.interestError='Verbindung fehlgeschlagen';vm.runInContext('renderInterest()',context);assert.equal(nodes.get('#interestFeedback').dataset.error,'true');
console.log('PASS: client confirmation, counter, pending state, inline errors, inline script syntax');

function luminance(hex){const c=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
for(const [label,text,bg] of [['light text','#252752','#ffffff'],['light secondary','#505970','#f1f3fa'],['dark text','#f5f5f7','#20243a'],['dark secondary','#d5d5dc','#292f48'],['primary','#28243d','#ffd166'],['kids dark','#ffecb2','#483a1a'],['adult dark','#cbf5df','#1b4033'],['kids light','#49390c','#fff0b2'],['adult light','#124d37','#d5f2e3']]){
 const a=luminance(text),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,label+': '+ratio);console.log('Contrast '+label+': '+ratio.toFixed(1)+':1');
}

if(process.argv.includes('--core-only')){console.log('HTTP checks skipped explicitly: core, DOM and contrast audit only.');process.exit(0);}
const auditRoot=path.resolve('checks');
const temp=fs.mkdtempSync(path.join(auditRoot,'tcg-audit-'));
const child=spawn(process.execPath,['server.mjs'],{windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:'8876',DATA_DIR:temp,ADMIN_PASSWORD:'',SITE_URL:''},stdio:['ignore','pipe','pipe']});
let childError='';child.stderr.on('data',data=>childError+=data.toString());
try{
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Fixture server failed: '+childError);}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Fixture timeout')),5000);t.unref();})]);
 const base='http://127.0.0.1:8876';
 const a={cookie:''},b={cookie:''};
 async function request(user,endpoint,body){const r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{Cookie:user.cookie,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))user.cookie=r.headers.get('set-cookie').split(';')[0];return {code:r.status,data:await r.json()};}
 await request(a,'/api/state');await request(b,'/api/state');
 const post=(u,division,interested)=>request(u,'/api/action',{action:'interest',division,interested});
 assert.equal((await post(a,'junior',true)).code,200);await post(a,'junior',true);
 let stateB=(await request(b,'/api/state')).data.state;assert.equal(stateB.divisions.junior.interest.length,1);assert.equal(stateB.divisions.junior.interest[0].owned,false);
 assert.equal((await request(a,'/api/state')).data.state.divisions.junior.interest[0].owned,true);
 await post(a,'adult',true);await post(b,'junior',true);await post(a,'junior',false);
 stateB=(await request(b,'/api/state')).data.state;assert.equal(stateB.divisions.junior.interest.length,1);assert.equal(stateB.divisions.junior.interest[0].owned,true);assert.equal(stateB.divisions.adult.interest.length,1);
 assert.equal((await fetch(base+'/theme.css')).status,200);
 await post(a,'trade',true);let trade=(await request(b,'/api/state')).data.state.tradeInterest;assert.equal(trade.length,1);assert.equal(trade[0].owned,false);assert(!('owner' in trade[0]));
 assert.equal((await request(a,'/api/login',{password:'wrong'})).code,401);
 assert.equal((await request(a,'/api/login',{password:'TCGCOMMUNITYLAUF'})).code,200);
 let adminState=(await request(a,'/api/state')).data;assert.equal(adminState.isAdmin,true);
 assert.equal((await request(a,'/api/action',{action:'event',division:'junior',date:'2026-12-01',time:'17:00',revision:adminState.state.revision})).code,200);
 adminState=(await request(a,'/api/state')).data;assert.equal(adminState.state.time,'17:00');
 assert.equal((await request(a,'/api/action',{action:'deckAdd',division:'junior',name:'Prüfdeck',quantity:2,revision:adminState.state.revision})).code,200);
 assert.equal((await request(a,'/api/logout',{})).code,200);assert.equal((await request(a,'/api/state')).data.isAdmin,false);
 assert.equal((await request(a,'/api/action',{action:'deckAdd',division:'junior',name:'Forbidden',quantity:1})).code,403);
 console.log('PASS: HTTP admin login, invalid password, event editing, deck creation, logout and access restriction; trade ownership privacy');
 console.log('PASS: isolated HTTP server, two visitors, shared counts, personal ownership, both groups, remove/reload, stylesheet serving');
}finally{
 if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited;}
 if(path.resolve(temp).startsWith(auditRoot+path.sep)&&path.basename(temp).startsWith('tcg-audit-'))fs.rmSync(temp,{recursive:true,force:true});
}
