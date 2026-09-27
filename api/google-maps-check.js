export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const key=String(process.env.GOOGLE_MAPS_BROWSER_KEY||'').trim();
  if(!key) return res.status(200).json({configured:false});
  try{
    const r=await fetch('https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key),{
      headers:{Referer:'https://sls-marktkarte.vercel.app/'}
    });
    const body=await r.text();
    const flags={
      invalidKey:/InvalidKeyMapError|invalid.*key/i.test(body),
      referrerBlocked:/RefererNotAllowedMapError|referrer.*not.*allowed/i.test(body),
      billing:/BillingNotEnabledMapError|billing/i.test(body)
    };
    return res.status(200).json({configured:true,status:r.status,ok:r.ok,flags});
  }catch(e){
    return res.status(200).json({configured:true,ok:false,error:'request_failed'});
  }
}