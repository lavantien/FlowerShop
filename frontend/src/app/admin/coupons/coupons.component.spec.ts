import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {AdminCouponsComponent} from './coupons.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {Coupon} from '../../models';

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

function coupon(id: number, code: string, kind: Coupon['kind'], active = true): Coupon {
	return {id, code, kind, value: kind === 'PERCENT' ? 10 : 50000, active, expiresAt: null};
}

const coupons: Coupon[] = [
	coupon(1, 'WELCOME10', 'PERCENT'),
	coupon(2, 'SHIP50K', 'FIXED'),
	coupon(3, 'EXPIRED5', 'PERCENT', false)
];

describe('AdminCouponsComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminCouponsComponent>;
	let component: AdminCouponsComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminCouponsComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminCouponsComponent);
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

	function flush(list: Coupon[] = coupons): void {
		fixture.detectChanges();
		httpMock.expectOne('/api/coupon').flush(list);
		fixture.detectChanges();
	}

	it('loads the coupon table with kind aware value display', () => {
		flush();
		const element = fixture.nativeElement as HTMLElement;
		expect(component.coupons().length).toBe(3);
		expect(element.textContent).toContain('WELCOME10');
		expect(element.textContent).toContain('10%');
		expect(element.textContent).toContain('₫50,000');
	});

	it('shows the empty state when the api fails', () => {
		fixture.detectChanges();
		httpMock.expectOne('/api/coupon').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.coupons()).toEqual([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_COUPONS');
	});

	it('creates a coupon with a null expiry for an empty date', () => {
		const success = vi.spyOn(toast, 'success');
		flush();
		const element = fixture.nativeElement as HTMLElement;
		(element.querySelector('[data-test="admin-coupon-code"]') as HTMLInputElement).value = 'NEWCODE';
		element.querySelector('[data-test="admin-coupon-code"]')!
			.dispatchEvent(new Event('input', {bubbles: true}));
		const value = element.querySelector('[data-test="admin-coupon-value"]') as HTMLInputElement;
		value.value = '15';
		value.dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
		(element.querySelector('[data-test="admin-coupon-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/coupon');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({
			code: 'NEWCODE',
			kind: 'PERCENT',
			value: 15,
			active: true,
			expiresAt: null
		});
		request.flush(coupon(4, 'NEWCODE', 'PERCENT'));
		flush();
		expect(success).toHaveBeenCalledTimes(1);
		expect(component.form.controls.code.value).toBe('');
	});

	it('edits a coupon and posts the expiry date string', () => {
		flush();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-edit"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(component.editId()).toBe(1);
		expect(component.form.controls.code.value).toBe('WELCOME10');
		const expiry = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-expiry"]') as HTMLInputElement;
		expiry.value = '2026-12-31';
		expiry.dispatchEvent(new Event('input', {bubbles: true}));
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/coupon/1');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body.expiresAt).toBe('2026-12-31');
		expect(request.request.body.value).toBe(10);
		request.flush(coupon(1, 'WELCOME10', 'PERCENT'));
		flush();
		expect(component.editId()).toBeNull();
	});

	it('surfaces a duplicate code 409 as the code toast', () => {
		const danger = vi.spyOn(toast, 'danger');
		flush();
		const element = fixture.nativeElement as HTMLElement;
		(element.querySelector('[data-test="admin-coupon-code"]') as HTMLInputElement).value = 'WELCOME10';
		element.querySelector('[data-test="admin-coupon-code"]')!
			.dispatchEvent(new Event('input', {bubbles: true}));
		const value = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-value"]') as HTMLInputElement;
		value.value = '10';
		value.dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
		(element.querySelector('[data-test="admin-coupon-save"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/coupon').flush(
			{title: 'Conflict', status: 409, code: 'CODE_IN_USE'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.CODE_IN_USE');
		expect(component.saving()).toBe(false);
	});

	it('toggles the active flag with the coupon body', () => {
		const success = vi.spyOn(toast, 'success');
		flush();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-toggle"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/coupon/1');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body.active).toBe(false);
		expect(request.request.body.code).toBe('WELCOME10');
		request.flush(coupon(1, 'WELCOME10', 'PERCENT', false));
		flush();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('deletes a coupon', () => {
		const success = vi.spyOn(toast, 'success');
		flush();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-delete"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/coupon/1');
		expect(request.request.method).toBe('DELETE');
		request.flush(null);
		flush();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('toasts when the active toggle is refused', () => {
		const danger = vi.spyOn(toast, 'danger');
		flush();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-toggle"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/coupon/1').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.COUPON_SAVE_FAILED');
	});

	it('toasts when a delete is refused', () => {
		const danger = vi.spyOn(toast, 'danger');
		flush();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-coupon-delete"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/coupon/1').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.COUPON_DELETE_FAILED');
	});

	it('refuses an invalid code or value', () => {
		flush();
		component.form.patchValue({code: 'not valid!', value: 0});
		component.onSubmit();
		expect(httpMock.match(() => true).length).toBe(0);
	});
});
