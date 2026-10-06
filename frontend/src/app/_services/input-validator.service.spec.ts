import {describe, expect, it} from 'vitest';
import {InputValidatorService} from './input-validator.service';

describe('InputValidatorService', () => {
	const service = new InputValidatorService();

	describe('isEmail', () => {
		it('accepts valid addresses', () => {
			expect(service.isEmail('user@mail.com')).toBe(true);
			expect(service.isEmail('first.last+tag@sub.domain.org')).toBe(true);
			expect(service.isEmail('"quoted local"@mail.com')).toBe(true);
			expect(service.isEmail('user@[127.0.0.1]')).toBe(true);
		});

		it('rejects invalid addresses', () => {
			expect(service.isEmail('')).toBe(false);
			expect(service.isEmail('no-at-sign')).toBe(false);
			expect(service.isEmail('user@')).toBe(false);
			expect(service.isEmail('@mail.com')).toBe(false);
			expect(service.isEmail('user@mail')).toBe(false);
			expect(service.isEmail('user@127.0.0.1')).toBe(false);
			expect(service.isEmail('a b@mail.com')).toBe(false);
		});

		it('matches case-insensitively', () => {
			expect(service.isEmail('USER@MAIL.COM')).toBe(true);
		});
	});

	describe('isPassword', () => {
		it('requires more than 6 characters', () => {
			expect(service.isPassword('123456')).toBe(false);
			expect(service.isPassword('1234567')).toBe(true);
			expect(service.isPassword('')).toBe(false);
		});
	});

	describe('isInteger', () => {
		it('accepts digit-only strings', () => {
			expect(service.isInteger(0)).toBe(true);
			expect(service.isInteger(123)).toBe(true);
		});

		it('rejects non-digit strings', () => {
			expect(service.isInteger(-1)).toBe(false);
			expect(service.isInteger(1.5)).toBe(false);
		});
	});
});
