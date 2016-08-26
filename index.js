'use strict';

var _ = require('lodash');
var assert = require('assert');
var express = require('express');
var Promise = require('bluebird');

var assetsMiddleware = require('./lib/middleware/assets');
var documentationMiddleware = require('./lib/middleware/documentation');
var previewMiddleware = require('./lib/middleware/preview');

function initServer(config, callback) {
	var app = express();

	var previewPromise = Promise.fromCallback(function (callback) {
		app.use(/^\/(.+)\/preview/, previewMiddleware(
				_.defaults({
					name: config.namespace,
					path: config.baseDir,
					helpers: Object.assign(
						{},
						config.helpers
					)
				}, config),
				callback
			)
		);
	});

	var assetsPromise = Promise.fromCallback(function (callback) {
		app.use(/^\/(.+)\/assets\/.+$/, assetsMiddleware(config, callback));
	});

	var documentationPromise = Promise.fromCallback(function (callback) {
		app.use(/^\/(.+)\/docs/, documentationMiddleware(
				_.defaults({
					name: config.namespace,
					path: config.baseDir
				}, config),
				callback
			)
		);
	});

	if (callback) {
		assert.ok(
			_.isFunction(callback),
			'callback must be a function'
		);

		Promise.all([
			previewPromise,
			assetsPromise,
			documentationPromise
		])
		.return()
		.asCallback(callback);
	}

	return app;
}

module.exports = initServer;
