/*
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

const GitHubPage = require( './githubpage' );
const Editor = require( './editor' );

class NewIssuePage extends GitHubPage {
	constructor() {
		super( 'issues/new' );
	}

	/**
	 * @param title {String}
	 * @return {Promise<void>}
	 */
	async setTitle( title ) {
		const page = this.browserPage;
		await page.type( '[name="issue[title]"]', title );
	}

	/**
	 * @returns {Promise<MainEditor>}
	 */
	async getMainEditor() {
		return await this.getEditorByRoot( '#new_issue', MainEditor );
	}

	/**
	 * @returns {Promise<NewIssuePage>}
	 */
	static async getPage() {
		return GitHubPage.getPage.call( this );
	}
}

module.exports = NewIssuePage;

class MainEditor extends Editor {
	async submit() {
		await this.page.waitForNavigation( super.submit() );
		return await GitHubPage.getCurrentPage();
	}
}
