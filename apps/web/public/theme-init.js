// Apply theme and language direction before first paint (no flash).
(function () {
  try {
    var p = JSON.parse(localStorage.getItem('tc:prefs') || '{}');
    var theme = p.theme || 'dark';
    var dark =
      theme === 'dark' ||
      (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.classList.toggle('light', !dark);
    var lang = p.lang === 'fa' ? 'fa' : 'en';
    el.lang = lang;
    el.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document
      .querySelector('meta[name=theme-color]')
      .setAttribute('content', dark ? '#170602' : '#fff8ef');
  } catch (e) {}
})();
