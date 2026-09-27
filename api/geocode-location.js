const NOMINATIM='https://nominatim.openstreetmap.org/search';

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const postalCode=String(req.query.postalCode||'').trim();
  const name=String(req.query.name||'').trim();
  if(!postalCode&&!name) return res.status(400).json({error:'postalCode or name required'});
  const q=[postalCode,name,'Deutschland'].filter(Boolean).join(' ');
  const p=new URLSearchParams({q,format:'jsonv2',limit:'1',countrycodes:'de'});
  try{
    const r=await fetch(NOMINATIM+'?'+p.toString(),{headers:{Accept:'application/json','User-Agent':'SLS-Marktkarte/1.0 (www.sls.de)'}});
    if(!r.ok) throw new Error('Geocoder '+r.status);
    const a=await r.json();
    if(!Array.isArray(a)||!a[0]) return res.status(404).json({found:false});
    return res.status(200).json({found:true,lat:Number(a[0].lat),lon:Number(a[0].lon),displayName:a[0].display_name||null});
  }catch(e){
    return res.status(500).json({error:e.message,found:false});
  }
}
