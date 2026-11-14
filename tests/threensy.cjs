// Run with node tests/threensy.cjs. Plays every Threensyville deal and seating through night 1 and the day-1 vote.
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
render=()=>{};
let count=0;
function test(name,fn){fn(); count++;}
const TFS=['snakecharmer','steward','mayor'];
const deals=[];
for(const tf of TFS){
  deals.push({tf,out:'mutant'});
  for(const shown of TFS.filter(x=>x!==tf)) deals.push({tf,out:'drunk',shown});
}
const seatings=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function setup(d,seat){
  S=fresh(3); S.script='threensy'; S.stage='game'; S.phase={kind:'night',n:1};
  S.flags={}; S.night={changed:[]}; S.lastDay={}; S.done={}; S.picked={}; S.pickedIds={}; ui.form={}; ui.rulings=[]; ui.pick=null;
  const roles=[d.tf,d.out,'imp'];
  S.players.forEach((p,i)=>{ p.role=roles[seat[i]]; p.shown=p.role==='drunk'?d.shown:null; });
  const by=k=>S.players.find(p=>p.role===k);
  return {tf:by(d.tf), out:by(d.out), imp:by('imp')};
}
function vote(ids){ toDay(); ui.show=null; recordThreensyVotes(ids.map(p=>p.id)); }

test('setup is 3 players: 1 Townsfolk, 1 Outsider, 1 Demon',()=>{
  S=fresh(3); S.script='threensy';
  assert.deepEqual([...playerCounts()],[3]); assert.deepEqual([...DIST[3]],[1,1,0,1]);
  assert.equal(bluffCount(),0);
});

for(const d of deals) for(const seat of seatings){
  const tag=JSON.stringify(d)+seat;
  test('night 1 steps '+tag,()=>{
    const {tf,out}=setup(d,seat);
    const ks=steps().filter(s=>!s.skip).map(s=>s.k);
    assert.ok(!ks.includes('minioninfo') && !ks.includes('demoninfo'),tag);
    for(const k of ['snakecharmer','steward']){
      const wakes=[tf,out].some(p=>wake(p)===k);
      assert.equal(ks.includes(k),wakes,tag+' '+k);
    }
    if(ks.includes('snakecharmer') && ks.includes('steward')) assert.ok(ks.indexOf('snakecharmer')<ks.indexOf('steward'));
    assert.ok(!ks.includes('imp'),'Imp does not kill night 1');
  });
  test('two votes on the Imp: good wins '+tag,()=>{
    const {tf,out,imp}=setup(d,seat); vote([imp,imp,tf]);
    assert.equal(imp.alive,false); assert.match(S.winner||'',/Good wins/,tag);
  });
  for(const victim of ['tf','out']) test('two votes on good '+victim+': evil wins '+tag,()=>{
    const ps=setup(d,seat); vote([ps[victim],ps[victim],ps.imp]);
    assert.equal(ps[victim].alive,false); assert.match(S.winner||'',/Evil wins/,tag);
  });
  test('split vote: no execution, Mayor decides '+tag,()=>{
    const {tf,out,imp}=setup(d,seat); vote([tf,out,imp]);
    assert.ok(tf.alive && out.alive && imp.alive); assert.equal(S.winner,null);
    toNight();
    const soberMayor=tf.role==='mayor';
    if(soberMayor) assert.match(S.winner||'',/Good wins/,tag);
    else {
      assert.equal(S.winner,null,tag);
      demonAttack(imp,tf); checkWin();
      assert.match(S.winner||'',/Evil wins/,tag);
    }
  });
}

test('Snake Charmer on the Imp swaps characters and teams',()=>{
  const {tf,imp}=setup({tf:'snakecharmer',out:'mutant'},[0,1,2]);
  act('snakecharmer',tf,[imp],{});
  assert.equal(tf.role,'imp'); assert.equal(imp.role,'snakecharmer');
  assert.ok(isEvil(tf)); assert.ok(!isEvil(imp));
});
test('Drunk Snake Charmer on the Imp swaps nothing',()=>{
  const {out,imp}=setup({tf:'mayor',out:'drunk',shown:'snakecharmer'},[0,1,2]);
  act('snakecharmer',out,[imp],{});
  assert.equal(out.role,'drunk'); assert.equal(imp.role,'imp');
});
test('Steward suggestions point only at the other good player',()=>{
  const {tf,out,imp}=setup({tf:'steward',out:'mutant'},[0,1,2]);
  const sg=infoSuggest('steward',tf);
  assert.deepEqual(sg.T.map(x=>x.label),[out.name]); assert.deepEqual(sg.F.map(x=>x.label),[imp.name]);
});
test('a vote is recorded once and needs all three ballots',()=>{
  const {tf,out,imp}=setup({tf:'mayor',out:'mutant'},[0,1,2]); toDay();
  recordThreensyVotes([imp.id,imp.id]); assert.ok(imp.alive);
  recordThreensyVotes([tf.id,out.id,imp.id]); recordThreensyVotes([imp.id,imp.id,imp.id]); assert.ok(imp.alive);
});
console.log(count+' Threensyville scenarios passed');
`,ctx);
