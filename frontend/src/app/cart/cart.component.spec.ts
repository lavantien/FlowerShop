import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../locale';
import {CartComponent} from './cart.component';
import {CartService} from '../core/cart.service';
import {SessionService, SessionUser} from '../core/session.service';
import {ToastService} from '../core/toast.service';
import {Branch, CheckoutResponse, CouponValidation} from '../models';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: '12 Nguyen Hue',
	district: 'Bình Thạnh',
	city: 'Hồ Chí Minh',
	role: 'USER',
	enable: true
};

const branches: Branch[] = [
	{id: 1, name: 'Tân Bình', address: 'A street', district: 'Tân Bình', city: 'Hồ Chí Minh', lat: 10.8, lng: 106.65, active: true},
	{id: 2, name: 'Bình Thạnh', address: 'B street', district: 'Bình Thạnh', city: 'Hồ Chí Minh', lat: 10.81, lng: 106.7, active: true}
];

const checkoutResponse: CheckoutResponse = {
	order: {
		id: 12, userId: 4, status: 'PENDING', placedAt: '2026-10-07T04:00:00Z', paidAt: null, shippedAt: null,
		completedAt: null, cancelledAt: null, phone: '0900000004', address: '12 Nguyen Hue', district: 'Bình Thạnh',
		city: 'Hồ Chí Minh', branchId: 2, branchName: 'Bình Thạnh', distanceKm: 4.2, deliveryFee: 40000,
		couponCode: 'WELCOME10', discountAmount: 25000, subtotal: 250000, total: 265000,
		items: [{id: 1, productId: 1, productName: 'Rose', unitPrice: 250000, quantity: 1, lineTotal: 250000}]
	},
	payment: {id: '6f1d0a4e', redirectUrl: '/pay/6f1d0a4e?sig=abc123'}
};

describe('CartComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<CartComponent>;
	let component: CartComponent;
	let cart: CartService;
	let toast: ToastService;
	let assign: (url: string) => void;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [CartComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'shop', component: EmptyComponent},
					{path: 'cart', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		cart = TestBed.inject(CartService);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', member);
		fixture = TestBed.createComponent(CartComponent);
		component = fixture.componentInstance;
		assign = vi.fn();
		vi.spyOn(component, 'redirectToGateway').mockImplementation(url => assign(url));
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Hồ Chí Minh'}, {name: 'Đà Nẵng'}]);
		httpMock.expectOne('../assets/data/districts.json').flush([
			{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'},
			{name: 'Tân Bình', cityName: 'Hồ Chí Minh'},
			{name: 'Hải Châu', cityName: 'Đà Nẵng'}
		]);
		httpMock.expectOne('/api/branch').flush(branches);
		fixture.detectChanges();
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	function fill(lines: {id: number; quantity: number}[]): void {
		for (const line of lines) {
			cart.add({
				id: line.id,
				name: `Flower ${line.id}`,
				imgUrl: `https://img/${line.id}`,
				price: 100000,
				categoryName: 'Fresh',
				typeName: 'Daily'
			});
			cart.changeQuantity(line.id, line.quantity);
		}
		fixture.detectChanges();
	}

	it('shows the empty state without the checkout form', () => {
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('CART.EMPTY');
		expect(element.querySelector('[data-test="cart-checkout"]')).toBeNull();
		expect(element.querySelector('a[routerLink="/shop"]')).not.toBeNull();
	});

	it('renders the lines with quantities, line totals, and the subtotal', () => {
		fill([{id: 1, quantity: 2}, {id: 2, quantity: 1}]);
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelectorAll('tbody tr').length).toBe(3);
		expect(element.textContent).toContain('Flower 1');
		expect((element.querySelector('[data-test="cart-qty"]') as HTMLElement).textContent).toBe('2');
		expect(element.textContent).toContain('₫200,000');
		expect(element.textContent).toContain('₫300,000');
	});

	it('prefills the delivery form from the session user', () => {
		fill([{id: 1, quantity: 1}]);
		const element: HTMLElement = fixture.nativeElement;
		expect((element.querySelector('[data-test="cart-phone"]') as HTMLInputElement).value).toBe('0900000004');
		expect((element.querySelector('[data-test="cart-address"]') as HTMLInputElement).value).toBe('12 Nguyen Hue');
		expect((element.querySelector('[data-test="cart-district"]') as HTMLSelectElement).value).toBe('Bình Thạnh');
	});

	it('narrows the districts to the chosen city and resets to the first', () => {
		fill([{id: 1, quantity: 1}]);
		const element: HTMLElement = fixture.nativeElement;
		const citySelect = element.querySelector('[data-test="cart-city"]') as HTMLSelectElement;
		citySelect.value = 'Đà Nẵng';
		citySelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		const districtSelect = element.querySelector('[data-test="cart-district"]') as HTMLSelectElement;
		expect(Array.from(districtSelect.options).map(option => option.value)).toEqual(['Hải Châu']);
		expect(districtSelect.value).toBe('Hải Châu');
	});

	it('steers quantity and removal through the cart service', () => {
		fill([{id: 1, quantity: 2}]);
		const element: HTMLElement = fixture.nativeElement;
		(element.querySelector('[data-test="cart-inc"]') as HTMLButtonElement).click();
		expect(cart.lines()[0].quantity).toBe(3);
		(element.querySelector('[data-test="cart-dec"]') as HTMLButtonElement).click();
		expect(cart.lines()[0].quantity).toBe(2);
		(element.querySelector('[data-test="cart-remove"]') as HTMLButtonElement).click();
		expect(cart.lines()).toEqual([]);
		fixture.detectChanges();
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('CART.EMPTY');
	});

	it('previews a coupon through the validate endpoint and computes the payable', () => {
		fill([{id: 1, quantity: 2}]);
		const element: HTMLElement = fixture.nativeElement;
		const couponInput = element.querySelector('[data-test="cart-coupon"]') as HTMLInputElement;
		couponInput.value = 'WELCOME10';
		couponInput.dispatchEvent(new Event('change', {bubbles: true}));
		(element.querySelector('[data-test="cart-coupon-apply"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/coupon/validate');
		expect(request.request.body).toEqual({code: 'WELCOME10', subtotal: 200000});
		const validation: CouponValidation = {code: 'WELCOME10', kind: 'PERCENT', value: 10, discountAmount: 20000};
		request.flush(validation);
		fixture.detectChanges();
		expect(component.coupon()).toEqual(validation);
		expect(component.payable()).toBe(180000);
		expect(element.textContent).toContain('₫20,000');
	});

	it('clears the preview and toasts when the coupon is rejected', () => {
		fill([{id: 1, quantity: 1}]);
		const danger = vi.spyOn(toast, 'danger');
		component.couponCode.set('EXPIRED5');
		component.applyCoupon();
		httpMock.expectOne('/api/coupon/validate').flush(
			{title: 'Conflict', status: 409, code: 'COUPON_INACTIVE'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(component.coupon()).toBeNull();
		expect(danger).toHaveBeenCalled();
	});

	it('drops a stale coupon preview when the cart changes', () => {
		fill([{id: 1, quantity: 2}]);
		component.couponCode.set('WELCOME10');
		component.applyCoupon();
		httpMock.expectOne('/api/coupon/validate')
			.flush({code: 'WELCOME10', kind: 'PERCENT', value: 10, discountAmount: 20000});
		expect(component.coupon()).not.toBeNull();
		component.inc(1);
		expect(component.coupon()).toBeNull();
		expect(component.payable()).toBe(300000);
	});

	it('clears the coupon through the preview remove button', () => {
		fill([{id: 1, quantity: 1}]);
		component.couponCode.set('WELCOME10');
		component.applyCoupon();
		httpMock.expectOne('/api/coupon/validate')
			.flush({code: 'WELCOME10', kind: 'PERCENT', value: 10, discountAmount: 10000});
		fixture.detectChanges();
		(fixture.nativeElement.querySelector('[data-test="cart-coupon-remove"]') as HTMLButtonElement).click();
		expect(component.coupon()).toBeNull();
		expect(component.couponCode()).toBe('');
		expect(component.payable()).toBe(100000);
	});

	it('ignores an apply for a blank code', () => {
		fill([{id: 1, quantity: 1}]);
		component.applyCoupon();
		httpMock.expectNone('/api/coupon/validate');
		expect(component.coupon()).toBeNull();
	});

	it('blocks submit on an incomplete form and fires no order', () => {
		fill([{id: 1, quantity: 1}]);
		component.form.controls.phone.setValue('');
		const element: HTMLElement = fixture.nativeElement;
		(element.querySelector('[data-test="cart-checkout"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		httpMock.expectNone('/api/order');
		expect(component.invalidCheckout()).toBe(true);
		expect(element.textContent).toContain('CART.CHECKOUT_INVALID');
	});

	it('posts the order with the chosen branch and coupon, then redirects the browser to the gateway url', () => {
		fill([{id: 1, quantity: 2}]);
		const element: HTMLElement = fixture.nativeElement;
		const branchSelect = element.querySelector('[data-test="cart-branch"]') as HTMLSelectElement;
		branchSelect.value = '2';
		branchSelect.dispatchEvent(new Event('change', {bubbles: true}));
		component.couponCode.set('WELCOME10');
		component.applyCoupon();
		httpMock.expectOne('/api/coupon/validate')
			.flush({code: 'WELCOME10', kind: 'PERCENT', value: 10, discountAmount: 20000});
		(element.querySelector('[data-test="cart-checkout"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/order');
		expect(request.request.body).toEqual({
			items: [{productId: 1, quantity: 2}],
			phone: '0900000004',
			address: '12 Nguyen Hue',
			district: 'Bình Thạnh',
			city: 'Hồ Chí Minh',
			branchId: 2,
			couponCode: 'WELCOME10'
		});
		request.flush(checkoutResponse);
		expect(assign).toHaveBeenCalledWith('/pay/6f1d0a4e?sig=abc123');
		expect(cart.lines()).toEqual([]);
	});

	it('omits branch and coupon when neither is chosen', () => {
		fill([{id: 3, quantity: 1}]);
		(fixture.nativeElement.querySelector('[data-test="cart-checkout"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/order');
		expect(request.request.body).toEqual({
			items: [{productId: 3, quantity: 1}],
			phone: '0900000004',
			address: '12 Nguyen Hue',
			district: 'Bình Thạnh',
			city: 'Hồ Chí Minh'
		});
		request.flush(checkoutResponse);
	});

	it('keeps the cart and unlocks the button when the order fails', () => {
		fill([{id: 1, quantity: 1}]);
		const danger = vi.spyOn(toast, 'danger');
		(fixture.nativeElement.querySelector('[data-test="cart-checkout"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/order').flush(
			{title: 'Conflict', status: 409, code: 'OUT_OF_STOCK', detail: 'Rose'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(cart.lines().length).toBe(1);
		expect(component.submitting()).toBe(false);
		expect(assign).not.toHaveBeenCalled();
		expect(danger).toHaveBeenCalled();
	});
});
