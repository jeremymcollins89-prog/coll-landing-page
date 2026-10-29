// The app's own double-entry engine, used unchanged so the server builds and
// grades practice clients exactly the way the app does.
// plus.js adds the planning helpers to Core and exports the whole engine
// (it's plain JS that runs in the browser, in Electron and under Node/esbuild).
import Core from '../../ledger-app/src/renderer/plus.js';

export default Core;
