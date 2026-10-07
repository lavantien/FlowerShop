import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {AuthService} from './auth.service';
import {SessionService, SessionUser} from './session.service';

const member: SessionUser = {
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

describe('AuthService', () => {
	let httpMock: HttpTestingController;
	let auth: AuthService;
	let session: SessionService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		auth = TestBed.inject(AuthService);
		session = TestBed.inject(SessionService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		localStorage.clear();
	});

	it('logs in against the json endpoint and seeds the session', () => {
		auth.login('member@flowershop.example', '1234qwer').subscribe();
		const request = httpMock.expectOne('/api/auth/login');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({email: 'member@flowershop.example', password: '1234qwer'});
		expect(session.isLoggedIn()).toBe(false);
		request.flush({token: 'token-1', user: member});
		expect(session.isLoggedIn()).toBe(true);
		expect(session.token()).toBe('token-1');
		expect(session.user()).toEqual(member);
	});

	it('logs out with a bodyless post and clears the session', () => {
		session.login('token-1', member);
		auth.logout().subscribe();
		const request = httpMock.expectOne('/api/auth/logout');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toBeNull();
		request.flush(null, {status: 204, statusText: 'No Content'});
		expect(session.isLoggedIn()).toBe(false);
		expect(localStorage.getItem('token')).toBeNull();
	});

	it('registers with the contract body', () => {
		auth.register({
			name: 'Member',
			email: 'member@flowershop.example',
			password: '1234qwer',
			phone: '0900000004',
			address: 'A',
			district: 'Binh Thanh',
			city: 'Ho Chi Minh',
			answer: 'demo'
		}).subscribe();
		const request = httpMock.expectOne('/api/user/create');
		expect(request.request.body).toEqual({
			name: 'Member',
			email: 'member@flowershop.example',
			password: '1234qwer',
			phone: '0900000004',
			address: 'A',
			district: 'Binh Thanh',
			city: 'Ho Chi Minh',
			answer: 'demo'
		});
		expect(session.isLoggedIn()).toBe(false);
		request.flush(member);
		expect(session.isLoggedIn()).toBe(false);
	});

	it('resets a password and seeds the returned session', () => {
		auth.resetPassword({email: 'member@flowershop.example', answer: 'demo', newPassword: '1234qwer'}).subscribe();
		const request = httpMock.expectOne('/api/user/resetPassword');
		expect(request.request.body).toEqual({email: 'member@flowershop.example', answer: 'demo', newPassword: '1234qwer'});
		request.flush({token: 'token-2', user: member});
		expect(session.isLoggedIn()).toBe(true);
		expect(session.token()).toBe('token-2');
	});
});
