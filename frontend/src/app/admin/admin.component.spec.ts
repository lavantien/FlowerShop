import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {AdminComponent} from './admin.component';
import {Product} from '../_models/product';

describe('AdminComponent request bodies', () => {
	let httpMock: HttpTestingController;

	beforeEach(() => {
		localStorage.setItem('token', btoa('1+ADMIN'));
		vi.stubGlobal('alert', vi.fn());
		TestBed.configureTestingModule({
			imports: [AdminComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		localStorage.removeItem('token');
	});

	function createAdmin(): AdminComponent {
		const component = TestBed.createComponent(AdminComponent).componentInstance;
		httpMock.match(() => true).forEach(req => {
			if (req.request.url === '/api/product') {
				req.flush([]);
			} else {
				req.flush([{name: 'C'}]);
			}
		});
		return component;
	}

	it('posts the create form as a json body with encoded image and en price', () => {
		const component = createAdmin();
		component.createForm = {
			name: 'Rose',
			description: 'red flower',
			price: 460000,
			imgUrl: 'https://example.com/rose.png',
			quantity: 5,
			saleAmount: 0,
			categoryName: 'Fresh',
			typeName: 'Daily'
		};
		component.onCreate();
		const req = httpMock.expectOne('/api/product/create');
		expect(req.request.method).toBe('POST');
		expect(req.request.body).toEqual({
			name: 'Rose',
			description: 'red flower',
			price: (460000 + 9770) / 23000.0,
			imgUrl: btoa('https://example.com/rose.png'),
			quantity: 5,
			saleAmount: 0,
			categoryName: 'Fresh',
			typeName: 'Daily'
		});
		expect(component.createForm.imgUrl).toBe('https://example.com/rose.png');
		expect(component.createForm.price).toBe(460000);
		req.flush({});
		httpMock.expectOne('/api/product').flush([]);
	});

	it('puts the edit form as a json body derived from editForm values', () => {
		const component = createAdmin();
		component.currentId = 7;
		component.createForm.price = 111;
		component.editForm = {
			name: 'Tulip',
			description: 'pink flower',
			price: 222,
			imgUrl: 'https://example.com/tulip.png',
			quantity: 3,
			saleAmount: 10,
			categoryName: 'Fresh',
			typeName: 'Daily'
		};
		component.onEdit();
		const req = httpMock.expectOne('/api/product/7');
		expect(req.request.method).toBe('PUT');
		expect(req.request.body).toEqual({
			name: 'Tulip',
			description: 'pink flower',
			price: (222 + 9770) / 23000.0,
			imgUrl: btoa('https://example.com/tulip.png'),
			quantity: 3,
			saleAmount: 10,
			categoryName: 'Fresh',
			typeName: 'Daily'
		});
		expect(component.createForm.price).toBe(111);
		req.flush({});
		httpMock.expectOne('/api/product').flush([]);
	});

	it('posts the parsed excel rows with en prices', () => {
		const component = createAdmin();
		const rows: Product[] = [{
			id: 1,
			name: 'Rose',
			description: 'red flower',
			price: 460000,
			imgUrl: '',
			quantity: 5,
			saleAmount: 0,
			categoryName: 'Fresh',
			typeName: 'Daily'
		}];
		component.onImportExcel(rows);
		const req = httpMock.expectOne('/api/product');
		expect(req.request.method).toBe('POST');
		expect(req.request.body).toEqual([{
			id: 1,
			name: 'Rose',
			description: 'red flower',
			price: (460000 + 9770) / 23000.0,
			imgUrl: '',
			quantity: 5,
			saleAmount: 0,
			categoryName: 'Fresh',
			typeName: 'Daily'
		}]);
		req.flush(rows);
		httpMock.expectOne('/api/product').flush([]);
		expect(alert).toHaveBeenCalledTimes(1);
	});
});
