import '../cloud-client.js';
const $=id=>document.getElementById(id),notice=s=>{$('cloudStatus').textContent=s};
$('cloudLogin').onclick=async()=>{try{notice('ログイン中…');notice('ログイン: '+await window.qrCloud.login($('cloudEmail').value,$('cloudPassword').value))}catch(e){notice('ログイン失敗: '+e.message)}};
$('cloudLogout').onclick=async()=>{try{await window.qrCloud.logout();notice('ログアウトしました')}catch(e){notice(e.message)}};
$('cloudUpload').onclick=async()=>{const btn=$('cloudUpload');btn.disabled=true;try{
 notice('暗号化・アップロード中…');const f=await window.qrMakeEncryptedFile();const bytes=new Uint8Array(await f.arrayBuffer());if(bytes.length>1048576)throw Error('ファイルが1MiBを超えています');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const r=await window.qrCloud.call('uploadEncrypted',{data:btoa(binary)});notice(`アップロード完了：ID ${r.id} / 有効期限 ${new Date(r.expiresAt).toLocaleString('ja-JP')}（7日）`);
 }catch(e){notice('送信失敗（履歴は維持）：'+e.message)}finally{btn.disabled=false}};
