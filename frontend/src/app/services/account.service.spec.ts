import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {AccountService} from './account.service';
import {User} from '../models';

const member: User = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'USER',
	enable: true
};

describe('AccountService', () => {
	let httpMock: HttpTestingController;
	let account: AccountService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		account = TestBed.inject(AccountService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('reads the current member profile', () => {
		account.me().subscribe(result => expect(result).toEqual(member));
		httpMock.expectOne('/api/user/me').flush(member);
	});

	it('updates the profile fields through the me endpoint', () => {
		account.updateMe({name: 'Renamed', phone: '0900000005', address: 'B', district: 'Go Vap', city: 'Ho Chi Minh'}).subscribe();
		const request = httpMock.expectOne('/api/user/me');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body).toEqual({name: 'Renamed', phone: '0900000005', address: 'B', district: 'Go Vap', city: 'Ho Chi Minh'});
	});

	it('changes the password with the paired body', () => {
		account.changePassword({currentPassword: '1234qwer', newPassword: '2345wert'}).subscribe();
		const request = httpMock.expectOne('/api/user/me/password');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({currentPassword: '1234qwer', newPassword: '2345wert'});
		request.flush(null, {status: 204, statusText: 'No Content'});
	});

	it('lists every user for the admin table', () => {
		account.list().subscribe();
		httpMock.expectOne('/api/user').flush([member]);
	});

	it('updates one user from the admin table', () => {
		account.update(4, {name: 'Member', phone: '0900000004', role: 'ADMIN', enable: false}).subscribe();
		const request = httpMock.expectOne('/api/user/4');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body).toEqual({name: 'Member', phone: '0900000004', role: 'ADMIN', enable: false});
	});

	it('deletes a user and reports the has-orders conflict', () => {
		account.remove(4).subscribe();
		expect(httpMock.expectOne('/api/user/4').request.method).toBe('DELETE');
		account.remove(9).subscribe({
			error: error => expect(error.status).toBe(409)
		});
		httpMock.expectOne('/api/user/9')
			.flush({title: 'Conflict', status: 409, code: 'HAS_ORDERS'}, {status: 409, statusText: 'Conflict'});
	});
});
