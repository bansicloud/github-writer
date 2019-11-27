/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import MarkdownEditor from './editors/markdowneditor';
import RteEditor from './editors/rteeditor';
import EmitterMixin from '@ckeditor/ckeditor5-utils/src/emittermixin';
import mix from '@ckeditor/ckeditor5-utils/src/mix';

export default class Editor {
	/**
	 * Creates a GitHub RTE editor.
	 *
	 * @param markdownEditorRootElement {HTMLElement} The element that contains the complete DOM of a single GitHub markdown
	 * editor.
	 */
	constructor( markdownEditorRootElement ) {
		// This will expose the list of editors in the extension console.
		( window.GITHUB_RTE_EDITORS = window.GITHUB_RTE_EDITORS || [] ).push( this );

		this.markdownEditor = new MarkdownEditor( markdownEditorRootElement );

		// Get the initial data loaded from GH.
		const data = this.markdownEditor.getData();

		this.rteEditor = new RteEditor( this );

		this.dom = {
			root: markdownEditorRootElement
		};

		this._setupForm();
		this._setInitialMode( data );
	}

	get mode() {
		if ( this.dom.root.classList.contains( 'github-rte-mode-rte' ) ) {
			return Editor.modes.RTE;
		} else {
			return Editor.modes.MARKDOWN;
		}
	}

	set mode( mode ) {
		this.syncEditors();

		if ( this.mode === Editor.modes.MARKDOWN && mode === Editor.modes.RTE ) {
			if ( this._checkDataLoss() ) {
				// eslint-disable-next-line no-alert
				if ( !confirm( `This markdown contains markup that may not be compatible with the rich-text editor and may be lost.\n` +
					`\n` +
					`Do you confirm you want to switch to rich-text?` ) ) {
					return;
				}
			}
		}

		// Ensure that we have the write tab active (not preview).
		this.dom.root.querySelector( '.write-tab' ).click();

		// Set the appropriate class to the root element according to the mode being set.
		this.dom.root.classList.toggle( 'github-rte-mode-rte', mode === Editor.modes.RTE );
		this.dom.root.classList.toggle( 'github-rte-mode-markdown', mode === Editor.modes.MARKDOWN );

		// This will enable the submit button.
		// TODO: check if possible to remove setTimeout (ideally a document ready event).
		setTimeout( () => {
			const textarea = this.markdownEditor.dom.textarea;
			if ( mode === Editor.modes.RTE ) {
				// A small trick to enable the submit button while the editor is visible.
				// TODO: ideally we should do this by checking if the editor contents changed.
				if ( textarea.value === textarea.defaultValue ) {
					textarea.value += '\n<!-- -->';
				}
			}
			textarea.dispatchEvent( new Event( 'change' ) );
			textarea.form.dispatchEvent( new Event( 'change' ) );
		}, 100 );

		this.fire( 'mode' );
	}

	create() {
		return this.rteEditor.create()
			.then( () => this._setupFocus() );
	}

	syncEditors() {
		if ( this.mode === Editor.modes.RTE ) {
			this.markdownEditor.setData( this.rteEditor.getData() );
		} else {
			this.rteEditor.setData( this.markdownEditor.getData() );
		}
	}

	_setupFocus() {
		// Enable editor focus when clicking the "Write" tab.
		this.dom.root.querySelector( '.write-tab' ).addEventListener( 'click', () => {
			setTimeout( () => {
				this.rteEditor.focus();
			}, 0 );
		} );

		// Enable the GitHub focus styles when the editor focus/blur.
		{
			// Take the element that GH styles on focus.
			const focusBox = this.dom.root.querySelector( '.github-rte-panel-rte' );

			// Watch for editor focus changes.
			this.rteEditor.ckeditor.ui.focusTracker.on( 'change:isFocused', ( evt, name, value ) => {
				focusBox.classList.toggle( 'focused', !!value );
			} );
		}
	}

	_setupForm() {
		const form = this.markdownEditor.dom.textarea.form;

		// Update the textarea on form post.
		form.addEventListener( 'submit', () => {
			// If in RTE, update the markdown textarea with the data to be submitted.
			if ( this.mode === Editor.modes.RTE ) {
				this.syncEditors();
			}
		} );

		form.addEventListener( 'reset', () => {
			// We actually want it 'after-reset', so form elements are clean, thus setTimeout.
			setTimeout( () => {
				this.rteEditor.setData( this.markdownEditor.dom.textarea.defaultValue );
				this._setInitialMode();
			}, 0 );
		} );
	}

	_setInitialMode() {
		// let startMode = Editor.modes.RTE;

		// Sniff the start mode of the editor. Stays on markdown if the user posted at markdown.
		// if ( ( new RegExp( markdownModeTag ) ).test( data ) ) {
		// 	startMode = Editor.modes.MARKDOWN;
		// 	data = data.replace( new RegExp( '\\n{0,2}' + markdownModeTag, 'g' ), '' );
		//
		// 	// Remove the tag from the textarea, like it never existed.
		// 	this.rteEditor.setData( data, true );
		// }

		this.mode = Editor.modes.RTE;
	}

	/**
	 * Checks if the current data loaded in CKEditor is different (semantically) from the markdown available in the GH textarea.
	 * @private
	 */
	_checkDataLoss() {
		const rteData = this.rteEditor.getData();
		const markdownData = this.markdownEditor.getData();

		return stripSpaces( rteData ) !== stripSpaces( markdownData );

		function stripSpaces( text ) {
			return text.replace( /\s/g, '' );
		}
	}
}

mix( Editor, EmitterMixin );

Editor.modes = {
	RTE: 'rte',
	MARKDOWN: 'markdown'
};
