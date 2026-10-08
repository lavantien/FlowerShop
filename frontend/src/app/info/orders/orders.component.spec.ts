import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {OrdersComponent} from './orders.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {Order, Page} from '../../models';

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

function order(id: number, status: Order['status']): Order {
	return {
		id,
		userId: 4,
		status,
		placedAt: '2026-10-07T04:00:00Z',
		paidAt: null,
		shippedAt: null,
		completedAt: null,
		cancelledAt: null,
		phone: '0900000004',
		address: '12 Nguyen Hue',
		district: 'Bình Thạnh',
		city: 'Hồ Chí Minh',
		branchId: 2,
		branchName: 'Bình Thạnh',
		distanceKm: 4.2,
		deliveryFee: 40000,
		couponCode: 'WELCOME10',
		discountAmount: 25000,
		subtotal: 250000,
		total: 265000,
		items: [{id: id * 10, productId: 1, productName: 'Rose', unitPrice: 125000, quantity: 2, lineTotal: 250000}]
	};
}

function page(content: Order[], totalElements: number, totalPages: number): Page<Order> {
	return {content, totalElements, totalPages, page: 0, size: 12};
}

describe('OrdersComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<OrdersComponent>;
	let component: OrdersComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [OrdersComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', member);
		fixture = TestBed.createComponent(OrdersComponent);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	function flush(content: Order[], totalElements = content.length, totalPages = 1): void {
		httpMock.expectOne(req => req.url === '/api/order/me').flush(page(content, totalElements, totalPages));
		fixture.detectChanges();
	}

	it('loads the member history page newest first', () => {
		fixture.detectChanges();
		flush([order(12, 'PENDING'), order(11, 'COMPLETED')]);
		const element: HTMLElement = fixture.nativeElement;
		expect(component.orders().map(entry => entry.id)).toEqual([12, 11]);
		expect(element.querySelectorAll('[data-test="order-card"]').length).toBe(2);
		expect(element.textContent).toContain('INFO.ORDER #12');
		expect(element.textContent).toContain('2 x Rose');
		expect(element.textContent).toContain('₫265,000');
		expect(element.textContent).toContain('Bình Thạnh (4.2 km)');
	});

	it('shows the empty state when the api fails', () => {
		fixture.detectChanges();
		httpMock.expectOne(req => req.url === '/api/order/me').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.orders()).toEqual([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('INFO.NO_ORDERS');
	});

	it('offers cancel only while an order is pending', () => {
		fixture.detectChanges();
		flush([order(12, 'PENDING'), order(11, 'SHIPPED'), order(10, 'CANCELLED')]);
		const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="order-card"]');
		expect(cards[0].querySelector('[data-test="order-cancel"]')).not.toBeNull();
		expect(cards[1].querySelector('[data-test="order-cancel"]')).toBeNull();
		expect(cards[2].querySelector('[data-test="order-cancel"]')).toBeNull();
		expect((cards[0].querySelector('[data-test="order-status"]') as HTMLElement).textContent).toContain('INFO.STATUS_PENDING');
	});

	it('cancels a pending order and keeps its card in place', () => {
		const success = vi.spyOn(toast, 'success');
		fixture.detectChanges();
		flush([order(12, 'PENDING')]);
		(fixture.nativeElement.querySelector('[data-test="order-cancel"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/order/12/cancel');
		expect(request.request.method).toBe('POST');
		request.flush(order(12, 'CANCELLED'));
		fixture.detectChanges();
		expect(component.orders()[0].status).toBe('CANCELLED');
		expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="order-cancel"]')).toBeNull();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('toasts and keeps the order when the cancel is refused', () => {
		const danger = vi.spyOn(toast, 'danger');
		fixture.detectChanges();
		flush([order(12, 'PAID')]);
		component.onCancel(order(12, 'PAID'));
		httpMock.expectOne('/api/order/12/cancel').flush(
			{title: 'Conflict', status: 409, code: 'ILLEGAL_TRANSITION'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.cancelling()).toBeNull();
	});

	it('ignores a second cancel while one is in flight', () => {
		fixture.detectChanges();
		flush([order(12, 'PENDING')]);
		component.onCancel(order(12, 'PENDING'));
		component.onCancel(order(12, 'PENDING'));
		const pending = httpMock.match(req => req.url === '/api/order/12/cancel');
		expect(pending.length).toBe(1);
		pending[0].flush(order(12, 'CANCELLED'));
	});

	it('pages the history through the pagination control', () => {
		fixture.detectChanges();
		flush([order(12, 'PENDING')], 26, 3);
		const pageButtons = (fixture.nativeElement as HTMLElement).querySelectorAll('.pagination-page a') as NodeListOf<HTMLElement>;
		const pageTwo = Array.from(pageButtons).find(button => button.textContent?.trim() === '2');
		pageTwo?.click();
		fixture.detectChanges();
		const request = httpMock.expectOne(req => req.url === '/api/order/me');
		expect(request.request.params.get('page')).toBe('1');
		request.flush(page([order(11, 'PAID')], 26, 3));
		expect(component.page()).toBe(1);
		expect(component.rangeLabel()).toBe('13-13 / 26');
	});
});
