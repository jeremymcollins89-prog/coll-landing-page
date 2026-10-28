# Super Render

Source for `renderer/vendor/superrender.js`, the path-traced "Super Render" the 3D viewer opens.
Built with three.js r185 and three-gpu-pathtracer (WebGL), separate from the viewer's own three.js r128.

    cd plan3d-app/superrender
    npm install
    npm run build

`patch.js` adds a firefly clamp to the path tracer's shader before bundling.
