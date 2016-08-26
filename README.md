# @retailmenot/roux-server

Express application that serves a pantry of ingredients for the Roux ecosystem.

## Installation

```sh
npm install @retailmenot/roux-server
```

## Usage

### Initialization

This module exports a function that returns an initialized Express 4
application, suitable for stand-alone use or mounting on a route as a
sub-application. The function expects a configuration object with two required
properties: `baseDir` and `namespace`, naming the location of the pantry of
ingredients and its namespace, respectively.

#### Stand-alone

The returned application instance can be used like any Express application,
including adding additional middleware and routes. The simplest usage is to just
serve the pantry of ingredients:

```javascript
var pantryDir = './path/to/pantry';
var pantryName = 'pantry-name';
var app = require('@retailmenot/roux-server')({
  baseDir: pantryDir,
  namespace: pantryName,
});

var server = app.listen(8080, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log(
    'Serving %s ingredients from %s at http://%s:%s',
    pantryName,
    pantryDir,
    host,
    port
  );
});
```

#### As a sub-application

In more complicated applications, it may be better to use the returned
application as a [sub-application][]:

```javascript
var express = require('express');
var app = express();

var pantryDir = './path/to/pantry';
var pantryName = 'pantry-name';
var ingredientApp = require('@retailmenot/roux-server')({
  baseDir: pantryDir,
  namespace: pantryName,
});

app.use('/ingredients', ingredientApp);

var server = app.listen(8080, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log(
    'Serving %s ingredients from %s at http://%s:%s/ingredients',
    pantryName,
    pantryDir,
    host,
    port
  );
});
```

#### As a global CLI

If you simply wish to serve a local pantry without any advanced configuration,
the CLI may well suit your needs:

```sh
$ npm install -g @retailmenot/roux-server

$ pushd path/to/pantry

$ roux-server --namespace 'your-pantry-namespace'
```

##### Providing helpers

In the CLI, you can provide `helpers` arguments which will register helpers on
the Handlebars instance. 

The `helpers` argument accepts a module path which behaves similarly to a
`require()` from the current working directory.

For example:

- `./foo` will resolve to `./foo`
- `../foo` will resolve to `../foo`
- `/foo` will resolve to `/foo`
- `foo` will attempt to read `./node_modules/foo`, then fall back to `./foo`

A path should resolve to a module which exports an object mapping helper names to
functions.

Multiple paths can be specified by providing multiple `helpers` arguments. These
will be applied left-to-right, with collisions in helper names ceding to the
right-most declared helper.

For example, given:

```
// a.js

module.exports = {
  a: function () {
    return 'a';
  }
};

// alwaysSayDogs.js

module.exports = {
  a: function () {
    return 'dogs';
  },
  b: function () {
    return 'dogs';
  }
}
```

The following commands would register helpers as illustrated:

```
roux-server --helpers a --helpers alwaysSayDogs
a -> dogs
b -> dogs

roux-server --helpers alwaysSayDogs --helpers a
a -> a
b -> dogs
```

## API

### Module

The module exports a function that returns an initialized Express application.

- `config` - Configuration object for the application instance
    - `baseDir` - path to the pantry of ingredients to serve
    - `namespace` - the namespace used by ingredients in the pantry
    - `[defaultModel]` - the model to use as the Handlebars context if an
        ingredient does not provide a model entrypoint. Defaults to `{}`.
    - `[defaultPreviewTemplatePath]` - path to the default preview template to
        use if an ingredient does not provide a preview entrypoint. Defaults to
        [default-preview][].
- `[callback]` - an optional Node-style callback that is called when the server
    is fully initialized and ready to respond to requests

### Application

The application instances returned are Express 4 [Application][] instances.


## Development / Contributing
```
$ git clone ssh://git@github.com:RetailMeNotSandbox/roux-server.git roux-server && cd $_

## install dependencies
$ npm install

## ensure grunt-cli is installed globally
$ npm install -g grunt-cli

## run linter
$ grunt eslint

```

[Application]: http://expressjs.com/4x/api.html#app
[default-preview]: https://github.com/RetailMeNotSandbox/roux-server/blob/master/lib/middleware/default-preview.hbs
[sub-application]: http://expressjs.com/4x/api.html#app.mountpath
