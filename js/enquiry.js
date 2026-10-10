(() => {
  document.querySelectorAll('[data-inquiry-interest]').forEach(link => {
    link.addEventListener('click', () => {
      const select = document.querySelector('[data-enquiry-form] select[name="interest"]');
      if (select) select.value = link.dataset.inquiryInterest;
    });
  });
  document.querySelectorAll('[data-enquiry-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const interest = data.get('interest');
      const body = `Name: ${data.get('name')}\r\nEmail: ${data.get('email')}\r\nPhone: ${data.get('phone') || 'Not provided'}\r\nInterest: ${interest}\r\n\r\n${data.get('message')}`;
      window.location.href = `mailto:info@triple7holdings.co.za?subject=${encodeURIComponent('Website enquiry — ' + interest)}&body=${encodeURIComponent(body)}`;
      form.querySelector('[role="status"]').textContent = 'Your email draft is ready in your email app. Send it there to complete your enquiry. You can also email info@triple7holdings.co.za directly.';
    });
  });
})();
