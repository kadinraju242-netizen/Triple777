(() => {
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
 const target=document.querySelector('.hero-actions, .login-layout .portal-panel');
 if(!target)return;
 const link=document.createElement('a');link.href='investor-demo.html';link.className='btn btn-outline';link.textContent='Preview Investor Dashboard';link.classList.add('investor-preview-link');target.append(link);
})();
