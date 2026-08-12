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
  if(user){
    el('cloudUserLabel').textContent=user.email||user.displayName||'Angemeldet';
    el('cloudSyncLabel').textContent=lastSyncedAt?`Sync ${new Date(lastSyncedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`:'Bereit';
  }
}
function cloneState(s){
  try{return structuredClone(s||{})}catch{return JSON.parse(JSON.stringify(s||{}))}
}
function cleanStateForCloud(s){const c=cloneState(s);c.meta={...(c.meta||{}),updatedAt:Number(c.meta?.updatedAt||Date.now())};return c}
function userDocRef(){return mods.doc(db,'users',user.uid,'data','wesstudy')}

async function uploadState(state=bridge()?.getState()){
  if(!user||!db||syncing||!state)return;
  syncing=true;setStatus('Synchronisiere…','warn','Sync');
  try{
    const payload=cleanStateForCloud(state);
    await mods.setDoc(userDocRef(),{state:payload,updatedAt:mods.serverTimestamp(),clientUpdatedAt:Number(payload.meta?.updatedAt||Date.now())},{merge:false});
    lastSyncedAt=Date.now();setStatus('Cloud-Sync aktiv','good','Cloud');signedUI();
  }catch(e){console.error(e);setStatus('Sync fehlgeschlagen','bad','Fehler');bridge()?.toast?.(firebaseError(e));}
  finally{syncing=false;}
}
async function downloadState({ask=true}={}){
  if(!user||!db)return false;
  try{
    const snap=await mods.getDoc(userDocRef());
    if(!snap.exists())return false;
    const cloud=snap.data()?.state;if(!cloud)return false;
    if(ask&&!confirm('Cloud-Daten auf dieses Gerät laden? Lokale Änderungen seit dem letzten Sync werden ersetzt.'))return false;
    bridge()?.applyCloudState(cloud);lastSyncedAt=Date.now();setStatus('Cloud-Daten geladen','good','Cloud');signedUI();return true;
  }catch(e){console.error(e);setStatus('Cloud konnte nicht geladen werden','bad','Fehler');return false;}
}
async function reconcileAfterLogin(){
  const snap=await mods.getDoc(userDocRef());
  if(!snap.exists()){
    // First login: preserve and upload the user's existing local WesStudy data.
    await uploadState();
    bridge()?.toast?.('Lokale WesStudy-Daten wurden in deinem Google-Konto gespeichert.');
    return;
  }
  const cloud=snap.data()?.state||{};
  const local=bridge()?.getState()||{};
  const l=Number(local.meta?.updatedAt||0),c=Number(cloud.meta?.updatedAt||snap.data()?.clientUpdatedAt||0);
  if(bridge()?.hasMeaningfulLocalData()&&l>c+2000){
    if(confirm('Auf diesem Gerät gibt es neuere lokale Daten. Diese jetzt in die Cloud hochladen?'))await uploadState(local);
    else bridge()?.applyCloudState(cloud);
  }else bridge()?.applyCloudState(cloud);
  lastSyncedAt=Date.now();setStatus('Cloud-Sync aktiv','good','Cloud');signedUI();
}

async function googleLogin(){
  try{
    const provider=new mods.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
    if(isiOS||standalone){
      await mods.signInWithRedirect(auth,provider);
    }else{
      try{await mods.signInWithPopup(auth,provider)}
      catch(e){if(['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(e?.code))await mods.signInWithRedirect(auth,provider);else throw e;}
    }
  }catch(e){console.error(e);bridge()?.toast?.(firebaseError(e));}
}

async function init(){
  if(!validConfig()){
    setStatus('Firebase noch nicht eingerichtet','warn','Setup');
    if(el('cloudSetupHint'))el('cloudSetupHint').textContent='Firebase-Konfiguration fehlt.';
    if(el('cloudGoogleBtn'))el('cloudGoogleBtn').disabled=true;
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
    try{await authM.getRedirectResult(auth)}catch(e){console.warn('Redirect result',e);}
    window.WesStudyCloud={queueSave:(s)=>{if(!user)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>uploadState(s),900);}};
    authM.onAuthStateChanged(auth,async u=>{
      user=u||null;signedUI();
      if(user){setStatus('Angemeldet – Daten werden abgeglichen','warn','Sync');await reconcileAfterLogin();}
      else setStatus('Nicht angemeldet – lokale Speicherung','warn','Lokal');
    });
    if(el('cloudSetupHint'))el('cloudSetupHint').textContent='Mit Google anmelden. Danach werden Änderungen automatisch lokal und in Firestore gespeichert.';
  }catch(e){
    console.error(e);setStatus('Firebase konnte nicht gestartet werden','bad','Fehler');
    if(el('cloudSetupHint'))el('cloudSetupHint').textContent='Prüfe Internetverbindung, Firebase Authentication, Firestore und die autorisierte Domain.';
  }
}

el('cloudGoogleBtn')?.addEventListener('click',googleLogin);
el('cloudLogoutBtn')?.addEventListener('click',async()=>{if(auth)await mods.signOut(auth)});
el('cloudUploadBtn')?.addEventListener('click',async()=>{if(confirm('Lokale Daten jetzt als Cloud-Stand speichern?'))await uploadState()});
el('cloudDownloadBtn')?.addEventListener('click',async()=>{await downloadState({ask:true})});

function firebaseError(e){
  const c=e?.code||'';
  if(c.includes('popup-blocked'))return 'Das Google-Anmeldefenster wurde blockiert. Bitte erneut versuchen.';
  if(c.includes('unauthorized-domain'))return 'wesam49.github.io ist in Firebase Authentication nicht freigegeben.';
  if(c.includes('permission-denied'))return 'Firestore-Zugriff wurde durch die Sicherheitsregeln abgelehnt.';
  if(c.includes('network-request-failed'))return 'Netzwerkfehler. Bitte Internetverbindung prüfen.';
  return e?.message||'Anmeldung fehlgeschlagen.';
}

init();
