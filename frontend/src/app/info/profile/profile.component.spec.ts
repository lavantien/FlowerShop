import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {ProfileComponent} from './profile.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';

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

describe('ProfileComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<ProfileComponent>;
	let component: ProfileComponent;
	let session: SessionService;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [ProfileComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		session = TestBed.inject(SessionService);
		toast = TestBed.inject(ToastService);
		session.login('token-1', member);
		fixture = TestBed.createComponent(ProfileComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Hồ Chí Minh'}, {name: 'Đà Nẵng'}]);
		httpMock.expectOne('../assets/data/districts.json').flush([
			{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'},
			{name: 'Hải Châu', cityName: 'Đà Nẵng'}
		]);
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

	it('prefills the profile form from the session with the email read only', () => {
		const element: HTMLElement = fixture.nativeElement;
		expect(component.profileForm.getRawValue()).toEqual({
			name: 'Member',
			phone: '0900000004',
			address: '12 Nguyen Hue',
			district: 'Bình Thạnh',
			city: 'Hồ Chí Minh'
		});
		expect((element.querySelector('[data-test="profile-name"]') as HTMLInputElement).value).toBe('Member');
		expect((element.querySelector('#inputEmailP') as HTMLInputElement).disabled).toBe(true);
	});

	it('resets the district when the city changes', () => {
		const element: HTMLElement = fixture.nativeElement;
		const citySelect = element.querySelector('[data-test="profile-city"]') as HTMLSelectElement;
		citySelect.value = 'Đà Nẵng';
		citySelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expect(component.profileForm.controls.district.value).toBe('Hải Châu');
	});

	it('saves the profile and mirrors it into the session', () => {
		const success = vi.spyOn(toast, 'success');
		component.profileForm.controls.name.setValue('New Name');
		(fixture.nativeElement.querySelector('[data-test="profile-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/user/me');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body).toEqual({
			name: 'New Name',
			phone: '0900000004',
			address: '12 Nguyen Hue',
			district: 'Bình Thạnh',
			city: 'Hồ Chí Minh'
		});
		request.flush({...member, name: 'New Name'});
		expect(session.user()?.name).toBe('New Name');
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('blocks an invalid profile without a request', () => {
		component.profileForm.controls.phone.setValue('abc');
		(fixture.nativeElement.querySelector('[data-test="profile-save"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		httpMock.expectNone('/api/user/me');
		expect(component.profileFailed()).toBe(true);
	});

	it('toasts and flags when the profile save fails', () => {
		const danger = vi.spyOn(toast, 'danger');
		(fixture.nativeElement.querySelector('[data-test="profile-save"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/user/me').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(component.profileFailed()).toBe(true);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.savingProfile()).toBe(false);
	});

	it('changes the password and resets the form', () => {
		const success = vi.spyOn(toast, 'success');
		component.passwordForm.setValue({currentPassword: 'old123', newPassword: 'new123', reNewPassword: 'new123'});
		(fixture.nativeElement.querySelector('[data-test="profile-password"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/user/me/password');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({currentPassword: 'old123', newPassword: 'new123'});
		request.flush(null, {status: 204, statusText: 'No Content'});
		expect(component.passwordForm.getRawValue()).toEqual({
			currentPassword: '',
			newPassword: '',
			reNewPassword: ''
		});
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('rejects a password pair that does not match', () => {
		component.passwordForm.setValue({currentPassword: 'old123', newPassword: 'new123', reNewPassword: 'other'});
		(fixture.nativeElement.querySelector('[data-test="profile-password"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		httpMock.expectNone('/api/user/me/password');
		expect(component.passwordFailed()).toBe(true);
	});

	it('flags a wrong current password from the server', () => {
		const danger = vi.spyOn(toast, 'danger');
		component.passwordForm.setValue({currentPassword: 'wrong', newPassword: 'new123', reNewPassword: 'new123'});
		(fixture.nativeElement.querySelector('[data-test="profile-password"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/user/me/password').flush(
			{title: 'Unauthorized', status: 401, code: 'WRONG_PASSWORD'},
			{status: 401, statusText: 'Unauthorized'}
		);
		expect(component.passwordFailed()).toBe(true);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.changingPassword()).toBe(false);
	});
});
