/* Accessible service disclosures. Desktop shows one panel; mobile allows collapsing it. */
(function () {
 document.querySelectorAll('.services-panel').forEach(root => {
  const buttons = Array.from(root.querySelectorAll('.service-choice'));
  const mobile = window.matchMedia('(max-width: 760px)');
  function select(button, canCollapse) {
   const close = canCollapse && button.getAttribute('aria-expanded') === 'true';
   buttons.forEach(b => {
    const active = b === button && !close;
    b.setAttribute('aria-expanded', String(active));
    document.getElementById(b.getAttribute('aria-controls')).hidden = !active;
   });
  }
  root.classList.add('is-enhanced');
  select(buttons[0], false);
  buttons.forEach((button, index) => {
   button.addEventListener('click', () => select(button, mobile.matches));
   button.addEventListener('keydown', e => {
    let next;
    if (e.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (e.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = buttons.length - 1;
    if (next !== undefined) { e.preventDefault(); buttons[next].focus(); select(buttons[next], false); }
   });
  });
  mobile.addEventListener('change', () => {
   if (!mobile.matches && !buttons.some(b => b.getAttribute('aria-expanded') === 'true')) select(buttons[0], false);
  });
 });
})();
