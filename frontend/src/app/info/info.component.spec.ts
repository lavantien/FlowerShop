import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {BillRow, InfoComponent} from './info.component';
import {SessionService, SessionUser} from '../core/session.service';
import {Product} from '../_models/product';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'USER',
	enable: true
};

const admin: SessionUser = {...member, id: 1, role: 'ADMIN'};

const products: Product[] = [{
	id: 1,
	name: 'Rose',
	description: 'red flower',
	price: 250000,
	imgUrl: 'https://img/rose',
	quantity: 5,
	saleAmount: 0,
	categoryName: 'Fresh',
	typeName: 'Daily'
}, {
	id: 2,
	name: 'Tulip',
	description: 'pink flower',
	price: 120000,
	imgUrl: '',
	quantity: 3,
	saleAmount: 0,
	categoryName: 'Fresh',
	typeName: 'Daily'
}];

const bills: BillRow[] = [{
	productId: 1,
	productQuantity: 2,
	price: 500000,
	settlementDate: '2026-10-07T09:00:00'
}];

describe('InfoComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<InfoComponent>;

	beforeEach(() => {
		localStorage.clear();
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

	function loginAs(user: SessionUser): void {
		TestBed.inject(SessionService).login('token-1', user);
	}

	function flushBackend(productList: Product[], billList: BillRow[], status = 200) {
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
		loginAs(member);
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend(products, bills);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.isLoggedIn).toBe(true);
		expect(component.isAdmin).toBe(false);
		expect(component.userId).toBe(4);
		expect(component.user().name).toBe('Member');
		expect(component.products()[0].imgUrl).toBe('https://img/rose');
		expect(component.products()[0].price).toBe(250000);
		expect(component.billsRender().map(p => p.name)).toEqual(['Rose']);
		expect(component.countOfIndividualProduct()).toEqual([2]);
		expect(component.totalPriceOfAddedProduct()).toBe(500000);
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
		loginAs(member);
		localStorage.setItem('detailAddress', 'B, Gò Vấp, Hồ Chí Minh');
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend(products, []);
		fixture.detectChanges();
		expect(fixture.componentInstance.user().address).toBe('B, Gò Vấp, Hồ Chí Minh');
	});

	it('keeps empty signals when the product api fails', () => {
		loginAs(member);
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		flushBackend([], [], 500);
		fixture.detectChanges();
		expect(fixture.componentInstance.products()).toEqual([]);
	});

	it('treats null payloads as empty and reports api errors', () => {
		loginAs(member);
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
		loginAs(admin);
		fixture = TestBed.createComponent(InfoComponent);
		fixture.detectChanges();
		httpMock.expectOne('api/user/1').flush({name: 'Admin'});
		httpMock.expectOne('/api/product').flush([]);
		httpMock.expectOne('/api/bill/user/1').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(fixture.componentInstance.isAdmin).toBe(true);
	});
});
