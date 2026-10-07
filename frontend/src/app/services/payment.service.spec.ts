import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {PaymentService} from './payment.service';
import {PaymentView} from '../models';

const view: PaymentView = {
	paymentId: '6f1d0a4e',
	orderId: 12,
	amount: 265000,
	status: 'PENDING',
	summary: '2 items for Flowershop'
};

describe('PaymentService', () => {
	let httpMock: HttpTestingController;
	let payments: PaymentService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		payments = TestBed.inject(PaymentService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('gates the fetch on the signature query param', () => {
		payments.byId('6f1d0a4e', 'abc123').subscribe();
		const request = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/payment/6f1d0a4e');
		expect(request.request.method).toBe('GET');
		expect(request.request.params.toString()).toBe('sig=abc123');
		request.flush(view);
	});

	it('confirms and cancels as bodyless posts carrying the signature', () => {
		payments.confirm('6f1d0a4e', 'abc123').subscribe();
		const confirm = httpMock.expectOne(req => req.method === 'POST' && req.url === '/api/payment/6f1d0a4e/confirm');
		expect(confirm.request.method).toBe('POST');
		expect(confirm.request.body).toBeNull();
		expect(confirm.request.params.toString()).toBe('sig=abc123');
		payments.cancel('6f1d0a4e', 'abc123').subscribe();
		const cancel = httpMock.expectOne(req => req.method === 'POST' && req.url === '/api/payment/6f1d0a4e/cancel');
		expect(cancel.request.method).toBe('POST');
		expect(cancel.request.params.toString()).toBe('sig=abc123');
	});

	it('surfaces a 401 for a tampered signature', () => {
		payments.byId('6f1d0a4e', 'deadbeef').subscribe({
			error: error => expect(error.status).toBe(401)
		});
		httpMock.expectOne(req => req.url === '/api/payment/6f1d0a4e')
			.flush({title: 'Unauthorized', status: 401}, {status: 401, statusText: 'Unauthorized'});
	});
});
