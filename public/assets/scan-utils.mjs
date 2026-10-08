export const DENOMINATIONS = [1,2,5,10,20,50,100,200,500,2000];
export function serialCandidates(text) {
 const found = new Set();
 const pattern = /\b((?:[A-Z0-9][ \t]*){2,4})(\*?[ \t]*\d(?:[ \t]*\d){5}\*?)(?![A-Z0-9])/g;
 for (const line of String(text).toUpperCase().split(/\r?\n/)) {
  for (const match of line.matchAll(pattern)) {
   const prefix=match[1].replace(/\s/g,'');
   if (/[A-Z]/.test(prefix)) found.add(match[0].replace(/\s/g,''));
  }
 }
 return [...found].filter(serial=>serial.length>=6&&serial.length<=16);
}
export function extractFields(text,side='front',maxYear=new Date().getFullYear()) {
 const raw=String(text).toUpperCase(), denominations=new Set();
 for(const m of raw.matchAll(/(?:₹|\bRS\.?|\bRUPEES?|\bINR)\s*([0-9][0-9,]*)/g)) {
  const value=Number(m[1].replace(/,/g,''));if(DENOMINATIONS.includes(value))denominations.add(value);
 }
 for(const m of raw.matchAll(/\b(\d{1,4})\s+RUPEES?\b/g))if(DENOMINATIONS.includes(Number(m[1])))denominations.add(Number(m[1]));
 const wordValues=[['TWO THOUSAND',2000],['FIVE HUNDRED',500],['TWO HUNDRED',200],['ONE HUNDRED',100],['HUNDRED',100],['FIFTY',50],['TWENTY',20],['TEN',10],['FIVE',5],['TWO',2],['ONE',1]];
 let words=raw.replace(/[-\s]+/g,' ');
 for(const [phrase,value] of wordValues) {
  const pattern=new RegExp('\\b'+phrase+'(?: RUPEES?)?\\b','g');
  if(pattern.test(words)){denominations.add(value);words=words.replace(pattern,' ');}
 }
 const motifs=['RANI KI VAV','ELLORA','RED FORT','SANCHI','HAMPI','KONARK','MANGALYAAN'];
 const motif=side==='back'?motifs.find(name=>raw.includes(name)):'';
 const years=side==='back'?[...new Set(raw.match(/\b(?:19|20)\d{2}\b/g)||[])].filter(year=>Number(year)<=maxYear):[];
 return {denominations:[...denominations],years,series:motif?'Mahatma Gandhi New Series':'',motif:motif||''};
}
export function summarize(front,back) {
 const fronts=front?.reads||[], backs=back?.reads||[], candidates=new Map();
 for(const read of fronts)for(const serial of serialCandidates(read.text)) {
  const item=candidates.get(serial)||{serial,votes:0,confidence:0};item.votes++;item.confidence=Math.max(item.confidence,Number(read.confidence)||0);candidates.set(serial,item);
 }
 const fields=[...fronts.map(read=>extractFields(read.text,'front')),...backs.map(read=>extractFields(read.text,'back'))];
 const denominations=[...new Set(fields.flatMap(field=>field.denominations))];
 const years=[...new Set(fields.flatMap(field=>field.years))];
 const serials=[...candidates.values()].sort((a,b)=>b.votes-a.votes||b.confidence-a.confidence);
 const alternatives=serials.filter(item=>/^O[A-Z]{2}\*?\d{6}\*?$/.test(item.serial)).map(item=>({serial:'0'+item.serial.slice(1),source:item.serial,label:'Possible O/0 correction'})).filter(item=>!candidates.has(item.serial));
 return {serials,alternatives,denominations,years,serial:serials.length===1&&serials[0].confidence>=65&&!alternatives.length?serials[0].serial:'',denomination:denominations.length===1?String(denominations[0]):'',year:years.length===1?years[0]:'',series:fields.find(field=>field.series)?.series||'',motif:fields.find(field=>field.motif)?.motif||''};
}
export function guideCrop(sourceWidth,sourceHeight,stageWidth,stageHeight,guide) {
 const scale=Math.max(stageWidth/sourceWidth,stageHeight/sourceHeight);
 const offsetX=(sourceWidth*scale-stageWidth)/2,offsetY=(sourceHeight*scale-stageHeight)/2;
 const x=Math.max(0,(guide.x+offsetX)/scale),y=Math.max(0,(guide.y+offsetY)/scale);
 return {x,y,width:Math.min(sourceWidth-x,guide.width/scale),height:Math.min(sourceHeight-y,guide.height/scale)};
}
export function frameQuality(rgba,width,height,previous=null) {
 const values=new Float32Array(width*height);let light=0,glare=0,motion=0,edgeSum=0,edgeSquared=0,count=0;
 for(let i=0;i<values.length;i++){
  const value=.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2];values[i]=value;light+=value;if(value>246)glare++;if(previous)motion+=Math.abs(value-previous[i]);
 }
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x,edge=4*values[i]-values[i-1]-values[i+1]-values[i-width]-values[i+width];edgeSum+=edge;edgeSquared+=edge*edge;count++;
 }
 const brightness=light/values.length,glareRatio=glare/values.length,sharpness=count?edgeSquared/count-(edgeSum/count)**2:0,movement=previous?motion/values.length:Infinity;
 let message='Hold the entire note inside the frame.',ready=false;
 if(brightness<48)message='More light needed.';
 else if(brightness>228||glareRatio>.22)message='Reduce glare or move away from bright light.';
 else if(sharpness<65)message='Move closer or let the camera focus.';
 else if(movement>9)message='Hold the note and camera steady.';
 else{message='Steady and clear. Ready to capture.';ready=true;}
 return {brightness,sharpness,movement,ready,message,values};
}
