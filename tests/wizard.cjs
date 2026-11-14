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
const voting = (p,rule,count,expires='never',purpose='effect')=>applyWizardVoting({target:p.id,rule,count:String(count),expires,purpose});
const town = (count,expires='never')=>applyWizardVoting({count:String(count),expires},true);
test('Legacy ghost votes, weighted dead ballots, and Banshee permission',()=>{
  const [,,p]=setup('wizard','wizard','day');
  p.alive=false;
  assert.equal(ghostVotes(p),1);
  voting(p,'ghost',4);
  voting(p,'wizardvote',3);
  assert.equal(votesPerHand(p),3);
  assert.equal(boardData().players[2].ghostVotes,4);
  setGhostVotes(p,0);
  assert.equal(votesPerHand(p),0);
  addRem(p,'banshee');
  assert.equal(votesPerHand(p),3);
  voting(p,'wizardvote','');
  assert.equal(votesPerHand(p),2);
  revivePlayer(p);
  assert.equal(ghostVotes(p),1);
});
test('Dead nomination allowance, extra nominations, and expiry',()=>{
  const [d,,p,q,r]=setup('wizard','wizard','day');
  p.alive=false;
  voting(p,'wizardnom',2,'dusk','price');
  assert.match(S.log[0].t,/Wizard price/);
  for(const target of [d,q]){
    ui.pick={kind:'nominator'}; resolvePick(p);
    assert.equal(ui.pick.kind,'nominee');
    resolvePick(target);
  }
  ui.pick={kind:'nominator'}; resolvePick(p);
  assert.equal(ui.pick.kind,'nominator');
  assert.match(ui.msg,/already nominated/);
  voting(r,'wizardnom',0,'dawn'); resolvePick(r);
  assert.match(ui.msg,/cannot nominate/);
  purge('dusk');
  assert.equal(voteRule(p,'wizardnom'),undefined);
  assert.equal(voteRule(r,'wizardnom'),0);
  purge('dawn');
  assert.equal(voteRule(r,'wizardnom'),undefined);
});
test('Stacked extra lives absorb ordinary deaths and forced deaths bypass them',()=>{
  const [,,p]=setup('wizard','wizard','day');
  effect(p,{reminder:'wizardlife'});
  effect(p,{reminder:'wizardlife',purpose:'price'});
  assert.equal(kill(p,'test'),false);
  assert.equal(kill(p,'test again'),false);
  assert.equal(kill(p,'third time'),true);
  revivePlayer(p); effect(p,{reminder:'wizardlife'});
  assert.equal(kill(p,'forced',true),true);
});
test('240 weighted ballot, threshold, tie, reload and undo scenarios',()=>{
  for(const size of [5,8,12,15]) for(let weight=1;weight<=60;weight++){
    const [d,w,p,q,r]=setup('wizard','wizard','day',size);
    voting(d,'wizardvote',weight,'dusk');
    voting(w,'wizardvote',weight);
    voting(p,'wizardvote',0);
    assert.equal(town(weight,'dusk'),undefined);
    assert.equal(boardData().needed,weight);
    S.day.noms=[{nominee:q.id,nominator:p.id,votes:null},{nominee:r.id,nominator:w.id,votes:null}];
    ui.pick={kind:'voters',i:0,chosen:[]};
    resolvePick(p);
    assert.equal(S.day.noms[0].votes,null);
    resolvePick(d);
    assert.equal(blockOf().id,q.id);
    assert.equal(demonVoted(),true);
    voting(d,'wizardvote',0);
    assert.equal(blockOf().votes,weight,'earlier ballots retain their original weight');
    ui.pick={kind:'voters',i:1,chosen:[]};
    resolvePick(w);
    assert.equal(blockOf().id,null);
    assert.equal(blockOf().votes,weight);
    assert.equal(load().day.noms[1].votes,weight);
    resolvePick(w);
    assert.equal(blockOf().id,q.id);
    S=JSON.parse(undo.pop().s);
    assert.equal(blockOf().id,null);
    purge('dusk');
    assert.equal(needed(),Math.ceil(size/2));
  }
});
test('Scheduled events survive reload and wait for explicit approval',()=>{
  for(const trigger of ['dawn','dusk','death','execution']){
    for(let i=0;i<30;i++){
      const [,,p,q]=setup('wizard','wizard',trigger==='dawn'?'night':'day');
      const fields={kind:'batch',trigger,triggerTarget:q.id,effects:[{target:p.id,life:'',character:'monk',alignment:''}]};
      assert.equal(queueWizardItem(fields),undefined);
      S=load();
      if(trigger==='death'){wizardTrigger('death',p.id); assert.equal(S.wizardQueue[0].status,'waiting'); kill(P(q.id),'test',true);}
      if(trigger==='execution') execute(P(q.id));
      if(trigger==='dawn') toDay();
      if(trigger==='dusk') toNight();
      const item=S.wizardQueue[0];
      assert.equal(item.status,'ready');
      assert.equal(P(p.id).role,'chef');
      assert.equal(wizardBatchError(item.effects),undefined);
      const before=JSON.stringify(S);
      commit(()=>{item.status='done';applyWizardEffects(item.effects);});
      assert.equal(P(p.id).role,'monk');
      assert.equal(undo.at(-1).s,before);
    }
  }
});
test('Demon swap and the price apply atomically, with one undo',()=>{
  const [d,w,p]=setup();
  const effects=[{target:d.id,life:'',character:'wizard',alignment:''},{target:w.id,life:'',character:'imp',alignment:''},
    {target:p.id,rule:'ghost',count:'3',expires:'never',purpose:'price'}];
  assert.match(wizardBatchError(effects.slice(0,1)),/replacement Demon/);
  assert.equal(wizardBatchError(effects),undefined);
  const before=JSON.stringify(S);
  commit(()=>applyWizardEffects(effects));
  assert.equal(S.winner,null);
  assert.equal(w.role,'imp');
  assert.equal(d.role,'wizard');
  assert.equal(ghostVotes(p),3);
  assert.equal(undo.at(-1).s,before);
});
test('Table-wide Tinker, suppression and retained dead ability expire correctly',()=>{
  const [,,p]=setup();
  wizardAbilityRule({rule:'grant',character:'tinker',everyone:'yes',expires:'dusk'});
  assert.equal(steps().find(s=>s.k==='tinker').actors.length,S.players.length);
  wizardAbilityRule({rule:'mute',target:p.id,expires:'dawn'});
  assert.equal(hasAbility(p,'tinker'),false);
  assert.equal(actorsFor('tinker').includes(p),false);
  purge('dawn'); assert.equal(hasAbility(p,'tinker'),true);
  wizardAbilityRule({rule:'keep',target:p.id,expires:'dusk'});
  p.alive=false;
  assert.equal(retainedAbility(p),true);
  purge('dusk');
  assert.equal(retainedAbility(p),false);
  assert.equal(actorsFor('tinker').length,0);
});
test('Bypass is consumed once, tied favorite is selected, and the second execution is bounded',()=>{
  const [,,a,b,c,d]=setup('wizard','wizard','day');
  assert.equal(wizardException({rule:'bypass'}),undefined);
  nominate(a,b); nominate(c,d);
  const [first,second]=S.day.noms;
  assert.equal(first.bypass,true);
  assert.equal(second.bypass,false);
  first.votes=1; second.votes=1;
  assert.equal(blockOf().id,b.id);
  second.votes=4; first.votes=4;
  assert.equal(blockOf().id,null);
  wizardException({rule:'tie',target:d.id});
  assert.equal(blockOf().id,d.id);
  execute(d);
  assert.equal(wizardException({rule:'extra'}),undefined);
  assert.equal(blockOf(),null);
  execute(b);
  assert.deepEqual(S.day.executions,[d.id,b.id]);
  assert.match(wizardException({rule:'extra'}),/first execution/);
});
test('Scheduled private card contents stay off player board and game record',()=>{
  const [,,p]=setup();
  queueWizardItem({kind:'card',trigger:'now',recipient:p.id,message:'secret message',include:'grimoire'});
  S=load();
  assert.equal(S.wizardQueue[0].message,'secret message');
  assert.equal(S.wizardQueue[0].status,'ready');
  S.revealed=true;
  assert.doesNotMatch(JSON.stringify(boardData()),/secret message/);
  assert.doesNotMatch(JSON.stringify(makeRecord()),/secret message/);
});
console.log(checks+' Wizard scenario groups passed');
`,ctx);
