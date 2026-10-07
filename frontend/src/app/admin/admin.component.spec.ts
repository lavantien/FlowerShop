import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {AdminComponent, buildExportFilename} from './admin.component';
import {ToastService} from '../core/toast.service';
import {SessionService, SessionUser} from '../core/session.service';
import {Product} from '../_models/product';

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

describe('AdminComponent request bodies', () => {
	let httpMock: HttpTestingController;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				provideTranslateService()
			]
		});
		TestBed.inject(SessionService).login('token-1', admin);
		vi.spyOn(TestBed.inject(BsModalService), 'show').mockReturnValue({hide: vi.fn()} as unknown as BsModalRef);
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		vi.spyOn(toast, 'success');
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	function createAdmin(productList: Product[] = []): AdminComponent {
		const created = TestBed.createComponent(AdminComponent);
		created.detectChanges();
		httpMock.match(() => true).forEach(req => {
			if (req.request.url === '/api/product') {
				req.flush(productList);
			} else {
				req.flush([{name: 'C'}]);
			}
		});
		created.detectChanges();
		return created.componentInstance;
	}

	it('posts the create form as a plain json body, no encoding, no price conversion', () => {
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
			price: 460000,
			imgUrl: 'https://example.com/rose.png',
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

	it('puts the edit form as a plain json body', () => {
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
			price: 222,
			imgUrl: 'https://example.com/tulip.png',
			quantity: 3,
			saleAmount: 10,
			categoryName: 'Fresh',
			typeName: 'Daily'
		});
		expect(component.createForm.price).toBe(111);
		req.flush({});
		httpMock.expectOne('/api/product').flush([]);
	});

	it('posts the parsed excel rows untouched', () => {
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
			price: 460000,
			imgUrl: '',
			quantity: 5,
			saleAmount: 0,
			categoryName: 'Fresh',
			typeName: 'Daily'
		}]);
		req.flush(rows);
		httpMock.expectOne('/api/product').flush([]);
		expect(toast.success).toHaveBeenCalledTimes(1);
	});

	it('clones the edited row so the form does not mutate the table', () => {
		const row: Product = {
			id: 7,
			name: 'Tulip',
			description: 'a description longer than the fifty character truncation applied to the table',
			price: 222,
			imgUrl: '',
			quantity: 3,
			saleAmount: 10,
			categoryName: 'Fresh',
			typeName: 'Daily'
		};
		const component = createAdmin([row]);
		component.openEditModal({} as never, 7);
		component.editForm.name = 'Edited';
		expect(component.data()[0].name).toBe('Tulip');
	});

	it('ignores an edit open for a missing product', () => {
		const component = createAdmin();
		expect(component.modalRef).toBeUndefined();
		component.openEditModal({} as never, 999);
		expect(component.modalRef).toBeUndefined();
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
