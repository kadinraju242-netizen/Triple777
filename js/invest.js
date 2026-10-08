/* Enquiry-first launch: prepares an email, never claims a server submission. */
(function () {
  const form = document.getElementById('invest-enquiry');
  if (!form) return;
  const mine = form.elements.mine;
  const selected = new URLSearchParams(location.search).get('mine');
  if (['bucklands', 'longlands', 'both', 'general'].includes(selected)) mine.value = selected;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const interest = mine.options[mine.selectedIndex].text;
    const draft = 'Investment enquiry: ' + interest + '\n\nName: ' + data.get('name').trim() + '\nEmail: ' + data.get('email').trim() + '\nPhone: ' + (data.get('phone').trim() || 'Not provided') + '\n\n' + (data.get('message').trim() || 'Please contact me to discuss the project, funding requirements and proposed investment terms.');
    document.getElementById('invest-draft').value = draft;
    document.getElementById('invest-result').hidden = false;
    location.href = 'mailto:info@triple7holdings.co.za?subject=' + encodeURIComponent('Investment enquiry — ' + interest) + '&body=' + encodeURIComponent(draft);
  });
  document.getElementById('invest-copy').addEventListener('click', async function () {
    const draft = document.getElementById('invest-draft');
    const status = document.getElementById('invest-copy-status');
    try { await navigator.clipboard.writeText(draft.value); status.textContent = 'Copied. Paste this into your email to our team.'; }
    catch (_) { draft.focus(); draft.select(); status.textContent = 'Select and copy the enquiry above, then paste it into your email.'; }
  });
})();
