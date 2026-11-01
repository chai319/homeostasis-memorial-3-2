const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../content.js'),{Game,holiday,formatDay}=require('../engine.js'),root=path.resolve(__dirname,'..');
const skills=['study','science','fitness','cooking','art','care'];
for(const c of D.characters){assert.ok(Object.keys(c.requiredStats).length>=2);for(const k of Object.keys(c.requiredStats))assert.ok(skills.includes(k));for(const id of [c.id+'_date',c.id+'_ending',c.id+'_friend'])assert.ok(D.scenes[id],id);}
for(const [day,id] of Object.entries(D.events)){assert.ok(D.scenes[id],id);assert.ok(+day<=83);}
for(const sc of Object.values(D.scenes)){assert.ok(D.places[sc.place],sc.id);assert.ok(fs.existsSync(path.join(root,'assets/backgrounds',sc.place+'.png')),sc.place);for(const id of sc.cast)assert.ok(D.characters.some(c=>c.id===id),sc.id+' '+id);}
const labelDay=d=>formatDay(d);
function walkThrough(c){
 const g=new Game(D,'あなた',null,{playerGender:'unset',interest:c.gender});let steps=0;const displayed=new Set(),choices=new Set(),events=new Set();let weekends=0,dates=0;
 while(g.state.phase!=='complete'){
  assert.ok(++steps<1500,`${c.id} loop at ${g.state.day} ${g.state.phase}`);const s=g.state;
  assert.deepEqual(new Game(D,'',g.export()).export(),g.export());
  if(s.phase==='scene'){
   const sc=g.scene();if(sc.id.startsWith('event_'))events.add(sc.id);
   if(s.cursor.mode==='choice'){for(const option of sc.choice.options){assert.ok(!choices.has(option.text),`Repeated choice: ${option.text}`);choices.add(option.text);}g.choose(0);}
   else {const l=g.line();if(l.who!=='narrator'){assert.ok(!displayed.has(l.text),`Repeated line ${c.id} ${sc.id}: ${l.text}`);displayed.add(l.text);}g.advance();}
  } else if(s.phase==='activity'){
   if(s.met.includes(c.id)&&(s.clues[c.id]?.length||0)>=2&&!s.identified.includes(c.id))assert.equal(g.guess(c.id,c.motif).ok,true);
   const lack=Object.entries(c.requiredStats).find(([k,v])=>s.skills[k]<v);assert.equal(g.act(lack?lack[0]:'rest'),true);
  }else if(s.phase==='walk'){assert.equal(g.walk(s.met.includes(c.id)?c.id:null),true);}
  else if(s.phase==='night'){assert.ok(holiday(s.day),`weekday night ${labelDay(s.day)}`);weekends++;if(s.met.includes(c.id)&&s.bond[c.id]>=4&&s.dates[c.id]===0&&!s.appointment&&g.nextAvailableWeekend()){assert.ok(g.invite(c.id,'afternoon'));dates++;}else assert.ok(g.skipNight());}
  else if(s.phase==='notice')assert.ok(g.continueNotice());
  else if(s.phase==='quiz'){const q=D.quiz[s.quizIndex];assert.ok(g.answer(q.answer));}
  else throw Error(`unexpected ${s.phase}`);
 }
 assert.equal(g.state.day,83);assert.equal(g.state.met.length,15);assert.ok(weekends);assert.ok(dates);assert.equal(g.state.endingWho,c.id,`ending ${c.id}`);
 for(const id of Object.values(D.events))assert.ok(events.has(id),`missing ${id}`);assert.equal(g.state.answers.length,5);
 return steps;
}
const steps=D.characters.map(walkThrough);
const g=new Game(D);Object.assign(g.state,{phase:'night',day:11,met:['c13_nemu'],cursor:null});g.state.bond.c13_nemu=10;assert.ok(g.invite('c13_nemu','morning'));assert.equal(g.state.appointment,null);assert.equal(g.state.noticeNext,'night');assert.ok(g.continueNotice());assert.ok(g.invite('c13_nemu','afternoon'));assert.ok(g.state.appointment);
const fast=new Game(D);while(fast.state.phase==='scene')fast.state.cursor.mode==='choice'?fast.choose(0):fast.advance();assert.equal(fast.state.day,8);assert.ok(fast.advanceDays());assert.equal(fast.state.day,9,'fast-forward must preserve unmet introductions');
const zero=new Game(D);Object.assign(zero.state,{day:83,phase:'activity',cursor:null});zero.startEnding();assert.equal(zero.scene().id,'ending_group');
console.log(JSON.stringify({result:'PASS',routes:steps.length,steps:Math.max(...steps),events:Object.keys(D.events).length,weekdayNights:0,duplicateLines:0,duplicateChoices:0},null,2));
const quick=new Game(D);const important=new Set();let safe=0;
while(quick.state.phase!=='complete'){
 assert.ok(++safe<800);const s=quick.state;
 if(s.phase==='scene'){if(s.cursor.id.startsWith('event_'))important.add(s.cursor.id);s.cursor.mode==='choice'?quick.choose(0):quick.advance();}
 else if(s.phase==='activity')quick.advanceDays();
 else if(s.phase==='quiz')quick.answer(D.quiz[s.quizIndex].answer);
 else if(s.phase==='walk')quick.walk();
 else if(s.phase==='night')quick.skipNight();
 else if(s.phase==='notice')quick.continueNotice();
}
assert.equal(quick.state.met.length,15);for(const id of Object.values(D.events))assert.ok(important.has(id));
console.error('PASS: fast-forward retains all first encounters, seven events and a complete ending');
