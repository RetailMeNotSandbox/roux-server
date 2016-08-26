'use strict';

var _ = require('lodash');
var assert = require('assert');
var cheerio = require('cheerio');
var md = require('markdown-it')({
	html: true
});
var path = require('path');
var Promise = require('bluebird');
var roux = require('@retailmenot/roux');
var url = require('url');
var util = require('util');

var fs = Promise.promisifyAll(require('fs'));

var defaultConfig = {};

/**
 * A Roux ingredient documentation middleware instance
 *
 * This middleware serves documentation from a pantry of Roux ingredients. It
 * accepts the name of the ingredient  as the [0th capture group][route-param]
 * in the route parameters: `req.params[0]`.
 *
 * [route-param]: http://expressjs.com/4x/api.html#req.params
 *
 * @typedef {function} DocumentationMiddleware
 * @param {Request} req - the request
 * @param {Object} req.params - the request route parameters
 * @param {string} req.params[0] - the ingredient to preview
 * @param {Response} res - the response
 * @param {function} next - middleware continuation
 */
function documentationMiddleware(config, req, res, next) {
	var ingredientName = req.params[0];
	if (!ingredientName) {
		next(new Error('`req.params[0]` must be defined'));
	} else {
		Promise.try(
			function () {
				return config.pantryPromise;
			})
			.then(function (pantry) {
				var ingredient = pantry.ingredients[ingredientName];
				if (!ingredient) {
					return next(
						new Error(
							util.format('no such ingredient "%s"', ingredientName)
						)
					);
				}

				// read the ingredient.md file
				return fs.readFileAsync(
					path.resolve(
						ingredient.path,
						'ingredient.md'
					), {
						encoding: 'utf8'
					});
			})
			.then(function (markdown) {
				var $markdown = cheerio.load(md.render(markdown));

				// Because the <preview> element is not considered a block element by
				// the markdown compiler, it's wrapped in a <p> tag. So, find all the
				// <preview> elements in the rendered markup and replace their parents
				// with an appropriately configured <iframe>.
				$markdown('preview')
					.parent()
					.replaceWith(function () {
						var result = cheerio.load('<iframe></iframe>');

						// eslint-disable-next-line no-invalid-this
						var $preview = $markdown('preview', this);
						var urlObject = {
							pathname: './preview',
							query: {}
						};

						// if a modelPath is specified, append it to the preview querystring
						if ($preview.attr('modelpath')) {
							urlObject.query.modelPath = $preview.attr('modelpath');
							$preview.attr('modelpath', null);
						}

						// apply all remaining attributes to the iframe and then set its src
						result('iframe')
							.attr($preview.attr())
							.attr('src', url.format(urlObject));

						return result.html();
					});

				return $markdown.html();
			})
			.then(function (result) {
				res.send(result);
			})
			.catch(function (err) {
				return next(err);
			});
	}
}

/**
 * Initialize a new Roux ingredient documentation middleware instance
 *
 * @param {Object] config - the middleware configuration
 * @param {string} config.name - the name of the pantry to serve
 *   ingredients from
 * @param {string} config.path - path to the pantry to serve ingredients from
 * @param {Function} [callback] - optional node-style callback that will be
 *   called when the middleware is fully initialized and will respond to
 *   requests
 *
 * @returns {DocumentationMiddleware} the initialized middleware instance
 */
function initDocumentationMiddleware(config, callback) {
	assert.ok(_.isObject(config), 'config object is required');
	assert.ok(_.isString(config.name), 'config.name is required');
	assert.ok(_.isString(config.path), 'config.path is required');

	var pantryPromise = roux.initialize({
		name: config.name,
		path: config.path
	});

	if (callback) {
		assert.ok(
			_.isFunction(callback),
			'callback must be a function'
		);

		pantryPromise
			.return()
			.asCallback(callback);
	}

	config = _.defaults({
		pantryPromise: pantryPromise
	}, config, defaultConfig);

	return documentationMiddleware.bind(null, config);
}

module.exports = initDocumentationMiddleware;
