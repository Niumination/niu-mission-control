// Dynamic Plugin Loader for Mission Control Dashboard
window.loadPlugin = function(name, config) {
  console.log('[Plugin] Loading:', name, config);
  // In production: fetch plugin script, inject into page
  const script = document.createElement('script');
  script.src = `/static/plugins/${name}/index.js`;
  document.body.appendChild(script);
};

window.registerPlugins = function(list) {
  console.log('[Plugin Registry] Registered:', list);
  (list || []).forEach(p => { if (window.loadPlugin) window.loadPlugin(p.name, p); });
};
