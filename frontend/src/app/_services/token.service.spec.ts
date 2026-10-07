import {afterEach, describe, expect, it} from 'vitest';
import {TokenService} from './token.service';

describe('TokenService', () => {
	const service = new TokenService();

	afterEach(() => {
		localStorage.removeItem('token');
	});

	it('parses a single-digit user id and the admin role', () => {
		localStorage.setItem('token', btoa('1+ADMIN'));
		expect(service.userId()).toBe(1);
		expect(service.role()).toBe('ADMIN');
		expect(service.isAdmin()).toBe(true);
		expect(service.isLoggedIn()).toBe(true);
	});

	it('parses multi-digit user ids', () => {
		localStorage.setItem('token', btoa('12345+USER'));
		expect(service.userId()).toBe(12345);
		expect(service.role()).toBe('USER');
		expect(service.isAdmin()).toBe(false);
		expect(service.isLoggedIn()).toBe(true);
	});

	it('treats the guest token as logged out', () => {
		localStorage.setItem('token', btoa('0+GUESS'));
		expect(service.isLoggedIn()).toBe(false);
		expect(service.userId()).toBe(0);
		expect(service.role()).toBe('GUESS');
		expect(service.isAdmin()).toBe(false);
	});

	it('treats a missing token as logged out with id 0', () => {
		localStorage.removeItem('token');
		expect(service.isLoggedIn()).toBe(false);
		expect(service.isAdmin()).toBe(false);
		expect(service.userId()).toBe(0);
		expect(service.role()).toBe('');
	});

	it('reads the stored token at call time so login state stays fresh', () => {
		localStorage.setItem('token', btoa('0+GUESS'));
		expect(service.isLoggedIn()).toBe(false);
		localStorage.setItem('token', btoa('9+USER'));
		expect(service.isLoggedIn()).toBe(true);
		expect(service.userId()).toBe(9);
	});
});
