/* Class 3-2: April–June independent state machine. */
(function(g){'use strict';
const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,v));
const holiday=d=>[0,6].includes(new Date(Date.UTC(2026,3,d)).getUTCDay());
const formatDay=d=>{const t=new Date(Date.UTC(2026,3,d));return `${t.getUTCMonth()+1}月${t.getUTCDate()}日（${'日月火水木金土'[t.getUTCDay()]}）`;};
const phases=['scene','activity','walk','night','notice','quiz','complete'];
const playerGenders=['unset','male','female'],interests=['undecided','all','male','female'];
const actions={study:{study:6,science:1},science:{science:6,study:1},fitness:{fitness:6},cooking:{cooking:6,care:1},art:{art:6},care:{care:6},rest:{}};
const skillKeys=['study','science','fitness','cooking','art','care'];
class Game{
 constructor(data,name='あなた',state=null,preferences={}){this.data=data;this.chars=Object.fromEntries(data.characters.map(c=>[c.id,c]));this.state=state?this.validate(state):{schema:2,day:8,name:String(name).trim().slice(0,12)||'あなた',playerGender:playerGenders.includes(preferences.playerGender)?preferences.playerGender:'unset',interest:interests.includes(preferences.interest)?preferences.interest:'undecided',phase:'scene',cursor:null,met:[],bond:Object.fromEntries(data.characters.map(c=>[c.id,0])),visits:{},clues:{},identified:[],guesses:{},completed:[],history:[],stats:{observe:0,care:0,energy:75},skills:Object.fromEntries(skillKeys.map(k=>[k,15])),stress:0,dates:Object.fromEntries(data.characters.map(c=>[c.id,0])),appointment:null,notice:null,noticeNext:null,quizIndex:0,answers:[],lastActivity:null,endingWho:null};if(!state)this.startDay();}
 validate(s){
  if(!s||s.schema!==2||!Number.isInteger(s.day)||s.day<8||s.day>83||!phases.includes(s.phase)||typeof s.name!=='string'||s.name.length>12||!playerGenders.includes(s.playerGender)||!interests.includes(s.interest))throw Error('この本編の保存データではありません。');
  const known=id=>Object.hasOwn(this.chars,id);
  for(const a of ['met','identified'])if(!Array.isArray(s[a])||!s[a].every(known))throw Error('人物の記録が壊れています。');
  for(const k of ['observe','care','energy'])if(!Number.isFinite(s.stats?.[k])||s.stats[k]<0||s.stats[k]>100)throw Error('能力の記録が壊れています。');
  if(!Number.isFinite(s.stress)||s.stress<0||s.stress>100)throw Error('ストレスの記録が壊れています。');
  for(const k of skillKeys)if(!Number.isFinite(s.skills?.[k])||s.skills[k]<0||s.skills[k]>120)throw Error('成長記録が壊れています。');
  for(const c of this.data.characters)if(!Number.isFinite(s.bond?.[c.id])||s.bond[c.id]<0||s.bond[c.id]>100||!Number.isInteger(s.dates?.[c.id])||s.dates[c.id]<0)throw Error('交流記録が壊れています。');
  for(const k of ['visits','clues','guesses'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))throw Error('手帳の記録が壊れています。');
  for(const [id,v]of Object.entries(s.visits))if(!known(id)||!Number.isInteger(v)||v<0||v>10000)throw Error('訪問記録が壊れています。');
  for(const [id,v]of Object.entries(s.clues))if(!known(id)||!Array.isArray(v)||v.length>3||!v.every(x=>Number.isInteger(x)&&x>=0&&x<3))throw Error('観察メモが壊れています。');
  for(const [id,v]of Object.entries(s.guesses))if(!known(id)||!Number.isInteger(v)||v<8||v>83)throw Error('予想の記録が壊れています。');
  if(!Array.isArray(s.history)||s.history.length>1200||!s.history.every(x=>x&&typeof x.text==='string'&&x.text.length<1500))throw Error('履歴が壊れています。');
  if(!Array.isArray(s.completed)||!s.completed.every(id=>this.data.scenes[id]))throw Error('場面記録が壊れています。');
  if(!Number.isInteger(s.quizIndex)||s.quizIndex<0||s.quizIndex>this.data.quiz.length||!Array.isArray(s.answers)||s.answers.length>5)throw Error('進行記録が壊れています。');
  if(s.appointment&&(!known(s.appointment.id)||!Number.isInteger(s.appointment.day)||s.appointment.day<8||s.appointment.day>83||!['morning','afternoon'].includes(s.appointment.slot)))throw Error('約束が壊れています。');
  if(s.phase==='scene'){
   const cur=s.cursor,sc=this.data.scenes[cur?.id];if(!sc||!['lines','choice','response'].includes(cur.mode)||!['morning','date','walk','finale','ending'].includes(cur.returnTo))throw Error('再開位置が壊れています。');
   const ls=cur.mode==='response'?sc.choice?.options[cur.selected]?.response:sc.lines;
   if(cur.mode==='choice'){if(!sc.choice)throw Error('選択位置が壊れています。');}else if(!ls||!Number.isInteger(cur.line)||cur.line<0||cur.line>=ls.length)throw Error('台詞位置が壊れています。');
  }
  return JSON.parse(JSON.stringify(s));
 }
 startDay(){const s=this.state;s.lastActivity=null;const evt=this.data.events[String(s.day)];if(evt){this.begin(evt,s.day===83?'finale':'morning');return;}
  if(s.appointment?.day===s.day){const a=s.appointment;s.appointment=null;s.dateSlot=a.slot;s.dates[a.id]++;this.apply({bond:{[a.id]:4},energy:-4});if(!s.completed.includes(a.id+'_date')){this.begin(a.id+'_date','date');}else this.notice(`${this.chars[a.id].short}と出かけて、楽しい時間を過ごした。`,'activity');return;}
  if(s.day===this.data.midtermDay){s.phase='quiz';return;}
  const daily=this.data.scenes['day'+s.day];if(daily&&!s.completed.includes(daily.id)){this.begin(daily.id,'morning');return;}s.phase='activity';s.cursor=null;
 }
 begin(id,returnTo){if(!this.data.scenes[id])throw Error('Unknown scene '+id);this.state.phase='scene';this.state.cursor={id,mode:'lines',line:0,selected:null,returnTo};this.logLine();}
 scene(){return this.data.scenes[this.state.cursor?.id]||null;}
 lines(){const c=this.state.cursor,s=this.scene();return c?.mode==='response'?s.choice.options[c.selected].response:s?.lines||[];}
 line(){return this.state.phase==='scene'&&this.state.cursor.mode!=='choice'?this.lines()[this.state.cursor.line]:null;}
 logLine(){const l=this.line();if(l){const h=this.state.history;h.push({day:this.state.day,who:l.who,text:l.text});if(h.length>1200)h.shift();}}
 advance(){const s=this.state;if(s.phase!=='scene'||s.cursor.mode==='choice')return false;const c=s.cursor;c.line++;if(c.line<this.lines().length){this.logLine();return true;}if(c.mode==='lines'&&this.scene().choice){c.mode='choice';c.line=0;return true;}this.finish();return true;}
 choose(n){const s=this.state,c=s.cursor;if(s.phase!=='scene'||c.mode!=='choice')return false;const o=this.scene().choice.options[n];if(!o)return false;this.apply(o.effects);s.history.push({day:s.day,who:'player',text:o.text});c.selected=n;c.mode='response';c.line=0;this.logLine();return true;}
 apply(e={}){const s=this.state;for(const [id,v]of Object.entries(e.bond||{}))if(this.chars[id])s.bond[id]=clamp(s.bond[id]+v);for(const k of ['observe','care','energy'])if(e[k])s.stats[k]=clamp(s.stats[k]+e[k]);}
 finish(){const s=this.state,sc=this.scene(),route=s.cursor.returnTo;for(const id of sc.meet||[])if(!s.met.includes(id))s.met.push(id);if(sc.clue){const {who,index}=sc.clue;const bag=s.clues[who]||(s.clues[who]=[]);if(!bag.includes(index)){bag.push(index);s.stats.observe=clamp(s.stats.observe+1);}}if(!s.completed.includes(sc.id))s.completed.push(sc.id);s.cursor=null;
  if(route==='morning'||route==='date')s.phase='activity';
  if(route==='walk')this.afterWalk();
  if(route==='finale')this.startEnding();
  if(route==='ending')s.phase='complete';
 }
 allowsRomance(id){const interest=this.state.interest;return !['male','female'].includes(interest)||this.chars[id]?.gender===interest;}
 nextTalk(id){if(!this.chars[id]||!this.state.met.includes(id))return null;const n=this.state.visits[id]||0;if(n>=3)return null;return n===2&&!this.allowsRomance(id)?id+'_friend':id+'_talk'+n;}
 act(kind){const s=this.state;if(s.phase!=='activity'||!Object.hasOwn(actions,kind))return false;const effect=actions[kind];for(const [k,v]of Object.entries(effect))s.skills[k]=clamp(s.skills[k]+(s.stress>=80?Math.max(1,Math.floor(v/2)):v),0,120);if(kind==='rest'){s.stress=clamp(s.stress-15);s.stats.energy=clamp(s.stats.energy+18);}else{s.stress=clamp(s.stress+4);s.stats.energy=clamp(s.stats.energy-3);}s.lastActivity=kind;s.phase='walk';return true;}
 walk(id=null){const s=this.state;if(s.phase!=='walk')return false;if(id&&!s.met.includes(id))return false;if(!id){this.afterWalk();return true;}const scene=this.nextTalk(id);s.visits[id]=(s.visits[id]||0)+1;s.bond[id]=clamp(s.bond[id]+2);if(scene){this.begin(scene,'walk');}else{this.notice(`${this.chars[id].short}と仲良く帰った。`,'afterWalk');}return true;}
 afterWalk(){if(holiday(this.state.day))this.state.phase='night';else this.nextDay();}
 notice(text,next){this.state.phase='notice';this.state.notice=text;this.state.noticeNext=next;}
 dismissNotice(){const s=this.state;if(s.phase!=='notice')return false;const next=s.noticeNext;s.notice=null;s.noticeNext=null;if(next==='afterWalk')this.afterWalk();else s.phase=next;return true;}
 nextAvailableWeekend(){const s=this.state;for(let d=s.day+1;d<=82;d++)if(holiday(d)&&!this.data.events[String(d)])return d;return null;}
 invite(id,slot='afternoon'){const s=this.state;if(s.phase!=='night'||!holiday(s.day)||!this.chars[id]||!s.met.includes(id)||!this.allowsRomance(id)||!['morning','afternoon'].includes(slot))return false;if(s.appointment){this.notice('すでに次の約束があります。','nextDay');return true;}const c=this.chars[id],day=this.nextAvailableWeekend();if(!day){this.notice('もう新しい週末の予定はありません。','nextDay');return true;}if(c.afternoonOnly&&slot==='morning'){this.notice('ねむは午前中に起きられない。午後に誘ってみよう。','night');return true;}if(s.bond[id]<4){this.notice(`${c.short}とは、もう少し話してから誘ってみよう。`,'night');return true;}s.appointment={id,day,slot};this.notice(`${c.short}と${formatDay(day)}の${slot==='morning'?'午前':'午後'}に出かける約束をした。`,'nextDay');return true;}
 skipNight(){if(this.state.phase!=='night'||!holiday(this.state.day))return false;this.nextDay();return true;}
 nextDay(){const s=this.state;if(s.day>=83)return false;s.day++;s.stats.energy=clamp(s.stats.energy+6);s.stress=clamp(s.stress-2);this.startDay();return true;}
 continueNotice(){const s=this.state;if(s.phase!=='notice')return false;if(s.noticeNext==='nextDay'){s.notice=null;s.noticeNext=null;return this.nextDay();}return this.dismissNotice();}
 advanceDays(){const s=this.state;if(s.phase!=='activity'||s.day>=83)return false;let d=s.day+1;while(d<83&&!holiday(d)&&!this.data.events[String(d)]&&d!==this.data.midtermDay&&d!==s.appointment?.day&&!this.data.scenes['day'+d]?.meet?.some(id=>!s.met.includes(id)))d++;s.day=d;s.stress=clamp(s.stress-6);this.startDay();return true;}
 setPreferences(playerGender,interest){if(!playerGenders.includes(playerGender)||!interests.includes(interest))return false;this.state.playerGender=playerGender;this.state.interest=interest;return true;}
 startEnding(){const s=this.state;const eligible=s.met.filter(id=>this.allowsRomance(id)&&s.identified.includes(id)&&s.bond[id]>=12&&s.dates[id]>=1&&Object.entries(this.chars[id].requiredStats).every(([k,v])=>s.skills[k]>=v));eligible.sort((a,b)=>s.bond[b]-s.bond[a]||a.localeCompare(b));s.endingWho=eligible[0]||null;this.begin(s.endingWho?s.endingWho+'_ending':'ending_group','ending');}
 answer(n){const s=this.state;if(s.phase!=='quiz')return null;const q=this.data.quiz[s.quizIndex];if(!q||!Number.isInteger(n)||n<0||n>=q.options.length)return null;const result={id:q.id,selected:n,correct:n===q.answer};s.answers.push(result);s.quizIndex++;this.apply({observe:result.correct?2:1});if(s.quizIndex>=this.data.quiz.length)s.phase='activity';return {correct:result.correct,explanation:q.explanation};}
 guess(id,motif){const s=this.state,c=this.chars[id];if(!c||!s.met.includes(id)||(s.clues[id]?.length||0)<2)return {ok:false,text:'観察メモを2枚集めると推理できます。'};if(s.identified.includes(id))return {ok:false,text:'もう図鑑に登録されています。'};if(s.guesses[id]===s.day)return {ok:false,text:'今日の予想は記録済み。別の日に、もう一度考えてみましょう。'};s.guesses[id]=s.day;if(motif===c.motif){s.identified.push(id);this.apply({observe:3,bond:{[id]:1}});return {ok:true,text:'図鑑に登録しました。'+c.fact};}return {ok:false,text:'もう一度、働く場所や情報の通り道を見直してみよう。今日は観察メモを読み返して、続きは明日に。'};}
 export(){return JSON.parse(JSON.stringify(this.state));}
}
g.HM32={Game,holiday,formatDay,skillKeys};if(typeof module!=='undefined')module.exports=g.HM32;
})(globalThis);
