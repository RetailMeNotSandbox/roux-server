# Preview Middleware

Express middleware that serves previews from a pantry of ingredients.

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

var previewMiddleware = require('./lib/middleware/preview');

app.use('/route/to/preview/:ingredient', previewMiddleware({
  baseDir: './path/to/pantry',
  namespace: 'pantry-name',
}));
```

The configuration may also name a default model and the location of an
alternative to the default preview template provided by this module.

```javascript
var express = require('express');
var app = express();

var previewMiddleware = require('./lib/middleware/preview');

app.use('/route/to/preview/:ingredient', previewMiddleware({
  baseDir: './path/to/pantry',
  namespace: 'pantry-name',
  defaultModel: {
    foo: {
      bar: 'applesauce'
    }
  },
  defaultPreviewTemplatePath: './path/to/default-preview.hbs'
}));
```

### Routing

You may mount the middleware at any URL you like, but it expects to receive the
name of the ingredient to preview as the [0th capture group][route-param] in the
route parameters: `req.params[0]`.

### Query parameters

The middleware accepts the following query parameters:

- `modelPath`: An [`object-path`][object-path] expression that names a subtree
    of the selected model to use as the Handlebars context when rendering the
    preview.

For example, given the following model:

```js
{
  foo: {
    bar: [{
      applesauce: 'chutney'
    }, {
      applesauce: 'puree'
    }]
  }
}
```

Then passing `modelPath=foo.bar.1` will result in the preview being rendered in
with `{ applesauce: 'puree' }` as its context.

## API

### Module

The module exports a function that returns an initialized Express middleware
function.

- `config` - Configuration object for the middleware instance
    - `baseDir` - path to the pantry of Roux ingredients to serve
    - `namespace` - the namespace used by ingredients in the pantry
    - `[defaultModel]` - the model to use if as the Handlebars context if an
        ingredient does not provide a model entrypoint. Defaults to `{}`.
    - `[defaultPreviewTemplatePath]` - path to the default preview template to
        use if an ingredient does not provide a preview entrypoint. Defaults to
        [./default-preview.hbs][].
    - `[helpers]` - optional object mapping from Handlebars helper names to the
        corresponding helper function
- `[callback]` - an optional Node-style callback that is called when the
    middleware is fully initialized and ready to respond to requests

### Middleware

The middleware instances returned are Express middleware functions that accept
the following arguments:

- `req` - the [request][Request]
  - `req.params` - the request [route parameters][Request.params]
    - `req.params.ingredient` - the ingredient to preview
- `res` - the [response][Response]
- `next` - middleware continuation (only used if there is an error)

### Preview template

The template entry point is available as a partial named `ingredient` in the
configured preview template. It will be passed the model property `model` as its
context. For an example, see [./default-preview.hbs][].

The configured preview template is rendered with a model providing the following
properties:

- `hasScript` - true if the ingredient has a JavaScript or preview script entry
    point and false otherwise
- `hasStyles` - true if the ingredient has a Sass or LESS entry point and false
    otherwise
- `ingredientName` - the name of the ingredient being previewed
- `model` - the selected model for the preview (see `modelPath` above)

[route-param]: http://expressjs.com/4x/api.html#req.params
[object-path]: https://www.npmjs.com/package/object-path
[Request]: http://expressjs.com/4x/api.html#req
[Request.params]: http://expressjs.com/4x/api.html#req.params
[Response]: http://expressjs.com/4x/api.html#res
