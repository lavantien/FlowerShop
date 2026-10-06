import {describe, expect, it} from 'vitest';
import {DataTranslateService} from './data-translate.service';

describe('DataTranslateService', () => {
	const service = new DataTranslateService();

	describe('getPrice', () => {
		it('converts en to vi with ratio and offset', () => {
			expect(service.getPrice(1, 'vi')).toBe(1 * 23000.0 - 9770);
			expect(service.getPrice(0, 'vi')).toBe(-9770);
		});

		it('converts vi back to en', () => {
			expect(service.getPrice(1, 'en')).toBe((1 + 9770) / 23000.0);
		});

		it('round-trips a price through vi and back to en', () => {
			const vi = service.getPrice(25, 'vi');
			expect(service.getPrice(vi, 'en')).toBeCloseTo(25, 9);
		});
	});

	describe('getLocale', () => {
		it('maps vi to vi-VN', () => {
			expect(service.getLocale('vi')).toBe('vi-VN');
		});

		it('maps everything else to en-US', () => {
			expect(service.getLocale('en')).toBe('en-US');
			expect(service.getLocale('fr')).toBe('en-US');
			expect(service.getLocale('')).toBe('en-US');
		});
	});
});
