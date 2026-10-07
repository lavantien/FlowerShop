import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {WishlistService} from './wishlist.service';
import {ProductView, WishlistEntry} from '../models';

const rose: ProductView = {
	id: 1,
	name: 'Rose',
	description: 'red flower',
	imgUrl: 'https://img/rose',
	price: 250000,
	typeName: 'Daily',
	categoryName: 'Fresh',
	stock: 42
};

const entry: WishlistEntry = {
	product: rose,
	createdAt: '2026-10-07T04:00:00Z'
};

describe('WishlistService', () => {
	let httpMock: HttpTestingController;
	let wishlist: WishlistService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		wishlist = TestBed.inject(WishlistService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('lists the member wishlist newest first', () => {
		wishlist.mine().subscribe();
		httpMock.expectOne('/api/wishlist/me').flush([entry]);
	});

	it('toggles a product by its id', () => {
		wishlist.toggle(1).subscribe();
		const request = httpMock.expectOne('/api/wishlist/me/1');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toBeNull();
		request.flush({added: true});
	});

	it('surfaces a 404 for an unknown product', () => {
		wishlist.toggle(404).subscribe({
			error: error => expect(error.status).toBe(404)
		});
		httpMock.expectOne('/api/wishlist/me/404')
			.flush({title: 'Not Found', status: 404}, {status: 404, statusText: 'Not Found'});
	});
});
