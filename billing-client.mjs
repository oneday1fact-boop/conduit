/* Bind each response to the account that started it, even across sign-out/device UI changes. */
export async function requestBilling(current,getToken,fetcher,route,data={}) {
 const start=current();
 if(!start.user) throw new Error('Sign in first.');
 if(!start.url) throw new Error('Purchase services are not available in this build yet.');
 const base=new URL(start.url);
 if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash) throw new Error('Invalid purchase service configuration.');
 function unchanged(){const now=current();if(now.epoch!==start.epoch || now.user?.uid!==start.user.uid) throw new Error('Account changed. Please try again.');}
 const token=await getToken(start.user);unchanged();
 const response=await fetcher(base.href.replace(/\/$/,'')+'/v1/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)});
 const result=await response.json();unchanged();
 if(!response.ok) throw new Error(result.error || 'Could not check this purchase. Try again.');
 return result;
}
