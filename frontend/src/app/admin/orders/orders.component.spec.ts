import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {AdminOrdersComponent} from './orders.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {Order, Page} from '../../models';

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

function order(id: number, status: Order['status']): Order {
	return {
		id,
		userId: 40 + id,
		status,
		placedAt: '2026-10-05T04:00:00Z',
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
		couponCode: null,
		discountAmount: 0,
		subtotal: 250000,
		total: 290000,
		items: [{id: id * 10, productId: 1, productName: 'Rose', unitPrice: 125000, quantity: 2, lineTotal: 250000}]
	};
}

function page(content: Order[], totalElements = content.length, totalPages = 1): Page<Order> {
	return {content, totalElements, totalPages, page: 0, size: 12};
}

describe('AdminOrdersComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminOrdersComponent>;
	let component: AdminOrdersComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminOrdersComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminOrdersComponent);
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
		httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET').flush(page(content, totalElements, totalPages));
		fixture.detectChanges();
	}

	it('loads the admin page with no filter keys when the filters are empty', () => {
		fixture.detectChanges();
		const request = httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET');
		expect(request.request.params.keys()).toEqual(['page', 'size']);
		expect(request.request.params.get('page')).toBe('0');
		request.flush(page([order(3, 'PAID'), order(2, 'PENDING')]));
		fixture.detectChanges();
		expect(component.content().map(entry => entry.id)).toEqual([3, 2]);
		expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="admin-order-status"]').length).toBe(2);
	});

	it('sends the status and date filters as query params', () => {
		fixture.detectChanges();
		flush([order(3, 'PAID')]);
		const element = fixture.nativeElement as HTMLElement;
		const statusSelect = element.querySelector('[data-test="admin-orders-status"]') as HTMLSelectElement;
		statusSelect.value = 'PAID';
		statusSelect.dispatchEvent(new Event('change', {bubbles: true}));
		let request = httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET');
		expect(request.request.params.get('status')).toBe('PAID');
		expect(request.request.params.get('page')).toBe('0');
		request.flush(page([order(3, 'PAID')]));

		const from = element.querySelector('[data-test="admin-orders-from"]') as HTMLInputElement;
		from.value = '2026-10-01';
		from.dispatchEvent(new Event('change', {bubbles: true}));
		request = httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET');
		expect(request.request.params.get('from')).toBe('2026-10-01');
		expect(request.request.params.has('to')).toBe(false);
		request.flush(page([order(3, 'PAID')]));
		const to = element.querySelector('[data-test="admin-orders-to"]') as HTMLInputElement;
		to.value = '2026-10-07';
		to.dispatchEvent(new Event('change', {bubbles: true}));
		request = httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET');
		expect(request.request.params.get('to')).toBe('2026-10-07');
		request.flush(page([]));
		fixture.detectChanges();
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_ORDERS');
	});

	it('shows the empty state when the api fails', () => {
		fixture.detectChanges();
		httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET')
			.flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.content()).toEqual([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_ORDERS');
	});

	it('offers only the legal admin arcs per status', () => {
		fixture.detectChanges();
		flush([order(1, 'PENDING'), order(2, 'PAID'), order(3, 'SHIPPED'), order(4, 'COMPLETED'), order(5, 'CANCELLED')]);
		const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr.order-row');
		const transitions = (row: Element) => row.querySelectorAll('[data-test="admin-order-transition"]').length;
		const cancel = (row: Element) => row.querySelector('[data-test="admin-order-cancel"]') !== null;
		expect(transitions(rows[0])).toBe(0);
		expect(transitions(rows[1])).toBe(1);
		expect(transitions(rows[2])).toBe(1);
		expect(transitions(rows[3])).toBe(0);
		expect(transitions(rows[4])).toBe(0);
		expect(cancel(rows[0])).toBe(true);
		expect(cancel(rows[1])).toBe(true);
		expect(cancel(rows[2])).toBe(true);
		expect(cancel(rows[3])).toBe(false);
		expect(cancel(rows[4])).toBe(false);
	});

	it('posts the ship transition and updates the row in place', () => {
		const success = vi.spyOn(toast, 'success');
		fixture.detectChanges();
		flush([order(2, 'PAID')]);
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-order-transition"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/order/2/status');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({status: 'SHIPPED'});
		request.flush(order(2, 'SHIPPED'));
		fixture.detectChanges();
		expect(component.content()[0].status).toBe('SHIPPED');
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('cancels through the cancel endpoint and toasts', () => {
		const success = vi.spyOn(toast, 'success');
		fixture.detectChanges();
		flush([order(2, 'PAID')]);
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-order-cancel"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/order/2/cancel');
		expect(request.request.method).toBe('POST');
		request.flush(order(2, 'CANCELLED'));
		fixture.detectChanges();
		expect(component.content()[0].status).toBe('CANCELLED');
		expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-order-cancel"]')).toBeNull();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('toasts and clears the busy flag when a mutation is refused', () => {
		const danger = vi.spyOn(toast, 'danger');
		fixture.detectChanges();
		flush([order(2, 'PAID')]);
		component.onCancel(order(2, 'PAID'));
		httpMock.expectOne('/api/order/2/cancel').flush(
			{title: 'Conflict', status: 409, code: 'ILLEGAL_TRANSITION'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.busy()).toBeNull();
	});

	it('ignores a second mutation while one is in flight', () => {
		fixture.detectChanges();
		flush([order(2, 'PAID'), order(3, 'PAID')]);
		component.onCancel(order(2, 'PAID'));
		component.onTransition(order(3, 'PAID'), 'SHIPPED');
		const pending = httpMock.match(req => req.url.startsWith('/api/order'));
		expect(pending.filter(req => req.request.method === 'POST').length).toBe(1);
		pending.filter(req => req.request.method === 'POST')[0].flush(order(2, 'CANCELLED'));
	});

	it('expands the item detail of a row', () => {
		fixture.detectChanges();
		flush([order(2, 'PAID')]);
		const element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('[data-test="admin-order-item"]')).toBeNull();
		(element.querySelector('tbody tr.order-row') as HTMLElement).click();
		fixture.detectChanges();
		expect(element.querySelectorAll('[data-test="admin-order-item"]').length).toBe(1);
		expect(element.textContent).toContain('2 x');
		(element.querySelector('tbody tr.order-row') as HTMLElement).click();
		fixture.detectChanges();
		expect(element.querySelector('[data-test="admin-order-item"]')).toBeNull();
	});

	it('pages through the admin list', () => {
		fixture.detectChanges();
		flush([order(2, 'PAID')], 26, 3);
		const pageButtons = (fixture.nativeElement as HTMLElement)
			.querySelectorAll('.pagination-page a') as NodeListOf<HTMLElement>;
		const pageTwo = Array.from(pageButtons).find(button => button.textContent?.trim() === '2');
		pageTwo?.click();
		fixture.detectChanges();
		const request = httpMock.expectOne(req => req.url === '/api/order' && req.method === 'GET');
		expect(request.request.params.get('page')).toBe('1');
		request.flush(page([order(1, 'SHIPPED')], 26, 3));
		expect(component.page()).toBe(1);
	});
});
