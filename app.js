(()=>{
'use strict';
const KEY='wesstudy_v1';
const defaultState={version:5.09,theme:'light',lang:'de',dashboardMode:'auto',semester:{name:'',start:'',end:'',hoursPerCredit:17,studyTargetPercent:100},subjects:[],sessions:[],holiday:null,dailyPlan:{items:[],templates:[]},nachholen:{entries:[]},timerSettings:{sound:true,vibrate:true,notifications:false,autoNext:true},studyProgress:null,meta:{updatedAt:0}};
let state=load(); let timer={running:false,paused:false,mode:'focus',round:1,totalRounds:4,focusSec:1500,breakSec:300,remaining:1500,startedAt:null,accumulatedFocus:0,interval:null,open:false};
let calDate=new Date(); let holidayDraft={days:{}}; let deferredPrompt=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');return {...structuredClone(defaultState),...raw,semester:{...defaultState.semester,...(raw.semester||{})},dailyPlan:{...defaultState.dailyPlan,...(raw.dailyPlan||{}),items:Array.isArray(raw.dailyPlan?.items)?raw.dailyPlan.items:[],templates:Array.isArray(raw.dailyPlan?.templates)?raw.dailyPlan.templates:[]},nachholen:{...defaultState.nachholen,...(raw.nachholen||{}),entries:Array.isArray(raw.nachholen?.entries)?raw.nachholen.entries:[]},timerSettings:{...defaultState.timerSettings,...(raw.timerSettings||{})}}}catch{return structuredClone(defaultState)}}
function persistLocal(syncCloud=true){state.meta={...(state.meta||{}),updatedAt:Date.now()};localStorage.setItem(KEY,JSON.stringify(state));if(syncCloud&&window.WesStudyCloud?.queueSave)window.WesStudyCloud.queueSave(structuredClone(state));}
function save(){persistLocal(true);renderAll()}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function todayISO(){const d=new Date();return localISO(d)} function localISO(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
function parseDate(s){return s?new Date(s+'T12:00:00'):null} function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function minsText(mins){mins=Math.max(0,Math.round(mins));return `${Math.floor(mins/60)}:${String(mins%60).padStart(2,'0')}`}
function hoursText(mins,digits=1){return `${(Math.max(0,mins)/60).toFixed(digits)} Std.`}
function fmtDate(s){if(!s)return '—';return new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',year:'numeric'}).format(parseDate(s))}
function daysInclusive(a,b){if(!a||!b)return 0;return Math.max(0,Math.floor((parseDate(b)-parseDate(a))/86400000)+1)}
function overlapDate(date,start,end){return !!date&&!!start&&!!end&&date>=start&&date<=end}
function subjectRequired(s){return Number(s.credits||0)*Number(state.semester.hoursPerCredit||17)*60}
function isMakeupSession(x){return x?.studyType==='makeup'}
function studiedForSubject(id){return state.sessions.filter(x=>x.subjectId===id&&!isMakeupSession(x)).reduce((a,x)=>a+Number(x.minutes||0),0)}
function totalRequired(){return state.subjects.reduce((a,s)=>a+subjectRequired(s),0)}
function totalStudied(){return state.sessions.filter(x=>!isMakeupSession(x)).reduce((a,x)=>a+Number(x.minutes||0),0)}
function totalAllStudied(){return state.sessions.reduce((a,x)=>a+Number(x.minutes||0),0)}
function totalRemaining(){return Math.max(0,totalRequired()-totalStudied())}
function makeupEntries(){state.nachholen=state.nachholen||{entries:[]};state.nachholen.entries=Array.isArray(state.nachholen.entries)?state.nachholen.entries:[];return state.nachholen.entries}
function makeupTotalMins(){return makeupEntries().reduce((a,x)=>a+Number(x.minutes||0),0)}
function makeupStudyMins(subjectId=null){return state.sessions.filter(x=>isMakeupSession(x)&&(!subjectId||x.subjectId===subjectId)).reduce((a,x)=>a+Number(x.minutes||0),0)}
function makeupRequiredForSubject(id){return makeupEntries().filter(x=>x.subjectId===id).reduce((a,x)=>a+Number(x.minutes||0),0)}
function makeupLegacyDoneForSubject(id){return makeupEntries().filter(x=>x.subjectId===id&&x.done).reduce((a,x)=>a+Number(x.minutes||0),0)}
function makeupDoneForSubject(id){const req=makeupRequiredForSubject(id);return Math.min(req,makeupLegacyDoneForSubject(id)+makeupStudyMins(id))}
function makeupOpenForSubject(id){return Math.max(0,makeupRequiredForSubject(id)-makeupDoneForSubject(id))}
function makeupDoneMins(){let sum=0;const ids=new Set(makeupEntries().map(x=>x.subjectId).filter(Boolean));ids.forEach(id=>sum+=makeupDoneForSubject(id));sum+=makeupEntries().filter(x=>!x.subjectId&&x.done).reduce((a,x)=>a+Number(x.minutes||0),0);return Math.min(makeupTotalMins(),sum)}
function makeupOpenMins(){return Math.max(0,makeupTotalMins()-makeupDoneMins())}
function makeupForSubject(id,openOnly=false){return openOnly?makeupOpenForSubject(id):makeupRequiredForSubject(id)}
function makeupForSource(date,sourceKey){return makeupEntries().find(x=>x.date===date&&x.sourceKey===sourceKey)}
function addMakeupEntry({title,date='',minutes,sourceKey=null,subjectId=null,type='missed'}){minutes=Math.max(0,Math.round(Number(minutes||0)));type=type==='semester'?'semester':'missed';if(!title||minutes<=0)return false;if(type==='missed'&&!date)return false;if(sourceKey&&makeupForSource(date,sourceKey))return false;makeupEntries().push({id:uid(),title:String(title).trim(),date:type==='semester'?'':date,minutes,sourceKey,subjectId:subjectId||null,type,done:false,createdAt:new Date().toISOString()});return true}
function totalRequiredWithMakeup(){return totalRequired()+makeupTotalMins()}
function studyTargetPercent(){return clamp(Number(state.semester?.studyTargetPercent??100)||100,1,100)}
function baseStudyTargetMins(){return totalRequired()*(studyTargetPercent()/100)}
function studyTargetMins(){return baseStudyTargetMins()+makeupTotalMins()}
function studyTargetRemaining(){return Math.max(0,baseStudyTargetMins()-totalStudied())+makeupOpenMins()}
function semesterStudyTargetMins(){const baseTarget=baseStudyTargetMins(),baseSemester=Math.max(0,baseTarget-Math.min(baseTarget,holidayPlannedMins()));return baseSemester+makeupOpenMins()}
function relevantStudyDays(){const start=state.semester.start,end=state.semester.end;if(!start||!end)return 0;const from=todayISO()>start?todayISO():start;return daysInclusive(from,end)}
function dailyNeed(){const d=relevantStudyDays();return d?studyTargetRemaining()/d:0}
function sessionsOn(date){return state.sessions.filter(x=>x.date===date).reduce((a,x)=>a+Number(x.minutes||0),0)}
function weekStart(d=new Date()){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return localISO(x)}
function periodMins(start,end){return state.sessions.filter(x=>x.date>=start&&x.date<=end).reduce((a,x)=>a+Number(x.minutes||0),0)}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function holidayPlannedMins(){return state.holiday?Object.values(state.holiday.days||{}).reduce((a,h)=>a+Number(h)*60,0):0}
function holidayDoneMins(){if(!state.holiday)return 0;return state.sessions.filter(x=>overlapDate(x.date,state.holiday.start,state.holiday.end)).reduce((a,x)=>a+Number(x.minutes||0),0)}
function isHolidayStudyDate(date=todayISO()){return !!state.holiday&&overlapDate(date,state.holiday.start,state.holiday.end)}
function plannedShareForSubject(s){const total=totalRequired();return total?holidayPlannedMins()*(subjectRequired(s)/total):0}

function automaticDashboardMode(){const t=todayISO();if(state.holiday&&overlapDate(t,state.holiday.start,state.holiday.end))return 'holiday';if(state.semester.start&&state.semester.end&&overlapDate(t,state.semester.start,state.semester.end))return 'semester';if(state.semester.start&&t<state.semester.start)return 'holiday';return 'semester'}
function activeDashboardMode(){return state.dashboardMode==='holiday'||state.dashboardMode==='semester'?state.dashboardMode:automaticDashboardMode()}
function daysUntil(date){if(!date)return null;return Math.max(0,Math.ceil((parseDate(date)-parseDate(todayISO()))/86400000))}
function holidayFuturePlanDays(){if(!state.holiday)return [];return Object.entries(state.holiday.days||{}).filter(([d])=>d>=todayISO()&&d<=state.holiday.end).sort(([a],[b])=>a.localeCompare(b))}
function holidayDailyNeed(){const rem=Math.max(0,holidayPlannedMins()-holidayDoneMins()),days=holidayFuturePlanDays().length;return days?rem/days:0}
function holidayPlannedToDate(){if(!state.holiday)return 0;const today=todayISO();return Object.entries(state.holiday.days||{}).filter(([date])=>date<=today).reduce((sum,[,hours])=>sum+Number(hours||0)*60,0)}
function holidayDoneToDate(){if(!state.holiday)return 0;const today=todayISO();return state.sessions.filter(x=>x.date<=today&&overlapDate(x.date,state.holiday.start,state.holiday.end)).reduce((sum,x)=>sum+Number(x.minutes||0),0)}
function holidayPlanPosition(){return holidayDoneToDate()-holidayPlannedToDate()}
function totalPlanExpectedToDate(){const s=state.semester,today=todayISO(),personalTarget=studyTargetMins(),holidayTarget=Math.min(personalTarget,holidayPlannedMins());let expectedHoliday=0;if(state.holiday){expectedHoliday=today>=state.holiday.end?holidayTarget:Math.min(holidayTarget,holidayPlannedToDate())}if(!s.start||!s.end||today<s.start)return expectedHoliday;const totalDays=daysInclusive(s.start,s.end);if(!totalDays)return expectedHoliday;const elapsed=Math.min(totalDays,daysInclusive(s.start,today));const semesterTarget=Math.max(0,personalTarget-holidayTarget);return holidayTarget+semesterTarget*(elapsed/totalDays)}
function totalPlanPosition(){return totalStudied()-totalPlanExpectedToDate()}
function renderAll(){applyTheme();renderSemester();renderSubjects();renderHome();renderDailyStudyTracking();renderHoliday();renderHistory();renderDailyPlan();populateSubjectSelects()}
function applyTheme(){document.documentElement.dataset.theme=state.theme;const b=$('#themeBtn');if(b){b.setAttribute('aria-label',state.theme==='dark'?'Helles Design aktivieren':'Dunkles Design aktivieren');b.setAttribute('title',state.theme==='dark'?'Helles Design':'Dunkles Design')}}
function renderSemester(){const sem=state.semester;$('#hoursPerCreditText').textContent=sem.hoursPerCredit||17;$('#setupNotice').style.display=sem.start&&sem.end?'none':'block'}
function subjectHTML(s,compact=false){const req=subjectRequired(s),done=studiedForSubject(s.id),rem=Math.max(0,req-done),p=req?clamp(done/req*100,0,100):0,mTotal=makeupForSubject(s.id),mOpen=makeupForSubject(s.id,true),mDone=Math.max(0,mTotal-mOpen);return `<div class="subject"><div class="subject-head"><div class="subject-title"><span class="dot" style="background:${esc(s.color)}"></span><div><strong>${esc(s.name)}</strong><div class="muted" style="font-size:.78rem">${s.credits} CP · ${hoursText(req)}</div></div></div>${compact?'':`<div class="subject-actions"><button class="mini-btn" data-add-makeup-subject="${s.id}" title="Nachholen hinzufügen"></button><button class="mini-btn" data-edit-subject="${s.id}">Bearbeiten</button><button class="mini-btn" data-delete-subject="${s.id}">Löschen</button></div>`}</div><div class="progress" style="margin-top:12px"><i style="width:${p}%"></i></div><div class="metrics"><span class="pill">Erledigt ${hoursText(done)}</span><span class="pill">Verbleibend ${hoursText(rem)}</span><span class="pill">${p.toFixed(0)}%</span>${mTotal?`<span class="pill">Nachholen gesamt ${hoursText(mTotal)}</span><span class="pill">Offen ${hoursText(mOpen)}</span><span class="pill">Nachgeholt ${hoursText(mDone)}</span>`:''}</div></div>`}
function renderSubjects(){
 const el=$('#subjectsList');
 el.innerHTML=state.subjects.length?state.subjects.map(s=>subjectHTML(s)).join(''):`<div class="card empty"><div class="emoji"></div><h3>Füge dein erstes Fach hinzu</h3><p>Gib Fachname und Credits ein; die benötigte Lernzeit wird automatisch berechnet.</p><button class="btn primary" data-open="subjectDialog">Fach hinzufügen</button></div>`;
 $('#subCredits').textContent=state.subjects.reduce((a,s)=>a+Number(s.credits),0);$('#subRequired').textContent=hoursText(totalRequired());$('#subStudied').textContent=hoursText(totalStudied());$('#subRemaining').textContent=hoursText(totalRemaining());
 const mm=document.getElementById('subjectsMakeupMetrics');if(mm)mm.innerHTML=`<span class="pill">Nachholen gesamt ${hoursText(makeupTotalMins())}</span><span class="pill">Nachgeholt ${hoursText(makeupDoneMins())}</span><span class="pill">Nachholen offen ${hoursText(makeupOpenMins())}</span><span class="pill">Gesamtbedarf inkl. Nachholen ${hoursText(totalRequiredWithMakeup())}</span>`;
 const ml=document.getElementById('subjectsMakeupList');if(!ml)return;
 const ids=[...new Set(makeupEntries().map(x=>x.subjectId).filter(Boolean))];
 ml.innerHTML=ids.length?ids.map(id=>{const sub=state.subjects.find(s=>s.id===id),total=makeupRequiredForSubject(id),studied=makeupStudyMins(id)+makeupLegacyDoneForSubject(id),credited=makeupDoneForSubject(id),open=makeupOpenForSubject(id),pct=total?clamp(credited/total*100,0,100):0,entries=makeupEntries().filter(x=>x.subjectId===id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));return `<div class="subject"><div class="subject-head"><div class="subject-title"><span class="dot" style="background:${esc(sub?.color||'#6d5dfc')}"></span><div><strong> ${esc(sub?.name||'Gelöschtes Fach')}</strong><div class="muted" style="font-size:.78rem">Nachholbedarf · wie ein eigener Lernfortschritt</div></div></div><div class="subject-actions"><button class="mini-btn" data-add-makeup-session="${id}" title="Nachhol-Session hinzufügen">+ Session</button><button class="mini-btn" data-add-makeup-subject="${id}" title="Weiteren Nachholbedarf hinzufügen">＋ Bedarf</button></div></div><div class="progress good" style="margin-top:12px"><i style="width:${pct}%"></i></div><div class="metrics"><span class="pill">Gesamt ${hoursText(total)}</span><span class="pill">Nachgeholt ${hoursText(studied)}</span><span class="pill">Offen ${hoursText(open)}</span><span class="pill">${pct.toFixed(0)}%</span></div><div class="makeup-list">${entries.map(x=>`<div class="makeup-row"><div><strong>${esc(x.title)}</strong><small>${x.type==='semester'?'Semester-Nachholbedarf':fmtDate(x.date)} · ${minsText(x.minutes)}</small></div><div class="makeup-actions"><button class="mini-btn" data-edit-makeup="${x.id}" title="Nachholbedarf bearbeiten">Bearbeiten</button><button class="mini-btn" data-sub-makeup-delete="${x.id}" title="Nachholbedarf löschen">Löschen</button></div></div>`).join('')}</div></div>`}).join(''):`<div class="muted" style="text-align:center;padding:10px">Noch keine Nachholstunden eingetragen.</div>`;
}
function renderHome(){
 const req=totalRequired(),target=studyTargetMins(),done=totalStudied()+makeupDoneMins(),rem=studyTargetRemaining(),p=target?clamp(done/target*100,0,100):0,mode=activeDashboardMode(),today=todayISO(),todayMins=sessionsOn(today);
 const todayPlannedHours=mode==='holiday'?Number(state.holiday?.days?.[today]||0):Number(state.semesterPlan?.days?.[today]||0),todayPlannedMins=todayPlannedHours*60;$('#todayPlanned').textContent=minsText(todayPlannedMins);$('#todayPlannedStatus').textContent=todayPlannedMins?(todayMins>=todayPlannedMins?'Geplante Lernzeit erreicht':`Noch ${minsText(Math.max(0,todayPlannedMins-todayMins))} von deinem Tagesplan`):'Für heute nichts geplant';
 $$('#dashboardMode button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 $('#heroStudied').textContent=hoursText(done);$('#heroRemaining').textContent=`vom Lernziel verbleibend ${hoursText(rem)}`;$('#overallPercent').textContent=`${p.toFixed(0)}%`;$('#overallRing').style.setProperty('--p',p);
 const targetPct=studyTargetPercent(),baseTarget=baseStudyTargetMins(),holidayForTarget=Math.min(baseTarget,holidayPlannedMins()),semesterTarget=Math.max(0,baseTarget-holidayForTarget)+makeupOpenMins(),semesterPlanned=Object.values(state.semesterPlan?.days||{}).reduce((a,h)=>a+Number(h||0)*60,0),semesterOpen=Math.max(0,semesterTarget-semesterPlanned);
 const targetInput=document.getElementById('studyTargetPercentInput');if(targetInput&&document.activeElement!==targetInput)targetInput.value=String(Math.round(targetPct));
 const targetMetrics=document.getElementById('studyTargetMetrics');if(targetMetrics)targetMetrics.innerHTML=`<span class="pill">Basisbedarf ${hoursText(req)}</span><span class="pill">Nachholen gesamt ${hoursText(makeupTotalMins())}</span><span class="pill">Gesamtbedarf inkl. Nachholen ${hoursText(totalRequiredWithMakeup())}</span><span class="pill">Dein Lernziel ${targetPct.toFixed(0)}% + Nachholen = ${hoursText(target)}</span><span class="pill">Nachholen offen ${hoursText(makeupOpenMins())}</span><span class="pill">Ferien geplant ${hoursText(holidayForTarget)}</span><span class="pill">Im Semester einzuplanen ${hoursText(semesterTarget)}</span><span class="pill">Semester noch offen ${hoursText(semesterOpen)}</span>`;
 if(mode==='holiday'){
   const h=state.holiday,plan=holidayPlannedMins(),hDone=holidayDoneMins(),hRem=Math.max(0,plan-hDone),hDaily=holidayDailyNeed();
   document.getElementById('dailyNeedLabel')&&(document.getElementById('dailyNeedLabel').textContent='Pro geplantem Ferientag');document.getElementById('dailyNeed')&&(document.getElementById('dailyNeed').textContent=minsText(hDaily));document.getElementById('dailyNeedHint')&&(document.getElementById('dailyNeedHint').textContent='Automatisch nach verbleibenden Plantagen');
   $('#weeklyNeedLabel').textContent='Ferienplan verbleibend';$('#weeklyNeed').textContent=minsText(hRem);$('#weeklyNeedHint').textContent=`Von ${minsText(plan)} geplant`;
   $('#todayStudiedLabel').textContent='Heute in den Ferien gelernt';$('#todayStudied').textContent=minsText(todayMins);$('#todayStatus').textContent=isHolidayStudyDate(today)?(todayMins?'Wird vollständig im Ferienfortschritt erfasst':'Heute zählt automatisch zum Ferienfortschritt'):'Außerhalb des eingetragenen Ferienzeitraums';
   $('#semesterPreview').classList.remove('hidden');const plannedHoliday=Math.min(baseStudyTargetMins(),holidayPlannedMins()),projectedSemesterRemaining=Math.max(0,baseStudyTargetMins()-plannedHoliday)+makeupOpenMins(),semesterDays=state.semester.start&&state.semester.end?daysInclusive(state.semester.start,state.semester.end):0,projectedDaily=semesterDays?projectedSemesterRemaining/semesterDays:0;$('#previewRequired').textContent=`Gesamtbedarf inkl. Nachholen ${hoursText(totalRequiredWithMakeup())}`;const previewTarget=document.getElementById('previewTarget');if(previewTarget)previewTarget.textContent=`Lernziel ${studyTargetPercent().toFixed(0)}% = ${hoursText(target)}`;$('#previewHolidayPlanned').textContent=`Ferien geplant ${hoursText(plannedHoliday)}`;$('#previewRemaining').textContent=`Im Semester ${hoursText(projectedSemesterRemaining)}`;$('#previewDaily').textContent=`${minsText(projectedDaily)}/Tag im Semester`;$('#previewWeekly').textContent=`${minsText(projectedDaily*7)}/Woche`;
   const startDays=daysUntil(state.semester.start);$('#countdownNumber').textContent=startDays===null?'—':startDays;$('#countdownTitle').textContent=startDays===0?'Das Semester beginnt heute':`Noch ${startDays??'—'} Tage bis Semesterbeginn`;$('#countdownDate').textContent=state.semester.start?fmtDate(state.semester.start):'Semesterbeginn noch nicht festgelegt';
 }else{
   const dNeed=dailyNeed();document.getElementById('dailyNeedLabel')&&(document.getElementById('dailyNeedLabel').textContent='Täglich erforderlich');document.getElementById('dailyNeed')&&(document.getElementById('dailyNeed').textContent=minsText(dNeed));document.getElementById('dailyNeedHint')&&(document.getElementById('dailyNeedHint').textContent='Wird täglich aus Reststunden und Resttagen neu berechnet');
   $('#weeklyNeedLabel').textContent='Wöchentlich erforderlich';$('#weeklyNeed').textContent=minsText(dNeed*7);$('#weeklyNeedHint').textContent='Um im Plan zu bleiben';
   $('#todayStudiedLabel').textContent='Heute gelernt';$('#todayStudied').textContent=minsText(todayMins);$('#todayStatus').textContent=todayMins>=dNeed&&dNeed>0?'Tagesziel erreicht':todayMins?`verbleibend ${minsText(Math.max(0,dNeed-todayMins))}`:'Starte deine erste Session';
   $('#semesterPreview').classList.add('hidden');const endDays=daysUntil(state.semester.end);$('#countdownNumber').textContent=endDays===null?'—':endDays;$('#countdownTitle').textContent=endDays===0?'Das Semester endet heute':`Noch ${endDays??'—'} Tage bis Semesterende`;$('#countdownDate').textContent=state.semester.end?fmtDate(state.semester.end):'Semesterende noch nicht festgelegt';
 }
 const pos=mode==='holiday'?holidayPlanPosition():totalPlanPosition();const planName=mode==='holiday'?'Ferienplan':'Gesamtplan';if(Math.abs(pos)<1){$('#planStatus').textContent=`Du bist genau im ${planName}`}else{$('#planStatus').textContent=pos>0?`Du bist ${hoursText(pos)} vor dem ${planName}`:`Du bist ${hoursText(Math.abs(pos))} hinter dem ${planName}`};$('#planStatus').className='dashboard-status '+(pos>=0?'good':'bad');
 $('#creditsTotal').textContent=`${state.subjects.reduce((a,s)=>a+Number(s.credits),0)} CP`;$('#subjectsCount').textContent=`${state.subjects.length} Fächer`;$('#homeSubjects').innerHTML=state.subjects.length?state.subjects.slice().sort((a,b)=>(subjectRequired(b)-studiedForSubject(b.id))-(subjectRequired(a)-studiedForSubject(a.id))).slice(0,3).map(s=>subjectHTML(s,true)).join(''):`<div class="empty">Noch keine Fächer vorhanden</div>`;renderRecent()
}
function renderRecent(){const rows=state.sessions.slice().sort((a,b)=>(b.date+b.createdAt).localeCompare(a.date+a.createdAt)).slice(0,5);$('#recentSessions').innerHTML=rows.length?rows.map(x=>sessionHTML(x,true)).join(''):`<div class="empty">Noch keine Sessions vorhanden</div>`}
function hexToRgba(hex,alpha=.14){
  const h=String(hex||'').trim().replace('#','');
  if(!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(h)) return alpha>=1?'rgb(109,93,252)':`rgba(109,93,252,${alpha})`;
  const full=h.length===3?h.split('').map(c=>c+c).join(''):h;
  const num=parseInt(full,16),r=(num>>16)&255,g=(num>>8)&255,b=num&255;
  return alpha>=1?`rgb(${r},${g},${b})`:`rgba(${r},${g},${b},${alpha})`;
}
function subjectIconType(name=''){
  const n=String(name||'').toLowerCase();
  if(/mikro|micro|informatik|info\b/.test(n)) return 'computer';
  if(/hm\s*\d|mathem|numerisch/.test(n)) return 'math';
  if(/regel|control/.test(n)) return 'control';
  if(/robot/.test(n)) return 'robot';
  if(/bionik|bio/.test(n)) return 'leaf';
  if(/fertig|produktion|entwicklung/.test(n)) return 'tool';
  if(/bauelement|et\s*\d|elektr|sensor|aktor/.test(n)) return 'circuit';
  if(/tm\s*\d|mechanik|fem/.test(n)) return 'gear';
  if(/cad/.test(n)) return 'cube';
  if(/qualität/.test(n)) return 'check';
  if(/projekt|praxis|bachelor/.test(n)) return 'briefcase';
  return 'book';
}
function sessionSymbol(kind='book'){
  if(kind==='makeup') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8V4m0 0H2m4 0 3 3M18 16v4m0 0h4m-4 0-3-3M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const icons={
    computer:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 20h6M12 16v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    math:'<svg viewBox="0 0 24 24"><path d="M17 5H8l5 7-5 7h9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    control:'<svg viewBox="0 0 24 24"><path d="M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6M7 14v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="13" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    robot:'<svg viewBox="0 0 24 24"><path d="M6 18h4m4 0h4M8 18v-4l4-3 3 2 2-4M12 11V7l3-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    leaf:'<svg viewBox="0 0 24 24"><path d="M19 5c-7 0-12 3-12 8 0 3 2 5 5 5 5 0 7-6 7-13Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 19c2-4 5-7 10-10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    tool:'<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 2-3-3 2-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    circuit:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 3v5m4-5v5m-4 8v5m4-5v5M3 10h5m-5 4h5m8-4h5m-5 4h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cube:'<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8 12 2.6 2.6L16 9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    briefcase:'<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 7V5h6v2M4 12h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    book:'<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5v15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  return icons[kind]||icons.book;
}
function sessionIconHTML(color='#6d5dfc',kind='book'){
  const bg=hexToRgba(color,.14),bd=hexToRgba(color,.22);
  return `<div class="session-icon" style="background:${bg};color:${esc(color)};border-color:${bd}">${sessionSymbol(kind)}</div>`;
}
function statusSymbol(kind='good'){
  if(kind==='warn') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8v4l2.5 1.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if(kind==='bad') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';
  if(kind==='neutral') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.1" fill="currentColor"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12 3 3 7-8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function sessionHTML(x,actions=false){
  const s=state.subjects.find(y=>y.id===x.subjectId),mk=isMakeupSession(x),color=s?.color||'#6d5dfc';
  return `<div class="session-row">${sessionIconHTML(color,mk?'makeup':subjectIconType(s?.name))}<div class="session-info"><strong>${esc(s?.name||'Gelöschtes Fach')}</strong><div class="session-meta"><span>${fmtDate(x.date)} · ${minsText(x.minutes)}</span><span>${mk?'Nachholzeit':'Normales Lernen'}</span></div></div>${actions?`<div class="session-actions"><button class="mini-btn" data-edit-session="${x.id}">Bearbeiten</button><button class="mini-btn" data-delete-session="${x.id}">Löschen</button></div>`:''}</div>`}
function subjectOptionsForStudyType(type,current=''){const list=type==='makeup'?state.subjects.filter(s=>makeupRequiredForSubject(s.id)>0):state.subjects;const html=list.length?list.map(s=>`<option value="${s.id}">${esc(s.name)}${type==='makeup'?` · offen ${minsText(makeupOpenForSubject(s.id))}`:''}</option>`).join(''):`<option value="">${type==='makeup'?'Noch kein Nachholbedarf vorhanden':'Füge zuerst ein Fach hinzu'}</option>`;return {html,list,current:list.some(s=>s.id===current)?current:(list[0]?.id||'')}}
function updateStudySubjectSelect(typeId,subjectId){const type=document.getElementById(typeId)?.value||'normal',el=document.getElementById(subjectId);if(!el)return;const old=el.value,r=subjectOptionsForStudyType(type,old);el.innerHTML=r.html;el.value=r.current;if(typeId==='manualStudyType'){const h=document.getElementById('manualStudyHint');if(h)h.textContent=type==='makeup'?'Diese Session reduziert den offenen Nachholbedarf des gewählten Fachs und zählt nicht doppelt zum normalen Fachfortschritt.':'Diese Zeit zählt zum normalen Lernfortschritt des Fachs.'}}
function populateSubjectSelects(){const options=state.subjects.length?state.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join(''):'<option value="">Füge zuerst ein Fach hinzu</option>';for(const id of ['makeupSubject']){const el=document.getElementById(id);if(!el)continue;const old=el.value;el.innerHTML=options;if([...el.options].some(o=>o.value===old))el.value=old}updateStudySubjectSelect('manualStudyType','manualSubject');updateStudySubjectSelect('dailyStudyType','dailyStudySubject')}
function renderHoliday(){const h=state.holiday;$('#holidayEmpty').classList.toggle('hidden',!!h);$('#holidayContent').classList.toggle('hidden',!h);if(!h)return;const plan=holidayPlannedMins(),done=holidayDoneMins(),rem=Math.max(0,plan-done),p=plan?clamp(done/plan*100,0,100):0;$('#holidayPlanned').textContent=hoursText(plan);$('#holidayDone').textContent=hoursText(done);$('#holidayRemaining').textContent=hoursText(rem);$('#holidayDays').textContent=Object.keys(h.days||{}).length;$('#holidayName').textContent=h.name;$('#holidayDates').textContent=`${fmtDate(h.start)} – ${fmtDate(h.end)}`;$('#holidayProgress').style.width=p+'%';const future=Object.entries(h.days||{}).filter(([d])=>d>=todayISO()).sort(([a],[b])=>a.localeCompare(b));const semesterDays=state.semester.start&&state.semester.end?daysInclusive(state.semester.start,state.semester.end):0,personalTarget=studyTargetMins(),forecastSemesterRemaining=Math.max(0,personalTarget-Math.min(personalTarget,plan)),forecastDaily=semesterDays?forecastSemesterRemaining/semesterDays:0;$('#holidayMetrics').innerHTML=`<span class="pill">Fortschritt ${p.toFixed(0)}%</span><span class="pill">Erforderlich an den verbleibenden Tagen ${future.length?hoursText(rem/future.length):'0 Std.'}</span><span class="pill">Bei vollständigem Ferienplan: ${hoursText(forecastSemesterRemaining)} im Semester</span><span class="pill">Prognose Semester: ${minsText(forecastDaily)}/Tag · ${minsText(forecastDaily*7)}/Woche</span>`;$('#holidayUpcoming').innerHTML=future.length?future.slice(0,10).map(([d,hours])=>`<div class="holiday-day-row"><strong>${fmtDate(d)}</strong><span class="muted" style="margin-inline-start:auto">${hours} Std. Geplant · ${hoursText(sessionsOn(d))} erledigt</span></div>`).join(''):`<div class="empty">Keine kommenden Tage im Plan</div>`;$('#holidaySubjects').innerHTML=state.subjects.length?state.subjects.map(s=>{const req=subjectRequired(s),doneS=studiedForSubject(s.id),share=plannedShareForSubject(s);return `<div class="subject"><div class="subject-head"><div class="subject-title"><span class="dot" style="background:${s.color}"></span><strong>${esc(s.name)}</strong></div></div><div class="metrics"><span class="pill">Tatsächlich verbleibend ${hoursText(Math.max(0,req-doneS))}</span><span class="pill">Geschätzter Anteil aus dem Ferienplan ${hoursText(share)}</span><span class="pill">Voraussichtlich verbleibend nach dem Plan ${hoursText(Math.max(0,req-doneS-share))}</span></div></div>`}).join(''):`<div class="empty">Füge zuerst Fächer hinzu</div>`}
function renderHistory(){const today=todayISO(),ws=weekStart(),we=localISO(new Date(parseDate(ws).getTime()+6*86400000)),ms=today.slice(0,7)+'-01',me=today.slice(0,7)+'-31';$('#histToday').textContent=minsText(periodMins(today,today));$('#histWeek').textContent=minsText(periodMins(ws,we));$('#histMonth').textContent=minsText(periodMins(ms,me));$('#histAll').textContent=minsText(totalAllStudied());const rows=state.sessions.slice().sort((a,b)=>(b.date+(b.createdAt||'')).localeCompare(a.date+(a.createdAt||'')));$('#historyList').innerHTML=rows.length?rows.map(x=>sessionHTML(x,true)).join(''):`<div class="empty"><div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><h3>Der Verlauf ist leer</h3><p>Füge eine Session manuell hinzu.</p></div>`}
function renderTimerMeta(){const badge=$('#timerHolidayBadge');badge.classList.toggle('hidden',!isHolidayStudyDate());renderRounds()}
function renderRounds(){const n=Number($('#roundCount')?.value||timer.totalRounds||1);$('#rounds').innerHTML=Array.from({length:n},(_,i)=>`<span class="round ${i+1<timer.round?'done':i+1===timer.round?'current':''}"></span>`).join('')}

function nav(page){$$('.page').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$$('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.nav===page));scrollTo({top:0,behavior:'smooth'});if(page==='dayplan')renderDailyPlan()}
function openDialog(id){const d=$('#'+id);if(id==='semesterDialog'){const s=state.semester;$('#semesterName').value=s.name||'';$('#semesterStart').value=s.start||'';$('#semesterEnd').value=s.end||'';$('#hoursPerCredit').value=s.hoursPerCredit||17}if(id==='subjectDialog'&&!$('#subjectId').value){$('#subjectForm').reset();$('#subjectColor').value='#6d5dfc';$('#subjectId').value='';$('#subjectModalTitle').textContent='Fach hinzufügen'}if(id==='holidayDialog')prepareHolidayDialog();if(id==='manualSessionDialog'&&!$('#manualSessionId').value){$('#manualSessionForm').reset();$('#manualStudyType').value='normal';$('#manualDate').value=todayISO();$('#manualSessionTitle').textContent='Session manuell hinzufügen';populateSubjectSelects()}d.showModal()}

$('#semesterForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return; e.preventDefault();const start=$('#semesterStart').value,end=$('#semesterEnd').value;if(end<start)return toast('Das Enddatum muss nach dem Startdatum liegen.');state.semester={name:$('#semesterName').value.trim(),start,end,hoursPerCredit:Number($('#hoursPerCredit').value)};save();$('#semesterDialog').close();toast('Semester wurde gespeichert')});
$('#subjectForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const id=$('#subjectId').value;const data={id:id||uid(),name:$('#subjectName').value.trim(),credits:Number($('#subjectCredits').value),color:$('#subjectColor').value,start:$('#subjectStart').value,end:$('#subjectEnd').value};if(data.end&&data.start&&data.end<data.start)return toast('Das Enddatum des Fachs ist ungültig.');if(id)state.subjects=state.subjects.map(s=>s.id===id?data:s);else state.subjects.push(data);save();$('#subjectDialog').close();$('#subjectId').value='';toast(id?'Fach wurde bearbeitet':'Fach wurde hinzugefügt')});
function editSubject(id){const s=state.subjects.find(x=>x.id===id);if(!s)return;$('#subjectId').value=s.id;$('#subjectName').value=s.name;$('#subjectCredits').value=s.credits;$('#subjectColor').value=s.color;$('#subjectStart').value=s.start||'';$('#subjectEnd').value=s.end||'';$('#subjectModalTitle').textContent='Fach bearbeiten';$('#subjectDialog').showModal()}
function deleteSubject(id){const s=state.subjects.find(x=>x.id===id);if(!s||!confirm(`Fach löschen ${s.name} und alle zugehörigen Sessions?`))return;state.subjects=state.subjects.filter(x=>x.id!==id);state.sessions=state.sessions.filter(x=>x.subjectId!==id);makeupEntries().forEach(x=>{if(x.subjectId===id)x.subjectId=null});save();toast('Fach wurde gelöscht')}

function prepareHolidayDialog(){const h=state.holiday;$('#holidayInputName').value=h?.name||'';$('#holidayStart').value=h?.start||'';$('#holidayEnd').value=h?.end||'';holidayDraft={days:{...(h?.days||{})}};calDate=parseDate(h?.start)||new Date();renderCalendar();renderSelectedHolidayDays()}
function renderCalendar(){const y=calDate.getFullYear(),m=calDate.getMonth();$('#calTitle').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(calDate);const first=new Date(y,m,1),last=new Date(y,m+1,0);const offset=(first.getDay()+6)%7;let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="cal-head">${x}</div>`).join('');for(let i=0;i<42;i++){const d=new Date(y,m,1-offset+i),iso=localISO(d),out=d.getMonth()!==m,sel=holidayDraft.days[iso]!=null;html+=`<button type="button" class="day ${out?'out':''} ${sel?'selected':''}" data-cal-date="${iso}"><div class="num">${d.getDate()}</div>${sel?`<div class="hours">${holidayDraft.days[iso]} Std.</div>`:''}</button>`}$('#calendar').innerHTML=html}
function renderSelectedHolidayDays(){const entries=Object.entries(holidayDraft.days).sort(([a],[b])=>a.localeCompare(b));$('#selectedHolidayDays').innerHTML=entries.length?entries.map(([d,h])=>`<div class="holiday-day-row"><span>${fmtDate(d)}</span><input type="number" min="0.25" max="24" step="0.25" value="${h}" data-holiday-hours="${d}"><button type="button" class="mini-btn" data-remove-holiday-day="${d}">✕</button></div>`).join(''):`<div class="muted" style="text-align:center;padding:10px">Tippe im Kalender auf die verfügbaren Tage</div>`}
$('#holidayForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const start=$('#holidayStart').value,end=$('#holidayEnd').value;if(end<start)return toast('Das Enddatum muss nach dem Startdatum liegen.');const filtered=Object.fromEntries(Object.entries(holidayDraft.days).filter(([d])=>d>=start&&d<=end));state.holiday={name:$('#holidayInputName').value.trim(),start,end,days:filtered};save();$('#holidayDialog').close();toast('Ferienplan wurde gespeichert')});

$('#manualStudyType').addEventListener('change',()=>updateStudySubjectSelect('manualStudyType','manualSubject'));
$('#dailyStudyType').addEventListener('change',()=>updateStudySubjectSelect('dailyStudyType','dailyStudySubject'));
$('#manualSessionForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const minutes=Number($('#manualHours').value)*60+Number($('#manualMinutes').value),studyType=$('#manualStudyType').value; if(!$('#manualSubject').value||minutes<=0)return toast('Wähle ein Fach und gib eine gültige Dauer ein.');if(studyType==='makeup'&&makeupRequiredForSubject($('#manualSubject').value)<=0)return toast('Für dieses Fach ist kein Nachholbedarf eingetragen.');const id=$('#manualSessionId').value;const old=id?state.sessions.find(x=>x.id===id):null;const data={id:id||uid(),subjectId:$('#manualSubject').value,date:$('#manualDate').value,minutes:Math.round(minutes),studyType,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),source:'manual'};if(id)state.sessions=state.sessions.map(x=>x.id===id?{...x,...data}:x);else state.sessions.push(data);save();$('#manualSessionDialog').close();$('#manualSessionId').value='';$('#manualSessionTitle').textContent='Session manuell hinzufügen';toast(id?'Session wurde bearbeitet':studyType==='makeup'?'Nachhol-Session wurde hinzugefügt':'Session wurde hinzugefügt')});
function editSession(id){const x=state.sessions.find(s=>s.id===id);if(!x)return;$('#manualSessionId').value=x.id;$('#manualStudyType').value=isMakeupSession(x)?'makeup':'normal';populateSubjectSelects();$('#manualSubject').value=x.subjectId;$('#manualDate').value=x.date;$('#manualHours').value=Math.floor(x.minutes/60);$('#manualMinutes').value=x.minutes%60;$('#manualSessionTitle').textContent=isMakeupSession(x)?'Nachhol-Session bearbeiten':'Session bearbeiten';$('#manualSessionDialog').showModal()}
function deleteSession(id){if(!confirm('Diese Session löschen?'))return;state.sessions=state.sessions.filter(x=>x.id!==id);save();toast('Session wurde gelöscht')}

/* ===== WesStudy v4.4: Tagesplan ===== */
let dayPlanDate=todayISO();
const dayPlanTypes={study:['','Lernen'],makeup:['','Nachholen'],gym:['','Gym'],reading:['','Lesen'],uni:['','Uni'],work:['','Arbeit'],break:['','Pause'],other:['','Sonstiges']};
function itemCountsAsLearning(x){return ['study','makeup'].includes(x?.type)}
function plannedLearningMinutesForDate(date){return dayPlanItems(date).filter(itemCountsAsLearning).reduce((sum,x)=>sum+dayPlanDuration(x),0)}
function dailyPlanState(){if(!state.dailyPlan)state.dailyPlan={items:[],templates:[]};if(!Array.isArray(state.dailyPlan.items))state.dailyPlan.items=[];if(!Array.isArray(state.dailyPlan.templates))state.dailyPlan.templates=[];return state.dailyPlan}
function timeToMins(v){if(!v||!v.includes(':'))return 0;const [h,m]=v.split(':').map(Number);return h*60+m}
function dayPlanDuration(x){return Math.max(0,timeToMins(x.end)-timeToMins(x.start))}
function dayPlanItems(date=dayPlanDate){return dailyPlanState().items.filter(x=>x.date===date).sort((a,b)=>(a.start||'99:99').localeCompare(b.start||'99:99'))}
function studyPlanForDate(date){if(state.holiday&&overlapDate(date,state.holiday.start,state.holiday.end))return Number(state.holiday.days?.[date]||0)*60;return Number(state.semesterPlan?.days?.[date]||0)*60}
function renderDailyPlan(){const wrap=$('#dayPlanTimeline');if(!wrap)return;const d=parseDate(dayPlanDate),items=dayPlanItems(),total=items.reduce((a,x)=>a+dayPlanDuration(x),0),done=items.filter(x=>x.done).reduce((a,x)=>a+dayPlanDuration(x),0),study=items.filter(itemCountsAsLearning).reduce((a,x)=>a+dayPlanDuration(x),0),target=studyPlanForDate(dayPlanDate);$('#dayPlanDateLabel').textContent=(dayPlanDate===todayISO()?'Heute · ':'')+new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);$('#dayPlanTotal').textContent=minsText(total);$('#dayPlanDone').textContent=minsText(done);$('#dayPlanCount').textContent=items.length;$('#dayPlanStudy').textContent=minsText(study);const st=$('#dayPlanLearningStatus');if(target){const diff=target-study;st.classList.toggle('good',diff<=0);st.innerHTML=`<strong> Lernziel laut ${state.holiday&&overlapDate(dayPlanDate,state.holiday.start,state.holiday.end)?'Ferienplan':'Semesterplanung'}: ${minsText(target)}</strong><div class="muted" style="margin-top:5px">Im Tagesplan eingeplant: ${minsText(study)} · ${diff>0?`Noch ${minsText(diff)} einplanen`:'Lernziel vollständig eingeplant ✓'}</div>`}else{st.classList.remove('good');st.innerHTML=`<strong> Für diesen Tag ist kein Lernziel im Ferien-/Semesterplan eingetragen.</strong><div class="muted" style="margin-top:5px">Du kannst trotzdem Lernblöcke frei in deinen Tagesplan setzen.</div>`}wrap.innerHTML=items.length?items.map(x=>{const [icon,label]=dayPlanTypes[x.type]||dayPlanTypes.other;return `<div class="dayplan-item ${x.done?'done':''}"><div class="dayplan-time">${esc(x.start)}<div class="muted" style="font-size:.72rem">bis ${esc(x.end)}</div></div><div><div class="dayplan-title">${icon?icon+' ':''}${esc(x.title)}</div><div class="dayplan-sub">${label} · ${minsText(dayPlanDuration(x))}${x.repeatMode==='biweekly'?' · alle 2 Wochen':x.repeatMode==='weekly'?' · wöchentlich':x.repeatMode==='daily'?' · täglich':x.repeatMode==='weekdays'?' · Mo–Fr':''}</div></div><div class="dayplan-actions"><input class="dayplan-check" type="checkbox" data-dayplan-done="${x.id}" ${x.done?'checked':''} aria-label="Erledigt"><button class="mini-btn" data-dayplan-edit="${x.id}">Bearbeiten</button></div></div>`}).join(''):`<div class="card empty"><div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 3v4M16 3v4M3 10h18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><h3>Noch nichts geplant</h3><p>Füge Lernen, Gym, Lesen, Uni, Arbeit oder andere Aktivitäten hinzu.</p><button class="btn primary" id="dayPlanEmptyAdd">+ Erste Aktivität</button></div>`;renderDayTemplates()}
function changeDayPlanDate(delta){const d=parseDate(dayPlanDate);d.setDate(d.getDate()+delta);dayPlanDate=localISO(d);renderDailyPlan()}
function openDayPlanItem(id=''){
  const plan=dailyPlanState(),x=id?plan.items.find(i=>i.id===id):null;
  $('#dayPlanItemId').value=x?.id||'';
  $('#dayPlanDialogTitle').textContent=x?'Aktivität bearbeiten':'Aktivität hinzufügen';
  $('#dayPlanType').value=x?.type||'study';
  $('#dayPlanItemDate').value=x?.date||dayPlanDate;
  $('#dayPlanTitle').value=x?.title||'';
  $('#dayPlanStart').value=x?.start||'09:00';
  $('#dayPlanEnd').value=x?.end||'10:00';
  $('#dayPlanRepeat').value='none';
  $('#dayPlanRepeatUntil').value='';
  $('#deleteDayPlanItem').classList.toggle('hidden',!x);
  $('#dayPlanDialog').showModal();
}
function repeatDates(start,mode,until){
  const out=[start];
  if(mode==='none'||!until||until<start)return out;
  const first=parseDate(start),end=parseDate(until),weekday=first.getDay();
  let d=new Date(first.getTime());
  while(true){
    d=new Date(d.getTime()+86400000);
    if(d>end)break;
    const iso=localISO(d);
    const dayDiff=Math.round((d-first)/86400000);
    if(
      mode==='daily'||
      (mode==='weekdays'&&d.getDay()>=1&&d.getDay()<=5)||
      (mode==='weekly'&&d.getDay()===weekday)||
      (mode==='biweekly'&&d.getDay()===weekday&&dayDiff%14===0)
    )out.push(iso);
  }
  return out;
}
function renderDayTemplates(){const sel=$('#dayTemplateSelect');if(!sel)return;const old=sel.value,templates=dailyPlanState().templates;sel.innerHTML='<option value="">Vorlage wählen…</option>'+templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(templates.some(t=>t.id===old))sel.value=old}
$('#addDayPlanItem').onclick=()=>openDayPlanItem();$('#dayPlanPrev').onclick=()=>changeDayPlanDate(-1);$('#dayPlanNext').onclick=()=>changeDayPlanDate(1);$('#dayPlanToday').onclick=()=>{dayPlanDate=todayISO();renderDailyPlan()};
$('#dayPlanTimeline').addEventListener('click',e=>{if(e.target.id==='dayPlanEmptyAdd')return openDayPlanItem();const ed=e.target.closest('[data-dayplan-edit]');if(ed)openDayPlanItem(ed.dataset.dayplanEdit)});
$('#dayPlanTimeline').addEventListener('change',e=>{if(!e.target.matches('[data-dayplan-done]'))return;const x=dailyPlanState().items.find(i=>i.id===e.target.dataset.dayplanDone);if(x){x.done=e.target.checked;save()}});
$('#dayPlanForm').addEventListener('submit',e=>{
  if(e.submitter?.value==='cancel')return;e.preventDefault();
  const start=$('#dayPlanStart').value,end=$('#dayPlanEnd').value;
  if(timeToMins(end)<=timeToMins(start))return toast('Die Endzeit muss nach der Startzeit liegen.');
  const id=$('#dayPlanItemId').value,type=$('#dayPlanType').value,title=$('#dayPlanTitle').value.trim(),date=$('#dayPlanItemDate').value,mode=$('#dayPlanRepeat').value,until=$('#dayPlanRepeatUntil').value;
  if(!title||!date)return;
  const plan=dailyPlanState(),affected=new Set();
  if(id){
    const x=plan.items.find(i=>i.id===id);
    if(x){
      const sameGroup=plan.items.filter(i=>i.groupId&&i.groupId===x.groupId);
      let editSeries=false;
      if(sameGroup.length>1){
        const a=prompt('Bearbeiten:\n1 = Nur diesen Termin\n2 = Ganze Serie', '1');
        if(a===null)return;
        editSeries=String(a).trim()==='2';
      }
      if(editSeries){
        const oldDate=x.date,oldStart=x.start;
        const dateDelta=Math.round((parseDate(date)-parseDate(oldDate))/86400000);
        const timeDelta=timeToMins(start)-timeToMins(oldStart);
        const newDuration=timeToMins(end)-timeToMins(start);
        sameGroup.forEach(i=>{
          affected.add(i.date);
          const nd=parseDate(i.date);nd.setDate(nd.getDate()+dateDelta);
          i.date=localISO(nd);
          i.type=type;i.title=title;
          i.start=addMinsTime(i.start,timeDelta);
          i.end=addMinsTime(i.start,newDuration);
          affected.add(i.date);
        });
      }else{
        affected.add(x.date);
        Object.assign(x,{type,title,date,start,end});
        affected.add(date);
      }
    }
  }else{
    const group=uid();
    repeatDates(date,mode,until).forEach(d=>{plan.items.push({id:uid(),groupId:group,date:d,type,title,start,end,done:false,repeatMode:mode,repeatUntil:until});affected.add(d)});
  }
  affected.forEach(syncManualLearningToSemester);
  dayPlanDate=date;
  $('#dayPlanDialog').close();
  persistLocal(true);
  renderAll();
  toast(id?'Aktivität aktualisiert':'Aktivität geplant');
});
$('#deleteDayPlanItem').onclick=()=>{
  const id=$('#dayPlanItemId').value;if(!id)return;
  const plan=dailyPlanState(),x=plan.items.find(i=>i.id===id);if(!x)return;
  const sameGroup=plan.items.filter(i=>i.groupId&&i.groupId===x.groupId);
  let deleteSeries=false;
  if(sameGroup.length>1){const a=prompt('Löschen:\n1 = Nur diesen Termin\n2 = Ganze Serie','1');if(a===null)return;deleteSeries=String(a).trim()==='2'}
  else if(!confirm('Diese Aktivität löschen?'))return;
  const affected=new Set();
  if(deleteSeries){sameGroup.forEach(i=>affected.add(i.date));plan.items=plan.items.filter(i=>i.groupId!==x.groupId)}
  else{affected.add(x.date);plan.items=plan.items.filter(i=>i.id!==id)}
  affected.forEach(syncManualLearningToSemester);
  $('#dayPlanDialog').close();
  persistLocal(true);
  renderAll();
  toast(deleteSeries?'Serie gelöscht':'Aktivität gelöscht');
};
$('#copyYesterdayPlan').onclick=()=>{const d=parseDate(dayPlanDate);d.setDate(d.getDate()-1);const src=dayPlanItems(localISO(d));if(!src.length)return toast('Gestern gibt es keinen Tagesplan.');const plan=dailyPlanState();src.forEach(x=>plan.items.push({...x,id:uid(),groupId:uid(),date:dayPlanDate,done:false}));save();toast('Plan von gestern kopiert')};
$('#saveDayTemplate').onclick=()=>{const items=dayPlanItems();if(!items.length)return toast('Dieser Tag ist leer.');const name=prompt('Name der Vorlage, z. B. Uni-Tag');if(!name?.trim())return;dailyPlanState().templates.push({id:uid(),name:name.trim(),items:items.map(({type,title,start,end})=>({type,title,start,end}))});save();toast('Vorlage gespeichert')};
$('#applyDayTemplate').onclick=()=>{const id=$('#dayTemplateSelect').value,t=dailyPlanState().templates.find(x=>x.id===id);if(!t)return toast('Wähle zuerst eine Vorlage.');const plan=dailyPlanState();t.items.forEach(x=>plan.items.push({...x,id:uid(),groupId:uid(),date:dayPlanDate,done:false}));save();toast('Vorlage angewendet')};



/* ===== WesStudy v4.6: Wochenplan + Verpflichtungen ===== */
const plannerTypeMeta={
  uni:['UNI','Universität'],bib:['BIB','Bib'],vmt:['VMT','VMT'],lab:['LAB','Labor'],gym:['GYM','Gym'],
  mealprep:['MEAL','Meal Prep'],culture:['KULTUR','Kultur'],studyWindow:['LERNEN','Lernen'],other:['TERMIN','Sonstiges'],sleep:['SCHLAF','Schlaf'],wake:['START','Aufstehen'],
};
const plannerPublicHolidays=new Set(['2026-10-03','2026-11-01','2026-12-25','2026-12-26','2027-01-01','2027-01-06']);
function plannerDefaults(){
  return {
    semesterStart:'2026-09-28',semesterEnd:'2027-01-29',
    lectureFreeStart:'2026-12-19',lectureFreeEnd:'2027-01-10',
    prepMin:40,uniTravelMin:15,bibTravelMin:20,vmtTravelMin:85,vmtDurationMin:540,vmtStudyCapMin:150,
    gymMin:75,mealPrepMin:90,sleepMin:360,sleepPreferred:450,sundaySleep:480,cultureWeeklyMin:240,
    freeDayStudyMaxMin:360,labDayStudyMaxMin:300,saturdayStudyMaxMin:330,sundayStudyMaxMin:360,
    freeWakeTime:'08:00',sundayWakeTime:'08:30',
    novemberVmtAccountingOnly:true,manualMode:true,studyAdjustments:{},completions:{},exceptions:{},dayOverrides:{},
    semesterPlanTotalMins:0,smartPlanRevision:'',scheduleRevision:'',
    rules:[
      {id:'u-m1',type:'uni',name:'TM Kinematik',weekday:1,start:'08:00',end:'09:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-m2',type:'uni',name:'Robotik und Bildverarbeitung',weekday:1,start:'09:50',end:'11:20',repeat:'weekly',enabled:true,studyMin:0},
      {id:'sw-m',type:'studyWindow',name:'Lernen',weekday:1,start:'11:30',end:'13:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-m3',type:'uni',name:'Bionik',weekday:1,start:'14:00',end:'15:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'b-m',type:'bib',name:'Bib',weekday:1,start:'16:00',end:'20:00',repeat:'weekly',enabled:true,studyMin:180},
      {id:'g-m',type:'gym',name:'Gym',weekday:1,start:'20:30',end:'21:45',repeat:'weekly',enabled:true,studyMin:0},

      {id:'mp-tu',type:'mealprep',name:'Meal Prep',weekday:2,start:'07:10',end:'08:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-tu1',type:'uni',name:'Höhere Mathematik 3',weekday:2,start:'09:50',end:'11:20',repeat:'weekly',enabled:true,studyMin:0},
      {id:'sw-tu',type:'studyWindow',name:'Lernen',weekday:2,start:'11:30',end:'13:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-tu2',type:'uni',name:'Fertigungstechnik',weekday:2,start:'14:00',end:'15:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'b-tu',type:'bib',name:'Bib',weekday:2,start:'16:00',end:'20:00',repeat:'weekly',enabled:true,studyMin:180},

      {id:'u-w1',type:'uni',name:'TM Kinematik',weekday:3,start:'08:00',end:'09:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-w2',type:'uni',name:'Microcomputer – Vorlesung',weekday:3,start:'09:50',end:'11:20',repeat:'weekly',enabled:true,studyMin:0},
      {id:'sw-w',type:'studyWindow',name:'Lernen',weekday:3,start:'11:30',end:'13:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'lab-w',type:'lab',name:'Numerische Programmierung – Labor',weekday:3,start:'14:00',end:'17:10',repeat:'biweekly',anchor:'2026-09-30',enabled:true,studyMin:0},
      {id:'b-w',type:'bib',name:'Bib',weekday:3,start:'16:00',end:'20:00',repeat:'weekly',enabled:true,studyMin:180},
      {id:'g-w',type:'gym',name:'Gym',weekday:3,start:'20:30',end:'21:45',repeat:'weekly',enabled:true,studyMin:0},

      {id:'u-th1',type:'uni',name:'TM Kinematik',weekday:4,start:'08:00',end:'09:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-th2',type:'uni',name:'Höhere Mathematik 3',weekday:4,start:'09:50',end:'11:20',repeat:'weekly',enabled:true,studyMin:0},
      {id:'u-th3',type:'uni',name:'Rapid Technologies',weekday:4,start:'11:30',end:'13:00',repeat:'weekly',enabled:true,studyMin:0},
      {id:'sw-th',type:'studyWindow',name:'Lernen',weekday:4,start:'13:30',end:'15:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'b-th',type:'bib',name:'Bib',weekday:4,start:'16:00',end:'20:00',repeat:'weekly',enabled:true,studyMin:180},

      {id:'v-f',type:'vmt',name:'VMT',weekday:5,start:'08:00',end:'',repeat:'weekly',enabled:true,studyMin:0},

      {id:'b-sa',type:'bib',name:'Bib',weekday:6,start:'09:00',end:'13:00',repeat:'weekly',enabled:true,studyMin:180},
      {id:'mp-sa',type:'mealprep',name:'Meal Prep',weekday:6,start:'14:00',end:'15:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'sw-sa',type:'studyWindow',name:'Lernen',weekday:6,start:'15:30',end:'17:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'g-sa',type:'gym',name:'Gym',weekday:6,start:'18:00',end:'19:15',repeat:'weekly',enabled:true,studyMin:0},
      {id:'c-sa',type:'culture',name:'Kultur',weekday:6,start:'19:30',end:'20:15',repeat:'weekly',enabled:true,studyMin:0},

      {id:'sw-su1',type:'studyWindow',name:'Lernen',weekday:0,start:'09:30',end:'12:30',repeat:'weekly',enabled:true,studyMin:0},
      {id:'c-su',type:'culture',name:'Kulturprogramm',weekday:0,start:'13:30',end:'14:45',repeat:'weekly',enabled:true,studyMin:0},
      {id:'g-su',type:'gym',name:'Gym',weekday:0,start:'15:30',end:'16:45',repeat:'weekly',enabled:true,studyMin:0},
      {id:'sw-su2',type:'studyWindow',name:'Lernen',weekday:0,start:'17:30',end:'20:30',repeat:'weekly',enabled:true,studyMin:0}
    ]
  };
}
function plannerState(){
  const d=plannerDefaults();
  if(!state.weeklyPlanner){
    state.weeklyPlanner=d;
  }else{
    const w=state.weeklyPlanner;
    state.weeklyPlanner={...d,...w,
      rules:Array.isArray(w.rules)?w.rules:d.rules,
      studyAdjustments:{...(w.studyAdjustments||{})},
      completions:{...(w.completions||{})},
      exceptions:{...(w.exceptions||{})},
      dayOverrides:{...(w.dayOverrides||{})}
    };
  }
  const w=state.weeklyPlanner;

  // Final timetable migration from the user's HKA screenshots.
  if(w.scheduleRevision!=='2026-09-hka-final'){
    const defs=plannerDefaults().rules;
    const ids=new Set(defs.map(x=>x.id));
    const custom=w.rules.filter(x=>!ids.has(x.id));
    const oldById=Object.fromEntries(w.rules.map(x=>[x.id,x]));
    w.rules=defs.map(x=>{
      const old=oldById[x.id];
      // Fixed university timetable is replaced by the final times.
      // For personal/work rules preserve user-edited values where possible.
      if(!old || ['uni','lab'].includes(x.type)) return {...x};
      return {...x,...old,id:x.id,type:x.type,name:old.name||x.name};
    }).concat(custom);
    const lab=w.rules.find(x=>x.id==='lab-w');
    if(lab){lab.repeat='biweekly';lab.anchor='2026-09-30';lab.start='14:00';lab.end='17:10';lab.enabled=true}
    w.scheduleRevision='2026-09-hka-final';
  }

  w.rules.forEach(r=>{
    if(r.type==='studyWindow' && (!r.name || /Studium/i.test(r.name))) r.name='Lernen';
  });
  return w;
}
function plannerSemesterDates(){
  const w=plannerState(),start=state.semester?.start||w.semesterStart,end=state.semester?.end||w.semesterEnd;
  if(!start||!end||end<start)return [];
  const out=[];let d=parseDate(start),last=parseDate(end);
  while(d<=last){out.push(localISO(d));d=new Date(d.getTime()+86400000)}
  return out;
}
function currentSemesterPlanMinutes(){
  return Object.values(state.semesterPlan?.days||{}).reduce((sum,h)=>sum+Math.round(Number(h||0)*60),0);
}
function plannerDayStudyCapacity(date){
  const w=plannerState(),rules=basePlannerRulesForDate(date),wd=parseDate(date).getDay();
  const vmt=plannerActualVmt(date,rules);
  if(vmt) return Math.max(0,Number(w.vmtStudyCapMin||150));
  if(rules.some(r=>r.type==='lab')) return Math.max(0,Number(w.labDayStudyMaxMin||300));
  if(wd===0) return Math.max(0,Number(w.sundayStudyMaxMin||360));
  if(wd===6) return Math.max(0,Number(w.saturdayStudyMaxMin||330));

  const bib=rules.find(r=>r.type==='bib');
  const designated=rules.filter(r=>r.type==='studyWindow').reduce((sum,r)=>sum+dayPlanDuration(r),0);
  const bibStudy=bib?Number(bib.studyMin||0):0;
  const natural=designated+bibStudy;
  return Math.min(Math.max(natural||Number(w.freeDayStudyMaxMin||360),180),Number(w.freeDayStudyMaxMin||360));
}
function smartSemesterPriority(date){
  const wd=parseDate(date).getDay(),rules=basePlannerRulesForDate(date);
  if(plannerActualVmt(date,rules)) return 5;
  if(wd===0) return 100;
  if(wd===6) return 90;
  if(rules.some(r=>r.type==='bib')) return 80;
  if(rules.some(r=>r.type==='lab')) return 40;
  if(!rules.some(r=>['uni','lab','bib','vmt'].includes(r.type))) return 85;
  return 60;
}
function syncSemesterPlanFromWeeklyPattern(force=false){
  const w=plannerState(),dates=plannerSemesterDates();
  if(!dates.length)return false;

  let total=Number(w.semesterPlanTotalMins||0);
  if(!total){
    total=currentSemesterPlanMinutes();
    if(total<=0){
      try{total=semesterStudyTargetMins()}catch(_){total=0}
    }
    w.semesterPlanTotalMins=total;
  }
  if(total<=0)return false;
  if(w.smartPlanRevision==='v4.8'&&!force)return false;

  const caps=Object.fromEntries(dates.map(d=>[d,Math.round(plannerDayStudyCapacity(d)/15)*15]));
  const mins=Object.fromEntries(dates.map(d=>[d,0]));
  let remaining=total;

  // First pass: give every day a realistic base without exceeding its real capacity.
  for(const d of dates){
    if(remaining<=0)break;
    const cap=caps[d],base=Math.min(cap,240);
    const add=Math.min(base,remaining);
    mins[d]+=add;remaining-=add;
  }

  // Second pass: fill the most suitable days first: Sunday, Saturday, free/Bib days;
  // VMT days remain at the bottom.
  const ranked=dates.slice().sort((a,b)=>smartSemesterPriority(b)-smartSemesterPriority(a)||a.localeCompare(b));
  let guard=0;
  while(remaining>0&&guard<50000){
    let changed=false;
    for(const d of ranked){
      if(remaining<=0)break;
      const room=caps[d]-mins[d];
      if(room<=0)continue;
      const add=Math.min(15,room,remaining);
      mins[d]+=add;remaining-=add;changed=true;
    }
    if(!changed)break;
    guard++;
  }

  state.semesterPlan=state.semesterPlan||{days:{}};
  state.semesterPlan.days=Object.fromEntries(dates.map(d=>[d,mins[d]/60]).filter(([,h])=>h>0));
  w.smartPlanRevision='v4.8';
  return true;
}
function addMinsTime(t,mins){
  if(!t)return '';
  const base=timeToMins(t)+Number(mins||0),m=((base%1440)+1440)%1440;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function subMinsTime(t,mins){return addMinsTime(t,-Number(mins||0))}
function isWeekBPattern(date){
  const ws=plannerWeekStart(date);
  const anchor='2026-10-05';
  if(ws<anchor) return false;
  return ((parseDate(ws)-parseDate(anchor))/86400000)%14===0;
}
function pushAutoDayItem(plan,date,type,title,start,end,extra={}){
  plan.items.push({id:uid(),groupId:uid(),date,type,title,start,end,done:false,autoSemester:true,...extra});
}
function generateAutoSemesterAttendance(force=false){
  const plan=dailyPlanState();
  const REV='2026-09-hka-auto-semester-v1';
  if(plan.autoScheduleRevision===REV && !force) return false;
  plan.items=plan.items.filter(x=>!x.autoSemester);
  const start=state.semester?.start||'2026-09-28';
  const end=state.semester?.end||'2027-01-29';
  if(!start||!end) return false;
  let d=parseDate(start),last=parseDate(end);
  while(d<=last){
    const iso=localISO(d);
    if(!isLectureFree(iso)){
      const wd=d.getDay();
      const weekB=isWeekBPattern(iso);
      if(wd===1){
        pushAutoDayItem(plan,iso,'uni','TM Kinematik','08:00','09:30');
        if(weekB) pushAutoDayItem(plan,iso,'uni','Mikrocomputertechnik LAB','09:50','13:00');
        else pushAutoDayItem(plan,iso,'uni','Robotik / Mathem. Grundlagen','09:50','11:20');
        pushAutoDayItem(plan,iso,'uni','Bionik','14:00','15:30');
      } else if(wd===2){
        pushAutoDayItem(plan,iso,'uni','HM3','09:50','11:20');
        pushAutoDayItem(plan,iso,'uni','Fertigungstechnik','14:00','15:30');
      } else if(wd===3){
        if(weekB){
          pushAutoDayItem(plan,iso,'uni','Regelungstechnik LAB','08:00','11:20');
          pushAutoDayItem(plan,iso,'uni','Regelungstechnik','14:00','15:30');
          pushAutoDayItem(plan,iso,'uni','Regelungstechnik','15:40','17:10');
        } else {
          pushAutoDayItem(plan,iso,'uni','TM Kinematik','08:00','09:30');
          pushAutoDayItem(plan,iso,'uni','Microcomputer','09:50','11:20');
          pushAutoDayItem(plan,iso,'uni','Numerische Programmierung Labor','14:00','17:10');
        }
      } else if(wd===4){
        pushAutoDayItem(plan,iso,'uni','TM Kinematik','08:00','09:30');
        pushAutoDayItem(plan,iso,'uni',weekB?'HM3':'Regelungstechnik','09:50','11:20');
        pushAutoDayItem(plan,iso,'uni','Rapid Technologies','11:30','13:00');
      } else if(wd===5){
        pushAutoDayItem(plan,iso,'uni','Fertigungstechnik','14:00','15:30');
      }
    }
    d=new Date(d.getTime()+86400000);
  }
  plan.autoScheduleRevision=REV;
  save();
  return true;
}

function plannerWeekStart(date){
  const d=parseDate(date),shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);return localISO(d);
}
function plannerWeekDates(date){
  const start=parseDate(plannerWeekStart(date));
  return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return localISO(d)});
}
function isLectureFree(date){
  const w=plannerState();
  return overlapDate(date,w.lectureFreeStart,w.lectureFreeEnd)||plannerPublicHolidays.has(date);
}
function plannerRuleApplies(rule,date){
  if(!rule.enabled||Number(rule.weekday)!==parseDate(date).getDay())return false;
  const w=plannerState();
  if(date<w.semesterStart||date>w.semesterEnd)return false;
  if(w.exceptions?.[date]?.[rule.id]===false)return false;
  if((rule.type==='uni'||rule.type==='lab')&&isLectureFree(date))return false;
  if(rule.repeat==='biweekly'){
    if(!rule.anchor)return false;
    const diff=Math.round((parseDate(date)-parseDate(rule.anchor))/86400000);
    if(diff<0||diff%14!==0)return false;
  }
  return true;
}
function basePlannerRulesForDate(date){
  const w=plannerState();
  let rules=w.rules.filter(r=>plannerRuleApplies(r,date)).map(r=>({...r,generated:true}));
  const hasLab=rules.some(r=>r.type==='lab');
  const actualVmt=rules.some(r=>r.type==='vmt'&&!(w.novemberVmtAccountingOnly&&date.startsWith('2026-11')));
  if(hasLab)rules=rules.filter(r=>r.type!=='bib'&&!(r.type==='gym'&&Number(r.weekday)===3));
  if(actualVmt)rules=rules.filter(r=>r.type!=='bib');
  if(w.novemberVmtAccountingOnly&&date.startsWith('2026-11'))rules=rules.filter(r=>r.type!=='vmt');

  // In Laborwochen: Dienstag statt Mittwoch Gym, wenn Dienstag noch kein Gym hat.
  const d=parseDate(date);
  if(d.getDay()===2){
    const wed=new Date(d);wed.setDate(wed.getDate()+1);const wedISO=localISO(wed);
    const labNextDay=w.rules.some(r=>r.type==='lab'&&plannerRuleApplies(r,wedISO));
    if(labNextDay&&!rules.some(r=>r.type==='gym')){
      const g=w.rules.find(r=>r.id==='g-w');
      if(g)rules.push({...g,id:'auto-gym-tu-lab',weekday:2,start:g.start,end:g.end,name:'Gym (statt Mittwoch – Laborwoche)',generated:true,auto:true});
    }
  }
  return rules;
}
function plannerActualVmt(date,rules=basePlannerRulesForDate(date)){
  const w=plannerState();
  return rules.find(r=>r.type==='vmt'&&!(w.novemberVmtAccountingOnly&&date.startsWith('2026-11')));
}

function plannerDayOverride(date){
  const w=plannerState();w.dayOverrides=w.dayOverrides||{};
  return w.dayOverrides[date]||(w.dayOverrides[date]={shiftEvents:[],learningBlocks:null,wakeTime:'',wakeShiftMins:0});
}
function clockDiff(newTime,oldTime){
  if(!newTime||!oldTime)return 0;
  let d=timeToMins(newTime)-timeToMins(oldTime);
  if(d>720)d-=1440;if(d<-720)d+=1440;return d;
}
function shiftClock(time,delta){
  if(!time||time==='flexibel')return time;
  return minsToClock(timeToMins(time)+Number(delta||0));
}
function plannerFlexibleType(type){return ['studyWindow','gym','mealprep','culture','other'].includes(type)}
function plannerFixedType(type){return ['uni','lab','vmt','bib','travel','prep'].includes(type)}
function dayShiftForItem(date,item){
  const o=plannerState().dayOverrides?.[date];if(!o)return 0;
  let delta=Number(o.wakeShiftMins||0),st=timeToMins(item.start||'00:00');
  (o.shiftEvents||[]).forEach(ev=>{if(st>=Number(ev.afterMin||0))delta+=Number(ev.delta||0)});
  return delta;
}
function applyDayFlexibleShift(date,item){
  if(!plannerFlexibleType(item.type)||!item.start)return item;
  const delta=dayShiftForItem(date,item);if(!delta)return item;
  const dur=item.end?Math.max(0,timeToMins(item.end)-timeToMins(item.start)):Number(item.minutes||0);
  const start=shiftClock(item.start,delta);
  return {...item,start,end:item.end?addMinsTime(start,dur):item.end,_dayShifted:true};
}
function findNextFreeStart(desired,duration,fixed){
  let start=desired,guard=0;
  while(guard++<50){
    const hit=fixed.find(f=>start<f.end&&start+duration>f.start);
    if(!hit)return start;
    start=hit.end;
  }
  return start;
}
function reflowFlexibleTimeline(date,timeline){
  const fixed=timeline.filter(x=>plannerFixedType(x.type)&&x.start&&x.end)
    .map(x=>({start:timeToMins(x.start),end:timeToMins(x.end),name:x.name||x.type}))
    .sort((a,b)=>a.start-b.start);
  let lastFlexEnd=0;
  return timeline.map(x=>{
    if(x.learning||!plannerFlexibleType(x.type)||!x.start||!x.end)return x;
    const dur=Math.max(0,timeToMins(x.end)-timeToMins(x.start));
    const desired=Math.max(timeToMins(x.start),lastFlexEnd);
    const actual=findNextFreeStart(desired,dur,fixed);
    if(actual+dur>23*60+45)return {...x,_overflow:true};
    lastFlexEnd=actual+dur;
    return actual!==timeToMins(x.start)?{...x,start:minsToClock(actual),end:minsToClock(actual+dur),_reflowed:true}:x;
  });
}
function plannerGeneratedItems(date){
  const w=plannerState(),rules=basePlannerRulesForDate(date),items=[];
  for(const r0 of rules){
    const r=applyDayFlexibleShift(date,{...r0});
    let start=r.start||'',end=r.end||'';
    if(r.type==='vmt'&&start)end=addMinsTime(start,w.vmtDurationMin);
    items.push({...r,start,end,key:`rule:${r.id}:${date}`});
  }

  const uni=items.filter(x=>x.type==='uni').sort((a,b)=>a.start.localeCompare(b.start));
  if(uni.length){
    const first=uni[0],depart=subMinsTime(first.start,w.uniTravelMin),prepStart=subMinsTime(depart,w.prepMin);
    items.push({id:'auto-prep-uni',key:`auto:prep-uni:${date}`,type:'prep',name:'Vorbereitung + Frühstück',start:prepStart,end:depart,generated:true,auto:true});
    items.push({id:'auto-travel-uni',key:`auto:travel-uni:${date}`,type:'travel',name:'Haus → Uni',start:depart,end:first.start,generated:true,auto:true});
  }

  const bib=items.find(x=>x.type==='bib'),lastUni=uni.slice().sort((a,b)=>b.end.localeCompare(a.end))[0];
  if(bib&&lastUni&&lastUni.end<=bib.start){
    const commuteStart=subMinsTime(bib.start,w.bibTravelMin);
    items.push({id:'auto-travel-bib',key:`auto:travel-bib:${date}`,type:'travel',name:'Uni → Bib',start:commuteStart,end:bib.start,generated:true,auto:true});
  }

  const vmt=plannerActualVmt(date,rules);
  if(vmt?.start){
    const depart=subMinsTime(vmt.start,w.vmtTravelMin),prepStart=subMinsTime(depart,w.prepMin),vmtEnd=addMinsTime(vmt.start,w.vmtDurationMin);
    items.push({id:'auto-prep-vmt',key:`auto:prep-vmt:${date}`,type:'prep',name:'Vorbereitung für VMT',start:prepStart,end:depart,generated:true,auto:true});
    items.push({id:'auto-travel-vmt',key:`auto:travel-vmt:${date}`,type:'travel',name:'Haus → VMT (mit Buffer)',start:depart,end:vmt.start,generated:true,auto:true});
    items.push({id:'auto-travel-home',key:`auto:travel-home:${date}`,type:'travel',name:'VMT → Haus (mit Buffer)',start:vmtEnd,end:addMinsTime(vmtEnd,w.vmtTravelMin),generated:true,auto:true});
  }

  const timed=items.filter(x=>x.start&&x.start!=='flexibel'),override=plannerState().dayOverrides?.[date]||{};
  let wake=override.wakeTime||'';
  if(!wake){
    const prep=timed.filter(x=>x.type==='prep').sort((a,b)=>a.start.localeCompare(b.start))[0];
    if(prep)wake=prep.start;
    else{
      const first=timed.sort((a,b)=>a.start.localeCompare(b.start))[0];
      if(first)wake=subMinsTime(first.start,45);
      else wake=parseDate(date).getDay()===0?(w.sundayWakeTime||'08:30'):(w.freeWakeTime||'08:00');
    }
  }
  const sleepGoal=parseDate(date).getDay()===0?Number(w.sundaySleep||480):Number(w.sleepPreferred||450),bed=subMinsTime(wake,sleepGoal);
  items.push({id:'auto-sleep',key:`auto:sleep:${date}`,type:'sleep',name:'Schlaf',start:bed,end:wake,generated:true,auto:true,_sort:'00:00',previousEvening:true,minutes:sleepGoal});
  items.push({id:'auto-wake',key:`auto:wake:${date}`,type:'wake',name:'Aufstehen',start:wake,end:'',generated:true,auto:true,_sort:wake,minutes:0});
  return items.sort((a,b)=>(a._sort||a.start||'99:99').localeCompare(b._sort||b.start||'99:99'));
}
function plannerCompletion(date,key){
  return plannerState().completions?.[date]?.[key]||null;
}
function setPlannerCompletion(date,key,patch){
  const w=plannerState();w.completions[date]=w.completions[date]||{};
  w.completions[date][key]={...(w.completions[date][key]||{}),...patch};
  save();
}
function baseStudyTargetForDate(date){
  return Math.max(0,Number(state.semesterPlan?.days?.[date]||0)*60);
}
function flexibleWeekTargets(date){
  return Object.fromEntries(plannerWeekDates(date).map(d=>[d,baseStudyTargetForDate(d)]));
}
function flexibleStudyTargetForDate(date){return baseStudyTargetForDate(date)}

function bibUsableStudy(date,target=flexibleStudyTargetForDate(date)){
  const bib=basePlannerRulesForDate(date).find(r=>r.type==='bib');
  return bib?Math.min(target,Number(bib.studyMin||0)):0;
}
function manualLearningMinutesForDate(date){
  return dayPlanItems(date).filter(itemCountsAsLearning).reduce((sum,x)=>sum+dayPlanDuration(x),0);
}
function syncManualLearningToSemester(date){
  // Lernblöcke verändern das Lernziel nicht.
  // Diese Funktion bleibt nur als Kompatibilitäts-Hook bestehen.
  // Überschneidungen werden im Tagesplan separat angezeigt.
  return true;
}
function manualLearningConflict(date){
  const arr=dayPlanItems(date).filter(x=>itemCountsAsLearning(x)&&x.start&&x.end).sort((a,b)=>a.start.localeCompare(b.start));
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
    if(timeToMins(arr[j].start)>=timeToMins(arr[i].end))break;
    if(timeToMins(arr[i].start)<timeToMins(arr[j].end)&&timeToMins(arr[i].end)>timeToMins(arr[j].start))return [arr[i],arr[j]];
  }
  return null;
}
function plannerManualItems(date){
  return dayPlanItems(date).map(x=>({...x,name:x.title,key:`manual:${x.id}`,generated:false}));
}
function plannerAllItems(date){
  if(plannerState().manualMode)return plannerManualItems(date).sort((a,b)=>(a.start||'99:99').localeCompare(b.start||'99:99'));
  return [...plannerGeneratedItems(date),...plannerManualItems(date)].sort((a,b)=>(a.start||'99:99').localeCompare(b.start||'99:99'));
}
function plannerConflicts(date){
  const arr=plannerGeneratedItems(date).filter(x=>x.start&&x.end),out=[];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
    const a=arr[i],b=arr[j];
    if(timeToMins(a.start)<timeToMins(b.end)&&timeToMins(b.start)<timeToMins(a.end)){
      if(['travel','prep','studyWindow'].includes(a.type)||['travel','prep','studyWindow'].includes(b.type))continue;
      out.push(`${a.name} ↔ ${b.name}`);
    }
  }
  return [...new Set(out)];
}
function plannerOutsideBusyIntervals(date){
  return plannerGeneratedItems(date)
    .filter(x=>x.start&&x.end&&!['studyWindow','sleep','wake','bib'].includes(x.type))
    .map(x=>({start:timeToMins(x.start),end:timeToMins(x.end)}))
    .filter(x=>x.end>x.start)
    .sort((a,b)=>a.start-b.start);
}
function plannerFreeGaps(date){
  const w=plannerState(),busy=plannerOutsideBusyIntervals(date);
  const generated=plannerGeneratedItems(date),wake=generated.find(x=>x.type==='wake')?.start||(parseDate(date).getDay()===0?w.sundayWakeTime:w.freeWakeTime)||'08:00';
  let from=Math.max(timeToMins(wake),7*60),to=22*60+30;
  const gaps=[];let cur=from;
  for(const b of busy){
    if(b.end<=from||b.start>=to)continue;
    const bs=Math.max(b.start,from),be=Math.min(b.end,to);
    if(bs-cur>=30)gaps.push({start:cur,end:bs});
    cur=Math.max(cur,be);
  }
  if(to-cur>=30)gaps.push({start:cur,end:to});
  return gaps;
}
function minsToClock(m){m=((m%1440)+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function plannerStudyWindows(date,target){
  const override=plannerState().dayOverrides?.[date];
  if(Array.isArray(override?.learningBlocks)){
    const all=override.learningBlocks.map(b=>({...b})),bibBlocks=all.filter(b=>b.source==='bib'),blocks=all.filter(b=>b.source!=='bib');
    const bibStudy=bibBlocks.reduce((a,b)=>a+Number(b.minutes||0),0),total=all.reduce((a,b)=>a+Number(b.minutes||0),0);
    return {bibStudy,bibBlocks,blocks,unplanned:Math.max(0,target-total),custom:true};
  }
  const rules=basePlannerRulesForDate(date),bib=rules.find(r=>r.type==='bib');
  let remaining=Math.max(0,target),blocks=[],bibBlocks=[],bibStudy=0;

  if(bib&&remaining>0){
    const allowed=Math.min(remaining,Number(bib.studyMin||0));
    let left=allowed,cur=timeToMins(bib.start);
    // 90 min Lernen + 15 min Pause + next block, matching the preferred Bib rhythm.
    while(left>0){
      const chunk=Math.min(left,90);
      bibBlocks.push({start:minsToClock(cur),end:minsToClock(cur+chunk),minutes:chunk,label:'Lernen (in der Bib)',source:'bib',bibOverlap:true});
      left-=chunk;cur+=chunk;
      if(left>0)cur+=15;
    }
    bibStudy=allowed;remaining-=allowed;
  }

  // First respect explicitly configured Lernfenster.
  for(const r of rules.filter(x=>x.type==='studyWindow').sort((a,b)=>a.start.localeCompare(b.start))){
    if(remaining<=0)break;
    const cap=dayPlanDuration(r),use=Math.min(remaining,cap);
    if(use>0){blocks.push({start:r.start,end:addMinsTime(r.start,use),minutes:use,label:'Lernen',source:'outside'});remaining-=use}
  }

  // Then use real chronological free gaps without colliding with Uni/VMT/Gym/Meal Prep/travel.
  const used=blocks.map(b=>({start:timeToMins(b.start),end:timeToMins(b.end)}));
  for(const gap of plannerFreeGaps(date)){
    if(remaining<=0)break;
    let gs=gap.start,ge=gap.end;
    for(const u of used){
      if(u.end<=gs||u.start>=ge)continue;
      if(u.start<=gs)gs=Math.max(gs,u.end);
    }
    const room=Math.max(0,ge-gs);
    if(room<30)continue;
    const use=Math.min(remaining,room);
    blocks.push({start:minsToClock(gs),end:minsToClock(gs+use),minutes:use,label:'Lernen',source:'outside'});
    used.push({start:gs,end:gs+use});remaining-=use;
  }
  return {bibStudy,bibBlocks,blocks,unplanned:Math.max(0,remaining)};
}
function renderSmartDayPlanner(){
  if(!document.getElementById('smartDayItems'))return;
  plannerState();
  const date=dayPlanDate,d=parseDate(date),baseItems=plannerAllItems(date),target=flexibleStudyTargetForDate(date),base=baseStudyTargetForDate(date),done=sessionsOn(date),studyWindows=plannerStudyWindows(date,target),bibStudy=studyWindows.bibStudy,outside=Math.max(0,target-bibStudy),conflicts=plannerConflicts(date);

  // Im manuellen Modus kommen Lernblöcke ausschließlich aus deinen eigenen Einträgen.
  const learningItems=[];
  if(!plannerState().manualMode){
    studyWindows.bibBlocks.forEach((b,i)=>learningItems.push({key:`bib-study:${date}:${i}`,type:'studyWindow',name:'Lernen (in der Bib)',start:b.start,end:b.end,minutes:b.minutes,generated:true,virtual:true,learning:true,source:'bib'}));
    studyWindows.blocks.forEach((b,i)=>learningItems.push({key:`study-block:${date}:${i}`,type:'studyWindow',name:'Lernen',start:b.start,end:b.end,minutes:b.minutes,generated:true,virtual:true,learning:true,source:'outside'}));
  }
  const plannedLearning=plannerState().manualMode?manualLearningMinutesForDate(date):learningItems.reduce((sum,x)=>sum+Number(x.minutes||0),0);
  const notPlanned=Math.max(0,target-plannedLearning);
  const notLearned=Math.max(0,target-done);

  document.getElementById('smartDayTitle').textContent=(date===todayISO()?'Heute – ':'')+new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  const dayPicker=document.getElementById('smartDayDatePicker');if(dayPicker)dayPicker.value=date;
  const dayBtn=document.getElementById('smartDayToday');if(dayBtn)dayBtn.textContent=date===todayISO()?'Heute':fmtDate(date);
  const lf=isLectureFree(date);document.getElementById('smartDaySubtitle').textContent=plannerState().manualMode?'Manueller Plan: Du bestimmst alle Termine und Wiederholungen selbst. Lernen bleibt mit der Semesterplanung verbunden.':(lf?'Vorlesungsfrei / Feiertag – Uni-Termine werden automatisch ausgeblendet.':'Automatisch aus deinen Wochenregeln berechnet.');
  document.getElementById('smartStudyTarget').textContent=minsText(target);
  document.getElementById('smartBibStudy').textContent=minsText(bibStudy);
  document.getElementById('smartOutsideStudy').textContent=minsText(outside);
  document.getElementById('smartStudyDone').textContent=minsText(done);
  const makeupOpen=makeupOpenMins();document.getElementById('smartMakeupOpen').textContent=minsText(makeupOpen);

  const msgs=[];
  if(!plannerState().manualMode){
    if(target!==base)msgs.push(`<div class="planner-alert">↔️ Flexibles Lernziel: ${minsText(base)} ursprünglich → ${minsText(target)} heute. Die Wochensumme bleibt gleich.</div>`);
    const actualVmt=plannerActualVmt(date,basePlannerRulesForDate(date));
    if(actualVmt)msgs.push(`<div class="planner-alert"> VMT-Tag: 9 Std. Arbeit + Fahrt/Buffer.</div>`);
    if(conflicts.length)msgs.push(`<div class="planner-alert">Hinweis: Konflikt erkannt: ${conflicts.map(esc).join(' · ')}</div>`);
  }
  const manualConflict=manualLearningConflict(date);
  if(manualConflict)msgs.push(`<div class="planner-alert">Hinweis: Lernkonflikt: ${esc(manualConflict[0].start)}–${esc(manualConflict[0].end)} überschneidet sich mit ${esc(manualConflict[1].start)}–${esc(manualConflict[1].end)}. Bitte einen Eintrag bearbeiten oder löschen.</div>`);
  if(target){
    msgs.push(`<div class="${notPlanned===0?'planner-good':'planner-alert'}"> Lernplanung: Soll ${minsText(target)} · als Lernen eingeplant ${minsText(plannedLearning)} · ${notPlanned===0?'vollständig eingeplant ✓':`${minsText(notPlanned)} noch nicht eingeplant`}</div>`);
    msgs.push(`<div class="${done>=target?'planner-good':'planner-alert'}">✓ Lernverlauf: erledigt ${minsText(done)} · ${done>=target?`${minsText(done-target)} über Soll`:`noch nicht gelernt ${minsText(notLearned)}`}</div>`);
  }
  if(makeupOpen>0){msgs.push(`<div class="planner-alert">Nachholen offen: <strong>${minsText(makeupOpen)}</strong> – im Hintergrund zum Semesterbedarf addiert.</div>`)}
  document.getElementById('smartDayMessages').innerHTML=msgs.join('');

  // One chronological timeline: preparation, travel, university, Lernen, Bib,
  // personal appointments etc. are no longer separated into groups.
  let timeline=[...baseItems.filter(x=>x.type!=='studyWindow'),...learningItems];
  if(!plannerState().manualMode)timeline=reflowFlexibleTimeline(date,timeline);
  const priority={sleep:0,wake:1,prep:2,travel:3,uni:4,lab:4,studyWindow:5,bib:6,vmt:6,mealprep:7,gym:7,culture:7,other:8};
  timeline.sort((a,b)=>{
    const ta=a._sort||(a.start==='flexibel'||!a.start?'99:99':a.start),tb=b._sort||(b.start==='flexibel'||!b.start?'99:99':b.start);
    return ta.localeCompare(tb)||(priority[a.type]||9)-(priority[b.type]||9)||(a.end||'').localeCompare(b.end||'');
  });

  const renderItem=x=>{
    if(plannerState().manualMode&&itemCountsAsLearning(x)){x.learning=true;x.minutes=dayPlanDuration(x);}
    const meta=(x.type==='study'?plannerTypeMeta.studyWindow:plannerTypeMeta[x.type])||plannerTypeMeta.other,comp=plannerCompletion(date,x.key),manual=!x.generated;
    const dur=x.minutes!=null?x.minutes:(x.start&&x.end?dayPlanDuration(x):0);
    let extra='';
    if(x.learning){
      extra=`Lernzeit · ${minsText(dur)}${x.source==='bib'?' · während Bib':''}`;
    }else if(x.type==='bib'){
      extra=`Arbeitszeit ${minsText(dayPlanDuration(x))} · davon bis zu ${minsText(Number(x.studyMin||0))} als Lernen nutzbar`;
    }else if(x.type==='vmt'){
      extra=`Arbeitszeit ${minsText(plannerState().vmtDurationMin)} · Lernzeit während Arbeit 0:00`;
    }else if(x.type==='sleep'){
      extra=`${minsText(dur)} · Schlafziel${x.previousEvening?' · Beginn am Vorabend':''}`;
    }else if(x.type==='wake'){
      extra='Start in den Tag';
    }else{
      extra=`${meta[1]}${dur?' · '+minsText(dur):''}`;
    }
    if(x._reflowed)extra+=` · automatisch verschoben`;
    if(x._overflow&&!x.learning)extra+=` · Hinweis: passt heute nicht mehr sinnvoll`;
    if(comp?.actualMins!=null)extra+=` · Ist ${minsText(comp.actualMins)}`;
    const tagType=x.learning?'study':((x.type==='vmt' || x.type==='work')?'work':x.type);
    const tagLabel=x.learning?'Lernen':(x.type==='uni'?'Uni':x.type==='bib'?'Bib':x.type==='vmt'?'VMT':x.type==='gym'?'Gym':x.type==='reading'?'Lesen':x.type==='sleep'?'Schlaf':x.type==='wake'?'Start':x.type==='makeup'?'Nachholen':meta[1]);
    return `<div class="planner-item ${comp?.done?'done':''} ${x.learning?'planner-learning-item':''}">
      <div class="planner-time">${esc(x.start||'flexibel')}${x.end?`<div class="muted" style="font-size:.7rem">bis ${esc(x.end)}</div>`:''}</div>
      <div><div class="planner-item-title">${x.learning?'':meta[0]} ${esc(x.name||x.title||meta[1])}</div><div class="planner-item-sub">${extra}</div></div>
      <div class="planner-actions">
        ${x.virtual?'':`<input type="checkbox" data-planner-done="${esc(x.key)}" ${comp?.done?'checked':''} aria-label="Erledigt">`}
        ${x.virtual?'':`<button class="planner-tag ${esc(tagType)}" data-planner-actual="${esc(x.key)}" title="Ist-Zeit eintragen">${esc(tagLabel)}</button>`}
        ${x.type==='uni'&&dur>0?`<button class="mini-btn" data-makeup-missed="${esc(x.key||x.id||x.name)}" data-makeup-title="${esc(x.name||x.title||'Vorlesung')}" data-makeup-minutes="${dur}" title="Gefehlt → Nachholen">Nachholen</button>`:''}
        ${x.learning&&!manual?`<button class="mini-btn" data-day-learning-edit="${esc(x.key)}" title="Lernblock für diesen Tag ändern">Bearbeiten</button>`:''}
        ${x.learning&&!manual?`<button class="mini-btn" data-day-learning-delete="${esc(x.key)}" title="Lernblock löschen">Löschen</button>`:''}
        ${x.type==='wake'?`<button class="mini-btn" data-day-wake-edit="${esc(date)}" title="Aufstehzeit ändern">Bearbeiten</button>`:''}
        ${manual?`<button class="mini-btn" data-dayplan-edit="${esc(x.id)}">Bearbeiten</button>`:x.id?.startsWith('auto-')||x.auto||x.virtual?'':`<button class="mini-btn" data-planner-edit-rule="${esc(x.id)}">Bearbeiten</button>`}
      </div>
    </div>`;
  };
  document.getElementById('smartDayItems').innerHTML=
    `<div class="planner-group"><h3>Tagesablauf · chronologisch</h3>${timeline.length?timeline.map(renderItem).join(''):'<div class="muted">Für diesen Tag sind keine Termine geplant.</div>'}</div>`;
}
function weekBlockClass(type){return ['uni','study','makeup','gym','work','reading','other','break'].includes(type)?type:'other'}
function dayHeaderSummaryHtml(target,planned){
  if(!target)return `<div class="wg-summary">Soll 0:00</div>`;
  const diff=target-planned;
  if(diff<=0)return `<div class="wg-summary good">Soll ${minsText(target)} · geplant ${minsText(planned)} ✓</div>`;
  return `<div class="wg-summary warn">Soll ${minsText(target)} · geplant ${minsText(planned)}<br>offen ${minsText(diff)}</div>`;
}
function renderWeekPlanner(){
  if(!document.getElementById('weekOverview'))return;
  const dates=plannerWeekDates(dayPlanDate);
  const weekStartDate=dates[0],weekEndDate=dates[6];
  document.getElementById('weekPlannerLabel').textContent=`${fmtDate(weekStartDate)} – ${fmtDate(weekEndDate)}`;
  const weekPicker=document.getElementById('smartWeekDatePicker');if(weekPicker)weekPicker.value=dayPlanDate;
  const target=dates.reduce((sum,d)=>sum+studyPlanForDate(d),0);
  const planned=dates.reduce((sum,d)=>sum+plannedLearningMinutesForDate(d),0);
  const open=Math.max(0,target-planned);
  const makeupOpen=makeupOpenMins();
  const timeStart=7*60,timeEnd=25*60,totalMins=timeEnd-timeStart,rowHeight=56,canvasHeight=Math.round(totalMins/60*rowHeight);
  const labels=[];
  for(let m=timeStart;m<=timeEnd;m+=60){labels.push({label:minsToClock(m),top:((m-timeStart)/totalMins)*100});}
  const weekdayFmt=new Intl.DateTimeFormat('de-DE',{weekday:'long'});
  const shortFmt=new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
  const metricCard=(title,value)=>`<div class="week-metric"><div class="eyebrow">${title}</div><strong>${value}</strong></div>`;
  const headHtml=dates.map(date=>{
    const plannedDay=plannedLearningMinutesForDate(date),targetDay=studyPlanForDate(date);
    return `<div class="wg-head"><div class="wg-day-name">${esc(weekdayFmt.format(parseDate(date)))}<br>${esc(shortFmt.format(parseDate(date)).split(', ').pop()||fmtDate(date))}</div>${dayHeaderSummaryHtml(targetDay,plannedDay)}</div>`;
  }).join('');
  const colHtml=dates.map(date=>{
    const raw=dayPlanItems(date).filter(x=>x.start&&x.end).map((x,idx)=>{
      let st=timeToMins(x.start),en=timeToMins(x.end); if(st<timeStart) st+=1440; if(en<=st) en+=1440;
      return {x,idx,st,en};
    }).sort((a,b)=>a.st-b.st||a.en-b.en||a.idx-b.idx);

    // iPhone-like overlap layout: overlapping events are shown side-by-side.
    const laid=[];
    let i=0;
    while(i<raw.length){
      let cluster=[raw[i]], clusterEnd=raw[i].en, j=i+1;
      while(j<raw.length && raw[j].st<clusterEnd){
        cluster.push(raw[j]);
        clusterEnd=Math.max(clusterEnd,raw[j].en);
        j++;
      }
      const active=[];
      let maxCols=1;
      cluster.forEach(ev=>{
        for(let k=active.length-1;k>=0;k--) if(active[k].en<=ev.st) active.splice(k,1);
        const used=new Set(active.map(a=>a.col));
        let col=0; while(used.has(col)) col++;
        ev.col=col; active.push(ev); maxCols=Math.max(maxCols,col+1);
      });
      cluster.forEach(ev=>{ev.cols=maxCols;laid.push(ev)});
      i=j;
    }

    const items=laid.map(ev=>{
      const {x,st,en,col,cols}=ev;
      const top=((st-timeStart)/totalMins)*100, h=Math.max(2,((en-st)/totalMins)*100);
      const cls=weekBlockClass(x.type);
      const sub=(dayPlanTypes[x.type]||dayPlanTypes.other)[1];
      const gap=4;
      const width=`calc((100% - ${gap*(cols-1)}px) / ${cols})`;
      const left=`calc(${(col/cols)*100}% + ${col?gap*col/cols:0}px)`;
      return `<div class="week-block ${cls} ${cols>1?'overlap':''}" style="top:${top}%;height:${h}%;left:${left};width:${width};right:auto" title="${esc(x.title)}"><div class="wb-time">${esc(x.start)} – ${esc(x.end)}</div><div class="wb-title">${esc(x.title)}</div><div class="wb-sub">${esc(sub)}</div></div>`;
    }).join('');
    return `<div class="wg-day-col" data-week-date="${date}" style="height:${canvasHeight}px">${items}</div>`;
  }).join('');
  const timesHtml=labels.map(x=>`<div class="wg-time-label" style="top:${x.top}%">${x.label}</div>`).join('');
  document.getElementById('weekOverview').innerHTML=`<div class="week-board"><div class="week-metrics">${metricCard('Lernziel',minsText(target))}${metricCard('Geplant',minsText(planned))}${metricCard('Noch offen',minsText(open))}${metricCard('Nachholen offen',minsText(makeupOpen))}</div><div class="week-summary-bar ${open?'pending':'complete'}">Wochenplanung: Soll ${minsText(target)} · als Lernen eingeplant ${minsText(planned)} · ${open?`noch offen ${minsText(open)}`:'vollständig eingeplant ✓'}</div><div class="week-grid-shell"><div class="week-grid"><div class="wg-head-left">Uhrzeit</div>${headHtml}<div class="wg-time-col" style="height:${canvasHeight}px">${timesHtml}</div>${colHtml}</div></div><div class="week-legend"><span class="lg u"><i></i> Uni / Pflichttermine</span><span class="lg s"><i></i> Lernen</span><span class="lg m"><i></i> Nachholen</span><span class="lg g"><i></i> Gym</span></div></div>`;
}
function renderPlannerRules(){
  const w=plannerState();
  const startEl=document.getElementById('plannerSemesterStartSimple');
  const endEl=document.getElementById('plannerSemesterEndSimple');
  if(startEl)startEl.value=state.semester?.start||w.semesterStart||'';
  if(endEl)endEl.value=state.semester?.end||w.semesterEnd||'';
  const g=document.getElementById('plannerGlobalSettings');if(g)g.innerHTML='';
  const l=document.getElementById('plannerRuleList');if(l)l.innerHTML='';
}
function renderPlannerAll(){renderSmartDayPlanner();renderWeekPlanner();renderPlannerRules()}
function plannerSwitchTab(tab){
  document.querySelectorAll('[data-plan-tab]').forEach(b=>b.classList.toggle('active',b.dataset.planTab===tab));
  document.getElementById('smartDayPlanner').classList.toggle('hidden',tab!=='day');
  document.getElementById('smartWeekPlanner').classList.toggle('hidden',tab!=='week');
  document.getElementById('smartRulesPlanner').classList.toggle('hidden',tab!=='rules');
  if(tab==='week')renderWeekPlanner();if(tab==='rules')renderPlannerRules();if(tab==='day')renderSmartDayPlanner();
}
function openPlannerRule(id=''){
  const w=plannerState(),r=id?w.rules.find(x=>x.id===id):null;
  document.getElementById('plannerRuleId').value=r?.id||'';
  document.getElementById('plannerRuleDialogTitle').textContent=r?'Regel bearbeiten':'Regel hinzufügen';
  document.getElementById('plannerRuleType').value=r?.type||'other';
  document.getElementById('plannerRuleName').value=r?.name||'';
  document.getElementById('plannerRuleWeekday').value=String(r?.weekday??1);
  document.getElementById('plannerRuleStart').value=r?.start||'';
  document.getElementById('plannerRuleEnd').value=r?.end||'';
  document.getElementById('plannerRuleRepeat').value=r?.repeat||'weekly';
  document.getElementById('plannerRuleAnchor').value=r?.anchor||'';
  document.getElementById('plannerRuleStudyMin').value=Number(r?.studyMin||0);
  document.getElementById('plannerRuleEnabled').checked=r?.enabled!==false;
  document.getElementById('deletePlannerRule').classList.toggle('hidden',!r);
  document.getElementById('plannerRuleDialog').showModal();
}
function openPlannerSettings(){
  const w=plannerState();
  ['semesterStart','semesterEnd','lectureFreeStart','lectureFreeEnd','prepMin','uniTravelMin','bibTravelMin','vmtTravelMin','vmtDurationMin','vmtStudyCapMin','gymMin','mealPrepMin','sleepMin','sleepPreferred','sundaySleep','cultureWeeklyMin'].forEach(k=>{
    const id='wp'+k[0].toUpperCase()+k.slice(1),el=document.getElementById(id);if(el)el.value=w[k]??'';
  });
  document.getElementById('wpNovemberAccounting').checked=!!w.novemberVmtAccountingOnly;
  ['freeDayStudyMaxMin','labDayStudyMaxMin','saturdayStudyMaxMin','sundayStudyMaxMin','freeWakeTime','sundayWakeTime'].forEach(k=>{const id='wp'+k[0].toUpperCase()+k.slice(1),el=document.getElementById(id);if(el)el.value=w[k]??''});
  document.getElementById('plannerSettingsDialog').showModal();
}
function semesterTargetForDateMins(date){return Math.max(0,Number(state.semesterPlan?.days?.[date]||0)*60)}
function setSemesterTargetMins(date,mins){
  state.semesterPlan=state.semesterPlan||{days:{}};
  mins=Math.max(0,Math.round(Number(mins||0)/15)*15);
  if(mins>0)state.semesterPlan.days[date]=mins/60;else delete state.semesterPlan.days[date];
}
function moveStudyOpen(date,mode='tomorrow'){
  const target=semesterTargetForDateMins(date),done=sessionsOn(date),open=Math.max(0,target-done);
  if(!open)return toast('Für diesen Tag ist keine Lernzeit offen.');

  if(mode==='tomorrow'){
    const d=parseDate(date);d.setDate(d.getDate()+1);const dest=localISO(d);
    const cap=plannerDayStudyCapacity(dest),cur=semesterTargetForDateMins(dest),room=Math.max(0,cap-cur);
    if(room<=0)return toast(`Morgen (${fmtDate(dest)}) hat keine sinnvolle freie Lernkapazität. Bitte wähle einen anderen Tag.`);
    const add=Math.min(open,room);
    setSemesterTargetMins(date,target-add);
    setSemesterTargetMins(dest,cur+add);
    save();
    if(add<open)toast(`${minsText(add)} auf morgen verschoben. ${minsText(open-add)} passen dort nicht sinnvoll hinein.`);
    else toast(`${minsText(add)} auf morgen verschoben und im Tagesplan eingeplant.`);
    return;
  }

  let remaining=open;
  const d0=parseDate(date),candidates=[];
  for(let i=1;i<=21;i++){
    const d=new Date(d0);d.setDate(d.getDate()+i);const iso=localISO(d);
    if(iso>plannerState().semesterEnd)break;
    const cap=plannerDayStudyCapacity(iso),cur=semesterTargetForDateMins(iso),room=Math.max(0,cap-cur);
    if(room>0)candidates.push({date:iso,room,score:smartSemesterPriority(iso)});
  }
  candidates.sort((a,b)=>b.score-a.score||a.date.localeCompare(b.date));
  const allocations=[];
  for(const c of candidates){
    if(remaining<=0)break;
    const add=Math.min(remaining,c.room);
    if(add>0){setSemesterTargetMins(c.date,semesterTargetForDateMins(c.date)+add);allocations.push([c.date,add]);remaining-=add}
  }
  const moved=open-remaining;
  if(moved>0)setSemesterTargetMins(date,target-moved);
  save();
  if(remaining>0)toast(`${minsText(moved)} automatisch sinnvoll eingeplant. ${minsText(remaining)} konnten nicht sinnvoll eingeplant werden.`);
  else toast(`${minsText(moved)} automatisch auf passende Tage verteilt und in den Tagesplänen eingeplant.`);
}


function normalizeLearningBlocks(blocks){
  const list=(blocks||[]).map(b=>({
    ...b,
    minutes:Math.max(0,timeToMins(b.end)-timeToMins(b.start))
  })).filter(b=>b.start&&b.end&&timeToMins(b.end)>timeToMins(b.start))
    .sort((a,b)=>timeToMins(a.start)-timeToMins(b.start));

  const conflicts=[];
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      if(timeToMins(list[j].start)>=timeToMins(list[i].end))break;
      if(timeToMins(list[i].start)<timeToMins(list[j].end)&&timeToMins(list[i].end)>timeToMins(list[j].start)){
        conflicts.push([i,j]);
      }
    }
  }
  return {list,conflicts};
}
function learningBlocksTotal(blocks){
  return (blocks||[]).reduce((sum,b)=>sum+Math.max(0,timeToMins(b.end)-timeToMins(b.start)),0);
}
function learningPlanStatusHtml(target,planned){
  const diff=target-planned;
  if(diff>0)return `<b>Soll heute: ${minsText(target)}</b> · Als Lernen eingeplant: <b>${minsText(planned)}</b> · Noch nicht eingeplant: <b>${minsText(diff)}</b>`;
  if(diff<0)return `<b>Soll heute: ${minsText(target)}</b> · Als Lernen eingeplant: <b>${minsText(planned)}</b> · <b>+${minsText(-diff)} über dem Lernziel</b>`;
  return `<b>Soll heute: ${minsText(target)}</b> · Als Lernen eingeplant: <b>${minsText(planned)}</b> · vollständig eingeplant ✓`;
}

function saveDayLearningBlocks(date,blocks){
  const n=normalizeLearningBlocks(blocks);
  if(n.conflicts.length){
    const [i,j]=n.conflicts[0],a=n.list[i],b=n.list[j];
    toast(`Nicht gespeichert: Lernen ${a.start}–${a.end} überschneidet sich mit Lernen ${b.start}–${b.end}.`);
    return false;
  }
  const o=plannerDayOverride(date);
  o.learningBlocks=n.list;
  // Lernblöcke planen nur die Uhrzeit. Das Lernziel/Soll bleibt unabhängig.
  save();
  return true;
}
function deleteLearningBlockFromTag(date,key){
  const rendered=currentLearningBlocksForDate(date);
  const pos=rendered.findIndex(x=>x.renderKey===key);
  if(pos<0)return toast('Lernblock konnte nicht gefunden werden.');
  const chosen=rendered[pos];
  if(!confirm(`Lernblock ${chosen.start}–${chosen.end} wirklich löschen?`))return;
  const remaining=rendered.filter((_,i)=>i!==pos).map(x=>({
    start:x.start,end:x.end,minutes:Number(x.minutes||0),
    label:x.source==='bib'?'Lernen (in der Bib)':'Lernen',source:x.source
  }));
  if(saveDayLearningBlocks(date,remaining))toast('Lernblock gelöscht.');
}
function addLearningBlockFromTag(date){
  const from=prompt(`Neuer Lernblock am ${fmtDate(date)} – Von (HH:MM):`,'');
  if(from===null)return;
  if(!/^\d{2}:\d{2}$/.test(from)||timeToMins(from)>=1440)return toast('Bitte eine gültige Startzeit eingeben.');
  const to=prompt(`Neuer Lernblock am ${fmtDate(date)} – Bis (HH:MM):`,'');
  if(to===null)return;
  if(!/^\d{2}:\d{2}$/.test(to)||timeToMins(to)>=1440||timeToMins(to)<=timeToMins(from))
    return toast('Bitte eine gültige Endzeit eingeben.');

  const bib=basePlannerRulesForDate(date).find(r=>r.type==='bib');
  const insideBib=!!(bib&&timeToMins(from)>=timeToMins(bib.start)&&timeToMins(to)<=timeToMins(bib.end));
  const fixed=plannerGeneratedItems(date).filter(x=>plannerFixedType(x.type)&&x.start&&x.end&&!(insideBib&&x.type==='bib'));
  const fixedConflict=fixed.find(x=>timeToMins(from)<timeToMins(x.end)&&timeToMins(to)>timeToMins(x.start));
  if(fixedConflict)return toast(`Dieser Lernblock überschneidet sich mit „${fixedConflict.name}“ (${fixedConflict.start}–${fixedConflict.end}).`);

  const current=currentLearningBlocksForDate(date).map(x=>({
    start:x.start,end:x.end,minutes:Number(x.minutes||0),
    label:x.source==='bib'?'Lernen (in der Bib)':'Lernen',source:x.source
  }));
  current.push({
    start:from,end:to,minutes:timeToMins(to)-timeToMins(from),
    label:insideBib?'Lernen (in der Bib)':'Lernen',
    source:insideBib?'bib':'outside'
  });
  if(saveDayLearningBlocks(date,current))toast('Lernblock hinzugefügt.');
}
function currentLearningBlocksForDate(date){
  const target=baseStudyTargetForDate(date),sw=plannerStudyWindows(date,target),arr=[];
  sw.bibBlocks.forEach((b,i)=>arr.push({...b,source:'bib',renderKey:`bib-study:${date}:${i}`}));
  sw.blocks.forEach((b,i)=>arr.push({...b,source:'outside',renderKey:`study-block:${date}:${i}`}));
  return arr.sort((a,b)=>a.start.localeCompare(b.start));
}
function editWakeFromTag(date){
  const current=plannerGeneratedItems(date).find(x=>x.type==='wake')?.start||'08:00';
  const raw=prompt(`Neue Aufstehzeit für ${fmtDate(date)} (HH:MM):`,current);
  if(raw===null)return;
  if(!/^\d{2}:\d{2}$/.test(raw)||timeToMins(raw)>=1440)return toast('Bitte eine gültige Uhrzeit eingeben, z. B. 10:00.');
  const wd=parseDate(date).getDay(),weekdayName=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][wd];
  const scope=prompt(`Wie soll die Änderung gelten?\n1 = Nur ${fmtDate(date)}\n2 = Alle zukünftigen ${weekdayName}e`, '1');
  if(scope===null)return;
  const delta=clockDiff(raw,current);
  if(String(scope).trim()==='2'){
    const w=plannerState();
    if(wd===0)w.sundayWakeTime=raw;
    w.rules.forEach(r=>{
      if(Number(r.weekday)===wd&&plannerFlexibleType(r.type)&&r.start){
        const dur=r.end?dayPlanDuration(r):0;
        r.start=shiftClock(r.start,delta);
        if(r.end)r.end=addMinsTime(r.start,dur);
      }
    });
    save();toast(`Alle zukünftigen ${weekdayName}e wurden um ${delta>=0?'+':''}${delta} Min. verschoben.`);
  }else{
    const o=plannerDayOverride(date);
    o.wakeTime=raw;
    o.wakeShiftMins=Number(o.wakeShiftMins||0)+delta;
    save();toast(`Nur ${fmtDate(date)} wurde um ${delta>=0?'+':''}${delta} Min. verschoben.`);
  }
}
function editLearningBlockFromTag(date,key){
  const rendered=currentLearningBlocksForDate(date),chosen=rendered.find(x=>x.renderKey===key);
  if(!chosen)return toast('Lernblock konnte nicht gefunden werden.');

  const action=prompt(`Lernblock ${chosen.start}–${chosen.end}\n1 = Von/Bis ändern\n2 = Löschen`, '1');
  if(action===null)return;
  if(String(action).trim()==='2'){deleteLearningBlockFromTag(date,key);return}

  const from=prompt(`Lernen am ${fmtDate(date)} – Von (HH:MM):`,chosen.start);
  if(from===null)return;
  if(!/^\d{2}:\d{2}$/.test(from)||timeToMins(from)>=1440)return toast('Bitte eine gültige Startzeit eingeben.');

  const to=prompt(`Lernen am ${fmtDate(date)} – Bis (HH:MM):`,chosen.end);
  if(to===null)return;
  if(!/^\d{2}:\d{2}$/.test(to)||timeToMins(to)>=1440||timeToMins(to)<=timeToMins(from))
    return toast('Bitte eine gültige Endzeit nach der Startzeit eingeben.');

  const bib=basePlannerRulesForDate(date).find(r=>r.type==='bib');
  const insideBib=!!(bib&&timeToMins(from)>=timeToMins(bib.start)&&timeToMins(to)<=timeToMins(bib.end));
  const fixed=plannerGeneratedItems(date).filter(x=>plannerFixedType(x.type)&&x.start&&x.end&&!(insideBib&&x.type==='bib'));
  const fixedConflict=fixed.find(x=>timeToMins(from)<timeToMins(x.end)&&timeToMins(to)>timeToMins(x.start));
  if(fixedConflict)return toast(`Dieser Lernblock überschneidet sich mit „${fixedConflict.name}“ (${fixedConflict.start}–${fixedConflict.end}).`);

  const updated=rendered.map(x=>({
    start:x.start,end:x.end,minutes:Number(x.minutes||0),
    label:x.source==='bib'?'Lernen (in der Bib)':'Lernen',source:x.source
  }));
  const pos=rendered.findIndex(x=>x.renderKey===key);
  const oldDuration=timeToMins(updated[pos].end)-timeToMins(updated[pos].start);
  const newDuration=timeToMins(to)-timeToMins(from);
  const delta=newDuration-oldDuration;

  updated[pos]={
    start:from,end:to,minutes:newDuration,
    label:insideBib?'Lernen (in der Bib)':'Lernen',
    source:insideBib?'bib':'outside'
  };

  const n=normalizeLearningBlocks(updated);
  if(n.conflicts.length){
    const [i,j]=n.conflicts[0],a=n.list[i],b=n.list[j];
    return toast(`Nicht gespeichert: Lernen ${a.start}–${a.end} überschneidet sich mit Lernen ${b.start}–${b.end}.`);
  }

  if(saveDayLearningBlocks(date,n.list)){
    if(delta){
      const o=plannerDayOverride(date),oldEnd=timeToMins(chosen.end);
      o.shiftEvents=o.shiftEvents||[];
      o.shiftEvents.push({afterMin:oldEnd,delta});
      save();
      toast(`Lernblock gespeichert. Spätere flexible Termine wurden um ${delta>=0?'+':''}${delta} Min. verschoben.`);
    }else{
      toast('Lernblock gespeichert.');
    }
  }
}
function openManualActivityForTag(date,type='other'){
  dayPlanDate=date;openDayPlanItem();
  $('#dayPlanType').value=type;
  if(type==='study'&&!$('#dayPlanTitle').value)$('#dayPlanTitle').value='Lernen';
}
function smartChangeDay(delta){
  const d=parseDate(dayPlanDate);d.setDate(d.getDate()+delta);dayPlanDate=localISO(d);renderDailyPlan();
}
function smartChangeWeek(delta){
  const d=parseDate(dayPlanDate);d.setDate(d.getDate()+delta*7);dayPlanDate=localISO(d);renderWeekPlanner();
}
document.getElementById('smartDayPrev').onclick=()=>smartChangeDay(-1);
document.getElementById('smartDayNext').onclick=()=>smartChangeDay(1);
document.getElementById('smartDayToday').onclick=()=>{dayPlanDate=todayISO();renderDailyPlan()};
document.getElementById('smartDayDatePicker').addEventListener('change',e=>{if(e.target.value){dayPlanDate=e.target.value;renderDailyPlan()}});
document.getElementById('smartDayItems').addEventListener('click',e=>{
  const wake=e.target.closest('[data-day-wake-edit]');
  if(wake){editWakeFromTag(wake.dataset.dayWakeEdit);return}
  const learn=e.target.closest('[data-day-learning-edit]');
  if(learn){editLearningBlockFromTag(dayPlanDate,learn.dataset.dayLearningEdit);return}
  const del=e.target.closest('[data-day-learning-delete]');
  if(del){deleteLearningBlockFromTag(dayPlanDate,del.dataset.dayLearningDelete);return}
  const manualEdit=e.target.closest('[data-dayplan-edit]');
  if(manualEdit){openDayPlanItem(manualEdit.dataset.dayplanEdit);return}
  const missed=e.target.closest('[data-makeup-missed]');
  if(missed){const sourceKey=missed.dataset.makeupMissed,title=missed.dataset.makeupTitle||'Vorlesung',minutes=Number(missed.dataset.makeupMinutes||90);if(makeupForSource(dayPlanDate,sourceKey))return toast('Diese Vorlesung ist bereits im Nachholen erfasst.');const subjectId=findSubjectForTitle(title);if(subjectId){if(addMakeupEntry({title,date:dayPlanDate,minutes,sourceKey,subjectId})){save();toast(`${title}: ${minsText(minutes)} zu Nachholen + Semesterbedarf hinzugefügt`)}return}openMakeupDialog('',title,dayPlanDate,minutes,'missed');return}
});
document.getElementById('addLearningBlock').addEventListener('click',()=>openManualActivityForTag(dayPlanDate,'study'));
document.getElementById('addManualActivity').addEventListener('click',()=>openManualActivityForTag(dayPlanDate,'other'));
function updateMakeupDialogType(){const type=document.getElementById('makeupType').value,dateField=document.getElementById('makeupDateField'),date=document.getElementById('makeupDate'),hours=document.getElementById('makeupHours'),title=document.getElementById('makeupTitle'),hint=document.getElementById('makeupHint');const semester=type==='semester';dateField.classList.toggle('hidden',semester);date.required=!semester;hours.max=semester?'999':'24';if(semester){if(!title.value||title.value.startsWith('Vorlesung '))title.value='Geplanter Nachholbedarf';hint.textContent='Semester-Nachholbedarf gilt für das ganze Semester, braucht kein Datum und kann auch mehr als 24 Stunden enthalten. Er wird separat verfolgt und zusätzlich zum normalen Semester-Lernbedarf eingeplant.'}else{if(title.value==='Geplanter Nachholbedarf')title.value='';hint.textContent='Eine einzelne verpasste Vorlesung wird mit Datum erfasst und zusätzlich zum vorhandenen Nachholbedarf addiert.'}}
function openMakeupDialog(subjectId='',title='',date=dayPlanDate,minutes=90,type='semester',entryId=''){populateSubjectSelects();document.getElementById('makeupEntryId').value=entryId||'';document.getElementById('makeupDialogTitle').textContent=entryId?'Nachholbedarf bearbeiten':'Nachholzeit hinzufügen';document.getElementById('makeupType').value=type;document.getElementById('makeupSubject').value=subjectId||state.subjects[0]?.id||'';document.getElementById('makeupTitle').value=title||'';document.getElementById('makeupDate').value=date||dayPlanDate;document.getElementById('makeupHours').value=String(Math.floor(minutes/60));document.getElementById('makeupMinutes').value=String(minutes%60);updateMakeupDialogType();document.getElementById('makeupDialog').showModal()}
function editMakeupEntry(id){const x=makeupEntries().find(v=>v.id===id);if(!x)return;openMakeupDialog(x.subjectId||'',x.title,x.date||dayPlanDate,Number(x.minutes||0),x.type||'semester',x.id)}
function openMakeupStudySession(subjectId){$('#manualSessionId').value='';$('#manualSessionForm').reset();$('#manualStudyType').value='makeup';$('#manualDate').value=todayISO();$('#manualSessionTitle').textContent='Nachhol-Session hinzufügen';populateSubjectSelects();$('#manualSubject').value=subjectId;$('#manualHours').value='1';$('#manualMinutes').value='0';$('#manualSessionDialog').showModal()}
function findSubjectForTitle(title=''){const t=String(title).toLowerCase();return state.subjects.find(s=>t.includes(String(s.name).toLowerCase())||String(s.name).toLowerCase().split(/\s+/).some(w=>w.length>=5&&t.includes(w)))?.id||''}
document.getElementById('addMakeupManual').addEventListener('click',()=>openMakeupDialog());
const addMakeupFromSubjects=document.getElementById('addMakeupFromSubjects');if(addMakeupFromSubjects)addMakeupFromSubjects.addEventListener('click',()=>openMakeupDialog());
document.getElementById('makeupType').addEventListener('change',updateMakeupDialogType);
document.getElementById('makeupForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const type=document.getElementById('makeupType').value,h=Number(document.getElementById('makeupHours').value||0),m=Number(document.getElementById('makeupMinutes').value||0),minutes=Math.round(h*60+m),subjectId=document.getElementById('makeupSubject').value,date=document.getElementById('makeupDate').value,id=document.getElementById('makeupEntryId').value,title=document.getElementById('makeupTitle').value.trim();if(!subjectId)return toast('Bitte ein Fach auswählen.');if(minutes<=0)return toast('Bitte Nachholzeit eingeben.');if(!title)return toast('Bitte eine Bezeichnung eingeben.');if(type==='missed'&&!date)return toast('Bitte Datum der verpassten Vorlesung auswählen.');if(id){const x=makeupEntries().find(v=>v.id===id);if(x)Object.assign(x,{title,date:type==='semester'?'':date,minutes,subjectId,type,updatedAt:new Date().toISOString()})}else addMakeupEntry({title,date,minutes,subjectId,type});save();document.getElementById('makeupDialog').close();document.getElementById('makeupEntryId').value='';toast(id?'Nachholbedarf wurde bearbeitet':`${minsText(minutes)} Nachholzeit hinzugefügt und zum Semesterbedarf addiert`)});


document.getElementById('smartDayMessages').addEventListener('click',e=>{
  const done=e.target.closest('[data-makeup-done]');if(done){const x=makeupEntries().find(v=>v.id===done.dataset.makeupDone);if(x){x.done=true;x.doneAt=new Date().toISOString();save();toast(`${x.title} als nachgeholt markiert`)}return}
  const del=e.target.closest('[data-makeup-delete]');if(del){const x=makeupEntries().find(v=>v.id===del.dataset.makeupDelete);if(x&&confirm(`Nachhol-Eintrag „${x.title}“ löschen?`)){state.nachholen.entries=makeupEntries().filter(v=>v.id!==x.id);save()}return}
});

document.getElementById('smartWeekPrev').onclick=()=>smartChangeWeek(-1);
document.getElementById('smartWeekNext').onclick=()=>smartChangeWeek(1);
document.getElementById('smartWeekDatePicker').addEventListener('change',e=>{if(e.target.value){dayPlanDate=e.target.value;renderWeekPlanner()}});

document.getElementById('planTabs').addEventListener('click',e=>{const b=e.target.closest('[data-plan-tab]');if(b)plannerSwitchTab(b.dataset.planTab)});
document.getElementById('plannerSettingsBtn').onclick=openPlannerSettings;
document.getElementById('addPlannerRule').onclick=()=>openPlannerRule();
document.getElementById('weekTodayBtn').onclick=()=>{dayPlanDate=todayISO();renderWeekPlanner()};
document.getElementById('editSmartStudyTarget').onclick=()=>{
  const date=dayPlanDate,current=baseStudyTargetForDate(date),cap=plannerDayStudyCapacity(date);
  const raw=prompt(`Lernziel für ${fmtDate(date)} in Stunden (max. sinnvoll ${Number(cap/60).toFixed(2)}):`,String(current/60));
  if(raw===null)return;
  const hours=Number(String(raw).replace(',','.'));
  if(!Number.isFinite(hours)||hours<0)return toast('Ungültige Stundenangabe.');
  const mins=Math.round(hours*60/15)*15;
  if(mins>cap)return toast(`Für ${fmtDate(date)} können höchstens ${minsText(cap)} sinnvoll eingeplant werden. Bitte wähle einen anderen Tag für den Rest.`);
  state.semesterPlan=state.semesterPlan||{days:{}};
  if(mins>0)state.semesterPlan.days[date]=mins/60;else delete state.semesterPlan.days[date];
  const dayO=plannerDayOverride(date);
  if(!plannerState().manualMode)dayO.learningBlocks=null;
  dayO.shiftEvents=[];
  plannerState().studyAdjustments[date]=0;
  save();toast(plannerState().manualMode?'Semester-Lernziel aktualisiert. Deine Lernblöcke bleiben unverändert.':'Lernziel in Tag und Semesterplanung aktualisiert');
};

document.getElementById('moveOpenTomorrow').onclick=()=>moveStudyOpen(dayPlanDate,'tomorrow');
document.getElementById('autoDistributeOpen').onclick=()=>moveStudyOpen(dayPlanDate,'auto');
document.getElementById('weekOverview').addEventListener('click',e=>{const c=e.target.closest('[data-week-date]');if(c){dayPlanDate=c.dataset.weekDate;plannerSwitchTab('day');renderDailyPlan()}});
document.getElementById('smartDayItems').addEventListener('change',e=>{if(e.target.matches('[data-planner-done]'))setPlannerCompletion(dayPlanDate,e.target.dataset.plannerDone,{done:e.target.checked})});
document.getElementById('smartDayItems').addEventListener('click',e=>{
  const a=e.target.closest('[data-planner-actual]');if(a){const cur=plannerCompletion(dayPlanDate,a.dataset.plannerActual)?.actualMins||0,v=prompt('Tatsächliche Dauer in Minuten:',String(cur));if(v!==null&&Number(v)>=0)setPlannerCompletion(dayPlanDate,a.dataset.plannerActual,{actualMins:Number(v)})}
  const ed=e.target.closest('[data-planner-edit-rule]');if(ed)openPlannerRule(ed.dataset.plannerEditRule);
});
document.getElementById('plannerRuleList').addEventListener('click',e=>{
  const ed=e.target.closest('[data-planner-edit-rule]');if(ed)return openPlannerRule(ed.dataset.plannerEditRule);
  const tg=e.target.closest('[data-planner-toggle-rule]');if(tg){const r=plannerState().rules.find(x=>x.id===tg.dataset.plannerToggleRule);if(r){r.enabled=!r.enabled;save()}}
});
document.addEventListener('click',e=>{if(e.target.id==='openPlannerSettings')openPlannerSettings()});
document.getElementById('plannerRuleForm').addEventListener('submit',e=>{
  if(e.submitter?.value==='cancel')return;e.preventDefault();
  const id=document.getElementById('plannerRuleId').value||uid(),w=plannerState(),old=w.rules.find(x=>x.id===id);
  const r={id,type:document.getElementById('plannerRuleType').value,name:document.getElementById('plannerRuleName').value.trim(),weekday:Number(document.getElementById('plannerRuleWeekday').value),start:document.getElementById('plannerRuleStart').value,end:document.getElementById('plannerRuleEnd').value,repeat:document.getElementById('plannerRuleRepeat').value,anchor:document.getElementById('plannerRuleAnchor').value,studyMin:Number(document.getElementById('plannerRuleStudyMin').value||0),enabled:document.getElementById('plannerRuleEnabled').checked};
  if(r.type!=='vmt'&&r.start&&r.end&&timeToMins(r.end)<=timeToMins(r.start))return toast('Ende muss nach Start liegen.');
  if(old)Object.assign(old,r);else w.rules.push(r);save();document.getElementById('plannerRuleDialog').close();toast('Regel gespeichert');
});
document.getElementById('deletePlannerRule').onclick=()=>{const id=document.getElementById('plannerRuleId').value;if(id&&confirm('Diese Regel löschen?')){plannerState().rules=plannerState().rules.filter(x=>x.id!==id);save();document.getElementById('plannerRuleDialog').close()}};
document.getElementById('plannerSettingsForm').addEventListener('submit',e=>{
  if(e.submitter?.value==='cancel')return;e.preventDefault();const w=plannerState();const oldSundayWake=w.sundayWakeTime||'08:30';
  const map={wpSemesterStart:'semesterStart',wpSemesterEnd:'semesterEnd',wpLectureFreeStart:'lectureFreeStart',wpLectureFreeEnd:'lectureFreeEnd'};
  Object.entries(map).forEach(([id,k])=>w[k]=document.getElementById(id).value);
  const nums={wpPrepMin:'prepMin',wpUniTravelMin:'uniTravelMin',wpBibTravelMin:'bibTravelMin',wpVmtTravelMin:'vmtTravelMin',wpVmtDurationMin:'vmtDurationMin',wpVmtStudyCapMin:'vmtStudyCapMin',wpGymMin:'gymMin',wpMealPrepMin:'mealPrepMin',wpSleepMin:'sleepMin',wpSleepPreferred:'sleepPreferred',wpSundaySleep:'sundaySleep',wpCultureWeeklyMin:'cultureWeeklyMin'};
  Object.entries(nums).forEach(([id,k])=>w[k]=Number(document.getElementById(id).value||0));
  w.novemberVmtAccountingOnly=document.getElementById('wpNovemberAccounting').checked;
  ['freeDayStudyMaxMin','labDayStudyMaxMin','saturdayStudyMaxMin','sundayStudyMaxMin'].forEach(k=>{const id='wp'+k[0].toUpperCase()+k.slice(1);w[k]=Number(document.getElementById(id).value||0)});
  ['freeWakeTime','sundayWakeTime'].forEach(k=>{const id='wp'+k[0].toUpperCase()+k.slice(1);w[k]=document.getElementById(id).value||w[k]});
  const sundayDelta=clockDiff(w.sundayWakeTime||oldSundayWake,oldSundayWake);
  if(sundayDelta){
    w.rules.forEach(r=>{
      if(Number(r.weekday)===0&&plannerFlexibleType(r.type)&&r.start){
        const dur=r.end?dayPlanDuration(r):0;
        r.start=shiftClock(r.start,sundayDelta);
        if(r.end)r.end=addMinsTime(r.start,dur);
      }
    });
  }
  w.smartPlanRevision='';
  syncSemesterPlanFromWeeklyPattern(true);
  save();document.getElementById('plannerSettingsDialog').close();toast('Wochenplan und Semesterplanung wurden synchronisiert');
});

// Existing Tagesplan rendering stays, but smart planner is recalculated whenever the date changes.
const renderDailyPlanV44=renderDailyPlan;
renderDailyPlan=function(){renderPlannerAll()};
const simpleSemesterSave=document.getElementById('savePlannerSemesterDates');
if(simpleSemesterSave)simpleSemesterSave.addEventListener('click',()=>{
  const start=document.getElementById('plannerSemesterStartSimple')?.value||'';
  const end=document.getElementById('plannerSemesterEndSimple')?.value||'';
  if(!start||!end)return toast('Bitte Beginn und Ende eintragen.');
  if(end<start)return toast('Das Semesterende muss nach dem Semesterbeginn liegen.');
  state.semester=state.semester||{};
  state.semester.start=start;state.semester.end=end;
  const w=plannerState();w.semesterStart=start;w.semesterEnd=end;
  if(state.semesterPlan?.days){state.semesterPlan.days=Object.fromEntries(Object.entries(state.semesterPlan.days).filter(([d])=>d>=start&&d<=end));}
  save();renderAll();toast('Semesterzeitraum gespeichert');
});

plannerState();
if(syncSemesterPlanFromWeeklyPattern(false)){persistLocal(true)}

/* ===== WesStudy v4.5: tägliche Lernkontrolle ===== */
function plannedStudyMinsForDate(date){
  if(state.holiday&&overlapDate(date,state.holiday.start,state.holiday.end)) return Number(state.holiday.days?.[date]||0)*60;
  return Number(state.semesterPlan?.days?.[date]||0)*60;
}
function dailyStudySourceForDate(date){
  if(state.holiday&&overlapDate(date,state.holiday.start,state.holiday.end)) return 'Ferienplan';
  return 'Semesterplanung';
}
function openDailyStudyEntry(date=todayISO(),full=false){
  const planned=plannedStudyMinsForDate(date),done=sessionsOn(date),remaining=Math.max(0,planned-done);
  $('#dailyStudyDate').value=date;
  $('#dailyStudyDateText').textContent=fmtDate(date);
  $('#dailyStudyPlanText').textContent=`Laut ${dailyStudySourceForDate(date)}: ${minsText(planned)} geplant · ${minsText(done)} bereits erledigt`;
  $('#dailyStudyType').value='normal';
  updateStudySubjectSelect('dailyStudyType','dailyStudySubject');
  const mins=full?remaining:0;
  $('#dailyStudyHours').value=Math.floor(mins/60);
  $('#dailyStudyMinutes').value=mins%60;
  $('#dailyStudyDialog').showModal();
}
function renderDailyStudyTracking(){
  const today=todayISO(),planned=plannedStudyMinsForDate(today),done=sessionsOn(today),open=Math.max(0,planned-done),pct=planned?clamp(done/planned*100,0,100):(done?100:0);
  $('#dailyStudyTitle').textContent=`Heute — ${fmtDate(today)}`;
  $('#dailyStudySource').textContent=planned?`Aus dem ${dailyStudySourceForDate(today)}`:'Für heute ist keine Lernzeit geplant';
  $('#dailyTrackPlanned').textContent=minsText(planned);$('#dailyTrackDone').textContent=minsText(done);$('#dailyTrackOpen').textContent=minsText(open);$('#dailyTrackPercent').textContent=`${Math.round(pct)}%`;$('#dailyTrackProgress').style.width=`${pct}%`;
  const badge=$('#dailyStudyBadge');
  badge.className='status '+(planned&&done>=planned?'good':planned&&done?'warn':(!planned&&done?'good':''));
  badge.textContent=planned?(done>=planned?'Erledigt':done?'Offen':'Nicht geplant'):(done?'Zusätzlich gelernt':'Nicht geplant');
  $('#markTodayDone').disabled=!planned||done>=planned||!state.subjects.length;$('#enterTodayHours').disabled=!state.subjects.length;
  const dates=new Set();
  if(state.holiday?.days) Object.keys(state.holiday.days).forEach(d=>{if(d<today)dates.add(d)});
  if(state.semesterPlan?.days) Object.keys(state.semesterPlan.days).forEach(d=>{if(d<today)dates.add(d)});
  state.sessions.forEach(x=>{if(x?.date&&x.date<today&&Number(x.minutes||0)>0)dates.add(x.date)});
  const rows=[...dates].sort().reverse().slice(0,10);
  let backlog=0;
  $('#pastStudyDays').innerHTML=rows.length?`<div class="past-days-list">${rows.map(d=>{
    const pl=plannedStudyMinsForDate(d),dn=sessionsOn(d),op=Math.max(0,pl-dn),extra=Math.max(0,dn-pl);
    backlog+=op;
    let tone='neutral',label='Nicht geplant';
    if(pl===0&&dn>0){tone='good';label='Zusätzlich gelernt'}
    else if(pl===0){tone='neutral';label='Nicht geplant'}
    else if(dn>=pl){tone='good';label='Erreicht'}
    else if(dn>0){tone='warn';label=`${minsText(op)} offen`}
    else{tone='bad';label='Nicht gelernt'}
    const subtitle=`Geplant ${minsText(pl)} · Erledigt ${minsText(dn)}${extra>0&&pl>0?` · +${minsText(extra)} zusätzlich`:''}`;
    return `<div class="past-day-row" data-past-day="${d}">
      <div class="session-icon past-day-icon ${tone}">${statusSymbol(tone)}</div>
      <div class="past-day-main">
        <div class="past-day-date">${fmtDate(d)}</div>
        <div class="past-day-sub">${subtitle}</div>
      </div>
      <div class="past-day-status ${tone}">${statusSymbol(tone)}<span>${label}</span></div>
    </div>`}).join('')}</div>`:'<div class="muted">Noch keine vergangenen Plan- oder Lerntage.</div>';
  const backlogEl=$('#pastStudyBacklog');
  backlogEl.textContent=backlog?`Gesamtrückstand aus den angezeigten Tagen: ${minsText(backlog)}`:'Kein Rückstand in den angezeigten Tagen';
  backlogEl.className=backlog?'bad':'good';
}
$('#markTodayDone').onclick=()=>openDailyStudyEntry(todayISO(),true);
$('#enterTodayHours').onclick=()=>openDailyStudyEntry(todayISO(),false);
$('#pastStudyDays').addEventListener('click',e=>{const row=e.target.closest('[data-past-day]');if(row)openDailyStudyEntry(row.dataset.pastDay,false)});
$('#dailyStudyForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const minutes=Number($('#dailyStudyHours').value||0)*60+Number($('#dailyStudyMinutes').value||0),subjectId=$('#dailyStudySubject').value,date=$('#dailyStudyDate').value,studyType=$('#dailyStudyType').value;if(!subjectId||minutes<=0)return toast('Wähle ein Fach und gib eine Lernzeit ein.');if(studyType==='makeup'&&makeupRequiredForSubject(subjectId)<=0)return toast('Für dieses Fach ist kein Nachholbedarf eingetragen.');state.sessions.push({id:uid(),subjectId,date,minutes:Math.round(minutes),studyType,createdAt:new Date().toISOString(),source:'manual-daily'});save();$('#dailyStudyDialog').close();toast(studyType==='makeup'?'Nachholzeit wurde gespeichert':'Lernzeit wurde gespeichert')});
function setupTimer(){if(timer.running)return;const subj=$('#timerSubject').value;if(!subj)return toast('Füge zuerst ein Fach hinzu und wähle es aus.');const preset=$('#timerPreset').value;timer.open=preset==='open';timer.focusSec=Math.max(60,Number($('#focusMinutes').value||25)*60);timer.breakSec=Math.max(0,Number($('#breakMinutes').value||5)*60);timer.totalRounds=Math.max(1,Number($('#roundCount').value||1));timer.round=1;timer.mode='focus';timer.remaining=timer.open?0:timer.focusSec;timer.accumulatedFocus=0;timer.startedAt=Date.now();timer.running=true;timer.paused=false;lockTimerSettings(true);$('#timerStart').textContent='Läuft';$('#timerStart').disabled=true;$('#timerPause').disabled=false;$('#timerStop').disabled=false;tick();timer.interval=setInterval(tick,1000);renderRounds()}
function tick(){if(!timer.running||timer.paused)return;if(timer.open){const elapsed=Math.floor((Date.now()-timer.startedAt)/1000);timer.remaining=elapsed;$('#timerDisplay').textContent=formatSec(elapsed);$('#timerProgress').style.width='100%';return}timer.remaining--;if(timer.mode==='focus')timer.accumulatedFocus++;if(timer.remaining<=0)advanceTimer();renderTimerDisplay()}
function advanceTimer(){beep();if(timer.mode==='focus'){if(timer.round>=timer.totalRounds){finishTimer(true);return}timer.mode='break';timer.remaining=timer.breakSec}else{timer.mode='focus';timer.round++;timer.remaining=timer.focusSec}renderRounds()}
function renderTimerDisplay(){if(timer.open){$('#timerDisplay').textContent=formatSec(timer.remaining);return}$('#timerDisplay').textContent=formatSec(timer.remaining);$('#timerMode').textContent=timer.mode==='focus'?`Lernzeit · Runde ${timer.round}/${timer.totalRounds}`:'Pause';const total=timer.mode==='focus'?timer.focusSec:timer.breakSec;$('#timerProgress').style.width=`${total?clamp((total-timer.remaining)/total*100,0,100):100}%`}
function formatSec(sec){return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function pauseTimer(){timer.paused=!timer.paused;if(!timer.paused)timer.startedAt=Date.now()-(timer.open?timer.remaining*1000:0);$('#timerPause').textContent=timer.paused?'Fortsetzen':'Pausieren';$('#timerMode').textContent=timer.paused?'Pausiert':timer.mode==='focus'?'Lernzeit':'Pause'}
function finishTimer(auto=false){if(!timer.running)return;clearInterval(timer.interval);let mins=timer.open?Math.max(1,Math.round(timer.remaining/60)):Math.round(timer.accumulatedFocus/60);if(mins>0){state.sessions.push({id:uid(),subjectId:$('#timerSubject').value,date:todayISO(),minutes:mins,createdAt:new Date().toISOString(),source:'timer'});save();toast(`${minsText(mins)} Lernzeit gespeichert${isHolidayStudyDate()?' und im Ferienplan erfasst':''}`)}resetTimer();if(auto)toast('Alle Runden abgeschlossen')}
function resetTimer(){clearInterval(timer.interval);timer={running:false,paused:false,mode:'focus',round:1,totalRounds:Number($('#roundCount').value||4),focusSec:Number($('#focusMinutes').value||25)*60,breakSec:Number($('#breakMinutes').value||5)*60,remaining:Number($('#focusMinutes').value||25)*60,startedAt:null,accumulatedFocus:0,interval:null,open:$('#timerPreset').value==='open'};lockTimerSettings(false);$('#timerStart').disabled=false;$('#timerStart').textContent='Starten';$('#timerPause').disabled=true;$('#timerPause').textContent='Pausieren';$('#timerStop').disabled=true;$('#timerMode').textContent='Lernzeit';$('#timerDisplay').textContent=timer.open?'00:00':formatSec(timer.remaining);$('#timerProgress').style.width='0%';renderRounds()}
function lockTimerSettings(lock){['timerSubject','focusMinutes','breakMinutes','roundCount','timerPreset'].forEach(id=>$('#'+id).disabled=lock)}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);g.gain.value=.08;o.frequency.value=780;o.start();o.stop(c.currentTime+.16)}catch{}if(navigator.vibrate)navigator.vibrate([120,70,120])}


addEventListener('click',e=>{const navBtn=e.target.closest('[data-nav]');if(navBtn)nav(navBtn.dataset.nav);const open=e.target.closest('[data-open]');if(open)openDialog(open.dataset.open);const am=e.target.closest('[data-add-makeup-subject]');if(am){const sub=state.subjects.find(x=>x.id===am.dataset.addMakeupSubject);openMakeupDialog(am.dataset.addMakeupSubject,sub?`${sub.name} – Nachholen`:'');}const ms=e.target.closest('[data-add-makeup-session]');if(ms){openMakeupStudySession(ms.dataset.addMakeupSession);return}const me=e.target.closest('[data-edit-makeup]');if(me){editMakeupEntry(me.dataset.editMakeup);return}const md=e.target.closest('[data-sub-makeup-done]');if(md){const x=makeupEntries().find(v=>v.id===md.dataset.subMakeupDone);if(x){x.done=true;x.doneAt=new Date().toISOString();save();toast(`${x.title} als nachgeholt markiert`)}return}const mx=e.target.closest('[data-sub-makeup-delete]');if(mx){const x=makeupEntries().find(v=>v.id===mx.dataset.subMakeupDelete);if(x&&confirm(`Nachhol-Eintrag „${x.title}“ löschen?`)){state.nachholen.entries=makeupEntries().filter(v=>v.id!==x.id);save()}return}const ed=e.target.closest('[data-edit-subject]');if(ed)editSubject(ed.dataset.editSubject);const del=e.target.closest('[data-delete-subject]');if(del)deleteSubject(del.dataset.deleteSubject);const es=e.target.closest('[data-edit-session]');if(es)editSession(es.dataset.editSession);const ds=e.target.closest('[data-delete-session]');if(ds)deleteSession(ds.dataset.deleteSession);const cd=e.target.closest('[data-cal-date]');if(cd){const d=cd.dataset.calDate;if(holidayDraft.days[d]!=null)delete holidayDraft.days[d];else holidayDraft.days[d]=Number($('#defaultHolidayHours').value||3);renderCalendar();renderSelectedHolidayDays()}const rh=e.target.closest('[data-remove-holiday-day]');if(rh){delete holidayDraft.days[rh.dataset.removeHolidayDay];renderCalendar();renderSelectedHolidayDays()}});
addEventListener('input',e=>{if(e.target.matches('[data-holiday-hours]')){holidayDraft.days[e.target.dataset.holidayHours]=Number(e.target.value||0);renderCalendar()}});
$('#calPrev').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};$('#calNext').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};
$('#themeBtn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';save()};$('#settingsBtn').onclick=()=>$('#settingsDialog').showModal();
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`WesStudy-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href)};
$('#importInput').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!data.semester||!Array.isArray(data.subjects)||!Array.isArray(data.sessions))throw 0;state={...structuredClone(defaultState),...data};save();$('#settingsDialog').close();toast('Daten wurden importiert')}catch{toast('Ungültige Sicherungsdatei')}};
$('#resetBtn').onclick=()=>{if(confirm('Alle Fächer, Sessions und Pläne werden dauerhaft gelöscht. Fortfahren?')){state=structuredClone(defaultState);save();$('#settingsDialog').close();toast('Alle Daten wurden gelöscht')}};
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBanner').classList.add('show')});$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBanner').classList.remove('show')};
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

/* ===== WesStudy v2 additive update ===== */
const seededModules=[
['Anerkannte Leistungen 1. Semester',14,'1','1','passed'],
['Werkstoff',5,'1','2','passed'],['ET1',4,'1','2','passed'],['HM2',6,'2','2','passed'],['TM 2',5,'2','2','failed'],['ET 2',6,'2','2','passed'],['CAD',3,'2','2','passed'],['Info 1',6,'1','2','passed'],['FEM',1,'2','2','passed'],
['Einführung Projekt',2,'1','3','passed'],['Informatik 2 Labor',3,'2','3','passed'],['Informatik 2',3,'2','3','failed'],['Bauelemente',2,'2','3','open'],['TM 2',5,'2','3','passed'],['ET 3 Labor',3,'3','3','passed'],['ET 3',3,'3','3','passed'],
['Wahlpflichtmodul 2',4,'6','Sommer','passed'],
['Mikrocomputer',3,'3','4','open'],['Entwicklung/Produktion/Fert.',6,'3','4','open'],['TM 3',6,'3','4','open'],['Mikrocomputer Labor',3,'3','4','open'],['HM 3',4,'3','4','open'],['Numerisches Labor',2,'3','4','open'],['Schwerpunktmodul 1 – Robotik und Bionik 1',6,'4','4','open'],['Regelungstechnik',6,'4','4','open'],['Informatik 2',3,'2','4','planned'],
['Entwicklungsprojekt',6,'6','5','open'],['Qualitätsmanagement und -sicherung – Vorlesung',3,'6','5','open'],['Informationstechnik VL',4,'7','5','open'],['Informationstechnik LA',2,'7','5','open'],['Sensorik und Aktorik',6,'4','5','open'],['Entwicklung/Produktion 2',6,'4','5','open'],
['Praxis',30,'5','6','open'],['Schwerpunktmodul 2 – Robotik und Bionik 1',6,'6','6','open'],['Wahlpflichtmodul 1',6,'6','6','open'],['Mechatronische Systeme in der Automatisierung',6,'7','6','open'],
['Bachelorarbeit',18,'7','7','open'],['Wahlpflichtmodul 2',2,'6','7','open'],['Industrielle Mechatronik – Labor',2,'6','7','open'],['Qualitätsmanagement und -sicherung – Labor',2,'6','7','open'],['Industrielle Mechatronik – Vorlesung',5,'6','7','open']
].map((m,i)=>({id:'lp_seed_'+i,name:m[0],lp:m[1],originSemester:m[2],planSemester:m[3],status:m[4],examDate:'',useInStudy:false,subjectId:null}));
if(!state.studyProgress)state.studyProgress={degreeTotal:210,currentSemester:'4',modules:seededModules};
else{state.studyProgress.degreeTotal=state.studyProgress.degreeTotal||210;state.studyProgress.currentSemester=state.studyProgress.currentSemester||'4';state.studyProgress.modules=Array.isArray(state.studyProgress.modules)?state.studyProgress.modules:seededModules}
state.lang='de'; persistLocal(false); state.timerSettings={...defaultState.timerSettings,...(state.timerSettings||{})};



function statusLabel(v){const de={open:'Offen',planned:'Geplant',active:'In Bearbeitung',exam:'Prüfung abgelegt',passed:'Bestanden',failed:'Wiederholung',postponed:'Verschoben'};return de[v]||v}
function renderStudyProgress(){
  const sp=state.studyProgress,mods=sp.modules||[],norm=n=>String(n||'').trim().toLowerCase().replace(/\s+/g,' '),key=m=>`${norm(m.name)}__${Number(m.lp||0)}`;
  const uniqueMap=new Map();
  for(const m of mods){
    const k=key(m);if(!k)continue;
    if(!uniqueMap.has(k)) uniqueMap.set(k,m);
    else {
      const prev=uniqueMap.get(k);
      const score=v=>({passed:5,active:4,exam:3,planned:2,open:1,failed:0,postponed:0}[v]??0);
      if(score(m.status)>score(prev.status)||String(m.planSemester)>String(prev.planSemester)) uniqueMap.set(k,m);
    }
  }
  const uniqueMods=[...uniqueMap.values()];
  const total=uniqueMods.reduce((a,m)=>a+Number(m.lp||0),0);
  const passedKeys=new Set(mods.filter(m=>m.status==='passed').map(key));
  const currentKeys=new Set(mods.filter(m=>String(m.planSemester)===String(sp.currentSemester)&&m.status!=='passed').map(key));
  const passed=uniqueMods.filter(m=>passedKeys.has(key(m))).reduce((a,m)=>a+Number(m.lp||0),0);
  const current=uniqueMods.filter(m=>currentKeys.has(key(m))&&!passedKeys.has(key(m))).reduce((a,m)=>a+Number(m.lp||0),0);
  sp.degreeTotal=total;$('#lpTotal').textContent=total+' LP';$('#lpPassed').textContent=passed+' LP';$('#lpOpen').textContent=Math.max(0,total-passed)+' LP';$('#lpCurrent').textContent=current+' LP';$('#degreeTotalLp').value=total;$('#currentPlanSemester').value=sp.currentSemester;
  const order=['1','2','3','Sommer','4','5','6','7'];
  $('#lpGroups').innerHTML=order.map(sem=>{const rows=mods.filter(m=>String(m.planSemester)===sem);if(!rows.length)return'';const semUnique=new Map();for(const m of rows){const k=key(m);if(!semUnique.has(k))semUnique.set(k,m)}const semRows=[...semUnique.values()],sum=semRows.reduce((a,m)=>a+Number(m.lp||0),0),done=semRows.filter(m=>passedKeys.has(key(m))).reduce((a,m)=>a+Number(m.lp||0),0);return `<div class="card lp-semester"><div class="lp-semester-head"><div><h3>${sem==='Sommer'?'Sommer':sem+'. Semester'}</h3><div class="muted">${done}/${sum} LP</div></div><span class="status ${sem===String(sp.currentSemester)?'good':''}">${sem===String(sp.currentSemester)?'Aktuell':sum+' LP'}</span></div><div class="lp-table">${rows.map(m=>`<div class="lp-row ${sem===String(sp.currentSemester)?'lp-current':''}"><div><strong>${esc(m.name)}</strong><div class="muted lp-origin">Aus Semester ${esc(m.originSemester||'—')}</div></div><b>${m.lp} LP</b><span class="lp-status ${m.status}">${statusLabel(m.status)}</span><button class="mini-btn" data-edit-lp="${m.id}">Bearbeiten</button></div>`).join('')}</div></div>`}).join('')
}
function openLp(id){const m=id?state.studyProgress.modules.find(x=>x.id===id):null;$('#lpId').value=m?.id||'';$('#lpName').value=m?.name||'';$('#lpCredits').value=m?.lp||'';$('#lpOriginSemester').value=m?.originSemester||'';$('#lpPlanSemester').value=m?.planSemester||state.studyProgress.currentSemester;$('#lpStatus').value=m?.status||'open';$('#lpExamDate').value=m?.examDate||'';$('#lpUseInStudy').checked=!!m?.useInStudy;$('#lpDelete').classList.toggle('hidden',!m);$('#lpDialogTitle').textContent=m?'Modul bearbeiten':'Modul hinzufügen';$('#lpDialog').showModal()}
$('#addLpModule').onclick=()=>openLp();$('#lpForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const id=$('#lpId').value||uid(),old=state.studyProgress.modules.find(x=>x.id===id),m={id,name:$('#lpName').value.trim(),lp:Number($('#lpCredits').value),originSemester:$('#lpOriginSemester').value.trim(),planSemester:$('#lpPlanSemester').value,status:$('#lpStatus').value,examDate:$('#lpExamDate').value,useInStudy:$('#lpUseInStudy').checked,subjectId:old?.subjectId||null};if(m.useInStudy&&!m.subjectId){const existing=state.subjects.find(s=>s.name.trim().toLowerCase()===m.name.toLowerCase());if(existing)m.subjectId=existing.id;else{m.subjectId=uid();state.subjects.push({id:m.subjectId,name:m.name,credits:m.lp,color:'#6d5dfc',start:state.semester.start||'',end:state.semester.end||''})}}if(old)state.studyProgress.modules=state.studyProgress.modules.map(x=>x.id===id?m:x);else state.studyProgress.modules.push(m);save();$('#lpDialog').close()});
$('#lpDelete').onclick=()=>{const id=$('#lpId').value;if(!id)return;if(confirm('Dieses Modul aus der LP-Planung löschen?')){state.studyProgress.modules=state.studyProgress.modules.filter(x=>x.id!==id);save();$('#lpDialog').close()}};
$('#currentPlanSemester').onchange=e=>{state.studyProgress.currentSemester=e.target.value;save()};
addEventListener('click',e=>{const x=e.target.closest('[data-edit-lp]');if(x)openLp(x.dataset.editLp)});

const originalRenderAll=renderAll;renderAll=function(){originalRenderAll();renderStudyProgress()};


/* ===== WesStudy v3: modal, locale and LP-to-study fixes ===== */
(function v3Fixes(){
  const txt={
    de:{choose:'Fach hinzufügen',lp:'Aus LP-Plan auswählen',lpSub:'Vorhandene Module übernehmen',manual:'Manuell hinzufügen',manualSub:'Name und Credits selbst eingeben',select:'Module aus dem LP-Plan',addSelected:'Auswahl hinzufügen',none:'Keine weiteren Module verfügbar.',cancel:'Abbrechen',added:'Fächer wurden hinzugefügt',semester:'Semester',credits:'LP'}
  };
  const L=()=>txt.de;

  // Robustly restore page scrolling after every dialog close (especially iOS Safari).
  let lockedY=0;
  function lockPage(){
    if(document.body.classList.contains('ws-dialog-open'))return;
    lockedY=window.scrollY||0;
    document.body.style.top=`-${lockedY}px`;
    document.body.classList.add('ws-dialog-open');
  }
  function unlockPage(){
    if(!document.body.classList.contains('ws-dialog-open'))return;
    document.body.classList.remove('ws-dialog-open');
    document.body.style.top='';
    document.body.style.overflow='';
    document.documentElement.style.overflow='';
    requestAnimationFrame(()=>window.scrollTo(0,lockedY));
  }
  function wireDialog(d){
    if(!d||d.dataset.v3wired)return; d.dataset.v3wired='1';
    d.addEventListener('close',()=>setTimeout(unlockPage,0));
    d.addEventListener('cancel',()=>setTimeout(unlockPage,0));
    d.addEventListener('click',e=>{if(e.target===d){d.close();unlockPage()}});
  }
  document.querySelectorAll('dialog').forEach(wireDialog);
  const nativeShow=HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal=function(){wireDialog(this);lockPage();try{return nativeShow.call(this)}catch(e){unlockPage();throw e}};
  const nativeClose=HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close=function(...a){try{return nativeClose.apply(this,a)}finally{setTimeout(unlockPage,0)}};

  // Add the two-step subject picker.
  document.body.insertAdjacentHTML('beforeend',`<dialog id="subjectMethodDialog"><div class="modal"><div class="modal-head"><h3 id="subjectMethodTitle"></h3><button type="button" class="close" id="subjectMethodClose">✕</button></div><div class="add-methods"><button type="button" class="btn soft add-method" id="chooseLpMethod"><span class="emoji"></span><strong id="chooseLpTitle"></strong><small id="chooseLpSub"></small></button><button type="button" class="btn soft add-method" id="chooseManualMethod"><span class="emoji"></span><strong id="chooseManualTitle"></strong><small id="chooseManualSub"></small></button></div></div></dialog>
  <dialog id="lpSubjectPickerDialog"><div class="modal"><div class="modal-head"><h3 id="lpPickerTitle"></h3><button type="button" class="close" id="lpPickerClose">✕</button></div><div class="lp-picker-list" id="lpPickerList"></div><div class="timer-controls"><button type="button" class="btn primary" id="lpPickerAdd"></button><button type="button" class="btn soft" id="lpPickerCancel"></button></div></div></dialog>`);
  wireDialog($('#subjectMethodDialog'));wireDialog($('#lpSubjectPickerDialog'));

  function updateV3Labels(){
    const t=L();
    $('#subjectMethodTitle').textContent=t.choose;$('#chooseLpTitle').textContent=t.lp;$('#chooseLpSub').textContent=t.lpSub;$('#chooseManualTitle').textContent=t.manual;$('#chooseManualSub').textContent=t.manualSub;
    $('#lpPickerTitle').textContent=t.select;$('#lpPickerAdd').textContent=t.addSelected;$('#lpPickerCancel').textContent=t.cancel;
  }
  function availableLpModules(){
    return (state.studyProgress?.modules||[]).filter(m=>{
      const linked=m.subjectId&&state.subjects.some(s=>s.id===m.subjectId);
      const same=state.subjects.some(s=>s.name.trim().toLowerCase()===String(m.name).trim().toLowerCase());
      return !linked&&!same;
    });
  }
  function renderLpPicker(){
    const mods=availableLpModules(),t=L();
    $('#lpPickerList').innerHTML=mods.length?mods.map(m=>`<label class="lp-picker-item"><input type="checkbox" value="${esc(m.id)}"><span><strong>${esc(m.name)}</strong><small>${t.semester} ${esc(m.originSemester||'—')} · ${esc(m.planSemester||'—')}. ${t.semester}</small></span><b>${Number(m.lp||0)} LP</b></label>`).join(''):`<div class="empty">${t.none}</div>`;
    $('#lpPickerAdd').disabled=!mods.length;
  }
  function openMethodPicker(){updateV3Labels();$('#subjectMethodDialog').showModal()}
  $('#subjectMethodClose').onclick=()=>$('#subjectMethodDialog').close();
  $('#chooseManualMethod').onclick=()=>{$('#subjectMethodDialog').close();setTimeout(()=>openDialog('subjectDialog'),30)};
  $('#chooseLpMethod').onclick=()=>{$('#subjectMethodDialog').close();renderLpPicker();setTimeout(()=>$('#lpSubjectPickerDialog').showModal(),30)};
  $('#lpPickerClose').onclick=$('#lpPickerCancel').onclick=()=>$('#lpSubjectPickerDialog').close();
  $('#lpPickerAdd').onclick=()=>{
    const ids=[...$('#lpPickerList').querySelectorAll('input:checked')].map(x=>x.value);if(!ids.length)return;
    for(const id of ids){const m=state.studyProgress.modules.find(x=>x.id===id);if(!m)continue;const sid=uid();state.subjects.push({id:sid,name:m.name,credits:Number(m.lp||0),color:'#6d5dfc',start:state.semester.start||'',end:state.semester.end||''});m.subjectId=sid;m.useInStudy=true}
    save();$('#lpSubjectPickerDialog').close();toast(L().added);
  };
  // Intercept only "new subject" buttons; editing continues to use the original form.
  
$('#dashboardMode').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;state.dashboardMode=b.dataset.mode;persistLocal(true);renderHome()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-open="subjectDialog"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();$('#subjectId').value='';openMethodPicker()},true);
})();


/* ===== WesStudy v4.3: Semesterplanung ===== */
(function v37SemesterPlanning(){
  state.semesterPlan=state.semesterPlan||{days:{}};
  let semesterDraft={days:{}};
  let semesterCalDate=parseDate(state.semester.start)||new Date();

  const holidayPage=document.querySelector('[data-page="holiday"]');
  if(holidayPage&&!document.getElementById('semesterPlanCard')){
    holidayPage.insertAdjacentHTML('beforeend',`
      <div class="card" id="semesterPlanCard" style="margin-top:16px">
        <div class="section-head"><div><h2>Semesterplanung</h2><div class="muted">Plane einzelne Lerntage oder wiederkehrende Wochentage innerhalb der Vorlesungszeit.</div></div><button class="btn primary" id="openSemesterPlan">Semester planen</button></div>
        <div class="metrics" id="semesterPlanMetrics"></div>
        <div class="progress" style="margin-top:12px"><i id="semesterPlanProgress"></i></div>
        <div class="muted" style="margin-top:10px">Die Vorschau geht davon aus, dass du deinen Ferienplan vollständig schaffst. Deine tatsächlich gelernten Stunden bleiben davon getrennt.</div>
        <div class="holiday-day-list" id="semesterPlanUpcoming" style="margin-top:12px"></div>
      </div>`);
  }

  if(!document.getElementById('semesterPlanDialog')){
    document.body.insertAdjacentHTML('beforeend',`
      <dialog id="semesterPlanDialog"><form method="dialog" class="modal" id="semesterPlanForm">
        <div class="modal-head"><h3>Semesterplanung</h3><button class="close" value="cancel">✕</button></div>
        <div class="form-grid">
          <div class="field"><label>Standardstunden pro Tag</label><input id="defaultSemesterHours" type="number" min="0.25" max="24" step="0.25" value="4"></div>
          <div class="field"><label>Wochentag automatisch planen</label><select id="semesterWeekday"><option value="1">Montag</option><option value="2">Dienstag</option><option value="3">Mittwoch</option><option value="4">Donnerstag</option><option value="5">Freitag</option><option value="6">Samstag</option><option value="0">Sonntag</option></select></div>
        </div>
        <div class="timer-controls" style="margin-top:12px"><button type="button" class="btn soft" id="syncSemesterFromWeek">Mit Wochenplan synchronisieren</button><button type="button" class="btn soft" id="applySemesterWeekday">Auf alle anwenden</button><button type="button" class="btn soft" id="clearSemesterPlan">Plan leeren</button></div>
        <p class="muted" style="margin-top:10px">Beispiel: 4 Std. + Sonntag → trägt 4 Std. an jedem Sonntag zwischen Semesterbeginn und Semesterende ein. Du kannst danach einzelne Tage ändern oder löschen.</p>
        <div style="margin-top:16px"><div class="calendar-nav"><button type="button" class="mini-btn" id="semCalPrev">‹</button><h3 id="semCalTitle"></h3><button type="button" class="mini-btn" id="semCalNext">›</button></div><div class="calendar" id="semesterCalendar"></div><div class="holiday-day-list" id="selectedSemesterDays"></div></div>
        <div id="semesterPlanError" class="planner-alert hidden" style="margin-top:14px;border-left:4px solid currentColor"></div>
        <div class="timer-controls"><button class="btn primary" value="default">Semesterplan speichern</button><button class="btn soft" value="cancel">Abbrechen</button></div>
      </form></dialog>`);
  }

  function setSemesterPlanError(msg=''){
    const el=document.getElementById('semesterPlanError');if(!el)return;
    el.textContent=msg;
    el.classList.toggle('hidden',!msg);
    if(msg)el.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function semesterTargetMins(){return semesterStudyTargetMins()}
  function semesterPlannedMins(days=state.semesterPlan?.days||{}){return Object.values(days).reduce((a,h)=>a+Number(h||0)*60,0)}
  function semesterAllDates(){
    const s=state.semester;if(!s.start||!s.end||s.end<s.start)return [];
    const out=[];let d=parseDate(s.start),end=parseDate(s.end);
    while(d<=end){out.push(localISO(d));d=new Date(d.getTime()+86400000)}return out;
  }
  function semesterFreeDates(days=state.semesterPlan?.days||{}){return semesterAllDates().filter(d=>days[d]==null)}
  function semesterPlanStats(days=state.semesterPlan?.days||{}){
    const target=semesterTargetMins(),planned=semesterPlannedMins(days),unplanned=Math.max(0,target-planned),free=semesterFreeDates(days).length;
    return {target,planned,unplanned,free,avg:free?unplanned/free:0,over:Math.max(0,planned-target)};
  }
  function renderSemesterPlanCard(){
    const el=document.getElementById('semesterPlanMetrics');if(!el)return;
    const st=semesterPlanStats(),entries=Object.entries(state.semesterPlan?.days||{}).sort(([a],[b])=>a.localeCompare(b));
    el.innerHTML=`<span class="pill">Basisbedarf ${hoursText(totalRequired())}</span><span class="pill">Nachholen offen ${hoursText(makeupOpenMins())}</span><span class="pill">Gesamtbedarf inkl. Nachholen ${hoursText(totalRequiredWithMakeup())}</span><span class="pill">Lernziel ${studyTargetPercent().toFixed(0)}% + Nachholen = ${hoursText(studyTargetMins())}</span><span class="pill">Im Semester einzuplanen ${hoursText(st.target)}</span><span class="pill">Verplant ${hoursText(st.planned)}</span><span class="pill">Noch nicht verplant ${hoursText(st.unplanned)}</span><span class="pill">Freie Tage ${st.free}</span><span class="pill">Gleichmäßig verteilt ${minsText(st.avg)}/Tag</span>${st.over?`<span class="pill">Überplant ${hoursText(st.over)}</span>`:''}`;
    const pct=st.target?clamp(st.planned/st.target*100,0,100):0;document.getElementById('semesterPlanProgress').style.width=pct+'%';
    const today=todayISO(),future=entries.filter(([d])=>d>=today).slice(0,8);
    document.getElementById('semesterPlanUpcoming').innerHTML=future.length?future.map(([d,h])=>`<div class="holiday-day-row"><span></span><strong>${fmtDate(d)}</strong><span class="muted" style="margin-inline-start:auto">${Number(h)} Std. geplant</span></div>`).join(''):`<div class="muted" style="text-align:center;padding:10px">Noch keine Semestertage geplant.</div>`;
    const hm=document.getElementById('semesterPlanHomeMetrics');
    if(hm) hm.innerHTML=`<span class="pill">Basisbedarf ${hoursText(totalRequired())}</span><span class="pill">Nachholen offen ${hoursText(makeupOpenMins())}</span><span class="pill">Gesamtbedarf inkl. Nachholen ${hoursText(totalRequiredWithMakeup())}</span><span class="pill">Lernziel ${studyTargetPercent().toFixed(0)}% + Nachholen = ${hoursText(studyTargetMins())}</span><span class="pill">Im Semester einzuplanen ${hoursText(st.target)}</span><span class="pill">Verplant ${hoursText(st.planned)}</span><span class="pill">Noch offen ${hoursText(st.unplanned)}</span><span class="pill">Rest Ø ${minsText(st.avg)}/Tag</span>`;
  }
  function prepareSemesterPlanDialog(){
    setSemesterPlanError('');
    semesterDraft={days:{...(state.semesterPlan?.days||{})}};semesterCalDate=parseDate(state.semester.start)||new Date();renderSemesterCalendar();renderSelectedSemesterDays();
  }
  function renderSemesterCalendar(){
    const y=semesterCalDate.getFullYear(),m=semesterCalDate.getMonth();document.getElementById('semCalTitle').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(semesterCalDate);
    const first=new Date(y,m,1),offset=(first.getDay()+6)%7;let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="cal-head">${x}</div>`).join('');
    for(let i=0;i<42;i++){
      const d=new Date(y,m,1-offset+i),iso=localISO(d),out=d.getMonth()!==m,inSemester=overlapDate(iso,state.semester.start,state.semester.end),sel=semesterDraft.days[iso]!=null;
      html+=`<button type="button" class="day ${out?'out':''} ${sel?'selected':''}" data-sem-cal-date="${iso}" ${inSemester?'':'disabled'} style="${inSemester?'':'opacity:.22'}"><div class="num">${d.getDate()}</div>${sel?`<div class="hours">${semesterDraft.days[iso]} Std.</div>`:''}</button>`;
    }document.getElementById('semesterCalendar').innerHTML=html;
  }
  function renderSelectedSemesterDays(){
    const entries=Object.entries(semesterDraft.days).filter(([d])=>overlapDate(d,state.semester.start,state.semester.end)).sort(([a],[b])=>a.localeCompare(b));
    const st=semesterPlanStats(semesterDraft.days);
    document.getElementById('selectedSemesterDays').innerHTML=`<div class="metrics" style="margin:10px 0"><span class="pill">Ziel im Semester ${hoursText(st.target)}</span><span class="pill">Verplant ${hoursText(st.planned)}</span><span class="pill">Offen ${hoursText(st.unplanned)}</span><span class="pill">Rest Ø ${minsText(st.avg)}/Tag</span>${st.over?`<span class="pill">Überplant ${hoursText(st.over)}</span>`:''}</div>`+(entries.length?entries.map(([d,h])=>`<div class="holiday-day-row"><span>${fmtDate(d)}</span><input type="number" min="0.25" max="24" step="0.25" value="${h}" data-semester-hours="${d}"><button type="button" class="mini-btn" data-remove-semester-day="${d}">✕</button></div>`).join(''):`<div class="muted" style="text-align:center;padding:10px">Tippe im Kalender auf Lerntage oder nutze die Wochentagsregel.</div>`);
  }
  function applyWeekday(){
    if(!state.semester.start||!state.semester.end)return toast('Lege zuerst Semesterbeginn und Semesterende fest.');
    const weekday=Number(document.getElementById('semesterWeekday').value),hours=Number(document.getElementById('defaultSemesterHours').value||0);if(hours<=0)return;
    let limited=0;
    semesterAllDates().forEach(iso=>{
      if(parseDate(iso).getDay()!==weekday)return;
      const requested=Math.round(hours*60/15)*15,cap=plannerDayStudyCapacity(iso);
      const use=Math.min(requested,cap);
      if(use<requested)limited++;
      if(use>0)semesterDraft.days[iso]=use/60;
    });
    renderSemesterCalendar();renderSelectedSemesterDays();
    if(limited){setSemesterPlanError(`Hinweis: ${limited} Tage hatten nicht genug freie Zeit. Sie wurden automatisch auf ihre sinnvoll verfügbare Lernkapazität begrenzt.`);toast(`${limited} Tage wurden begrenzt – Details im Semesterplan.`)}else{setSemesterPlanError('');}
  }
  document.getElementById('openSemesterPlan').onclick=()=>{if(!state.semester.start||!state.semester.end)return toast('Lege zuerst den Semesterzeitraum fest.');prepareSemesterPlanDialog();document.getElementById('semesterPlanDialog').showModal()};
  document.getElementById('openSemesterPlanHome').onclick=document.getElementById('openSemesterPlan').onclick;
  document.getElementById('semCalPrev').onclick=()=>{semesterCalDate=new Date(semesterCalDate.getFullYear(),semesterCalDate.getMonth()-1,1);renderSemesterCalendar()};
  document.getElementById('semCalNext').onclick=()=>{semesterCalDate=new Date(semesterCalDate.getFullYear(),semesterCalDate.getMonth()+1,1);renderSemesterCalendar()};
  document.getElementById('syncSemesterFromWeek').onclick=()=>{syncSemesterPlanFromWeeklyPattern(true);semesterDraft={days:{...(state.semesterPlan?.days||{})}};renderSemesterCalendar();renderSelectedSemesterDays();save();toast('Semesterplanung wurde intelligent aus dem Gesamtbedarf und den verfügbaren Zeitfenstern verteilt')};
  document.getElementById('applySemesterWeekday').onclick=applyWeekday;
  document.getElementById('clearSemesterPlan').onclick=()=>{if(confirm('Alle geplanten Semestertage löschen?')){semesterDraft.days={};renderSemesterCalendar();renderSelectedSemesterDays()}};
  document.getElementById('semesterCalendar').addEventListener('click',e=>{const b=e.target.closest('[data-sem-cal-date]');if(!b||b.disabled)return;const d=b.dataset.semCalDate;if(semesterDraft.days[d]!=null)delete semesterDraft.days[d];else{const req=Number(document.getElementById('defaultSemesterHours').value||4)*60,cap=plannerDayStudyCapacity(d);if(req>cap){setSemesterPlanError(`Hinweis: ${fmtDate(d)}: Gewünscht ${minsText(req)}, aber nur ${minsText(cap)} passen sinnvoll in den Tagesplan. Der Tag wurde auf ${minsText(cap)} begrenzt.`);toast('Semesterplanung: Stunden mussten begrenzt werden.')}semesterDraft.days[d]=Math.min(req,cap)/60}renderSemesterCalendar();renderSelectedSemesterDays()});
  document.getElementById('selectedSemesterDays').addEventListener('change',e=>{if(!e.target.matches('[data-semester-hours]'))return;const d=e.target.dataset.semesterHours,req=Math.round(Number(e.target.value||0)*60/15)*15,cap=plannerDayStudyCapacity(d);if(req>cap){setSemesterPlanError(`Fehler: ${fmtDate(d)} kann nicht auf ${minsText(req)} gesetzt werden. Im Tagesplan sind nur ${minsText(cap)} sinnvoll verfügbar. ${minsText(req-cap)} passen nicht hinein. Bitte reduziere die Lernzeit oder verteile den Rest auf einen anderen Tag.`);toast('Änderung nicht übernommen – Grund steht unten im Semesterplan.');e.target.value=Number(semesterDraft.days[d]||0);return}else{setSemesterPlanError('');}if(req>0)semesterDraft.days[d]=req/60;else delete semesterDraft.days[d];renderSemesterCalendar();renderSelectedSemesterDays()});
  document.getElementById('selectedSemesterDays').addEventListener('click',e=>{const b=e.target.closest('[data-remove-semester-day]');if(!b)return;delete semesterDraft.days[b.dataset.removeSemesterDay];renderSemesterCalendar();renderSelectedSemesterDays()});
  document.getElementById('semesterPlanForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const entries=Object.entries(semesterDraft.days).filter(([d])=>overlapDate(d,state.semester.start,state.semester.end));const bad=entries.find(([d,h])=>Number(h||0)*60>plannerDayStudyCapacity(d)+1);if(bad){const req=Number(bad[1]||0)*60,cap=plannerDayStudyCapacity(bad[0]);setSemesterPlanError(`Fehler: Plan konnte nicht gespeichert werden. ${fmtDate(bad[0])}: Gewünscht ${minsText(req)}, verfügbar ${minsText(cap)}. ${minsText(Math.max(0,req-cap))} können an diesem Tag nicht sinnvoll eingeplant werden. Bitte reduziere die Stunden oder wähle einen anderen Tag.`);return toast('Plan nicht gespeichert – bitte Hinweis im Semesterplan prüfen.')}setSemesterPlanError('');state.semesterPlan={days:Object.fromEntries(entries)};const wp=plannerState();wp.smartPlanRevision='manual';Object.keys(wp.dayOverrides||{}).forEach(d=>{if(state.semesterPlan.days[d]!=null&&wp.dayOverrides[d])wp.dayOverrides[d].learningBlocks=null});save();document.getElementById('semesterPlanDialog').close();toast('Semesterplanung gespeichert – Tag wurde automatisch synchronisiert')});

  const prevRenderAll=renderAll;renderAll=function(){prevRenderAll();renderSemesterPlanCard()};
  renderSemesterPlanCard();
})();


function applyStudyTarget(value){
  const pct=clamp(Math.round(Number(value)||100),1,100);
  state.semester.studyTargetPercent=pct;
  if(state.weeklyPlanner){
    state.weeklyPlanner.semesterPlanTotalMins=semesterStudyTargetMins();
    state.weeklyPlanner.smartPlanRevision='manual';
  }
  persistLocal(true);
  renderAll();
  toast(`Lernumfang auf ${pct}% gesetzt – Nachholen wird zusätzlich vollständig eingeplant.`);
}
const studyTargetApplyBtn=document.getElementById('applyStudyTargetPercent');
if(studyTargetApplyBtn)studyTargetApplyBtn.addEventListener('click',()=>applyStudyTarget(document.getElementById('studyTargetPercentInput')?.value));
const studyTargetInput=document.getElementById('studyTargetPercentInput');
if(studyTargetInput)studyTargetInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyStudyTarget(studyTargetInput.value)}});
document.querySelectorAll('[data-study-target-preset]').forEach(btn=>btn.addEventListener('click',()=>applyStudyTarget(btn.dataset.studyTargetPreset)));

window.WesStudyCloudBridge={
  getState:()=>structuredClone(state),
  hasMeaningfulLocalData:()=>Boolean(state.subjects?.length||state.sessions?.length||state.holiday||state.dailyPlan?.items?.length||state.nachholen?.entries?.length||state.studyProgress?.modules?.length||state.semester?.start||state.semesterPlan?.days&&Object.keys(state.semesterPlan.days).length||state.weeklyPlanner?.rules?.length),
  applyCloudState:(incoming)=>{state={...structuredClone(defaultState),...(incoming||{}),semester:{...defaultState.semester,...((incoming||{}).semester||{})},dailyPlan:{...defaultState.dailyPlan,...((incoming||{}).dailyPlan||{}),items:Array.isArray((incoming||{}).dailyPlan?.items)?(incoming||{}).dailyPlan.items:[],templates:Array.isArray((incoming||{}).dailyPlan?.templates)?(incoming||{}).dailyPlan.templates:[]},nachholen:{...defaultState.nachholen,...((incoming||{}).nachholen||{}),entries:Array.isArray((incoming||{}).nachholen?.entries)?(incoming||{}).nachholen.entries:[]},timerSettings:{...defaultState.timerSettings,...((incoming||{}).timerSettings||{})},meta:{...defaultState.meta,...((incoming||{}).meta||{})}};localStorage.setItem(KEY,JSON.stringify(state));renderAll();},
  forceLocalSave:()=>{persistLocal(false);renderAll();},
  toast
};
generateAutoSemesterAttendance(false);
renderAll();
})();
