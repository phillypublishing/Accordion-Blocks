/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useEffect, useRef } from '@wordpress/element';
import { useInstanceId } from '@wordpress/compose';
import { useSelect, useRegistry, dispatch } from '@wordpress/data';
import {
	BlockControls,
	InspectorControls,
	RichText,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import {
	PanelBody,
	Toolbar,
	ToolbarGroup,
	ToolbarButton,
	Dropdown,
	ToggleControl,
	RangeControl,
	Button,
} from '@wordpress/components';
import { useEntityProp } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import HtmlTagIcon from './html-tag-icon';
import classnames from '../utils/classnames';
import { getNewItemDefaults } from '../utils/defaults';
import { claimItemId } from '../utils/identity';

const AccordionItemEdit = ({
	className,
	attributes,
	setAttributes,
	clientId,
	isSelected,
}) => {
	const {
		title,
		initiallyOpen,
		clickToClose,
		autoClose,
		titleTag,
		scroll,
		scrollOffset,
		uuid,
	} = attributes;

	// An accordion item is considered new if it doesn't have a UUID yet
	const initialAttributes = useRef(attributes);
	const defaultsApplied = useRef(uuid !== undefined);

	const isParentOfSelectedBlock = useSelect((select) => {
		return select('core/block-editor').hasSelectedInnerBlock(clientId, true);
	});

	const isAccordionItemSelected = useSelect((select) => {
		const block = select('core/block-editor').getSelectedBlock();

		return block ? block.name === 'pb/accordion-item' : false;
	});

	const registry = useRegistry();
	const instanceId = useInstanceId(AccordionItemEdit);
	const entityId = useSelect((select) => {
		return select('core/editor') !== null
			? select('core/editor').getCurrentPostId() : 0;
	});
	const itemIds = useSelect((select) => {
		const editor = select('core/block-editor');
		return editor.getClientIdsWithDescendants()
			.filter((id) => editor.getBlockName(id) === 'pb/accordion-item')
			.map((id) => ({
				clientId: id,
				uuid: editor.getBlockAttributes(id)?.uuid,
			}));
	}, []);

	useEffect(() => {
		// Read the latest store snapshot: another item's effect may just have
		// assigned an ID since this render. Claims also reserve pending writes.
		const editor = registry.select('core/block-editor');
		const currentItems = editor.getClientIdsWithDescendants()
			.filter((id) => editor.getBlockName(id) === 'pb/accordion-item')
			.map((id) => ({ clientId: id, uuid: editor.getBlockAttributes(id)?.uuid }));
		const id = claimItemId(registry, entityId, currentItems, clientId, uuid, Number(`${ entityId }${ instanceId }`));
		if (id !== uuid) {
			setAttributes({ uuid: id });
		}
	}, [uuid, clientId, entityId, instanceId, itemIds, registry]);

	const isNestedAccordion = useSelect((select) => {
		const parentBlocks = select('core/block-editor').getBlockParentsByBlockName(clientId, 'pb/accordion-item');

		return !!parentBlocks.length;
	});

	const userCanSetDefaults = useSelect((select) => {
		/**
		 * Only Administrators and Editors may set new default settings. Only
		 * editors and above can create pages, so we use that as a proxy for
		 * editor role and above.
		 */
		return select('core').canUser('create', 'pages');
	});

	const defaults = useSelect((select) => {
		return select('accordion-blocks').getDefaultSettings();
	});

	const defaultsResolved = useSelect((select) => {
		return select('accordion-blocks').hasFinishedResolution('getDefaultSettings');
	});

	const settingsAreDefaults =
		!(defaults === undefined || defaults === null) &&
		initiallyOpen === defaults.initiallyOpen &&
		clickToClose === defaults.clickToClose &&
		autoClose === defaults.autoClose &&
		scroll === defaults.scroll &&
		scrollOffset === defaults.scrollOffset;

	useEffect(() => {
		if (defaultsApplied.current || !defaultsResolved) {
			return;
		}
		defaultsApplied.current = true;
		const settings = getNewItemDefaults(initialAttributes.current, attributes, defaults);
		if (settings) {
			setAttributes(settings);
		}
	}, [defaults, defaultsResolved, attributes]);

	const blockProps = useBlockProps({
		className: classnames(
			'c-accordion__item',
			'js-accordion-item',
		)
	});

	const innerBlocksProps = useInnerBlocksProps({
		className: 'c-accordion__content',
	});

	return (
		<Fragment>
			<BlockControls group="block">
				<ToolbarGroup
					icon={ <HtmlTagIcon tag={ titleTag } /> }
					label={ __('Change accordion title tag', 'pb') }
					controls={ [
						{
							tag: 'h1',
							label: __('Heading 1', 'accordion-blocks'),
						},
						{
							tag: 'h2',
							label: __('Heading 2', 'accordion-blocks'),
						},
						{
							tag: 'h3',
							label: __('Heading 3', 'accordion-blocks'),
						},
						{
							tag: 'h4',
							label: __('Heading 4', 'accordion-blocks'),
						},
						{
							tag: 'h5',
							label: __('Heading 5', 'accordion-blocks'),
						},
						{
							tag: 'h6',
							label: __('Heading 6', 'accordion-blocks'),
						},
						{
							tag: 'button',
							label: __('Button', 'accordion-blocks'),
						},
					].map((control) => {
						return {
							name: control.tag,
							icon: <HtmlTagIcon tag={ control.tag } />,
							title: control.label,
							isActive: titleTag === control.tag,
							onClick: () => setAttributes({'titleTag': control.tag}),
						}
					}) }
					isCollapsed={ true }
				/>
			</BlockControls>
			<InspectorControls>
				{ isNestedAccordion && (
					<div
						className="components-notice is-warning"
						style={ {
							margin: '0',
							borderTop: '1px solid #f0f0f0',
						} }
					>
						{ __('This accordion item is nested inside another accordion item. While this will work, it may not be what you intended.', 'accordion-blocks') }
					</div>
				) }
				<PanelBody title={ __('Accordion Item Settings', 'accordion-blocks') }>
					<ToggleControl
						label={ __('Open By Default', 'accordion-blocks') }
						help={ initiallyOpen ?
							__('This accordion item will be open when the page loads.', 'accordion-blocks') :
							__('This accordion item will be closed when the page loads.', 'accordion-blocks')
						}
						checked={ initiallyOpen }
						onChange={ value => setAttributes({initiallyOpen: value}) }
					/>
					<ToggleControl
						label={ __('Click to Close', 'accordion-blocks') }
						help={ clickToClose ?
							__('When open, this accordion item title can be clicked again to close it.', 'accordion-blocks') :
							__('Once opened, this accordion item cannot be closed by clicking the title.', 'accordion-blocks')
						}
						checked={ clickToClose }
						onChange={ value => setAttributes({clickToClose: value}) }
					/>
					<ToggleControl
						label={ __('Auto Close', 'accordion-blocks') }
						help={ autoClose ?
							__('This accordion item will close when opening another item.', 'accordion-blocks') :
							__('This accordion item will remain open when opening another item.', 'accordion-blocks')
						}
						checked={ autoClose }
						onChange={ value => setAttributes({autoClose: value}) }
					/>
					<ToggleControl
						label={ __('Scroll to Accordion Item', 'accordion-blocks') }
						help={ scroll ?
							__('The page will scroll to the accordion item title when it is opened.', 'accordion-blocks') :
							__('The page will not scroll when opening accordion items.', 'accordion-blocks')
						}
						checked={ scroll }
						onChange={ value => setAttributes({
							scroll: value,
							scrollOffset: 0,
						}) }
					/>
					{ !!scroll && (
						<RangeControl
							label={ __('Scroll Pixel Offset', 'accordion-blocks') }
							value={ scrollOffset }
							onChange={ value => setAttributes({scrollOffset: parseInt(value, 10) ? parseInt(value, 10) : 0}) }
							min={ 0 }
							max={ 1000 }
							help={ __('A pixel offset for the final scroll position.', 'accordion-blocks') }
						/>
					) }
					{ !settingsAreDefaults && (
						<Fragment>
							<hr/>
							{ userCanSetDefaults && (
								<Fragment>
									<Button
										isLink={ true }
										onClick={ () => {
											dispatch('accordion-blocks').saveDefaultSettings({
												initiallyOpen: initiallyOpen,
												clickToClose: clickToClose,
												autoClose: autoClose,
												scroll: scroll,
												scrollOffset: scrollOffset,
											});
										} }
									>
										{ __('Make These Settings the Defaults', 'accordion-blocks') }
									</Button>
									<p style={ {
										fontStyle: 'italic',
										marginTop: '7px',
									} }>
										{ __('Default settings only apply when creating new accordion items.', 'accordion-blocks') }
									</p>
								</Fragment>
							) }
							<p>
								<Button
									isLink={ true }
									isDestructive={ true }
									onClick={ () => {
										setAttributes({
											initiallyOpen: defaults.initiallyOpen,
											clickToClose: defaults.clickToClose,
											autoClose: defaults.autoClose,
											scroll: defaults.scroll,
											scrollOffset: defaults.scrollOffset,
										});
									} }
								>
									{ __('Reset These Settings to Defaults', 'accordion-blocks') }
								</Button>
							</p>
						</Fragment>
					) }
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<RichText
					className={ classnames('c-accordion__title', {
						'c-accordion__title--button': titleTag === 'button',
					}) }
					tagName={ titleTag === 'button' ? 'div' : titleTag }
					allowedFormats={ [
						'core/bold',
						'core/italic',
					] }
					placeholder={ __('Accordion item title…', 'accordion-blocks') }
					value={ title }
					onChange={ value => setAttributes({title: value}) }
				/>
				<div { ...innerBlocksProps } />
			</div>
		</Fragment>
	);
};

export default AccordionItemEdit;
