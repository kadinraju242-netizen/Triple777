from pathlib import Path
import re
for p in Path('.').glob('*.html'):
 s=p.read_text(encoding='utf8')
 # Remove decorative arrows in visible action labels, without changing destinations.
 s=re.sub(r'\s*(?:↗|→|&nearr;|&rarr;)(?=\s*</(?:a|button|span)>)','',s)
 if p.name=='index.html':
  s=s.replace('<div class="hero-actions"><a href="#inquiry" class="btn btn-solid">Make an Inquiry</a>','<div class="hero-actions"><a href="trade.html" class="btn btn-solid">Trade</a>',1)
  s=s.replace('<a href="investors.html" class="btn btn-solid hero-invest-button">Invest</a></div>','<div class="hero-caption-actions"><a href="investors.html" class="btn btn-solid hero-invest-button">Invest</a><a href="#inquiry" class="btn btn-solid hero-inquiry-button">Make an Inquiry</a></div></div>',1)
  # Replace the three cropped/boxed diamond presentations with the full-stone asset.
  s=s.replace('src="images/rough-stone.jpg" alt=""','src="images/rough-stone4.jpg" alt="Natural rough diamond"')
  s=s.replace('src="images/rough-stone.jpg" alt="Sorting','src="images/rough-stone4.jpg" alt="Sorting')
 if p.name=='minerals.html':
  s=s.replace('src="images/rough-stone.jpg"','src="images/rough-stone4.jpg"')
  s=s.replace('<a href="trade.html?commodity=diamond" class="btn btn-outline">Explore Diamonds</a><a href="#inquiry" class="text-link" data-inquiry-interest="Diamonds">Inquire Now</a>','<div class="mineral-actions"><a href="trade.html?commodity=diamond" class="btn btn-outline">Explore Diamonds</a><a href="#inquiry" class="text-link" data-inquiry-interest="Diamonds">Inquire Now</a></div>')
  s=s.replace('<a href="trade.html?commodity=gold" class="btn btn-outline">Explore Gold</a><a href="#inquiry" class="text-link" data-inquiry-interest="Gold">Inquire Now</a>','<div class="mineral-actions"><a href="trade.html?commodity=gold" class="btn btn-outline">Explore Gold</a><a href="#inquiry" class="text-link" data-inquiry-interest="Gold">Inquire Now</a></div>')
 if p.name=='about.html':
  s=s.replace('Explore Minerals</a>','Minerals</a>').replace('Discuss bulk commodities</a>','Commodities</a>').replace('Explore Mine Projects</a>','Projects</a>')
 p.write_text(s,encoding='utf8')
