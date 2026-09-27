#!/usr/bin/env python3
import json,math,os,statistics,sys,tempfile,zipfile
from collections import defaultdict
import shapefile
from pyproj import Transformer
Z,O=sys.argv[1:3];os.makedirs(os.path.join(O,"tiles"),exist_ok=True)
with tempfile.TemporaryDirectory() as d:
 zipfile.ZipFile(Z).extractall(d);T=Transformer.from_crs("EPSG:25832","EPSG:4326",always_xy=True);tiles=defaultdict(list);groups=defaultdict(lambda:{"a":[],"o":[],"v":[],"p":set()});total=0;used=[]
 for root,_,fs in os.walk(d):
  for fn in fs:
   if not fn.lower().endswith(".shp"):continue
   path=os.path.join(root,fn)
   try:r=shapefile.Reader(path,encoding="latin1")
   except:r=shapefile.Reader(path)
   names=[x[0] for x in r.fields[1:]];m={x.upper():i for i,x in enumerate(names)}
   def p(*xs):
    for x in xs:
     if x in m:return m[x]
   iv,im=p("IMRW","IRW_WERT","WERT"),p("TEILMA","TEILMARKT")
   if iv is None or im is None:continue
   ic,idis,ip,ie,inn,ina,ist,it=p("GENA","GEMEINDE"),p("ORTST","ORTSTEIL","GEBIET"),p("PLZ"),p("YWERT","OSTWERT"),p("XWERT","NORDWERT"),p("NAME_IRW","NAME"),p("STAG","STICHTAG"),p("IRWTYP")
   used.append(fn)
   for sr in r.iterShapeRecords():
    q=sr.record
    try:v=float(q[iv]);market=int(q[im])
    except:continue
    if not 100<=v<=20000 or market not in (1,2,3):continue
    if it is not None:
     try:
      if int(q[it]) not in (1,2):continue
     except:pass
    city=str(q[ic]).strip() if ic is not None and q[ic] is not None else "";dist=str(q[idis]).strip() if idis is not None and q[idis] is not None else "";plz=str(q[ip]).strip() if ip is not None and q[ip] is not None else "";name=str(q[ina]).strip() if ina is not None and q[ina] is not None else "";date=str(q[ist]).strip() if ist is not None and q[ist] is not None else "2026"
    try:e,n=float(q[ie]),float(q[inn])
    except:
     try:x0,y0,x1,y1=sr.shape.bbox;e,n=(x0+x1)/2,(y0+y1)/2
     except:continue
    try:lon,lat=T.transform(e,n)
    except:continue
    if not(50.1<=lat<=52.7 and 5.4<=lon<=9.8):continue
    kind="wohnung" if market==1 else "haus";sub="wohnung" if market==1 else ("efh_zfh" if market==2 else "reihe_doppel");row=[round(lat,6),round(lon,6),int(round(v)),kind,city,dist or name,plz,sub,date];key=f"{math.floor(lat*4)}_{math.floor(lon*4)}";tiles[key].append(row);g=groups[(city or dist or name or plz,kind)];g["a"].append(lat);g["o"].append(lon);g["v"].append(v);g["p"].add(plz) if plz else None;total+=1
 for k,rows in tiles.items():
  with open(os.path.join(O,"tiles",k+".json"),"w",encoding="utf8") as f:json.dump(rows,f,ensure_ascii=False,separators=(",",":"))
 ov=[]
 for (city,kind),g in groups.items():
  vs=sorted(g["v"]);ov.append({"city":city,"type":kind,"lat":round(sum(g["a"])/len(g["a"]),6),"lon":round(sum(g["o"])/len(g["o"]),6),"value":round(statistics.median(vs)),"low":round(vs[int((len(vs)-1)*.25)]),"high":round(vs[int((len(vs)-1)*.75)]),"count":len(vs),"plz":sorted(g["p"])[:8]})
 with open(os.path.join(O,"overview.json"),"w",encoding="utf8") as f:json.dump(ov,f,ensure_ascii=False,separators=(",",":"))
 with open(os.path.join(O,"manifest.json"),"w",encoding="utf8") as f:json.dump({"year":2026,"source":"BORIS-NRW Immobilienrichtwerte","license":"dl-de/zero-2-0","count":total,"tiles":sorted(tiles),"files":used},f,separators=(",",":"))
 print(total,len(tiles),len(ov),used)
