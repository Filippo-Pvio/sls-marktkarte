const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const key=String(process.env.GOOGLE_MAPS_BROWSER_KEY||'').trim();
const out=src.replaceAll('__GOOGLE_MAPS_BROWSER_KEY__',key);
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'dist','index.html'),out);
