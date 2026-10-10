from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.skip=0
 def handle_starttag(self,t,a):
  if t in ['script','style']:self.skip+=1
  if t=='img':print('IMAGE',dict(a).get('src'),dict(a).get('alt'))
 def handle_endtag(self,t):
  if t in ['script','style']:self.skip-=1
 def handle_data(self,d):
  if not self.skip and d.strip():print(d.strip())
p=P();p.feed(open('tmp/reference-about.html',encoding='utf8').read())
