const NOMINATIM='https://nominatim.openstreetmap.org/search';

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const north=Number(req.query.north),south=Number(req.query.south),east=Number(req.query.east),west=Number(req.query.west);
  const zoom=Number(req.query.zoom||10);
  if(![north,south,east,west].every(Number.isFinite)) return res.status(400).json({error:'bounds_required'});
  const limit=zoom>=11?40:zoom>=9.5?28:18;
  try{
    const viewbox=[west,north,east,south].join(',');
    const p=new URLSearchParams({q:'Nordrhein-Westfalen',format:'jsonv2',addressdetails:'1',limit:String(limit),countrycodes:'de',bounded:'1',viewbox});
    const r=await fetch(NOMINATIM+'?'+p.toString(),{headers:{Accept:'application/json','User-Agent':'SLS-Marktkarte/1.0 (www.sls.de)'}});
    if(!r.ok) throw new Error('Nominatim '+r.status);
    const a=await r.json(),seen=new Set(),rows=[];
    for(const x of Array.isArray(a)?a:[]){
      const ad=x.address||{};
      const zip=String(ad.postcode||'').trim();
      const name=String(ad.city||ad.town||ad.village||ad.municipality||x.name||'').trim();
      const state=String(ad.state||'');
      const lat=Number(x.lat),lon=Number(x.lon);
      if(!/^\d{5}$/.test(zip)||!name||!/nordrhein-westfalen/i.test(state)||!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
      const key=zip+'|'+name;if(seen.has(key))continue;seen.add(key);
      rows.push({postalCode:zip,name,lat,lon});
    }
    return res.status(200).json({results:rows});
  }catch(e){return res.status(503).json({error:'locations_unavailable',results:[]})}
}