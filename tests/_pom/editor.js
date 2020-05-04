/*
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

let messageCount = 0;

class Editor {
	/**
	 * @param page {GitHubPage}
	 * @param id {String}
	 */
	constructor( page, id ) {
		this.page = page;
		this.id = id;
	}

	/**
	 * @return {Promise<?ElementHandle>}
	 */
	async getEditable() {
		if ( !this._editable ) {
			const selector = `[data-github-writer-id="${ this.id }"] .ck-editor__editable`;
			const editable = this._editable = await this.page.browserPage.$( selector );

			if ( !editable ) {
				throw new Error( `Editor id "${ this.id }" was not found` );
			}
		}

		return this._editable;
	}

	/**
	 * @param text {String}
	 */
	async type( text ) {
		const editable = await this.getEditable();

		const parts = text.split( /(\[[^\]]+\])/g );

		for ( let i = 0; i < parts.length; i++ ) {
			const part = parts[ i ];
			if ( part ) {
				const isKeystroke = /^\[[^\]]+\]$/.test( part );
				if ( isKeystroke ) {
					let [ , modifiers, key ] = part.match( /^\[(?:(.+)\+)?([^+\]]+)\]$/ );
					modifiers = modifiers ? modifiers.split( '+' ) : [];

					modifiers = modifiers.map( key => key
						.replace( /Shift/i, 'Shift' )
						.replace( /Alt/i, 'Alt' )
						.replace( /Ctrl/i, 'Control' )
						.replace( /CtrlCmd/i, 'Meta' )
					);

					for ( let i = 0; i < modifiers.length; i++ ) {
						this.page.browserPage.keyboard.down( modifiers[ i ] );
					}

					await editable.press( key );

					for ( let i = 0; i < modifiers.length; i++ ) {
						this.page.browserPage.keyboard.up( modifiers[ i ] );
					}
				} else {
					await editable.type( part );
				}
			}
		}
	}

	/**
	 * @return {Promise<void>}
	 */
	async submit() {
		const selector = `[data-github-writer-id="${ this.id }"] .btn-primary`;
		await this.page.browserPage.click( selector );
		return this.page;
	}

	/**
	 * @return {Promise<String>}
	 */
	async getData() {
		return await this.exec( 'getData' );
	}

	/**
	 * @param command {String}
	 * @param args {...*}
	 * @return {Promise<*>}
	 */
	async exec( command, ...args ) {
		const thisRequestId = 'gw-tests-' + ( ++messageCount );

		return await this.page.browserPage.evaluate( function( thisRequestId, editorId, command, args ) {
			const promise = new Promise( ( resolve, reject ) => {
				const timeout = setTimeout( () => {
					window.removeEventListener( 'message', messageListener );
					reject( new Error( 'Editor.exec(): no response (timeout).' ) );
				}, 1000 );

				window.addEventListener( 'message', messageListener, { passive: true } );

				function messageListener( event ) {
					const { type, requestId, status, returnValue } = event.data;

					if ( type === 'CKEditor-Messenger-Response' && requestId === thisRequestId ) {
						clearTimeout( timeout );
						window.removeEventListener( 'message', messageListener );

						if ( status === 'ok' ) {
							resolve( returnValue );
						} else {
							reject( new Error( `Editor.exec(): request error (${ status }).` ) );
						}
					}
				}
			} );

			window.postMessage( {
				type: 'CKEditor-Messenger-Request',
				requestId: thisRequestId,
				editorId,
				command,
				args
			}, '*' );

			return promise;
		}, thisRequestId, this.id, command, args );
	}
}

module.exports = Editor;
