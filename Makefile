.PHONY: install dev build build-prod test lint clean

install:
	npm ci

dev:
	npm start

build:
	npm run build

build-prod:
	npm run build -- --configuration production

test:
	npm test

lint:
	npx ng lint

clean:
	rm -rf dist .angular
