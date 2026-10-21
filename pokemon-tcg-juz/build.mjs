import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist',{recursive:true});
for(const name of ['index.html','sync-client.js','bracket-view.js','theme.css']) copyFileSync(name,'dist/'+name);
console.log('Website in dist vorbereitet.');
