import {identity,accessToken,database} from './google.mjs';
import {service,Failure,PRODUCT,PACKAGE} from './service.mjs';
const routes=new Set(['billing/account','billing/verify','billing/restore','account/delete']);
const origins=new Set(['https://localhost','http://localhost','capacitor://localhost','https://oneday1fact-boop.github.io']);
function headers(origin){return {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};}
async function bodyText(request) {
 const reader=request.body?.getReader();if(!reader)return '{}';
 const decoder=new TextDecoder();let bytes=0,text='';
 for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192){await reader.cancel();throw new Failure(413,'Request too large');}text+=decoder.decode(value,{stream:true});}
 return text+decoder.decode();
}
export function handler(deps={identity,accessToken,database,fetch}) {
 async function backend(env) {
  const access=await deps.accessToken(env),db=deps.database(env,access);
  const play=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${PRODUCT}/tokens/`;
  async function google(url,method='GET',body){const r=await deps.fetch(url,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Failure(503,'Purchase service unavailable. Try again.');return r.status===204?{}:r.json();}
  return service(db,{get:token=>google(play+encodeURIComponent(token)),acknowledge:token=>google(play+encodeURIComponent(token)+':acknowledge','POST',{})},uid=>google(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:delete`,'POST',{localId:uid}));
 }
 return {
  async fetch(request,env) {
   const origin=request.headers.get('Origin')||'',h=headers(origin);
   if(origin && !origins.has(origin))return Response.json({error:'Origin not allowed'},{status:403,headers:h});
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:h});
   const route=new URL(request.url).pathname.replace(/^\/v1\//,'');
   if(request.method!=='POST'||!routes.has(route))return Response.json({error:'Not found'},{status:404,headers:h});
   if(env.SERVICE_ENABLED!=='true')return Response.json({error:'Account purchase services are being prepared.'},{status:503,headers:h});
   if(Number(request.headers.get('Content-Length')||0)>8192)return Response.json({error:'Request too large'},{status:413,headers:h});
   try {
    const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];if(!token)throw new Failure(401,'Sign in first.');
    let who;try{who=await deps.identity(token,env);}catch{throw new Failure(401,'Sign in again.');}
    const text=await bodyText(request);if(text.length>8192)throw new Failure(413,'Request too large');
    let data;try{data=JSON.parse(text||'{}');}catch{throw new Failure(400,'Invalid request');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Failure(400,'Invalid request');
    const result=await (await backend(env)).call(route,who,data);
    return Response.json(result,{headers:h});
   } catch(error) {return Response.json({error:error instanceof Failure?error.message:'Service unavailable. Please retry.'},{status:error instanceof Failure?error.status:503,headers:h});}
  },
  async scheduled(event,env,ctx){if(env.SERVICE_ENABLED==='true')ctx.waitUntil(backend(env).then(api=>api.maintain()).catch(()=>{}));}
 };
}
export default handler();
