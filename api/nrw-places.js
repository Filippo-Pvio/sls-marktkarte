const BASE='https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-germany-gemeinde/records';
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  try{
    const u=new URL(BASE);
    u.searchParams.set('where','lan_code="05"');
    u.searchParams.set('limit','5');
    const r=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw new Error('source_'+r.status);
    const d=await r.json();
    return res.status(200).json({total:d.total_count??null,sample:d.results||[]});
  }catch(e){
    return res.status(503).json({error:e.message});
  }
}