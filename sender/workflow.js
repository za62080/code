 'use strict';
(()=>{
 const $=id=>document.getElementById(id), KEY='qrWorkflowBackupsV1';
 const api=()=>window.qrWorkflowAPI;
 const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return [];}};
 const write=x=>localStorage.setItem(KEY,JSON.stringify(x));
 const csv=rows=>'\uFEFF識別番号,QRコードデータ,読取日時\r\n'+rows.map(r=>[r.id,r.value,r.time].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const clean=v=>String(v??'').replace(/[\t\r\n]+/g,' ').replace(/^[=+@-]/,"'$&");
 const tsv=rows=>rows.map(r=>[r.id,r.value,r.time].map(clean).join('\t')).join('\r\n');
 const message=s=>{const el=$('notice');if(el)el.textContent=s;};
 function saveCopy(kind){const rows=api()?.getRows?.()||[];if(!rows.length)return null;const id=Date.now()+'-'+Math.random().toString(36).slice(2,8);const item={id,kind,at:new Date().toLocaleString('ja-JP'),rows};const items=read();items.unshift(item);write(items.slice(0,100));refresh();return item;}
 // CSV is downloaded before handing data to another app. Local backup supports resend until explicit exit.
 function ensureCsv(kind){const item=saveCopy(kind);if(!item)return null;const f=new File([csv(item.rows)],'QR履歴_'+item.id+'.csv',{type:'text/csv;charset=utf-8'});api().save(f);return item;}
 window.qrWorkflowBackup=async(kind)=>{
  if(kind==='csv')return saveCopy(kind);
  return ensureCsv(kind);
 };
 window.qrWorkflowClear=()=>{api()?.clear?.();message('送信操作に渡したため画面の履歴を削除しました。相手への到達・貼り付け完了は未確認です。必要なら再送信してください。');};
 const showSettings=on=>{ $('mainView').hidden=on;$('settingsView').hidden=!on;$('openSettingsBtn').hidden=on;window.scrollTo(0,0); };
 $('openSettingsBtn').onclick=()=>showSettings(true);$('backSettingsBtn').onclick=()=>showSettings(false);
 const sms=$('smsNumber');sms.value=localStorage.getItem('qrSmsRecipientV1')||'';sms.oninput=()=>localStorage.setItem('qrSmsRecipientV1',sms.value.trim());
 const mail=$('shareEmail');mail.value=localStorage.getItem('qrMailRecipientV1')||'';mail.oninput=()=>localStorage.setItem('qrMailRecipientV1',mail.value.trim());
 async function sendSms(rows){const number=sms.value.trim();if(!/^\+?[0-9\- ]{8,20}$/.test(number)){message('設定画面で送信先電話番号を入力してください。');return false;}
  const body=tsv(rows);if(body.length>1300&&!confirm('SMS本文が長いため、SMSアプリで分割・送信失敗する可能性があります。続けますか？'))return false;
  const sep=/iPad|iPhone|iPod/.test(navigator.userAgent)?'&':'?';location.href='sms:'+number+sep+'body='+encodeURIComponent(body);return true;
 }
 const smsBtn=$('smsSendBtn');const observer=new MutationObserver(()=>{smsBtn.disabled=!(api()?.getRows?.().length);});observer.observe($('historyBody'),{childList:true,subtree:true});smsBtn.disabled=true;
 smsBtn.onclick=async()=>{const rows=api().getRows();if(!rows.length)return;await window.qrWorkflowBackup('sms');if(await sendSms(rows)){window.qrWorkflowClear();message('SMSアプリを開きました。実際の送信完了は確認できません。送信前に宛先と本文を確認してください。');}};
 const select=$('backupSelect'),panel=$('resendPanel');
 function refresh(){if(!select)return;const selected=select.value;select.replaceChildren(...read().map(x=>new Option(x.at+' ／ '+x.rows.length+'件 ／ '+x.kind,x.id)));if([...select.options].some(o=>o.value===selected))select.value=selected;$('resendExecuteBtn').disabled=!select.options.length;}
 $('resendOpenBtn').onclick=()=>{panel.hidden=!panel.hidden;refresh();};
 async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();return ok;}}
 $('resendExecuteBtn').onclick=async()=>{
  const item=read().find(x=>x.id===select.value);if(!item){$('resendStatus').textContent='再送信できる履歴がありません。';return;}
  if(!confirm('選択した過去のデータを再送信しますか？'))return;
  const method=document.querySelector('input[name="resendMethod"]:checked')?.value;let info='';
  if(method==='excel'){
   if(await copyText(tsv(item.rows))){info='Excel用データをコピーしました。共有Excelを開いて貼り付けてください。';const b=$('excelOpenBtn');b?.click();}else info='コピーに失敗しました。';
  }else if(method==='sms'){
   if(await sendSms(item.rows))info='SMSアプリを開きました。送信完了は確認できません。';
  }else{
   const addr=mail.value.trim();if(!addr||!mail.checkValidity()){info='設定画面で有効な受信側メールアドレスを入力してください。';}
   else{
    // Re-encrypt the archived CSV rather than the current empty on-screen history.
    const p=$('encPassword').value,min=Number($('passwordMinLength').value);
    if(p.length<min||p!==$('encPassword2').value||($('strongPasswordRule').checked&&!(/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p))))info='設定画面の暗号化パスワードと確認欄を確認してください。';
    else{
     try{
      const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      const key0=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveKey']);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:310000},key0,{name:'AES-GCM',length:256},false,['encrypt']);
      const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(csv(item.rows))));
      const b64=a=>btoa(String.fromCharCode(...a));
      const f=new File([JSON.stringify({format:'QRSECURE',version:1,kdf:'PBKDF2-SHA-256',iterations:310000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(bytes)})], 'QR再送_'+item.id+'.qrenc',{type:'application/octet-stream'});
      if(navigator.share&&navigator.canShare?.({files:[f]})){await navigator.share({files:[f],title:'QR暗号化データ',text:'宛先：'+addr+'\n復号ページ：'+api().receiverUrl()});info='共有画面に渡しました。メールの宛先と添付を確認してください。';}
      else{api().save(f);info='暗号化ファイルをダウンロードしました。メールで '+addr+' に添付してください。';}
     }catch(e){info='暗号化メール再送信に失敗しました：'+(e.message||e);}
    }
   }
  }
  $('resendStatus').textContent=info;
 };
 // Web pages cannot delete files in the device Downloads folder, nor guarantee cleanup on OS app termination.
 window.qrWorkflowExit=async()=>{localStorage.removeItem(KEY);refresh();};
 window.addEventListener('pagehide',()=>{ /* No destructive cleanup: accidental backgrounding must not lose recovery data. */ });
 refresh();
})();