// Run with node tests/rules.cjs. Exercise the production rules, without a DOM.
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync('index.html','utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1].split('\n(async ()=>{')[0];
const ctx = vm.createContext({console, assert, setInterval(){}, setTimeout(){},
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},
  document:{addEventListener(){},querySelector(){return null}},
  window:{addEventListener(){}}, navigator:{},location:{hash:''}});
vm.runInContext(source,ctx);
vm.runInContext(`
function setup(demon='pukka',shown=demon,n=1){
 S=fresh(8); S.stage='game'; S.script='pukki'; S.phase={kind:'night',n};
 S.flags={}; S.night={changed:[]}; S.lastDay={};
 S.players.forEach((p,i)=>{p.role=i===0?demon:i===1?'lunatic':i===2?'poisoner':'chef'});
 S.players[1].shown=shown; ui.form={}; ui.rulings=[];
 return S.players;
}
let count=0;
function test(name,fn){fn(); count++; console.log('PASS',name)}
test('Pukka Lunatic chooses on night one before Pukka',()=>{
 setup(); const ks=steps().filter(s=>!s.skip).map(s=>s.k);
 assert.ok(ks.indexOf('lunatic')<ks.indexOf('pukka'));
 assert.equal(stepDef('lunatic').pick,'lunatic'); assert.match(stepDef('lunatic').choose,/poison/);
 assert.match(stepBody(steps().find(s=>s.k==='lunatic')),/Click who they point at/);
});
test('all supported Demon disguises use correct first-night actions',()=>{
 for(const k of Object.keys(R).filter(k=>R[k].team==='demon')){
  setup(k); assert.equal(!!stepDef('lunatic').pick,k==='pukka',k);
 }
});
test('Leviathan and Legion Lunatics never receive a kill picker',()=>{
 for(const k of ['leviathan','legion']){setup(k,k,2); const st=stepDef('lunatic');
 assert.equal(st.pick,undefined); assert.equal(st.choose,undefined); assert.equal(demonChoose(k),null);}
});
test('Leviathan never receives a kill picker on any night',()=>{
 for(let n=1;n<=5;n++){setup('leviathan','leviathan',n);assert.equal(stepDef('leviathan').pick,undefined);}
 const before=S.players.filter(p=>p.alive).length; demonAttack(S.players[0],S.players[3]);
 assert.equal(S.players.filter(p=>p.alive).length,before);
});
test('Al-Hadikhia Lunatic records three choices without effects',()=>{
 const ps=setup('alhadikhia','alhadikhia',2); assert.equal(stepDef('lunatic').n,3);
 act('lunatic',ps[1],ps.slice(3,6),{}); record('lunatic',ps.slice(3,6));
 assert.equal(S.pickedIds.lunatic.length,3); assert.ok(ps.every(p=>p.alive));
 assert.ok(S.log[0].t.includes(ps[5].name));
});
test('Lunatic fake Pukka choice never poisons or kills',()=>{
 const ps=setup(); act('lunatic',ps[1],[ps[3]],{});
 assert.ok(ps[3].alive); assert.equal(ps[3].rem.length,0);
});
test('Zombuul Lunatic does not attack after a daytime death',()=>{
 setup('zombuul','zombuul',2); S.lastDay.died=true;
 assert.equal(steps().find(s=>s.k==='lunatic').skip,'Someone died today');
});
test('Lycanthrope prevents kills but does not suppress Demon wake',()=>{
 for(const k of KILLERS.concat(['pukka','alhadikhia'])){
  setup(k,k,2); S.night.lyc=true;
  assert.equal(steps().find(s=>s.k===k).skip,null,k);
 }
 const ps=setup('imp','imp',2); S.night.lyc=true; act('imp',ps[0],[ps[3]],{});
 assert.ok(ps[3].alive);
});
test('impaired Poisoner does not poison a target',()=>{
 const ps=setup(); addRem(ps[2],'drunk'); act('poisoner',ps[2],[ps[3]],{});
 assert.equal(has(ps[3],'poisoned'),false);
});
test('sober Poisoner still poisons',()=>{
 const ps=setup(); act('poisoner',ps[2],[ps[3]],{}); assert.ok(has(ps[3],'poisoned'));
});
test('Lycanthrope also blocks Al-Hadikhia resolution deaths',()=>{
 const ps=setup('alhadikhia','alhadikhia',2); S.night.lyc=true;
 demonHit(ps[0],ps[3]); assert.ok(ps[3].alive);
});
test('Chambermaid does not count Leviathan reminders as waking',()=>{
 const ps=setup('leviathan','leviathan',2); S.pickedIds={chambermaid:[ps[0].id,ps[1].id]};
 assert.equal(truthFor('chambermaid',ps[3]),0);
});
console.log(count+' rule scenarios passed');
`,ctx);
