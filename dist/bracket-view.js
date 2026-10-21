// Future fixed pairings are visible immediately. Odd rounds are drawn on start.
bracketMarkup = function(adminMode=false,loserMode=false) {
  const actual=loserMode?(state.divisions[activeDivision].loserRounds||[]):state.rounds;
  const pendingLosers=loserMode?waitingLosers():[];
  const settled=!loserMode || (!!champion() && !pendingLosers.length);
  const final=actual.at(-1);const winningId=settled && final?.matches.length===1?final.matches[0].winner:null;
  const rounds=actual.map((r,ri)=>({mainRound:r.mainRound,hasNewcomers:r.hasNewcomers,randomDraw:r.randomDraw,scheduled:r.status==='scheduled',matches:r.matches.map(m=>({...m})),ri}));
  while(settled && rounds.length && rounds.at(-1).matches.length>1 && rounds.at(-1).matches.length%2===0) {
    const prev=rounds.at(-1),matches=[];
    for(let i=0;i<prev.matches.length;i+=2) matches.push({future:true,feeders:[i,i+1]});
    rounds.push({ri:rounds.length,matches,future:true});
  }
  return rounds.map((r,ri)=>{
    const gridColumn=ri+1+rounds.slice(0,ri).filter(round=>round.scheduled).length;
    const roundColumn=gridColumn+(r.scheduled?1:0);
    const pause=r.scheduled?`<div class="round-pause-divider" role="status" aria-live="polite" ${loserMode?`style="grid-column:${gridColumn}"`:''}><strong>10 Minuten Pause</strong><span class="pause-countdown">10:00 · Nächste Runde startet automatisch</span>${isAdmin?'<button type="button" class="pause-skip-button" onclick="skipPause()">Pause skippen</button>':''}</div>`:'';
    const column=`<div class="round-col ${r.scheduled?'round-scheduled':''}" ${loserMode?`style="grid-column:${roundColumn}"`:''}><h3>${loserMode?'Runde '+(ri+1):settled&&r.matches.length===1&&!r.matches[0].bye?'Finale':'Runde '+(ri+1)}<span>${r.randomDraw?'Zufällige Auslosung · ':''}${r.scheduled?'Startet nach der Pause automatisch':r.future?'Vorschau · feste Paarungen':(loserMode?'Lower Bracket · ':'')+r.matches.length+' Begegnung'+(r.matches.length===1?'':'en')}</span></h3><div class="round-games">${r.matches.map((m,mi)=>{
      let sources=[];
      if(ri>0 && (r.future || (!r.hasNewcomers && r.randomDraw!==true && rounds[ri-1].matches.length%2===0))) {
        const previous=rounds[ri-1];
        sources=m.future?m.feeders:[m.a,m.b].filter(Boolean).map(id=>previous.matches.findIndex(p=>(p.bye?p.a:p.winner)===id)).filter(i=>i>=0);
      }
      // Legacy random rounds have no flag: only connect adjacent, ordered feeders.
      if(!m.future && (sources.length!==2 || sources[0]!==mi*2 || sources[1]!==mi*2+1)) sources=[];
      const attrs=`data-round="${ri}" data-match="${mi}" data-sources="${sources.join(',')}"`;
      if(m.future) return `<div class="duel future" ${attrs}><div class="duel-title">Noch nicht gestartet</div>${m.feeders.map(i=>{
        const previous=rounds[ri-1].matches[i];
        const known=previous.bye?previous.a:previous.winner;
        return `<div class="entrant">${known?esc(playerName(known)):'TBA'}</div>`;
      }).join('')}</div>`;
      if(m.bye)return `<div class="duel bye" ${attrs}><div class="duel-title">Freilos · zufällig ausgelost</div><div class="entrant winner">${esc(playerName(m.a))}<span class="mark">FREILOS · WEITER</span></div></div>`;
      return `<div class="duel ${r.scheduled?'scheduled':''}" ${attrs}><div class="duel-title"><span>Begegnung ${mi+1}</span><span class="table-number">Tisch ${r.matches.slice(0,mi).filter(x=>!x.bye).length+1+(loserMode?(state.rounds[0]?.matches.filter(x=>!x.bye).length||0):0)}</span></div>${[m.a,m.b].map(id=>`<button class="entrant ${m.winner?(m.winner===id?'winner':'loser'):(adminMode?'':'pending')}" ${r.scheduled?'disabled':(adminMode||(isAdmin&&ri===actual.length-1&&!m.winner))?`onclick="${loserMode?'setLoserWinner':'setWinner'}(${ri},${mi},'${id}')"`:''}>${esc(playerName(id))}<span class="mark">${m.winner===id?(loserMode?(winningId===id?'SIEGER':'WEITER →'):(ri===actual.length-1&&state.divisions[activeDivision].players.length>=3?'SIEGER':winningId===id?'GEWONNEN':'WEITER →')):m.winner?(loserMode?'AUSGESCHIEDEN':'VERLOREN'):''}${adminMode&&m.winner===id?' · ÄNDERN':''}</span></button>`).join('')}</div>`;
    }).join('')}</div></div>`;
    return pause+column;
  }).join('');
};
let wireFrame;
function scheduleBracketWires(){cancelAnimationFrame(wireFrame);wireFrame=requestAnimationFrame(()=>{if(document.querySelector('#largeBracketDialog')?.open)document.querySelector('#tournamentBracketCard').style.zoom='1';drawBracketWires();fitLargeBracket();updateBracketNavigation();});}
function drawBracketWires(){
 for(const bracket of document.querySelectorAll('.bracket')){
  bracket.querySelector('.bracket-wires')?.remove();
  if(!bracket.getClientRects().length)continue;
  // Place every fixed successor exactly halfway between its two source boxes.
  for(const duel of bracket.querySelectorAll('.duel'))duel.style.transform='';
  for(const target of bracket.querySelectorAll('.duel[data-sources]')){
    if(!target.dataset.sources)continue;
    const ri=Number(target.dataset.round);
    const sourceRects=target.dataset.sources.split(',').map(mi=>bracket.querySelector(`.duel[data-round="${ri-1}"][data-match="${mi}"]`)?.getBoundingClientRect()).filter(Boolean);
    if(sourceRects.length!==2)continue;
    const desired=sourceRects.reduce((sum,r)=>sum+(r.top+r.bottom)/2,0)/2;
    const rect=target.getBoundingClientRect();
    target.style.transform='translateY('+(desired-(rect.top+rect.bottom)/2)+'px)';
  }
  const base=bracket.getBoundingClientRect();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('bracket-wires');svg.setAttribute('aria-hidden','true');
  svg.setAttribute('width',bracket.scrollWidth);svg.setAttribute('height',bracket.scrollHeight);
  for(const target of bracket.querySelectorAll('.duel[data-sources]')){
   const ri=Number(target.dataset.round);if(!ri||!target.dataset.sources)continue;
   const to=target.getBoundingClientRect();
   const sources=target.dataset.sources.split(',');
   sources.forEach((mi,index)=>{
    const source=bracket.querySelector(`.duel[data-round="${ri-1}"][data-match="${mi}"]`);if(!source)return;
    const from=source.getBoundingClientRect();
    const x1=from.right-base.left,y1=(from.top+from.bottom)/2-base.top,x2=to.left-base.left;
    const y2=(to.top+to.bottom)/2-base.top;
    const mid=(x1+x2)/2;
    const path=document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d',`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
    if(target.classList.contains('future'))path.classList.add('projected');
    svg.appendChild(path);
   });
  }
  bracket.appendChild(svg);
 }
}
function updateBracketNavigation(){
 const viewport=document.querySelector('#tournamentBracketCard > .bracket-shell');
 if(!viewport)return;
 let hint=document.querySelector('#bracketNavigation');
 if(!hint){
  viewport.id='publicBracketViewport';viewport.tabIndex=0;
  viewport.setAttribute('role','region');
  viewport.setAttribute('aria-label','Upper und Lower Bracket, seitlich scrollbar');
  hint=document.createElement('p');hint.id='bracketNavigation';hint.className='bracket-navigation';
  hint.textContent='Turnierbaum seitlich ziehen oder wischen.';
  viewport.before(hint);
  let gesture=null,suppressClick=false;
  viewport.addEventListener('pointerdown',event=>{
   suppressClick=false;
   if(event.pointerType!=='mouse'||event.button!==0||viewport.scrollWidth<=viewport.clientWidth+2)return;
   gesture={id:event.pointerId,x:event.clientX,left:viewport.scrollLeft,dragged:false};
  });
  viewport.addEventListener('pointermove',event=>{
   if(!gesture||event.pointerId!==gesture.id)return;
   const delta=event.clientX-gesture.x;
   if(!gesture.dragged&&Math.abs(delta)<6)return;
   if(!gesture.dragged){
    gesture.dragged=true;suppressClick=true;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
   }
   event.preventDefault();viewport.scrollLeft=gesture.left-delta;
  });
  const finish=event=>{
   if(!gesture||event.pointerId!==gesture.id)return;
   gesture=null;viewport.classList.remove('is-dragging');
   if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  };
  window.addEventListener('pointerup',finish);
  viewport.addEventListener('pointercancel',finish);
  viewport.addEventListener('lostpointercapture',finish);
  viewport.addEventListener('click',event=>{
   if(suppressClick&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  viewport.addEventListener('dragstart',event=>event.preventDefault());
 }
 const overflow=viewport.scrollWidth-viewport.clientWidth>2;
 hint.hidden=!overflow||!viewport.getClientRects().length;
 viewport.classList.toggle('bracket-draggable',overflow);
}
const renderBeforeWires=render;
function renderHomeResults(){const target=document.querySelector('#homeTournamentResults');if(!target)return;const markup=tournamentResultsMarkup('home');target.innerHTML=markup;target.classList.toggle('hidden',!markup);}
render=function(){renderBeforeWires();renderLoserSections();renderHomeResults();scheduleBracketWires();};
const tabBeforeWires=showTab;
showTab=function(tab){tabBeforeWires(tab);scheduleBracketWires();};
const adminBeforeWires=renderAdminBracket;
renderAdminBracket=function(){adminBeforeWires();renderLoserSections();scheduleBracketWires();};
const bracketResize=new ResizeObserver(scheduleBracketWires);
document.querySelectorAll('.bracket-shell,#adminBracket,.welcome-card').forEach(el=>bracketResize.observe(el));
window.addEventListener('resize',scheduleBracketWires);
document.fonts?.ready.then(scheduleBracketWires);


function waitingLosers(){
 const d=state.divisions[activeDivision];
 const entered=new Set((d.loserRounds||[]).flatMap(r=>r.matches.flatMap(m=>[m.a,m.b].filter(Boolean))));
 return [...new Set(d.rounds.flatMap(r=>r.matches.filter(m=>!m.bye&&m.winner).map(m=>m.winner===m.a?m.b:m.a)))].filter(id=>!entered.has(id));
}
function loserContent(adminMode){
 const d=state.divisions[activeDivision],rounds=d.loserRounds||[],waiting=waitingLosers();
 let content='<h3 class="bracket-row-label">Lower Bracket</h3>';
 if(rounds.length)content+='<div class="bracket loser-bracket">'+bracketMarkup(adminMode,true)+'</div>';
 else content+='<div class="bracket loser-bracket"><div class="round-col loser-placeholder" style="grid-column:1"><h3>Runde 1<span>Lower Bracket</span></h3><div class="empty">Noch nicht gestartet</div></div></div>';
 return content;
}
function tournamentResultsMarkup(context='bracket'){
 const d=state.divisions[activeDivision],final=d.grandFinal;
 const tournamentWinner=final?.winner||(!final?champion():null);
 if(!tournamentWinner)return '';
 const mainFinal=d.rounds.at(-1)?.matches?.[0],upperWinner=mainFinal?.winner||null;
 const upperRunnerUp=mainFinal&&!mainFinal.bye?(mainFinal.winner===mainFinal.a?mainFinal.b:mainFinal.a):null;
 const lowerFinal=(d.loserRounds||[]).at(-1)?.matches?.[0];
 const lowerRunnerUp=lowerFinal&&!lowerFinal.bye&&lowerFinal.winner?(lowerFinal.winner===lowerFinal.a?lowerFinal.b:lowerFinal.a):null;
 const finalRunnerUp=final?(final.winner===final.a?final.b:final.a):upperRunnerUp;
 const wins=new Map(d.players.map(p=>[p.id,0]));
 for(const round of [...(d.rounds||[]),...(d.loserRounds||[])])for(const m of round.matches||[])if(m.winner&&!m.bye)wins.set(m.winner,(wins.get(m.winner)||0)+1);
 if(final?.winner)wins.set(final.winner,(wins.get(final.winner)||0)+1);
 const elimination=new Map();
 for(const [ri,round] of (d.loserRounds||[]).entries())for(const m of round.matches||[])if(m.winner&&!m.bye){const out=m.winner===m.a?m.b:m.a;elimination.set(out,ri)}
 for(const [ri,round] of (d.rounds||[]).entries())for(const m of round.matches||[])if(m.winner&&!m.bye){const out=m.winner===m.a?m.b:m.a;if(!elimination.has(out))elimination.set(out,ri)}
 const ranked=[{id:tournamentWinner,place:1},{id:finalRunnerUp,place:2},{id:final?lowerRunnerUp:null,place:3},{id:final?upperRunnerUp:null,place:4}].filter((entry,i,all)=>entry.id&&all.findIndex(x=>x.id===entry.id)===i);
 const remaining=d.players.map(p=>p.id).filter(id=>!ranked.some(entry=>entry.id===id)).sort((a,b)=>(elimination.get(b)??-1)-(elimination.get(a)??-1)||(wins.get(b)||0)-(wins.get(a)||0)||playerName(a).localeCompare(playerName(b),'de'));
 let nextPlace=ranked.length?Math.max(...ranked.map(entry=>entry.place))+1:1;
 for(let i=0;i<remaining.length;){const round=elimination.get(remaining[i])??-1;let end=i+1;while(end<remaining.length&&(elimination.get(remaining[end])??-1)===round)end++;for(const id of remaining.slice(i,end))ranked.push({id,place:nextPlace});nextPlace++;i=end;}
 const podium=[1,2,3].map(place=>({place,entries:ranked.filter(entry=>entry.place===place)})).filter(group=>group.entries.length);
 const podiumMarkup=podium.map(group=>`<article class="podium-card podium-place-${group.place}"><span class="podium-medal">${group.place===1?'Turniersieger':group.place+'. Platz'}</span><div class="podium-names">${group.entries.map(entry=>`<span class="podium-entrant"><strong>${esc(playerName(entry.id))}</strong><small>${wins.get(entry.id)||0} ${wins.get(entry.id)===1?'Begegnung':'Begegnungen'} gewonnen</small></span>`).join('')}</div></article>`).join('');
 const additional=ranked.filter(entry=>entry.place>3);
 const more=additional.length?`<div class="ranking-table-wrap"><h3>Weitere Platzierungen</h3><table class="ranking-table"><thead><tr><th scope="col">Platz</th><th scope="col">Spieler</th><th scope="col">Begegnungen gewonnen</th></tr></thead><tbody>${additional.map(entry=>`<tr><td>${entry.place}</td><td>${esc(playerName(entry.id))}</td><td>${wins.get(entry.id)||0}</td></tr>`).join('')}</tbody></table></div>`:'';
 const titleId=context==='home'?'homeResultsTitle':'resultsTitle';
 return `<section class="tournament-results" aria-labelledby="${titleId}"><h2 id="${titleId}">Turnier beendet</h2><p>Abschließende Platzierungen nach dem Cross-Finale</p><div class="podium">${podiumMarkup}</div>${more}</section>`;
}
function renderLoserSections(){
 const target=document.querySelector('#tournamentBracketCard > .bracket-shell');
 if(!target.querySelector('.main-bracket-heading')){const heading=document.createElement('h3');heading.className='main-bracket-heading';heading.textContent='Upper Bracket';target.prepend(heading);}
 let section=document.querySelector('#loserPublic');
 if(!section){section=document.createElement('section');section.id='loserPublic';section.className='loser-section';target.appendChild(section);}
 section.hidden=!state.rounds.length;section.innerHTML=state.rounds.length?loserContent(false):'';
 target.querySelector(':scope > .grand-final')?.remove();
 const publicFinal=grandFinalMarkup(false);if(publicFinal)target.insertAdjacentHTML('afterbegin',publicFinal);
 const card=target.parentElement;
 card.querySelectorAll('.tournament-results').forEach(node=>node.remove());
 const results=tournamentResultsMarkup();if(results)card.insertAdjacentHTML('afterbegin',results);
 document.querySelector('#loserAdmin')?.remove();
 if(isAdmin&&!document.querySelector('#adminLayer').classList.contains('hidden')){
  const adminBracket=document.querySelector('#adminBracket');
  adminBracket.querySelector(':scope > .grand-final')?.remove();
  const box=document.createElement('section');box.id='loserAdmin';box.className='loser-section';box.innerHTML=loserContent(true);
  adminBracket.appendChild(box);
  const adminFinal=grandFinalMarkup(true);if(adminFinal)adminBracket.insertAdjacentHTML('afterbegin',adminFinal);
 }
}

async function setLoserWinner(round,match,id){
 const rounds=state.divisions[activeDivision].loserRounds||[];
 if(round<rounds.length-1&&!confirm('Ergebnis korrigieren und nachfolgende Lower-Bracket-Runden zurücksetzen?'))return;
 await command('loserWinner',{round,match,id},'Ergebnis im Lower Bracket gespeichert.');
}
function grandFinalMarkup(adminMode){
 const final=state.divisions[activeDivision].grandFinal;if(!final)return '';
 const waiting=!!final.startsAt&&final.startsAt>Date.now();
 const canSelect=!waiting&&(adminMode||isAdmin);
 const controls=[final.a,final.b].map(id=>'<button class="entrant '+(final.winner?(final.winner===id?'winner':'loser'):'pending')+'" '+(canSelect?'title="Sieger festlegen oder ändern" onclick="setGrandWinner(\''+id+'\')"':'')+'>'+esc(playerName(id))+'<span class="mark">'+(final.winner===id?'TURNIERSIEGER · 1. PLATZ':final.winner?'2. PLATZ':'Finale')+'</span></button>').join('');
 return '<div class="grand-final"><div class="grand-final-kicker">Pokémon TCG · Cross-Finale</div><h3>Sieger gegen Sieger</h3>'+(adminMode?'<p class="grand-final-admin-note">Auf einen Finalisten klicken, um den Sieger festzulegen'+(final.winner?' oder zu ändern':'')+'.</p>':'')+(waiting?'<div class="round-pause-divider grand-final-pausebar" role="status" aria-live="polite"><strong>10 Minuten Pause</strong><span class="pause-countdown">10:00 · Das Finale startet automatisch</span>'+(isAdmin?'<button type="button" class="pause-skip-button" onclick="skipPause()">Pause skippen</button>':'')+'</div>':'')+'<div class="grand-final-duel">'+controls+'</div></div>';
}
async function setGrandWinner(id){
 const final=state.divisions[activeDivision].grandFinal;
 if(final?.winner&&final.winner!==id&&!confirm('Sieger des Cross-Finales ändern? Die Platzierungen werden entsprechend aktualisiert.'))return;
 await command('grandWinner',{id},final?.winner?'Cross-Finale korrigiert.':'Turniersieger gespeichert.');
}

// Move the live bracket into a native modal: keep results and admin controls in sync.
let largeBracketAnchor=null,largeBracketFocus=null;
function openLargeBracket(){
 const dialog=document.querySelector('#largeBracketDialog'),card=document.querySelector('#tournamentBracketCard');
 if(dialog.open)return;
 largeBracketFocus=document.activeElement;largeBracketAnchor=document.createComment('bracket position');
 card.before(largeBracketAnchor);document.querySelector('#largeBracketContent').appendChild(card);
 document.querySelector('#largeBracketTitle').textContent=divisionLabel()+' · Turnierbaum in Großansicht';
 document.body.classList.add('large-bracket-open');dialog.showModal();scheduleBracketWires();
}
function closeLargeBracket(){document.querySelector('#largeBracketDialog').close();}
document.querySelector('#largeBracketDialog').addEventListener('close',()=>{
 const card=document.querySelector('#tournamentBracketCard');
 if(largeBracketAnchor){largeBracketAnchor.replaceWith(card);largeBracketAnchor=null;}
 card.style.zoom='';card.style.width='';
 document.body.classList.remove('large-bracket-open');scheduleBracketWires();
 largeBracketFocus?.focus();largeBracketFocus=null;
});

function fitLargeBracket(){
 const dialog=document.querySelector('#largeBracketDialog');if(!dialog?.open)return;
 const card=document.querySelector('#tournamentBracketCard'),content=document.querySelector('#largeBracketContent');
 const toolbar=dialog.querySelector('.large-bracket-toolbar');
 const availableWidth=Math.max(1,content.clientWidth);
 const availableHeight=Math.max(1,dialog.clientHeight-toolbar.offsetHeight-56);
 // Measure the full unscaled live tree, including all rounds and lower bracket.
 card.style.zoom='1';card.style.width='max-content';
 const shell=card.querySelector('.bracket-shell');
 const naturalWidth=Math.max(1,shell.scrollWidth+8);
 card.style.width=naturalWidth+'px';
 const naturalHeight=card.scrollHeight;
 const scale=Math.min(availableWidth/naturalWidth,availableHeight/Math.max(1,naturalHeight));
 card.style.zoom=String(scale);
}
