import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
for(const file of ['index.html','sync-client.js','theme.css','bracket-view.js'])assert.equal(read(file),read('dist/'+file),file+' differs from dist');
const css=read('theme.css'),html=read('index.html'),demo=read('local-demo/index.html');assert(demo.includes(css));
const allowed=['#ef5e66','#9c61cf','#4585eb','#f6cb4f','#fffaf0'];let balls=0;
for(const [,data] of css.matchAll(/url\("data:image\/svg\+xml,([^"\r\n]+)"\)/g)){const svg=decodeURIComponent(data);assert(svg.startsWith('<svg'));assert(svg.endsWith('</svg>'));assert(allowed.some(c=>svg.includes(c)));for(const forbidden of ['#3897df','#70b970','#466ba3','#3f7756','#46b8c0'])assert(!svg.includes(forbidden));balls++;}assert(balls>=16);
assert(html.includes('html[data-theme="dark"] .main{background:transparent'));assert(css.includes('pointer-events:none'));assert(css.includes('prefers-reduced-motion'));assert(css.includes('@media(max-width:600px)'));
for(const page of [html,demo]){assert.equal((page.match(/id="largeBracketDialog"/g)||[]).length,1);assert.equal((page.match(/class="page-ball-backdrop"/g)||[]).length,1);assert(!page.includes('bracketFullscreenButton'));assert(!page.includes('class="page-ball-art"'));for(const [,body] of page.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(body);}
assert(!html.includes('TCGCOMMUNITYLAUF'));assert(demo.includes('TCGCOMMUNITYLAUF'));assert(css.includes('#largeBracketDialog #tournamentBracketCard>.tournament-results'));assert(css.includes('html .footer{align-items:center;'));
console.log('PASS: Source/dist/demo consistency, SVG background validity and only five requested ball types, transparent dark canvas, responsive/reduced-motion rules, unique dialogs/backgrounds, correct online/demo separation and embedded script syntax.');
