'use strict';
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});}
  // No free text or client-selected upstream, tenant, actor or decision.
  const body=req.body;
  const allowed=['session','request','quote','budget','document','approval','previous'];
  if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!allowed.includes(k)))return res.status(400).json({ok:false,error:'INVALID_REQUEST'});
  const key=process.env.BUILDSEAL_EXPERIENCE_API_KEY;
  if(!key)return res.status(503).json({ok:false,error:'DEMO_NOT_CONFIGURED'});
  try{
    const upstream=await fetch('https://buildseal-api-production-8d31.up.railway.app/demo/procurement/evaluate',{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)
    });
    const data=await upstream.json();
    return res.status(upstream.status).json(data);
  }catch(_){return res.status(504).json({ok:false,error:'OUTCOME_UNKNOWN'});}
};
