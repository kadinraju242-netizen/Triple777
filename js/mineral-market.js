(() => {
  const choices = [...document.querySelectorAll('[data-mineral-name]')];
  const panel = document.getElementById('commodity-prices');
  if (!panel) return;
  const title = document.getElementById('market-title');
  const description = document.getElementById('market-description');
  const status = document.getElementById('market-selection');
  const guidance = document.getElementById('market-guidance');
  const widget = document.getElementById('market-widget');
  const note = document.getElementById('market-note');
  const source = document.getElementById('market-source');
  const all = document.getElementById('market-all');
  const enquiry = document.getElementById('market-enquire');
  const metals = { Gold: 'CMCMARKETS:GOLD', Silver: 'CMCMARKETS:SILVER', Platinum: 'CMCMARKETS:PLATINUM', Copper: 'CMCMARKETS:COPPER' };
  let selected = 'Diamonds';
  let showingAll = false;
  function render(name, allMetals = false) {
    const isMetal = Boolean(metals[name]) || allMetals;
    showingAll = allMetals;
    all.setAttribute('aria-pressed', String(allMetals));
    all.textContent = allMetals ? 'Back to selected mineral' : 'View all metal prices ↗';
    title.replaceChildren(document.createTextNode(allMetals ? 'Commodity ' : `${name} `));
    const emphasis = document.createElement('em');
    emphasis.textContent = allMetals ? 'prices.' : 'market.';
    title.append(emphasis);
    guidance.hidden = isMetal;
    widget.hidden = !isMetal;
    source.hidden = !isMetal;
    widget.replaceChildren();
    if (isMetal) {
      description.textContent = 'International metal benchmarks, with USD/ZAR exchange-rate context for South African visitors.';
      status.textContent = allMetals ? 'All metal markets · Provider quotes' : `Selected mineral: ${name} · Provider quotes`;
      note.textContent = 'Quotes supplied by TradingView may be delayed. Check the provider’s currency, units and market status. USD/ZAR shows rand per US dollar; it does not convert the metal quotes. These references exclude local premiums, fees and taxes. Contact us for a South African quotation.';
      const container = document.createElement('div');
      container.className = 'tradingview-widget-container';
      const mount = document.createElement('div');
      mount.className = 'tradingview-widget-container__widget';
      const credit = document.createElement('div');
      credit.className = 'tradingview-widget-copyright';
      const link = document.createElement('a');
      link.href = 'https://www.tradingview.com/markets/commodities/';
      link.target = '_blank'; link.rel = 'noopener nofollow';
      link.textContent = 'Commodity markets';
      credit.append(link, document.createTextNode(' by TradingView'));
      const script = document.createElement('script');
      script.src = allMetals ? 'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js' : 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js';
      script.async = true;
      const names = allMetals ? Object.keys(metals) : [name];
      script.textContent = JSON.stringify(allMetals ? { width: '100%', height: allMetals ? 440 : 300, locale: 'en', showSymbolLogo: true, colorTheme: 'light', isTransparent: false, symbolsGroups: [{name: 'Metals · international reference', symbols: names.map(n => ({name: metals[n], displayName: n}))}, {name: 'South African rand · exchange rate', symbols: [{name: 'FX_IDC:USDZAR', displayName: 'USD / ZAR'}]}] } : {symbol: metals[name], width: '100%', isTransparent: true, colorTheme: 'light', locale: 'en'});
      script.addEventListener('error', () => {
        const error = document.createElement('p');
        error.className = 'market-feed-error';
        error.textContent = 'Market data could not load. Use the TradingView link below or contact our team for current pricing.';
        container.replaceChildren(error, credit);
      });
      container.append(mount, credit, script);
      widget.append(container);
      if (!allMetals) {
        const fx = document.createElement('div');
        fx.className = 'tradingview-widget-container market-fx';
        const label = document.createElement('p');
        label.className = 'market-fx-label';
        label.textContent = 'Rand context · USD / ZAR';
        const fxMount = document.createElement('div');
        fxMount.className = 'tradingview-widget-container__widget';
        const fxScript = document.createElement('script');
        fxScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js';
        fxScript.async = true;
        fxScript.textContent = JSON.stringify({symbol: 'FX_IDC:USDZAR', width: '100%', isTransparent: true, colorTheme: 'light', locale: 'en'});
        fx.append(fxMount, fxScript);
        widget.append(label, fx);
      }
      widget.classList.toggle('is-all-markets', allMetals);
    } else {
      const diamond = name === 'Diamonds';
      description.textContent = diamond ? 'Pricing for natural rough and polished diamonds, considered stone by stone.' : `Explore ${name.toLowerCase()} pricing and discuss your requirements with our Kimberley team.`;
      status.textContent = `Selected mineral: ${name} · Prices on request`;
      const row = document.createElement('tr');
      [diamond ? 'Natural diamonds' : name, 'On request', diamond ? 'Per stone or parcel' : 'Per stone', 'Confirm with our team'].forEach((text, i) => {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.scope = 'row';
        cell.textContent = text; row.append(cell);
      });
      document.getElementById('market-pricing-rows').replaceChildren(row);
      document.getElementById('market-guidance-title').textContent = diamond ? 'Every diamond has its own value.' : 'A price shaped by the stone.';
      document.getElementById('market-guidance-copy').textContent = diamond ? 'Carat weight, colour, clarity and cut inform polished diamond pricing. Rough parcels also depend on their assortment and recovery characteristics.' : 'Colour, carat weight, clarity, origin and any treatments influence value. Share the specification you need so our team can confirm availability and pricing.';
      enquiry.textContent = diamond ? 'Request diamond pricing' : `Request ${name.toLowerCase()} pricing`;
      document.getElementById('market-lots').hidden = !diamond;
      note.textContent = `${diamond ? 'Diamond' : name} prices are quoted individually by Triple 7. No ${diamond ? 'diamond' : name.toLowerCase()} spot-price feed is connected. Ask our Kimberley team for current availability and a quotation in ZAR or USD.`;
    }
  }
  choices.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.mineralName;
    render(selected);
  }));
  all.addEventListener('click', () => render(selected, !showingAll));
  enquiry.addEventListener('click', () => {
    const interest = document.querySelector('.enquiry-form select[name="interest"]');
    if (interest) interest.value = selected;
  });
  render(choices.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.mineralName || 'Diamonds');
})();
