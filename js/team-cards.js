(() => {
  const carousel = document.querySelector('.people-carousel');
  if (!carousel) return;
  const cards = [...carousel.querySelectorAll('[data-person]')];
  const choices = [...carousel.querySelectorAll('[data-person-choice]')];
  const status = carousel.querySelector('.people-status');
  let active = 0;
  function select(index) {
    active = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      let offset = (i - active + cards.length) % cards.length;
      if (offset > cards.length / 2) offset -= cards.length;
      card.hidden = Math.abs(offset) > 2;
      card.style.setProperty('--offset', offset);
      card.style.setProperty('--distance', Math.abs(offset));
      card.setAttribute('aria-pressed', String(i === active));
      choices[i].setAttribute('aria-pressed', String(i === active));
    });
    status.textContent = `${String(active + 1).padStart(2, '0')} / ${cards.length} · ${cards[active].querySelector('.people-name').textContent}`;
  }
  cards.forEach((card, i) => card.addEventListener('click', () => select(i)));
  choices.forEach((choice, i) => choice.addEventListener('click', () => select(i)));
  carousel.querySelectorAll('[data-people-step]').forEach(button => button.addEventListener('click', () => select(active + Number(button.dataset.peopleStep))));
  carousel.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    select(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : active + (event.key === 'ArrowRight' ? 1 : -1));
    if (event.target.matches('[data-person]')) cards[active].focus({ preventScroll: true });
    if (event.target.matches('[data-person-choice]')) choices[active].focus({ preventScroll: true });
  });
  carousel.classList.add('is-ready');
  select(0);
})();
