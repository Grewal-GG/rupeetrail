let libraryPromise=null;
function loadLibrary(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=()=>{clearTimeout(timer);script.remove();libraryPromise=null;reject(Error('OCR could not load. Check your connection, or enter the readings manually.'));};
  const timer=setTimeout(fail,20000);
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
  script.onload=()=>{clearTimeout(timer);window.Tesseract?resolve(window.Tesseract):fail();};
  script.onerror=fail;document.head.append(script);
 });
 return libraryPromise;
}
function prepare(source,region=null){
 const crop=region||{x:0,y:0,width:source.width,height:source.height};
 const scale=Math.min(2,Math.max(1,1400/crop.width));
 const canvas=document.createElement('canvas');canvas.width=Math.round(crop.width*scale);canvas.height=Math.round(crop.height*scale);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
 const image=ctx.getImageData(0,0,canvas.width,canvas.height),histogram=new Uint32Array(256);
 for(let i=0;i<image.data.length;i+=4){const gray=Math.round(.299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2]);histogram[gray]++;}
 const total=canvas.width*canvas.height;let low=0,high=255,sum=0;
 for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=total*.02){low=i;break;}}
 sum=0;for(let i=255;i>=0;i--){sum+=histogram[i];if(sum>=total*.02){high=i;break;}}
 const range=Math.max(40,high-low);
 for(let i=0;i<image.data.length;i+=4){const gray=.299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2],value=Math.max(0,Math.min(255,(gray-low)*255/range));image.data[i]=image.data[i+1]=image.data[i+2]=value;}
 ctx.putImageData(image,0,0);return canvas;
}
export class NoteReader{
 constructor(progress){this.progress=progress;this.worker=null;this.generation=0;this.disposed=false;}
 async getWorker(token){
  if(this.worker)return this.worker;
  const library=await loadLibrary();if(this.disposed||token!==this.generation)throw Error('Scan cancelled.');
  const worker=await library.createWorker('eng',1,{logger:message=>{if(!this.disposed&&message.status==='recognizing text')this.progress('Reading… '+Math.round(message.progress*100)+'%');}});
  if(this.disposed||token!==this.generation){await worker.terminate();throw Error('Scan cancelled.');}
  this.worker=worker;return worker;
 }
 async read(source,side){
  const token=this.generation;
  let timeout;
  const task=async()=>{
   const worker=await this.getWorker(token),reads=[];
   const check=()=>{if(this.disposed||token!==this.generation)throw Error('Scan cancelled.');};
   this.progress('Reading '+side+' details…');
   await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:'',preserve_interword_spaces:'1'});
   check();
   const full=await worker.recognize(prepare(source),{rotateAuto:true});check();reads.push({text:full.data.text,confidence:full.data.confidence});
   if(side==='front'){
    await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789* ',preserve_interword_spaces:'1'});
    for(const region of [{x:source.width*.45,y:source.height*.63,width:source.width*.55,height:source.height*.37},{x:0,y:0,width:source.width*.55,height:source.height*.35}]){
     check();this.progress('Checking serial panels…');const result=await worker.recognize(prepare(source,region));check();reads.push({text:result.data.text,confidence:result.data.confidence});
    }
   }
   return reads;
  };
  try{return await Promise.race([task(),new Promise((_,reject)=>{timeout=setTimeout(()=>{this.dispose();reject(Error('Reading took too long. Retake the photo or enter the details manually.'));},90000);})]);}
  finally{clearTimeout(timeout);}
 }
 dispose(){this.disposed=true;this.generation++;const worker=this.worker;this.worker=null;if(worker)worker.terminate().catch(()=>{});}
}

