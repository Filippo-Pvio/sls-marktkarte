export default function handler(req,res){
  const configured=Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY);
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({configured});
}