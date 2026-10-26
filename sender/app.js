'use strict';
const $=id=>document.getElementById(id);
const ui={browser:$('browserStatus'),permission:$('permissionStatus'),count:$('countStatus'),notice:$('notice'),camera:$('cameraBtn'),latest:$('latestResult'),copy:$('copyBtn'),body:$('historyBody'),clear:$('clearBtn'),csv:$('csvBtn'),encPassword:$('encPassword'),encPassword2:$('encPassword2'),encryptShare:$('encryptShareBtn'),encryptSave:$('encryptSaveBtn'),continuousRegistration:$('continuousRegistration'),allowDuplicates:$('allowDuplicates'),autoClear:$('autoClear'),accept:$('acceptBtn'),pendingStatus:$('pendingStatus'),userProfile:$('userProfile'),releaseFreeze:$('releaseFreezeBtn'),pauseSeconds:$('pauseSeconds')};
let scanner=null,scanning=false,historyItems=[],lastAcceptedAt=0,pending=null,pendingTimer=null,lastDetected='',lastDetectedAt=0;
// Work-session records are persistent until explicitly finalized/cleared.
const INV_KEY='qrWorkSessionV2',invMode=$('inventoryMode'),invLocation=$('inventoryLocation'),invStatus=$('inventoryStatus');
let currentShelf=null,work=null,invSeen={keys:[]};
function workSave(){try{localStorage.setItem(INV_KEY,JSON.stringify(work));return true;}catch(e){message('作業データの保存に失敗しました。空き容量を確認してください。');return false;}}
function workLoad(){try{const x=JSON.parse(localStorage.getItem(INV_KEY)||'null');return x&&Array.isArray(x.rows)&&typeof x.id==='string'?x:null;}catch{return null;}}
function workMode(){return invMode.value;}
function workStart(){
 const mode=workMode();if(mode==='normal')return;
 const prefix=mode==='inventory'?'Z':'C',d=new Date(),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');
 let device=localStorage.getItem('qrWorkDeviceV2');if(!device){device='T'+Math.random().toString(36).slice(2,8).toUpperCase();localStorage.setItem('qrWorkDeviceV2',device);}
 const counterKey='qrWorkCounterV2-'+day+'-'+prefix;const num=(Number(localStorage.getItem(counterKey))||0)+1;localStorage.setItem(counterKey,String(num));
 work={id:`${prefix}-${day}-${device}-${String(num).padStart(3,'0')}`,mode,rows:[],status:'active',shelf:null};
 workAdd(prefix+'START',new Date());
}
function workAdd(value,time,extra={}){
 if(!work)return false;const row={id:work.rows.length+1,value,time:new Date(time).toISOString(),...extra};work.rows.push(row);
 if(!workSave()){work.rows.pop();return false;}historyItems=work.rows.map(x=>({...x,time:new Date(x.time)}));render();return true;
}
function workRestore(){work=workLoad();if(work){invMode.value=work.mode;historyItems=work.rows.map(x=>({...x,time:new Date(x.time)}));currentShelf=work.shelf?{...work.shelf}:null;invSeen={keys:work.rows.filter(x=>x.inventoryKey).map(x=>x.inventoryKey)};if(work.status==='active'&&work.mode==='inventory')setTimeout(()=>message('棚卸を復元しました。再開前に現在の棚位置を確認してください。'),100);} }
function invParse(text){const v=String(text).trim();
 if(!/^[A-Z]{3}[0-9]{3}[A-Z]{5}$/.test(v))return {error:'QRは11文字（4～6文字目が数字、その他は英大文字）で指定してください。'};
 if(v[0]==='Z'){
  if(v.slice(1,8)!=='AA999AA')return {error:'棚位置QRの2～8文字目はAA999AAです。'};
  return {type:'shelf',room:v[8],rack:v[9],level:v[10]};
 }
 if(v.slice(3,6)==='000'||v.charCodeAt(6)>v.charCodeAt(7))return {error:'設備番号または個口数が不正です。'};
 return {type:'item',key:v.slice(1,7),values:[v[0],v[1],v[2],v.slice(3,6),v[6],v[7],v[8],v[9],v[10]]};
}
function invUpdate(){const m=invMode.value;invLocation.textContent=m==='inventory'?(currentShelf?`${currentShelf.room} / ${currentShelf.rack} / ${currentShelf.level}`:'未設定（棚位置QRを先に読んでください）'):m==='count'?'棚位置は記録しません':'通常のQR読取';invStatus.textContent=work?`作業ID：${work.id} ／ ${work.status==='completed'?'完了':'作業中'} ／ ${work.rows.length}行`:'';}
invMode.value=localStorage.getItem('qrInventoryModeV1')||'inventory';
invMode.onchange=()=>{if(work&&work.status==='active'){alert('作業中はモードを変更できません。作業を完了してください。');invMode.value=work.mode;return;}localStorage.setItem('qrInventoryModeV1',invMode.value);currentShelf=null;invUpdate();};
$('inventoryResetBtn').textContent='新しい作業を開始';
$('inventoryResetBtn').onclick=()=>{
 if(work&&work.status==='active'){if(!confirm('現在の未完了作業を破棄して新規開始しますか？この操作は取り消せません。'))return;}
 else if(work&&!confirm('前回の作業履歴を置き換えて新しい作業を開始しますか？'))return;
 work=null;historyItems=[];currentShelf=null;invSeen={keys:[]};if(invMode.value!=='normal')workStart();else localStorage.removeItem(INV_KEY);render();invUpdate();
};
window.qrInventoryExit=()=>{};
workRestore();
const SETTINGS_KEY='qr-secure-settings-v2';
const PROFILES_KEY='qr-secure-user-profiles-v1';
let profiles=[];
function readProfiles(){try{const v=JSON.parse(localStorage.getItem(PROFILES_KEY)||'[]');profiles=Array.isArray(v)?v.filter(x=>x&&typeof x.name==='string'&&Number.isFinite(x.seconds)).slice(0,10):[];}catch{profiles=[];}renderProfiles();}
function renderProfiles(){ui.userProfile.replaceChildren(new Option('ゲスト','guest'),...profiles.map(x=>new Option(x.name,x.name)));ui.userProfile.value='guest';ui.pauseSeconds.value='10';}
function selectProfile(){const name=ui.userProfile.value;const p=profiles.find(x=>x.name===name);ui.pauseSeconds.value=p?String(p.seconds):'10';}
function pauseDuration(){const n=Number(ui.pauseSeconds.value);return Number.isFinite(n)?Math.max(0.3,Math.min(60,n)):10;}
function storeDuration(){const n=pauseDuration();ui.pauseSeconds.value=String(n);const p=profiles.find(x=>x.name===ui.userProfile.value);if(p){p.seconds=n;localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));}}
ui.userProfile.onchange=()=>{cancelPending();selectProfile();};
ui.pauseSeconds.onchange=storeDuration;
function message(s){const isImportError=(importFeedbackActive && !/^(保存しました|棚位置を記録しました)/.test(s)) || s==='QRコードが読み込めません';ui.notice.textContent=isImportError?'':s;if(isImportError)showImportError(s);}
function browserName(){const u=navigator.userAgent;if(/Edg\//.test(u))return'Edge';if(/CriOS/.test(u))return'Chrome (iOS)';if(/Chrome\//.test(u))return'Chrome';if(/Safari\//.test(u))return'Safari';return'その他';}
function checkSupport(){const ok=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);if(!window.isSecureContext||!ok)ui.camera.disabled=true;}
async function checkPermission(){try{const p=await navigator.permissions.query({name:'camera'});}catch{}}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');ui.allowDuplicates.checked=!!s.allowDuplicates;ui.continuousRegistration.checked=!!s.continuousRegistration;ui.autoClear.checked=s.autoClear!==false;}catch{}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify({continuousRegistration:ui.continuousRegistration.checked,allowDuplicates:ui.allowDuplicates.checked,autoClear:ui.autoClear.checked}));}
function updateCameraButton(){ui.camera.textContent=scanning?'カメラ停止':'カメラ起動';ui.camera.classList.toggle('camera-on',scanning);ui.camera.classList.toggle('camera-off',!scanning);}
async function startCamera(){if(scanning)return;if(typeof Html5Qrcode==='undefined'){message('QRライブラリを読み込めませんでした。');return;}
 try{scanner=scanner||new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:7,qrbox:(w,h)=>{const side=Math.max(80,Math.floor(Math.min(w,h)*0.90));return {width:side,height:side};}},onScan,()=>{});scanning=true;updateCameraButton();ui.accept.disabled=false;ui.releaseFreeze.disabled=false;}
 catch(e){message('カメラを起動できません。権限・HTTPSを確認してください。');}}
async function stopCamera(){cancelPending();if(scanner&&scanning){await scanner.stop().catch(()=>{});scanning=false;}updateCameraButton();ui.accept.disabled=true;ui.releaseFreeze.disabled=true;}
// B mode: decode continuously, register only on an explicit button press.
const DETECTION_TTL_MS=800, RESULT_HOLD_MS=1000, ERROR_HOLD_MS=3000;
let importFeedbackActive=false;
let latestCandidate=null, resultHoldUntil=0, resultHoldTimer=null, lastTapAt=0;
function cancelPending(){
 latestCandidate=null;lastDetected='';lastDetectedAt=0;
 if(resultHoldTimer)clearTimeout(resultHoldTimer);
 resultHoldTimer=null;resultHoldUntil=0;
 ui.latest.value='';ui.latest.classList.remove('qr-result-error');ui.accept.disabled=!scanning;
}
function onScan(text){
 if(!scanning||!text)return;
 const now=Date.now();
 latestCandidate={value:text,time:now};lastDetected=text;lastDetectedAt=now;
 if(now>=resultHoldUntil){ui.latest.classList.remove('qr-result-error');ui.latest.value=text;}
}
function showScanResult(text){
 resultHoldUntil=Date.now()+RESULT_HOLD_MS;
 ui.latest.classList.remove('qr-result-error');
 ui.latest.value=text;
 if(resultHoldTimer)clearTimeout(resultHoldTimer);
 resultHoldTimer=setTimeout(()=>{
  resultHoldTimer=null;
  if(Date.now()>=resultHoldUntil)ui.latest.value=(scanning&&latestCandidate&&Date.now()-latestCandidate.time<=DETECTION_TTL_MS)?latestCandidate.value:'';
 },RESULT_HOLD_MS);
}
function showImportError(text){
 resultHoldUntil=Date.now()+ERROR_HOLD_MS;
 ui.latest.classList.add('qr-result-error');
 ui.latest.value='エラー：'+text;
 if(resultHoldTimer)clearTimeout(resultHoldTimer);
 resultHoldTimer=setTimeout(()=>{
  resultHoldTimer=null;
  ui.latest.classList.remove('qr-result-error');
  if(Date.now()>=resultHoldUntil)ui.latest.value=(scanning&&latestCandidate&&Date.now()-latestCandidate.time<=DETECTION_TTL_MS)?latestCandidate.value:'';
 },ERROR_HOLD_MS);
}
// A QR candidate expires even if the camera decoder does not emit a failure callback.
setInterval(()=>{
 if(!scanning||Date.now()<resultHoldUntil)return;
 if(!latestCandidate||Date.now()-latestCandidate.time>DETECTION_TTL_MS){latestCandidate=null;ui.latest.value='';}
},120);
function commit(item){
 let extra={};
 if(invMode.value!=='normal'){
  if(work?.status==='completed'){message('この作業は完了済みです。新しい作業を開始してください。');return;}
  if(!work)workStart();
  const parsed=invParse(item.value);if(parsed.error){message(parsed.error);invStatus.textContent=parsed.error;return;}
  if(parsed.type==='shelf'){
   if(invMode.value==='count'){message('在高確認では棚位置QRを登録しません。');return;}
   currentShelf=parsed;work.shelf={room:parsed.room,rack:parsed.rack,level:parsed.level};
   if(!workAdd(item.value,item.time))return;
   invUpdate();message('棚位置を記録しました。');return;
  }
  if(invMode.value==='inventory'&&!currentShelf){message('先に棚位置QR（ZAA999AA＋位置3文字）を読み取ってください。');return;}
  if(invSeen.keys.includes(parsed.key)){message('重複読取：管理箇所・勘定・設備番号・個口分子が一致します。');return;}
  extra={inventoryKey:parsed.key,inventoryMode:invMode.value};
  if(!workAdd(item.value,item.time,extra))return;invSeen.keys.push(parsed.key);
 }else{
  if(!ui.allowDuplicates.checked&&historyItems.some(x=>x.value===item.value)){message('登録済みのQRです。');return;}
  const id=historyItems.length?Math.max(...historyItems.map(x=>x.id))+1:1;historyItems.push({id,...item});render();
 }
 lastAcceptedAt=Date.now();invUpdate();message(`保存しました：${historyItems.length}行`);if(navigator.vibrate)navigator.vibrate(80);
}
function releaseFreeze(){
 // Cancel the unregistered candidate, but keep the live camera running.
 latestCandidate=null;lastDetected='';lastDetectedAt=0;
 ui.latest.value='';message('検出表示を取り消しました。');
}
function resolvePending(){
 const now=Date.now();
 if(!scanning){ui.notice.textContent='';showImportError('カメラを起動してください。');return;}
 if(now-lastTapAt<350)return;
 lastTapAt=now;
 const candidate=latestCandidate;
 if(!candidate||now-candidate.time>DETECTION_TTL_MS){message('QRコードが読み込めません');return;}
 const value=candidate.value;
 importFeedbackActive=true;
 try{commit({value,time:new Date(now)});}finally{importFeedbackActive=false;}
 if(!ui.latest.classList.contains('qr-result-error'))showScanResult(value);
}
function formatDate(d){return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d);}
function render(){const has=historyItems.length>0;[ui.clear,ui.csv,ui.encryptShare,ui.encryptSave].forEach(b=>b.disabled=!has);if(!has){ui.body.innerHTML='<tr class="empty"><td colspan="5">まだデータがありません</td></tr>';return;}ui.body.replaceChildren(...historyItems.map((x,i)=>{const tr=document.createElement('tr');[x.id,x.value,formatDate(x.time),x.currentLocation||''].forEach((v,j)=>{const td=document.createElement('td');td.textContent=v;if(j===1)td.className='data';tr.appendChild(td);});const td=document.createElement('td'),b=document.createElement('button');b.textContent='削除';b.className='delete-row';b.onclick=()=>{if(work){message('作業中の行削除はできません。異常行はExcelで確認してください。');return;}historyItems.splice(i,1);render();};td.appendChild(b);tr.appendChild(td);return tr;}));}
function csvCell(v){return '"'+String(v).replace(/"/g,'""')+'"';}
function csvContent(){return '\uFEFF識別番号,QRコードデータ,読取日時,現在位置\r\n'+historyItems.map(x=>[x.id,x.value,formatDate(x.time),x.currentLocation||''].map(csvCell).join(',')).join('\r\n');}
async function downloadCsv(){try{const item=await window.qrWorkflowBackup?.('csv');if(!item)throw new Error('保存する読み取り履歴がありません。');const el=$('csvLocation');if(el)el.textContent='CSVデータをPWA内部に保存しました（保存期限：7日間）。';message('CSVデータをPWA内部に保存しました。端末へのファイルダウンロードは行いません。');}catch(e){message('内部CSV保存に失敗しました：'+(e.message||e));}}
const te=new TextEncoder();function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s);}function receiverUrl(){return new URL('../receiver/',location.href).href;}
async function deriveAesKey(p,salt,it){const base=await crypto.subtle.importKey('raw',te.encode(p),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:it},base,{name:'AES-GCM',length:256},false,['encrypt']);}
async function makeEncryptedFile(){const p=ui.encPassword.value;const minimum=Number($('passwordMinLength').value);if(!Number.isInteger(minimum)||minimum<4||minimum>128)throw new Error('最低文字数は4～128で指定してください。');if(p.length<minimum)throw new Error(`暗号化パスワードは${minimum}文字以上にしてください。`);if($('strongPasswordRule').checked&&(!/[a-z]/.test(p)||!/[A-Z]/.test(p)||!/[0-9]/.test(p)))throw new Error('英小文字・英大文字・数字をそれぞれ含めてください。');if(p!==ui.encPassword2.value)throw new Error('確認用パスワードが一致しません。');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=310000,key=await deriveAesKey(p,salt,iterations),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,te.encode(csvContent()))),env={format:'QRSECURE',version:1,kdf:'PBKDF2-SHA-256',iterations,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(cipher)};return new File([JSON.stringify(env)],`qr-secure-${new Date().toISOString().replace(/[:.]/g,'-')}.qrenc`,{type:'application/octet-stream'});}
function saveBlobFile(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function showDownloadLocation(id,name){
 const el=$(id);
 if(el)el.textContent=`ファイル名：${name} ／ 保存先：通常は端末の「ダウンロード」フォルダー（正確な保存場所はブラウザのダウンロード履歴で確認してください）`;
}
async function encryptAndSave(){try{const f=await makeEncryptedFile();saveBlobFile(f);window.qrWorkflowBackup?.('encrypted',f);showDownloadLocation('encryptedLocation',f.name);message('暗号化ファイルのダウンロードを開始しました。');}catch(e){message(e.message||'暗号化できませんでした。');}}
async function encryptAndShare(){
 const label=$('shareEmailLabel'),address=$('shareEmail'),help=$('shareHelp');
 if(label)label.hidden=false;
 if(!address.value.trim()){help.textContent='送信先メールアドレスを入力後、もう一度「② 暗号化ファイルを共有」を押してください。';address.focus();return;}
 if(!address.checkValidity()){help.textContent='有効なメールアドレスを入力してください。';address.focus();return;}
 const recipient=address.value.trim();
 try{
  const f=await makeEncryptedFile();
  await window.qrWorkflowBackup?.('encrypted',f);
  const shareText=`送信先メールアドレス：${recipient}\\nQR Secure暗号化データです。\\n復号ページ：${receiverUrl()}\\nパスワードは別経路で共有してください。`;
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){
   await navigator.share({title:`暗号化QRデータ（宛先：${recipient}）`,text:shareText,files:[f]});
   window.qrWorkflowClear?.();
   help.textContent=`共有画面へ渡しました。宛先 ${recipient} は本文に記載されています。メールアプリの宛先欄は送信前に確認してください。`;
  }else{
   saveBlobFile(f);showDownloadLocation('encryptedLocation',f.name);
   help.textContent=`ファイルをダウンロードしました。メールアプリで ${recipient} 宛にファイルを添付して送信してください。`;
  }
 }catch(e){if(e?.name!=='AbortError')help.textContent=e.message||'共有できませんでした。';}
}
async function copyLatest(){try{await navigator.clipboard.writeText(ui.latest.value);message('コピーしました。');}catch{}}
ui.camera.onclick=()=>scanning?stopCamera():startCamera();
$('exitAppBtn').onclick=async()=>{
 if(!confirm('アプリのカメラを停止し、終了画面に移りますか？'))return;
 await stopCamera();
 // Closing the app must not delete an unfinished work session.
 document.querySelector('main').innerHTML='<section class="panel" style="text-align:center"><h1>アプリを終了しました</h1><p>カメラを停止しました。このタブを閉じてください。</p><button type="button" onclick="location.reload()">再起動</button></section>';
 window.close();
};ui.csv.onclick=downloadCsv;ui.encryptSave.onclick=encryptAndSave;ui.encryptShare.onclick=encryptAndShare;ui.accept.onclick=resolvePending;ui.releaseFreeze.onclick=releaseFreeze;ui.allowDuplicates.onchange=saveSettings;ui.continuousRegistration.onchange=saveSettings;ui.autoClear.onchange=saveSettings;ui.clear.onclick=()=>{if(work&&work.status==='active'){message('未完了の作業履歴は削除できません。');return;}if(confirm('読み取り履歴をすべて削除しますか？')){historyItems=[];work=null;localStorage.removeItem(INV_KEY);cancelPending();render();message('履歴を削除しました。');}};
const r=$('receiverUrl');if(r)r.textContent=receiverUrl();loadSettings();readProfiles();checkSupport();checkPermission();render();invUpdate();updateCameraButton();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(()=>{}));

// v11: password options and optional camera controls
(function(){
 const len=$('passwordMinLength'),strong=$('strongPasswordRule');
 len.value=localStorage.getItem('qrPasswordMinLength')||'10';
 strong.checked=(localStorage.getItem('qrStrongPasswordRule')??'true')==='true';
 len.addEventListener('change',()=>{const n=Number(len.value);len.value=String(Number.isInteger(n)?Math.max(4,Math.min(128,n)):10);localStorage.setItem('qrPasswordMinLength',len.value);});
 strong.addEventListener('change',()=>localStorage.setItem('qrStrongPasswordRule',String(strong.checked)));
 const zoom=$('zoomRange'),zoomText=$('zoomValue'),torch=$('torchBtn'),auto=$('autoTorch'),status=$('torchStatus');
 let track=null,torchOn=false,manual=null,monitor=null,canvas=document.createElement('canvas');
 canvas.width=32;canvas.height=24;
 function video(){return document.querySelector('#reader video');}
 function currentTrack(){const v=video();return v?.srcObject?.getVideoTracks?.()[0]||null;}
 async function setTorch(on){if(!track)return;try{await track.applyConstraints({advanced:[{torch:on}]});torchOn=on;torch.textContent=on?'ライト OFF':'ライト ON';status.textContent=on?'点灯中':'消灯中';}catch(e){status.textContent='ライト操作不可';}}
 async function sync(){
  const t=currentTrack();
  if(t===track)return;
  track=t;torchOn=false;manual=null;
  const caps=t?.getCapabilities?.()||{};
  const hasZoom=!!(caps.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max));
  zoom.disabled=!hasZoom;
  if(hasZoom){zoom.min=caps.zoom.min;zoom.max=Math.min(3,caps.zoom.max);zoom.step=caps.zoom.step||0.1;zoom.value=t.getSettings?.().zoom||caps.zoom.min;zoomText.textContent=Number(zoom.value).toFixed(1)+'×';}
  else zoomText.textContent=t?'ズーム非対応':'1.0×';
  torch.disabled=!caps.torch;
  status.textContent=t&&!caps.torch?'ライト非対応':'';
 }
 zoom.addEventListener('input',async()=>{if(!track)return;try{await track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]});zoomText.textContent=Number(zoom.value).toFixed(1)+'×';}catch(e){status.textContent='ズーム操作不可';}});
 torch.addEventListener('click',async()=>{manual=!torchOn;await setTorch(manual);});
 auto.addEventListener('change',()=>{manual=null;});
 // Image brightness is only an estimate of the camera image, not an illuminance measurement.
 monitor=setInterval(async()=>{
  await sync();
  if(!track||!auto.checked||manual!==null||torch.disabled)return;
  const v=video();if(!v||v.readyState<2)return;
  try{const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0,32,24);const d=ctx.getImageData(0,0,32,24).data;let sum=0;for(let i=0;i<d.length;i+=16)sum+=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722);const brightness=sum/(d.length/16);if(!torchOn&&brightness<65)await setTorch(true);else if(torchOn&&brightness>115)await setTorch(false);}catch(e){}
 },1800);
})();

window.qrMakeEncryptedFile=makeEncryptedFile;

window.qrOneDriveExport={getCount:()=>historyItems.length,getCsv:()=>csvContent()};

window.qrWorkflowAPI={getRows:()=>historyItems.map(x=>({workId:work?.id||'NORMAL',id:x.id,value:x.value,time:formatDate(x.time)})),getCsv:csvContent,clear:()=>{if(work&&work.status==='active')return;historyItems=[];cancelPending();render();},encrypt:makeEncryptedFile,save:saveBlobFile,receiverUrl};

window.qrExcelExport={getRows:()=>historyItems.map(x=>({workId:work?.id||'NORMAL',id:x.id,value:x.value,time:formatDate(x.time)})),getWork:()=>work,clearAfterCopy:()=>{if(work?.status==='completed'){/* Preserve completed records for re-copy and audit. */}else if(!work){historyItems=[];render();}}};

// Explicitly finalize the active session. END is never generated on copy/exit.
(()=>{const panel=$('inventoryPanel'),btn=document.createElement('button');btn.type='button';btn.textContent='作業完了（END記録）';btn.id='workCompleteBtn';panel.append(btn);btn.onclick=()=>{if(!work||work.status!=='active'){message('完了できる作業がありません。');return;}if(!confirm('作業を完了し、終了記録を追加しますか？'))return;const end=work.mode==='inventory'?'ZEND':'CEND';if(!workAdd(end,new Date()))return;work.status='completed';workSave();invUpdate();message('作業を完了しました。Excelへコピーしてください。');};})();
