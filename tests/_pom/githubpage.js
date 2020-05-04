/*
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

const GitHubBrowser = require( './githubbrowser' );
const Editor = require( './editor' );

const { repo, credentials } = require( '../config.json' ).github;

const htmlToJson = require( 'html-to-json' );

const urlResolvers = [];

class GitHubPage {
	/**
	 * @param path {String}
	 */
	constructor( path ) {
		this.url = GitHubPage.getGitHubUrl( path );
		this.needsLogin = true;
	}

	/**
	 * @returns {Promise<void>}
	 */
	async goto() {
		const browserPage = this.browserPage = await GitHubBrowser.getPage();

		if ( this.needsLogin ) {
			const loggedIn = browserPage.url().match( /^https:\/\/github.com\// ) &&
				!!( await browserPage.$( `meta[name="user-login"][content="${ credentials.name }"]` ) );

			if ( !loggedIn ) {
				const LoginPage = require( './loginpage' );
				const loginPage = await LoginPage.getPage();
				await loginPage.login();
			}
		}

		await browserPage.goto( this.url );
	}

	/**
	 * @param id {String}
	 * @returns {Editor}
	 */
	async getEditorById( id ) {
		return new Editor( this, id );
	}

	/**
	 * @param selector {String|ElementHandle}
	 * @param EditorClass {Function}
	 * @returns {Editor}
	 */
	async getEditorByRoot( selector, EditorClass = Editor ) {
		const root = ( typeof selector === 'string' ) ? await this.browserPage.$( selector ) : selector;

		if ( !root ) {
			throw new Error( `No root element found for the selector \`${ selector }\`.` );
		}

		const id = await root.evaluate( root => root.getAttribute( 'data-github-writer-id' ) );

		if ( !id ) {
			throw new Error( `No editor found for the root \`${ selector }\`.` );
		}

		return new EditorClass( this, id );
	}

	async waitForNavigation( ...otherPromises ) {
		const [ response ] = await Promise.all( [
			this.browserPage.waitForNavigation(),
			...otherPromises
		] );

		if ( response && !response.ok() ) {
			return Promise.reject( new Error( `Server response error: (${ response.status() }) ${ response.statusText() }` ) );
		}
	}

	/**
	 * @param selector {String}
	 * @returns {Promise<Boolean>}
	 */
	async hasElement( selector ) {
		return !!( await this.browserPage.$( selector ) );
	}

	/**
	 * @param element {ElementHandle}
	 * @return {Promise<void>}
	 */
	async waitVisible( element ) {
		await this.browserPage.waitForFunction( element => {
			return ( element.offsetParent !== null );
		}, {}, element );
	}

	/**
	 * @returns {Promise<Array>}
	 */
	async getEmojis() {
		const url = await this.browserPage.$eval( 'text-expander[data-emoji-url]', el => el.getAttribute( 'data-emoji-url' ) );
		const html = await this.xhrRequest( url );

		const emojis = await htmlToJson.parse( html, [ 'li', li => {
			// Take the first element child (either <g-emoji> or <img>).
			const child = li.find( '*' );

			const name = li.attr( 'data-emoji-name' );
			const aka = li.attr( 'data-text' ).replace( name, '' ).trim();
			const url = child.attr( 'fallback-src' ) || child.attr( 'src' );
			const unicode = child.text();

			const emoji = { name, url };

			if ( aka ) {
				emoji.aka = aka;
			}

			if ( unicode ) {
				emoji.unicode = unicode;
			}

			return emoji;
		} ] );

		// Sort it alphabetically, just like GH does.
		return emojis.sort( ( a, b ) => {
			if ( a.name > b.name ) {
				return 1;
			}
			if ( a.name < b.name ) {
				return -1;
			}
			return 0;
		} );
	}

	/**
	 * @param url {String}
	 * @param [json=false] {Boolean}
	 * @returns {Promise<String|*>}
	 */
	xhrRequest( url, json = false ) {
		return this.browserPage.evaluate( ( url, json ) => {
			return new Promise( ( resolve, reject ) => {
				const xhr = new XMLHttpRequest();
				xhr.open( 'GET', url, true );

				// Some of the requests don't work without this one.
				xhr.setRequestHeader( 'X-Requested-With', 'XMLHttpRequest' );

				if ( json ) {
					xhr.responseType = 'json';
					xhr.setRequestHeader( 'Accept', 'application/json' );
				}

				xhr.addEventListener( 'error', () => reject( new Error( `Error loading $(url).` ) ) );
				xhr.addEventListener( 'abort', () => reject() );
				xhr.addEventListener( 'load', () => {
					resolve( xhr.response );
				} );

				xhr.send();
			} );
		}, url, json );
	}

	/**
	 * @returns {Promise<GitHubPage>}
	 */
	static async getPage() {
		const page = new this();
		await page.goto();
		return page;
	}

	/**
	 * @return {Promise<GitHubPage>}
	 */
	static async getCurrentPage() {
		const browserPage = await GitHubBrowser.getPage();
		const url = await browserPage.url();
		let page;

		for ( let i = 0; i < urlResolvers.length; i++ ) {
			page = urlResolvers[ i ]( url );

			if ( page ) {
				break;
			}
		}

		if ( !page ) {
			page = new GitHubPage( url );
		}

		page.browserPage = browserPage;

		return page;
	}

	/**
	 * @param callback {Function}
	 */
	static addUrlResolver( callback ) {
		urlResolvers.push( callback );
	}

	/**
	 * @param path {String}
	 * @returns {String}
	 */
	static getGitHubUrl( path ) {
		let url = path;
		if ( path.startsWith( '/' ) ) {
			url = `https://github.com${ path }`;
		} else if ( !/^https?:/.test( path ) ) {
			return `https://github.com/${ repo }/${ path }`;
		}

		return url.replace( /\/+$/, '' );
	}
}

module.exports = GitHubPage;
