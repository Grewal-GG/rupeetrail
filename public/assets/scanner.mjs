import {summarize,guideCrop,frameQuality} from './scan-utils.mjs';
import {NoteReader} from './note-reader.mjs';
const $=selector=>document.querySelector(selector),dialog=$('#note-scanner'),video=$('#camera-video');
let session=0,step='front',stream=null,reader=null,photos={},pending=null,reading=false,facing='environment',qualityTimer=null,previous=null,stable=0,torch=false,cameraRequest=0;
function active(token){return dialog.open&&token===session;}
function stopCamera(){
 cameraRequest++;
 clearInterval(qualityTimer);qualityTimer=null;previous=null;stable=0;
 stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;video.hidden=true;
 $('#camera-options').hidden=true;$('#note-guide').hidden=true;$('#capture-quality').textContent='';
}
function cleanup(){
 session++;stopCamera();reader?.dispose();reader=null;photos={};pending=null;reading=false;
 $('#photo-stage').getContext('2d').clearRect(0,0,$('#photo-stage').width,$('#photo-stage').height);
 const canvas=$('#review-image');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
 $('#review-form').reset();$('#ocr-evidence').textContent='';$('#serial-choices').replaceChildren();$('#scan-photo').value='';
}
function controls(){
 $('#camera-start').hidden=!!stream;$('#camera-options').hidden=!stream;
 $('#rotate-photo').hidden=!pending;
 $('#capture-note').textContent=(pending?'Read ':'Capture ')+step+(pending?' photo':'');
 $('#capture-note').disabled=reading||(!pending&&(!stream||!video.videoWidth));
 for(const button of $('#capture-controls').querySelectorAll('button'))if(button.id!=='capture-note')button.disabled=reading;
 for(const button of $('#camera-options').querySelectorAll('button'))button.disabled=reading;
 $('#scan-photo').disabled=reading;$('#skip-back').disabled=reading;$('#retake-front').disabled=reading;
}
function showStep(next){
 step=next;if(step==='back')document.querySelector('#auto-capture').checked=false;pending=null;previous=null;stable=0;$('#scan-photo').value='';
 for(const item of dialog.querySelectorAll('[data-step]')){item.removeAttribute('aria-current');if(item.dataset.step===step)item.setAttribute('aria-current','step');}
 $('#capture-panel').hidden=step==='review';$('#review-panel').hidden=step!=='review';$('#capture-status').textContent='';
 $('#capture-title').textContent=step==='front'?'Scan the front':'Turn the note over';
 $('#capture-description').textContent=step==='front'?'Keep the entire note upright inside the frame. The serial and denomination are on this side.':'Scan the back of the same note to read its printing year and design clues.';
 $('#retake-front').hidden=step!=='back';$('#skip-back').hidden=step!=='back';$('#photo-stage').hidden=true;
 $('#camera-placeholder').hidden=!!stream;video.hidden=!stream;$('#note-guide').hidden=!stream;
 if(step==='review'){stopCamera();review();return;}
 controls();
}
async function startCamera(){
 const token=session;stopCamera();const request=cameraRequest;pending=null;$('#photo-stage').hidden=true;$('#camera-placeholder').hidden=false;$('#capture-status').textContent='Waiting for camera access…';
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){$('#capture-status').textContent='Camera access needs HTTPS or localhost. Choose photos here, or open the app through your HTTPS address.';controls();return;}
 try{
  const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}}});
  if(!active(token)||request!==cameraRequest){next.getTracks().forEach(track=>track.stop());return;}
  stream=next;video.srcObject=stream;video.hidden=false;$('#camera-placeholder').hidden=true;
  await video.play();if(!active(token)||request!==cameraRequest){next.getTracks().forEach(track=>track.stop());return;}
  if(!video.videoWidth)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Camera preview could not start. Choose a photo instead.')),8000);video.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});});
  if(!active(token)||request!==cameraRequest)return;
  const track=stream.getVideoTracks()[0],capabilities=track.getCapabilities?.()||{};
  $('#camera-light').hidden=!capabilities.torch;torch=false;$('#camera-light').setAttribute('aria-pressed','false');
  $('#zoom-label').hidden=!capabilities.zoom;
  if(capabilities.zoom){const zoom=$('#camera-zoom');zoom.min=capabilities.zoom.min;zoom.max=capabilities.zoom.max;zoom.step=capabilities.zoom.step||.1;zoom.value=track.getSettings().zoom||capabilities.zoom.min;}
  $('#note-guide').hidden=false;$('#capture-status').textContent='';controls();qualityTimer=setInterval(checkQuality,500);
 }catch(error){
  if(!active(token)||request!==cameraRequest)return;stopCamera();
  const messages={NotAllowedError:'Camera permission was denied. Allow camera access in your browser settings, or choose a photo.',NotFoundError:'No camera was found. Choose photos to continue.',NotReadableError:'The camera is busy or unavailable. Close other camera apps, then retry.'};
  $('#capture-status').textContent=messages[error.name]||error.message||'Camera unavailable. Choose a photo instead.';controls();
 }
}
function sourceCrop(){
 const stage=$('#camera-stage').getBoundingClientRect(),guide=$('#note-guide').getBoundingClientRect();
 return guideCrop(video.videoWidth,video.videoHeight,stage.width,stage.height,{x:guide.left-stage.left,y:guide.top-stage.top,width:guide.width,height:guide.height});
}
function checkQuality(){
 if(!stream||!video.videoWidth||pending||reading||step==='review')return;
 const sample=document.createElement('canvas');sample.width=160;sample.height=75;
 const ctx=sample.getContext('2d',{willReadFrequently:true}),crop=sourceCrop();ctx.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,160,75);
 const result=frameQuality(ctx.getImageData(0,0,160,75).data,160,75,previous);previous=result.values;
 const status=$('#capture-quality');if(status.textContent!==result.message)status.textContent=result.message;status.dataset.ready=String(result.ready);
 stable=result.ready?stable+1:0;
 if($('#auto-capture').checked&&stable>=4){stable=0;capture();}
}
function snapshot(){
 if(pending)return pending;
 const crop=sourceCrop(),canvas=document.createElement('canvas'),scale=Math.min(1,2200/crop.width);
 canvas.width=Math.round(crop.width*scale);canvas.height=Math.round(crop.height*scale);canvas.getContext('2d').drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);return canvas;
}
async function capture(){
 if(reading||(!pending&&(!stream||!video.videoWidth)))return;
 const token=session,side=step,canvas=snapshot();reading=true;controls();$('#capture-status').textContent='Preparing scanner… First use downloads the OCR engine.';
 let reads=[],error='';
 try{reader??=new NoteReader(message=>{if(active(token))$('#capture-status').textContent=message;});reads=await reader.read(canvas,side);}
 catch(caught){error=caught.message;if(reader?.disposed)reader=null;}
 if(!active(token))return;
 photos[side]={canvas,reads,error};reading=false;
 if(side==='front'){showStep('back');$('#capture-status').textContent=error?'Front photo captured; OCR failed. Scan the back, then enter any missing details.':'Front captured. Now turn the same note over and scan the back.';}
 else showStep('review');
}
async function choosePhoto(event){
 const file=event.target.files[0];if(!file)return;
 const token=session;stopCamera();const request=cameraRequest;pending=null;$('#photo-stage').hidden=true;$('#camera-placeholder').hidden=false;$('#capture-status').textContent='';
 if(file.size>20*1024*1024){$('#capture-status').textContent='Choose a photo smaller than 20 MB.';controls();return;}
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();if(!active(token)||request!==cameraRequest)return;
  const scale=Math.min(1,2200/Math.max(image.width,image.height));pending=document.createElement('canvas');pending.width=Math.round(image.width*scale);pending.height=Math.round(image.height*scale);pending.getContext('2d').drawImage(image,0,0,pending.width,pending.height);
  drawPending();$('#capture-status').textContent='Check that the entire '+step+' is visible and upright, then read the photo.';
 }catch{if(active(token))$('#capture-status').textContent='Could not open the photo. Try JPG or PNG.';}
 finally{URL.revokeObjectURL(url);if(active(token))controls();}
}
function drawPending(){
 const canvas=$('#photo-stage');canvas.width=pending.width;canvas.height=pending.height;canvas.getContext('2d').drawImage(pending,0,0);canvas.hidden=false;$('#camera-placeholder').hidden=true;$('#note-guide').hidden=true;
}
function rotatePhoto(){
 if(!pending||reading)return;const rotated=document.createElement('canvas');rotated.width=pending.height;rotated.height=pending.width;const ctx=rotated.getContext('2d');ctx.translate(rotated.width/2,rotated.height/2);ctx.rotate(Math.PI/2);ctx.drawImage(pending,-pending.width/2,-pending.height/2);pending=rotated;drawPending();
}
function showPhoto(side){
 const photo=photos[side];if(!photo)return;const canvas=$('#review-image');canvas.width=photo.canvas.width;canvas.height=photo.canvas.height;canvas.getContext('2d').drawImage(photo.canvas,0,0);
 for(const name of ['front','back'])$('#show-'+name).setAttribute('aria-pressed',String(name===side));
}
function review(){
 const result=summarize(photos.front,photos.back);$('#review-form').reset();
 for(const name of ['serial','denomination','year','series'])$('#review-'+name).value=result[name]||'';
 const messages=[];
 if(!result.serial)messages.push(result.serials.length?'Choose the correct serial from the candidates, or enter it below.':'No complete serial was read. Enter it below.');
 if(!result.denomination)messages.push(result.denominations.length>1?'Conflicting denomination readings ('+result.denominations.join(', ')+'). Check that both photos are the same note.':'Choose the denomination.');
 if(result.years.length>1)messages.push('Multiple possible years: '+result.years.join(', ')+'. Check the back.');
 if(!photos.back)messages.push('Back skipped. Add any missing details manually.');
 if(photos.front?.error||photos.back?.error)messages.push('Some OCR readings failed. Check and fill the fields manually.');
 if(result.serials.some(item=>item.confidence<65))messages.push('Some serial readings have low confidence; check carefully.');
 if(result.alternatives.length)messages.push('O and 0 may be confused. Correction options below are suggestions, not direct readings.');
 if(result.motif)messages.push('Design clue read from back: '+result.motif+'.');
 $('#review-summary').textContent=messages.join(' ')||'Both sides read. Check the suggested details against the note before using them.';
 const choices=$('#serial-choices');choices.replaceChildren();
 if(result.serials.length){const label=document.createElement('p');label.textContent='Possible serials';choices.append(label);}
 for(const candidate of result.serials){
  const button=document.createElement('button');button.type='button';button.textContent=candidate.serial;button.title='Read in '+candidate.votes+' pass(es).';
  button.onclick=()=>{$('#review-serial').value=candidate.serial;$('#review-check').checked=false;};choices.append(button);
 }
 for(const alternative of result.alternatives){
  const button=document.createElement('button');button.type='button';button.textContent=alternative.serial;button.title=alternative.label+' from '+alternative.source;
  const label=document.createElement('small');label.textContent=alternative.label;button.append(label);
  button.onclick=()=>{$('#review-serial').value=alternative.serial;$('#review-check').checked=false;};choices.append(button);
 }
 $('#show-back').disabled=!photos.back;showPhoto('front');
 $('#ocr-evidence').textContent=['FRONT',...(photos.front?.reads||[]).map(read=>read.text),'BACK',...(photos.back?.reads||[]).map(read=>read.text)].join('\n\n');
 $('#review-serial').focus();dialog.scrollTop=0;
}
function retake(){
 if(reading)return;photos={};showStep('front');startCamera();
}
$('#open-scanner').onclick=()=>{if(dialog.open)return;cleanup();facing='environment';reader=null;showStep('front');dialog.showModal();$('#auto-capture').checked=false;startCamera();};
$('#scanner-close').onclick=()=>dialog.close();dialog.addEventListener('close',cleanup);
$('#camera-start').onclick=startCamera;$('#switch-camera').onclick=()=>{facing=facing==='environment'?'user':'environment';startCamera();};
$('#choose-scan-photo').onclick=()=>$('#scan-photo').click();$('#scan-photo').onchange=choosePhoto;
$('#rotate-photo').onclick=rotatePhoto;$('#capture-note').onclick=capture;$('#retake-front').onclick=retake;$('#review-retake').onclick=retake;
$('#skip-back').onclick=()=>{if(!reading)showStep('review');};
$('#show-front').onclick=()=>showPhoto('front');$('#show-back').onclick=()=>showPhoto('back');
$('#camera-light').onclick=async()=>{
 const track=stream?.getVideoTracks()[0];if(!track)return;
 try{await track.applyConstraints({advanced:[{torch:!torch}]});torch=!torch;$('#camera-light').setAttribute('aria-pressed',String(torch));}catch{$('#capture-status').textContent='The camera light could not be changed.';}
};
$('#camera-zoom').oninput=async event=>{
 const track=stream?.getVideoTracks()[0];if(!track)return;
 try{await track.applyConstraints({advanced:[{zoom:Number(event.target.value)}]});}catch{$('#capture-status').textContent='Zoom is not available on this camera.';}
};
$('#review-form').addEventListener('input',event=>{if(event.target.id!=='review-check')$('#review-check').checked=false;if(event.target.id==='review-serial')event.target.value=event.target.value.toUpperCase().replace(/\s/g,'');});
$('#review-form').onsubmit=event=>{
 event.preventDefault();const detail={};for(const name of ['denomination','serial','year','series','inset','governor'])detail[name]=$('#review-'+name).value.trim();
 dialog.close();document.dispatchEvent(new CustomEvent('rupeetrail:scan-complete',{detail}));$('#scan').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){stopCamera();if(step!=='review'){$('#capture-status').textContent='Camera paused. Start it again when ready.';controls();}}});
window.addEventListener('pagehide',()=>{if(dialog.open)dialog.close();else cleanup();});
