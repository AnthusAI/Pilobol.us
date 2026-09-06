import re
with open("web/content/assets/background-manager.js", "r") as f:
    js = f.read()

js = js.replace(
    '''  // Inject the footer credit
  window.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('.pilo-footer');
    if (footer) {
      const creditP = document.createElement('p');
      creditP.innerHTML = `Background Animation: <a href="${prefix}${chosen.creditUrl}">${chosen.creditTitle}</a>`;
      footer.appendChild(creditP);
    }
  });''',
    '''  // Inject the footer credit
  const addFooter = () => {
    const footer = document.querySelector('.pilo-footer');
    if (footer) {
      const creditP = document.createElement('p');
      creditP.innerHTML = `Background Animation: <a href="${prefix}${chosen.creditUrl}">${chosen.creditTitle}</a>`;
      footer.appendChild(creditP);
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', addFooter);
  } else {
    addFooter();
  }'''
)

with open("web/content/assets/background-manager.js", "w") as f:
    f.write(js)
