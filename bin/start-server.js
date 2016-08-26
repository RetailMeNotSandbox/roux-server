#!/usr/bin/env node
'use strict';

var program = require('commander');
var version = require('../package.json').version;
var path = require('path');
var _ = require('lodash');

function isExplicitlyRelativeOrAbsolute(path) {
	return path.startsWith('./') ||
		path.startsWith('../') ||
		path.startsWith('/');
}

function getAbsoluteModuleLocation(moduleName, relativePath) {
	return isExplicitlyRelativeOrAbsolute(moduleName) ?

		// if this is a relative or absolute path, resolve it relative to
		// relativePath
		path.join(relativePath, moduleName) :

		// otherwise, resolve it relative to the node_modules directory of
		// relativePath
		path.join(relativePath, 'node_modules', moduleName);
}

/**
 * Mimic `require()` behavior relative to the path on which the CLI was
 * initiated.
 *
 * 1. If module name is an explicitly relative or absolute path (i.e. it begins
 *    with `./`, `../`, or `/`) resolve it relative to the caller's path and
 *    `require()` it.
 * 2. Otherwise, resolve it relative to the `node_modules` directory of the
 *    caller's path it and `require()` it.
 */
function requireFrom(moduleName, relativePath) {
	return require(getAbsoluteModuleLocation(moduleName, relativePath));
}

program
	.version(version)
	.option('--baseDir <path>', 'Path to pantry of ingredients', process.cwd())
	.option('--namespace <name>', 'Pantry namespace')
	.option('--port [8080]', 'Port the server should listen on', 8080)
	.option(
		'--helpers <module paths>',
		'require()-able module mapping helper names to function',
		function (helper, helpers) {
			return helpers.concat(helper);
		},
		[]
	)
	.on('--help', function () {
		console.log(`
  Specifying helpers:

    Each entry is handled by mimicking the behavior of a require() from the
    current working directory and is expected to be a module that exports an
    object mapping helper names to functions. If an entry referenced later in
    the command exports an object with a name that has already been used by a
    previous entry, it will be overwritten.
`);
	})
	.parse(process.argv);

if (!program.namespace) {
	console.error('namespace is a required parameter');
	program.help();
	process.exit(1);
}

var config = {
	baseDir: program.baseDir,
	namespace: program.namespace
};

// add helpers to config, if present
if (program.helpers) {
	// first, require() everything
	var helperModules = program.helpers.map(

		// we need to mimic the behavior of require()ing from process.cwd()
		function (helperPath) {
			return requireFrom(helperPath, process.cwd());
		}
	);

	// now, merge them into a new object
	config.helpers = _.assign.apply(null, [{}].concat(helperModules));
}

var app = require('../')(config);

var server = app.listen(program.port, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log(
		'Serving %s ingredients from %s at http://%s:%s',
		program.namespace,
		program.baseDir,
		host,
		port
	);
});
