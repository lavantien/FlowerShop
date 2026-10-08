import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {SeededGenerator} from '../../../testing/seeded-generator';
import {ProfileComponent} from './profile.component';
import {SessionService, SessionUser} from '../../core/session.service';

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

describe('ProfileComponent form fuzz', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<ProfileComponent>;
	let component: ProfileComponent;
	let gen: SeededGenerator;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [ProfileComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		TestBed.inject(SessionService).login('token-1', member);
		fixture = TestBed.createComponent(ProfileComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Hồ Chí Minh'}]);
		httpMock.expectOne('../assets/data/districts.json').flush([
			{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'}
		]);
		fixture.detectChanges();
		gen = new SeededGenerator();
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	function digits(length: number): string {
		let result = '';
		for (let i = 0; i < length; i++) {
			result += String(gen.intBetween(0, 9));
		}
		return result;
	}

	function passwordOf(length: number): string {
		const pool = ['a', 'Z', '9', '_', 'ư', '中'];
		let result = '';
		for (let i = 0; i < length; i++) {
			result += gen.pick(pool);
		}
		return result;
	}

	it('accepts only 9 to 11 digit phones and rejects every generated lookalike', () => {
		for (let i = 0; i < 12; i++) {
			const phone = digits(gen.intBetween(9, 11));
			component.profileForm.controls.phone.setValue(phone);
			expect(component.profileForm.controls.phone.valid, phone).toBe(true);
		}
		const invalid = [
			' ', 'abc', '0900000004x', '09000 0004', '09000-0004', '+84900000004',
			' Floreshop', '🎆🎆🎆🎆🎆🎆🎆🎆🎆', digits(gen.intBetween(1, 8)), digits(gen.intBetween(12, 20)),
			digits(10) + 'a', '0' + gen.string(12)
		];
		for (const phone of invalid) {
			component.profileForm.controls.phone.setValue(phone);
			expect(component.profileForm.controls.phone.invalid, phone).toBe(true);
			expect(component.profileForm.controls.phone.errors?.['pattern']).toBeDefined();
		}
		component.profileForm.controls.phone.setValue('');
		expect(component.profileForm.controls.phone.invalid).toBe(true);
		expect(component.profileForm.controls.phone.errors?.['required']).toBeDefined();
	});

	it('treats only the empty string as missing for the required profile fields', () => {
		const fields = ['name', 'address', 'district', 'city'] as const;
		for (const field of fields) {
			const control = component.profileForm.controls[field];
			control.setValue('');
			expect(control.invalid, field).toBe(true);
			expect(control.errors?.['required']).toBeDefined();
			control.setValue(gen.string(24));
			expect(control.valid, field).toBe(true);
		}
	});

	it('blocks the profile save without a request whenever any field is invalid', () => {
		const breakers = [
			() => component.profileForm.controls.phone.setValue('abc'),
			() => component.profileForm.controls.phone.setValue(digits(5)),
			() => component.profileForm.controls.name.setValue(''),
			() => component.profileForm.controls.address.setValue(''),
			() => component.profileForm.controls.district.setValue(''),
			() => component.profileForm.controls.city.setValue('')
		];
		for (const breakIt of breakers) {
			component.profileForm.setValue({
				name: 'Member',
				phone: '0900000004',
				address: '12 Nguyen Hue',
				district: 'Bình Thạnh',
				city: 'Hồ Chí Minh'
			});
			breakIt();
			component.onSaveProfile();
			expect(component.profileFailed()).toBe(true);
			expect(component.savingProfile()).toBe(false);
			httpMock.expectNone('/api/user/me');
		}
	});

	it('enforces the six character floor on new passwords with generated lengths', () => {
		for (let length = 1; length <= 5; length++) {
			const password = passwordOf(length);
			expect(password).toHaveLength(length);
			component.passwordForm.controls.newPassword.setValue(password);
			expect(component.passwordForm.controls.newPassword.invalid, password).toBe(true);
			expect(component.passwordForm.controls.newPassword.errors?.['minlength']).toBeDefined();
		}
		for (let i = 0; i < 20; i++) {
			const password = passwordOf(gen.intBetween(6, 40));
			component.passwordForm.controls.newPassword.setValue(password);
			expect(component.passwordForm.controls.newPassword.valid, password).toBe(true);
		}
	});

	it('flags every generated mismatched confirmation and passes every matched pair', () => {
		for (let i = 0; i < 40; i++) {
			const password = passwordOf(gen.intBetween(1, 30));
			const mismatched = password.slice(0, -1) + (password.endsWith('a') ? 'b' : 'a');
			component.passwordForm.setValue({currentPassword: 'old123', newPassword: password, reNewPassword: mismatched});
			expect(component.passwordForm.errors?.['mismatch']).toBe(true);
			expect(component.passwordForm.invalid).toBe(true);
			component.onChangePassword();
			expect(component.passwordFailed()).toBe(true);
			httpMock.expectNone('/api/user/me/password');
		}
		for (let i = 0; i < 20; i++) {
			const password = gen.string(gen.intBetween(6, 30));
			component.passwordForm.setValue({currentPassword: 'old123', newPassword: password, reNewPassword: password});
			expect(component.passwordForm.errors).toBeNull();
		}
	});

	it('blocks the password change without a request when the current password is empty', () => {
		component.passwordForm.setValue({currentPassword: '', newPassword: 'new123', reNewPassword: 'new123'});
		component.onChangePassword();
		expect(component.passwordFailed()).toBe(true);
		httpMock.expectNone('/api/user/me/password');
	});
});
