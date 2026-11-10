// Run with node tests/seating.cjs.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('\n(async ()=>{')[0];
const ctx=vm.createContext({console,assert,setInterval(){},setTimeout(){},
 localStorage:{getItem(){return null},setItem(){},removeItem(){}},
 document:{addEventListener(){},querySelector(){return null}},
 window:{addEventListener(){}},navigator:{},location:{hash:''}});
vm.runInContext(source,ctx);
vm.runInContext(`
let checks=0;
for(const n of [2,3,8,15]) for(let from=0;from<n;from++) for(let gap=0;gap<n;gap++){
 const players=Array.from({length:n},(_,i)=>({id:String(i),name:'Player '+i,role:i===0?'imp':'chef',rem:[{type:'custom'}]}));
 const snapshot=JSON.stringify(players), moving=players[from];
 const result=seatInsertion(players,moving.id,gap);
 assert.equal(result[gap],moving);
 assert.deepEqual(result.filter(p=>p!==moving),players.filter(p=>p!==moving));
 assert.equal(JSON.stringify(players),snapshot,'preview must not mutate saved state');
 assert.equal(new Set(result.map(p=>p.id)).size,n);
 assert.ok(result.every(p=>players.includes(p)),'role, reminders and player identity travel together');
 checks++;
}
console.log(checks+' insertion scenarios passed (both directions, wraparound, no-op, and 2–15 players)');
`,ctx);
