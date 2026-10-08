import test from 'node:test';
import assert from 'node:assert/strict';
import {serialCandidates,extractFields,summarize,guideCrop,frameQuality} from '../public/assets/scan-utils.mjs';
test('serial readings preserve prefix, zeros and stars without correcting ambiguous glyphs',()=>{
 assert.deepEqual(serialCandidates('0AB 001234\n0AB*001235\n₹100\n2024'),['0AB001234','0AB*001235']);
 assert.deepEqual(serialCandidates('0A B 001234'),['0AB001234']);
 assert.deepEqual(serialCandidates('0AB OO1234'),[]);
});
test('denomination phrases do not become separate one/hundred readings',()=>{
 const fields=extractFields('THE SUM OF ONE HUNDRED RUPEES\n2024','front');
 assert.deepEqual(fields.denominations,[100]);assert.deepEqual(fields.years,[]);
});
test('back supplies years and recognizable design clues; uncertain years remain blank',()=>{
 const fields=extractFields('RANI KI VAV\n₹100\n2024','back',2026);
 assert.deepEqual(fields.years,['2024']);assert.equal(fields.series,'Mahatma Gandhi New Series');
 assert.deepEqual(extractFields('2027','back',2026).years,[]);
 const result=summarize({reads:[{text:'₹100\n0AB001234',confidence:90}]},{reads:[{text:'2018\n2024'}]});
 assert.equal(result.year,'');assert.deepEqual(result.years,['2018','2024']);
});
test('conflicting front/back denominations and serials require a manual choice',()=>{
 const result=summarize({reads:[{text:'₹20\n0AB001234',confidence:90},{text:'0AB001234\n0AB001235',confidence:50}]},{reads:[{text:'₹100\n2024'}]});
 assert.equal(result.denomination,'');assert.equal(result.serial,'');assert.equal(result.serials[0].votes,2);
});
test('capture maps a CSS cover preview to the intrinsic camera pixels',()=>{
 const crop=guideCrop(1600,900,400,300,{x:40,y:60,width:320,height:150});
 for(const [key,value] of Object.entries({x:320,y:180,width:960,height:450}))assert.ok(Math.abs(crop[key]-value)<.01);
});
test('O/0 alternatives are labelled suggestions and never silently selected',()=>{
 const result=summarize({reads:[{text:'OAB001234',confidence:90}]},null);
 assert.equal(result.serial,'');
 assert.deepEqual(result.alternatives,[{serial:'0AB001234',source:'OAB001234',label:'Possible O/0 correction'}]);
 const low=summarize({reads:[{text:'0AB001234',confidence:30}]},null);assert.equal(low.serial,'');
});
test('live guidance detects darkness, glare, blur and stable textured frames',()=>{
 const width=16,height=16,rgba=new Uint8ClampedArray(width*height*4);
 rgba.fill(10);assert.match(frameQuality(rgba,width,height).message,/light/);
 rgba.fill(255);assert.match(frameQuality(rgba,width,height).message,/glare/);
 for(let i=0;i<width*height;i++){const v=(i+Math.floor(i/width))%2?80:180;rgba.set([v,v,v,255],i*4);}
 const first=frameQuality(rgba,width,height);assert.equal(first.ready,false);
 assert.equal(frameQuality(rgba,width,height,first.values).ready,true);
});
