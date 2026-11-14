// Run with node tests/wizard.cjs. Uses the same game logic as the Grimoire.
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('\n(async ()=>{')[0];
const storage = new Map();
const ctx = vm.createContext({console, assert, setInterval(){}, setTimeout(){},
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{addEventListener(){},querySelector(){return null}},
  window:{addEventListener(){}}, navigator:{}, location:{hash:''}});
vm.runInContext(source,ctx);
vm.runInContext(`
render = ()=>{};
let checks=0;
function setup(script='wizard',role='wizard',kind='night',size=8){
  S = fresh(8);
  S.players = Array.from({length:size},(_,i)=>({id:String(i),name:'Player '+i,role:i===0?'imp':i===1?role:'chef',alive:true,ghost:true,rem:[]}));
  Object.assign(S,{stage:'game',script,phase:{kind,n:1},night:{changed:[]},flags:{},pending:[],day:{noms:[]}});
  Object.assign(ui,{pick:null,rulings:[],form:{},show:null,msg:null});
  undo = [];
  return S.players;
}
function test(name,fn){fn(); checks++; console.log('PASS',name);}
const wish = (p,ruling='granted')=>recordWish({actor:p.id,wish:'Someone returns',ruling,price:'A trade',clue:'The bell rings twice'});
const effect = (p,fields)=>applyWizardEffect({target:p.id,life:'',character:'',alignment:'',...fields});
test('Activation follows the role across scripts, including custom and legacy saves',()=>{
  for(const script of [...Object.keys(SCRIPTS),'custom']){
    const [,w]=setup(script,'poisoner');
    assert.equal(wizardMode(),false,script);
    w.role='wizard';
    assert.equal(wizardMode(),true,script);
    assert.equal(steps().find(s=>s.k==='wizard').actors[0],w);
    S.stage='reveal';
    assert.equal(wizardMode(),false);
  }
});
test('Real gained ability qualifies and a disguise does not',()=>{
  const [,w]=setup('wizard','marionette');
  w.shown='wizard';
  assert.equal(wizardMode(),false);
  assert.equal(steps().some(s=>s.k==='wizard'),false);
  w.role='alchemist'; w.shown=null; w.as='wizard';
  assert.equal(canWish(w),true);
});
test('Decline and retry, grant once, reload, then reject a duplicate',()=>{
  const [,w]=setup();
  assert.equal(wish(w,'retry'),undefined);
  assert.equal(canWish(w),true);
  assert.equal(wish(w),undefined);
  S=load();
  assert.equal(S.wishes.length,2);
  assert.equal(S.wishes[1].price,'A trade');
  assert.equal(S.wishes[1].clue,'The bell rings twice');
  assert.equal(steps().some(s=>s.k==='wizard'),false);
  assert.match(wish(P(w.id)),/cannot/);
  assert.equal(S.wishes.length,2);
});
test('Poison, death, and legacy used tokens block wishes',()=>{
  const [,w]=setup();
  addRem(w,'poisoned'); assert.match(wish(w),/cannot/);
  w.rem=[]; w.alive=false; assert.match(wish(w),/cannot/);
  w.alive=true; addRem(w,'noability'); assert.match(wish(w),/cannot/);
  w.rem=[]; assert.equal(wish(w,'spent'),undefined);
  assert.equal(canWish(w),false);
});
test('Granted wish continues after Wizard dies or changes character',()=>{
  const [,w,t]=setup();
  wish(w);
  assert.equal(effect(w,{character:'fanggu'}),undefined);
  assert.equal(effect(t,{character:'monk'}),undefined);
  assert.equal(wizardHolders().length,0);
  assert.equal(wizardMode(),true);
  S.phase.n=2;
  assert.ok(steps().some(s=>s.k==='monk'));
  assert.equal(effect(w,{life:'kill'}),undefined);
  assert.equal(wizardMode(),true);
});
test('Resurrect the dead or publicly dead Zombuul, clear dawn reports and restore voting',()=>{
  for(const fake of [false,true]){
    const [d,,t]=setup();
    const p = fake ? d : t;
    if(fake) p.role='zombuul';
    p.alive=fake; p.fake=fake; p.ghost=false;
    addRem(p,'diedtonight'); addRem(p,'zombfirst');
    assert.equal(effect(p,{life:'revive'}),undefined);
    assert.equal(p.alive,true); assert.equal(p.fake,false); assert.equal(p.ghost,true);
    assert.equal(has(p,'zombfirst'),false);
    assert.equal(has(p,'diedtonight'),false);
    toDay(); assert.equal(S.news,'Nobody died last night.');
  }
});
test('Character change preserves alignment unless selected, updates night order, clears old ability',()=>{
  const [,,p]=setup('wizard','wizard','night');
  S.phase.n=2;
  addRem(p,'noability'); addRem(p,'drunk');
  assert.equal(effect(p,{character:'poisoner'}),undefined);
  assert.equal(isEvil(p),false);
  assert.equal(has(p,'noability'),false);
  assert.equal(has(p,'drunk'),true);
  assert.ok(steps().some(s=>s.k==='poisoner'));
  assert.equal(effect(p,{alignment:'evil'}),undefined);
  assert.equal(isEvil(p),true);
});
test('Replace the last Demon without accidentally ending the game',()=>{
  const [d,,p]=setup();
  assert.match(effect(d,{character:'chef'}),/replacement Demon/);
  assert.equal(d.role,'imp');
  assert.equal(effect(p,{character:'fanggu',alignment:'evil'}),undefined);
  assert.equal(effect(d,{character:'chef'}),undefined);
  assert.equal(S.winner,null);
  assert.equal(alive().filter(isDemon).length,1);
});
test('Public state excludes wish text and private notes, including after reveal',()=>{
  const [,w]=setup();
  wish(w);
  S.log.unshift({at:phaseLabel(),t:'private-password',private:true});
  for(const revealed of [false,true]){
    S.revealed=revealed;
    assert.doesNotMatch(JSON.stringify(boardData()),/Someone returns|A trade|The bell rings twice|private-password/);
  }
});
test('480 repeated changes across day/night and table sizes survive save and undo',()=>{
  for(const size of [5,8,12,15]) for(const kind of ['day','night']){
    for(let i=0;i<60;i++){
      const [,w,...rest]=setup('wizard','wizard',kind,size);
      const p=rest[i%rest.length];
      wish(w);
      const before=JSON.stringify(S);
      const changes={character:['monk','baron','lunatic','drunk'][i%4],alignment:i%2?'evil':'good',life:'kill'};
      assert.equal(effect(p,changes),undefined);
      const saved=load();
      assert.equal(saved.players.find(q=>q.id===p.id).alive,false);
      assert.equal(saved.players.find(q=>q.id===p.id).role,changes.character);
      assert.equal(undo.pop().s,before);
      S=saved;
      assert.equal(effect(P(p.id),{life:'revive'}),undefined);
      assert.ok(P(p.id).alive);
    }
  }
});
console.log(checks+' Wizard scenario groups passed');
`,ctx);
