const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource, registerCore } = require('./helpers.cjs');
registerCore();
const wp = require('@wordpress/blocks');
const metadata = require('../block.json');
wp.registerBlockType(metadata, { save: () => null, transforms: loadSource('src/block/transforms.js').default });
const { convertLegacyBlocks, coreTransform } = loadSource('src/block/core-transforms.js');
const paragraph = text => wp.createBlock('core/paragraph', { content: text });
const legacy = (attrs = {}, children = []) => wp.createBlock('pb/accordion-item', { uuid: 1771601, title: 'A <em>rich</em> title', ...attrs }, children);
const panel = group => group.innerBlocks[0].innerBlocks[1];
const body = group => panel(group).innerBlocks[0].innerBlocks;

test('core conversion retains rich title, explicit heading level, open state, anchors and nested body', () => {
 const children = [wp.createBlock('core/group', {}, [paragraph('inside')])];
 const input = legacy({ titleTag: 'h4', initiallyOpen: true, anchor: 'custom-link', className: 'custom-style' }, children);
 const before = JSON.stringify(input);
 const [result] = convertLegacyBlocks([input]);
 assert.equal(result.name, 'core/accordion');
 assert.equal(result.attributes.anchor, 'custom-link');
 assert.equal(result.innerBlocks[0].attributes.className, 'custom-style');
 assert.equal(result.innerBlocks[0].attributes.openByDefault, true);
 const heading = result.innerBlocks[0].innerBlocks[0];
 assert.equal(String(heading.attributes.title), 'A <em>rich</em> title');
 assert.equal(heading.attributes.level, 4);
 assert.equal(heading.attributes.anchor, 'at-1771601');
 assert.equal(panel(result).innerBlocks[0].attributes.anchor, 'ac-1771601');
 assert.equal(String(body(result)[0].innerBlocks[0].attributes.content), 'inside');
 assert.equal(body(result)[0].clientId, children[0].clientId);
 assert.equal(JSON.stringify(input), before);
 const reloaded = wp.parse(wp.serialize([result]));
 const valid = blocks => blocks.every(b => b.isValid && valid(b.innerBlocks));
 assert.ok(valid(reloaded), 'converted core markup must survive save/reload');
});

test('nested conversion preserves interleaving and children inside ordinary containers', () => {
 const input = legacy({}, [paragraph('before'), legacy({ uuid: 2 }, [paragraph('nested')]), paragraph('after'), wp.createBlock('core/group', {}, [legacy({ uuid: 3 })])]);
 const [result] = convertLegacyBlocks([input]);
 const children = body(result);
 assert.deepEqual(children.map(b => b.name), ['core/paragraph', 'core/accordion', 'core/paragraph', 'core/group']);
 assert.equal(String(children[2].attributes.content), 'after');
 assert.equal(String(body(children[1])[0].attributes.content), 'nested');
 assert.equal(children[3].innerBlocks[0].name, 'core/accordion');
});

test('adjacent compatible items combine; explicit anchors and different autoclose settings remain intact', () => {
 const result = convertLegacyBlocks([legacy({uuid:1}), legacy({uuid:2}), legacy({uuid:3,anchor:'own'}), legacy({uuid:4,autoClose:false}), legacy({uuid:5,autoClose:true})]);
 assert.deepEqual(result.map(b => b.innerBlocks.length), [2,1,1,1]);
 assert.equal(result[1].attributes.anchor, 'own');
 assert.deepEqual(result.map(b => b.attributes.autoclose), [true,true,false,true]);
});

test('invalid descendants refuse conversion instead of discarding content', () => {
 const broken = paragraph('must not disappear'); broken.isValid = false;
 assert.throws(() => convertLegacyBlocks([legacy({}, [broken])]), /invalid/i);
 assert.equal(String(broken.attributes.content), 'must not disappear');
});

test('conversion previews never prompt or mutate the selection and preserve empty titles', () => {
 const input = legacy({title:''});
 const before = JSON.stringify(input);
 const old = window.confirm;
 window.confirm = () => { throw new Error('Transform previews must not open dialogs'); };
 try {
  for (let i = 0; i < 2; i++) {
   const result = wp.switchToBlockType(input, 'core/accordion');
   assert.equal(String(result[0].innerBlocks[0].innerBlocks[0].attributes.title), '');
   assert.equal(JSON.stringify(input), before);
  }
 } finally { window.confirm = old; }
});

test('conversion is unavailable when native core accordion blocks are absent', () => {
 const definition = wp.getBlockType('core/accordion'); wp.unregisterBlockType('core/accordion');
 try { assert.equal(coreTransform.isMatch(), false); assert.throws(() => convertLegacyBlocks([legacy()]), /available/i); }
 finally { wp.registerBlockType('core/accordion', definition); }
});

test('WordPress transformation API handles single and multiple selections', () => {
 const single = wp.switchToBlockType(legacy({}, [paragraph('kept')]), 'core/accordion');
 assert.equal(single[0].name, 'core/accordion');
 assert.equal(String(body(single[0])[0].attributes.content), 'kept');
 const multi = wp.switchToBlockType([legacy({uuid:8}), legacy({uuid:9})], 'core/accordion');
 assert.equal(multi[0].innerBlocks.length, 2);
});

test('WordPress refuses an invalid selected legacy root', () => {
 const input = legacy(); input.isValid = false;
 assert.equal(wp.switchToBlockType(input, 'core/accordion'), null);
});

test('mixed legacy heading levels retain their actual core editor heading tags', () => {
 const nothing = () => null;
 const Heading = loadSource('node_modules/@wordpress/block-library/src/accordion-heading/edit.jsx', { mocks: {
  '@wordpress/element': { useEffect() {} },
  '@wordpress/data': { useDispatch: () => ({ __unstableMarkNextChangeAsNotPersistent() {} }) },
  '@wordpress/block-editor': {
   useBlockProps: () => ({}), __experimentalGetSpacingClassesAndStyles: () => ({}),
   RichText: nothing, getTypographyClassesAndStyles: () => ({style:{}}), useSettings: () => [], store: {},
  },
 } }).default;
 const result = convertLegacyBlocks([legacy({uuid:1,titleTag:'h2'}), legacy({uuid:2,titleTag:'h4'}), legacy({uuid:3,titleTag:'h4'})]);
 const tags = result.flatMap(group => group.innerBlocks.map(item => {
  const heading = item.innerBlocks[0];
  return Heading({attributes:heading.attributes,setAttributes(){},context:{'core/accordion-heading-level':group.attributes.headingLevel}}).type;
 }));
 assert.deepEqual(tags, ['h2','h4','h4']);
 assert.deepEqual(result.map(group => group.innerBlocks.length), [1,2]);
});

test('synced-pattern references retain foreign content and identity unchanged', () => {
 const reference = wp.createBlock('core/block', {ref:73}, [legacy({uuid:20})]);
 const [result] = convertLegacyBlocks([legacy({}, [reference])]);
 assert.equal(body(result)[0], reference);
 assert.equal(body(result)[0].attributes.ref, 73);
 assert.equal(body(result)[0].innerBlocks[0].name, 'pb/accordion-item');
});
