import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {globalHttpInterceptor} from './global-http-interceptor';
import {SessionService, SessionUser} from './session.service';
import {ToastService} from './toast.service';
import {API} from '../services/api';

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

describe('globalHttpInterceptor', () => {
	let httpMock: HttpTestingController;
	let session: SessionService;
	let toasts: ToastService;
	let verifyOpenRequests = true;

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
	});

	afterEach(() => {
		if (verifyOpenRequests) {
			httpMock.verify();
		}
		verifyOpenRequests = true;
		TestBed.resetTestingModule();
		localStorage.clear();
	});

	it('sends the session token as X-Auth-Token and no basic Authorization header', () => {
		session.login('token-1', member);
		const http = TestBed.inject(HttpClient);
		http.get('/api/user/me').subscribe();
		const req = httpMock.expectOne('/api/user/me');
		expect(req.request.headers.get('X-Auth-Token')).toBe('token-1');
		expect(req.request.headers.get('Authorization')).toBeNull();
		req.flush({});
	});

	it('omits X-Auth-Token when no session is live', () => {
		const http = TestBed.inject(HttpClient);
		http.get('/api/product').subscribe();
		const req = httpMock.expectOne('/api/product');
		expect(req.request.headers.has('X-Auth-Token')).toBe(false);
		req.flush([]);
	});

	it('does not retry failed POST requests', () => {
		const http = TestBed.inject(HttpClient);
		let errors = 0;
		http.post('/api/order', {}).subscribe({error: () => errors++});
		httpMock.expectOne('/api/order').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(errors).toBe(1);
		httpMock.verify();
	});

	it('retries failed GET requests twice before surfacing the error', () => {
		const http = TestBed.inject(HttpClient);
		let errors = 0;
		http.get('/api/product').subscribe({error: () => errors++});
		httpMock.expectOne('/api/product').flush('boom', {status: 500, statusText: 'Server Error'});
		httpMock.expectOne('/api/product').flush('boom', {status: 500, statusText: 'Server Error'});
		httpMock.expectOne('/api/product').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(errors).toBe(1);
	});

	it('waits 10 seconds before timing out a request', () => {
		verifyOpenRequests = false;
		vi.useFakeTimers();
		const http = TestBed.inject(HttpClient);
		const errors: {name?: string}[] = [];
		http.post('/api/order', {}).subscribe({error: e => errors.push(e)});
		vi.advanceTimersByTime(3000);
		expect(errors).toHaveLength(0);
		vi.advanceTimersByTime(7000);
		expect(errors).toHaveLength(1);
		expect(errors[0].name).toBe('TimeoutError');
		vi.useRealTimers();
	});

	it('shows the problem detail as a danger toast on other errors', () => {
		const http = TestBed.inject(HttpClient);
		let errors = 0;
		http.post('/api/order', {}).subscribe({error: () => errors++});
		httpMock.expectOne('/api/order').flush(
			{type: 'about:blank', title: 'Conflict', status: 409, detail: 'Roses are out of stock.', code: 'OUT_OF_STOCK'},
			{status: 409, statusText: 'Conflict'});
		expect(errors).toBe(1);
		expect(toasts.toasts()).toHaveLength(1);
		expect(toasts.toasts()[0].kind).toBe('danger');
		expect(toasts.toasts()[0].message).toBe('Roses are out of stock.');
	});

	it('falls back to a status line when the body carries no detail', () => {
		const http = TestBed.inject(HttpClient);
		http.post('/api/order', {}).subscribe({error: () => undefined});
		httpMock.expectOne('/api/order').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(toasts.toasts()[0].message).toBe('Request failed with status 500.');
	});

	it('clears the session, requests the login modal and toasts on 401', () => {
		session.login('token-1', member);
		const requested = session.loginRequested();
		const http = TestBed.inject(HttpClient);
		let errors = 0;
		http.post('/api/order', {}).subscribe({error: () => errors++});
		httpMock.expectOne('/api/order').flush(
			{title: 'Unauthorized', status: 401, detail: 'Session is no longer valid.'},
			{status: 401, statusText: 'Unauthorized'});
		expect(errors).toBe(1);
		expect(session.isLoggedIn()).toBe(false);
		expect(localStorage.getItem('token')).toBeNull();
		expect(session.loginRequested()).toBe(requested + 1);
		expect(toasts.toasts()[0].message).toBe('Session is no longer valid.');
	});

	it('toasts the fallback session message on a 401 without a body', () => {
		const http = TestBed.inject(HttpClient);
		http.post('/api/order', {}).subscribe({error: () => undefined});
		httpMock.expectOne('/api/order').flush(null, {status: 401, statusText: 'Unauthorized'});
		expect(session.loginRequested()).toBe(1);
		expect(toasts.toasts()[0].message).toBe('Session expired. Please sign in again.');
	});

	it('keeps the session and stays silent on a 401 from a payment path', () => {
		session.login('token-1', member);
		const requested = session.loginRequested();
		const http = TestBed.inject(HttpClient);
		let errors = 0;
		http.post(API.payments.confirm('pay-1'), null).subscribe({error: () => errors++});
		httpMock.expectOne(API.payments.confirm('pay-1')).flush(
			{title: 'Unauthorized', status: 401, detail: 'Payment signature is wrong.'},
			{status: 401, statusText: 'Unauthorized'});
		expect(errors).toBe(1);
		expect(session.isLoggedIn()).toBe(true);
		expect(localStorage.getItem('token')).toBe('token-1');
		expect(session.loginRequested()).toBe(requested);
		expect(toasts.toasts()).toHaveLength(0);
	});

	it('still toasts the problem detail on non 401 errors from a payment path', () => {
		const http = TestBed.inject(HttpClient);
		http.post(API.payments.cancel('pay-1'), null).subscribe({error: () => undefined});
		httpMock.expectOne(API.payments.cancel('pay-1')).flush(
			{type: 'about:blank', title: 'Conflict', status: 409, detail: 'The payment is already confirmed.', code: 'PAYMENT_CONFIRMED'},
			{status: 409, statusText: 'Conflict'});
		expect(toasts.toasts()).toHaveLength(1);
		expect(toasts.toasts()[0].kind).toBe('danger');
		expect(toasts.toasts()[0].message).toBe('The payment is already confirmed.');
	});
});
