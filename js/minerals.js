(() => {
 const choices = [...document.querySelectorAll('[data-mineral-image]')];
 const image = document.getElementById('selected-mineral-image');
 if (!image) return;
 choices.forEach(button => button.addEventListener('click', () => {
  choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
  image.src = button.dataset.mineralImage;
  image.alt = button.dataset.mineralName + (button.dataset.preview === 'true' ? ' — illustrative preview' : '');
  document.getElementById('selected-mineral-name').textContent = button.dataset.mineralName;
  document.getElementById('selected-mineral-note').textContent = button.dataset.preview === 'true' ? 'Illustrative preview · availability to be confirmed.' : 'Contact our team to confirm availability.';
 }));
})();
