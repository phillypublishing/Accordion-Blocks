const { JSDOM, VirtualConsole } = require('jsdom');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const virtualConsole = new VirtualConsole().sendTo(console, { omitJSDOMErrors: true });
virtualConsole.on('jsdomError', (error) => { if (error.type !== 'css parsing') console.error(error); });
const dom = new JSDOM('', { url: 'https://example.test', pretendToBeVisual: true, virtualConsole });
for (const key of ['window', 'document', 'DOMParser', 'MutationObserver', 'HTMLElement', 'Element', 'Node', 'File', 'Blob', 'FileReader', 'getComputedStyle']) global[key] = dom.window[key];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
global.ResizeObserver = window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
function loadSource(entry, { mocks = {} } = {}) {
 const filename = path.join(root, entry);
 const result = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', loader: { '.js': 'jsx', '.scss': 'empty' }, jsx: 'automatic' });
 const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
 const originalRequire = mod.require.bind(mod); mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id);
 mod._compile(result.outputFiles[0].text, filename); return mod.exports;
}
function registerCore() { require('@wordpress/block-library').registerCoreBlocks(); }
module.exports = { loadSource, registerCore, dom };
