'use strict';
window.NoteFaces = (() => {
 const dimensions={1:[488,152],2:[525,154],5:[483,130],10:[538,134],20:[599,144],50:[605,148],100:[660,150],200:[693,158],500:[681,150],2000:[693,139]};
 function render(value) {
  const denomination=Number(value),size=dimensions[denomination];
  if(!size)return '<span class="note-fallback">₹'+denomination+'</span>';
  const [width,height]=size,half=width/2,src='assets/notes/'+denomination+'.jpg';
  const face=(name,x)=>'<svg class="note-face note-'+name+'" viewBox="'+x+' 0 '+half+' '+height+'" aria-hidden="true" focusable="false"><image href="'+src+'" width="'+width+'" height="'+height+'"></image></svg>';
  return '<button type="button" class="note-preview" data-note-face="'+denomination+'" aria-pressed="false" aria-label="₹'+denomination+' reference note. Show back." title="Hover, tap or press Enter to flip">'+face('front',0)+face('back',half)+'<span class="face-label" aria-hidden="true"></span></button>';
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-note-face]');if(!button)return;
  const back=button.classList.toggle('is-back');button.setAttribute('aria-pressed',String(back));button.setAttribute('aria-label','₹'+button.dataset.noteFace+' reference note. Show '+(back?'front':'back')+'.');
 });
 document.addEventListener('error',event=>{
  if(event.target.tagName?.toLowerCase()!=='image')return;
  const button=event.target.closest('[data-note-face]');if(!button)return;
  const fallback=document.createElement('span');fallback.className='note-fallback';fallback.textContent='₹'+button.dataset.noteFace;button.replaceWith(fallback);
 },true);
 return {render};
})();

