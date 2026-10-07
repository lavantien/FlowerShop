import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {ReportService} from './report.service';
import {SalesReport} from '../models';

const report: SalesReport = {
	totals: {revenue: 5000000, orders: 20, avgOrder: 250000},
	revenueByStatus: {PENDING: 0, PAID: 5000000, SHIPPED: 0, COMPLETED: 0, CANCELLED: 0},
	countsByStatus: {PENDING: 2, PAID: 18, SHIPPED: 0, COMPLETED: 0, CANCELLED: 0},
	revenueByDay: [{day: '2026-10-07', revenue: 500000}],
	topProducts: [{productId: 1, name: 'Rose', quantity: 12, revenue: 3000000}]
};

describe('ReportService', () => {
	let httpMock: HttpTestingController;
	let reports: ReportService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		reports = TestBed.inject(ReportService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('requests the default window with no query params', () => {
		reports.sales().subscribe();
		const request = httpMock.expectOne('/api/report/sales');
		expect(request.request.params.keys()).toEqual([]);
		request.flush(report);
	});

	it('maps the iso window into from and to params', () => {
		reports.sales({from: '2026-10-01', to: '2026-10-07'}).subscribe();
		const request = httpMock.expectOne(req => req.method === 'GET' && req.url === '/api/report/sales');
		expect(request.request.params.toString()).toBe('from=2026-10-01&to=2026-10-07');
	});

	it('surfaces a 403 for a member token', () => {
		reports.sales().subscribe({
			error: error => expect(error.status).toBe(403)
		});
		httpMock.expectOne('/api/report/sales')
			.flush({title: 'Forbidden', status: 403}, {status: 403, statusText: 'Forbidden'});
	});
});
