import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {SeededGenerator} from '../../testing/seeded-generator';
import {globalHttpInterceptor} from './global-http-interceptor';
import {SessionService, SessionUser} from './session.service';
import {ToastService} from './toast.service';

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'USER',
	enable: true
};

// Garbage bodies a broken backend or a proxy can answer with: html error
// pages, arrays, null, wrong typed or nested detail fields, truncations.
// Typed to what HttpTestingController.flush accepts.
function garbageBodies(gen: SeededGenerator): (string | number | boolean | object | null)[] {
	return [
		null, '', 'Internal Server Error', '<html><body><h1>502 Bad Gateway</h1></body></html>',
		'{title: "Conflict", detail: "unquoted"}', 0, -1, 42, true, [], [1, 2], ['detail', 'x'],
		{}, {detail: undefined}, {detail: null}, {detail: 0}, {detail: -7}, {detail: true}, {detail: []},
		{detail: {}}, {detail: {message: 'nested'}}, {detail: ['a', 'b']}, {title: 'Conflict'},
		{title: 'Conflict', status: 409}, {detail: ''}, {detail: '   '},
		{detail: 'Roses are out of stock.'}, {detail: gen.string(120)},
		{detail: 'x'.repeat(4000)}, {detail: '💥 lỗi server 中断'},
		{type: 'about:blank', title: 'Error', detail: 'ok', extra: {deep: {deeper: [1, 2, 3]}}}
	];
}

// The mapping the app defines: a string non empty detail wins, otherwise the
// 401 session line or the plain status line.
function expectedMessage(body: unknown, status: number): string {
	if (typeof body === 'object' && body !== null && 'detail' in body) {
		const detail = (body as {detail?: unknown}).detail;
		if (typeof detail === 'string' && detail !== '') {
			return detail;
		}
	}
	return status === 401 ? 'Session expired. Please sign in again.' : `Request failed with status ${status}.`;
}

describe('globalHttpInterceptor fuzz', () => {
	let httpMock: HttpTestingController;
	let session: SessionService;
	let toasts: ToastService;
	let gen: SeededGenerator;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([globalHttpInterceptor])),
				provideHttpClientTesting()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		session = TestBed.inject(SessionService);
		toasts = TestBed.inject(ToastService);
		gen = new SeededGenerator();
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		localStorage.clear();
	});

	it('maps every garbage body to the defined toast line without throwing', () => {
		const statuses = [400, 401, 403, 404, 409, 418, 500, 502, 503];
		for (const body of garbageBodies(gen)) {
			for (const status of statuses) {
				toasts.toasts().forEach(toast => toasts.dismiss(toast.id));
				const http = TestBed.inject(HttpClient);
				let errors = 0;
				// posts never retry, so each flush surfaces exactly one error
				http.post('/api/order', {}).subscribe({error: () => errors++});
				const flush = (): void => {
					httpMock.expectOne('/api/order').flush(body, {status, statusText: 'Err'});
				};
				expect(flush, `status=${status} body=${JSON.stringify(body)}`).not.toThrow();
				expect(errors).toBe(1);
				expect(toasts.toasts()).toHaveLength(1);
				expect(toasts.toasts()[0].message).toBe(expectedMessage(body, status));
				expect(toasts.toasts()[0].kind).toBe('danger');
			}
		}
	});

	it('keeps the rethrown error untouched for every garbage body', () => {
		const bodies = garbageBodies(gen);
		for (let i = 0; i < 40; i++) {
			toasts.toasts().forEach(toast => toasts.dismiss(toast.id));
			const body = bodies[gen.intBetween(0, bodies.length - 1)];
			const status = gen.intBetween(400, 599);
			const http = TestBed.inject(HttpClient);
			const seen: unknown[] = [];
			http.post('/api/order', {}).subscribe({error: error => seen.push(error)});
			httpMock.expectOne('/api/order').flush(body, {status, statusText: 'Err'});
			expect(seen).toHaveLength(1);
			expect((seen[0] as {status: number}).status).toBe(status);
			// the test backend carries an empty string body as no body at all
			expect((seen[0] as {error: unknown}).error).toBe(body === '' ? null : body);
		}
	});

	it('clears the session and requests login exactly once per generated 401', () => {
		for (let i = 0; i < 30; i++) {
			localStorage.clear();
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [
					provideHttpClient(withInterceptors([globalHttpInterceptor])),
					provideHttpClientTesting()
				]
			});
			httpMock = TestBed.inject(HttpTestingController);
			session = TestBed.inject(SessionService);
			toasts = TestBed.inject(ToastService);
			session.login('token-' + i, member);
			const http = TestBed.inject(HttpClient);
			let errors = 0;
			http.post('/api/order', {}).subscribe({error: () => errors++});
			httpMock.expectOne('/api/order')
				.flush(gen.flag() ? null : {detail: gen.string(30)}, {status: 401, statusText: 'Unauthorized'});
			expect(errors).toBe(1);
			expect(session.isLoggedIn()).toBe(false);
			expect(session.loginRequested()).toBe(1);
			expect(localStorage.getItem('token')).toBeNull();
		}
	});

	it('never clears the session for generated non 401 failures', () => {
		for (let i = 0; i < 30; i++) {
			const status = gen.intBetween(400, 599) === 401 ? 409 : gen.intBetween(400, 599);
			session.login('token-' + i, member);
			const http = TestBed.inject(HttpClient);
			http.post('/api/order', {}).subscribe({error: () => undefined});
			httpMock.expectOne('/api/order').flush(gen.string(40), {status, statusText: 'Err'});
			expect(session.isLoggedIn(), `status=${status}`).toBe(true);
			expect(session.loginRequested()).toBe(0);
		}
	});
});
