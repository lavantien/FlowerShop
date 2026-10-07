import {describe, expect, it} from 'vitest';
import {DateFormatterService} from './date-formatter.service';

describe('DateFormatterService', () => {
	const service = new DateFormatterService();

	it('pads single-digit months, days and time fields', () => {
		expect(service.formatLocalDateTime(new Date(2026, 0, 7, 5, 3, 9))).toBe('2026-01-07 05:03:09');
	});

	it('keeps double-digit fields unpadded-free and in order', () => {
		expect(service.formatLocalDateTime(new Date(2026, 11, 25, 13, 45, 30))).toBe('2026-12-25 13:45:30');
	});

	it('uses local months offset by one', () => {
		expect(service.formatLocalDateTime(new Date(2026, 2, 1, 0, 0, 0))).toBe('2026-03-01 00:00:00');
	});

	it('round-trips a fixed local date through the formatter', () => {
		const fixed = new Date(2026, 5, 15, 9, 8, 7);
		const formatted = service.formatLocalDateTime(fixed);
		const parsed = new Date(formatted.replace(' ', 'T'));
		expect(parsed.getTime()).toBe(fixed.getTime());
	});
});
