import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
for(const name of ['index.html','dist/index.html','local-demo/index.html']){
 const rules=read(name).match(/<section class="hidden" id="rulesView">([\s\S]*?)<\/section>/)[1];
 const kids=rules.match(/<article[^>]*rules-kids[\s\S]*?<\/article>/)[0],adults=rules.match(/<article[^>]*rules-adults[\s\S]*?<\/article>/)[0],shared=rules.match(/<article[^>]*rules-shared[\s\S]*?<\/article>/)[0];
 assert(kids.includes('Regelwerk für Kids'));assert(kids.includes('geben wir noch bekannt'));assert(!kids.includes('Standard'));assert(!kids.includes('href='));
 assert(adults.includes('Regelwerk für Erwachsene'));for(const text of ['Standardformat','2026 sind H, I, J','G ist rotiert','zwei Wochen','Ältere Nachdrucke','Errata','Standardrotation 2026'])assert(adults.includes(text));assert.equal((adults.match(/<a /g)||[]).length,2);assert.equal((rules.match(/<a /g)||[]).length,2);
 assert(shared.includes('für Kids und Erwachsene'));for(const text of ['Hauptrunde','Hoffnungsrunde','ersten Niederlage','Finale'])assert(shared.includes(text));assert.equal((shared.match(/role="listitem"/g)||[]).length,3);assert(!shared.includes('Standardformat'));assert(!rules.includes('Zwei Turniere'));assert(!rules.includes('Junior:innen und Erwachsene spielen getrennt'));
 for(const tag of ['div','article'])assert.equal((rules.match(new RegExp('<'+tag+'(?: |>)','g'))||[]).length,(rules.match(new RegExp('</'+tag+'>','g'))||[]).length);
}
assert(read('theme.css').includes('#rulesView > .section-head{justify-content:flex-start;text-align:left}'));assert.equal(read('theme.css'),read('dist/theme.css'));
console.log('PASS: Separate kids placeholder/adult Standard rules, both original adult links, shared tournament flow, no obsolete two-tournament rule, balanced markup and consistent builds.');
