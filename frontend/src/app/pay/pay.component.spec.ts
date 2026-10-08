import {Component} from '@angular/core';
import {By} from '@angular/platform-browser';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, RouterOutlet, provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../locale';
import {PayComponent} from './pay.component';
import {ToastService} from '../core/toast.service';
import {PaymentView} from '../models';

@Component({
	selector: 'app-host',
	imports: [RouterOutlet],
	template: '<router-outlet/>'
})
class HostComponent {
}

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const paymentId = '6f1d0a4e-1111-2222-3333-444455556666';
const sig = 'cafe1234';

function view(status: PaymentView['status']): PaymentView {
	return {
		paymentId,
		orderId: 12,
		amount: 265000,
		status,
		summary: 'Order 12 - 2 items'
	};
}

describe('PayComponent', () => {
	let httpMock: HttpTestingController;
	let toast: ToastService;
	let fixture: ComponentFixture<HostComponent>;
	let component: PayComponent;
	let navigate: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'pay/:paymentId', component: PayComponent},
					{path: 'info', component: EmptyComponent},
					{path: 'shop', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		vi.spyOn(toast, 'danger');
		vi.spyOn(toast, 'success');
		vi.spyOn(toast, 'show');
		navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
		fixture = TestBed.createComponent(HostComponent);
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	async function arrive(sigParam?: string): Promise<void> {
		const router = TestBed.inject(Router);
		await router.navigate(['/pay/' + paymentId], sigParam === undefined ? {} : {queryParams: {sig: sigParam}});
		fixture.detectChanges();
		const found = fixture.debugElement.query(By.directive(PayComponent));
		expect(found).not.toBeNull();
		component = found!.componentInstance as PayComponent;
	}

	function flushView(status: PaymentView['status'] = 'PENDING'): void {
		httpMock.expectOne(req =>
			req.url === '/api/payment/' + paymentId && req.params.get('sig') === sig).flush(view(status));
		fixture.detectChanges();
	}

	it('loads the payment summary sig gated and renders the amount', async () => {
		await arrive(sig);
		flushView('PENDING');
		const element: HTMLElement = fixture.nativeElement;
		expect((element.querySelector('[data-test="pay-amount"]') as HTMLElement).textContent).toContain('₫265,000');
		expect(element.textContent).toContain('Order 12 - 2 items');
		expect(element.querySelector('[data-test="pay-confirm"]')).not.toBeNull();
		expect(component.loadFailed()).toBe(false);
	});

	it('confirms the payment, toasts, and routes to the order history', async () => {
		await arrive(sig);
		flushView('PENDING');
		(fixture.nativeElement.querySelector('[data-test="pay-confirm"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne(req =>
			req.url === '/api/payment/' + paymentId + '/confirm' && req.params.get('sig') === sig);
		expect(request.request.method).toBe('POST');
		request.flush({orderId: 12, status: 'CONFIRMED'});
		expect(toast.success).toHaveBeenCalledTimes(1);
		expect(navigate).toHaveBeenCalledWith(['/info']);
	});

	it('cancels the payment the same way', async () => {
		await arrive(sig);
		flushView('PENDING');
		(fixture.nativeElement.querySelector('[data-test="pay-cancel"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne(req =>
			req.url === '/api/payment/' + paymentId + '/cancel' && req.params.get('sig') === sig);
		expect(request.request.method).toBe('POST');
		request.flush({orderId: 12, status: 'CANCELLED'});
		expect(toast.show).toHaveBeenCalledWith(expect.any(String), 'info');
		expect(navigate).toHaveBeenCalledWith(['/info']);
	});

	it('ignores a second click while the gateway is working', async () => {
		await arrive(sig);
		flushView('PENDING');
		const payButton = fixture.nativeElement.querySelector('[data-test="pay-confirm"]') as HTMLButtonElement;
		payButton.click();
		expect(component.working()).toBe(true);
		component.onPay();
		const pending = httpMock.match(req => req.url === '/api/payment/' + paymentId + '/confirm');
		expect(pending.length).toBe(1);
		pending[0].flush({orderId: 12, status: 'CONFIRMED'});
	});

	it('toasts and stays when the gateway action fails', async () => {
		await arrive(sig);
		flushView('PENDING');
		(fixture.nativeElement.querySelector('[data-test="pay-cancel"]') as HTMLButtonElement).click();
		httpMock.expectOne(req => req.url === '/api/payment/' + paymentId + '/cancel').flush(
			{title: 'Conflict', status: 409, code: 'PAYMENT_CONFIRMED'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(toast.danger).toHaveBeenCalledTimes(1);
		expect(navigate).not.toHaveBeenCalledWith(['/info']);
		expect(component.working()).toBe(false);
	});

	it('hides the actions for an already settled payment', async () => {
		await arrive(sig);
		flushView('CONFIRMED');
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('[data-test="pay-confirm"]')).toBeNull();
		expect(element.querySelector('[data-test="pay-settled"]')?.textContent).toContain('PAY.CONFIRMED_NOTE');
	});

	it('fails with a toast when the sig is missing', async () => {
		await arrive();
		httpMock.expectNone(req => req.url.startsWith('/api/payment/'));
		const element: HTMLElement = fixture.nativeElement;
		expect(component.loadFailed()).toBe(true);
		expect(toast.danger).toHaveBeenCalledTimes(1);
		expect(element.querySelector('[data-test="pay-error"]')).not.toBeNull();
	});

	it('fails with a toast when the summary load is rejected', async () => {
		await arrive(sig);
		httpMock.expectOne(req => req.url === '/api/payment/' + paymentId).flush(
			{title: 'Unauthorized', status: 401, code: 'BAD_SIGNATURE'},
			{status: 401, statusText: 'Unauthorized'}
		);
		fixture.detectChanges();
		expect(component.loadFailed()).toBe(true);
		expect(toast.danger).toHaveBeenCalledTimes(1);
	});
});
