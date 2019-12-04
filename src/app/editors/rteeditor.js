/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import App from '../app';
import DecoupledEditor from '@ckeditor/ckeditor5-editor-decoupled/src/decouplededitor';
import GFMDataProcessor from '@ckeditor/ckeditor5-markdown-gfm/src/gfmdataprocessor';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import getRteEditorConfig from './rteeditorconfig';
import { createElementFromHtml } from '../util';

// Inject the our very own CKEditor theme overrides.
import '../theme/githubrte.css';

export default class RteEditor {
	constructor( githubEditor ) {
		this.githubEditor = githubEditor;
	}

	getData() {
		if ( this.ckeditor ) {
			return this.ckeditor.getData();
		}

		return this.githubEditor.markdownEditor.getData();
	}

	setData( data ) {
		if ( this.ckeditor ) {
			this.ckeditor.setData( data );
		}
	}

	focus() {
		this.ckeditor.editing.view.focus();
	}

	create() {
		if ( this.ckeditor ) {
			return Promise.reject( new Error( 'RteEditor.prototype.create() can be called just once.' ) );
		}

		const markdownEditor = this.githubEditor.markdownEditor;

		// Get the Markdown editor data at the exact moment of this editor creation.
		const data = markdownEditor.getData();

		return CKEditorGitHubEditor.create( data, getRteEditorConfig( this ) )
			.then( editor => {
				this.injectToolbar( editor.ui.view.toolbar.element );

				// Inject the editable in the DOM within the appropriate DOM structure around it.
				{
					// Here we mimic part of the GH dom, especially because of the classes.
					const tree = createElementFromHtml( this.getEditableParentTree() );

					// Inject the editor tree.
					tree.querySelector( '.github-rte-ckeditor' ).append( editor.ui.getEditableElement() );

					if ( markdownEditor.isEdit ) {
						// On edit, the GH dom is totally different. Add the editor after the preview panel.
						markdownEditor.dom.panels.preview.insertAdjacentElement( 'afterend', tree );
					} else {
						// Add the editor after the actual GH panels container, to avoid the GH panels show/hide logic to touch it.
						markdownEditor.dom.panelsContainer.insertAdjacentElement( 'afterend', tree );
					}
				}

				// Post-fix to enable the GH tooltip on the toolbar. (Items are already rendered)
				toolbarItemsPostfix( editor.ui.view.toolbar );

				// Expose the main objects of the API, for cross logic.
				editor.githubEditor = this.githubEditor;
				this.ckeditor = editor;

				// TODO: check if possible to fire Editor('ready') when everything is really ready.
				editor.fire( 'reallyReady' );
			} );
	}

	injectToolbar( toolbarElement ) {
		// Inject the rte toolbar right next to the markdown editor toolbar.
		this.githubEditor.markdownEditor.dom.toolbar.insertAdjacentElement( 'afterend', toolbarElement );
	}

	getEditableParentTree() {
		return `
			<div class="github-rte-panel-rte write-content mx-0 mt-2 mb-2 mx-md-2">
				<div class="github-rte-ckeditor upload-enabled form-control input-contrast
					comment-form-textarea comment-body markdown-body"></div>
			</div>
		`;
	}
}

// TODO: Check if there is a better way to set the data processor without having to override DecoupledEditor.
class CKEditorGitHubEditor extends DecoupledEditor {
	constructor( initialData, config ) {
		super( initialData, config );

		this.data.processor = new GFMDataProcessor();

		this.ui.view.toolbar.extendTemplate( {
			attributes: {
				class: 'github-rte-toolbar'
			}
		} );

		{
			const document = this.model.document;
			this.listenTo( document, 'change:data', () => {
				this.set( 'isEmpty', !document.model.hasContent( document.getRoot() ) );
			} );
		}
	}
}

// Used by the Kebab plugin as well.
export function toolbarItemsPostfix( toolbar, tooltipPosition ) {
	// Postfix is possible only in pages type "comments" (not "wiki").
	if ( App.pageManager.type !== 'comments' ) {
		return;
	}

	// Get the original labels used in GH.
	const labels = {
		'Bold': document.querySelector( 'md-bold' ).getAttribute( 'aria-label' ),
		'Italic': document.querySelector( 'md-italic' ).getAttribute( 'aria-label' ),
		'Block quote': document.querySelector( 'md-quote' ).getAttribute( 'aria-label' ),
		'Code': document.querySelector( 'md-code' ).getAttribute( 'aria-label' ),
		'Link': document.querySelector( 'md-link' ).getAttribute( 'aria-label' ),
		'Bulleted List': document.querySelector( 'md-unordered-list' ).getAttribute( 'aria-label' ),
		'Numbered List': document.querySelector( 'md-ordered-list' ).getAttribute( 'aria-label' ),
		'To-do List': document.querySelector( 'md-task-list' ).getAttribute( 'aria-label' ),
		'Strikethrough': 'Add strikethrough text',
		'Horizontal line': 'Insert a horizontal line',
		'Insert image': 'Insert an image',
		'Insert table': 'Insert a table',
		'Remove Format': 'Remove text formatting'
	};

	const items = Array.from( toolbar.items );

	items.forEach( item => {
		// Some items, like Drop Downs and File Dialog, are containers for their buttons. Take the inner button then.
		if ( item.buttonView ) {
			item = item.buttonView;
		}

		if ( item instanceof ButtonView ) {
			const itemLabel = labels[ item.label ] || item.label;

			// Disable the CKEditor tooltip.
			item.set( 'tooltip', false );

			if ( item.isRendered ) {
				// Make the necessary changes for the GH tooltip to work.
				item.element.setAttribute( 'aria-label', itemLabel );
				item.set( 'class', ( ( item.class || '' ) + ' tooltipped tooltipped-' + ( tooltipPosition || 'n' ) ).trim() );
			} else {
				item.extendTemplate( {
					attributes: {
						// The GH tooltip text is taken from aria-label.
						'aria-label': itemLabel,
						'class': 'tooltipped tooltipped-' + ( tooltipPosition || 'n' )
					}
				} );
			}
		}
	} );
}
