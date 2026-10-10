from pathlib import Path
import re
p=Path('index.html');s=p.read_text(encoding='utf8');s=re.sub(r'<a class="text-link" href="about.html#(?:services|consulting)">Learn More</a>','',s);p.write_text(s,encoding='utf8')
p=Path('minerals.html');s=p.read_text(encoding='utf8')
start=s.index('<section class="section">',s.index('<main'));end=s.index('</section>',start)+len('</section>')
items=[('Diamonds','C'),('Gold','Au'),('Platinum','Pt'),('Silver','Ag'),('Ruby',''),('Sapphire',''),('Emerald',''),('Tanzanite','')]
listing='<section class="section mineral-directory"><div class="wrap mineral-directory-layout"><div><p class="eyebrow">Our Minerals</p><h2 class="section-title">Explore the<br><em>mineral range.</em></h2><p>Diamonds, precious metals and gemstones.</p><p class="directory-note">Additional minerals are preview entries. Contact our team to confirm availability.</p></div><ul class="mineral-name-list" aria-label="Mineral range">'+''.join(f'<li><span>{name}</span><span class="mineral-symbol" aria-hidden="true">{symbol}</span></li>' for name,symbol in items)+'</ul></div></section>'
s=s[:start]+listing+s[end:]
s=s.replace('Discover diamonds and gold through our Kimberley Trade Desk.','Diamonds, precious metals and gemstones from the Triple 7 mineral range.')
p.write_text(s,encoding='utf8')
