import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Locales } from '../../../dist/types/public/config.js';
import {
	computeCurrentLocale,
	computePreferredLocale,
	computePreferredLocaleList,
} from '../../../dist/i18n/utils.js';
import {
	getPathByLocale,
	getLocaleByPath,
	getAllCodes,
	toCodes,
	toPaths,
} from '../../../dist/i18n/index.js';

describe('computeCurrentLocale', () => {
	const stringLocales = ['en', 'fr', 'es'];

	it('detects locale in first path segment', () => {
		assert.equal(computeCurrentLocale('/en/about', stringLocales, 'en'), 'en');
	});

	it('detects non-default locale', () => {
		assert.equal(computeCurrentLocale('/fr/about', stringLocales, 'en'), 'fr');
	});

	it('returns default locale when no locale in path', () => {
		assert.equal(computeCurrentLocale('/about', stringLocales, 'en'), 'en');
	});

	it('returns default locale for root path', () => {
		assert.equal(computeCurrentLocale('/', stringLocales, 'en'), 'en');
	});

	it('handles .html extension in segments', () => {
		assert.equal(computeCurrentLocale('/fr.html', stringLocales, 'en'), 'fr');
	});

	it('handles case-insensitive locale matching', () => {
		assert.equal(computeCurrentLocale('/EN/about', stringLocales, 'en'), 'en');
	});

	it('handles object locales with path', () => {
		const locales = [{ path: 'spanish', codes: ['es', 'es-ES'] as [string, ...string[]] }, 'en'];
		assert.equal(computeCurrentLocale('/spanish/about', locales, 'en'), 'es');
	});

	it('handles object locales with codes matching segment', () => {
		const locales = [{ path: 'spanish', codes: ['es', 'es-ES'] as [string, ...string[]] }, 'en'];
		assert.equal(computeCurrentLocale('/es/about', locales, 'en'), 'es');
	});

	it('returns first code for object locale default', () => {
		const locales = [{ path: 'english', codes: ['en', 'en-US'] as [string, ...string[]] }, 'fr'];
		assert.equal(computeCurrentLocale('/about', locales, 'english'), 'en');
	});
});

describe('computePreferredLocale', () => {
	const locales = ['en', 'fr', 'es'];

	it('returns the best match from Accept-Language', () => {
		const req = new Request('http://example.com/', {
			headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
		});
		assert.equal(computePreferredLocale(req, locales), 'fr');
	});

	it('returns undefined when no match', () => {
		const req = new Request('http://example.com/', {
			headers: { 'Accept-Language': 'de,ja' },
		});
		assert.equal(computePreferredLocale(req, locales), undefined);
	});

	it('returns undefined when no Accept-Language header', () => {
		const req = new Request('http://example.com/');
		assert.equal(computePreferredLocale(req, locales), undefined);
	});

	describe('regression: issue #16598 (first-match wins on object-form locales)', () => {
		interface FirstMatchCase {
			readonly name: string;
			readonly locales: ReadonlyArray<string | { path: string; codes: string[] }>;
			readonly accept: string;
			readonly expected: string;
		}

		const buildRequest = (acceptLanguage: string): Request => {
			return new Request('http://example.com/', {
				headers: { 'Accept-Language': acceptLanguage },
			});
		};

		const runCase = (testCase: FirstMatchCase): void => {
			const request = buildRequest(testCase.accept);
			const actual = computePreferredLocale(request, testCase.locales as Locales);
			assert.equal(actual, testCase.expected, testCase.name);
		};

		const cases: FirstMatchCase[] = [
			{
				name: 'object-then-string: object code wins over later string',
				locales: [{ path: 'us', codes: ['EN-US'] }, 'en-us'],
				accept: 'en-us',
				expected: 'EN-US',
			},
			{
				name: 'object-then-object: first codes entry wins over normalize-equivalent later one',
				locales: [
					{ path: 'us', codes: ['EN'] },
					{ path: 'gb', codes: ['en'] },
				],
				accept: 'en',
				expected: 'EN',
			},
			{
				name: 'object-with-multi-codes still resolves to the matched code (not the path)',
				locales: [{ path: 'us', codes: ['xx', 'EN-US', 'yy'] }, 'en-us'],
				accept: 'en-us',
				expected: 'EN-US',
			},
		];

		for (const testCase of cases) {
			it(testCase.name, () => {
				runCase(testCase);
			});
		}

		it('falls through to undefined when no entry matches (sanity guard for early return)', () => {
			const onlyObject: Locales = [{ path: 'us', codes: ['EN'] }];
			const request = buildRequest('de');
			assert.equal(computePreferredLocale(request, onlyObject), undefined);
		});
	});
});

describe('computePreferredLocaleList', () => {
	const locales = ['en', 'fr', 'es'];

	it('returns all matching locales sorted by quality', () => {
		const req = new Request('http://example.com/', {
			headers: { 'Accept-Language': 'es;q=1.0,en;q=0.8,fr;q=0.5' },
		});
		assert.deepEqual(computePreferredLocaleList(req, locales), ['es', 'en', 'fr']);
	});

	it('returns empty array when no match', () => {
		const req = new Request('http://example.com/', {
			headers: { 'Accept-Language': 'de' },
		});
		assert.deepEqual(computePreferredLocaleList(req, locales), []);
	});
});

describe('getPathByLocale', () => {
	it('returns the locale itself for string locales', () => {
		assert.equal(getPathByLocale('en', ['en', 'fr']), 'en');
	});

	it('returns the path for object locales', () => {
		const locales = [{ path: 'spanish', codes: ['es', 'es-ES'] as [string, ...string[]] }, 'en'];
		assert.equal(getPathByLocale('es', locales), 'spanish');
	});

	it('throws for unknown locale', () => {
		assert.throws(() => getPathByLocale('de', ['en', 'fr']));
	});
});

describe('getLocaleByPath', () => {
	it('returns the locale for string locales', () => {
		assert.equal(getLocaleByPath('en', ['en', 'fr']), 'en');
	});

	it('returns the first code for object locales', () => {
		const locales = [{ path: 'spanish', codes: ['es', 'es-ES'] as [string, ...string[]] }, 'en'];
		assert.equal(getLocaleByPath('spanish', locales), 'es');
	});
});

describe('getAllCodes', () => {
	it('returns all codes from string and object locales', () => {
		const locales = ['en', { path: 'spanish', codes: ['es', 'es-ES'] as [string, ...string[]] }];
		assert.deepEqual(getAllCodes(locales), ['en', 'es', 'es-ES']);
	});

	it('handles all string locales', () => {
		assert.deepEqual(getAllCodes(['en', 'fr']), ['en', 'fr']);
	});
});

describe('toCodes', () => {
	it('returns first code per locale entry', () => {
		const locales = ['en', { path: 'spanish', codes: ['es', 'es-ES'] as [string, ...string[]] }];
		assert.deepEqual(toCodes(locales), ['en', 'es']);
	});
});

describe('toPaths', () => {
	it('returns path strings for all locales', () => {
		const locales = ['en', { path: 'spanish', codes: ['es'] as [string, ...string[]] }];
		assert.deepEqual(toPaths(locales), ['en', 'spanish']);
	});
});
