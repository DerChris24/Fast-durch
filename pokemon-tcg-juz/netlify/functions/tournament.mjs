import { getStore } from '@netlify/blobs';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { fresh, mutate, advanceDue, fail } from '../../tournament-core.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
// Reject failed HTTP writes even on SDK versions that only check for status 412.
const checkedFetch = async (...args) => {
  const response = await fetch(...args);
  if (!response.ok && ![404,412].includes(response.status)) throw new Error('Storage unavailable');
  return response;
};
async function atomic(store,key,update) {
  for(let attempt=0;attempt<8;attempt++) {
    const old=await store.getWithMetadata(key,{type:'json'});
    const value=update(old?.data);
    const result=await store.setJSON(key,value,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(result.modified && result.etag) return value;
    if(result.modified) throw new Error('Storage did not confirm write');
  }
  fail('Gerade gibt es mehrere Änderungen. Bitte erneut versuchen.',409);
}
export default async (request,context) => {
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  try {
    const store=getStore({name:'juz-tournament-v1',consistency:'strong',fetch:checkedFetch});
    const cookie=request.headers.get('cookie')||'';
    let token=/(?:^|;\s*)tcg_owner=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1];
    if(!token) { token=randomBytes(32).toString('hex'); headers.append('Set-Cookie',`tcg_owner=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`); }
    const who=hash(token);
    const adminToken=/(?:^|;\s*)tcg_admin=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1];
    const sessionKey=adminToken?'sessions/'+hash(adminToken):null;
    const session=sessionKey?await store.get(sessionKey,{type:'json'}):null;
    const configured=process.env.ADMIN_PASSWORD || '';
    let admin=!!(configured.length>=12 && session?.expires>Date.now() && session.owner===who && session.passwordHash===hash(configured));
    const endpoint=new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
    let state;
    if(request.method==='POST') {
      if(request.headers.get('origin')!==new URL(request.url).origin) fail('Unzulässiger Ursprung.',403);
      if(!request.headers.get('content-type')?.startsWith('application/json')) fail('JSON erforderlich.',415);
      const raw=await request.text();
      if(Buffer.byteLength(raw)>8192) fail('Anfrage zu groß.',413);
      let input; try{input=JSON.parse(raw);}catch{fail('Ungültige Anfrage.');}
      if(!input || typeof input!=='object' || Array.isArray(input)) fail('Ungültige Anfrage.');
      const limit=async (key,max,ms)=>atomic(store,'limits/'+key,old=>{
        const value=old?.until>Date.now()?old:{count:0,until:Date.now()+ms};
        if(value.count>=max) fail('Zu viele Versuche. Bitte später erneut versuchen.',429);
        return {...value,count:value.count+1};
      });
      await limit('write-'+hash(context.ip||who),120,60000);
      if(endpoint==='login') {
        await limit('login-'+hash(context.ip||who),10,15*60000);
        if(configured.length<12) fail('In Netlify muss ADMIN_PASSWORD mit mindestens 12 Zeichen hinterlegt werden.',503);
        if(typeof input.password!=='string' || input.password.length>256 || !timingSafeEqual(Buffer.from(hash(input.password)),Buffer.from(hash(configured)))) fail('Passwort stimmt nicht.',401);
        const loginToken=randomBytes(32).toString('hex');
        await store.setJSON('sessions/'+hash(loginToken),{owner:who,expires:Date.now()+8*3600000,passwordHash:hash(configured)});
        headers.append('Set-Cookie',`tcg_admin=${loginToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
        admin=true;
      } else if(endpoint==='logout') {
        if(sessionKey) await store.delete(sessionKey);
        headers.append('Set-Cookie','tcg_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
        admin=false;
      } else if(endpoint==='action') {
        state=await atomic(store,'state',old=>mutate(old||fresh(),input.action,input,who,admin));
      } else fail('Nicht gefunden.',404);
    } else if(request.method!=='GET'||endpoint!=='state') fail('Nicht gefunden.',404);
    state ||= await store.get('state',{type:'json'}) || fresh();
    if(request.method==='GET'&&advanceDue(state)!==state) state=await atomic(store,'state',old=>advanceDue(old||fresh()));
    const publicState=structuredClone(state);publicState.decks ||= [];publicState.deckReservations ||= [];
    const names=new Map();
    for(const division of Object.values(publicState.divisions))for(const player of division.players)if(player.owner)names.set(player.owner,player.name);
    for(const division of Object.values(publicState.divisions)) for(const player of division.players) {
      player.owned=player.owner===who; delete player.owner;
    }
    for(const division of Object.values(publicState.divisions)) {
      division.interest ||= [];
      for(const entry of division.interest){entry.owned=entry.owner===who;delete entry.owner;}
    }
    for(const reservation of publicState.deckReservations){reservation.owned=reservation.owner===who;if(admin)reservation.holder=names.get(reservation.owner)||'Gast';delete reservation.owner;}
    return respond({state:publicState,isAdmin:admin,setupRequired:false});
  } catch(error) {
    if(!error.status) console.error('Tournament API:',error.message);
    return respond({error:error.status?error.message:'Der gemeinsame Speicher ist derzeit nicht erreichbar. Bitte erneut versuchen.'},error.status||503);
  }
};
export const config = { path: '/api/*' };
