import * as AI from "./ai.js";

const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAYS_LONG=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const ex=(name,sets,reps)=>({name,sets,reps});
const DEFAULT_SPLIT=[
  {name:"Push A",focus:"Chest · Shoulders · Triceps",exercises:[ex("Bench Press",4,"6–8"),ex("Overhead Press",3,"8–10"),ex("Incline Dumbbell Press",3,"10"),ex("Lateral Raise",3,"12–15"),ex("Triceps Pushdown",3,"10–12")]},
  {name:"Pull A",focus:"Back · Rear delts · Biceps",exercises:[ex("Barbell Row",4,"6–8"),ex("Pull-up",3,"6–10"),ex("Seated Cable Row",3,"10"),ex("Face Pull",3,"15"),ex("Barbell Curl",3,"10")]},
  {name:"Legs A",focus:"Quads · Hamstrings · Calves",exercises:[ex("Back Squat",4,"6–8"),ex("Romanian Deadlift",3,"8–10"),ex("Leg Press",3,"12"),ex("Lying Leg Curl",3,"12"),ex("Standing Calf Raise",4,"15")]},
  {name:"Push B",focus:"Upper chest · Shoulders · Triceps",exercises:[ex("Incline Bench Press",4,"8"),ex("Seated Dumbbell Press",3,"10"),ex("Cable Fly",3,"12"),ex("Lateral Raise",4,"15"),ex("Overhead Triceps Extension",3,"12")]},
  {name:"Pull B",focus:"Lats · Upper back · Biceps",exercises:[ex("Lat Pulldown",4,"8–10"),ex("One-arm Dumbbell Row",3,"10"),ex("Rear Delt Fly",3,"15"),ex("Hammer Curl",3,"12"),ex("Dumbbell Shrug",3,"12")]},
  {name:"Legs B",focus:"Glutes · Quads · Calves",exercises:[ex("Hack Squat",4,"8"),ex("Hip Thrust",3,"10"),ex("Walking Lunge",3,"12 / leg"),ex("Leg Extension",3,"15"),ex("Seated Calf Raise",4,"15")]},
  {name:"Rest",focus:"Recovery · walk, stretch, sleep",exercises:[]}
];
const DEFAULT_GOALS={calories:2500,protein:180,carbs:280,fat:70,targetWeight:"",unit:"kg",note:""};
const DEFAULT_SETTINGS={coachSize:"3b",visionSize:"500m"};
const STORE_KEY="ironlog-v1";

const S={docs:{},tab:"today",date:todayKey(),editDay:null,draft:null,lastFormKey:"",
  coachBusy:false,ctl:null,stream:null,pendingUser:null,coachErr:"",
  estBusy:false,estStep:"",estErr:"",photoFile:null,photoUrl:null,
  ai:{coach:{state:"idle",p:0,text:"",cached:null},vision:{state:"idle",p:0,text:""}},gpu:null,usage:null,msg:""};

function key(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function todayKey(){return key(new Date())}
function parseKey(k){const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(k,n){const d=parseKey(k);d.setDate(d.getDate()+n);return key(d)}
function dayIdx(k){return (parseKey(k).getDay()+6)%7}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmtMsg(s){return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}
function clone(o){return JSON.parse(JSON.stringify(o))}
function n(v){const x=parseFloat(v);return isFinite(x)?x:0}
function r0(v){return Math.round(v)}
function fmtDate(k,opts){return parseKey(k).toLocaleDateString(undefined,opts||{weekday:"long",month:"short",day:"numeric"})}
function gb(b){return b>=1e9?(b/1e9).toFixed(1)+" GB":Math.round(b/1e6)+" MB"}

const split=()=>S.docs.split?.days||DEFAULT_SPLIT;
const goals=()=>({...DEFAULT_GOALS,...(S.docs.goals||{})});
const settings=()=>({...DEFAULT_SETTINGS,...(S.docs.settings||{})});
const logOf=k=>S.docs["log-"+k]||{date:k,foods:[],done:{},completed:false,weight:null};
function totals(l){return (l.foods||[]).reduce((a,f)=>({cal:a.cal+n(f.cal),p:a.p+n(f.p),c:a.c+n(f.c),f:a.f+n(f.f)}),{cal:0,p:0,c:0,f:0})}

/* ---------- storage (on this phone) ---------- */
try{S.docs=JSON.parse(localStorage.getItem(STORE_KEY)||"{}")||{}}catch{S.docs={}}
function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(S.docs));return true}catch{S.msg="Couldn't save — phone storage may be full.";return false}}
function save(id,data){S.docs={...S.docs,[id]:data};persist();render()}

/* ---------- render ---------- */
const main=document.getElementById("main");
function formKey(){return S.tab+"|"+S.date+"|"+S.editDay}
function render(){
  const fk=formKey(),same=fk===S.lastFormKey;
  const vals={},act=document.activeElement,actId=act&&act.id&&main.contains(act)?act.id:null;let sel=null;
  if(same){main.querySelectorAll("input[id],textarea[id],select[id]").forEach(el=>{if(el.type!=="file")vals[el.id]=el.value});
    if(actId&&"selectionStart" in act){try{sel=[act.selectionStart,act.selectionEnd]}catch{}}}
  const scroll=main.scrollTop;
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===S.tab?"page":"false"));
  document.getElementById("gear").setAttribute("aria-current",S.tab==="settings"?"page":"false");
  const titles={today:"Today",food:"Food",split:"Weekly split",goals:"Goals",coach:"Coach",settings:"Settings"};
  document.getElementById("hdrTitle").textContent=titles[S.tab];
  document.getElementById("hdrDate").textContent=fmtDate(todayKey());
  main.innerHTML=({today:vToday,food:vFood,split:vSplit,goals:vGoals,coach:vCoach,settings:vSettings})[S.tab]();
  if(same){
    for(const id in vals){const el=document.getElementById(id);if(el&&el.value!==vals[id])el.value=vals[id]}
    if(actId){const el=document.getElementById(actId);if(el){el.focus({preventScroll:true});if(sel&&el.setSelectionRange){try{el.setSelectionRange(sel[0],sel[1])}catch{}}}}
    main.scrollTop=scroll;
  }else{main.scrollTop=S.tab==="coach"?main.scrollHeight:0}
  S.lastFormKey=fk;
}

function weekStrip(){
  const start=addDays(S.date,-dayIdx(S.date)),sp=split(),t=todayKey();let h='<div class="week">';
  for(let i=0;i<7;i++){const k=addDays(start,i),l=logOf(k);
    h+=`<button class="wd${l.completed?" done":""}${k===t?" today":""}" data-act="pick" data-k="${k}" aria-pressed="${k===S.date}" aria-label="${DAYS_LONG[i]} ${esc(sp[i].name)}">
      <span class="d">${DAYS[i]}</span><span class="n">${parseKey(k).getDate()}</span><span class="s">${esc(sp[i].name)}</span><span class="dot"></span></button>`}
  return h+"</div>";
}
function calCard(k){
  const g=goals(),t=totals(logOf(k)),pct=Math.min(1,t.cal/(g.calories||1)),C=2*Math.PI*52,left=g.calories-t.cal;
  const mac=(lbl,v,goal,col)=>`<div class="mac"><div class="row between"><span>${lbl}</span><span class="muted num">${r0(v)} / ${r0(goal)} g</span></div><div class="bar"><i style="width:${Math.min(100,v/(goal||1)*100)}%;background:var(${col})"></i></div></div>`;
  return `<section class="card"><div class="row between"><h2>Calories</h2>${S.docs.goals?"":'<span class="pill">Default targets</span>'}</div>
  <div class="cal"><div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="var(--surface2)" stroke-width="11" fill="none"/>
  <circle class="v" cx="60" cy="60" r="52" stroke="${left<0?"var(--warn)":"var(--accent)"}" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}"/></svg>
  <div class="c"><span class="big">${r0(Math.abs(left))}</span><span class="small muted">${left<0?"kcal over":"kcal left"}</span></div></div>
  <div class="macros"><div class="small muted"><span class="num" style="font-size:17px;color:var(--fg)">${r0(t.cal)}</span> eaten of ${r0(g.calories)} kcal</div>
  ${mac("Protein",t.p,g.protein,"--mp")}${mac("Carbs",t.c,g.carbs,"--mc")}${mac("Fat",t.f,g.fat,"--mf")}</div></div>
  <button class="btn" data-act="tab" data-t="food">Log food</button></section>`;
}
function vToday(){
  const k=S.date,i=dayIdx(k),d=split()[i],l=logOf(k);
  const total=d.exercises.reduce((a,e)=>a+(+e.sets||0),0),done=Object.values(l.done||{}).filter(Boolean).length;
  let w=`<section class="card"><div class="row between"><span class="daytag">${DAYS_LONG[i]}${k===todayKey()?" · today":""}</span>
    ${l.completed?'<span class="pill ok">Done</span>':total?`<span class="pill">${done}/${total} sets</span>`:""}</div>
    <div><h2 style="font-size:28px">${esc(d.name)}</h2><div class="muted small">${esc(d.focus)}</div></div>`;
  if(!d.exercises.length){w+=`<div class="empty">Rest day. Eat to your targets and get some sleep.</div>`}
  else{w+="<div>";d.exercises.forEach((e,ei)=>{
    w+=`<div class="ex"><div class="row between"><span class="exname">${esc(e.name)}</span><span class="muted small num">${esc(e.sets)} × ${esc(e.reps)}</span></div><div class="sets">`;
    for(let s=0;s<(+e.sets||0);s++){const on=!!(l.done||{})[ei+"-"+s];w+=`<button class="set" data-act="set" data-id="${ei}-${s}" aria-pressed="${on}">Set ${s+1}</button>`}
    w+="</div></div>"});w+="</div>";
    w+=`<button class="btn ${l.completed?"ghost":"primary"}" data-act="complete">${l.completed?"Mark as not done":"Finish workout"}</button>`}
  w+="</section>";
  return weekStrip()+w+calCard(k);
}
function progBar(kind){const a=S.ai[kind];if(a.state!=="loading")return "";
  return `<div class="ai"><div class="row between small"><span id="pt-${kind}">${esc(a.text||"Starting…")}</span><span class="num" id="pp-${kind}">${r0(a.p*100)}%</span></div><div class="prog"><i id="pb-${kind}" style="width:${a.p*100}%"></i></div></div>`}
function vFood(){
  const k=S.date,l=logOf(k),t=totals(l),g=goals();
  let h=`<div class="datebar"><button class="icon-btn" data-act="day" data-n="-1" aria-label="Previous day">‹</button>
    <div style="text-align:center"><div class="num" style="font-size:20px">${k===todayKey()?"Today":fmtDate(k,{weekday:"short",month:"short",day:"numeric"})}</div>
    <div class="small muted"><span class="num">${r0(t.cal)}</span> / ${r0(g.calories)} kcal · P ${r0(t.p)} · C ${r0(t.c)} · F ${r0(t.f)}</div></div>
    <button class="icon-btn" data-act="day" data-n="1" aria-label="Next day">›</button></div>`;
  h+=`<section class="card"><h2>Quick estimate</h2>
    <label class="f" for="estText">Describe it, or add a note to a photo<input id="estText" placeholder="e.g. 200g chicken breast, 1 cup rice, broccoli" autocomplete="off"></label>
    ${S.photoUrl?`<img class="thumb" src="${S.photoUrl}" alt="Meal photo">`:""}
    <div class="row">
      <button class="btn" data-act="photo" style="flex:1" ${S.estBusy?"disabled":""}>${S.photoUrl?"New photo":"Snap a photo"}</button>
      <button class="btn${S.photoUrl?" primary":""}" data-act="estimate" style="flex:1" ${S.estBusy?"disabled":""}>${S.estBusy?"Working…":S.photoUrl?"Estimate photo":"Estimate text"}</button>
    </div>
    <input id="photoIn" type="file" accept="image/*" capture="environment" hidden>
    ${S.estBusy?progBar("vision")+progBar("coach")+`<div class="note">${esc(S.estStep)}</div>`:""}
    ${S.estErr?`<div class="note" style="color:var(--warn)">${esc(S.estErr)}</div>`:`<div class="note">Runs on your phone. Photo guesses are rough, so check portions before adding.</div>`}</section>`;
  h+=`<section class="card"><h2>Add food</h2>
    <label class="f" for="fName">Food<input id="fName" placeholder="Greek yogurt, 200g" autocomplete="off"></label>
    <div class="grid4">
      <label class="f" for="fCal">kcal<input id="fCal" inputmode="decimal" placeholder="0"></label>
      <label class="f" for="fP">Protein<input id="fP" inputmode="decimal" placeholder="g"></label>
      <label class="f" for="fC">Carbs<input id="fC" inputmode="decimal" placeholder="g"></label>
      <label class="f" for="fF">Fat<input id="fF" inputmode="decimal" placeholder="g"></label>
    </div><button class="btn primary" data-act="addFood">Add to ${k===todayKey()?"today":fmtDate(k,{weekday:"short"})}</button></section>`;
  h+=`<section class="card"><h2>Logged</h2>`;
  if(!(l.foods||[]).length)h+=`<div class="empty">Nothing logged for this day yet.</div>`;
  else{h+="<div>";l.foods.forEach((f,i)=>{h+=`<div class="food"><div style="min-width:0"><div class="nm">${esc(f.name)}</div><div class="mx">P ${r0(n(f.p))} · C ${r0(n(f.c))} · F ${r0(n(f.f))}</div></div>
    <span class="num">${r0(n(f.cal))}</span><button class="icon-btn" data-act="delFood" data-i="${i}" aria-label="Remove ${esc(f.name)}">×</button></div>`});h+="</div>"}
  return h+"</section>";
}
function vSplit(){
  const sp=split(),ti=dayIdx(todayKey());let h="";
  sp.forEach((d,i)=>{
    if(S.editDay===i&&S.draft){const dr=S.draft;
      h+=`<section class="card"><span class="daytag">${DAYS_LONG[i]}</span>
      <div class="grid2"><label class="f" for="edName">Name<input id="edName" value="${esc(dr.name)}"></label><label class="f" for="edFocus">Focus<input id="edFocus" value="${esc(dr.focus)}"></label></div>
      <div class="edrow small muted"><span>Exercise</span><span>Sets</span><span>Reps</span><span></span></div>`;
      dr.exercises.forEach((e,ei)=>{h+=`<div class="edrow"><input id="exN${ei}" value="${esc(e.name)}" aria-label="Exercise name"><input id="exS${ei}" inputmode="numeric" value="${esc(e.sets)}" aria-label="Sets"><input id="exR${ei}" value="${esc(e.reps)}" aria-label="Reps"><button class="icon-btn" data-act="exDel" data-i="${ei}" aria-label="Remove exercise">×</button></div>`});
      h+=`<button class="btn ghost sm" data-act="exAdd">+ Add exercise</button><div class="row"><button class="btn primary" data-act="saveDay" style="flex:1">Save ${DAYS[i]}</button><button class="btn" data-act="cancelDay">Cancel</button></div></section>`;
    }else{
      h+=`<section class="card"><div class="row between"><span class="daytag">${DAYS_LONG[i]}${i===ti?" · today":""}</span><button class="btn ghost sm" data-act="editDay" data-i="${i}">Edit</button></div>
      <div><h2>${esc(d.name)}</h2><div class="muted small">${esc(d.focus)}</div></div>`;
      if(d.exercises.length){h+="<div>";d.exercises.forEach(e=>{h+=`<div class="split-ex"><span>${esc(e.name)}</span><span class="muted num">${esc(e.sets)} × ${esc(e.reps)}</span></div>`});h+="</div>"}
      h+="</section>";
    }
  });
  return h;
}

/* ---------- body / calorie calculator ---------- */
const ACTS=[["1.2","Desk job, little exercise"],["1.375","Light: train 1–3 days/week"],["1.55","Moderate: train 3–5 days/week"],["1.725","Very active: train 6–7 days/week"],["1.9","Athlete or physical job + training"]];
const GOALTYPES=[["cut","Cut: lose fat (−20%)"],["slowcut","Slow cut / recomp (−10%)"],["maintain","Maintain"],["leanbulk","Lean bulk (+10%)"],["bulk","Bulk (+15%)"]];
const GOALADJ={cut:-.2,slowcut:-.1,maintain:0,leanbulk:.1,bulk:.15};
function latestWeight(){const ids=Object.keys(S.docs).filter(id=>id.startsWith("log-")&&S.docs[id].weight).sort();return ids.length?S.docs[ids[ids.length-1]].weight:""}
function profile(){const p={sex:"male",age:"",height:"",hUnit:"cm",weight:"",activity:"1.55",goal:"maintain",...(S.docs.profile||{})};if(!p.weight)p.weight=latestWeight();return p}
function val(id){const el=document.getElementById(id);return el?el.value.trim():""}
function readProfile(){return {sex:val("pSex")||"male",age:val("pAge"),height:val("pH"),hUnit:val("pHU")||"cm",weight:val("pW"),activity:val("pAct")||"1.55",goal:val("pGoal")||"maintain"}}
function calcRec(p,unit){
  const age=n(p.age),h=n(p.height),w=n(p.weight);if(!age||!h||!w)return null;
  const kg=unit==="lb"?w*.4536:w,cm=p.hUnit==="in"?h*2.54:h;
  const bmr=10*kg+6.25*cm-5*age+(p.sex==="female"?-161:5),tdee=bmr*n(p.activity||1.55);
  const kcal=Math.round(tdee*(1+(GOALADJ[p.goal]??0))/10)*10;
  const pr=Math.round(kg*(p.goal==="cut"||p.goal==="slowcut"?2.2:1.8)),fat=Math.round(Math.max(kg*.7,kcal*.25/9)),carbs=Math.max(0,Math.round((kcal-pr*4-fat*9)/4));
  return {bmr:Math.round(bmr),tdee:Math.round(tdee),kcal,p:pr,c:carbs,f:fat};
}
function recHtml(p,unit,warn){const r=calcRec(p,unit);
  if(!r)return `<div class="${warn?"pill warn":"note"}">Fill in age, height and weight to see your numbers.</div>`;
  return `<div class="rec"><div><span class="k">BMR</span><span class="v">${r.bmr}</span></div><div><span class="k">Maintenance</span><span class="v">${r.tdee}</span></div><div class="hl"><span class="k">Target kcal</span><span class="v">${r.kcal}</span></div>
    <div><span class="k">Protein</span><span class="v">${r.p}g</span></div><div><span class="k">Carbs</span><span class="v">${r.c}g</span></div><div><span class="k">Fat</span><span class="v">${r.f}g</span></div></div>
    <div class="note">Estimated with the Mifflin–St Jeor formula. Treat it as a starting point: if your weight doesn't move the way you want over 2–3 weeks, adjust by about 150 kcal.</div>`}
function updRec(warn){const el=document.getElementById("rec");if(el)el.innerHTML=recHtml(readProfile(),goals().unit,warn)}

function vGoals(){
  const g=goals(),t=todayKey(),wl=logOf(t).weight;
  const pts=Object.keys(S.docs).filter(id=>id.startsWith("log-")&&S.docs[id].weight).sort().slice(-30).map(id=>({k:id.slice(4),w:+S.docs[id].weight}));
  let spark='<div class="empty">Log your weight to see your trend here.</div>';
  if(pts.length){const ws=pts.map(p=>p.w),tw=n(g.targetWeight);let mn=Math.min(...ws),mx=Math.max(...ws);if(tw){mn=Math.min(mn,tw);mx=Math.max(mx,tw)}if(mx-mn<1){mx+=.5;mn-=.5}
    const W=300,H=70,P=6,x=i=>pts.length===1?W/2:P+i*(W-2*P)/(pts.length-1),y=v=>H-P-(v-mn)/(mx-mn)*(H-2*P);
    const line=pts.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(""),last=pts[pts.length-1];
    spark=`<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Weight trend">
      ${tw?`<line x1="0" x2="${W}" y1="${y(tw)}" y2="${y(tw)}" stroke="var(--ok)" stroke-dasharray="4 4" stroke-width="1" vector-effect="non-scaling-stroke"/>`:""}
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(pts.length-1)}" cy="${y(last.w)}" r="3.5" fill="var(--accent)"/></svg>
      <div class="row between small muted"><span>${fmtDate(pts[0].k,{month:"short",day:"numeric"})}</span><span>Latest <span class="num" style="color:var(--fg)">${last.w} ${esc(g.unit)}</span>${tw?` · target ${tw} ${esc(g.unit)}`:""}</span></div>`}
  const p=profile(),opt=(v,l,cur)=>`<option value="${v}"${String(cur)===String(v)?" selected":""}>${l}</option>`;
  return `<section class="card" id="profileCard"><div><h2>Your body</h2><div class="note">Used to work out your maintenance calories and the best targets for your goal.</div></div>
    <div class="grid2">
      <label class="f" for="pSex">Sex<select id="pSex">${opt("male","Male",p.sex)}${opt("female","Female",p.sex)}</select></label>
      <label class="f" for="pAge">Age<input id="pAge" inputmode="numeric" value="${esc(p.age)}" placeholder="years"></label>
      <label class="f" for="pH">Height<div class="row" style="gap:6px"><input id="pH" inputmode="decimal" value="${esc(p.height)}" placeholder="${p.hUnit==="in"?"inches":"cm"}"><select id="pHU" style="width:76px;flex:none">${opt("cm","cm",p.hUnit)}${opt("in","in",p.hUnit)}</select></div></label>
      <label class="f" for="pW">Weight (${esc(g.unit)})<input id="pW" inputmode="decimal" value="${esc(p.weight)}" placeholder="${esc(g.unit)}"></label>
    </div>
    <label class="f" for="pAct">Activity<select id="pAct">${ACTS.map(a=>opt(a[0],a[1],p.activity)).join("")}</select></label>
    <label class="f" for="pGoal">Goal<select id="pGoal">${GOALTYPES.map(a=>opt(a[0],a[1],p.goal)).join("")}</select></label>
    <div id="rec">${recHtml(p,g.unit)}</div>
    <div class="row"><button class="btn primary" data-act="applyRec" style="flex:1">Use these targets</button><button class="btn" data-act="saveProfile">Save body stats</button></div></section>
  <section class="card"><h2>Daily targets</h2>
    <label class="f" for="gCal">Calories (kcal)<input id="gCal" inputmode="numeric" value="${esc(g.calories)}"></label>
    <div class="grid3">
      <label class="f" for="gP">Protein g<input id="gP" inputmode="numeric" value="${esc(g.protein)}"></label>
      <label class="f" for="gC">Carbs g<input id="gC" inputmode="numeric" value="${esc(g.carbs)}"></label>
      <label class="f" for="gF">Fat g<input id="gF" inputmode="numeric" value="${esc(g.fat)}"></label></div>
    <div class="grid2"><label class="f" for="gTW">Target weight<input id="gTW" inputmode="decimal" value="${esc(g.targetWeight)}" placeholder="optional"></label>
      <label class="f" for="gU">Unit<select id="gU"><option value="kg"${g.unit==="kg"?" selected":""}>kg</option><option value="lb"${g.unit==="lb"?" selected":""}>lb</option></select></label></div>
    <label class="f" for="gNote">Main goal<textarea id="gNote" placeholder="e.g. Lean bulk to 82 kg by summer, bench 100 kg">${esc(g.note)}</textarea></label>
    <button class="btn primary" data-act="saveGoals">Save goals</button>${S.docs.goals?"":'<div class="note">These are starting numbers. Set your own and save.</div>'}</section>
  <section class="card"><h2>Body weight</h2>
    <div class="row"><input id="wIn" inputmode="decimal" placeholder="${wl?"Today: "+esc(wl):"Today's weight"}" aria-label="Today's weight" style="flex:1"><button class="btn" data-act="logW">Log ${esc(g.unit)}</button></div>${spark}</section>`;
}

/* ---------- coach ---------- */
const CHIPS=["Plan today's session for me","How am I doing on protein this week?","Give me a swap for an exercise I can't do","Review my week and tell me what to fix"];
function coachGate(){
  const a=S.ai.coach,st=settings();
  if(S.gpu&&!S.gpu.ok)return `<section class="card"><h2>Coach</h2><div class="empty">This browser can't run the on-phone coach (no WebGPU). Update Chrome and open the app in Chrome on your Pixel.</div></section>`;
  if(a.state==="loading")return `<section class="card"><h2>Loading coach</h2>${progBar("coach")}<div class="note">${a.cached?"Loading from your phone's storage.":"First time only: downloading the model. Keep the app open and stay on Wi-Fi."}</div></section>`;
  return `<section class="card"><h2>Coach</h2><div class="note">The coach runs entirely on your phone using ${esc(AI.COACH_MODELS[st.coachSize].label)}. ${a.cached?"It's already downloaded.":"The first start downloads it once — use Wi-Fi."}</div>
    ${a.state==="error"?`<div class="note" style="color:var(--warn)">${esc(a.text)}</div>`:""}
    <button class="btn primary" data-act="loadCoach">${a.cached?"Start coach":"Download and start coach"}</button></section>`;
}
function vCoach(){
  if(!AI.coachReady())return coachGate();
  const turns=S.docs.coach?.turns||[];let h='<div class="chat">';
  if(!turns.length&&!S.pendingUser)h+=`<div class="msg coach">I'm your coach. I can see your split, goals, body stats, food log and the last week of training. Ask me anything, or tap a prompt below.</div>`;
  turns.forEach(t=>{h+=`<div class="msg ${t.role==="user"?"user":"coach"}">${t.role==="user"?esc(t.content):fmtMsg(t.content)}</div>`});
  if(S.pendingUser)h+=`<div class="msg user">${esc(S.pendingUser)}</div>`;
  if(S.coachBusy)h+=`<div class="msg coach" id="streamBubble">${S.stream?fmtMsg(S.stream):'<span class="muted">Thinking…</span>'}</div>`;
  h+="</div>";
  if(S.coachErr)h+=`<div class="note" style="color:var(--warn)">${esc(S.coachErr)}</div>`;
  if(!S.coachBusy)h+=`<div class="chips">${CHIPS.map((c,i)=>`<button class="chip" data-act="chip" data-i="${i}">${esc(c)}</button>`).join("")}</div>`;
  h+=`<div class="composer"><textarea id="coachIn" rows="1" placeholder="Ask your coach…" ${S.coachBusy?"disabled":""}></textarea>
    ${S.coachBusy?'<button class="btn" data-act="stop">Stop</button>':'<button class="btn primary" data-act="send">Send</button>'}</div>
    ${turns.length&&!S.coachBusy?'<button class="btn ghost sm" data-act="clearChat" style="align-self:flex-start">Clear chat</button>':""}`;
  return h;
}

/* ---------- settings ---------- */
function vSettings(){
  const st=settings(),u=S.usage;
  const sel=(id,obj,cur)=>`<select id="${id}">${Object.entries(obj).map(([k,m])=>`<option value="${k}"${k===cur?" selected":""}>${esc(m.label)}</option>`).join("")}</select>`;
  return `<section class="card"><h2>On-phone AI</h2>
    <label class="f" for="sCoach">Coach model${sel("sCoach",AI.COACH_MODELS,st.coachSize)}</label>
    <label class="f" for="sVision">Photo model${sel("sVision",AI.VISION_MODELS,st.visionSize)}</label>
    <button class="btn" data-act="saveSettings">Save model choice</button>
    <div>
      <div class="kv"><span>WebGPU</span><span class="muted">${S.gpu?(S.gpu.ok?(S.gpu.f16?"Supported (fast mode)":"Supported"):"Not available"):"Checking…"}</span></div>
      <div class="kv"><span>Coach</span><span class="muted">${AI.coachReady()?"Running":S.ai.coach.cached?"Downloaded":"Not downloaded"}</span></div>
      <div class="kv"><span>Photo model</span><span class="muted">${AI.visionReady()?"Running":"Downloads on first photo"}</span></div>
      <div class="kv"><span>Storage used</span><span class="muted">${u&&u.usage!=null?gb(u.usage)+(u.quota?" of "+gb(u.quota):""):"—"}</span></div>
    </div>
    <button class="btn ghost danger" data-act="delCoach">Delete downloaded coach model</button>
    <div class="note">Models come from public Hugging Face files and stay in this app's storage. Nothing you type or photograph leaves your phone.</div></section>
  <section class="card"><h2>Backup</h2>
    <div class="note">Your log lives only on this phone. Save a backup now and then, or before you clear Chrome's data.</div>
    <div class="row"><button class="btn primary" data-act="export" style="flex:1">Save backup file</button><button class="btn" data-act="import" style="flex:1">Restore backup</button></div>
    ${S.msg?`<div class="note">${esc(S.msg)}</div>`:""}</section>`;
}

/* ---------- AI actions ---------- */
let lastProg=0;
function onProg(kind){return (p,text)=>{const a=S.ai[kind];a.p=Math.max(0,Math.min(1,p||0));if(text)a.text=text.length>90?text.slice(0,90)+"…":text;
  const now=performance.now();if(now-lastProg<120&&a.p<1)return;lastProg=now;
  const pb=document.getElementById("pb-"+kind),pp=document.getElementById("pp-"+kind),pt=document.getElementById("pt-"+kind);
  if(pb)pb.style.width=a.p*100+"%";if(pp)pp.textContent=r0(a.p*100)+"%";if(pt)pt.textContent=a.text}}
async function ensureCoach(){
  if(AI.coachReady())return;
  const a=S.ai.coach;a.state="loading";a.p=0;a.text="Starting…";render();
  AI.persistStorage();
  try{await AI.loadCoach(settings().coachSize,onProg("coach"));a.state="ready";a.cached=true}
  catch(e){a.state="error";a.text=friendly(e);throw e}
  finally{refreshUsage();render()}
}
async function ensureVision(){
  if(AI.visionReady())return;
  const a=S.ai.vision;a.state="loading";a.p=0;a.text="Loading photo model…";render();
  AI.persistStorage();
  try{await AI.loadVision(settings().visionSize,onProg("vision"));a.state="ready"}
  catch(e){a.state="error";a.text=friendly(e);throw e}
  finally{refreshUsage();render()}
}
function friendly(e){
  const m=String(e&&e.message||e||"");
  if(e&&e.code==="no-webgpu")return m;
  if(/quota|storage/i.test(m))return "Not enough free storage on your phone for the model. Free up space or pick a smaller model in Settings.";
  if(/fetch|network|Failed to load/i.test(m))return "Download failed. Check your connection and try again.";
  if(/memory|OOM|device lost/i.test(m))return "Your phone ran out of graphics memory. Close other apps or pick a smaller model in Settings.";
  return "Something went wrong: "+m.slice(0,140);
}
async function refreshUsage(){S.usage=await AI.storageUsage()}

const EST_SYS=`You are a nutrition estimator. Given a meal, estimate total calories and macros using typical values. Reply with ONLY one JSON object, no other text, exactly like {"name":"short label","cal":520,"p":45,"c":60,"f":10} where cal is kcal and p, c, f are grams of protein, carbs and fat.`;
async function estimate(){
  const t=val("estText"),photo=S.photoFile;if((!t&&!photo)||S.estBusy)return;
  S.estBusy=true;S.estErr="";S.estStep=photo?"Looking at your photo…":"Estimating…";render();
  try{
    let desc=t;
    if(photo){
      await ensureVision();S.estStep="Looking at your photo…";render();
      const seen=await AI.describePhoto(photo);
      desc=`Foods seen in a photo of the meal:\n${seen}${t?`\nMy note about it (trust this over the photo): ${t}`:""}`;
    }
    await ensureCoach();S.estStep="Working out calories and macros…";render();
    const out=await AI.chat([{role:"system",content:EST_SYS},{role:"user",content:desc}],{maxTokens:160,temperature:.2});
    const r=AI.parseJson(out);if(!r)throw Object.assign(new Error("bad-json"),{code:"bad-json"});
    S.estBusy=false;S.estStep="";clearPhoto();render();
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v};
    set("fName",String(r.name||t||"Meal").slice(0,80));set("fCal",r0(n(r.cal)));set("fP",r0(n(r.p)));set("fC",r0(n(r.c)));set("fF",r0(n(r.f)));
    document.getElementById("fName")?.scrollIntoView({block:"center",behavior:"smooth"});
  }catch(e){S.estBusy=false;S.estStep="";S.estErr=e&&e.code==="bad-json"?"Couldn't read the estimate. Try again, or describe the food in the text box.":friendly(e);render()}
}
function clearPhoto(){if(S.photoUrl)URL.revokeObjectURL(S.photoUrl);S.photoUrl=null;S.photoFile=null}

function coachContext(){
  const sp=split(),t=todayKey(),last=[],g=goals(),pr=profile();
  for(let i=6;i>=0;i--){const k=addDays(t,-i),l=logOf(k),tt=totals(l),di=dayIdx(k);
    last.push(`${k} ${DAYS[di]} plan:${sp[di].name} done:${l.completed?"yes":"no"} sets:${Object.values(l.done||{}).filter(Boolean).length} kcal:${r0(tt.cal)} P:${r0(tt.p)} C:${r0(tt.c)} F:${r0(tt.f)}${l.weight?` weight:${l.weight}${g.unit}`:""}`)}
  const rec=calcRec(pr,g.unit);
  return [
    `Today: ${DAYS_LONG[dayIdx(t)]} ${t}. TODAY'S WORKOUT is ${sp[dayIdx(t)].name}: ${sp[dayIdx(t)].exercises.map(e=>`${e.name} ${e.sets}x${e.reps}`).join(", ")||"rest day"}. When asked about "today", talk only about this workout.`,
    `Body: ${pr.sex}, age ${pr.age||"?"}, height ${pr.height||"?"}${pr.hUnit}, weight ${pr.weight||"?"}${g.unit}, activity x${pr.activity}, goal ${pr.goal}${rec?`, maintenance ~${rec.tdee} kcal`:""}`,
    `Targets: ${g.calories} kcal, P ${g.protein}g, C ${g.carbs}g, F ${g.fat}g${g.targetWeight?`, target weight ${g.targetWeight}${g.unit}`:""}${g.note?`. Main goal: ${g.note}`:""}`,
    `Weekly split:\n`+sp.map((d,i)=>`${DAYS[i]} ${d.name}: ${d.exercises.map(e=>`${e.name} ${e.sets}x${e.reps}`).join(", ")||"rest"}`).join("\n"),
    `Today's food: ${(logOf(t).foods||[]).map(f=>`${f.name} ${r0(n(f.cal))}kcal`).join("; ")||"nothing yet"}`,
    `Last 7 days:\n`+last.join("\n"),
  ].join("\n");
}
const RULES=`You are the personal strength coach inside the user's private gym app. Be direct, encouraging and practical. Keep answers short (under 150 words) unless asked for detail. Use plain text and short dash lists. Base advice on the user's data below; if something is missing, say what you need. Don't diagnose injuries; suggest a professional for pain.`;
async function ask(text){
  if(S.coachBusy||!AI.coachReady())return;
  const turns=clone(S.docs.coach?.turns||[]);
  S.coachBusy=true;S.pendingUser=text;S.stream=null;S.coachErr="";S.ctl=new AbortController();render();main.scrollTop=main.scrollHeight;
  const messages=[{role:"system",content:RULES+"\n\nUSER DATA\n"+coachContext()},...turns.slice(-8),{role:"user",content:text}];
  let out="";
  try{
    out=await AI.chat(messages,{signal:S.ctl.signal,onText:t=>{S.stream=t;const el=document.getElementById("streamBubble");if(el){el.innerHTML=fmtMsg(t);main.scrollTop=main.scrollHeight}}});
  }catch(e){S.coachErr=friendly(e);out=S.stream||""}
  if(out){turns.push({role:"user",content:text},{role:"assistant",content:out+(S.ctl.signal.aborted?"\n\n(stopped)":"")});S.docs={...S.docs,coach:{turns:turns.slice(-40)}};persist()}
  S.coachBusy=false;S.pendingUser=null;S.stream=null;render();main.scrollTop=main.scrollHeight;
}

/* ---------- backup ---------- */
function exportBackup(){
  const blob=new Blob([JSON.stringify({app:"iron-log",version:1,exported:new Date().toISOString(),docs:S.docs},null,1)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`iron-log-backup-${todayKey()}.json`;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);S.msg="Backup saved to your Downloads.";render();
}
document.getElementById("importIn").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d||d.app!=="iron-log"||typeof d.docs!=="object")throw 0;
    if(!confirm("Replace everything in the app with this backup from "+(d.exported||"?").slice(0,10)+"?"))return;
    S.docs=d.docs;persist();S.msg="Backup restored.";render()}
  catch{S.msg="That file isn't an Iron Log backup.";render()}
});

/* ---------- events ---------- */
function updLog(k,fn){const l=clone(logOf(k));fn(l);save("log-"+k,l)}
function readDraft(){const d=S.draft;d.name=val("edName")||"Day";d.focus=val("edFocus");d.exercises=d.exercises.map((x,i)=>({name:val("exN"+i),sets:Math.max(0,Math.min(12,parseInt(val("exS"+i))||0)),reps:val("exR"+i)}))}
function go(tab){S.tab=tab;S.msg="";render();if(tab==="coach"&&!AI.coachReady()&&S.ai.coach.cached&&S.ai.coach.state==="idle")ensureCoach().catch(()=>{});if(tab==="settings")refreshUsage().then(()=>S.tab==="settings"&&render())}
document.querySelector(".tabs").addEventListener("click",e=>{const b=e.target.closest(".tab");if(b)go(b.dataset.tab)});
document.getElementById("gear").addEventListener("click",()=>go("settings"));
main.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;
  if(a==="tab")go(b.dataset.t);
  else if(a==="pick"){S.date=b.dataset.k;render()}
  else if(a==="day"){S.date=addDays(S.date,+b.dataset.n);render()}
  else if(a==="set")updLog(S.date,l=>{l.done=l.done||{};l.done[b.dataset.id]=!l.done[b.dataset.id]});
  else if(a==="complete")updLog(S.date,l=>{l.completed=!l.completed});
  else if(a==="addFood"){
    const f={name:val("fName")||"Food",cal:n(val("fCal")),p:n(val("fP")),c:n(val("fC")),f:n(val("fF"))};
    if(!f.cal&&!f.p&&!f.c&&!f.f){document.getElementById("fCal").focus();return}
    ["fName","fCal","fP","fC","fF","estText"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
    updLog(S.date,l=>{l.foods=l.foods||[];l.foods.push(f)})}
  else if(a==="delFood")updLog(S.date,l=>{l.foods.splice(+b.dataset.i,1)});
  else if(a==="photo")document.getElementById("photoIn")?.click();
  else if(a==="estimate")estimate();
  else if(a==="editDay"){S.editDay=+b.dataset.i;S.draft=clone(split()[S.editDay]);render()}
  else if(a==="cancelDay"){S.editDay=null;S.draft=null;render()}
  else if(a==="exAdd"){readDraft();S.draft.exercises.push({name:"",sets:3,reps:"10"});render();document.getElementById("exN"+(S.draft.exercises.length-1))?.focus()}
  else if(a==="exDel"){readDraft();S.draft.exercises.splice(+b.dataset.i,1);S.lastFormKey="";render()}
  else if(a==="saveDay"){readDraft();const d=S.draft;d.exercises=d.exercises.filter(x=>x.name);const days=clone(split());days[S.editDay]=d;S.editDay=null;S.draft=null;save("split",{days})}
  else if(a==="saveGoals"){save("goals",{calories:n(val("gCal"))||DEFAULT_GOALS.calories,protein:n(val("gP")),carbs:n(val("gC")),fat:n(val("gF")),targetWeight:val("gTW"),unit:val("gU")||"kg",note:val("gNote")})}
  else if(a==="applyRec"){const p=readProfile(),r=calcRec(p,goals().unit);if(!r){updRec(true);return}
    S.docs={...S.docs,profile:p,goals:{...goals(),calories:r.kcal,protein:r.p,carbs:r.c,fat:r.f}};persist();S.lastFormKey="";render()}
  else if(a==="saveProfile")save("profile",readProfile());
  else if(a==="logW"){const w=n(val("wIn"));if(!w)return;document.getElementById("wIn").value="";updLog(todayKey(),l=>{l.weight=w})}
  else if(a==="loadCoach")ensureCoach().catch(()=>{});
  else if(a==="chip")ask(CHIPS[+b.dataset.i]);
  else if(a==="send"){const t=val("coachIn");if(t){document.getElementById("coachIn").value="";ask(t)}}
  else if(a==="stop")S.ctl&&S.ctl.abort();
  else if(a==="clearChat")save("coach",{turns:[]});
  else if(a==="saveSettings"){save("settings",{coachSize:val("sCoach")||"3b",visionSize:val("sVision")||"500m"});S.ai.coach.cached=null;checkCached();S.msg="";}
  else if(a==="delCoach"){if(!confirm("Delete the downloaded coach model? It will download again next time you start the coach."))return;
    AI.deleteCoach(settings().coachSize).then(()=>{S.ai.coach={state:"idle",p:0,text:"",cached:false};return refreshUsage()}).catch(()=>{}).finally(render)}
  else if(a==="export")exportBackup();
  else if(a==="import")document.getElementById("importIn").click();
});
main.addEventListener("change",e=>{
  if(e.target.id==="photoIn"){const f=e.target.files&&e.target.files[0];if(!f)return;clearPhoto();S.photoFile=f;S.photoUrl=URL.createObjectURL(f);S.estErr="";render()}
});
main.addEventListener("input",e=>{if(e.target.closest&&e.target.closest("#profileCard"))updRec()});
main.addEventListener("keydown",e=>{if(e.target.id==="coachIn"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();main.querySelector('[data-act="send"]')?.click()}});

/* ---------- start ---------- */
async function checkCached(){S.ai.coach.cached=await AI.isCoachCached(settings().coachSize);if(S.tab==="coach"||S.tab==="settings")render()}
render();
AI.gpuInfo().then(g=>{S.gpu=g;render();checkCached()});
if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(()=>{});
