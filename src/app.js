import 'sugar';

import render from './render';

const
	qs = require('qs'),
	ok = require('okay'),
	server = require('webserver').create(),
	system = require('system'),
	ajv = new require('ajv')({
		coerceTypes: true,
		allErrors: true,
		v5: true
	});

const
	port = system.env.PORT || 3491,
	validator = ajv.compile({
		type: 'object',

		properties: {
			url: {
				type: 'string',
				format: 'uri'
			},

			width: {
				type: 'integer',
				minimum: 0
			},

			height: {
				type: 'integer',
				minimum: 0
			}
		},

		additionalProperties: false,

		required: ['url'],

		dependencies: {
			width: {required: ['height']},
			height: {required: ['width']}
		}
	});
server.listen(port, ({url}, response) => {
	console.log('Connection, url', url);

	if (url.split('?')[0] !== '/') {
		response.statusCode = 404;
		response.write('Not Found');
		return response.close();
	}

	const
		query = qs.parse(url.split('?')[1]);

	if (query.url) {
		query.url = window.decodeURIComponent(query.url);
	}

	console.log('query', JSON.stringify(query, null, 2));

	if (!validator(query)) {
		response.statusCode = 400;
		console.log('Errors', JSON.stringify(validator.errors, null, 2));
		response.write(validator.errors.message);
		return response.close();
	}

	console.log('before render', render);

	render(query.url, Object.select(query, 'width', 'height'), (err, img) => {
		if (err) {
			response.statusCode = 400;
			response.write('Internal Server Error');
			return response.close();
		}

		response.headers = {
			'Content-Transfer-Encoding': 'Base64',
			'Content-Type': 'image/png'
		};

		response.statusCode = 200;
		response.write(img);
		response.close();
	});
});

console.log('App launched');
console.log(`http://localhost:${port}/`);
