import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
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

const admin: SessionUser = {...member, id: 1, role: 'ADMIN'};

describe('SessionService', () => {
	let session: SessionService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({});
	});

	afterEach(() => {
		localStorage.clear();
		TestBed.resetTestingModule();
	});

	function boot(): SessionService {
		return TestBed.inject(SessionService);
	}

	it('starts logged out with no token', () => {
		session = boot();
		expect(session.isLoggedIn()).toBe(false);
		expect(session.isAdmin()).toBe(false);
		expect(session.user()).toBeNull();
		expect(session.token()).toBeNull();
	});

	it('login exposes user and token signals and persists both keys', () => {
		session = boot();
		session.login('token-1', member);
		expect(session.isLoggedIn()).toBe(true);
		expect(session.isAdmin()).toBe(false);
		expect(session.user()).toEqual(member);
		expect(session.token()).toBe('token-1');
		expect(localStorage.getItem('token')).toBe('token-1');
		expect(JSON.parse(localStorage.getItem('user') ?? '{}')).toEqual(member);
	});

	it('logout clears the signals and the storage', () => {
		session = boot();
		session.login('token-1', admin);
		expect(session.isAdmin()).toBe(true);
		session.logout();
		expect(session.isLoggedIn()).toBe(false);
		expect(session.user()).toBeNull();
		expect(session.token()).toBeNull();
		expect(localStorage.getItem('token')).toBeNull();
		expect(localStorage.getItem('user')).toBeNull();
	});

	it('restores a persisted session on boot, guest sentinel included as a no user', () => {
		localStorage.setItem('token', 'token-1');
		localStorage.setItem('user', JSON.stringify(admin));
		session = boot();
		expect(session.isLoggedIn()).toBe(true);
		expect(session.isAdmin()).toBe(true);
		expect(session.token()).toBe('token-1');
	});

	it('ignores a token without a user so legacy guest tokens never log in', () => {
		localStorage.setItem('token', btoa('0+GUESS'));
		session = boot();
		expect(session.isLoggedIn()).toBe(false);
		expect(session.token()).toBeNull();
	});

	it('drops a session whose stored user is tampered json', () => {
		localStorage.setItem('token', 'token-1');
		localStorage.setItem('user', '{"id": "not-a-number"}');
		session = boot();
		expect(session.isLoggedIn()).toBe(false);
		expect(localStorage.getItem('token')).toBeNull();
	});

	it('drops a session whose stored user is broken json', () => {
		localStorage.setItem('token', 'token-1');
		localStorage.setItem('user', '{oops');
		session = boot();
		expect(session.isLoggedIn()).toBe(false);
	});

	it('requestLogin bumps the counter once per call', () => {
		session = boot();
		expect(session.loginRequested()).toBe(0);
		session.requestLogin();
		session.requestLogin();
		expect(session.loginRequested()).toBe(2);
	});
});
