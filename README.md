# morbo

[![Build Status][build-badge-image]][build-link]


## Development setup

You will require [NPM][npm-link] or [Yarn][yarn-link], and preferable an editor that
supports JavaScript and linting with ESLint.

### Install dependencies
If using NPM, `npm i`.

If using Yarn, `yarn`.

### Starting development server
A Makefile is provided that lets you run tasks in parallel and can be used to avoid
running the TypeScript compiler and development server in two different shells. Use `make`
to start both in parallel.

Alternatively start each manually. First start up the TypeScript compiler with `npm run
tsc`. Then in another shell start the development server with `npm run serve`. Then start
electron using `npm run start`.

### Linting
To check for link errors, run `npm run lint` or `yarn lint`.

To fix some error automatically, run `npm run lint-fix` or `yarn lint-fix`. Rest of the
errors will need to be fixed manually.


[build-link]: https://api.travis-ci.org/BigBlockDataChain/morbo.svg?branch=master
[build-badge-image]: https://api.travis-ci.org/BigBlockDataChain/morbo.svg?branch=master

[npm-link]: https://www.npmjs.com/
[yarn-link]: https://yarnpkg.com/en/
