# Assets Middleware

Express middleware that builds and serves a pantry of ingredients' static
assets.

## Usage

### Initialization

In the canonical manner of the Express community, this module exports a function
that returns an initialized middleware instance. The exported function expects
a configuration object with two required properties: `baseDir` and `namespace`,
naming the location of the pantry of ingredients and its namespace,
respectively.

```javascript
var express = require('express');
var app = express();

var assetsMiddleware = require('./lib/middleware/assets');

app.use('/route/to/assets/:ingredient', assetsMiddleware({
  baseDir: './path/to/pantry',
  namespace: 'pantry-name'
}));
```

## API

### Module

The module exports a function that returns an initialized Express middleware
function.

- `config` - Configuration object for the middleware instance
    - `baseDir` - path to the pantry of ingredients to serve
    - `namespace` - the namespace used by ingredients in the pantry
    - `defaultWebpackEntryHandler` - optional handler to use if an entry point
        has no webpack entry handler
    - `webpackConfig` - optional Webpack configuration object. The `entry` and
        `output` properties of the configuration object are ignored.
    - `webpackEntryHandler` - optional map from the ingredient entry point
        names to functions that return require strings for webpack's `entry`
        array or `null` if the entry point should not appear in the array
    - `webpackEntryOrder` - optional array specifiying the order that entry
        points should appear in webpack's `entry` array. The array must contain
        the string `'*'`, which specifies the default insertion point, and may
        contain zero or more ingredient entry point names, which specify
        where those ingredients will appear in the `entry` array.

### Middleware

The middleware instances returned are Express middleware functions that accept
the following arguments:

- `req` - the [request][Request]
- `res` - the [response][Response]
- `next` - middleware continuation (only used if there is an error)

[object-path]: https://www.npmjs.com/package/object-path
[Request]: http://expressjs.com/4x/api.html#req
[Request.params]: http://expressjs.com/4x/api.html#req.params
[Response]: http://expressjs.com/4x/api.html#res
