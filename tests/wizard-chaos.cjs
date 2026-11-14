// Seeded simulations of deliberately unusual Wizard games.
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('\n(async ()=>{')[0];
const store = new Map(), handlers = {};
const ctx = vm.createContext({console,assert,setInterval(){},setTimeout(){},
  localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  document:{addEventListener(k,fn){(handlers[k] ||= []).push(fn);},querySelector(){return null}},
  window:{addEventListener(){}},navigator:{},location:{hash:''},handlers});
vm.runInContext(source,ctx);
vm.runInContext(`
let seed=1, appSeed=91823;
Math.random=()=>{appSeed=(Math.imul(appSeed,1664525)+1013904223)>>>0;return appSeed/4294967296;};
const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const draw=xs=>xs[next(xs.length)];
const chars=Object.keys(R).filter(k=>TEAMS[R[k].team]);
const demons=chars.filter(k=>R[k].team==='demon');
const scripts=Object.keys(SCRIPTS);
const range=[5,6,7,8,10,12,15];
const casts=[
  ['zombuul','wizard','fool','scarletwoman','moonchild','klutz','banshee'],
  ['fanggu','wizard','saint','drunk','cannibal','barber','sweetheart'],
  ['vigormortis','wizard','poisoner','pithag','minstrel','alchemist','philosopher'],
  ['imp','wizard','wizard','psychopath','virgin','legion','flowergirl'],
  ['leviathan','wizard','goblin','eviltwin','mayor','recluse','vortox'],
  ['alhadikhia','wizard','innkeeper','soldier','lunatic','professor','ravenkeeper']
];
let turns=0, renders=0, edits=0, reloads=0, forcedDeaths=0, phases=0;
function inspect(){
  const ids=S.players.map(p=>p.id);
  assert.doesNotMatch(JSON.stringify(boardData()),/Private chaos clue/);
  assert.ok((S.wizardQueue||[]).every(item=>['waiting','ready','done','skipped','revised'].includes(item.status)));
  assert.ok((S.pending||[]).every(item=>ids.includes(item.actor)));
  assert.equal(new Set(ids).size,ids.length);
  for(const p of S.players){
    assert.ok(R[p.role]);
    assert.ok(Number.isInteger(ghostVotes(p)) && ghostVotes(p)>=0);
    assert.ok(!p.fake || p.alive);
  }
  if(night()){
    nightHTML();
    for(const step of steps().filter(s=>!s.skip)) stepBody(step);
  }else dayHTML();
  if(wizardMode()) wizardHTML();
  centerHTML(); overlayHTML(); dockHTML(); cardTown(); boardData();
  renders++;
}
render=()=>{};
function event(act,params={}){
  const el={dataset:{act,...params}, classList:{contains:()=>false}};
  handlers.click[0]({target:{closest:s=>s==='[data-act]'?el:null}});
}
for(let game=0;game<700;game++){
  const n=range[game%range.length], cast=casts[game%casts.length];
  S=fresh(n); S.script=scripts[game%scripts.length];
  S.players.forEach((p,i)=>{
    p.role=game%3===0&&i<cast.length?cast[i]:i===0?draw(demons):i===1?'wizard':draw(chars);
    if(THINKS.includes(p.role)) p.shown=p.role==='lunatic'?draw(demons):'chef';
    if(p.role==='alchemist')p.as='wizard';
  });
  startGame(); undo=[]; Object.assign(ui,{pick:null,show:null,recap:null,rulings:[],tab:'main',msg:null});
  for(let round=0;round<38;round++){
    const p=draw(S.players), q=draw(S.players);
    try{
      switch(next(15)){
        case 0: if(p.alive&&!S.winner){commit(()=>kill(p,'chaos test',true));forcedDeaths++;} break;
        case 1: if(!p.alive||p.fake) applyWizardEffect({target:p.id,life:'revive',character:'',alignment:''}); break;
        case 2: applyWizardEffect({target:p.id,life:'',character:draw(chars),alignment:draw(['','good','evil']),reminder:draw(['','wizardlife','wizardpoison'])}); edits++; break;
        case 3: if(wizardMode()) wizardAbilityRule({target:p.id,rule:draw(['grant','keep','mute','restore','remove']),character:draw(chars),expires:draw(['dawn','dusk','never'])}); break;
        case 4: applyWizardVoting({target:p.id,rule:draw(['ghost','wizardvote','wizardnom']),count:String(next(8)),expires:'dusk'});break;
        case 5: if(!night()&&!S.day.executed&&!S.winner) execute(p);break;
        case 6: if(!night()&&wizardMode()) wizardException({rule:draw(['extra','tie','bypass','clear']),target:p.id});break;
        case 7: if(!night()&&!S.day.executed&&!S.winner&&p!==q&&!S.day.noms.some(x=>x.nominee===q.id&&!x.closed)) {
          nominate(p,q);ui.pick={kind:'voters',i:S.day.noms.length-1,chosen:[]};resolvePick(draw(S.players));ui.pick=null;
        }break;
        case 8: if(wizardMode()) queueWizardItem({kind:'card',trigger:draw(['now','dawn','dusk','death','execution']),triggerTarget:p.id,recipient:q.id,message:'Private chaos clue'});break;
        case 9: save();S=load();ensureConsistent();reloads++;break;
        case 10: event('undo');break;
        case 11: if(!S.winner && !ui.rulings.length && !ui.pick){commit(night()?toDay:toNight);ui.show=null;phases++;}break;
        case 12: if(ui.rulings.length){const r=ui.rulings[0];event('rule',{id:r.id,i:'0'});}break;
        case 13: if(ui.pick?.kind==='starpass'){const m=S.players.find(x=>x.alive&&team(x)==='minion');if(m)resolvePick(m);}break;
        case 14: if(night()&&!S.winner){const d=S.players.find(x=>x.alive&&KILLERS.includes(x.role));if(d)demonAttack(d,p);}break;
      }
      inspect();turns++;
    }catch(error){throw new Error('Game '+game+' step '+round+' · '+phaseLabel()+' · '+S.players.map(p=>p.role).join(', '),{cause:error});}
  }
}
function castDay(roles){
  S=fresh(8);
  S.players.forEach((p,i)=>p.role=roles[i]||'chef');
  startGame();toDay();undo=[];
  Object.assign(ui,{pick:null,rulings:[],show:null,msg:null});
  return S.players;
}
{
  const [,,p,q,r]=castDay(['imp','wizard','moonchild','klutz','empath']);
  commit(()=>applyWizardEffects([{target:p.id,life:'kill'},{target:q.id,life:'kill'}]));
  assert.equal(ui.pick.kind,'moonchild');
  assert.equal(S.pending[0].kind,'klutz');
  resolvePick(r);
  assert.equal(ui.pick.kind,'klutz');
  event('undo');
  assert.equal(ui.pick.kind,'moonchild');
  resolvePick(P(r.id));
  assert.equal(ui.pick.kind,'klutz');
  resolvePick(P(r.id));
  assert.equal(ui.pick,null);
  assert.equal(S.pending.length,0);
  console.log('PASS simultaneous Moonchild and Klutz deaths keep both choices');
}
for(const role of ['fool','psychopath']){
  const [,,p,q]=castDay(['imp','wizard',role,'empath']);
  queueWizardItem({kind:'card',trigger:'execution',recipient:q.id,message:'After resolution'});
  commit(()=>execute(p));
  assert.equal(S.wizardQueue[0].status,'waiting');
  assert.match(wizardException({rule:'extra'}),/after the first execution resolves/);
  if(role==='psychopath') event('rosh',{v:'win'});
  else event('rule',{id:ui.rulings[0].id,i:'0'});
  assert.equal(S.wizardQueue[0].status,'ready');
  assert.equal(wizardException({rule:'extra'}),undefined);
}
console.log('PASS Fool and Psychopath defer execution triggers and a second execution until resolution');
{
  const [d,w,p]=castDay(['imp','wizard','chef']);
  wizardAbilityRule({target:p.id,rule:'grant',character:'scarletwoman',expires:'never'});
  commit(()=>kill(d,'test',true));
  assert.equal(p.role,'imp');
  assert.equal(w.role,'wizard');
  assert.equal(S.winner,null);
  console.log('PASS an added Scarlet Woman ability can catch a Demon death');
}
for(const reverse of [false,true]){
  const [d,w,p,...rest]=castDay(['imp','wizard','empath']);
  rest.forEach(q=>q.alive=false);
  const effects=[{target:p.id,life:'kill'},{target:d.id,life:'kill'}];
  commit(()=>applyWizardEffects(reverse?effects.reverse():effects));
  assert.match(S.winner,/Good wins/);
  assert.equal(w.alive,true);
}
console.log('PASS simultaneous final deaths yield the same result in either batch order');
{
  const [d,w]=castDay(['zombuul','wizard']);
  queueWizardItem({kind:'card',trigger:'death',triggerTarget:d.id,recipient:w.id,message:'Actual death'});
  commit(()=>kill(d,'first publicly dead',true));
  assert.equal(d.fake,true);
  assert.equal(S.wizardQueue[0].status,'waiting');
  applyWizardEffect({target:d.id,life:'revive',character:'',alignment:''});
  commit(()=>kill(d,'publicly dead again',true));
  assert.equal(S.wizardQueue[0].status,'waiting');
  commit(()=>kill(d,'actual death',true));
  assert.equal(S.wizardQueue[0].status,'ready');
}
console.log('PASS Zombuul death trigger distinguishes apparent death, resurrection, and actual death');
{
  const [d,w,p,q]=castDay(['imp','wizard','saint','fool']);
  commit(()=>kill(p,'earlier death',true));
  commit(()=>execute(p));
  assert.equal(S.winner,null);
  wizardException({rule:'extra'});
  assert.equal(wizardException({rule:'extra'}),'Allow a second execution after the first execution resolves.');
  commit(()=>execute(q));
  event('rule',{id:ui.rulings[0].id,i:'0'});
  assert.equal(q.alive,true);
  assert.equal(d.alive,true);
  assert.equal(w.alive,true);
}
console.log('PASS executing a dead Saint does not end the game before a second execution');
console.log('700 seeded games, '+turns+' transitions, '+renders+' render sweeps, '+edits+' role edits, '+reloads+' reloads, '+forcedDeaths+' forced death actions, '+phases+' phase changes');
`,ctx);
