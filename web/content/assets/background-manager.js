(() => {
  const effects = [
    {
      script: 'physarum-v17.js',
      creditTitle: 'Effect: Physarum Polycephalum',
      creditUrl: 'effects/physarum.html'
    },
    {
      script: 'reaction-diffusion-v1.js',
      creditTitle: 'Effect: Reaction-Diffusion',
      creditUrl: 'effects/reaction-diffusion.html'
    },
    {
      script: 'cellular-automata-v1.js',
      creditTitle: 'Effect: Continuous Cellular Automata',
      creditUrl: 'effects/cellular-automata.html'
    }
  ];
  
  const chosen = effects[Math.floor(Math.random() * effects.length)];
  
  const isArticle = window.location.pathname.includes('/articles/') || window.location.pathname.includes('/effects/');
  const prefix = isArticle ? '../' : '';
  
  // Inject the script
  const scriptTag = document.createElement('script');
  scriptTag.src = prefix + 'assets/' + chosen.script;
  document.head.appendChild(scriptTag);
  
  // Inject the footer credit
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
  }
})();
