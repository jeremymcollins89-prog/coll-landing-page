// Adds a firefly clamp and a NaN guard to three-gpu-pathtracer's path tracing shader (idempotent).
const fs = require('fs');
const p = require.resolve('three-gpu-pathtracer/src/materials/pathtracing/PhysicalPathTracingMaterial.js');
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('p3peak')) {
  const a = '\t\t\t\t\tgl_FragColor.a *= opacity;\n';
  if (!s.includes(a)) throw new Error('three-gpu-pathtracer shader changed: update patch.js');
  s = s.replace(a, `\t\t\t\t\t// Coll Plan3D: drop invalid samples and cap very bright ones (fireflies)
\t\t\t\t\tif ( any( isnan( gl_FragColor.rgb ) ) || any( isinf( gl_FragColor.rgb ) ) ) gl_FragColor.rgb = vec3( 0.0 );
\t\t\t\t\tfloat p3peak = max( max( gl_FragColor.r, gl_FragColor.g ), gl_FragColor.b );
\t\t\t\t\tif ( p3peak > 6.0 ) gl_FragColor.rgb *= 6.0 / p3peak;
` + a);
  fs.writeFileSync(p, s);
}
console.log('path tracer shader patched');
