/*
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

const NewIssuePage = require( '../_pom/newissuepage' );
const IssuePage = require( '../_pom/issuepage' );
const { expect } = require( 'chai' );

describe( 'Issue', function() {
	this.timeout( 0 );
	let page;

	after( 'should delete the issue', async () => {
		if ( page instanceof IssuePage ) {
			await page.deleteIssue();
		}
	} );

	it( 'should create a new issue', async () => {
		page = await NewIssuePage.getPage();

		const timestamp = ( new Date() ).toISOString();

		const title = `Testing (${ timestamp })`;
		await page.setTitle( title );

		const editor = await page.getMainEditor();
		await editor.type( 'Typing inside [Ctrl+B]GitHub Writer[Ctrl+B].[Enter]' );
		await editor.type( `Time stamp: ${ timestamp }.` );

		page = await editor.submit();
	} );

	it( 'should create a new comment', async () => {
		expect( page ).to.be.an.instanceOf( IssuePage );

		const timestamp = ( new Date() ).toISOString();

		const editor = await page.getNewCommentEditor();
		await editor.type( 'Commenting with [Ctrl+B]GitHub Writer[Ctrl+B].[Enter]' );
		await editor.type( `Time stamp: ${ timestamp }.` );

		await editor.submit();

		expect( await page.getCommentHtml( 1 ) ).to.equals(
			'<p>Commenting with <strong>GitHub Writer</strong>.</p>\n' +
			`<p>Time stamp: ${ timestamp }.</p>` );
	} );

	it( 'should edit the created comment', async () => {
		expect( page ).to.be.an.instanceOf( IssuePage );

		const timestamp = ( new Date() ).toISOString();

		const editor = await page.editComment( 1 );
		await editor.type( '[Ctrl+A][Delete]' );
		await editor.type( 'Editing with [Ctrl+B]GitHub Writer[Ctrl+B].[Enter]' );
		await editor.type( `Time stamp: ${ timestamp }.` );

		await editor.submit();

		expect( await page.getCommentHtml( 1 ) ).to.equals(
			'<p>Editing with <strong>GitHub Writer</strong>.</p>\n' +
			`<p>Time stamp: ${ timestamp }.</p>` );
	} );
} );
