/* Coll Business Solutions LLC website analytics (Google Analytics 4, G-BEVS3VPRRD).
   No pop-up: analytics is on by default for visitors in the US and most countries. Visitors in the EU/EEA, the UK
   and Switzerland (where cookies need consent first) get no analytics cookies (Google's consent mode, cookieless).
   A visitor who has turned on Global Privacy Control in their browser is treated as opted out. "Cookie settings" in
   a page footer (any element with data-cookie-settings) lets anyone opt out or back in; the choice is remembered on
   this device. Ads storage and ad personalisation stay off for everyone. */
(function () {
  var ID = 'G-BEVS3VPRRD', KEY = 'cbs-analytics-consent';
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) { /* private window: ask each visit */ }
  var gpc = !!navigator.globalPrivacyControl;
  var EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'];
  var ads = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  // where cookies need consent first: off unless the visitor opted in with Cookie settings
  gtag('consent', 'default', Object.assign({ analytics_storage: saved === 'yes' ? 'granted' : 'denied', region: EU }, ads));
  // everywhere else: on, unless they opted out (Cookie settings) or their browser sends Global Privacy Control
  gtag('consent', 'default', Object.assign({ analytics_storage: saved === 'no' || (gpc && saved !== 'yes') ? 'denied' : 'granted' }, ads));
  gtag('js', new Date());
  gtag('config', ID, { anonymize_ip: true });
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID; document.head.appendChild(s);

  function choose(yes) {
    try { localStorage.setItem(KEY, yes ? 'yes' : 'no'); } catch (e) { /* not remembered */ }
    gtag('consent', 'update', { analytics_storage: yes ? 'granted' : 'denied' });
    var b = document.getElementById('cbs-consent'); if (b) b.remove();
  }
  function banner() {
    if (document.getElementById('cbs-consent')) return;
    var css = document.createElement('style');
    css.textContent = '#cbs-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;background:#1C1F1E;color:#E8EDEA;border-radius:12px;padding:14px 16px;box-shadow:0 8px 28px rgba(0,0,0,.28);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap}'
      + '#cbs-consent p{margin:0;flex:1 1 260px}#cbs-consent a{color:#6CCBA4}#cbs-consent button{border:0;border-radius:8px;padding:8px 14px;font:600 14px system-ui,sans-serif;cursor:pointer}'
      + '#cbs-consent .y{background:#1E6B53;color:#fff}#cbs-consent .n{background:transparent;color:#E8EDEA;border:1px solid #4B5250}';
    document.head.appendChild(css);
    var d = document.createElement('div'); d.id = 'cbs-consent'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Cookie choice');
    d.innerHTML = '<p>We use Google Analytics cookies to count visits and see which pages help. Nothing is used for ads.</p><button type="button" class="n">Turn off</button><button type="button" class="y">Allow</button>';
    d.querySelector('.y').onclick = function () { choose(true); };
    d.querySelector('.n').onclick = function () { choose(false); };
    document.body.appendChild(d);
  }
  function ready() {
    var links = document.querySelectorAll('[data-cookie-settings]');
    for (var i = 0; i < links.length; i++) links[i].addEventListener('click', function (e) { e.preventDefault(); banner(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
