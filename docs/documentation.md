# Documentation Middleware

Express middleware that serves Markdown documentation from a pantry of ingredients.

## Usage

### Initialization

In the canonical manner of the Express community, this module exports a
function that returns an initialized middleware function. The function expects a
configuration object with two required properties: `baseDir` and `namespace`,
naming the location of the pantry of ingredients and its namespace,
respectively.

```javascript
var express = require('express');
var app = express();

var documentationMiddleware = require('./lib/middleware/documentation');

app.use(/^\/(.+)\/docs/, documentationMiddleware({
  path: './path/to/pantry',
  name: 'pantry-name',
}));
```

### Routing

You may mount the middleware at any URL you like, but it expects to receive the
name of the ingredient from which to render documentation as the [0th capture
group][route-param] in the route parameters: `req.params[0]`.

## API

### Module

The module exports a function that returns an initialized Express middleware
function.

- `config` - Configuration object for the middleware instance
    - `path` - path to the pantry of ingredients to serve
    - `name` - the namespace used by ingredients in the pantry
- `[callback]` - an optional Node-style callback that is called when the
    middleware is fully initialized and ready to respond to requests

### Middleware

The middleware instances returned are Express middleware functions that accept
the following arguments:

- `req` - the [request][Request]
  - `req.params` - the request [route parameters][Request.params]
    - `req.params[0]` - the ingredient to render documentation for
- `res` - the [response][Response]
- `next` - middleware continuation (only used if there is an error)

### Markdown

The middleware uses [markdown-it][] with HTML enabled to render the
documentation. In addition to rendering the Markdown, it handles the following
custom elements.

#### `<preview>`

Render a preview of the ingredient in an iframe. The following attributes are
supported.

- `modelpath` - the value to pass as the `modelPath` querystring attribute to
  the iframe preview

[markdown-it]: https://github.com/markdown-it/markdown-it
[route-param]: http://expressjs.com/4x/api.html#req.params
[object-path]: https://www.npmjs.com/package/object-path
[Request]: http://expressjs.com/4x/api.html#req
[Request.params]: http://expressjs.com/4x/api.html#req.params
[Response]: http://expressjs.com/4x/api.html#res
