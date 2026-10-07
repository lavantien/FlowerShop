import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {AdminUsersComponent} from './users.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {User} from '../../models';

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

function user(id: number, role: User['role'], enable = true): User {
	return {
		id,
		name: `Member ${id}`,
		email: `member${id}@flowershop.example`,
		phone: `09000000${String(id).padStart(2, '0')}`,
		address: '12 Nguyen Hue',
		district: 'Bình Thạnh',
		city: 'Hồ Chí Minh',
		role,
		enable
	};
}

const users: User[] = [user(1, 'ADMIN'), user(4, 'USER'), user(5, 'USER', false)];

describe('AdminUsersComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminUsersComponent>;
	let component: AdminUsersComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminUsersComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminUsersComponent);
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

	function flush(list: User[] = users): void {
		fixture.detectChanges();
		httpMock.expectOne('/api/user').flush(list);
		fixture.detectChanges();
	}

	it('loads the user table', () => {
		flush();
		const element = fixture.nativeElement as HTMLElement;
		expect(component.users().map(entry => entry.id)).toEqual([1, 4, 5]);
		expect(element.querySelectorAll('[data-test="admin-user-delete"]').length).toBe(3);
		expect(element.textContent).toContain('member4@flowershop.example');
	});

	it('shows the empty state when the api fails', () => {
		fixture.detectChanges();
		httpMock.expectOne('/api/user').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.users()).toEqual([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_USERS');
	});

	it('puts the full admin update body on a role change', () => {
		flush();
		const roleSelect = (fixture.nativeElement as HTMLElement)
			.querySelectorAll('[data-test="admin-user-role"]')[1] as HTMLSelectElement;
		roleSelect.value = 'ADMIN';
		roleSelect.dispatchEvent(new Event('change', {bubbles: true}));
		const request = httpMock.expectOne('/api/user/4');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body).toEqual({
			name: 'Member 4',
			phone: '0900000004',
			role: 'ADMIN',
			enable: true
		});
		request.flush(user(4, 'ADMIN'));
		fixture.detectChanges();
		expect(component.users()[1].role).toBe('ADMIN');
	});

	it('flips the enable flag through the toggle button', () => {
		const success = vi.spyOn(toast, 'success');
		flush();
		((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="admin-user-enable"]')[1] as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/user/4');
		expect(request.request.body.enable).toBe(false);
		expect(request.request.body.role).toBe('USER');
		request.flush(user(4, 'USER', false));
		fixture.detectChanges();
		expect(component.users()[1].enable).toBe(false);
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('deletes a user and drops the row', () => {
		const success = vi.spyOn(toast, 'success');
		flush();
		((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="admin-user-delete"]')[1] as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/user/4');
		expect(request.request.method).toBe('DELETE');
		request.flush(null);
		fixture.detectChanges();
		expect(component.users().map(entry => entry.id)).toEqual([1, 5]);
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('surfaces the 409 has-orders refusal as the has-orders toast', () => {
		const danger = vi.spyOn(toast, 'danger');
		flush();
		((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="admin-user-delete"]')[1] as HTMLButtonElement).click();
		httpMock.expectOne('/api/user/4').flush(
			{title: 'Conflict', status: 409, code: 'HAS_ORDERS'},
			{status: 409, statusText: 'Conflict'}
		);
		fixture.detectChanges();
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.USER_HAS_ORDERS');
		expect(component.users().length).toBe(3);
	});

	it('toasts the generic failure for other delete errors', () => {
		const danger = vi.spyOn(toast, 'danger');
		flush();
		((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="admin-user-delete"]')[1] as HTMLButtonElement).click();
		httpMock.expectOne('/api/user/4').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.busyId()).toBeNull();
	});

	it('toasts the generic failure when an update is refused', () => {
		const danger = vi.spyOn(toast, 'danger');
		flush();
		((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="admin-user-enable"]')[1] as HTMLButtonElement).click();
		httpMock.expectOne('/api/user/4').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.ACTION_FAILED');
		expect(component.busyId()).toBeNull();
	});

	it('ignores a second action while one is in flight', () => {
		flush();
		component.onDelete(users[1]);
		component.onToggleEnable(users[2]);
		const pending = httpMock.match(() => true);
		expect(pending.length).toBe(1);
		pending[0].flush(null);
	});
});
