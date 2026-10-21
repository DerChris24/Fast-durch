// All writes go to the shared server. Browser storage is not a tournament database.
let syncOnline = false, syncBusy = false, syncSetupRequired = false, syncLoaded = false;
let pollTimer, polling = false, connectionFailures = 0;
let pendingInterest=null, interestError='';
const syncLocks = new Map(), adminDrafts = new Map();
const draftFields = ['eventDate','eventTime','newLoanDeckName','newLoanDeckQty'];
document.querySelector('#drawer').addEventListener('input',event=>{
  if(draftFields.includes(event.target.id))adminDrafts.set(event.target.id,event.target.value);
});
function updatePauseCountdown() {
  if(document.hidden)return;
  const d=state.divisions?.[activeDivision];
  const seconds=Math.max(0,Math.ceil(((d?.breakUntil||Date.now())-Date.now())/1000));
  const display=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  const text=d?.breakUntil?(seconds?display+' verbleiben · nächste Runde startet automatisch':'Pause vorbei · nächste Runde startet jetzt'):'10:00 · nächste Runde startet automatisch';
  document.querySelectorAll('.pause-countdown').forEach(node=>{if(node.textContent!==text)node.textContent=text;});
}
const originalRender = render;
function renderLoanDecks() {
  const list=document.querySelector('#loanDeckList'); if(!list)return;
  const decks=state.decks||[],reservations=state.deckReservations||[],mine=reservations.find(r=>r.owned);
  const section=list.closest('.loan-deck-box');
  if(section)section.classList.toggle('hidden',decks.length===0);
  const ownDeck=mine&&decks.find(d=>d.id===mine.deckId),groups=new Map();
  for(const deck of decks){const key=deck.name.toLocaleLowerCase('de');if(!groups.has(key))groups.set(key,{name:deck.name,decks:[]});groups.get(key).decks.push(deck)}
  const note=mine?`<div class="loan-reservation">Deine Reservierung: <strong>${esc(ownDeck?.name||'Leihdeck')}</strong> <button class="btn outline" onclick="cancelLoanDeck('${mine.id}')">Reservierung entfernen</button></div>`:'';
  const cards=[...groups.values()].map(group=>{const reserved=group.decks.filter(d=>reservations.some(r=>r.deckId===d.id));const available=group.decks.filter(d=>!reservations.some(r=>r.deckId===d.id));const mineHere=mine&&ownDeck&&ownDeck.name.toLocaleLowerCase('de')===group.name.toLocaleLowerCase('de');return `<article class="loan-deck-card"><div><h4>${esc(group.name)}</h4><small>${available.length} von ${group.decks.length} verfügbar${reserved.length?' · '+reserved.length+' reserviert':''}</small></div>${!mine&&available.length?`<button class="btn primary" onclick="reserveLoanDeck('${available[0].id}')">Reservieren</button>`:mineHere?'<span class="badge">Für dich reserviert</span>':'<button class="btn outline" disabled>Derzeit nicht verfügbar</button>'}</article>`});
  list.innerHTML=note+(cards.join('')||'<div class="loan-deck-empty">Aktuell sind keine Leihdecks eingetragen. Frag bei Interesse am Veranstaltungstag Chris.</div>');
}
function renderAdminLoanDecks() {
  const box=document.querySelector('#adminLoanDecks');if(!box)return;
  const decks=state.decks||[],reservations=state.deckReservations||[];
  box.innerHTML=decks.map(deck=>{const r=reservations.find(x=>x.deckId===deck.id);return `<div class="loan-admin-row"><div><strong>${esc(deck.name)}</strong><small>${r?'Reserviert von '+esc(r.holder||'Gast'):'Verfügbar'}</small></div>${r?`<button class="btn outline" onclick="adminCancelDeck('${r.id}')">Reservierung aufheben</button>`:`<button class="delete" aria-label="${esc(deck.name)} entfernen" onclick="adminRemoveDeck('${deck.id}')">Entfernen</button>`}</div>`}).join('')||'<div class="loan-deck-empty">Noch keine Leihdecks eingetragen.</div>';
}
function renderInterest(){
  for (const [key,suffix] of [['junior','Junior'],['adult','Adult'],['trade','Trade']]) {
    const entries=key==='trade'?(state.tradeInterest||[]):(state.divisions[key]?.interest||[]);
    const count=document.querySelector('#interestCount'+suffix),button=document.querySelector(`[data-interest="${key}"]`);
    if(count)count.textContent=entries.length;
    if(button){const mine=entries.some(entry=>entry.owned);button.setAttribute('aria-pressed',String(mine));button.setAttribute('aria-busy',String(pendingInterest===key));document.querySelector('#interestState'+suffix).textContent=pendingInterest===key?'Wird gespeichert …':mine?'✓ Interesse angegeben · Zurücknehmen':'Ich habe Interesse';}
  }
  const feedback=document.querySelector('#interestFeedback');
  if(feedback){const mine=['junior','adult','trade'].filter(key=>(key==='trade'?state.tradeInterest:state.divisions[key].interest)?.some(entry=>entry.owned));feedback.dataset.error=String(!!interestError);feedback.textContent=interestError||(pendingInterest?'Deine Rückmeldung wird gespeichert …':!syncOnline?'Verbindung wird hergestellt …':mine.length?'Dein Interesse: '+mine.map(key=>key==='junior'?'Kids-Turnier':key==='adult'?'Erwachsenen-Turnier':'Tauschen').join(' und ')+'.':'');}
}
render = function () {
  // Restore only temporary connection locks; retain each control's business rules.
  for(const [el,disabled] of syncLocks)if(el.isConnected)el.disabled=disabled;
  syncLocks.clear();
  const focus = document.activeElement;
  const drawer=document.querySelector('#drawer');
  const focusWasInDrawer=drawer.contains(focus);
  const drawerScroll=drawer.scrollTop;
  const rewindSelect=drawer.querySelector('#rewindRound');
   const rewindDraft=rewindSelect?{division:rewindSelect.dataset.division,value:rewindSelect.value}:null;
   const bracketScroll=document.querySelector('#adminBracket')?.scrollLeft||0;
  const participantsOpen=drawer.querySelector('.admin-participants')?.open;
  const focusedAdminView=focus?.dataset?.adminView;
  const editingEvent = focus && ['eventDate', 'eventTime'].includes(focus.id);
  const eventDraft = editingEvent ? { date: document.querySelector('#eventDate')?.value, time: document.querySelector('#eventTime')?.value, id: focus.id } : null;
  const drafts = [...document.querySelectorAll('#drawer input')].map(el=>({id:el.id,playerId:el.dataset.playerId,value:el.value,focused:el===focus,start:el.selectionStart,end:el.selectionEnd}));
  originalRender();
  renderLoanDecks();
  renderAdminLoanDecks();
  const rewindNow=drawer.querySelector('#rewindRound');
  if(rewindNow&&rewindDraft?.division===activeDivision&&[...rewindNow.options].some(o=>o.value===rewindDraft.value))rewindNow.value=rewindDraft.value;
  for(const [id,value] of adminDrafts){const field=document.getElementById(id);if(field)field.value=value;}
  const participants=drawer.querySelector('.admin-participants');
  if(participants&&participantsOpen!==undefined)participants.open=participantsOpen;
  const adminBracket=document.querySelector('#adminBracket');
  if(adminBracket){adminBracket.scrollLeft=bracketScroll;adminBracket.tabIndex=0;adminBracket.setAttribute('role','region');adminBracket.setAttribute('aria-label','Turnierbaum verwalten, seitlich scrollbar');}
  updatePauseCountdown();
  renderInterest();
  if (drafts.some(d=>d.focused)) {
    const inputs=document.querySelectorAll('#drawer input');
    for(const d of drafts.filter(d=>d.focused)) {
      const el=d.id?document.getElementById(d.id):[...inputs].find(input=>d.playerId&&input.dataset.playerId===d.playerId);
      if(!el)continue;
      el.value=d.value;el.focus({preventScroll:true});
      if(d.start!==null)try{el.setSelectionRange(d.start,d.end);}catch{}
    }
  }
  if (eventDraft && document.querySelector('#eventDate')) {
    document.querySelector('#eventDate').value = eventDraft.date;
    document.querySelector('#eventTime').value = eventDraft.time;
    document.getElementById(eventDraft.id)?.focus();
  }
  if(focusedAdminView)drawer.querySelector('[data-admin-view="'+focusedAdminView+'"]')?.focus({preventScroll:true});
  drawer.scrollTop=drawerScroll;
  const locked = !syncOnline || syncBusy;
  document.querySelectorAll('#joinBtn, #playerName, .player-chip button, .interest-option, .loan-deck-list button, #drawer button:not(.xbtn):not(.admin-logout), #drawer input, #drawer select').forEach(el => { if (locked) {syncLocks.set(el,el.disabled);el.disabled = true;} });
  document.querySelector('#syncStatus').dataset.connection=syncOnline?'online':'offline';
  if(focusWasInDrawer&&!drawer.contains(document.activeElement)){
    (drawer.querySelector('#pin:not(:disabled),[data-admin-view][aria-selected="true"]:not(:disabled),.xbtn')||drawer).focus({preventScroll:true});
  }
  const status = document.querySelector('#syncStatus');
  status.textContent = syncOnline ? (syncBusy ? 'Änderung wird gespeichert …' : 'Verbunden · Änderungen werden automatisch synchronisiert') : (syncLoaded ? 'Verbindung unterbrochen · Änderungen pausiert' : 'Verbindung zum Turnier wird hergestellt …');
};
function applyRemote(payload) {
  if (!payload.state?.divisions) throw new Error('Der gemeinsame Turnierserver ist nicht verfügbar.');
  if ((payload.state.revision ?? 0) < (state.revision ?? 0)) return;
  const first = !syncLoaded;
  const unchanged = syncLoaded && state.revision === payload.state.revision && isAdmin === !!payload.isAdmin && syncOnline;
  if (unchanged) return;
  state = normalizeState(payload.state); attachStateAliases();
  isAdmin = !!payload.isAdmin; syncSetupRequired = !!payload.setupRequired; syncLoaded = true;
  if (editingPlayerId && !state.players.some(p => p.id === editingPlayerId && (p.owned || isAdmin))) {
    editingPlayerId = null; document.querySelector('#playerName').value = '';
  }
  if (first) {
    if (!state.divisions.junior.rounds.length && state.divisions.adult.rounds.length) activeDivision = 'adult';
    if (Object.values(state.divisions).some(d => d.rounds.length)) showTab('tournament');
  }
  render();
}
async function api(url, data) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Bitte die Website über den gemeinsamen Turnierserver öffnen.'); }
    if (!response.ok) { const error = new Error(payload.error || 'Änderung konnte nicht gespeichert werden.'); error.status = response.status; throw error; }
    return payload;
  } finally { clearTimeout(timeout); }
}
async function command(action, data = {}, message = 'Gespeichert.') {
  if (!syncOnline || syncBusy) { showToast('Bitte warten, bis die Verbindung wieder bereit ist.'); return false; }
  syncBusy = true; render();
  try {
    const payload = await api('/api/action', { action, division: activeDivision, revision: state.revision, ...data });
    applyRemote(payload); showToast(message); return true;
  } catch (error) {
    if(action==='interest')interestError='Interesse nicht bestätigt: '+(error.name==='AbortError'?'Bitte Verbindung prüfen und erneut versuchen.':error.message);
    showToast(error.name === 'AbortError' ? 'Keine Bestätigung erhalten. Bitte den aktuellen Stand prüfen, bevor du es erneut versuchst.' : error.message);
    try { applyRemote(await api('/api/state')); } catch { syncOnline = false; }
    return false;
  } finally { syncBusy = false; render(); }
}
async function skipPause(){
  if(!isAdmin){showToast('Nur die Turnierleitung kann die Pause überspringen.');return false;}
  if(!state.divisions?.[activeDivision]?.breakUntil){showToast('Aktuell läuft keine Pause.');return false;}
  if(!confirm('Die zehnminütige Pause für alle beenden und die nächste Runde sofort freigeben?'))return false;
  return command('skipPause',{},'Pause übersprungen. Die nächste Runde läuft jetzt.');
}
async function addPlayer(name) { return command('register', { name }, 'Du bist angemeldet!'); }
async function toggleInterest(division) {
  if(!['junior','adult','trade'].includes(division))return;
  if(syncBusy||pendingInterest)return;
  interestError='';pendingInterest=division;
  const active=(division==='trade'?state.tradeInterest:state.divisions[division].interest)?.some(entry=>entry.owned);
  try{return await command('interest',{division,interested:!active},active?'Rückmeldung entfernt.':'Danke für dein Interesse!');}
  finally{pendingInterest=null;render();}
}
async function removePlayer(id) { return command('remove', { id }, 'Anmeldung entfernt.'); }
async function saveOwnName(id, name) {
  if (await command('rename', { id, name }, 'Dein Spielername wurde geändert.')) cancelEdit();
}
async function rename(id, name) { return command('rename', { id, name }, 'Spielername gespeichert.'); }
async function setPlayerStatus(id,status) {
  if(!isAdmin)return;
  const labels={active:'Teilnehmerstatus zurückgesetzt.',afk:'Als AFK markiert.',withdrawn:'Als „Turnier verlassen“ markiert.'};
  return command('playerStatus',{id,status},labels[status]||'Teilnehmerstatus gespeichert.');
}
async function movePlayer(id) { return command('move', { id }, 'Turniergruppe geändert.'); }
async function setWinner(round, match, id) {
  if (state.rounds[round]?.matches[match]?.winner && state.rounds[round].matches[match].winner!==id && (state.divisions[activeDivision].loserRounds||[]).length && !confirm('Diese Korrektur setzt auch das Loser-Bracket zurück. Fortfahren?')) return;
  if (round < state.rounds.length - 1 && !confirm('Gewinner korrigieren? Die nachfolgenden Runden dieser Gruppe werden entfernt und müssen neu ausgelost werden.')) return;
  return command('winner', { round, match, id }, 'Ergebnis für alle aktualisiert.');
}
async function startNextRound() { if (await command('nextRound', {}, 'Neue Runde gestartet.')) showTab('tournament'); }
async function reserveLoanDeck(deckId) { return command('deckReserve', { deckId }, 'Leihdeck fuer dich reserviert.'); }
async function cancelLoanDeck(id) { return command('deckCancel', { id }, 'Leihdeck-Reservierung entfernt.'); }
async function adminCancelDeck(id) { return command('deckCancel', { id }, 'Reservierung aufgehoben.'); }
async function adminRemoveDeck(deckId) { if(confirm('Dieses verfuegbare Leihdeck aus der Liste entfernen?')) return command('deckRemove', { deckId }, 'Leihdeck entfernt.'); }
async function adminAddDeck() {
  const name=document.querySelector('#newLoanDeckName')?.value.trim();
  const quantity=Number(document.querySelector('#newLoanDeckQty')?.value);
  if(!name){showToast('Bitte einen Decknamen eingeben.');document.querySelector('#newLoanDeckName')?.focus();return;}
  if(!Number.isInteger(quantity)||quantity<1||quantity>20){showToast('Bitte eine Anzahl von 1 bis 20 eingeben.');return;}
  if(await command('deckAdd',{name,quantity},'Leihdeck eingetragen.')){adminDrafts.delete('newLoanDeckName');adminDrafts.delete('newLoanDeckQty');document.querySelector('#newLoanDeckName').value='';document.querySelector('#newLoanDeckQty').value='1';document.querySelector('#newLoanDeckName').focus();}
}async function saveEvent() {
  if(await command('event', { date: document.querySelector('#eventDate').value, time: document.querySelector('#eventTime').value || '16:00' }, 'Eventdaten gespeichert.')){
    adminDrafts.delete('eventDate');adminDrafts.delete('eventTime');
  }
}
async function adminAdd() { const name = prompt('Name der teilnehmenden Person:'); if (name) await addPlayer(name); }
async function resetTournament() {
  if(!state.divisions?.[activeDivision]?.rounds.length)return;
  const group=divisionLabel();
  if(confirm(`${group}-Turnierbaum, Ergebnisse, Lower Bracket, Pausenstatus und Finale zurücksetzen? Alle angemeldeten Teilnehmenden bleiben erhalten.`))
    await command('tournamentReset',{},`${group}-Turnier zurückgesetzt. Die Teilnehmenden bleiben angemeldet.`);
}
async function rewindTournament() {
  const select=document.querySelector('#rewindRound');if(!select)return;
  const roundsToKeep=Number(select.value);if(!Number.isInteger(roundsToKeep))return;
  const target=roundsToKeep===0?'zum Turnierstart':`auf den Stand nach Runde ${roundsToKeep}`;
  if(confirm(`Den ${divisionLabel()}-Turnierbaum ${target} zurückspulen? Spätere Upper-/Lower-Bracket-Runden und deren Ergebnisse werden entfernt. Die Teilnehmenden bleiben erhalten.`))
    await command('rewind',{roundsToKeep},`Turnier auf ${target} zurückgespult.`);
}
const passwordPreferenceKey='tcg-admin-save-password';
let passwordSaveEnabled=false;
try{passwordSaveEnabled=localStorage.getItem(passwordPreferenceKey)==='true';}catch{}
function restoreAdminPassword(){const button=document.querySelector('#passwordSave');if(button){button.setAttribute('aria-pressed',String(passwordSaveEnabled));button.textContent=(passwordSaveEnabled?'✓ ':'')+'Passwort speichern';}}
async function saveAdminPassword(){
 if(passwordSaveEnabled){try{localStorage.removeItem(passwordPreferenceKey);if(localStorage.getItem(passwordPreferenceKey)!==null)throw Error();passwordSaveEnabled=false;restoreAdminPassword();showToast('Speicherauswahl ausgeschaltet. Browser-Passwortmanager-Einträge bitte dort löschen.');}catch{showToast('Speicherauswahl konnte nicht entfernt werden.');}return;}
 await unlock(true);
}
async function rememberAdminPassword(password){
 localStorage.setItem(passwordPreferenceKey,'true');if(localStorage.getItem(passwordPreferenceKey)!=='true')throw Error();passwordSaveEnabled=true;
 if(!window.isSecureContext || typeof window.PasswordCredential!=='function' || typeof navigator.credentials?.store!=='function'){showToast('Auswahl gespeichert. Nutze die native Passwortspeicherung deines Browsers; automatische Vorbelegung kann dieser Button nicht garantieren.');return;}
 try{await navigator.credentials.store(new PasswordCredential({id:'admin',password,name:'Turnierleitung'}));showToast('Speicherung beim Browser angefragt. Bitte gegebenenfalls im Passwortmanager bestätigen.');}catch{showToast('Auswahl gespeichert. Passwortspeicherung konnte nicht bestätigt werden. Nutze den Browser-Passwortmanager.');}
}
async function unlock(savePassword = false) {
  if (!syncOnline || syncBusy) return;
  const password = document.querySelector('#pin').value;
  syncBusy = true; render();
  try {
    applyRemote(await api(syncSetupRequired ? '/api/setup' : '/api/login', { password }));
    showToast('Als Admin angemeldet.');
    if(savePassword===true){try{await rememberAdminPassword(password);}catch{showToast('Angemeldet, aber Speichern ist in diesem Browser nicht verfügbar.');}}
  }
  catch (error) { showToast(error.message); }
  finally { syncBusy = false; render(); }
}
async function logoutAdmin() {
  try { applyRemote(await api('/api/logout', {})); adminDrafts.clear();closeAdmin(); showToast('Abgemeldet.'); }
  catch { showToast('Abmeldung konnte nicht bestätigt werden. Bitte Verbindung prüfen.'); }
}
document.querySelector('#joinBtn').onclick = async () => {
  const field = document.querySelector('#playerName'); const value = field.value;
  if (editingPlayerId) await saveOwnName(editingPlayerId, value);
  else if (await addPlayer(value)) field.value = '';
};
document.querySelector('#cancelEditBtn').onclick = cancelEdit;
document.querySelector('#playerName').addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('#joinBtn').click(); });

async function connect() {
  clearTimeout(pollTimer);
  if (polling) return;
  if (document.hidden) return;
  if (syncBusy) { pollTimer=setTimeout(connect,3000); return; }
  polling=true;
  try {
    const payload=await api('/api/state');
    const wasOffline=!syncOnline;
    applyRemote(payload); syncOnline=true;
    connectionFailures=0;
    if(wasOffline) render();
  } catch { syncOnline=false; connectionFailures++; render(); }
  finally {
    polling=false;
    if(!document.hidden)pollTimer=setTimeout(connect,Math.min(30000,3000*2**Math.min(connectionFailures,4)));
  }
}
document.addEventListener('visibilitychange',()=>{ clearTimeout(pollTimer);if(!document.hidden){updatePauseCountdown();connect();} });
window.addEventListener('online',connect);
window.addEventListener('offline',()=>{clearTimeout(pollTimer);syncOnline=false;render();pollTimer=setTimeout(connect,3000);});
// Keyboard and touch access for the admin dialog.
const adminDrawer=document.querySelector('#drawer');
adminDrawer.setAttribute('role','dialog');
adminDrawer.setAttribute('aria-modal','true');
adminDrawer.setAttribute('aria-label','Turnierverwaltung');
adminDrawer.tabIndex=-1;
let adminReturnFocus=null;
document.querySelector('#adminBtn').onclick=()=>{
  adminReturnFocus=document.activeElement;
  document.querySelector('#adminLayer').classList.remove('hidden');
  document.body.classList.add('admin-is-open');
  document.querySelectorAll('header,main').forEach(el=>el.inert=true);
  render();
  (adminDrawer.querySelector('#pin:not(:disabled),[data-admin-view][aria-selected="true"]:not(:disabled),.xbtn')||adminDrawer).focus({preventScroll:true});
};
const closeAdminBeforeAccessibility=closeAdmin;
closeAdmin=function(){
  closeAdminBeforeAccessibility();
  document.body.classList.remove('admin-is-open');
  document.querySelectorAll('header,main').forEach(el=>el.inert=false);
  if(adminReturnFocus?.isConnected)adminReturnFocus.focus({preventScroll:true});
};
document.addEventListener('keydown',event=>{
  if(document.querySelector('#adminLayer').classList.contains('hidden'))return;
  if(event.key==='Escape'){event.preventDefault();closeAdmin();return;}
  if(event.key==='Enter'&&event.target.id==='pin'){event.preventDefault();unlock();return;}
  if(event.key!=='Tab')return;
  const focusable=[...adminDrawer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(!first){event.preventDefault();adminDrawer.focus();return;}
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===adminDrawer)){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!adminDrawer.contains(document.activeElement))){event.preventDefault();first.focus();}
});
document.querySelector('#toast').setAttribute('role','status');
document.querySelector('#toast').setAttribute('aria-live','polite');
document.querySelector('#toast').setAttribute('aria-atomic','true');
function setTheme(mode,save=true){
  const dark=mode==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  const button=document.querySelector('#themeToggle');
  button.setAttribute('aria-pressed',String(dark));
  button.setAttribute('aria-label',dark?'Hellmodus aktivieren':'Dark Mode aktivieren');
  button.title=dark?'Hellmodus aktivieren':'Dark Mode aktivieren';
  button.firstElementChild.innerHTML=dark?"<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"4\" fill=\"currentColor\"/><path d=\"M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>":"<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M20.8 15.1A9.4 9.4 0 0 1 8.9 3.2a9.6 9.6 0 1 0 11.9 11.9Z\"/></svg>";
  document.querySelector('meta[name="theme-color"]').content=dark?'#131625':'#171a2e';
  if(save)try{localStorage.setItem('tcg-theme',dark?'dark':'light');}catch{}
}
document.querySelector('#themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
window.addEventListener('storage',event=>{if(event.key==='tcg-theme')setTheme(event.newValue==='dark'?'dark':'light',false);});
setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light',false);
render(); connect();
setInterval(updatePauseCountdown,1000);
