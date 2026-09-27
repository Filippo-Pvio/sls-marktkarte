const API_BASE = 'https://api.propstack.de/v1';

function pickArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'properties', 'units', 'items', 'results']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function quantile(values, q) {
  if (!values.length) return null;
  const xs = [...values].sort((a,b)=>a-b);
  const pos = (xs.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return xs[base + 1] !== undefined ? xs[base] + rest * (xs[base + 1] - xs[base]) : xs[base];
}

function round50(v) {
  return v == null ? null : Math.round(v / 50) * 50;
}

function normalizeUnit(u) {
  const livingSpace = number(u.living_space ?? u.property_space_value);
  const askingPrice = number(u.price ?? u.object_price);
  const soldPrice = number(u.sold_price);
  const askingPsm = number(u.price_per_sqm) ?? (askingPrice && livingSpace ? askingPrice / livingSpace : null);
  const soldPsm = soldPrice && livingSpace ? soldPrice / livingSpace : null;
  return {
    id: u.id ?? u.property_id ?? null,
    city: u.city ?? null,
    zipCode: u.zip_code ?? null,
    district: u.district ?? u.bezirk ?? u.location_name ?? null,
    lat: number(u.lat ?? u.latitude),
    lon: number(u.lng ?? u.lon ?? u.longitude),
    rsType: u.rs_type ?? null,
    rsCategory: u.rs_category ?? null,
    marketingType: u.marketing_type ?? null,
    constructionYear: number(u.construction_year),
    livingSpace,
    askingPrice,
    soldPrice,
    askingPricePerSqm: askingPsm,
    soldPricePerSqm: soldPsm,
    soldDate: u.sold_date ?? null,
    statusId: u.property_status_id ?? u.status_id ?? u.property_status?.id ?? null,
    statusLabel: u.property_status?.name ?? u.property_status?.label ?? u.status?.name ?? u.status?.label ?? null
  };
}

function stage(r) {
  const s=String(r.statusLabel||'').toLowerCase();
  if (/(erfolgreich|verkauft|vermarktet)/.test(s)) return 'sold';
  if (/(maklerauftrag|auftrag|vermarktung|aktiv)/.test(s)) return 'listing';
  if (/(kontakt|entscheidung|prozess|akquise|bewertung)/.test(s)) return 'lead';
  return 'other';
}
function valid(v){return Number.isFinite(v)&&v>250&&v<20000}
function summarize(records) {
  const buckets={sold:[],listing:[],lead:[],other:[]};
  for(const r of records){
    const st=stage(r);
    const v=st==='sold'&&valid(r.soldPricePerSqm)?r.soldPricePerSqm:r.askingPricePerSqm;
    if(valid(v)) buckets[st].push(v);
  }
  const weighted=[];
  for(const v of buckets.sold) for(let i=0;i<5;i++) weighted.push(v);
  for(const v of buckets.listing) for(let i=0;i<3;i++) weighted.push(v);
  for(const v of buckets.lead) weighted.push(v);
  for(const v of buckets.other) weighted.push(v);
  if(!weighted.length) return {basis:'none',count:0,buckets:{sold:0,listing:0,lead:0,other:0}};
  const coreCount=buckets.sold.length+buckets.listing.length+buckets.lead.length;
  return {
    basis:'sls_weighted_market_indication',
    count:coreCount,
    weightedCount:weighted.length,
    buckets:{
      sold:buckets.sold.length,
      listing:buckets.listing.length,
      lead:buckets.lead.length,
      other:buckets.other.length
    },
    low:round50(quantile(weighted,.25)),
    typical:round50(quantile(weighted,.5)),
    high:round50(quantile(weighted,.75)),
    confidence:coreCount>=30?'high':coreCount>=12?'medium':coreCount>=5?'low':'insufficient',
    methodology:'sold x5, listing x3, lead x1; Angebotspreise und realisierte Kaufpreise bleiben im Rohdatensatz getrennt.'
  };
}

async function propstack(path, apiKey) {
  const res = await fetch(API_BASE + path, {
    headers: { 'X-API-KEY': apiKey, 'Accept':'application/json' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Propstack ' + res.status + ': ' + text.slice(0,220));
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  const apiKey = process.env.PROPSTACK_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      configured:false,
      source:'propstack',
      message:'PROPSTACK_API_KEY ist in Vercel noch nicht gesetzt.',
      summary:null,
      records:[]
    });
  }

  try {
    const city = String(req.query.city || '').trim();
    const type = String(req.query.type || 'wohnung').toLowerCase();
    const rsType = type === 'haus' ? 'HOUSE' : 'APARTMENT';

    const qs = new URLSearchParams({
      with_meta:'1',
      expand:'1',
      archived:'-1',
      marketing_type:'BUY',
      rs_type:rsType
    });
    if (city) qs.set('q', city);

    const payload = await propstack('/units?' + qs.toString(), apiKey);
    const raw = pickArray(payload);
    const normalized = raw.map(normalizeUnit)
      .filter(r => !city || String(r.city || '').toLowerCase() === city.toLowerCase());

    const summary = summarize(normalized);

    return res.status(200).json({
      configured:true,
      source:'propstack',
      city:city || null,
      type,
      summary,
      records: normalized.slice(0,250),
      notes:{
        model:'SLS-Marktindikation aus drei internen Reifestufen: Kontakt-/Entscheidungsprozess, aktive Vermarktung/Maklerauftrag und erfolgreich vermarktet.',
        weights:'Erfolgreich vermarktet wird stärker gewichtet als aktive Vermarktung; Kontakt-/Entscheidungsprozesse dienen vor allem zur Verbreiterung der regionalen Datenbasis.',
        caution:'Das Ergebnis ist eine SLS-Marktindikation und kein amtlicher Verkehrswert.'
      }
    });
  } catch (err) {
    return res.status(500).json({configured:true,source:'propstack',error:err.message});
  }
}
