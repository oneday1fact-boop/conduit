import {SignJWT,importPKCS8,createRemoteJWKSet,jwtVerify} from 'jose';
let cachedOAuth, cachedIdentity;
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export async function identity(token,env) {
 const {payload}=await jwtVerify(token,keys,{algorithms:['RS256'],audience:env.FIREBASE_PROJECT_ID,issuer:'https://securetoken.google.com/'+env.FIREBASE_PROJECT_ID});
 if(!payload.sub || payload.sub.length>128) throw new Error('Invalid identity');
 return payload;
}
export async function accessToken(env) {
 // Secret is scoped to this separate Worker, never the APK/repository or public game Worker.
 const account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
 if(account.project_id!==env.FIREBASE_PROJECT_ID || !account.client_email || !account.private_key) throw new Error('Wrong service identity');
 if(cachedIdentity===account.client_email && cachedOAuth?.expires>Date.now()) return cachedOAuth.token;
 const key=await importPKCS8(account.private_key,'RS256');
 const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/androidpublisher https://www.googleapis.com/auth/cloud-platform'})
  .setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
 const result=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!result.ok) throw new Error('Service authentication unavailable');
 const data=await result.json();cachedIdentity=account.client_email;cachedOAuth={token:data.access_token,expires:Date.now()+(data.expires_in-60)*1000};
 return data.access_token;
}
function encode(v) {
 if(v===null)return {nullValue:null};if(typeof v==='boolean')return {booleanValue:v};
 if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
 if(typeof v==='string')return {stringValue:v};
 return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};
}
function decode(v) {
 if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;
 if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
 if('nullValue'in v)return null;return Object.fromEntries(Object.entries(v.mapValue?.fields||{}).map(([k,v])=>[k,decode(v)]));
}
export function database(env,token) {
 const root=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
 const path=p=>p.split('/').map(encodeURIComponent).join('/');
 async function request(url,method='GET',body) {
  const res=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(res.status===404)return null;
  if(!res.ok){const error=new Error('Database operation unavailable');error.status=res.status;throw error;}
  return res.status===204?{}:res.json();
 }
 const document=d=>d?{path:d.name.split('/documents/')[1],data:Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]))}:null;
 const fields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));
 return {
  get:async p=>document(await request(root+'/'+path(p))),
  put:async(p,data)=>request(root+'/'+path(p),'PATCH',{fields:fields(data)}),
  create:async(p,data)=>{const pieces=p.split('/');const id=pieces.pop();return request(root+'/'+path(pieces.join('/'))+'?documentId='+encodeURIComponent(id),'POST',{fields:fields(data)});},
  remove:async p=>request(root+'/'+path(p),'DELETE'),
  async list(collection,pageToken){const q=new URLSearchParams({pageSize:'500'});if(pageToken)q.set('pageToken',pageToken);const r=await request(root+'/'+path(collection)+'?'+q);return {docs:(r?.documents||[]).map(document),next:r?.nextPageToken};},
  async deleteMany(paths){if(paths.length)await request(root+':commit','POST',{writes:paths.map(p=>({delete:`projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${p}`}))});},
  async query(collection,filters,limit=10){const r=await request(root+':runQuery','POST',{structuredQuery:{from:[{collectionId:collection}],where:filters,limit}});return (r||[]).filter(r=>r.document).map(r=>document(r.document));}
 };
}
