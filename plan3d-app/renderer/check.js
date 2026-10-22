/* Coll Plan3D — startup check. If the 3D library didn't load, say so plainly instead of showing a blank 3D view. */
(function () {
  var ok = window.THREE && THREE.WebGLRenderer && THREE.OrbitControls;
  if (ok) return;
  var missing = !window.THREE ? 'three.min.js' : 'OrbitControls.js';
  document.addEventListener('DOMContentLoaded', function () {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:14px 18px;border-radius:10px;background:#7a1f1f;color:#fff;font:14px/1.5 system-ui,sans-serif';
    d.textContent = 'The 3D view could not start because a program file is missing (' + missing + '). ' +
      'Please reinstall Coll Plan3D from collbusinesssolutions.com/projects.html.';
    document.body.appendChild(d);
  });
})();
