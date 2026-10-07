import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {InfoComponent} from './info.component';
import {Product} from '../_models/product';
import {Bill} from '../_models/bill';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const products: Product[] = [{
	id: 1,
	name: 'Rose',
	description: 'red flower',
	price: 1,
	imgUrl: 'aGk=',
	quantity: 5,
	saleAmount: 0,
	categoryName: 'Fresh',
	typeName: 'Daily'
}, {
	id: 2,
	name: 'Tulip',
	description: 'pink flower',
	price: 1,
	imgUrl: '',
	quantity: 3,
	saleAmount: 0,
	categoryName: 'Fresh',
	typeName: 'Daily'
}];

const bills: Bill[] = [{
	placementDate: '2026-10-07T08:00:00',
	productId: 1,
	productQuantity: 2,
	price: 13230,
	userId: 4,
	settlementDate: '2026-10-07T09:00:00',
	status: 'SUCCESS',
	phone: '0900000004',
	detailAddress: 'A, Bình Thạnh, Hồ Chí Minh'
}];

describe('InfoComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<InfoComponent>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [InfoComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'shop', component: EmptyComponent},
					{path: 'admin', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		localStorage.clear();
	});

	function flushBackend(productList: Product[], billList: Bill[], status = 200) {
		const component = fixture.componentInstance;
		if (component.userId !== 0) {
			httpMock.expectOne(`api/user/${component.userId}`).flush({name: 'Member'});
		}
		if (status === 200) {
			httpMock.expectOne('/api/product').flush(productList.map(p => ({...p})));
			httpMock.expectOne(`/api/bill/user/${component.userId}`).flush(billList);
		} else {
			httpMock.expectOne('/api/product').flush('boom', {status, statusText: 'Server Error'});
		}
	}

	it('renders the member profile with their purchase history', () => {
		localStorage.setItem('token', btoa('4+MEMBER'));
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend(products, bills);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.isLoggedIn).toBe(true);
		expect(component.isAdmin).toBe(false);
		expect(component.userId).toBe(4);
		expect(component.user().name).toBe('Member');
		expect(component.products()[0].imgUrl).toBe('hi');
		expect(component.products()[0].price).toBe(1 * 23000.0 - 9770);
		expect(component.billsRender().map(p => p.name)).toEqual(['Rose']);
		expect(component.countOfIndividualProduct()).toEqual([2]);
		expect(component.totalPriceOfAddedProduct()).toBe(13230);
		expect(fixture.nativeElement.textContent).toContain('Rose');
	});

	it('renders the guest placeholder and the empty history row for an anonymous visitor', () => {
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend([], []);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.isLoggedIn).toBe(false);
		expect(component.userId).toBe(0);
		expect(component.user().name).toBe('GUESS');
		expect(component.billsRender()).toEqual([]);
		expect(fixture.nativeElement.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('falls back to the stored address when the profile omits it', () => {
		localStorage.setItem('token', btoa('4+MEMBER'));
		localStorage.setItem('detailAddress', 'B, Gò Vấp, Hồ Chí Minh');
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend(products, []);
		fixture.detectChanges();
		expect(fixture.componentInstance.user().address).toBe('B, Gò Vấp, Hồ Chí Minh');
	});

	it('keeps empty signals when the product api fails', () => {
		localStorage.setItem('token', btoa('4+MEMBER'));
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend([], [], 500);
		fixture.detectChanges();
		expect(fixture.componentInstance.products()).toEqual([]);
	});

	it('treats null payloads as empty and reports api errors', () => {
		localStorage.setItem('token', btoa('4+MEMBER'));
		localStorage.removeItem('detailAddress');
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		httpMock.expectOne('api/user/4').flush({name: 'Member'});
		httpMock.expectOne('/api/product').flush(null);
		httpMock.expectOne('/api/bill/user/4').flush(null);
		fixture.detectChanges();
		expect(fixture.componentInstance.products()).toEqual([]);
		expect(fixture.componentInstance.billsRender()).toEqual([]);
		expect(fixture.componentInstance.user().address).toBe('');
	});

	it('marks an admin session and redirects', () => {
		localStorage.setItem('token', btoa('1+ADMIN'));
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		httpMock.expectOne('api/user/1').flush({name: 'Admin'});
		httpMock.expectOne('/api/product').flush([]);
		httpMock.expectOne('/api/bill/user/1').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(fixture.componentInstance.isAdmin).toBe(true);
	});
});
