import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {CatalogService} from './catalog.service';
import {Page, ProductInput, ProductView} from '../models';

const view: ProductView = {
	id: 1,
	name: 'Rose',
	description: 'red flower',
	imgUrl: 'https://img/rose',
	price: 250000,
	typeName: 'Daily',
	categoryName: 'Fresh',
	stock: 42
};

const page: Page<ProductView> = {
	content: [view],
	totalElements: 79,
	totalPages: 7,
	page: 0,
	size: 12
};

const input: ProductInput = {
	name: 'Rose',
	description: 'red flower',
	imgUrl: 'https://img/rose',
	price: 250000,
	typeName: 'Daily',
	categoryName: 'Fresh'
};

describe('CatalogService', () => {
	let httpMock: HttpTestingController;
	let catalog: CatalogService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		catalog = TestBed.inject(CatalogService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('pages the catalogue with every filter mapped into query params', () => {
		catalog.page({search: 'rose', category: 'Fresh', type: 'Daily', sort: 'price-asc', page: 2, size: 24}).subscribe();
		const request = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/product');
		expect(request.request.method).toBe('GET');
		expect(request.request.params.toString()).toBe('search=rose&category=Fresh&type=Daily&sort=price-asc&page=2&size=24');
		request.flush(page);
	});

	it('omits empty filters and sends no optional keys for a bare page call', () => {
		catalog.page({search: ''}).subscribe();
		const request = httpMock.expectOne('/api/product');
		expect(request.request.params.keys()).toEqual([]);
		request.flush(page);
	});

	it('fetches one product by id', () => {
		catalog.byId(9).subscribe(result => expect(result).toEqual(view));
		httpMock.expectOne('/api/product/9').flush(view);
	});

	it('bulk upserts the seeded rows', () => {
		catalog.bulkUpsert([input]).subscribe();
		const request = httpMock.expectOne('/api/product');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual([input]);
		request.flush([view]);
	});

	it('creates and updates with the product input body', () => {
		catalog.create(input).subscribe();
		const create = httpMock.expectOne('/api/product/create');
		expect(create.request.body).toEqual(input);
		create.flush(view);
		catalog.update(9, {...input, id: 9}).subscribe();
		const put = httpMock.expectOne('/api/product/9');
		expect(put.request.method).toBe('PUT');
		expect(put.request.body).toEqual({...input, id: 9});
		put.flush(view);
	});

	it('deletes one product and a batch of ids', () => {
		catalog.remove(9).subscribe();
		expect(httpMock.expectOne('/api/product/9').request.method).toBe('DELETE');
		catalog.removeMany([1, 2, 3]).subscribe();
		const bulk = httpMock.expectOne('/api/product');
		expect(bulk.request.method).toBe('DELETE');
		expect(bulk.request.body).toEqual([1, 2, 3]);
	});

	it('surfaces a 404 for a missing product', () => {
		catalog.byId(404).subscribe({
			error: error => expect(error.status).toBe(404)
		});
		httpMock.expectOne('/api/product/404')
			.flush({title: 'Not Found', status: 404}, {status: 404, statusText: 'Not Found'});
	});

	it('walks every page of a filtered query at the size ceiling', () => {
		const collected: ProductView[][] = [];
		catalog.all({search: 'rose'}).subscribe(rows => collected.push(rows));
		const first = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/product');
		expect(first.request.params.get('search')).toBe('rose');
		expect(first.request.params.get('size')).toBe('48');
		expect(first.request.params.get('page')).toBe('0');
		first.flush({content: [view], totalElements: 3, totalPages: 2, page: 0, size: 48});
		const second = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/product');
		expect(second.request.params.get('page')).toBe('1');
		second.flush({content: [{...view, id: 2}, {...view, id: 3}], totalElements: 3, totalPages: 2, page: 1, size: 48});
		expect(collected).toEqual([[view, {...view, id: 2}, {...view, id: 3}]]);
	});

	it('walks a single page without a follow up request', () => {
		const collected: ProductView[][] = [];
		catalog.all({}).subscribe(rows => collected.push(rows));
		httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/product')
			.flush({content: [view], totalElements: 1, totalPages: 1, page: 0, size: 48});
		expect(collected).toEqual([[view]]);
		expect(httpMock.match(() => true).length).toBe(0);
	});
});
