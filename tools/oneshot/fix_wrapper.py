import re

with open("web/css/pilobil-theme-v6.css", "r") as f:
    css = f.read()

# Make the page wrapper wider and give it a massive soft shadow to push the animation far away from the text
css = css.replace(
    '''  .pilo-page-wrapper {
    position: relative;
    z-index: 1;
    max-width: 50rem;
    margin: 0 auto;
    background-color: var(--markus-paper) !important;
    padding: 0 1.25rem;
    box-shadow: 0 0 60px 40px var(--markus-paper);
  }''',
    '''  .pilo-page-wrapper {
    position: relative;
    z-index: 1;
    max-width: 60rem;
    margin: 0 auto;
    background-color: var(--markus-paper) !important;
    padding: 0 4rem;
    box-shadow: 0 0 100px 80px var(--markus-paper);
  }'''
)

with open("web/css/pilobil-theme-v6.css", "w") as f:
    f.write(css)
