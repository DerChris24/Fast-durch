import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
for(const name of ['index.html','dist/index.html','local-demo/index.html']){
 const html=read(name),rules=html.match(/<section class="hidden" id="rulesView">([\s\S]*?)<\/section>/)[1];
 assert.equal((rules.match(/role="listitem"/g)||[]).length,3);
 for(const [i,title] of ['Standardformat','Zwei Turniere','Zweite Chance'].entries())assert(rules.includes('<span aria-hidden="true">'+(i+1)+'</span><div><h3>'+title+'</h3>'));
 for(const text of ['Regelzeichen','regelmäßige Rotation','jeweils mit eigenem Turnierbaum','Je nach Anmeldungen','Hoffnungsrunde','Hauptrunde'])assert(rules.includes(text));
 for(const text of ['Dein Ziel','Deck und Startaufstellung','So l&auml;uft ein Zug','Kampf','Preiskarten','Loser Bracket','Upper Bracket'])assert(!rules.includes(text));
 const first=rules.match(/<article class="rulebook-step" role="listitem">[\s\S]*?<\/article>/)[0];
 for(const text of ['Regelzeichen unten links','2026 sind H, I, J','später veröffentlichte Regelzeichen','G ist rotiert','zwei Wochen nach Veröffentlichung turnierlegal','Ältere Nachdrucke','dieselbe Karte mit aktuell zugelassenem Regelzeichen','aktuelle Kartentext','offizielle Errata'])assert(first.includes(text));
 for(const href of ['https://www.pokemon.com/de/news/ankuendigung-zum-turnuswechsel-im-standardformat-des-pokemon-sammelkartenspiels-2026','https://assets.pokemon.com/assets/cms2-de-de/pdf/trading-card-game/rulebook/svi_rulebook_de.pdf']){assert(first.includes(href));assert.equal(rules.split(href).length,2);}
 assert(first.includes('Pok&eacute;mon: Standardrotation 2026 &rarr;'));
 assert(!rules.includes('class="standard-legal"'));assert(!rules.includes('Welche Karten sind im Standard erlaubt?'));
 assert.equal((rules.match(/<a /g)||[]).length,2);
 assert(rules.includes('<h3>Zwei Turniere</h3><p>Junior:innen und Erwachsene spielen getrennt, jeweils mit eigenem Turnierbaum. Je nach Anmeldungen finden die Turniere parallel statt.</p>'));
 assert(rules.includes('<h3>Zweite Chance</h3><p>Nach einer Niederlage geht es in der Hoffnungsrunde weiter. Deren Sieger:in trifft im Finale auf die Siegerin oder den Sieger der Hauptrunde.</p>'));

}
assert(read('theme.css').includes('#rulesView > .section-head{justify-content:flex-start;text-align:left}'));
assert.equal(read('theme.css'),read('dist/theme.css'));
assert(read('local-demo/index.html').includes('#rulesView > .section-head{justify-content:flex-start;text-align:left}'));
console.log('PASS: Three numbered tournament rules, old learning points removed, legality and both original links only within rule 1, heading left aligned, source/dist/demo consistent.');
