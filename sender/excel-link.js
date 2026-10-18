
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const link=$('excelShareUrl'),copy=$('excelCopyBtn'),open=$('excelOpenBtn'),status=$('excelCopyStatus');
 const KEY='qrSecureExcelSharedLinkV1';
 link.value=localStorage.getItem(KEY)||'';
 link.addEventListener('input',()=>localStorage.setItem(KEY,link.value.trim()));
 function safeLink(){try{const u=new URL(link.value.trim());if(u.protocol!=='https:')throw Error();return u.href;}catch{return null;}}
 function rows(){const h=window.qrExcelExport?.getRows?.();return Array.isArray(h)?h:[];}
 function sanitize(v){return String(v??'').replace(/[\t\r\n]+/g,' ').replace(/^[=+@-]/,String.fromCharCode(39)+'$&');}
 function update(){copy.disabled=rows().length===0;}
 copy.addEventListener('click',async()=>{
  const h=rows();if(!h.length){status.textContent='読み取り履歴がありません。';return;}
  const value=h.map(x=>[x.id,x.value,x.time].map(sanitize).join('\t')).join('\r\n');
  await window.qrWorkflowBackup?.('excel');
  try{await navigator.clipboard.writeText(value);window.qrWorkflowClear?.();status.textContent=`${h.length}件をコピーしました。共有Excelを開き、空白行の先頭セルに貼り付けてください。`;return;}
  catch(e){
   const ta=document.createElement('textarea');ta.value=value;ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';document.body.append(ta);ta.focus();ta.select();
   let ok=false;try{ok=document.execCommand('copy');}catch{}ta.remove();
   if(ok)window.qrWorkflowClear?.();
   status.textContent=ok?`${h.length}件をコピーしました。共有Excelに貼り付けてください。`:'コピーできませんでした。ブラウザのクリップボード権限を確認してください。';
  }
 });
 open.addEventListener('click',()=>{const u=safeLink();if(!u){status.textContent='https:// で始まる共有ExcelのURLを入力してください。';return;}const w=window.open(u,'_blank','noopener,noreferrer');if(!w)status.textContent='新しいタブを開けない場合は、ポップアップの許可を確認してください。';});
 const observer=new MutationObserver(update);const body=$('historyBody');if(body)observer.observe(body,{childList:true,subtree:true});update();
})();
