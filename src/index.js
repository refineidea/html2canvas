/* @flow */
'use strict';

import {NodeParser} from './NodeParser';
import CanvasRenderer from './CanvasRenderer';
import Logger from './Logger';
import ImageLoader from './ImageLoader';
import {Bounds, parseDocumentSize} from './Bounds';
import {cloneWindow} from './Clone';
import Color from './Color';
import {FontMetrics} from './Font';

export type Options = {
    async: ?boolean,
    allowTaint: ?boolean,
    canvas: ?HTMLCanvasElement,
    imageTimeout: ?number,
    proxy: ?string,
    removeContainer: ?boolean,
    type: ?string
};

const html2canvas = (element: HTMLElement, config: Options): Promise<HTMLCanvasElement> => {
    const logger = new Logger();

    const ownerDocument = element.ownerDocument;
    const defaultView = ownerDocument.defaultView;
    const windowBounds = new Bounds(
        defaultView.pageXOffset,
        defaultView.pageYOffset,
        defaultView.innerWidth,
        defaultView.innerHeight
    );

    const defaultOptions = {
        async: true,
        allowTaint: false,
        canvas: ownerDocument.createElement('canvas'),
        imageTimeout: 10000,
        proxy: null,
        removeContainer: true,
        scale: defaultView.devicePixelRatio,
        type: null
    };

    const options = {...defaultOptions, ...config};

    const canvas = options.canvas;

    if (!(canvas instanceof HTMLCanvasElement)) {
        return Promise.reject(__DEV__ ? `Invalid canvas element provided in options` : '');
    }

    return cloneWindow(
        ownerDocument,
        ownerDocument,
        windowBounds,
        element,
        options
    ).then(([container, clonedElement]) => {
        if (__DEV__) {
            logger.log(`Document cloned`);
        }
        const imageLoader = new ImageLoader(options, logger);
        const stack = NodeParser(clonedElement, imageLoader, logger);
        const clonedDocument = clonedElement.ownerDocument;
        const size = options.type === 'view' ? windowBounds : parseDocumentSize(clonedDocument);
        const width = size.width;
        const height = size.height;
        canvas.width = Math.floor(width * options.scale);
        canvas.height = Math.floor(height * options.scale);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // http://www.w3.org/TR/css3-background/#special-backgrounds
        const backgroundColor =
            clonedElement === clonedDocument.documentElement
                ? stack.container.style.background.backgroundColor.isTransparent()
                  ? clonedDocument.body
                    ? new Color(getComputedStyle(clonedDocument.body).backgroundColor)
                    : null
                  : stack.container.style.background.backgroundColor
                : null;

        return imageLoader.ready().then(imageStore => {
            if (options.removeContainer === true) {
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                } else if (__DEV__) {
                    logger.log(`Cannot detach cloned iframe as it is not in the DOM anymore`);
                }
            }

            const fontMetrics = new FontMetrics(clonedDocument);

            const renderer = new CanvasRenderer(canvas, {
                scale: options.scale,
                backgroundColor,
                imageStore,
                fontMetrics
            });
            return renderer.render(stack);
        });
    });
};

module.exports = html2canvas;