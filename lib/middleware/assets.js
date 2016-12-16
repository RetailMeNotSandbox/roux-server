'use strict';

var _ = require('lodash');
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var util = require('util');

var roux = require('@retailmenot/roux');
var rouxSassImporter = require('@retailmenot/roux-sass-importer');

var CopyWebpackPlugin = require('copy-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var webpackDevMiddleware = require('webpack-dev-middleware');
var webpack = require('webpack');
var defaultConfig = {};
var defaultWebpackConfig = {
	module: {
		loaders: [
			{
				test: /\.scss$/,
				loader: ExtractTextPlugin.extract(
						'style-loader',
						'css-loader!sass-loader'
					)
			}
		]
	},
	plugins: [
		new ExtractTextPlugin('[name]/assets/index.css')
	],
	resolveLoader: {
		root: [path.join(__dirname, '../../node_modules')]
	}
};

function directoryExists(filepath) {
	try {
		return fs.statSync(filepath).isDirectory();
	} catch (e) {
		return false;
	}
}

var DEFAULT_ENTRY_POSITION = '*';
var webpackEntryOrder = [
	DEFAULT_ENTRY_POSITION,
	'javaScript',
	'previewScript'
];

function sortEntryPoints(entryPoints, sortOrder) {
	var defaultPosition = sortOrder.indexOf(DEFAULT_ENTRY_POSITION);

	return _.sortBy(entryPoints, function (entryPoint) {
		var position = entryPoints.indexOf(entryPoint);

		// return the position if found, or the default position if not
		return position >= 0 ? position : defaultPosition;
	});
}

function defaultWebpackEntryHandler(ingredient, entryPointName) {
	return _.isNull(ingredient.entryPoints[entryPointName]) ?
		null :
		path.resolve(
			ingredient.path, ingredient.entryPoints[entryPointName].filename);
}

function nullEntryPointHandler() {
	return null;
}

var webpackEntryHandler = {
	handlebars: nullEntryPointHandler,
	javaScript: function (ingredient) {
		if (_.isNull(ingredient.entryPoints.javaScript) ||
			!_.isNull(ingredient.entryPoints.previewScript)
		) {
			return null;
		}

		// there's no previewScript, so expose the JS entry point as a global
		return util.format(
				'expose?ingredientExports!%s',
				path.resolve(
					ingredient.path,
					ingredient.entryPoints.javaScript.filename
				)
			);
	},
	model: nullEntryPointHandler,
	preview: nullEntryPointHandler
};

/**
 * Return true if `fn` satisfies the conditions of an optional callback, i.e. it
 * is null, undefined, or a function.
 */
function isOptionalFunction(fn) {
	return fn === undefined || fn === null || typeof fn === 'function';
}

/**
 * Initialize a new Roux ingredient assets middleware instance
 *
 * @param {Object} config - The middleware configuration
 * @param {string} config.namespace - The name of the pantry to serve
 *   ingredients from
 * @param {string} config.baseDir - Path to the pantry to serve ingredients from
 * @param {Object} [config.defaultWebpackEntryHandler] - Handler to use if an
 *   entry point has no webpack entry handler
 * @param {Object} [config.webpackConfig] - Webpack configuration to use. The
 *   `output` and `entry` properties of the configuration are ignored.
 * @param {Object} [config.webpackEntryHandler] - Map from Roux ingredient
 *   entry point names to functions that return require strings for webpack's
 *   `entry` array or `null` if the entry point should not appear in the array
 * @param {string[]} [config.webpackEntryOrder] - The order that entry points
 *   should appear in webpack's `entry` array. The array must contain the string
 *   `'*'`, which specifies the default insertion point, and may contain zero or
 *   more Roux ingredient entry point names, which specify where those
 *   ingredients will appear in the `entry` array.
 *
 * @param {Function} [callback] - if present, will be invoked when the
 *   middleware has finished mounting
 * @returns {AssetsMiddleware} the initialized middleware instance
 */
function initAssetsMiddleware(config, callback) {
	assert.ok(
		_.isObject(config), 'Required argument `config` missing or not an object');
	config = _.defaults(config, defaultConfig);

	assert.ok(config.namespace, 'Required config property `namespace` missing');
	assert.ok(config.baseDir && directoryExists(config.baseDir),
		'Required config property `baseDir` missing or not a directory');

	config.webpackEntryOrder = config.webpackEntryOrder || webpackEntryOrder;
	assert.ok(config.webpackEntryOrder.indexOf(DEFAULT_ENTRY_POSITION) > -1,
		util.format(
			'config.webpackEntryOrder must specify the default position: "%s"',
			DEFAULT_ENTRY_POSITION
		)
	);
	config.webpackEntryHandler =
		_.defaults(config.webpackEntryHandler || {}, webpackEntryHandler);
	config.defaultWebpackEntryHandler =
		config.defaultWebpackEntryHandler || defaultWebpackEntryHandler;
	assert.ok(
		isOptionalFunction(callback),
		'callback function, if present, should be a function'
	);

	var middlewarePromise = roux.initialize(
		{
			name: config.namespace,
			path: config.baseDir,
			predicates: config.predicates
		})
		.then(function (pantry) {
			var ingredients = pantry.ingredients;
			var webpackConfig =
				_.defaults(config.webpackConfig || {}, defaultWebpackConfig);

			var importerConfig = {
				pantries: {}
			};
			importerConfig.pantries[pantry.name] = pantry;
			webpackConfig.sassLoader = {
				importer: rouxSassImporter(importerConfig)
			};

			webpackConfig.output = {
				filename: '[name]/assets/index.js',
				publicPath: '/',
				path: path.resolve(config.baseDir)
			};

			// static assets
			var copyWebpackPluginConfig = _.map(ingredients, function (ingredient) {
				var src = path.resolve(ingredient.path, 'static');
				return {
					from: src,
					to: path.join(ingredient.name, 'assets/static')
				};
			});
			webpackConfig.plugins.push(
				new CopyWebpackPlugin(copyWebpackPluginConfig)
			);

			// generate a map from ingredient name to array of entrypoints, ensuring
			// that non-JS entrypoints are built regardless of whether they are
			// `require`d from the JS entrypoint
			webpackConfig.entry = _.reduce(
					ingredients,
					function (webpackConfigEntry, ingredient, ingredientName) {
						// get a sorted array of entry point names
						var entryPoints = sortEntryPoints(
							_.keys(ingredient.entryPoints),
							config.webpackEntryOrder
						);

						// map from the entry point names to the result of calling each
						// name's corresponding handler (or the default if none is defined),
						// and then filter out any `null` results - which are entry points
						// that are not handled by webpack
						webpackConfigEntry[ingredientName] =
							_.chain(entryPoints)
						.map(function (entryPoint) {
							var handler = config.webpackEntryHandler[entryPoint] ||
								config.defaultWebpackEntryHandler;

							return handler(ingredient, entryPoint);
						})
						.reject(_.isNull)
						.value();

						return webpackConfigEntry;
					},
					{}
				);

			console.log('webpack config', webpackConfig);
			var compiler = webpack(webpackConfig);

			return webpackDevMiddleware(compiler, {
				publicPath: webpackConfig.publicPath
			});
		});

	if (callback) {
		// this is bluebird sugar for: invoke the callback with an empty value or
		// the error, if one occurs
		middlewarePromise
			.return()
			.asCallback(callback);
	}

	return function (req, res, next) {
		// Initializing the middleware is an asynchronous process, so we wait until
		// it completes and then handle the request
		middlewarePromise.then(function (middleware) {
			// webpack-dev-middleware only looks at req.url and doesn't understand
			// express routing or app mounting, so we need to fix it up. this is what
			// publicPath is for, but unfortunately we don't know the right value to
			// use until app.use is called, which happens after initialization.
			req.url = req.originalUrl;
			if (req.url.indexOf(req.app.mountpath) === 0) {
				req.url = '/' + req.url.slice(req.app.mountpath.length);
			}

			return middleware(req, res, next);
		})
		.catch(function (err) {
			// initialization failed, so pass the error along
			next(err);
		});
	};
}

module.exports = initAssetsMiddleware;
