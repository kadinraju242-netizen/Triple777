(() => {
 const origin=new URLSearchParams(location.search).get('from');
 const targets={'investor-demo':'investor-demo.html#project-opportunities','investor-dashboard':'investor-dashboard.html'};
 if(!targets[origin])return;
 const wrap=document.querySelector('.pagehead .wrap');
 const link=document.createElement('a');link.className='btn btn-solid';link.href=targets[origin];link.textContent='← Back to Investor Dashboard';link.style.cssText='margin-top:24px;background:#fff;color:#17365a;border-color:#fff';wrap.append(link);
})();
