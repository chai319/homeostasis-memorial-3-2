const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
class Elem{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.value='';this.textContent='';this.hidden=false;this.open=false;}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(k,v){this[k]=v}showModal(){this.open=true}close(){this.open=false}click(){this.onclick?.({preventDefault(){}})}}
const ids={};const document={getElementById:id=>ids[id]||(ids[id]=new Elem('div')),createElement:tag=>new Elem(tag),createTextNode:text=>Object.assign(new Elem('text'),{textContent:text}),addEventListener(){},body:new Elem('body'),activeElement:null,hidden:false};document.body.classList={toggle(){}};
const memory={};const localStorage={getItem:k=>memory[k]||null,setItem:(k,v)=>{memory[k]=v}};class Audio{play(){return Promise.resolve()}pause(){}};
const ctx={document,localStorage,Audio,matchMedia:()=>({matches:false}),console,setTimeout:()=>0,clearTimeout(){},Blob,URL,Date};ctx.globalThis=ctx;vm.createContext(ctx);const base=path.resolve(__dirname,'..');for(const n of ['content.js','engine.js','app.js'])vm.runInContext(fs.readFileSync(path.join(base,n),'utf8'),ctx,{filename:n});
document.getElementById('player-name').value='あなた';document.getElementById('player-gender').value='unset';document.getElementById('interest').value='female';ids['start-form'].onsubmit({preventDefault(){}});
const state=()=>JSON.parse(memory[ctx.HM32_DATA.meta.saveKey]).state;
function flat(e){return [e,...(e.children||[]).flatMap(flat)]}function text(e){return e.textContent+(e.children||[]).map(text).join('')}
function clickText(root,part){const target=flat(root).find(e=>e.tagName==='BUTTON'&&text(e).includes(part));assert.ok(target,`button ${part} not found`);target.click()}
let limit=0;while(state().phase==='scene'&&limit++<20){if(state().cursor.mode==='choice')ids['choice-buttons'].children[0].click();else ids.dialogue.click()}
assert.equal(state().phase,'activity');assert.equal(ids.activity.hidden,false);clickText(ids.activity,'図書室で勉強');assert.equal(state().phase,'walk');assert.equal(state().skills.study,21);assert.equal(ids.walk.hidden,false);clickText(ids.walk,'一人で帰る');assert.equal(state().day,9);assert.equal(state().phase,'scene');assert.equal(state().interest,'female');
ids.settings.click();assert.equal(ids.modal.open,true);assert.ok(flat(ids['modal-body']).some(e=>e.id==='setting-interest'));
console.log('PASS: title setup, choice, activity/stat growth, walk, weekday advance, preferences dialog');
ids['modal-close'].click();let ticks=0;
while(state().phase!=='complete'){
 assert.ok(++ticks<1800,'UI loop');const s=state();
 if(s.quizFeedback){clickText(ids.quiz,s.phase==='activity'?'放課後へ':'次の問いへ');continue;}
 if(s.phase==='scene'){if(s.cursor.mode==='choice')ids['choice-buttons'].children[0].click();else ids.dialogue.click();}
 else if(s.phase==='activity'){
  if(s.met.includes('c15_koko')&&(s.clues.c15_koko?.length||0)>=2&&!s.identified.includes('c15_koko')){ids.notebook.click();clickText(ids['modal-body'],'ここ');clickText(ids['modal-body'],'糖質コルチコイド');ids['modal-close'].click();}
  const k=[['study','図書室で勉強',35],['cooking','調理の練習',35],['care','教室を手伝う',35]].find(([id,t,min])=>s.skills[id]<min);clickText(ids.activity,k?k[1]:'ひと休み');
 }else if(s.phase==='walk'){clickText(ids.walk,s.met.includes('c15_koko')?'ここ':'一人で帰る');}
 else if(s.phase==='night'){
  if(!s.appointment&&s.met.includes('c15_koko')&&s.bond.c15_koko>=4&&s.dates.c15_koko===0&&s.day<76){const slot=flat(ids.night).find(x=>x.id==='date-slot');slot.value='afternoon';clickText(ids.night,'ここ');}else clickText(ids.night,s.appointment?'翌日へ':'誘わず、翌日へ');
 }else if(s.phase==='notice'){clickText(ids.notice,'つづける');}
 else if(s.phase==='quiz'){const opts=flat(ids.quiz).filter(x=>x.tagName==='BUTTON');assert.ok(opts.length>=3);opts[0].click();}
 else throw Error('UI phase '+s.phase);
}
assert.equal(state().day,83);assert.equal(state().endingWho,'c15_koko');assert.equal(ids.complete.hidden,false);
console.log('PASS: simulated UI through all dates, weekend invitation, quiz, journal inference and character ending');
// A multi-character lake scene must highlight the current speaker only.
const stageGame=new ctx.HM32.Game(ctx.HM32_DATA);stageGame.state.day=66;stageGame.begin('event_lake','morning');stageGame.advance();stageGame.advance();
memory[ctx.HM32_DATA.meta.saveKey]=JSON.stringify({version:1,state:stageGame.export()});
vm.runInContext(fs.readFileSync(path.join(base,'app.js'),'utf8'),ctx,{filename:'app.js'});ids.continue.click();
assert.equal(ids.stage.children.length,3);assert.equal(ids.stage.children.filter(a=>a.className.includes('speaking')).length,1);
assert.ok(ids.stage.children[2].className.includes('speaking'));assert.equal(ids.stage['data-count'],'3');
ids.dialogue.click();assert.ok(ids.stage.children[0].className.includes('speaking'));assert.equal(ids.stage.children.filter(a=>a.className.includes('speaking')).length,1);
console.log('PASS: lake scene switches the foreground speaker among three characters');
