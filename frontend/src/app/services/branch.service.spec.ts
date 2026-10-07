import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {BranchService} from './branch.service';
import {Branch, BranchInput, StockRow} from '../models';

const branch: Branch = {
	id: 3,
	name: 'Binh Thanh',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	lat: 10.78,
	lng: 106.71,
	active: true
};

const input: BranchInput = {
	name: 'Binh Thanh',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	lat: 10.78,
	lng: 106.71,
	active: true
};

describe('BranchService', () => {
	let httpMock: HttpTestingController;
	let branches: BranchService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		branches = TestBed.inject(BranchService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('lists branches publicly', () => {
		branches.list().subscribe();
		httpMock.expectOne('/api/branch').flush([branch]);
	});

	it('creates and updates with the branch body', () => {
		branches.create(input).subscribe();
		const create = httpMock.expectOne('/api/branch');
		expect(create.request.method).toBe('POST');
		expect(create.request.body).toEqual(input);
		branches.update(3, {...input, active: false}).subscribe();
		const update = httpMock.expectOne('/api/branch/3');
		expect(update.request.method).toBe('PUT');
		expect(update.request.body).toEqual({...input, active: false});
	});

	it('removes a branch and reports stock-row conflicts', () => {
		branches.remove(3).subscribe();
		expect(httpMock.expectOne('/api/branch/3').request.method).toBe('DELETE');
		branches.remove(9).subscribe({
			error: error => expect(error.status).toBe(409)
		});
		httpMock.expectOne('/api/branch/9')
			.flush({title: 'Conflict', status: 409, code: 'STOCK_ROWS_EXIST'}, {status: 409, statusText: 'Conflict'});
	});

	it('reads and absolutely sets the per-branch stock', () => {
		branches.stock(3).subscribe();
		httpMock.expectOne('/api/branch/3/stock').flush([{productId: 1, quantity: 25}] satisfies StockRow[]);
		branches.setStock(3, {productId: 1, quantity: 0}).subscribe();
		const put = httpMock.expectOne('/api/branch/3/stock');
		expect(put.request.method).toBe('PUT');
		expect(put.request.body).toEqual({productId: 1, quantity: 0});
	});
});
