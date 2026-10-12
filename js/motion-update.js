(() => {
 if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
 const elements=document.querySelectorAll('.home-story-layout>*, .journey-heading, .journey-scene, .journey-detail, .mineral-directory-heading, .mineral-name-list li, .mineral-view');
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('motion-visible');observer.unobserve(entry.target);}}),{threshold:.08});
 elements.forEach((element,i)=>{element.classList.add('motion-ready');element.style.setProperty('--motion-delay',`${element.matches('.mineral-name-list li') ? (i%8)*55 : 0}ms`);observer.observe(element);});
})();
