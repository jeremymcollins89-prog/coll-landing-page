# Puts a page's search/AI head tags (scripts/seo/<name>-head.html) into its index.html, replacing any earlier copy,
# and gives it a fuller <title>. Usage: python3 scripts/seo/inject.py dino-garden "Dino Garden: calm learning game for toddlers"
import re, sys, pathlib
name, title = sys.argv[1], sys.argv[2]
page = pathlib.Path(name) / 'index.html'
head = (pathlib.Path(__file__).parent / f'{name}-head.html').read_text().strip()
s = page.read_text()
s = re.sub(r'\n?<!-- search and AI: added by the site.*?<!-- /seo -->', '', s, flags=re.S)
s = re.sub(r'<title>.*?</title>', '<title>' + title + '</title>', s, count=1, flags=re.S)
s = s.replace('</title>', '</title>\n' + head, 1)
page.write_text(s)
