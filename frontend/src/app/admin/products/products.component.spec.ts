import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {ProductsComponent} from './products.component';
import {buildExportFilename} from './excel';
import {ToastService} from '../../core/toast.service';
import {SessionService, SessionUser} from '../../core/session.service';
import {Page, ProductInput, ProductView} from '../../models';

const admin: SessionUser = {
	id: 1,
	name: 'Admin',
	email: 'admin@flowershop.example',
	phone: '0900000001',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'ADMIN',
	enable: true
};

function productView(id: number, name: string, price: number): ProductView {
	return {
		id,
		name,
		description: `flower ${id}`,
		imgUrl: 'https://img.example/rose.png',
		price,
		typeName: 'Daily',
		categoryName: 'Fresh',
		stock: 5 + id
	};
}

function productPage(content: ProductView[], totalElements = content.length, totalPages = 1): Page<ProductView> {
	return {content, totalElements, totalPages, page: 0, size: 12};
}

describe('ProductsComponent request bodies', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<ProductsComponent>;
	let component: ProductsComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [ProductsComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', admin);
		vi.spyOn(TestBed.inject(BsModalService), 'show').mockReturnValue({hide: vi.fn()} as unknown as BsModalRef);
		fixture = TestBed.createComponent(ProductsComponent);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			vi.unstubAllGlobals();
			localStorage.clear();
		}
	});

	function mount(page: Page<ProductView> = productPage([])): void {
		fixture.detectChanges();
		httpMock.match(() => true).forEach(request => {
			if (request.request.url === '/api/product' && request.request.method === 'GET') {
				request.flush(page);
			} else {
				request.flush([{name: 'C'}]);
			}
		});
		fixture.detectChanges();
	}

	it('posts the create form as a plain product input body, no quantity or sale amount', () => {
		mount();
		component.openCreateModal({} as never);
		component.form.patchValue({
			name: 'Rose',
			description: 'red flower',
			price: 460000,
			imgUrl: 'https://example.com/rose.png',
			categoryName: 'Fresh',
			typeName: 'Daily'
		});
		component.onSubmit();
		const request = httpMock.expectOne('/api/product/create');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({
			name: 'Rose',
			description: 'red flower',
			price: 460000,
			imgUrl: 'https://example.com/rose.png',
			categoryName: 'Fresh',
			typeName: 'Daily'
		});
		expect(request.request.body).not.toHaveProperty('quantity');
		expect(request.request.body).not.toHaveProperty('saleAmount');
		request.flush(productView(1, 'Rose', 460000));
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(productPage([]));
	});

	it('puts the edit form as a plain product input body against the row id', () => {
		mount(productPage([productView(7, 'Tulip', 222)]));
		component.openEditModal({} as never, productView(7, 'Tulip', 222));
		component.form.patchValue({name: 'Tulips', price: 333});
		component.onSubmit();
		const request = httpMock.expectOne('/api/product/7');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body.name).toBe('Tulips');
		expect(request.request.body.price).toBe(333);
		expect(request.request.body).not.toHaveProperty('quantity');
		request.flush(productView(7, 'Tulips', 333));
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(productPage([]));
	});

	it('refuses to submit while the form is invalid', () => {
		mount();
		component.openCreateModal({} as never);
		component.form.patchValue({name: '', price: -1});
		component.onSubmit();
		expect(httpMock.match(req => req.method === 'POST').length).toBe(0);
	});

	it('does not mutate the table row while editing it', () => {
		const row = productView(7, 'Tulip', 222);
		mount(productPage([row]));
		component.openEditModal({} as never, row);
		component.form.patchValue({name: 'Edited'});
		expect(component.content()[0].name).toBe('Tulip');
	});

	it('posts the parsed excel rows untouched', () => {
		const success = vi.spyOn(toast, 'success');
		mount();
		const rows: ProductInput[] = [{
			id: 1,
			name: 'Rose',
			description: 'red flower',
			price: 460000,
			imgUrl: '',
			typeName: 'Daily',
			categoryName: 'Fresh'
		}];
		component.onImportExcel(rows);
		const request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'POST');
		expect(request.request.body).toEqual([{
			id: 1,
			name: 'Rose',
			description: 'red flower',
			price: 460000,
			imgUrl: '',
			typeName: 'Daily',
			categoryName: 'Fresh'
		}]);
		request.flush(rows);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(productPage([]));
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('deletes one selected row through the single endpoint', () => {
		const success = vi.spyOn(toast, 'success');
		mount(productPage([productView(1, 'Rose', 1)]));
		component.selectRow(0);
		component.onDelete();
		const request = httpMock.expectOne('/api/product/1');
		expect(request.request.method).toBe('DELETE');
		request.flush(null);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(productPage([]));
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('deletes several selected rows in bulk with the id list as the body', () => {
		mount(productPage([productView(1, 'Rose', 1), productView(2, 'Tulip', 2), productView(3, 'Lily', 3)]));
		component.selectRow(0);
		component.selectRow(2);
		component.onDelete();
		const request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'DELETE');
		expect(request.request.body).toEqual([1, 3]);
		request.flush(null);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(productPage([]));
	});
});

describe('buildExportFilename', () => {
	it('uses the vietnamese file name for the vi interface', () => {
		expect(buildExportFilename('vi', new Date(2026, 0, 7, 8, 5, 3))).toBe('sản_phẩm__7/1/2026__08:05:03.xlsx');
	});

	it('uses an ascii file name for the english interface', () => {
		expect(buildExportFilename('en', new Date(2026, 0, 7, 8, 5, 3))).toBe('data__1/7/2026__8:05:03 AM.xlsx');
	});
});
