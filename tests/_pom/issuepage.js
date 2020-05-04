/*
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

const GitHubPage = require( './githubpage' );
const Editor = require( './editor' );

class IssuePage extends GitHubPage {
	constructor( number ) {
		super( 'issues/' + number );
	}

	/**
	 * @returns {Promise<MainEditor>}
	 */
	async getNewCommentEditor() {
		return await this.getEditorByRoot( '.js-new-comment-form', NewCommentEditor );
	}

	/**
	 *
	 * @param index {Number} The comment index in the page.
	 * @return {Promise<void>}
	 */
	async editComment( index ) {
		const root = ( await this.browserPage.$$( 'form.js-comment-update' ) )[ index ];
		const editButton = await root.evaluateHandle( root =>
			root.closest( '.timeline-comment' ).querySelector( '.js-comment-edit-button' ) );
		const actionButton = await editButton.evaluateHandle( editButton =>
			editButton.closest( 'details-menu' ).previousElementSibling );

		await actionButton.click();
		await this.waitVisible( editButton );
		await editButton.click();
		await this.waitVisible( root );

		return await this.getEditorByRoot( root, CommentEditor );
	}

	/**
	 * @param index {Number} The comment index in the page.
	 * @return {Promise<String>}
	 */
	async getCommentHtml( index ) {
		return await this.browserPage.evaluate( index => {
			const element = document.querySelectorAll( '.timeline-comment.comment td.comment-body' )[ index ];
			return element.innerHTML.replace( /^\s+|\s+$/g, '' );
		}, index );
	}

	/**
	 * @return {Promise<GitHubPage>}
	 */
	async deleteIssue() {
		await this.browserPage.click( '.discussion-sidebar-item svg.octicon-trashcan' );
		await this.waitForNavigation( this.browserPage.click( 'button[name="verify_delete"]' ) );

		return await GitHubPage.getCurrentPage();
	}
}

module.exports = IssuePage;

GitHubPage.addUrlResolver( url => {
	const [ , number ] = url.match( /\/issues\/(\d+)$/ ) || [];

	if ( number ) {
		return new IssuePage( number );
	}
} );

class NewCommentEditor extends Editor {
	/**
	 * @return {Promise<IssuePage>}
	 */
	async submit() {
		// Get the current number of comments.
		const commentsCount = await this.page.browserPage.evaluate( () => {
			const elements = document.querySelectorAll( '.timeline-comment.comment td.comment-body' );
			return elements.length;
		} );

		await super.submit();

		// Wait for the count of comments to increase.
		await this.page.browserPage.waitForFunction( function( expectedCount ) {
			const elements = document.querySelectorAll( '.timeline-comment.comment td.comment-body' );
			return elements.length === expectedCount;
		}, {}, commentsCount + 1 );

		return this.page;
	}
}

class CommentEditor extends Editor {
	/**
	 * @return {Promise<IssuePage>}
	 */
	async submit() {
		await super.submit();

		// Wait for the count of comments to increase.
		await this.page.browserPage.waitForFunction( function( id ) {
			const commentBody = document
				// Editor root.
				.querySelector( `[data-github-writer-id="${ id }"]` )
				// Common ancestor.
				.closest( '.timeline-comment.comment' )
				// Comment body.
				.querySelector( 'td.comment-body' );

			// Check if the comment body is already visible.
			return ( commentBody.offsetParent !== null );
		}, {}, this.id );

		return this.page;
	}
}
