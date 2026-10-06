// Appliqué avant le premier rendu : thème et langue mémorisés (évite le flash de mauvais thème).
(function () {
  var root = document.documentElement;
  try {
    var theme = localStorage.getItem('nv_theme');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    var query = new URLSearchParams(location.search).get('lang');
    var lang = query || localStorage.getItem('nv_lang');
    if (lang === 'fr' || lang === 'en' || lang === 'mg') root.setAttribute('lang', lang);
    if (sessionStorage.getItem('nv_intro')) root.classList.add('intro-seen');
  } catch (e) {
    /* stockage indisponible : valeurs par défaut */
  }
  root.classList.add('js');
})();
