import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const source=read('index.html'),old=read('../html-preview/index.html');
const art=s=>s.match(/<svg class="pending-bracket-art"[\s\S]*?<\/svg>/)[0];
assert.equal(art(source),art(old));
for(const rule of ['tournament-pending-home','pending-bracket-art','pending-copy'])assert(source.includes('.'+rule));
const start=source.indexOf('function render(){'),end=source.indexOf('\nfunction ',start);
const render=source.slice(start,end);
const nodes=new Map();function node(){const classes=new Set();return {innerHTML:'',style:{},children:[],classList:{toggle(c,on){if(on)classes.add(c);else classes.delete(c)},add:c=>classes.add(c),contains:c=>classes.has(c)},replaceChildren(){}};}
const document={querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);}};
document.querySelector('#adminLayer').classList.add('hidden');
const divisions={junior:{players:[],rounds:[]},adult:{players:[],rounds:[]}};
const state={divisions,get rounds(){return divisions[ctx.activeDivision].rounds},get players(){return divisions[ctx.activeDivision].players}};
const ctx={esc:s=>s,document,state,activeDivision:'junior',editingPlayerId:null,isAdmin:false,tabsMarkup:()=>'',prettyDate:()=>'',divisionLabel:()=>ctx.activeDivision,bracketMarkup:()=>'<div>REAL '+ctx.activeDivision+'</div>'};
vm.createContext(ctx);vm.runInContext(render,ctx);
function check(group,started){ctx.activeDivision=group;const before=JSON.stringify(divisions);vm.runInContext('render()',ctx);assert.equal(document.querySelector('#tournamentPendingTree').classList.contains('hidden'),started);assert.equal(document.querySelector('#tournamentBracketCard').classList.contains('hidden'),!started);assert.equal(document.querySelector('#bracket').innerHTML,started?'<div>REAL '+group+'</div>':'');assert.equal(JSON.stringify(divisions),before);}
check('junior',false);check('adult',false);
divisions.junior.players=[{id:'j1',name:'Junior'}];divisions.junior.rounds=[{matches:[{a:'j1',bye:true}]}];
check('junior',true);check('adult',false);check('junior',true);
divisions.adult.players=[{id:'a1',name:'Erwachsen'}];divisions.adult.rounds=[{matches:[{a:'a1',bye:true}]}];check('adult',true);check('junior',true);
divisions.junior.rounds=[];check('junior',false);check('adult',true);
for(const name of ['index.html','sync-client.js','theme.css','bracket-view.js'])assert.equal(read(name),read('dist/'+name));
const demo=read('local-demo/index.html');assert.equal(art(demo),art(old));assert(demo.includes(render));assert(!source.includes('initialBracketMarkup'));assert(!demo.includes('initialBracketMarkup'));
console.log('PASS: Original SVG preserved byte-for-byte; actual public render before/after start for both groups, mixed start states, group switches and reset; no state mutation or fake pairings; demo and dist consistent.');
