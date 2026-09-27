const OPENPLZ='https://openplzapi.org/de/Localities';

function clean(s){return String(s||'').trim()}
function isPlz(q){return /^\d{2,5}$/.test(q)}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  const q=clean(req.query.q);
  if(q.length<2) return res.status(200).json({results:[]});
  try{
    const p=new URLSearchParams({page:'1',pageSize:'12'});
    if(isPlz(q)) p.set('postalCode','^'+q);
    else p.set('name','^'+q);
    const r=await fetch(OPENPLZ+'?'+p.toString(),{headers:{Accept:'application/json','User-Agent':'SLS-Marktkarte/1.0'}});
    if(!r.ok) throw new Error('OpenPLZ '+r.status);
    const rows=await r.json();
    const seen=new Set(),results=[];
    for(const row of (Array.isArray(rows)?rows:[])){
      const postalCode=clean(row.postalcode||row.postalCode);
      const name=clean(row.name);
      const municipality=clean(row.municipality?.name);
      const state=clean(row.federalState?.name);
      const stateKey=clean(row.federalState?.key);
      const key=postalCode+'|'+name+'|'+municipality;
      if(!postalCode||seen.has(key)) continue;
      seen.add(key);
      results.push({postalCode,name,municipality,state,stateKey});
      if(results.length>=8) break;
    }
    return res.status(200).json({results});
  }catch(e){
    return res.status(500).json({error:e.message,results:[]});
  }
}
