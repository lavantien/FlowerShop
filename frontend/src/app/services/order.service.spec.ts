import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {OrderService} from './order.service';
import {CheckoutResponse, Order, Page} from '../models';

const order: Order = {
	id: 12,
	userId: 4,
	status: 'PENDING',
	placedAt: '2026-10-07T04:00:00Z',
	paidAt: null,
	shippedAt: null,
	completedAt: null,
	cancelledAt: null,
	phone: '0900000004',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	branchId: 3,
	branchName: 'Binh Thanh',
	distanceKm: 4.2,
	deliveryFee: 40000,
	couponCode: 'WELCOME10',
	discountAmount: 25000,
	subtotal: 250000,
	total: 265000,
	items: [{
		id: 1,
		productId: 1,
		productName: 'Rose',
		unitPrice: 250000,
		quantity: 1,
		lineTotal: 250000
	}]
};

const checkout: CheckoutResponse = {
	order,
	payment: {id: '6f1d0a4e', redirectUrl: '/pay/6f1d0a4e?sig=abc123'}
};

describe('OrderService', () => {
	let httpMock: HttpTestingController;
	let orders: OrderService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		orders = TestBed.inject(OrderService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('posts the checkout body with the optional branch and coupon', () => {
		orders.checkout({
			items: [{productId: 1, quantity: 2}],
			phone: '0900000004',
			address: 'A',
			district: 'Binh Thanh',
			city: 'Ho Chi Minh',
			branchId: 3,
			couponCode: 'WELCOME10'
		}).subscribe();
		const request = httpMock.expectOne('/api/order');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({
			items: [{productId: 1, quantity: 2}],
			phone: '0900000004',
			address: 'A',
			district: 'Binh Thanh',
			city: 'Ho Chi Minh',
			branchId: 3,
			couponCode: 'WELCOME10'
		});
		request.flush(checkout);
	});

	it('pages the member history newest first', () => {
		orders.mine(1, 20).subscribe();
		const request = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/order/me');
		expect(request.request.params.toString()).toBe('page=1&size=20');
		request.flush({content: [order], totalElements: 1, totalPages: 1, page: 1, size: 20} satisfies Page<Order>);
	});

	it('maps the admin filters and drops the empty ones', () => {
		orders.admin({status: 'PAID', from: '2026-10-01', to: '', page: 0, size: 12}).subscribe();
		const request = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/order');
		expect(request.request.params.toString()).toBe('status=PAID&from=2026-10-01&page=0&size=12');
		request.flush({content: [], totalElements: 0, totalPages: 0, page: 0, size: 12} satisfies Page<Order>);
	});

	it('fetches one order for the owner or an admin', () => {
		orders.byId(12).subscribe();
		httpMock.expectOne('/api/order/12').flush(order);
	});

	it('cancels and transitions through the status endpoint', () => {
		orders.cancel(12).subscribe();
		const cancel = httpMock.expectOne('/api/order/12/cancel');
		expect(cancel.request.method).toBe('POST');
		expect(cancel.request.body).toBeNull();
		orders.setStatus(12, 'SHIPPED').subscribe();
		const status = httpMock.expectOne('/api/order/12/status');
		expect(status.request.method).toBe('POST');
		expect(status.request.body).toEqual({status: 'SHIPPED'});
	});

	it('surfaces the out-of-stock conflict naming the items', () => {
		orders.checkout({
			items: [{productId: 1, quantity: 99}],
			phone: '0900000004',
			address: 'A',
			district: 'Binh Thanh',
			city: 'Ho Chi Minh'
		}).subscribe({
			error: error => {
				expect(error.status).toBe(409);
				expect(error.error.code).toBe('OUT_OF_STOCK');
			}
		});
		httpMock.expectOne('/api/order').flush(
			{title: 'Conflict', status: 409, code: 'OUT_OF_STOCK', detail: 'Rose'},
			{status: 409, statusText: 'Conflict'}
		);
	});
});
