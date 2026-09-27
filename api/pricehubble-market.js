const AUTH_URL='https://api.pricehubble.com/auth/login/credentials';
const STATS_URL='https://api.pricehubble.com/api/v1/offers/statistics';

function monthOffset(months){
  const d=new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth()+months);
  return d.toISOString().slice(0,7);
}
function pick(stats,type,rank){
  return stats.find(s=>s.metric==='sale_price_per_square_meter'&&s.type===type&&(rank==null||Number(s.parameters?.percentileRank)===rank))?.value ?? null;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  if(req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
  const zip=String(req.query.zip||'').trim();
  const type=String(req.query.type||'').trim().toLowerCase();
  if(!/^\d{5}$/.test(zip)||!['haus','wohnung'].includes(type)) return res.status(400).json({error:'invalid_query'});

  const username=String(process.env.PRICEHUBBLE_USERNAME||'').trim();
  const password=String(process.env.PRICEHUBBLE_PASSWORD||'').trim();
  if(!username||!password) return res.status(200).json({configured:false,found:false,zip,type});

  try{
    const auth=await fetch(AUTH_URL,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({username,password}),
      signal:AbortSignal.timeout(12000)
    });
    if(!auth.ok) return res.status(502).json({configured:true,found:false,error:'authentication_failed'});
    const authJson=await auth.json();
    const token=authJson.access_token;
    if(!token) return res.status(502).json({configured:true,found:false,error:'authentication_failed'});

    const body={
      statistics:[
        {metric:'sale_price_per_square_meter',type:'count'},
        {metric:'sale_price_per_square_meter',type:'percentile',parameters:{percentileRank:25}},
        {metric:'sale_price_per_square_meter',type:'percentile',parameters:{percentileRank:50}},
        {metric:'sale_price_per_square_meter',type:'percentile',parameters:{percentileRank:75}}
      ],
      filters:{
        dealType:'sale',
        propertyType:type==='wohnung'?'apartment':'house',
        divisionLevel100:zip,
        startDate:{min:monthOffset(-12),max:monthOffset(0)}
      },
      countryCode:'DE'
    };

    const r=await fetch(STATS_URL,{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+token},
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(15000)
    });
    if(!r.ok){
      const status=r.status;
      return res.status(200).json({configured:true,found:false,zip,type,error:'statistics_unavailable',status});
    }
    const data=await r.json();
    const stats=Array.isArray(data?.items?.[0]?.statistics)?data.items[0].statistics:[];
    const count=Number(pick(stats,'count'))||0;
    const low=Number(pick(stats,'percentile',25));
    const typical=Number(pick(stats,'percentile',50));
    const high=Number(pick(stats,'percentile',75));
    const found=count>=5&&Number.isFinite(low)&&Number.isFinite(typical)&&Number.isFinite(high);
    return res.status(200).json({
      configured:true,found,zip,type,count,
      low:found?Math.round(low):null,
      typical:found?Math.round(typical):null,
      high:found?Math.round(high):null,
      confidence:count>=10?'good':count>=5?'limited':'insufficient',
      source:'pricehubble_offer_statistics',
      period:{min:monthOffset(-12),max:monthOffset(0)}
    });
  }catch(e){
    return res.status(503).json({configured:true,found:false,error:'pricehubble_unavailable'});
  }
}