import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {UrlTree} from '@angular/router';
import {authGuard} from './auth.guard';
import {adminGuard} from './admin.guard';
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

describe('authGuard', () => {
	let session: SessionService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({providers: [provideRouter([])]});
		session = TestBed.inject(SessionService);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('lets a logged in member through', () => {
		session.login('token-1', member);
		const result = TestBed.runInInjectionContext(() => authGuard(undefined as never, undefined as never));
		expect(result).toBe(true);
	});

	it('redirects a guest to the shop', () => {
		const result = TestBed.runInInjectionContext(() => authGuard(undefined as never, undefined as never));
		expect(result).toBeInstanceOf(UrlTree);
		expect((result as UrlTree).toString()).toBe('/shop');
	});
});

describe('adminGuard', () => {
	let session: SessionService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({providers: [provideRouter([])]});
		session = TestBed.inject(SessionService);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('lets an admin through', () => {
		session.login('token-1', {...member, role: 'ADMIN'});
		const result = TestBed.runInInjectionContext(() => adminGuard(undefined as never, undefined as never));
		expect(result).toBe(true);
	});

	it('redirects a plain member to the shop', () => {
		session.login('token-1', member);
		const result = TestBed.runInInjectionContext(() => adminGuard(undefined as never, undefined as never));
		expect((result as UrlTree).toString()).toBe('/shop');
	});

	it('redirects a guest to the shop', () => {
		const result = TestBed.runInInjectionContext(() => adminGuard(undefined as never, undefined as never));
		expect((result as UrlTree).toString()).toBe('/shop');
	});
});
