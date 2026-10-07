import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {TaxonomyService} from './taxonomy.service';
import {Category, Type} from '../models';

describe('TaxonomyService', () => {
	let httpMock: HttpTestingController;
	let taxonomy: TaxonomyService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		taxonomy = TestBed.inject(TaxonomyService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('lists, creates, updates, and deletes categories', () => {
		taxonomy.categories().subscribe();
		httpMock.expectOne('/api/category').flush([{id: 1, name: 'Fresh'}] satisfies Category[]);
		taxonomy.createCategory({name: 'Pot'}).subscribe();
		const create = httpMock.expectOne('/api/category/create');
		expect(create.request.method).toBe('POST');
		expect(create.request.body).toEqual({name: 'Pot'});
		taxonomy.updateCategory(1, {name: 'Fresh cut'}).subscribe();
		const update = httpMock.expectOne('/api/category/1');
		expect(update.request.method).toBe('PUT');
		expect(update.request.body).toEqual({name: 'Fresh cut'});
		taxonomy.removeCategory(1).subscribe();
		expect(httpMock.expectOne('/api/category/1').request.method).toBe('DELETE');
	});

	it('lists, creates, updates, and deletes types with their category name', () => {
		taxonomy.types().subscribe();
		httpMock.expectOne('/api/type').flush([{id: 1, name: 'Daily', categoryName: 'Fresh'}] satisfies Type[]);
		taxonomy.createType({name: 'Event', categoryName: 'Fresh'}).subscribe();
		const create = httpMock.expectOne('/api/type/create');
		expect(create.request.body).toEqual({name: 'Event', categoryName: 'Fresh'});
		taxonomy.updateType(1, {name: 'Daily', categoryName: 'Pot'}).subscribe();
		const update = httpMock.expectOne('/api/type/1');
		expect(update.request.method).toBe('PUT');
		expect(update.request.body).toEqual({name: 'Daily', categoryName: 'Pot'});
		taxonomy.removeType(1).subscribe();
		expect(httpMock.expectOne('/api/type/1').request.method).toBe('DELETE');
	});

	it('surfaces the name-in-use conflict on a duplicate category', () => {
		taxonomy.createCategory({name: 'Fresh'}).subscribe({
			error: error => expect(error.status).toBe(409)
		});
		httpMock.expectOne('/api/category/create')
			.flush({title: 'Conflict', status: 409, code: 'NAME_IN_USE'}, {status: 409, statusText: 'Conflict'});
	});
});
