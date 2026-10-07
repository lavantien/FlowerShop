import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {globalHttpInterceptor} from './global-http-interceptor';

describe('globalHttpInterceptor', () => {
	let httpMock: HttpTestingController;
	let verifyOpenRequests = true;

	beforeEach(() => {
		localStorage.removeItem('token');
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([globalHttpInterceptor])),
				provideHttpClientTesting()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		if (verifyOpenRequests) {
			httpMock.verify();
		}
		verifyOpenRequests = true;
		TestBed.resetTestingModule();
	});

	it('sends the stored token as X-Auth-Token and no basic Authorization header', () => {
		const token = btoa('1+ADMIN');
		localStorage.setItem('token', token);
		const http = TestBed.inject(HttpClient);
		http.get('/api/product').subscribe();
		const req = httpMock.expectOne('/api/product');
		expect(req.request.headers.get('X-Auth-Token')).toBe(token);
		expect(req.request.headers.get('Authorization')).toBeNull();
		req.flush([]);
	});

	it('omits X-Auth-Token when no token is stored', () => {
		localStorage.removeItem('token');
		const http = TestBed.inject(HttpClient);
		http.get('/api/product').subscribe();
		const req = httpMock.expectOne('/api/product');
		expect(req.request.headers.has('X-Auth-Token')).toBe(false);
		req.flush([]);
	});

	it('does not retry failed POST requests', () => {
		const http = TestBed.inject(HttpClient);
		let errors = 0;
		http.post('/api/bill', []).subscribe({error: () => errors++});
		httpMock.expectOne('/api/bill').flush('boom', {status: 500, statusText: 'Server Error'});
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
		// posts never retry, so the first timeout surfaces directly
		http.post('/api/bill', []).subscribe({error: e => errors.push(e)});
		vi.advanceTimersByTime(3000);
		expect(errors).toHaveLength(0);
		vi.advanceTimersByTime(7000);
		expect(errors).toHaveLength(1);
		expect(errors[0].name).toBe('TimeoutError');
		vi.useRealTimers();
	});
});
