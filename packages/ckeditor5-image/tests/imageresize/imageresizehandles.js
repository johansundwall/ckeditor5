/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global document */

// ClassicTestEditor can't be used, as it doesn't handle the focus, which is needed to test resizer visual cues.
import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';

import Image from '../../src/image';
import ImageStyle from '../../src/imagestyle';
import ImageToolbar from '../../src/imagetoolbar';
import ImageResizeEditing from '../../src/imageresize/imageresizeediting';
import ImageResizeHandles from '../../src/imageresize/imageresizehandles';
import ImageTextAlternative from '../../src/imagetextalternative';

import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import Undo from '@ckeditor/ckeditor5-undo/src/undo';
import Table from '@ckeditor/ckeditor5-table/src/table';
import HtmlEmbedEditing from '@ckeditor/ckeditor5-html-embed/src/htmlembedediting';
import LinkImageEditing from '@ckeditor/ckeditor5-link/src/linkimageediting';

import Rect from '@ckeditor/ckeditor5-utils/src/dom/rect';
import { setData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import {
	focusEditor,
	resizerMouseSimulator,
	getWidgetDomParts,
	getHandleCenterPoint
} from '@ckeditor/ckeditor5-widget/tests/widgetresize/_utils/utils';

import WidgetResize from '@ckeditor/ckeditor5-widget/src/widgetresize';
import { IMAGE_SRC_FIXTURE, waitForAllImagesLoaded } from './_utils/utils';

describe( 'ImageResizeHandles', () => {
	let widget, editor, view, viewDocument, editorElement;

	beforeEach( () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );
	} );

	afterEach( async () => {
		editorElement.remove();

		if ( editor ) {
			await editor.destroy();
		}
	} );

	it( 'should be named', () => {
		expect( ImageResizeHandles.pluginName ).to.equal( 'ImageResizeHandles' );
	} );

	it( 'uses percents by default', async () => {
		const localEditor = await createEditor( {
			plugins: [ Image, ImageResizeEditing, ImageResizeHandles ]
		} );

		const attachToSpy = sinon.spy( localEditor.plugins.get( WidgetResize ), 'attachTo' );

		await setModelAndWaitForImages( localEditor, `[<image imageStyle="side" src="${ IMAGE_SRC_FIXTURE }"></image>]` );

		expect( attachToSpy.args[ 0 ][ 0 ] ).to.have.a.property( 'unit', '%' );

		attachToSpy.restore();

		await localEditor.destroy();
	} );

	describe( 'command', () => {
		beforeEach( async () => {
			editor = await createEditor();
		} );

		it( 'uses the command on commit', async () => {
			const spy = sinon.spy( editor.commands.get( 'imageResize' ), 'execute' );

			await setModelAndWaitForImages( editor, `<paragraph>foo</paragraph>[<image src="${ IMAGE_SRC_FIXTURE }"></image>]` );
			widget = viewDocument.getRoot().getChild( 1 );
			const domParts = getWidgetDomParts( editor, widget, 'bottom-left' );

			const finalPointerPosition = getHandleCenterPoint( domParts.widget, 'bottom-left' ).moveBy( 10, -10 );

			resizerMouseSimulator.dragTo( editor, domParts.resizeHandle, finalPointerPosition );

			expect( spy.calledOnce ).to.be.true;
			expect( spy.args[ 0 ][ 0 ] ).to.deep.equal( { width: '80px' } );
		} );

		it( 'disables the resizer if the command is disabled', async () => {
			await setModelAndWaitForImages( editor, `<paragraph>foo</paragraph>[<image src="${ IMAGE_SRC_FIXTURE }"></image>]` );

			const resizer = getSelectedImageResizer( editor );

			let isEnabled = false;

			editor.commands.get( 'imageResize' ).on( 'set:isEnabled', evt => {
				evt.return = isEnabled;
				evt.stop();
			}, { priority: 'highest' } );

			editor.commands.get( 'imageResize' ).refresh();
			expect( resizer.isEnabled ).to.be.false;

			isEnabled = true;
			editor.commands.get( 'imageResize' ).refresh();
			expect( resizer.isEnabled ).to.be.true;
		} );

		it( 'the resizer is disabled from the beginning when the command is disabled when the image is inserted', async () => {
			setData( editor.model, '<paragraph>foo[]</paragraph>' );

			editor.commands.get( 'imageResize' ).on( 'set:isEnabled', evt => {
				evt.return = false;
				evt.stop();
			}, { priority: 'highest' } );
			editor.commands.get( 'imageResize' ).refresh();

			editor.model.change( writer => {
				editor.model.insertContent( writer.createElement( 'image', { src: IMAGE_SRC_FIXTURE } ) );
			} );

			await waitForAllImagesLoaded( editor );

			const resizer = getSelectedImageResizer( editor );
			const resizerWrapper = editor.ui.getEditableElement().querySelector( '.ck-widget__resizer' );

			expect( resizer.isEnabled ).to.be.false;
			expect( resizerWrapper.style.display ).to.equal( 'none' );
		} );
	} );

	describe( 'side image resizing', () => {
		beforeEach( async () => {
			editor = await createEditor();

			await setModelAndWaitForImages( editor,
				`<paragraph>foo</paragraph>[<image imageStyle="side" src="${ IMAGE_SRC_FIXTURE }"></image>]` );

			widget = viewDocument.getRoot().getChild( 1 );
		} );

		it( 'doesn\'t flicker at the beginning of the resize', async () => {
			// (#5189)
			const resizerPosition = 'bottom-left';
			const domParts = getWidgetDomParts( editor, widget, resizerPosition );
			const initialPointerPosition = getHandleCenterPoint( domParts.widget, resizerPosition );
			const resizeWrapperView = widget.getChild( 2 );

			resizerMouseSimulator.down( editor, domParts.resizeHandle );

			resizerMouseSimulator.move( editor, domParts.resizeHandle, null, initialPointerPosition );

			expect( resizeWrapperView.getStyle( 'width' ) ).to.equal( '100px' );

			resizerMouseSimulator.up( editor );
		} );

		it( 'makes no change when clicking the handle without drag', () => {
			const resizerPosition = 'bottom-left';
			const expectedWidth = 100;
			const domParts = getWidgetDomParts( editor, widget, resizerPosition );

			resizerMouseSimulator.down( editor, domParts.resizeHandle );

			expect( getDomWidth( domParts.widget ), 'DOM width check' ).to.be.closeTo( expectedWidth, 2 );

			resizerMouseSimulator.up( editor );

			const modelItem = editor.model.document.getRoot().getChild( 1 );

			expect( modelItem.getAttribute( 'width' ), 'model width attribute' ).to.be.undefined;
		} );
	} );

	describe( 'undo integration', () => {
		beforeEach( async () => {
			editor = await createEditor();

			await setModelAndWaitForImages( editor, `<paragraph>foo</paragraph>[<image src="${ IMAGE_SRC_FIXTURE }"></image>]` );

			widget = viewDocument.getRoot().getChild( 1 );
		} );

		it( 'has correct border size after undo', async () => {
			const domParts = getWidgetDomParts( editor, widget, 'bottom-left' );
			const initialPosition = getHandleCenterPoint( domParts.widget, 'bottom-left' );
			const finalPointerPosition = initialPosition.clone().moveBy( 0, 10 );
			const plugin = editor.plugins.get( 'WidgetResize' );

			resizerMouseSimulator.dragTo( editor, domParts.resizeHandle, {
				from: initialPosition,
				to: finalPointerPosition
			} );

			expect( domParts.widget.style.width ).to.equal( '120px' );

			editor.commands.get( 'undo' ).execute();

			// Toggle _visibleResizer to force synchronous redraw. Otherwise you'd need to wait ~200ms for
			// throttled redraw to take place, making tests slower.
			for ( const [ , resizer ] of plugin._resizers.entries() ) {
				resizer.redraw();
			}

			const resizerWrapper = document.querySelector( '.ck-widget__resizer' );
			const shadowBoundingRect = resizerWrapper.getBoundingClientRect();

			expect( shadowBoundingRect.width ).to.equal( 100 );
			expect( shadowBoundingRect.height ).to.equal( 50 );
		} );

		it( 'doesn\'t show resizers when undoing to multiple images', async () => {
			// Based on https://github.com/ckeditor/ckeditor5/pull/8108#issuecomment-695949745.
			await setModelAndWaitForImages( editor,
				`[<image src="${ IMAGE_SRC_FIXTURE }"></image><image src="${ IMAGE_SRC_FIXTURE }"></image>]` );

			const paragraph = editor.model.change( writer => {
				return writer.createElement( 'paragraph' );
			} );
			editor.model.insertContent( paragraph );

			// Undo to go back to two, selected images.
			editor.commands.get( 'undo' ).execute();

			for ( let i = 0; i < 2; i++ ) {
				widget = viewDocument.getRoot().getChild( i );
				const domImage = getWidgetDomParts( editor, widget, 'bottom-right' ).widget.querySelector( 'img' );
				viewDocument.fire( 'imageLoaded', { target: domImage } );

				const domResizeWrapper = getWidgetDomParts( editor, widget, 'bottom-left' ).resizeWrapper;

				expect( domResizeWrapper.getBoundingClientRect().height ).to.equal( 0 );
			}
		} );
	} );

	describe( 'table integration', () => {
		it( 'works when resizing in a table', async () => {
			editor = await createEditor();

			await setModelAndWaitForImages( editor,
				'<table>' +
					`<tableRow><tableCell>[<image src="${ IMAGE_SRC_FIXTURE }"></image>]</tableCell></tableRow>` +
				'</table>'
			);

			widget = viewDocument.getRoot().getChild( 0 ).getChild( 1 ).getChild( 0 ).getChild( 0 ).getChild( 0 ).getChild( 0 );
			const model = editor.model.document.getRoot().getChild( 0 ).getChild( 0 ).getChild( 0 ).getChild( 0 );

			const domParts = getWidgetDomParts( editor, widget, 'bottom-right' );
			const initialPosition = getHandleCenterPoint( domParts.widget, 'bottom-right' );
			const finalPointerPosition = initialPosition.clone().moveBy( -40, -20 );

			resizerMouseSimulator.dragTo( editor, domParts.resizeHandle, {
				from: initialPosition,
				to: finalPointerPosition
			} );

			expect( model.getAttribute( 'width' ) ).to.equal( '60px' );
		} );
	} );

	it( 'doesn\'t create multiple resizers for a single image widget', async () => {
		// https://github.com/ckeditor/ckeditor5/pull/8108#issuecomment-708302992
		editor = await createEditor();
		await setModelAndWaitForImages( editor, `[<image src="${ IMAGE_SRC_FIXTURE }"></image>]` );
		widget = viewDocument.getRoot().getChild( 0 );

		const domParts = getWidgetDomParts( editor, widget, 'bottom-right' );
		const alternativeImageFixture =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

		// Change the image so that load event triggers for the same img element again.
		domParts.widget.querySelector( 'img' ).src = alternativeImageFixture;
		await waitForAllImagesLoaded( editor );

		expect( domParts.widget.querySelectorAll( '.ck-widget__resizer' ).length ).to.equal( 1 );
	} );

	it( 'only creates a resizer after the image is loaded', async () => {
		// https://github.com/ckeditor/ckeditor5/issues/8088
		editor = await createEditor();
		setData( editor.model, `[<image src="${ IMAGE_SRC_FIXTURE }"></image>]` );
		widget = viewDocument.getRoot().getChild( 0 );
		const domParts = getWidgetDomParts( editor, widget, 'bottom-right' );

		expect( domParts.widget.querySelectorAll( '.ck-widget__resizer' ).length ).to.equal( 0 );

		await waitForAllImagesLoaded( editor );
		expect( domParts.widget.querySelectorAll( '.ck-widget__resizer' ).length ).to.equal( 1 );
	} );

	describe( 'srcset integration', () => {
		// The image is 96x96 pixels.
		const imageBaseUrl = '/assets/sample.png';
		let model;
		let images = [];

		before( async () => {
			images = await Promise.all( [
				preloadImage( imageBaseUrl ),
				preloadImage( imageBaseUrl + '?a' ),
				preloadImage( imageBaseUrl + '?b' ),
				preloadImage( imageBaseUrl + '?c' )
			] );
		} );

		after( () => {
			for ( const image of images ) {
				image.remove();
			}
		} );

		beforeEach( async () => {
			editor = await createEditor();

			editor.setData(
				`<figure class="image">
					<img src="${ imageBaseUrl }"
						srcset="${ imageBaseUrl }?a 110w,
							${ imageBaseUrl }?b 440w,
							${ imageBaseUrl }?c 1025w"
						sizes="100vw" width="96">
				</figure>`
			);

			await waitForAllImagesLoaded( editor );

			widget = viewDocument.getRoot().getChild( 0 );
			model = editor.model.document.getRoot().getChild( 0 );
		} );

		it( 'works with images containing srcset', async () => {
			const domParts = getWidgetDomParts( editor, widget, 'bottom-right' );
			const initialPosition = getHandleCenterPoint( domParts.widget, 'bottom-right' );
			const finalPointerPosition = initialPosition.clone().moveBy( -20, -20 );

			resizerMouseSimulator.dragTo( editor, domParts.resizeHandle, {
				from: initialPosition,
				to: finalPointerPosition
			} );

			expect( model.getAttribute( 'width' ) ).to.equal( '76px' );
		} );

		it( 'retains width after removing srcset', async () => {
			const domParts = getWidgetDomParts( editor, widget, 'bottom-right' );
			const initialPosition = getHandleCenterPoint( domParts.widget, 'bottom-right' );
			const finalPointerPosition = initialPosition.clone().moveBy( -16, -16 );

			resizerMouseSimulator.dragTo( editor, domParts.resizeHandle, {
				from: initialPosition,
				to: finalPointerPosition
			} );

			editor.model.change( writer => {
				writer.removeAttribute( 'srcset', model );
			} );

			const expectedHtml = '<figure class="image image_resized" style="width:80px;"><img src="/assets/sample.png"></figure>';
			expect( editor.getData() ).to.equal( expectedHtml );
		} );

		async function preloadImage( imageUrl ) {
			const image = document.createElement( 'img' );

			image.src = imageUrl;

			return new Promise( ( resolve, reject ) => {
				image.addEventListener( 'load', () => resolve( image ) );
				image.addEventListener( 'error', () => reject( image ) );
				document.body.appendChild( image );
			} );
		}
	} );

	describe( 'widget toolbar integration', () => {
		let widgetToolbarRepository;

		beforeEach( async () => {
			editor = await createEditor( {
				plugins: [
					Paragraph,
					Image,
					ImageResizeEditing,
					ImageResizeHandles,
					ImageToolbar,
					ImageTextAlternative
				],
				image: {
					toolbar: [ 'imageTextAlternative' ],
					resizeUnit: 'px'
				}
			} );

			await setModelAndWaitForImages( editor, `<paragraph>foo</paragraph>[<image src="${ IMAGE_SRC_FIXTURE }"></image>]` );

			widget = viewDocument.getRoot().getChild( 1 );

			widgetToolbarRepository = editor.plugins.get( 'WidgetToolbarRepository' );
		} );

		it( 'default toolbar visibility', async () => {
			expect( widgetToolbarRepository.isEnabled ).to.be.true;
		} );

		it( 'visibility during the resize', async () => {
			const domResizeHandle = getWidgetDomParts( editor, widget, 'bottom-left' ).resizeHandle;

			resizerMouseSimulator.down( editor, domResizeHandle );

			expect( widgetToolbarRepository.isEnabled ).to.be.false;

			resizerMouseSimulator.up( editor, domResizeHandle );
		} );

		it( 'visibility after the resize', async () => {
			const domResizeHandle = getWidgetDomParts( editor, widget, 'bottom-left' ).resizeHandle;

			resizerMouseSimulator.down( editor, domResizeHandle );
			resizerMouseSimulator.up( editor, domResizeHandle );

			expect( widgetToolbarRepository.isEnabled ).to.be.true;
		} );

		it( 'visibility after the resize was canceled', async () => {
			const resizer = getSelectedImageResizer( editor );
			const domResizeHandle = getWidgetDomParts( editor, widget, 'bottom-left' ).resizeHandle;

			resizerMouseSimulator.down( editor, domResizeHandle );

			resizer.cancel();
			expect( widgetToolbarRepository.isEnabled ).to.be.true;
		} );

		it( 'restores toolbar when clicking the handle without drag', () => {
			// (https://github.com/ckeditor/ckeditor5-widget/pull/112#pullrequestreview-337725256).
			const domResizeHandle = getWidgetDomParts( editor, widget, 'bottom-left' ).resizeHandle;

			resizerMouseSimulator.down( editor, domResizeHandle );
			resizerMouseSimulator.up( editor, domResizeHandle );

			expect( widgetToolbarRepository.isEnabled ).to.be.true;
		} );
	} );

	describe( 'HTML embed integration', () => {
		it( 'does not attach the resizer to the image inside the HTML embed preview', async () => {
			editor = await createEditor( {
				plugins: [ Image, ImageResizeEditing, ImageResizeHandles, HtmlEmbedEditing ],
				htmlEmbed: {
					showPreviews: true,
					sanitizeHtml: input => ( { html: input, hasChanged: false } )
				}
			} );

			const attachToSpy = sinon.spy( editor.plugins.get( WidgetResize ), 'attachTo' );

			setData( editor.model, '[<rawHtml></rawHtml>]' );

			editor.model.change( writer => {
				writer.setAttribute( 'value', `<img src="${ IMAGE_SRC_FIXTURE }">`, editor.model.document.getRoot().getChild( 0 ) );
			} );

			await waitForAllImagesLoaded( editor );

			expect( attachToSpy ).not.called;

			attachToSpy.restore();
		} );
	} );

	describe( 'Link image integration', () => {
		it( 'should attach the resizer to the image inside the link', async () => {
			editor = await createEditor( {
				plugins: [ Image, ImageResizeEditing, ImageResizeHandles, LinkImageEditing ]
			} );

			const attachToSpy = sinon.spy( editor.plugins.get( 'WidgetResize' ), 'attachTo' );

			setData( editor.model, `[<image linkHref="http://ckeditor.com" src="${ IMAGE_SRC_FIXTURE }" alt="alt text"></image>]` );

			await waitForAllImagesLoaded( editor );

			expect( attachToSpy ).calledOnce;

			attachToSpy.restore();
		} );
	} );

	function getDomWidth( domElement ) {
		return new Rect( domElement ).width;
	}

	function getSelectedImageResizer( editor ) {
		return editor.plugins.get( 'WidgetResize' ).getResizerByViewElement(
			editor.editing.view.document.selection.getSelectedElement()
		);
	}

	function createEditor( config ) {
		return ClassicEditor.create( editorElement, config || {
			plugins: [ Image, ImageStyle, Paragraph, Undo, Table, ImageResizeEditing, ImageResizeHandles ],
			image: {
				resizeUnit: 'px'
			}
		} ).then( newEditor => {
			view = newEditor.editing.view;
			viewDocument = view.document;

			focusEditor( newEditor );

			return newEditor;
		} );
	}

	async function setModelAndWaitForImages( editor, data ) {
		setData( editor.model, data );
		return waitForAllImagesLoaded( editor );
	}
} );
