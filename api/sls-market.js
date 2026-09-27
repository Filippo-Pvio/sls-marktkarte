const SOURCE='https://sls-website-eight.vercel.app/api/propstack-market-data';

export default async function handler(req,res){
  res.setHeader('X-Robots-Tag','noindex,nofollow');
  res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1800');
  if(req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
  const zip=String(req.query.zip||'').trim();
  const type=String(req.query.type||'').trim().toLowerCase();
  if(!/^\d{5}$/.test(zip)||!['haus','wohnung'].includes(type)) return res.status(400).json({error:'invalid_query'});
  try{
    const url=new URL(SOURCE);
    url.searchParams.set('zip',zip);
    url.searchParams.set('type',type);
    const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw new Error('source_'+r.status);
    const data=await r.json();
    const area=Array.isArray(data.areas)?data.areas.find(a=>String(a.zipCode)===zip&&a.type===type):null;
    if(!area) return res.status(200).json({found:false,zip,type});
    const sold=area.sold||{count:0};
    const asking=area.asking||{count:0};
    let basis=null, stats=null;
    if(Number(sold.count)>=5 && sold.typical!=null){basis='sold';stats=sold;}
    else if(Number(asking.count)>=5 && asking.typical!=null){basis='asking';stats=asking;}
    return res.status(200).json({
      found:!!basis,
      zipCode:zip,
      city:area.city||null,
      type,
      basis,
      count:basis?Number(stats.count)||0:Math.max(Number(sold.count)||0,Number(asking.count)||0),
      low:basis?stats.low:null,
      typical:basis?stats.typical:null,
      high:basis?stats.high:null,
      confidence:area.confidence||'insufficient',
      soldCount:Number(sold.count)||0,
      askingCount:Number(asking.count)||0,
      stages:area.stages||{},
      generatedAt:data.generatedAt||null
    });
  }catch(err){
    return res.status(503).json({error:'sls_market_unavailable'});
  }
}