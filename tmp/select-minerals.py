from pathlib import Path
import re
folder=Path('images/minerals');folder.mkdir(exist_ok=True)
colors={'platinum':('#eef3f8','#71849b'),'silver':('#ffffff','#a1adbb'),'ruby':('#ef6c85','#8f183d'),'sapphire':('#80adff','#173e95'),'emerald':('#8be2b3','#126047'),'tanzanite':('#c7b6ff','#4c328f')}
for key,(light,dark) in colors.items():
 shape='<path d="M170 160H430L460 300H140Z"/>' if key in ['platinum','silver'] else '<path d="M250 100H350L400 190L345 340H255L200 190Z"/>'
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 440"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></linearGradient><radialGradient id="b"><stop stop-color="#31445c"/><stop offset="1" stop-color="#081322"/></radialGradient></defs><rect width="600" height="440" fill="url(#b)"/><g fill="url(#g)" stroke="{light}" stroke-width="2">{shape}</g><path d="M250 100L275 190L255 340M350 100L325 190L345 340M200 190H400M275 190L300 340L325 190" fill="none" stroke="{light}" opacity=".35"/></svg>'
 if key in ['platinum','silver']:svg=svg.replace('<path d="M250 100L275 190L255 340M350 100L325 190L345 340M200 190H400M275 190L300 340L325 190" fill="none" stroke="'+light+'" opacity=".35"/>','')
 (folder/(key+'.svg')).write_text(svg,encoding='utf8')
p=Path('minerals.html');s=p.read_text(encoding='utf8');start=s.index('<section class="section mineral-directory">');end=s.index('</section>',start)+10
items=[('Diamonds','C','images/rough-stone4.jpg'),('Gold','Au','images/lots/G-2201.jpg')]+[(k.title(),'Pt' if k=='platinum' else 'Ag' if k=='silver' else '',f'images/minerals/{k}.svg') for k in colors]
block='<section class="section mineral-directory"><div class="wrap"><div class="mineral-directory-heading"><p class="eyebrow">Our Minerals</p><h2 class="section-title">Explore the <em>mineral range.</em></h2><p>Select a mineral to view its image. Additional minerals are illustrative preview entries.</p></div><div class="mineral-browser"><ul class="mineral-name-list" aria-label="Mineral range">'
for i,(name,symbol,src) in enumerate(items):block+=f'<li><button type="button" data-mineral-image="{src}" data-mineral-name="{name}" data-preview="{str(i>1).lower()}" aria-pressed="{str(i==0).lower()}" aria-controls="mineral-view"><span>{name}</span><span class="mineral-symbol" aria-hidden="true">{symbol}</span></button></li>'
block+='</ul><figure class="mineral-view" id="mineral-view"><img id="selected-mineral-image" src="images/rough-stone4.jpg" alt="Natural rough diamond"><figcaption aria-live="polite"><h3 id="selected-mineral-name">Diamonds</h3><p id="selected-mineral-note">Contact our team to confirm availability.</p></figcaption></figure></div></div></section>'
s=s[:start]+block+s[end:];s=s.replace('</body>','<script src="js/minerals.js"></script></body>');p.write_text(s,encoding='utf8')
