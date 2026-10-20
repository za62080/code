'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const link=$('excelShareUrl'),copy=$('excelCopyBtn'),open=$('excelOpenBtn'),status=$('excelCopyStatus'),sync=$('excelSyncStatus');
 const KEY='qrSecureExcelSharedLinkV1', CONFIG='../excel-link-config.json';
 let activeUrl='';
 function allowed(raw){
  try{
   const u=new URL(String(raw||'').trim());
   if(u.protocol!=='https:'||u.username||u.password)return null;
   // Microsoft 365 / OneDrive shared Excel links only.
   const h=u.hostname.toLowerCase();
   if(!(h==='1drv.ms'||h==='onedrive.live.com'||h==='sharepoint.com'||h.endsWith('.sharepoint.com')||h==='office.com'||h.endsWith('.office.com')||h==='officeapps.live.com'||h.endsWith('.officeapps.live.com')))return null;
   return u.href;
  }catch{return null;}
 }
 function setUrl(url,source){
  activeUrl=url; if(link)link.value=url;
  if(open)open.disabled=!url;
  if(sync)sync.textContent=url?`共通リンク取得済み（${source}）`:'共通リンクが未設定です。管理者がGitHubの設定ファイルを更新してください。';
 }
 const cached=allowed(localStorage.getItem(KEY));if(cached)setUrl(cached,'前回取得分');else setUrl('','未設定');
 async function refreshLink(){
  try{
   const res=await fetch(CONFIG+'?t='+Date.now(),{cache:'no-store'});
   if(!res.ok)throw new Error('HTTP '+res.status);
   const obj=await res.json();
   if(typeof obj.excelUrl!=='string')throw new Error('excelUrlがありません');
   const value=obj.excelUrl.trim();
   if(value && !allowed(value))throw new Error('URLの形式またはドメインが不正です');
   const valid=value?allowed(value):'';
   if(valid)localStorage.setItem(KEY,valid);else localStorage.removeItem(KEY);
   setUrl(valid,'GitHub Pages');
  }catch(err){
   if(sync)sync.textContent=activeUrl?'共通リンクの更新を確認できません。前回取得したリンクを使用中です。':'共通リンクを取得できません。通信と設定ファイルを確認してください。';
  }
 }
 window.qrRefreshExcelLink=refreshLink;
 function rows(){const h=window.qrExcelExport?.getRows?.();return Array.isArray(h)?h:[];}
 function sanitize(v){return String(v??'').replace(/[\t\r\n]+/g,' ').replace(/^[=+@-]/,String.fromCharCode(39)+'$&');}
 function update(){copy.disabled=rows().length===0;}
 copy.addEventListener('click',async()=>{
  const h=rows();if(!h.length){status.textContent='読み取り履歴がありません。';return;}
  const value=h.map(x=>[x.id,x.value,x.time,x.currentLocation||''].map(sanitize).join('\t')).join('\r\n');
  await window.qrWorkflowBackup?.('excel');
  try{await navigator.clipboard.writeText(value);window.qrWorkflowClear?.();status.textContent=`${h.length}件をコピーしました。共有Excelを開き、空白行の先頭セルに貼り付けてください。`;return;}
  catch(e){
   const ta=document.createElement('textarea');ta.value=value;ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';document.body.append(ta);ta.focus();ta.select();
   let ok=false;try{ok=document.execCommand('copy');}catch{}ta.remove();
   if(ok)window.qrWorkflowClear?.();
   status.textContent=ok?`${h.length}件をコピーしました。共有Excelに貼り付けてください。`:'コピーできませんでした。ブラウザのクリップボード権限を確認してください。';
  }
 });
 open.addEventListener('click',()=>{const u=allowed(activeUrl);if(!u){status.textContent='共有Excelリンクが未設定です。';return;}const w=window.open(u,'_blank','noopener,noreferrer');if(!w)status.textContent='新しいタブを開けない場合は、ポップアップの許可を確認してください。';});
 const observer=new MutationObserver(update);const body=$('historyBody');if(body)observer.observe(body,{childList:true,subtree:true});update();
 refreshLink();setInterval(refreshLink,5*60*1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLink();});
 window.addEventListener('online',refreshLink);
 $('excelRefreshBtn')?.addEventListener('click',refreshLink);
})();
