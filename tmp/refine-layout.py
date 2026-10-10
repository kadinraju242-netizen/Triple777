from pathlib import Path
import re
p=Path('index.html');s=p.read_text(encoding='utf8')
s=s.replace('Meet the company & team ↗','About Us ↗').replace('Explore Minerals ↗','Minerals ↗').replace('Discover our expertise ↗','Learn More ↗').replace('Explore Consulting ↗','Learn More ↗')
s=s.replace('src="images/team-daniel.jpg" alt=""','src="images/live-operations.jpg" alt="Overhead view of mining operations"',1)
s=s.replace('class="section home-story story-tint"><div class="wrap home-story-layout"><div><p class="eyebrow">Minerals','class="section home-story story-tint home-minerals-summary"><div class="wrap home-story-layout"><div><p class="eyebrow">Minerals',1)
s=re.sub(r'<section class="stats-band home-footprint">.*?</section>','',s,flags=re.S)
s=s.replace('<a href="mine-projects.html" class="btn btn-solid">Mine Projects</a>','',1)
p.write_text(s,encoding='utf8')
p=Path('about.html');s=p.read_text(encoding='utf8')
s=s.replace('A considered approach.</em></h2></div>','A considered approach.</em></h2><img class="about-intro-photo" src="images/hero-modican.jpg" alt="Mining operations viewed from above" loading="lazy"></div>',1)
s=s.replace('Discuss a commissioned piece ↗','Inquire ↗').replace('Explore Provenance ↗','Provenance ↗').replace('Our process ↗','Our Process ↗')
p.write_text(s,encoding='utf8')
