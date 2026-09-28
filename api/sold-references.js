const SOURCE='https://sls-website-eight.vercel.app/api/propstack-sold-references';
const GEO='https://nominatim.openstreetmap.org/search';

async function geocode(city,zipCode){
  const q=[zipCode,city,'Nordrhein-Westfalen','Deutschland'].filter(Boolean).join(' ');
  const p=new URLSearchParams({q,format:'jsonv2',limit:'1',countrycodes:'de'});
  const r=await fetch(GEO+'?'+p,{headers:{Accept:'application/json','User-Agent':'SLS-Marktkarte/1.0 (www.sls.de)'},signal:AbortSignal.timeout(7000)});
  if(!r.ok)return null;
  const a=await r.json();
  if(!Array.isArray(a)||!a[0])return null;
  const lat=Number(a[0].lat),lon=Number(a[0].lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return {lat,lon};
}
export default async function handler(req,res){
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  try{
    const r=await fetch(SOURCE,{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('reference_feed_'+r.status);
    const x=await r.json();
    const refs=(Array.isArray(x.references)?x.references:[]).filter(v=>v&&v.id&&v.title&&v.city&&v.image);
    const places=new Map();
    for(const item of refs){
      const key=(item.zipCode||'')+'|'+item.city;
      if(!places.has(key))places.set(key,{city:item.city,zipCode:item.zipCode||null});
    }
    const coords=new Map();
    for(const [key,p] of places){
      const g=await geocode(p.city,p.zipCode);
      if(g)coords.set(key,g);
    }
    const references=refs.map(item=>{
      const key=(item.zipCode||'')+'|'+item.city,g=coords.get(key);
      if(!g)return null;
      return {
        id:String(item.id),title:String(item.title).slice(0,130),city:String(item.city).slice(0,70),
        zipCode:item.zipCode||null,type:item.type||'Immobilie',image:item.image,
        url:typeof item.url==='string'&&/^https:\/\//.test(item.url)?item.url:null,
        lat:g.lat,lon:g.lon
      };
    }).filter(Boolean);
    res.setHeader('X-SLS-Reference-Count',String(references.length));
    if(req.query.summary==='1') return res.status(200).json({count:references.length,cities:[...new Set(references.map(r=>r.city))].slice(0,20)});
    return res.status(200).json({references});
  }catch(e){
    return res.status(503).json({error:'references_unavailable',references:[]});
  }
}