import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import '../../locale';
import {AdminDashboardComponent} from './dashboard.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {SalesReport} from '../../models';

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

function report(): SalesReport {
	return {
		totals: {revenue: 9000000, orders: 9, avgOrder: 1000000},
		revenueByStatus: {PENDING: 0, PAID: 5000000, SHIPPED: 4000000, COMPLETED: 0, CANCELLED: 0},
		countsByStatus: {PENDING: 2, PAID: 4, SHIPPED: 2, COMPLETED: 1, CANCELLED: 0},
		revenueByDay: [
			{day: '2026-10-05', revenue: 6000000},
			{day: '2026-10-06', revenue: 3000000}
		],
		topProducts: [
			{productId: 1, name: 'Rose', quantity: 40, revenue: 5000000},
			{productId: 2, name: 'Tulip', quantity: 20, revenue: 4000000}
		]
	};
}

describe('AdminDashboardComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminDashboardComponent>;
	let component: AdminDashboardComponent;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminDashboardComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminDashboardComponent);
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

	function flush(data: SalesReport | string = report()): void {
		fixture.detectChanges();
		const request = httpMock.expectOne(req => req.url === '/api/report/sales');
		if (typeof data === 'string') {
			request.flush(data, {status: 500, statusText: 'Server Error'});
		} else {
			request.flush(data);
		}
		fixture.detectChanges();
	}

	it('loads with no range keys when the filters are empty', () => {
		fixture.detectChanges();
		const request = httpMock.expectOne(req => req.url === '/api/report/sales');
		expect(request.request.params.keys()).toEqual([]);
		request.flush(report());
	});

	it('renders the three totals tiles', () => {
		flush();
		const element = fixture.nativeElement as HTMLElement;
		const tiles = element.querySelectorAll('[data-test="admin-dashboard-tile"]');
		expect(tiles.length).toBe(3);
		expect(tiles[0].textContent).toContain('₫9,000,000');
		expect(tiles[1].textContent).toContain('9');
		expect(tiles[2].textContent).toContain('₫1,000,000');
	});

	it('renders css bars scaled to the max value', () => {
		flush();
		const element = fixture.nativeElement as HTMLElement;
		const revenueBars = element.querySelectorAll('[data-test="admin-revenue-bar"]');
		expect(revenueBars.length).toBe(2);
		const first = revenueBars[0].querySelector('.bar-fill') as HTMLElement;
		const second = revenueBars[1].querySelector('.bar-fill') as HTMLElement;
		expect(first.style.width).toBe('100%');
		expect(second.style.width).toBe('50%');
		const statusBars = element.querySelectorAll('[data-test="admin-status-bar"]');
		expect(statusBars.length).toBe(5);
		const paidBar = Array.from(statusBars).find(bar => bar.textContent?.includes('PAID'));
		expect((paidBar!.querySelector('.bar-fill') as HTMLElement).style.width).toBe('100%');
		const productBars = element.querySelectorAll('[data-test="admin-product-bar"]');
		expect(productBars.length).toBe(2);
		expect(productBars[0].textContent).toContain('Rose');
	});

	it('shows the empty state when the api fails', () => {
		flush('boom');
		const element = fixture.nativeElement as HTMLElement;
		expect(component.report()).toBeNull();
		expect(element.querySelector('[data-test="admin-dashboard-empty"]')).not.toBeNull();
	});

	it('sends the range filters and reloads', () => {
		flush();
		const element = fixture.nativeElement as HTMLElement;
		const from = element.querySelector('[data-test="admin-dashboard-from"]') as HTMLInputElement;
		from.value = '2026-10-01';
		from.dispatchEvent(new Event('change', {bubbles: true}));
		let request = httpMock.expectOne(req => req.url === '/api/report/sales');
		expect(request.request.params.get('from')).toBe('2026-10-01');
		request.flush(report());
		const to = element.querySelector('[data-test="admin-dashboard-to"]') as HTMLInputElement;
		to.value = '2026-10-07';
		to.dispatchEvent(new Event('change', {bubbles: true}));
		request = httpMock.expectOne(req => req.url === '/api/report/sales');
		expect(request.request.params.get('to')).toBe('2026-10-07');
		request.flush(report());
	});
});
