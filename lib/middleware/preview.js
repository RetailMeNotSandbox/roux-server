'use strict';

var _ = require('lodash');
var assert = require('assert');
var handlebars = require('handlebars');
var objectPath = require('object-path');
var path = require('path');
var Promise = require('bluebird');
var roux = require('@retailmenot/roux');
var util = require('util');
var getPartialDependencies = require('@retailmenot/roux-handlebars-tools')
	.getPartialDependencies;

var fs = Promise.promisifyAll(require('fs'));

var defaultConfig = {
	defaultPreviewTemplatePath: path.resolve(__dirname, 'default-preview.hbs'),
	defaultModel: {}
};

/**
 * A Roux ingredient preview middleware instance
 *
 * This middleware serves previews from a pantry of Roux ingredients. It accepts
 * the name of the ingredient to preview as the [0th capture
 * group][route-param] in the route parameters: `req.params[0]`.
 *
 * If the ingredient provides a model entrypoint (`model.js`), it will be used
 * as the Handlebars context when rendering the preview. Otherwise, the value
 * passed as `config.defaultModel` when initializing the middleware will be used
 * as the context. If no `defaultModel` was passed, then the context is `{}`.
 *
 * To specify a subtree in the model to use as the Handlebars context, pass the
 * `modelPath` query parameters.
 *
 * - `[modelPath]` - An [`object-path`][object-path] expression that names a
 *     subtree of the selected model to use as the Handlebars context when
 *     rendering the preview.
 *
 * [route-param]: http://expressjs.com/4x/api.html#req.params
 * [object-path]: https://www.npmjs.com/package/object-path
 *
 * @typedef {function} PreviewMiddleware
 * @param {Request} req - the request
 * @param {Object} req.params - the request route parameters
 * @param {string} req.params[0] - the ingredient to preview
 * @param {Response} res - the response
 * @param {function} next - middleware continuation
 */
function previewMiddleware(config, req, res, next) {
	var ingredientName = req.params[0];
	if (!ingredientName) {
		next(new Error('`req.params[0]` must be defined'));
	} else {
		// To render a preview, perform the following steps:
		// 1. Determine the path to the preview template
		//    a) if the ingredient has a preview entrypoint (`preview.hbs`), use
		//       that
		//    b) otherwise, use the configured `defaultPreviewTemplatePath`
		// 2. Choose the model to use as the Handlebars context
		//    a) if the ingredient has a model entrypoint, require it
		//    b) otherwise, use the configured `defaultModel`
		//    c) if a `modelPath` is specified, use refine the model using it
		// 3. Render the ingredient's template entrypoint
		// 4. Render the preview, using the result of the previous step as `body`
		// 5. Send the result as the response

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

				var modelPromise = Promise.resolve(function () {
					// choose the model
					var model = ingredient.entryPoints.model ?
						require(
							path.resolve(
								ingredient.path,
								ingredient.entryPoints.model.filename
							)
						) :
						config.defaultModel;

					if (req.query.modelPath) {
						model = objectPath.get(
							model,
							decodeURIComponent(req.query.modelPath)
						);
					}

					return model;
				}());

				var handlebarsPromise = Promise.resolve(undefined);

				// if no handlebars entry point, render the empty string
				if (ingredient.entryPoints.handlebars != null) {
					// read the entry point source
					handlebarsPromise = fs.readFileAsync(
						path.resolve(
							ingredient.path,
							ingredient.entryPoints.handlebars.filename
						), {
							encoding: 'utf8'
						})
						.then(function (template) {
							// get the template dependencies of this template, then register
							// them as partials
							var handlebarsToolsConfig = {
								pantries: {}
							};
							handlebarsToolsConfig.pantries[pantry.name] = pantry;

							return getPartialDependencies(template, handlebarsToolsConfig)
								.then(function (dependencies) {
									// convert to an array
									return Object.keys(dependencies).map(function (name) {
										return {
											name: name,
											path: dependencies[name]
										};
									});
								})
								.map(function (partial) {
									// for each entry, read the corresponding file
									return fs.readFileAsync(partial.path, {
										encoding: 'utf8'
									})
										.then(function (template) {
											return {
												name: partial.name,
												template: template
											};
										});
								})
								.each(function (partial) {
									// register each partial
									handlebars.registerPartial(partial.name, partial.template);
								})
								.then(function () {
									// finally, register the original template as a partial
									handlebars.registerPartial('ingredient', template);
								});
						});
				} else {
					// if there's no handlebars entrypoint, register an empty partial
					handlebars.registerPartial('ingredient', '');
				}

				// choose the appropriate preview template
				var previewTemplatePath = ingredient.entryPoints.preview ?
					path.resolve(
						ingredient.path,
						ingredient.entryPoints.preview.filename
					) :
					config.defaultPreviewTemplatePath;

				// read and compile the preview template
				var previewFnPromise =
					fs.readFileAsync(previewTemplatePath, {encoding: 'utf8'})
						.then(function (previewTemplate) {
							return handlebars.compile(previewTemplate);
						});

				return Promise.join(
					modelPromise,
					previewFnPromise,
					handlebarsPromise,
					function (model, previewFn) {
						var renderModel = {
							ingredientName: ingredient.name,
							hasStyles: !!ingredient.entryPoints.sass ||
								!!ingredient.entryPoints.less,
							hasScript: !!ingredient.entryPoints.javaScript ||
								!!ingredient.entryPoints.previewScript,
							model: model
						};
						if (config.basePreviewModel) {
							_.extend(renderModel, config.basePreviewModel);
						}

						// return the rendered preview
						return previewFn(renderModel);
					}
				);
			})
			.then(function (result) {
				res.send(result);
			})
			.catch(next);
	}
}

/**
 * Initialize a new Roux ingredient preview middleware instance
 *
 * @param {Object] config - the middleware configuration
 * @param {string} config.name - the name of the pantry to serve
 *   ingredients from
 * @param {string} config.path - path to the pantry to serve ingredients from
 * @param {Object} [config.defaultModel={}] - default model to use as the
 *   Handlebars context when rendering.
 * @param {string} [config.defaultPreviewTemplatePath] - path to the default
 *   preview template. If not provided, `default-preview.hbs` from this module
 *   is used.
 * @param {Object} [config.helpers] - optional map of Handlebars helpers to
 *   register
 * @param {Object} [config.basePreviewModel] - optional model that will be
 *   extended into the root object before rendering. If your ingredients contain
 *   @root references, you'll want to specify those things here.
 * @param {Function} [callback] - optional node-style callback that will be
 *   called when the middleware is fully initialized and will respond to
 *   requests
 *
 * @returns {PreviewMiddleware} the initialized middleware instance
 */
function initPreviewMiddleware(config, callback) {
	assert.ok(_.isObject(config), 'config object is required');
	assert.ok(_.isString(config.name), 'config.name is required');
	assert.ok(_.isString(config.path), 'config.path is required');

	if ('defaultModel' in config) {
		assert.ok(
			_.isObject(config.defaultModel),
			'config.defaultModel must be an object'
		);
	}

	if ('basePreviewModel' in config) {
		assert.ok(
			_.isObject(config.basePreviewModel),
			'config.basePreviewModel must be an object'
		);
	}

	if ('defaultPreviewTemplatePath' in config) {
		assert.ok(
			_.isString(config.defaultPreviewTemplatePath),
			'config.defaultPreviewTemplatePath must be a string'
		);
	}

	if ('helpers' in config) {
		assert.ok(
			_.isObject(config.helpers),
			'config.helpers must be an object'
		);

		_.forEach(config.helpers, function (helperFn, helperName) {
			handlebars.registerHelper(helperName, helperFn);
		});
	}

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

	return previewMiddleware.bind(null, config);
}

module.exports = initPreviewMiddleware;
