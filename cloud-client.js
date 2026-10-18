import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';
import {firebaseConfig} from './cloud-config.js';
let auth,functions;
if(firebaseConfig.apiKey!=='REPLACE_ME'){
 const app=initializeApp(firebaseConfig);auth=getAuth(app);functions=getFunctions(app,'asia-northeast1');
}
const check=()=>{if(!auth)throw Error('Firebaseの設定が未完了です（cloud-config.js）')};
export const cloud={
 configured:!!auth,
 login:async(email,password)=>{check();await signInWithEmailAndPassword(auth,email,password);return auth.currentUser.email},
 logout:async()=>{check();await signOut(auth)},
 user:()=>auth?.currentUser,
 call:async(name,data={})=>{check();if(!auth.currentUser)throw Error('先にログインしてください');return (await httpsCallable(functions,name)(data)).data}
};
window.qrCloud=cloud;
window.dispatchEvent(new Event('qr-cloud-ready'));
