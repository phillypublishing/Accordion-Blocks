const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers.cjs');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { createRegistry, RegistryProvider, useSelect } = require('@wordpress/data');
global.IS_REACT_ACT_ENVIRONMENT = true;

const nothing = () => null;
const Edit = loadSource('src/block/edit.js', { mocks: {
	'@wordpress/compose': { useInstanceId: () => 7 },
	'@wordpress/block-editor': { BlockControls: nothing, InspectorControls: nothing, RichText: nothing, useBlockProps: () => ({}), useInnerBlocksProps: () => ({}) },
	'@wordpress/components': new Proxy({}, { get: () => nothing }),
	'@wordpress/core-data': {},
} }).default;

async function editor(initial, run, { deferWrites = false } = {}) {
	const pending = [];
	const registry = createRegistry();
	registry.registerStore('core/block-editor', {
		reducer: (state = initial, action) => action.type === 'REPLACE' ? action.items : action.type === 'PATCH' ? state.map((item) => item.clientId === action.id ? { ...item, ...action.patch } : item) : state,
		actions: { replace: (items) => ({ type: 'REPLACE', items }), patch: (id, patch) => ({ type: 'PATCH', id, patch }) },
		selectors: {
			getItems: (state) => state,
			getClientIdsWithDescendants: (state) => state.map((item) => item.clientId),
			getBlockAttributes: (state, id) => state.find((item) => item.clientId === id),
			getBlockName: () => 'pb/accordion-item', hasSelectedInnerBlock: () => false,
			getSelectedBlock: () => null, getBlockParentsByBlockName: () => [],
		},
	});
	registry.registerStore('core/editor', { reducer: (state = 42, action) => action.type === 'POST' ? action.id : state, actions: { post: (id) => ({ type: 'POST', id }) }, selectors: { getCurrentPostId: (state) => state } });
	registry.registerStore('core', { reducer: () => ({}), selectors: { canUser: () => false } });
	registry.registerStore('accordion-blocks', { reducer: () => ({}), selectors: { getDefaultSettings: () => ({}), hasFinishedResolution: () => true } });
	function Canvas() {
		const items = useSelect((select) => select('core/block-editor').getItems(), []);
		return items.map((item) => React.createElement(Edit, { key: item.clientId, clientId: item.clientId, attributes: { titleTag: 'h2', ...item }, setAttributes: (patch) => {
				const write = () => registry.dispatch('core/block-editor').patch(item.clientId, patch);
				if (deferWrites) pending.push(write); else write();
			} }));
	}
	const root = createRoot(document.createElement('div'));
	const items = () => registry.select('core/block-editor').getItems();
	const replace = (next) => React.act(async () => registry.dispatch('core/block-editor').replace(next));
	try {
		await React.act(async () => root.render(React.createElement(RegistryProvider, { value: registry }, React.createElement(Canvas))));
		await run({ items, replace, registry, flush: () => React.act(async () => { pending.splice(0).forEach((write) => write()); }) });
	} finally { await React.act(async () => root.unmount()); }
}

test('paste before a mounted owner preserves its anchor through insertion and reordering', async () => {
	await editor([{ clientId: 'original', uuid: 123 }], async ({ items, replace }) => {
		await replace([{ clientId: 'paste', uuid: 123 }, ...items()]);
		assert.equal(items().find((item) => item.clientId === 'original').uuid, 123);
		const pastedId = items()[0].uuid;
		assert.notEqual(pastedId, 123);
		await replace([...items()].reverse());
		assert.equal(items()[0].uuid, 123);
		assert.equal(items()[1].uuid, pastedId);
	});
});

test('initial collisions follow document order and simultaneous allocations stay unique', async () => {
	await editor([{ clientId: 'first', uuid: 123 }, { clientId: 'second', uuid: 123 }, { clientId: 'new' }], async ({ items }) => {
		assert.equal(items()[0].uuid, 123);
		assert.equal(new Set(items().map((item) => item.uuid)).size, 3);
	});
});

test('deleted owners release their claims and post changes reset ownership', async () => {
	await editor([{ clientId: 'original', uuid: 123 }], async ({ items, replace, registry }) => {
		await replace([]);
		await replace([{ clientId: 'replacement', uuid: 123 }]);
		assert.equal(items()[0].uuid, 123);
		await React.act(async () => {
			registry.dispatch('core/editor').post(43);
			registry.dispatch('core/block-editor').replace([{ clientId: 'new-post-first', uuid: 123 }, { clientId: 'replacement', uuid: 123 }]);
		});
		assert.equal(items()[0].uuid, 123);
		assert.notEqual(items()[1].uuid, 123);
	});
});


test('pending writes reserve distinct IDs even before the store receives them', async () => {
	await editor([{ clientId: 'one' }, { clientId: 'two' }], async ({ items, flush }) => {
		assert.equal(items()[0].uuid, undefined);
		await flush();
		assert.equal(items()[0].uuid, 427);
		assert.equal(items()[1].uuid, 428);
	}, { deferWrites: true });
});

test('different editor registries do not share claims for the same post', async () => {
	await editor([{ clientId: 'old-owner', uuid: 123 }], async () => {
		await editor([{ clientId: 'first', uuid: 123 }, { clientId: 'old-owner', uuid: 123 }], async ({ items }) => {
			assert.equal(items()[0].uuid, 123);
			assert.notEqual(items()[1].uuid, 123);
		});
	});
});
