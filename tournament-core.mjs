import { randomUUID, randomInt } from 'node:crypto';
export const fresh = () => ({ revision: 0, date: '', time: '16:00', decks: [], deckReservations: [], divisions: {
  junior: { players: [], rounds: [], byeHistory: [], interest: [] },
  adult: { players: [], rounds: [], byeHistory: [], interest: [] }
} });
export function fail(message, status=400) { const e=new Error(message); e.status=status; throw e; }
export function advanceDue(state, now=Date.now()) {
  let next=null;
  for(const key of ['junior','adult']) {
    const current=state.divisions?.[key];
    if(!current?.breakUntil || current.breakUntil>now) continue;
    next ||= structuredClone(state);
    const d=next.divisions[key];
    for(const round of [...(d.rounds||[]),...(d.loserRounds||[])]) if(round.status==='scheduled') delete round.status;
    if(d.grandFinal?.startsAt && d.grandFinal.startsAt<=now) delete d.grandFinal.startsAt;
    delete d.breakUntil;delete d.breakMinutes;delete d.breakAfterRound;
  }
  if(next)next.revision=(state.revision||0)+1;
  return next||state;
}
function nameValue(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 28 || /[\x00-\x1f]/.test(value)) fail('Bitte einen Namen mit 1 bis 28 Zeichen eingeben.');
  return value.trim();
}
function unique(division, name, except) {
  if (division.players.some(p => p.id !== except && p.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'))) fail('Dieser Name ist bereits angemeldet.', 409);
}
function winners(round) { return round.matches.flatMap(m => m.bye ? [m.a] : m.winner ? [m.winner] : []); }
function mutateOnce(state, action, input, who, admin) {
  if(action==='interest' && input.division==='trade'){
    const next=structuredClone(state);next.tradeInterest ||= [];
    const existing=next.tradeInterest.some(entry=>entry.owner===who);
    const wanted=typeof input.interested==='boolean'?input.interested:!existing;
    if(!wanted)next.tradeInterest=next.tradeInterest.filter(entry=>entry.owner!==who);
    else if(!existing){if(next.tradeInterest.length>=1000)fail('Die Interessensliste ist voll.',409);next.tradeInterest.push({id:randomUUID(),owner:who});}
    next.revision=state.revision+1;return next;
  }
  if (action==='grandWinner') {
    if(!admin)fail('Bitte als Admin anmelden.',403);
    if(input.revision!==state.revision)fail('Turnierstand wurde geändert.',409);
    const final=state.divisions[input.division]?.grandFinal;
    if(!final||![final.a,final.b].includes(input.id))fail('Ungültige Auswahl.',400);
    if(final.startsAt&&final.startsAt>Date.now())fail('Das Finale beginnt erst nach der Pause.',409);
    const next=structuredClone(state);
    next.divisions[input.division].grandFinal.winner=input.id;
    next.revision=state.revision+1;return next;
  }
  if (['loserNextRound','loserWinner'].includes(action)) {
    if (!admin) fail('Bitte als Admin anmelden.',403);
    if (!['junior','adult'].includes(input.division)) fail('Ungültige Turniergruppe.');
    const original=state.divisions[input.division];
    if(action==='loserNextRound') fail('Lower-Bracket-Runden werden automatisch angelegt.',409);
    const virtual=structuredClone(state);
    virtual.divisions[input.division]={players:original.players,rounds:original.loserRounds||[],byeHistory:original.loserByeHistory||[]};
    const changed=mutateOnce(virtual,action==='loserNextRound'?'nextRound':'winner',input,who,admin);
    const next=structuredClone(state);
    next.divisions[input.division].loserRounds=changed.divisions[input.division].rounds;
    next.divisions[input.division].loserByeHistory=changed.divisions[input.division].byeHistory;
    next.divisions[input.division].grandFinal=null;
    delete next.divisions[input.division].breakUntil;delete next.divisions[input.division].breakMinutes;
    next.revision=changed.revision;return next;
  }
  // Each complete mutation runs synchronously against the latest state. No client can overwrite a snapshot.
  const next = structuredClone(state);
  const d = next.divisions[input.division];
  if (!['event', 'reset'].includes(action) && !['junior', 'adult'].includes(input.division)) fail('Ungültige Turniergruppe.');
  if (['event', 'reset', 'tournamentReset', 'rewind', 'nextRound', 'winner', 'move','deckAdd','deckRemove','skipPause','playerStatus'].includes(action)) { if (!admin) fail('Bitte als Admin anmelden.', 403); }
  if(action==='skipPause'){
    if(input.revision!==state.revision)fail('Der Turnierstand wurde geändert. Bitte erneut versuchen.',409);
    if(!d.breakUntil)fail('Aktuell läuft keine Pause, die übersprungen werden kann.',409);
    for(const round of [...(d.rounds||[]),...(d.loserRounds||[])])if(round.status==='scheduled')delete round.status;
    if(d.grandFinal?.startsAt)delete d.grandFinal.startsAt;
    delete d.breakUntil;delete d.breakMinutes;delete d.breakAfterRound;
  } else if(action==='tournamentReset'||action==='rewind'){
    if(input.revision!==state.revision)fail('Der Turnierstand wurde geändert. Bitte erneut versuchen.',409);
    if(action==='tournamentReset'){
      d.rounds=[];d.byeHistory=[];d.loserRounds=[];d.loserByeHistory=[];d.grandFinal=null;
    }else{
      const keep=input.roundsToKeep;
      if(!Number.isInteger(keep)||keep<0||keep>=d.rounds.length)fail('Bitte einen vorherigen Turnierstand auswählen.',409);
      d.rounds=d.rounds.slice(0,keep);
      d.byeHistory=d.rounds.flatMap(round=>round.matches.filter(match=>match.bye).map(match=>match.a));
      d.loserRounds=(d.loserRounds||[]).filter((round,index)=> (Number.isInteger(round.mainRound)?round.mainRound:index+2)<=keep);
      d.loserByeHistory=d.loserRounds.flatMap(round=>round.matches.filter(match=>match.bye).map(match=>match.a));
      d.grandFinal=null;
    }
    delete d.breakUntil;delete d.breakMinutes;delete d.breakAfterRound;
  } else if(action==='deckAdd'){
    const name=typeof input.name==='string'?input.name.trim():'';
    if(!name||name.length>48||/[\x00-\x1f]/.test(name))fail('Bitte einen Decknamen mit 1 bis 48 Zeichen eingeben.');
    if(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>20)fail('Die Anzahl muss zwischen 1 und 20 liegen.');
    next.decks ||= [];next.deckReservations ||= [];
    if(next.decks.length+input.quantity>200)fail('Die Leihdeckliste ist voll.',409);
    for(let i=0;i<input.quantity;i++)next.decks.push({id:randomUUID(),name});
  } else if(action==='deckRemove'){
    next.decks ||= [];next.deckReservations ||= [];
    if(next.deckReservations.some(r=>r.deckId===input.deckId))fail('Dieses Deck ist reserviert. Hebe zuerst die Reservierung auf.',409);
    next.decks=next.decks.filter(deck=>deck.id!==input.deckId);
  } else if(action==='deckCancel'){
    next.deckReservations ||= [];
    const reservation=next.deckReservations.find(r=>r.id===input.id);
    if(!reservation)fail('Reservierung nicht gefunden.',404);
    if(!admin&&reservation.owner!==who)fail('Du kannst nur deine eigene Reservierung entfernen.',403);
    next.deckReservations=next.deckReservations.filter(r=>r.id!==input.id);
  } else if(action==='deckReserve'){
    next.decks ||= [];next.deckReservations ||= [];
    if(next.deckReservations.some(r=>r.owner===who))fail('Du hast bereits ein Leihdeck reserviert.',409);
    if(!next.decks.some(deck=>deck.id===input.deckId))fail('Dieses Leihdeck gibt es nicht mehr.',404);
    if(next.deckReservations.some(r=>r.deckId===input.deckId))fail('Dieses Leihdeck wurde gerade reserviert. Bitte wähle ein anderes.',409);
    next.deckReservations.push({id:randomUUID(),deckId:input.deckId,owner:who});
  } else if(action==='interest'){
    d.interest ||= [];
    const existing=d.interest.some(entry=>entry.owner===who);
    const wanted=typeof input.interested==='boolean'?input.interested:!existing;
    if(!wanted)d.interest=d.interest.filter(entry=>entry.owner!==who);
    else if(!existing){if(d.interest.length>=1000)fail('Die Interessensliste ist voll.',409);d.interest.push({id:randomUUID(),owner:who});}
  } else if (action === 'register') {
    if (d.rounds.length) fail('Die Anmeldung ist geschlossen.', 409);
    if (d.players.length >= 256) fail('Die Teilnehmergrenze ist erreicht.');
    const name = nameValue(input.name); unique(d, name);
    d.players.push({ id: randomUUID(), name, owner: who });
  } else if (action === 'rename' || action === 'remove' || action === 'move' || action === 'playerStatus') {
    const p = d.players.find(p => p.id === input.id);
    if (!p) fail('Die Anmeldung ist nicht mehr vorhanden.', 404);
    if (!admin && p.owner !== who) fail('Du kannst nur deine eigene Anmeldung bearbeiten.', 403);
    if (action === 'rename') { const name = nameValue(input.name); unique(d, name, p.id); p.name = name; }
    if (action === 'playerStatus') {
      if (!['active','afk','withdrawn'].includes(input.status)) fail('Ungültiger Teilnehmerstatus.');
      p.status=input.status;
    }
    if (action === 'remove') {
      if (d.rounds.length) fail('Nach Turnierstart ist keine Abmeldung mehr möglich.', 409);
      d.players = d.players.filter(x => x.id !== p.id);
    }
    if (action === 'move') {
      if (Object.values(next.divisions).some(x => x.rounds.length)) fail('Gruppenwechsel nur vor Turnierstart.', 409);
      const target = next.divisions[input.division === 'junior' ? 'adult' : 'junior'];
      unique(target, p.name);
      d.players = d.players.filter(x => x.id !== p.id); target.players.push(p);
    }
  } else if (action === 'event') {
    if (typeof input.date !== 'string' || (input.date && (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date))))) fail('Ungültiges Datum.');
    if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) fail('Ungültige Uhrzeit.');
    next.date = input.date; next.time = input.time;
  } else if (action === 'nextRound') {
    if (input.revision !== state.revision) fail('Der Turnierstand wurde geändert. Bitte erneut auslosen.', 409);
    const last = d.rounds.at(-1);
    if (last && !last.matches.every(m => m.bye || m.winner)) fail('Zuerst alle Begegnungen entscheiden.', 409);
    let pool = last ? winners(last) : d.players.map(p => p.id);
    if (pool.length < 2) fail(last ? 'Das Turnier ist beendet.' : 'Mindestens zwei Teilnehmende erforderlich.');
    // Only the first round and rounds needing a bye are drawn randomly.
    if (!last || pool.length % 2) for (let i = pool.length - 1; i > 0; i--) { const j = randomInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const randomDraw = !last || pool.length % 2 !== 0;
    const matches = [];
    if (pool.length % 2) {
      let candidates = pool.filter(id => !d.byeHistory.includes(id));
      if (!candidates.length) candidates = pool;
      const bye = candidates[randomInt(candidates.length)];
      pool = pool.filter(id => id !== bye); d.byeHistory.push(bye); matches.push({ a: bye, bye: true });
    }
    while (pool.length) matches.push({ a: pool.shift(), b: pool.shift(), winner: null });
    d.rounds.push({ matches, randomDraw });
  } else if (action === 'winner') {
    if (input.revision !== state.revision) fail('Der Turnierstand wurde geändert. Bitte die Begegnung erneut auswählen.', 409);
    if (!Number.isInteger(input.round) || !Number.isInteger(input.match)) fail('Ungültige Begegnung.');
    const match = d.rounds[input.round]?.matches[input.match];
    if (!match || match.bye || ![match.a, match.b].includes(input.id)) fail('Ungültige Gewinnerauswahl.');
    if (d.rounds[input.round]?.status==='scheduled') fail('Diese Runde beginnt erst nach der Pause.',409);
    if (match.winner === input.id) return next;
    if(match.winner){d.loserRounds=[]; d.loserByeHistory=[]; d.grandFinal=null;}
    match.winner = input.id;
    d.rounds = d.rounds.slice(0, input.round + 1);
    d.byeHistory = d.rounds.flatMap(r => r.matches.filter(m => m.bye).map(m => m.a));
    delete d.breakUntil;delete d.breakMinutes;delete d.breakAfterRound;
  } else if (action === 'reset') {
    if (input.revision !== state.revision) fail('Der Stand wurde geändert. Bitte das Zurücksetzen erneut bestätigen.', 409);
    Object.assign(next, fresh());
  } else fail('Unbekannte Aktion.', 404);
  next.revision = state.revision + 1;
  return next;
}


export function advanceConsolation(state,division){
 const d=state.divisions[division]; if(!d)return;
 d.loserRounds ||= []; d.loserByeHistory ||= [];
 const last=d.loserRounds.at(-1);
 if(last && !last.matches.every(m=>m.bye||m.winner)) return;
 // Admit each completed main-round cohort together; never change an active pairing.
 const losses=d.rounds.filter(r=>r.matches.every(m=>m.bye||m.winner)).flatMap(r=>r.matches.filter(m=>!m.bye).map(m=>m.winner===m.a?m.b:m.a));
 const entered=new Set(d.loserRounds.flatMap(r=>r.matches.flatMap(m=>[m.a,m.b].filter(Boolean))));
 const newcomers=[...new Set(losses)].filter(id=>!entered.has(id));
 const pool=[...(last?winners(last):[]),...newcomers];
 if(pool.length<2)return;
 const virtual=structuredClone(state);
 virtual.divisions[division]={players:d.players.filter(p=>pool.includes(p.id)),rounds:last?[{matches:pool.map(id=>({a:id,bye:true}))}]:[],byeHistory:d.loserByeHistory};
 const generated=mutateOnce(virtual,'nextRound',{division,revision:state.revision},'',true).divisions[division];
 const round=generated.rounds.at(-1);
 // New arrivals have no fixed predecessor in this bracket: draw no connecting wires.
 round.hasNewcomers=newcomers.length>0;
 round.mainRound=d.rounds.at(-1)?.matches.every(m=>m.bye||m.winner)?null:d.rounds.length;
 d.loserRounds.push(round); d.loserByeHistory=generated.byeHistory;
}

export function mutate(state,action,input,who,admin){
 if(action!=='nextRound'){
  let next=mutateOnce(state,action,input,who,admin);
  if(admin&&['winner','loserWinner'].includes(action)) {
   const d=next.divisions[input.division],main=d.rounds.at(-1),loser=d.loserRounds?.at(-1);
   const mainWinner=main?.matches.length===1?main.matches[0].winner:null;
   const consolationWinner=loser?.matches.length===1?loser.matches[0].winner:null;
   const losses=d.rounds.filter(r=>r.matches.every(m=>m.bye||m.winner)).flatMap(r=>r.matches.filter(m=>!m.bye).map(m=>m.winner===m.a?m.b:m.a));
   const entered=new Set((d.loserRounds||[]).flatMap(r=>r.matches.flatMap(m=>[m.a,m.b].filter(Boolean))));
   const waiting=losses.some(id=>!entered.has(id));
   d.grandFinal=mainWinner&&consolationWinner&&!waiting?{a:mainWinner,b:consolationWinner,winner:null}:null;
   const lastMain=d.rounds.at(-1),lastLower=d.loserRounds?.at(-1);
   const complete=lastMain?.matches.length&&lastMain.matches.every(m=>m.bye||m.winner)&&(!lastLower||lastLower.matches.every(m=>m.bye||m.winner));
   if(complete&&!d.breakUntil)next=scheduleAutomaticStage(next,input.division,who);
  }
  return next;
 }
 if(!admin)fail('Bitte als Admin anmelden.',403);
 if(!['junior','adult'].includes(input.division))fail('Ungültige Turniergruppe.');
 if(input.revision!==state.revision)fail('Der Turnierstand wurde geändert. Bitte erneut starten.',409);
 const d=state.divisions[input.division],last=d.rounds.at(-1),loser=d.loserRounds?.at(-1);
 if(last&&!last.matches.every(m=>m.bye||m.winner))fail('Bitte zuerst alle Ergebnisse im Upper Bracket eintragen.',409);
 if(loser&&!loser.matches.every(m=>m.bye||m.winner))fail('Bitte zuerst alle Ergebnisse der laufenden Lower-Bracket-Runde eintragen.',409);
 const mainDone=last?.matches.length===1&&last.matches[0].winner;
 const next=mainDone?structuredClone(state):mutateOnce(state,action,input,who,admin);
 const before=next.divisions[input.division].loserRounds?.length||0;
 advanceConsolation(next,input.division);
 if(mainDone){
  next.revision=state.revision+1;
 }
 const dnext=next.divisions[input.division];
 const mainFinal=dnext.rounds.at(-1),loserFinal=dnext.loserRounds?.at(-1);
 const mainWinner=mainFinal?.matches.length===1?mainFinal.matches[0].winner:null;
 const loserWinner=loserFinal?.matches.length===1?loserFinal.matches[0].winner:null;
 const losses=dnext.rounds.filter(r=>r.matches.every(m=>m.bye||m.winner)).flatMap(r=>r.matches.filter(m=>!m.bye).map(m=>m.winner===m.a?m.b:m.a));
 const entered=new Set((dnext.loserRounds||[]).flatMap(r=>r.matches.flatMap(m=>[m.a,m.b].filter(Boolean))));
 const waiting=losses.some(id=>!entered.has(id));
 dnext.grandFinal=mainWinner&&loserWinner&&!waiting?{a:mainWinner,b:loserWinner,winner:null}:null;
 return next;
}

function scheduleAutomaticStage(state,division,who){
 const before=state.divisions[division],mainCount=before.rounds.length,lowerCount=before.loserRounds?.length||0,hadFinal=!!before.grandFinal;
 const next=mutate(state,'nextRound',{division,revision:state.revision},who,true);
 const d=next.divisions[division],newMain=d.rounds.length>mainCount,newLower=(d.loserRounds?.length||0)>lowerCount,newFinal=!!d.grandFinal&&!d.grandFinal.winner&&!before.grandFinal?.startsAt;
 if(!newMain&&!newLower&&!newFinal)return next;
 // Keep the tournament moving between breaks. Pause after every second
 // completed Upper-Bracket round, and always before the grand final.
 if(mainCount%2!==0&&!newFinal)return next;
 const minutes=10,until=Date.now()+minutes*60_000;
 d.breakMinutes=minutes;d.breakUntil=until;d.breakAfterRound=mainCount;
 if(newMain)d.rounds.at(-1).status='scheduled';
 if(newLower)d.loserRounds.at(-1).status='scheduled';
 if(newFinal)d.grandFinal.startsAt=until;
 next.revision++;
 return next;
}
