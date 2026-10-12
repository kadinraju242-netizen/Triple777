(() => {
 const choices=[...document.querySelectorAll('[data-mineral-image]')];
 const image=document.getElementById('selected-mineral-image');
 if(!image)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let selection=0, animation=null;
 async function fade(opacity,duration){
  if(animation){const current=getComputedStyle(image).opacity;animation.cancel();image.style.opacity=current;}
  if(reduced.matches){image.style.opacity=String(opacity);return;}
  animation=image.animate([{opacity:getComputedStyle(image).opacity},{opacity}],{duration,easing:'ease-in-out',fill:'forwards'});
  const active=animation;
  try{await active.finished;if(animation===active){image.style.opacity=String(opacity);active.cancel();animation=null;}}catch{}
 }
 choices.forEach(button=>button.addEventListener('click',async()=>{
  const request=++selection;
  choices.forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
  const preload=new Image();
  const loaded=new Promise(resolve=>{preload.onload=()=>resolve(true);preload.onerror=()=>resolve(false);});
  preload.src=button.dataset.mineralImage;
  const [,success]=await Promise.all([fade(0,500),loaded]);
  if(request!==selection)return;
  if(!success){document.getElementById('selected-mineral-note').textContent='Image unavailable. Please try another mineral.';await fade(1,650);return;}
  image.src=preload.src;
  try{await image.decode();}catch{}
  if(request!==selection)return;
  image.alt=button.dataset.mineralName+(button.dataset.preview==='true'?' — illustrative preview':'');
  document.getElementById('selected-mineral-name').textContent=button.dataset.mineralName;
  document.getElementById('selected-mineral-note').textContent=button.dataset.preview==='true'?'Illustrative preview · availability to be confirmed.':'Contact our team to confirm availability.';
  await fade(1,750);
 }));
})();
