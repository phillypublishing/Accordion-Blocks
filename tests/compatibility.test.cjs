const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const defaultsModule = () => import('data:text/javascript;base64,' + Buffer.from(readFileSync(resolve(__dirname, '../src/utils/defaults.js'), 'utf8')).toString('base64'));

test('missing and malformed REST defaults always produce all five typed settings', async () => {
	const { normalizeDefaults } = await defaultsModule();
	const expected = { initiallyOpen: false, clickToClose: true, autoClose: true, scroll: false, scrollOffset: 0 };
	for (const input of [undefined, null, false, [], {}, { initiallyOpen: 'false', clickToClose: 0, autoClose: null, scroll: 'true', scrollOffset: Infinity }]) {
		assert.deepEqual(normalizeDefaults(input), expected);
	}
	assert.deepEqual(normalizeDefaults({ initiallyOpen: true, scrollOffset: 125, surprise: true }), { ...expected, initiallyOpen: true, scrollOffset: 125 });
	assert.deepEqual(normalizeDefaults({ clickToClose: false, autoClose: false, scroll: true, scrollOffset: -20.5 }), { ...expected, clickToClose: false, autoClose: false, scroll: true, scrollOffset: -20.5 });
});

test('new-item defaults preserve explicit settings and edits made before REST finishes', async () => {
	const { normalizeDefaults, getNewItemDefaults } = await defaultsModule();
	const initial = normalizeDefaults({ scrollOffset: 50 });
	const remote = normalizeDefaults({ initiallyOpen: true, scrollOffset: 100 });
	assert.deepEqual(getNewItemDefaults(initial, initial, remote), { ...remote, scrollOffset: 50 });
	assert.equal(getNewItemDefaults(initial, { ...initial, clickToClose: false }, remote), null);
});

test('actual serializer recovers only the observed missing-settings wrapper and preserves content', (context) => {
	for (const method of ['warn', 'error', 'log', 'info', 'groupCollapsed', 'groupEnd']) context.mock.method(console, method, () => {});
	const { loadSource, registerCore } = require('./helpers.cjs');
	const blocks = require('@wordpress/blocks');
	const metadata = require('../block.json');
	registerCore();
	blocks.unstable__bootstrapServerSideBlockDefinitions({ [metadata.name]: metadata });
	loadSource('src/block/index.js');
	const attributes = { uuid: 1771601, title: 'A <strong>formatted</strong> title', titleTag: 'h3', initiallyOpen: true, clickToClose: false, autoClose: false, scroll: true, scrollOffset: 55, anchor: 'existing-anchor', className: 'custom-class' };
	const item = blocks.createBlock(metadata.name, attributes, [blocks.createBlock('core/paragraph', { content: 'Nested <em>content</em>' })]);
	const canonical = blocks.serialize([item]);
	const omitted = canonical.replace(/ data-(?:initially-open|click-to-close|auto-close|scroll|scroll-offset)="[^"]*"/g, '');
	assert.notEqual(omitted, canonical);
	// Characterize the bug against the actual current save with only the new
	// compatibility entry temporarily removed.
	const deprecated = blocks.getBlockType(metadata.name).deprecated;
	const compatibility = deprecated.shift();
	try { assert.equal(blocks.parse(omitted)[0].isValid, false); }
	finally { deprecated.unshift(compatibility); }
	const recovered = blocks.parse(omitted)[0];
	assert.equal(recovered.isValid, true);
	for (const [key, value] of Object.entries(attributes)) assert.equal(recovered.attributes[key], value, key);
	assert.equal(String(recovered.innerBlocks[0].attributes.content), 'Nested <em>content</em>');
	assert.equal(blocks.serialize([recovered]), canonical);
	assert.equal(blocks.parse(canonical)[0].isValid, true);
	const defaultCanonical = blocks.serialize([blocks.createBlock(metadata.name, { uuid: 123, title: 'Default settings' })]);
	const defaultMissing = defaultCanonical.replace(/ data-(?:initially-open|click-to-close|auto-close|scroll|scroll-offset)="[^"]*"/g, '');
	assert.equal(blocks.serialize(blocks.parse(defaultMissing)), defaultCanonical);
	for (const malformed of [
		omitted.replace('js-accordion-item', 'unexpected-class'),
		omitted.replace('id="at-1771601"', 'id="at-999"'),
		omitted.replace('role="button"', 'role="heading"'),
		omitted.replace('c-accordion__content', 'unexpected-content'),
		canonical.replace(' data-scroll="true"', ''),
	]) assert.equal(blocks.parse(malformed)[0].isValid, false);
});

test('mounted editor initializes once, preserves saved IDs and pending edits, and assigns duplicate IDs', async () => {
	const { loadSource } = require('./helpers.cjs');
	const React = require('react');
	const { createRoot } = require('react-dom/client');
	const { act } = React;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	const { normalizeDefaults } = await defaultsModule();
	let state;
	const registry = { select: () => ({ getClientIdsWithDescendants: () => state.ids.map((item) => item.clientId), getBlockName: () => 'pb/accordion-item', getBlockAttributes: (id) => state.ids.find((item) => item.clientId === id) }) };
	const nothing = () => null;
	const Edit = loadSource('src/block/edit.js', { mocks: {
		'@wordpress/data': { useRegistry: () => registry, useSelect: (callback) => callback((name) => ({
			'core/block-editor': { hasSelectedInnerBlock: () => false, getSelectedBlock: () => null, getClientIdsWithDescendants: () => state.ids.map((x) => x.clientId), getBlockName: () => 'pb/accordion-item', getBlockAttributes: (id) => state.ids.find((x) => x.clientId === id), getBlockParentsByBlockName: () => [] },
			'core/editor': { getCurrentPostId: () => 42 },
			core: { canUser: () => false },
			'accordion-blocks': { getDefaultSettings: () => state.defaults, hasFinishedResolution: () => state.resolved },
		}[name])), dispatch: () => ({}) },
		'@wordpress/compose': { useInstanceId: () => 7 },
		'@wordpress/block-editor': { BlockControls: nothing, InspectorControls: nothing, RichText: nothing, useBlockProps: () => ({}), useInnerBlocksProps: () => ({}) },
		'@wordpress/components': new Proxy({}, { get: () => nothing }),
		'@wordpress/core-data': {},
	} }).default;
	async function scenario(attributes, check, ids = []) {
		state = { attributes: { ...normalizeDefaults(), titleTag: 'h2', ...attributes }, defaults: normalizeDefaults({ initiallyOpen: true }), resolved: false, ids };
		const container = document.createElement('div');
		const root = createRoot(container);
		const writes = [];
		const render = () => act(async () => root.render(React.createElement(Edit, { clientId: 'this', attributes: state.attributes, setAttributes: (patch) => { writes.push(patch); state.attributes = { ...state.attributes, ...patch }; } })));
		try { await render(); await check(render, writes); } finally { await act(async () => root.unmount()); }
	}
	await scenario({ uuid: 123 }, async (render, writes) => {
		state.resolved = true; await render();
		assert.deepEqual(writes, []);
		assert.equal(state.attributes.uuid, 123);
	});
	await scenario({}, async (render) => {
		assert.equal(state.attributes.uuid, 427);
		state.resolved = true; await render();
		assert.equal(state.attributes.initiallyOpen, true);
		state.attributes = { ...state.attributes, initiallyOpen: false };
		state.defaults = normalizeDefaults({ scroll: true }); await render();
		assert.equal(state.attributes.initiallyOpen, false);
		assert.equal(state.attributes.scroll, false);
	});
	await scenario({}, async (render) => {
		state.attributes = { ...state.attributes, clickToClose: false };
		state.resolved = true; await render();
		assert.equal(state.attributes.clickToClose, false);
		assert.equal(state.attributes.initiallyOpen, false);
	});
	await scenario({ uuid: 123 }, async () => {
		assert.equal(state.attributes.uuid, 428);
	}, [{ clientId: 'original', uuid: 123 }, { clientId: 'other', uuid: 427 }, { clientId: 'this', uuid: 123 }]);
});

test('store normalizes fetched, explicitly set and saved settings at its public boundary', async () => {
	const { loadSource } = require('./helpers.cjs');
	const data = require('@wordpress/data');
	const requests = [];
	loadSource('src/store/index.js', { mocks: {
		'@wordpress/api-fetch': (request) => { requests.push(request); return Promise.resolve({ clickToClose: false, scroll: 'true' }); },
	} });
	const expected = { initiallyOpen: false, clickToClose: false, autoClose: true, scroll: false, scrollOffset: 0 };
	assert.deepEqual(await data.resolveSelect('accordion-blocks').getDefaultSettings(), expected);
	await data.dispatch('accordion-blocks').setDefaults(null);
	assert.deepEqual(data.select('accordion-blocks').getDefaultSettings(), { ...expected, clickToClose: true });
	await data.dispatch('accordion-blocks').saveDefaultSettings({ initiallyOpen: true, scrollOffset: NaN });
	assert.deepEqual(requests.find((request) => request.method === 'POST').data, { ...expected, initiallyOpen: true, clickToClose: true });
	assert.deepEqual(data.select('accordion-blocks').getDefaultSettings(), { ...expected, initiallyOpen: true, clickToClose: true });
});
