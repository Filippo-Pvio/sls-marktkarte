const WMS='https://www.wms.nrw.de/boris/wms_nw_irw';

function findValue(obj){
  if(!obj || typeof obj!=='object') return null;
  const keys=Object.keys(obj);
  const preferred=keys.find(k=>/(richtwert|irw|wert|price|preis|euro|eur)/i.test(k) && !/(jahr|id|art|typ)/i.test(k));
  if(preferred){
    const n=Number(String(obj[preferred]).replace(',','.').replace(/[^0-9.\-]/g,''));
    if(Number.isFinite(n) && n>0) return {key:preferred,value:n};
  }
  for(const k of keys){
    const v=obj[k];
    if(typeof v==='number' && v>100 && v<20000) return {key:k,value:v};
    if(typeof v==='string'){
      const m=v.match(/([0-9]{3,5}(?:[.,][0-9]+)?)\s*(?:€|EUR)?/i);
      if(m){
        const n=Number(m[1].replace(',','.'));
        if(Number.isFinite(n) && n>100 && n<20000) return {key:k,value:n};
      }
    }
  }
  return null;
}

async function featureInfo(lat,lon,format){
  const d=.003;
  const p=new URLSearchParams({
    SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',
    LAYERS:'irwz,irw',QUERY_LAYERS:'irwz,irw',
    STYLES:'',SRS:'EPSG:4326',
    BBOX:[lon-d,lat-d,lon+d,lat+d].join(','),
    WIDTH:'101',HEIGHT:'101',X:'50',Y:'50',
    FEATURE_COUNT:'10',INFO_FORMAT:format,FORMAT:'image/png',TRANSPARENT:'TRUE'
  });
  const r=await fetch(WMS+'?'+p.toString(),{headers:{'User-Agent':'SLS-Marktkarte/1.0'}});
  const text=await r.text();
  return {ok:r.ok,status:r.status,contentType:r.headers.get('content-type')||'',text,url:WMS+'?'+p.toString()};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const lat=Number(req.query.lat),lon=Number(req.query.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return res.status(400).json({error:'lat/lon required'});
  try{
    let r=await featureInfo(lat,lon,'application/json');
    let parsed=null,features=[];
    if(r.ok){
      try{parsed=JSON.parse(r.text);features=Array.isArray(parsed.features)?parsed.features:[]}catch{}
    }
    if(!features.length){
      const txt=await featureInfo(lat,lon,'text/plain');
      const raw=(txt.text||'').slice(0,8000);
      return res.status(200).json({found:false,lat,lon,raw,contentType:txt.contentType,source:'BORIS-NRW'});
    }
    const normalized=features.map(f=>{
      const props=f.properties||{};
      return {properties:props,value:findValue(props),geometryType:f.geometry?.type||null};
    });
    const best=normalized.find(x=>x.value)||normalized[0];
    return res.status(200).json({
      found:true,lat,lon,source:'BORIS-NRW',
      value:best.value?.value||null,valueField:best.value?.key||null,
      properties:best.properties,
      featureCount:features.length
    });
  }catch(e){
    return res.status(500).json({error:e.message,source:'BORIS-NRW'});
  }
}
