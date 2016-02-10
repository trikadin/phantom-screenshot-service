const
	system = require('system'),
	webpage = require('webpage'),
	async = require('async');

const
	maxWorkers = system.env.WORKERS_LIMIT || 10;

function open(url, callback) {
	const page = webpage.create();
	page.settings = {
		javascriptEnabled: false,
		loadImages: true
	};

	console.log('opening page', url);

	page.onLoadFinished = (status) => {
		console.log('page', url, 'is opened, status:', status);

		if (status !== 'success') {
			page.close();
			return callback(new Error(`Loading of ${url} is failed`));
		}

		console.log('callback in open');
		callback(null, [page, url]);
	};

	page.open(url);
}

function render(page, {width, height}) {
	console.log('Render');
	if (width && height) {
		page.viewportSize = {width, height};
	}

	return page.renderBase64('PNG');
}

function renderAll([page, url], callback) {
	console.log('call renderAll', Array.isArray(page), arguments.length);
	const
		tasks = currentUrls[url];

	if (!tasks) {
		return callback(null);
	}

	console.log('Rendering', tasks.length, 'images');

	tasks.forEach(({options, callback}) => callback(null, render(page, options)));

	delete currentUrls[url];
	page.close();

	callback(null);
}

function onError(err, url, callback) {
	const
		tasks = currentUrls[url];

	if (!tasks) {
		return callback(null);
	}

	tasks.map(({callback}) => callback(err));
	callback(null);
}

const
	currentUrls = {},
	queue = async.queue((url, callback) => {
		console.log('Run task', url);
		if (!currentUrls[url]) {
			return callback(null);
		}

		async.waterfall([
			(next) => async.retry(5, (cb) => open(url, (err, page, url) => {
				console.log('Callback!');
				cb(null, page, url);
			}), next),
			renderAll
		], (err) => {
			if (err) {
				return onError(err, url, callback);
			}

			callback(null);
		});

	}, maxWorkers);

export default function (url: string, options = {}, callback: Function) {
	console.log('Render');
	const first = !currentUrls[url];

	console.log('New rendering request,', url, first);

	if (first) {
		currentUrls[url] = [];
	}

	currentUrls[url].push({options, callback});

	console.log('now urls', JSON.stringify(currentUrls));

	if (first) {
		queue.push(url);
	}
}
