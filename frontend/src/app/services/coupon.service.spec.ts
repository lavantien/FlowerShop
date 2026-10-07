import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {CouponService} from './coupon.service';
import {Coupon, CouponInput} from '../models';

const coupon: Coupon = {
	id: 1,
	code: 'WELCOME10',
	kind: 'PERCENT',
	value: 10,
	active: true,
	expiresAt: null
};

const input: CouponInput = {
	code: 'SHIP50K',
	kind: 'FIXED',
	value: 50000,
	active: true,
	expiresAt: '2027-01-01T00:00:00Z'
};

describe('CouponService', () => {
	let httpMock: HttpTestingController;
	let coupons: CouponService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		coupons = TestBed.inject(CouponService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('lists the coupon table', () => {
		coupons.list().subscribe();
		httpMock.expectOne('/api/coupon').flush([coupon]);
	});

	it('creates and updates with the coupon body', () => {
		coupons.create(input).subscribe();
		const create = httpMock.expectOne('/api/coupon');
		expect(create.request.method).toBe('POST');
		expect(create.request.body).toEqual(input);
		coupons.update(1, {...input, active: false}).subscribe();
		const update = httpMock.expectOne('/api/coupon/1');
		expect(update.request.method).toBe('PUT');
		expect(update.request.body).toEqual({...input, active: false});
	});

	it('removes a coupon', () => {
		coupons.remove(1).subscribe();
		expect(httpMock.expectOne('/api/coupon/1').request.method).toBe('DELETE');
	});

	it('validates a code against the subtotal', () => {
		coupons.validate({code: 'WELCOME10', subtotal: 250000}).subscribe();
		const request = httpMock.expectOne('/api/coupon/validate');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({code: 'WELCOME10', subtotal: 250000});
	});

	it('surfaces the inactive coupon conflict', () => {
		coupons.validate({code: 'EXPIRED5', subtotal: 250000}).subscribe({
			error: error => expect(error.status).toBe(409)
		});
		httpMock.expectOne('/api/coupon/validate')
			.flush({title: 'Conflict', status: 409, code: 'COUPON_INACTIVE'}, {status: 409, statusText: 'Conflict'});
	});
});
