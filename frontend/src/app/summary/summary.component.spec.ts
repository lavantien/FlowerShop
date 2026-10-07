import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {BillRow, SummaryComponent} from './summary.component';
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
	settlementDate: '2026-10-07T09:00:00',
	userId: 4
}];

describe('SummaryComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<SummaryComponent>;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [SummaryComponent],
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

	it('renders every settled bill across users', () => {
		loginAs(admin);
		fixture = TestBed.createComponent(SummaryComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush(products.map(p => ({...p})));
		httpMock.expectOne('/api/bill').flush(bills);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.isLoggedIn).toBe(true);
		expect(component.isAdmin).toBe(true);
		expect(component.products()[0].imgUrl).toBe('https://img/rose');
		expect(component.products()[0].price).toBe(250000);
		expect(component.billsRender().map(p => p.name)).toEqual(['Rose']);
		expect(component.countOfIndividualProduct()).toEqual([2]);
		expect(component.totalPriceOfAddedProduct()).toBe(500000);
		expect(component.userIds()).toEqual([4]);
		expect(component.settlementDate()).toEqual(['2026-10-07T09:00:00']);
		expect(fixture.nativeElement.textContent).toContain('Rose');
	});

	it('renders the empty row when no bill exists for an anonymous visitor', () => {
		fixture = TestBed.createComponent(SummaryComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush([]);
		httpMock.expectOne('/api/bill').flush([]);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.isLoggedIn).toBe(false);
		expect(component.billsRender()).toEqual([]);
		expect(fixture.nativeElement.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('keeps empty signals when the product api fails', () => {
		fixture = TestBed.createComponent(SummaryComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(fixture.componentInstance.products()).toEqual([]);
	});

	it('treats null payloads as empty and reports bill api errors', () => {
		loginAs(member);
		fixture = TestBed.createComponent(SummaryComponent);
		fixture.detectChanges();
		expect(fixture.componentInstance.isLoggedIn).toBe(true);
		httpMock.expectOne('/api/product').flush(null);
		httpMock.expectOne('/api/bill').flush(null);
		fixture.detectChanges();
		expect(fixture.componentInstance.products()).toEqual([]);
		expect(fixture.componentInstance.billsRender()).toEqual([]);
	});

	it('reports failures from the bill api', () => {
		fixture = TestBed.createComponent(SummaryComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush(products.map(p => ({...p})));
		httpMock.expectOne('/api/bill').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(fixture.componentInstance.billsRender()).toEqual([]);
	});
});
