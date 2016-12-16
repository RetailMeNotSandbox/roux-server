'use strict';

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var tap = require('tap');
var util = require('util');

var previewMiddleware = require('../../../lib/middleware/preview');

var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var touch = require('touch');

var FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function scaffold(directory, config) {
	rimraf.sync(directory);
	mkdirp.sync(directory);
	if (_.isArray(config)) {
		_.forEach(config, function (filename) {
			touch.sync(path.resolve(directory, filename));
		});
	} else if (_.isObject(config)) {
		_.forEach(config, function (v, k) {
			scaffold(path.resolve(directory, k), v);
		});
	}
}

/* eslint-disable no-invalid-this, lines-around-comment */
function next(error) {
	this.threw(error);
	this.end();
}
/* eslint-enable no-invalid-this, lines-around-comment */

tap.test('API', function (t) {
	t.autoend();

	t.tearDown(function () {
		// remove all fixture pantries
		rimraf.sync(FIXTURES_DIR);
	});

	t.type(previewMiddleware, 'function', 'exports a factory function');

	t.test('the factory function', function (t) {
		t.autoend();

		t.type(previewMiddleware({
			name: '',
			path: ''
		}), 'function', 'returns a function');

		t.test('accepts a required config object', function (t) {
			t.autoend();

			t.throws(function () {
				previewMiddleware();
			}, 'throws if config is not passed');

			_.forEach(
				[
					'',
					'foo',
					0,
					123,
					true,
					false,
					undefined
				],
				function (arg) {
					t.throws(function () {
						previewMiddleware(arg);
					}, 'must be an object');
				});

			t.test('config.name', function (t) {
				t.throws(function () {
					previewMiddleware({
						path: ''
					});
				}, 'is required');

				_.forEach(
					[
						0,
						123,
						true,
						false,
						undefined,
						[],
						{}
					],
					function (arg) {
						t.throws(function () {
							previewMiddleware({
								name: arg,
								path: ''
							});
						}, 'must be a string');
					});

				t.end();
			});

			t.test('config.path', function (t) {
				t.throws(function () {
					previewMiddleware({
						name: ''
					});
				}, 'is required');

				_.forEach(
					[
						0,
						123,
						true,
						false,
						undefined,
						[],
						{}
					],
					function (arg) {
						t.throws(function () {
							previewMiddleware({
								name: '',
								path: arg
							});
						}, 'must be a string');
					});

				t.end();
			});

			t.test('config.defaultModel', function (t) {
				t.doesNotThrow(function () {
					previewMiddleware({
						name: '',
						path: ''
					});
				}, 'is optional');

				_.forEach(
					[
						'',
						'foo',
						0,
						123,
						true,
						false,
						undefined
					],
					function (arg) {
						t.throws(function () {
							previewMiddleware({
								name: '',
								path: '',
								defaultModel: arg
							});
						}, 'must be an object');
					});

				t.end();
			});

			t.test('config.defaultPreviewTemplatePath', function (t) {
				t.doesNotThrow(function () {
					previewMiddleware({
						name: '',
						path: ''
					});
				}, 'is optional');

				_.forEach(
					[
						0,
						123,
						true,
						false,
						undefined,
						[],
						{}
					],
					function (arg) {
						t.throws(function () {
							previewMiddleware({
								name: '',
								path: '',
								defaultPreviewTemplatePath: arg
							});
						}, 'must be a string');
					});

				t.end();
			});

			t.test('config.helpers', function (t) {
				t.doesNotThrow(function () {
					previewMiddleware({
						name: '',
						path: ''
					});
				}, 'is optional');

				_.forEach(
					[
						'',
						'foo',
						0,
						123,
						true,
						false,
						undefined
					],
					function (arg) {
						t.throws(function () {
							previewMiddleware({
								name: '',
								path: '',
								helpers: arg
							});
						}, 'must be an object');
					});

				t.end();
			});

			t.test('config.basePreviewModel', function (t) {
				t.doesNotThrow(function () {
					previewMiddleware({
						name: '',
						path: ''
					});
				}, 'is optional');

				_.forEach(
					[
						'',
						'foo',
						0,
						123,
						true,
						false,
						undefined
					],
					function (arg) {
						t.throws(function () {
							previewMiddleware({
								name: '',
								path: '',
								basePreviewModel: arg
							});
						}, 'must be an object');
					});

				t.end();
			});
		});

		t.test('accepts an optional callback', function (t) {
			t.autoend();

			t.doesNotThrow(function () {
				previewMiddleware({
					name: '',
					path: ''
				});
			}, 'is optional');

			_.forEach(
				[
					'foo',
					123,
					true,
					{},
					[]
				],
				function (arg) {
					t.throws(function () {
						previewMiddleware({
							name: '',
							path: ''
						}, arg);
					}, 'must be a function');
				});

			t.test('calls back with undefined on success', function (t) {
				scaffold(FIXTURES_DIR, {
					path: {
						to: {
							pantry: {
								ingredient: ['ingredient.md']
							}
						}
					}
				});

				previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
				}, function (error, result) {
					t.equal(error, null);
					t.equal(result, undefined);
					t.end();
				});
			});

			t.test('calls back with error on error', function (t) {
				previewMiddleware({
					name: 'pantry',
					path: '/no/such/path'
				}, function (error, result) {
					t.type(error, Error);
					t.equal(result, undefined);
					t.end();
				});
			});
		});
	});

	t.test('the middleware function', function (t) {
		t.autoend();

		t.test('calls next with an error if no `ingredient` param', function (t) {
			var next = sinon.spy();

			scaffold(FIXTURES_DIR, {
				pantry: {
					ingredient: ['ingredient.md', 'index.hbs'],
					'no-handlebars': ['ingredient.md', 'preview.hbs']
				}
			});

			var middleware = previewMiddleware({
				name: 'pantry',
				path: path.resolve(FIXTURES_DIR, 'pantry')
			});

			middleware(
				{
					params: {}
				},
				{},
				next
			);

			t.ok(next.called, 'next called');
			t.type(next.firstCall.args[0], 'Error', 'next called with an Error');
			t.end();
		});

		t.test('renders the empty string into the preview entry point if ' +
			'ingredient has no handlebars entry point',
			function (t) {
				var previewTemplate = 'preview {{> ingredient }}';
				var expected = previewTemplate.replace('{{> ingredient }}', '');

				scaffold(FIXTURES_DIR, {
					pantry: {
						ingredient: ['ingredient.md', 'index.hbs'],
						'no-handlebars': ['ingredient.md', 'preview.hbs']
					}
				});

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'pantry/no-handlebars/preview.hbs'),
					previewTemplate
				);

				var middleware = previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'pantry')
				});

				middleware(
					{
						params: {
							0: 'no-handlebars'
						},
						query: {}
					},
					{
						send: sinon.spy(function (result) {
							t.equal(
								result,
								expected,
								'template rendered into preview template'
							);

							t.end();
						})
					},
					next.bind(t)
				);
			});

		t.test('preview template', function (t) {
			t.autoend();

			t.test('uses preview entry point if present', function (t) {
				var previewTemplate = 'ingredient preview entry point {{> ingredient}}';
				var template = 'handlebars entry point';
				var expected = previewTemplate.replace('{{> ingredient}}', template);

				scaffold(FIXTURES_DIR, {
					path: {
						to: {
							pantry: {
								ingredient: ['ingredient.md', 'preview.hbs', 'index.hbs']
							}
						}
					}
				});

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
					template
				);

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
					previewTemplate
				);

				var middleware = previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
				});

				middleware(
					{
						params: {
							0: 'ingredient'
						},
						query: {}
					},
					{
						send: sinon.spy(function (result) {
							t.equal(
								result,
								expected,
								'template rendered into preview template'
							);

							t.end();
						})
					},
					next.bind(t)
				);
			});

			t.test('otherwise is template at `defaultPreviewTemplatePath`',
				function (t) {
					var previewTemplate = 'default preview {{> ingredient}}';
					var template = 'handlebars entry point';
					var expected = previewTemplate.replace('{{> ingredient}}', template);

					scaffold(FIXTURES_DIR, {
						path: {
							to: {
								pantry: {
									ingredient: ['ingredient.md', 'index.hbs']
								}
							}
						}
					});

					fs.writeFileSync(
						path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
						template
					);

					fs.writeFileSync(
						path.resolve(FIXTURES_DIR, 'path/to/pantry/preview.hbs'),
						previewTemplate
					);

					var middleware = previewMiddleware({
						name: 'pantry',
						path: path.resolve(FIXTURES_DIR, 'path/to/pantry'),
						defaultPreviewTemplatePath:
							path.resolve(FIXTURES_DIR, 'path/to/pantry/preview.hbs')
					});

					middleware(
						{
							params: {
								0: 'ingredient'
							},
							query: {}
						},
						{
							send: sinon.spy(function (result) {
								t.equal(
									result,
									expected,
									'template rendered into default preview template'
								);

								t.end();
							})
						},
						next.bind(t)
					);
				});

			t.test('model', function (t) {
				t.autoend();

				t.test('hasStyles', function (t) {
					t.autoend();

					t.test('true if ingredient has Sass entry point', function (t) {
						var previewTemplate = 'default preview {{hasStyles}}';
						var expected = previewTemplate.replace('{{hasStyles}}', true);

						scaffold(FIXTURES_DIR, {
							path: {
								to: {
									pantry: {
										ingredient: ['ingredient.md', 'preview.hbs', 'index.scss']
									}
								}
							}
						});

						fs.writeFileSync(
							path.resolve(
								FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
							previewTemplate
						);

						var middleware = previewMiddleware({
							name: 'pantry',
							path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
						});

						middleware(
							{
								params: {
									0: 'ingredient'
								},
								query: {}
							},
							{
								send: sinon.spy(function (result) {
									t.equal(
										result,
										expected,
										'`hasStyles` true if Sass entry point'
									);

									t.end();
								})
							},
							next.bind(t)
						);
					});

					t.test('false otherwise', function (t) {
						var previewTemplate = 'default preview {{hasStyles}}';
						var expected = previewTemplate.replace('{{hasStyles}}', false);

						scaffold(FIXTURES_DIR, {
							path: {
								to: {
									pantry: {
										ingredient: ['ingredient.md', 'preview.hbs']
									}
								}
							}
						});

						fs.writeFileSync(
							path.resolve(
								FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
							previewTemplate
						);

						var middleware = previewMiddleware({
							name: 'pantry',
							path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
						});

						middleware(
							{
								params: {
									0: 'ingredient'
								},
								query: {}
							},
							{
								send: sinon.spy(function (result) {
									t.equal(
										result,
										expected,
										'`hasStyles` false otherwise'
									);

									t.end();
								})
							},
							next.bind(t)
						);
					});
				});

				t.test('hasScript', function (t) {
					t.autoend();

					t.test('true if ingredient has JavaScript entry point', function (t) {
						var previewTemplate = 'default preview {{hasScript}}';
						var expected = previewTemplate.replace('{{hasScript}}', true);

						scaffold(FIXTURES_DIR, {
							path: {
								to: {
									pantry: {
										ingredient: ['ingredient.md', 'preview.hbs', 'index.js']
									}
								}
							}
						});

						fs.writeFileSync(
							path.resolve(
								FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
							previewTemplate
						);

						var middleware = previewMiddleware({
							name: 'pantry',
							path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
						});

						middleware(
							{
								params: {
									0: 'ingredient'
								},
								query: {}
							},
							{
								send: sinon.spy(function (result) {
									t.equal(
										result,
										expected,
										'`hasScript` true if JavaScript entry point'
									);

									t.end();
								})
							},
							next.bind(t)
						);
					});

					t.test('true if ingredient has preview script entry point',
						function (t) {
							var previewTemplate = 'default preview {{hasScript}}';
							var expected = previewTemplate.replace('{{hasScript}}', true);

							scaffold(FIXTURES_DIR, {
								path: {
									to: {
										pantry: {
											ingredient: ['ingredient.md', 'preview.hbs', 'preview.js']
										}
									}
								}
							});

							fs.writeFileSync(
								path.resolve(
									FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
								previewTemplate
							);

							var middleware = previewMiddleware({
								name: 'pantry',
								path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
							});

							middleware(
								{
									params: {
										0: 'ingredient'
									},
									query: {}
								},
								{
									send: sinon.spy(function (result) {
										t.equal(
											result,
											expected,
											'`hasScript` true if JavaScript entry point'
										);

										t.end();
									})
								},
								next.bind(t)
							);
						});

					t.test('false otherwise', function (t) {
						var previewTemplate = 'default preview {{hasScript}}';
						var expected = previewTemplate.replace('{{hasScript}}', false);

						scaffold(FIXTURES_DIR, {
							path: {
								to: {
									pantry: {
										ingredient: ['ingredient.md', 'preview.hbs']
									}
								}
							}
						});

						fs.writeFileSync(
							path.resolve(
								FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
							previewTemplate
						);

						var middleware = previewMiddleware({
							name: 'pantry',
							path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
						});

						middleware(
							{
								params: {
									0: 'ingredient'
								},
								query: {}
							},
							{
								send: sinon.spy(function (result) {
									t.equal(
										result,
										expected,
										'`hasScript` false otherwise'
									);

									t.end();
								})
							},
							next.bind(t)
						);
					});
				});
			});
		});

		t.test('honors the config.basePreviewModel', function (t) {
			var previewTemplate = '{{>ingredient}}';
			var ingredientTemplate = '{{ @root.test.foo }}';
			var expected = 'bar';

			scaffold(FIXTURES_DIR, {
				path: {
					to: {
						pantry: {
							ingredient: ['ingredient.md', 'index.hbs', 'preview.hbs']
						}
					}
				}
			});

			fs.writeFileSync(
				path.resolve(
					FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
				ingredientTemplate
			);

			fs.writeFileSync(
				path.resolve(
					FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
				previewTemplate
			);

			var middleware = previewMiddleware({
				name: 'pantry',
				path: path.resolve(FIXTURES_DIR, 'path/to/pantry'),
				basePreviewModel: {
					test: {
						foo: 'bar'
					}
				}
			});

			middleware(
				{
					params: {
						0: 'ingredient'
					},
					query: {}
				},
				{
					send: sinon.spy(function (result) {
						t.equal(
							result,
							expected,
							'template rendered into preview template'
						);

						t.end();
					})
				},
				next.bind(t)
			);
		});

		t.test('renders the ingredient with the model entry point if present',
			function (t) {
				var template = '{{{foo}}}';
				var model = {
					foo: 'bar applesauce'
				};
				var expected = template.replace('{{{foo}}}', model.foo);

				scaffold(FIXTURES_DIR, {
					path: {
						to: {
							pantry: {
								ingredient: ['ingredient.md', 'model.js', 'index.hbs']
							}
						}
					}
				});

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
					template
				);

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/model.js'),
					util.format('module.exports = %s;', JSON.stringify(model))
				);

				var middleware = previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
				});

				middleware(
					{
						params: {
							0: 'ingredient'
						},
						query: {}
					},
					{
						send: sinon.spy(function (result) {
							t.match(
								result,
								expected,
								'template rendered with model entry point'
							);

							t.end();
						})
					},
					next.bind(t)
				);
			});

		t.test('renders the ingredient with the configured default model if no ' +
			'model entry point present',
			function (t) {
				var template = '{{{foo}}}';
				var model = {
					foo: 'bar applesauce'
				};
				var expected = template.replace('{{{foo}}}', model.foo);

				scaffold(FIXTURES_DIR, {
					path: {
						to: {
							pantry: {
								ingredient: ['ingredient.md', 'index.hbs']
							}
						}
					}
				});

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
					template
				);

				var middleware = previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'path/to/pantry'),
					defaultModel: model
				});

				middleware(
					{
						params: {
							0: 'ingredient'
						},
						query: {}
					},
					{
						send: sinon.spy(function (result) {
							t.match(
								result,
								expected,
								'template rendered with model entry point'
							);

							t.end();
						})
					},
					next.bind(t)
				);
			});

		t.test('makes model available even in absence of handlebars entrypoint',
			function (t) {
				var previewTemplate = '{{{model.foo}}}';
				var model = {
					foo: 'bar applesauce'
				};
				var expected = previewTemplate.replace('{{{model.foo}}}', model.foo);

				scaffold(FIXTURES_DIR, {
					path: {
						to: {
							pantry: {
								ingredient: ['ingredient.md', 'model.js', 'preview.hbs']
							}
						}
					}
				});

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/model.js'),
					util.format('module.exports = %s;', JSON.stringify(model))
				);

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/preview.hbs'),
					previewTemplate
				);

				var middleware = previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'path/to/pantry'),
					defaultModel: model
				});

				middleware(
					{
						params: {
							0: 'ingredient'
						},
						query: {}
					},
					{
						send: sinon.spy(function (result) {
							t.match(
								result,
								expected,
								'template rendered with model entry point'
							);

							t.end();
						})
					},
					next.bind(t)
				);
			});

		t.test('if passed a model path, renders with a subtree of the model',
			function (t) {
				var template = '{{{applesauce}}}';
				var model = {
					foo: {
						bar: {
							applesauce: 'chutney!'
						}
					}
				};
				var expected =
					template.replace('{{{applesauce}}}', model.foo.bar.applesauce);

				scaffold(FIXTURES_DIR, {
					path: {
						to: {
							pantry: {
								ingredient: ['ingredient.md', 'model.js', 'index.hbs']
							}
						}
					}
				});

				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
					template
				);

				delete require.cache[require.resolve(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/model.js'))];
				fs.writeFileSync(
					path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/model.js'),
					util.format('module.exports = %s;', JSON.stringify(model))
				);

				var middleware = previewMiddleware({
					name: 'pantry',
					path: path.resolve(FIXTURES_DIR, 'path/to/pantry')
				});

				middleware(
					{
						params: {
							0: 'ingredient'
						},
						query: {
							modelPath: 'foo.bar'
						}
					},
					{
						send: sinon.spy(function (result) {
							t.match(
								result,
								expected,
								'template rendered with model entry point'
							);

							t.end();
						})
					},
					next.bind(t)
				);
			});

		t.test('makes any provided helpers available when rendering', function (t) {
			var template = '{{foo 123}} {{bar 321}}';
			var expected = '246 123';

			scaffold(FIXTURES_DIR, {
				path: {
					to: {
						pantry: {
							ingredient: ['ingredient.md', 'model.js', 'index.hbs']
						}
					}
				}
			});

			fs.writeFileSync(
				path.resolve(FIXTURES_DIR, 'path/to/pantry/ingredient/index.hbs'),
				template
			);

			var middleware = previewMiddleware({
				name: 'pantry',
				path: path.resolve(FIXTURES_DIR, 'path/to/pantry'),
				helpers: {
					foo: function (x) {
						return 2 * x;
					},
					bar: function (x) {
						return ('' + x).split('').reverse().join('');
					}
				}
			});

			middleware(
				{
					params: {
						0: 'ingredient'
					},
					query: {}
				},
				{
					send: sinon.spy(function (result) {
						t.match(
							result,
							expected,
							'template rendered with model entry point'
						);

						t.end();
					})
				},
				next.bind(t)
			);
		});
	});
});
