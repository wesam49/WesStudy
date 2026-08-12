const cfg=window.WESSTUDY_FIREBASE_CONFIG||{};
const bridge=()=>window.WesStudyCloudBridge;
const el=id=>document.getElementById(id);
const validConfig=()=>cfg.apiKey&&!String(cfg.apiKey).includes('PASTE_')&&cfg.projectId&&!String(cfg.projectId).includes('PASTE_')&&cfg.appId&&!String(cfg.appId).includes('PASTE_');
let auth=null,db=null,user=null,mods=null,saveTimer=null,syncing=false,lastSyncedAt=0;

function setStatus(text,kind='warn',badge='Lokal'){
  if(el('cloudStatus'))el('cloudStatus').textContent=text;
  if(el('cloudBadge')){el('cloudBadge').textContent=badge;el('cloudBadge').className=`status ${kind}`;}
}
function signedUI(){
  if(!el('cloudSignedIn'))return;
  el('cloudSignedIn').classList.toggle('hidden',!user);
  el('cloudSignedOut').classList.toggle('hidden',!!user);
  if(user){el('cloudUserLabel').textContent=user.email||'Angemeldet';el('cloudSyncLabel').textContent=lastSyncedAt?`Sync ${new Date(lastSyncedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`:'Bereit';}
}
function cleanStateForCloud(s){const c=structuredClone(s||{});c.meta={...(c.meta||{}),updatedAt:Number(c.meta?.updatedAt||Date.now())};return c}
async function ref(){return mods.doc(db,'users',user.uid,'data','wesstudy')}
async function uploadState(state=bridge()?.getState()){
  if(!user||!db||syncing||!state)return;
  syncing=true;setStatus('Synchronisiere…','warn','Sync');
  try{const payload=cleanStateForCloud(state);await mods.setDoc(await ref(),{state:payload,updatedAt:mods.serverTimestamp(),clientUpdatedAt:Number(payload.meta?.updatedAt||Date.now())},{merge:false});lastSyncedAt=Date.now();setStatus('Cloud-Sync aktiv','good','Cloud');signedUI();}
  catch(e){console.error(e);setStatus('Sync fehlgeschlagen','bad','Fehler');}
  finally{syncing=false;}
}
async function downloadState({ask=true}={}){
  if(!user||!db)return false;
  try{const snap=await mods.getDoc(await ref());if(!snap.exists())return false;const cloud=snap.data()?.state;if(!cloud)return false;if(ask&&!confirm('Cloud-Daten auf dieses Gerät laden? Lokale Änderungen seit dem letzten Sync werden ersetzt.'))return false;bridge()?.applyCloudState(cloud);lastSyncedAt=Date.now();setStatus('Cloud-Daten geladen','good','Cloud');signedUI();return true;}
  catch(e){console.error(e);setStatus('Cloud konnte nicht geladen werden','bad','Fehler');return false;}
}
async function reconcileAfterLogin(){
  const snap=await mods.getDoc(await ref());
  if(!snap.exists()){await uploadState();return;}
  const cloud=snap.data()?.state||{};
  const local=bridge()?.getState()||{};
  const l=Number(local.meta?.updatedAt||0),c=Number(cloud.meta?.updatedAt||snap.data()?.clientUpdatedAt||0);
  if(bridge()?.hasMeaningfulLocalData()&&l>c+2000){
    if(confirm('Auf diesem Gerät gibt es neuere lokale Daten. Diese jetzt in die Cloud hochladen?'))await uploadState(local);else bridge()?.applyCloudState(cloud);
  }else bridge()?.applyCloudState(cloud);
  lastSyncedAt=Date.now();setStatus('Cloud-Sync aktiv','good','Cloud');signedUI();
}
async function init(){
  if(!validConfig()){
    setStatus('Firebase noch nicht eingerichtet','warn','Setup');
    if(el('cloudSetupHint'))el('cloudSetupHint').textContent='Öffne firebase-config.js und füge einmal die Web-Konfiguration deines Firebase-Projekts ein.';
    ['cloudLoginBtn','cloudRegisterBtn','cloudGoogleBtn'].forEach(id=>{if(el(id))el(id).disabled=true});
    window.WesStudyCloud={queueSave:()=>{}};
    return;
  }
  try{
    const [appM,authM,fsM]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
    ]);
    mods={...authM,...fsM};
    const app=appM.initializeApp(cfg);auth=authM.getAuth(app);db=fsM.getFirestore(app);
    window.WesStudyCloud={queueSave:(s)=>{if(!user)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>uploadState(s),850);}};
    authM.onAuthStateChanged(auth,async u=>{user=u||null;signedUI();if(user){setStatus('Angemeldet – Daten werden abgeglichen','warn','Sync');await reconcileAfterLogin();}else setStatus('Nicht angemeldet – lokale Speicherung','warn','Lokal');});
    if(el('cloudSetupHint'))el('cloudSetupHint').textContent='Angemeldet: Änderungen werden automatisch lokal und in Firestore gespeichert.';
  }catch(e){console.error(e);setStatus('Firebase konnte nicht gestartet werden','bad','Fehler');if(el('cloudSetupHint'))el('cloudSetupHint').textContent='Prüfe firebase-config.js, Authentication, Firestore und die autorisierten Domains.';}
}

el('cloudLoginBtn')?.addEventListener('click',async()=>{try{await mods.signInWithEmailAndPassword(auth,el('cloudEmail').value.trim(),el('cloudPassword').value)}catch(e){bridge()?.toast(firebaseError(e))}});
el('cloudRegisterBtn')?.addEventListener('click',async()=>{try{await mods.createUserWithEmailAndPassword(auth,el('cloudEmail').value.trim(),el('cloudPassword').value)}catch(e){bridge()?.toast(firebaseError(e))}});
el('cloudGoogleBtn')?.addEventListener('click',async()=>{try{const provider=new mods.GoogleAuthProvider();await mods.signInWithPopup(auth,provider)}catch(e){bridge()?.toast(firebaseError(e))}});
el('cloudLogoutBtn')?.addEventListener('click',async()=>{if(auth)await mods.signOut(auth)});
el('cloudUploadBtn')?.addEventListener('click',async()=>{if(confirm('Lokale Daten jetzt als Cloud-Stand speichern?'))await uploadState()});
el('cloudDownloadBtn')?.addEventListener('click',async()=>{await downloadState({ask:true})});
function firebaseError(e){const c=e?.code||'';if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found'))return 'E-Mail oder Passwort ist falsch.';if(c.includes('email-already-in-use'))return 'Für diese E-Mail existiert bereits ein Konto.';if(c.includes('weak-password'))return 'Das Passwort muss mindestens 6 Zeichen haben.';if(c.includes('popup-blocked'))return 'Das Anmeldefenster wurde blockiert.';if(c.includes('unauthorized-domain'))return 'Diese Domain ist in Firebase Authentication noch nicht freigegeben.';return e?.message||'Anmeldung fehlgeschlagen.'}

init();
