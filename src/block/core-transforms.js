import { createBlock, getBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

const requiredBlocks = ['core/accordion', 'core/accordion-item', 'core/accordion-heading', 'core/accordion-panel', 'core/group'];
const available = () => requiredBlocks.every(name => getBlockType(name));
const autoclose = attributes => attributes.autoClose !== false;
const level = attributes => /^h[1-6]$/.test(attributes.titleTag) ? Number(attributes.titleTag.slice(1)) : 2;

function convertItem(block) {
	const attributes = block.attributes;
	const hasId = Number.isFinite(attributes.uuid);
	const children = convertChildren(block.innerBlocks);
	// Core panel has no anchor support. A native group retains the old panel ID.
	const content = hasId ? [createBlock('core/group', { anchor: `ac-${attributes.uuid}` }, children)] : children;
	return createBlock('core/accordion-item', {
		openByDefault: attributes.initiallyOpen === true,
		className: (attributes.className || '').split(/\s+/).filter(name =>
			!['c-accordion__item', 'js-accordion-item', 'no-js', 'is-open'].includes(name)).join(' '),
	}, [
		createBlock('core/accordion-heading', {
			title: attributes.title ?? '', level: level(attributes),
			anchor: hasId ? `at-${attributes.uuid}` : undefined,
		}),
		createBlock('core/accordion-panel', {}, content),
	]);
}

function convertChildren(blocks) {
	const output = [];
	let group = null;
	for (const block of blocks) {
		if (!block || block.isValid === false || !Array.isArray(block.innerBlocks)) {
			throw new Error('Cannot convert invalid blocks. Recover them before conversion.');
		}
		if (block.name !== 'pb/accordion-item') {
			group = null;
			// Synced-pattern children belong to another entity, not this selection.
			output.push(block.name === 'core/block' ? block : { ...block, innerBlocks: convertChildren(block.innerBlocks) });
			continue;
		}
		const attributes = block.attributes;
		// An explicit wrapper anchor needs its own core accordion. Combining it
		// into an item would drop the anchor: core items do not support anchors.
		if (!group || attributes.anchor || group.attributes.anchor || group.attributes.autoclose !== autoclose(attributes) || group.attributes.headingLevel !== level(attributes)) {
			group = createBlock('core/accordion', {
				autoclose: autoclose(attributes), headingLevel: level(attributes),
				anchor: attributes.anchor || undefined,
			}, []);
			output.push(group);
		}
		group.innerBlocks.push(convertItem(block));
	}
	return output;
}

export function convertLegacyBlocks(blocks) {
	if (!available()) throw new Error('Core Accordion blocks are not available.');
	return convertChildren(blocks);
}

export const coreTransform = {
	type: 'block',
	isMultiBlock: true,
	blocks: ['core/accordion'],
	isMatch: (_attributes, blocks) => available() && (!blocks || blocks.every(block => block.isValid !== false)),
	transform: (attributes, innerBlocks) => {
		if (!available()) return null;
		const warning = __('Convert the selected accordions to WordPress core Accordion?\n\nTitles and body content will be kept. Scroll offsets and prevent-click-to-close settings will not carry over. Auto-close will apply within each converted group, not across the page. Styling, deep-link opening, and existing comment associations need checking afterward. Save a revision first; do not convert during an active review.\n\nCancel keeps the legacy blocks unchanged.', 'accordion-blocks');
		if (!window.confirm(warning)) return null;
		return convertLegacyBlocks(attributes.map((item, index) => ({
			name: 'pb/accordion-item', attributes: item, innerBlocks: innerBlocks[index],
		})));
	},
};
