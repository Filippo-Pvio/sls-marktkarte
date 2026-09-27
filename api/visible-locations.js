const OPENPLZ='https://openplzapi.org/de/Localities';

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const north=Number(req.query.north),south=Number(req.query.south),east=Number(req.query.east),west=Number(req.query.west);
  const zoom=Number(req.query.zoom||10);
  if(![north,south,east,west].every(Number.isFinite)) return res.status(400).json({error:'bounds_required'});
  const centerLat=(north+south)/2,centerLon=(east+west)/2;
  const radiusKm=Math.min(50,Math.max(5,Math.hypot((north-south)*111,(east-west)*70)/2));
  const limit=zoom>=11?80:zoom>=9.5?45:24;
  try{
    const p=new URLSearchParams({latitude:String(centerLat),longitude:String(centerLon),radius:String(Math.ceil(radiusKm)),page:'1',pageSize:'100'});
    const r=await fetch(OPENPLZ+'?'+p.toString(),{headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error('OpenPLZ '+r.status);
    const a=await r.json();
    const seen=new Set(),rows=[];
    for(const x of Array.isArray(a)?a:[]){
      const state=x.federalState||x.state||{};
      const stateKey=String(state.key||state.id||'');
      const stateName=String(state.name||'');
      if(stateKey!=='05'&&!/nordrhein-westfalen/i.test(stateName)) continue;
      const zip=String(x.postalCode||x.zipCode||'').trim();
      const name=String(x.name||x.municipality?.name||'').trim();
      const lat=Number(x.latitude??x.lat),lon=Number(x.longitude??x.lon??x.lng);
      if(!/^\d{5}$/.test(zip)||!name||!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
      if(lat<south||lat>north||lon<west||lon>east) continue;
      const key=zip+'|'+name;
      if(seen.has(key)) continue;seen.add(key);
      rows.push({postalCode:zip,name,lat,lon});
      if(rows.length>=limit) break;
    }
    return res.status(200).json({results:rows});
  }catch(e){
    return res.status(503).json({error:'locations_unavailable',results:[]});
  }
}