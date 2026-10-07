import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {ToastService} from './toast.service';

describe('ToastService', () => {
	let toasts: ToastService;

	beforeEach(() => {
		vi.useFakeTimers();
		TestBed.configureTestingModule({});
		toasts = TestBed.inject(ToastService);
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('stacks toasts in order with their kind', () => {
		toasts.show('saved', 'success');
		toasts.danger('broken');
		toasts.show('plain');
		const current = toasts.toasts();
		expect(current.map(toast => toast.message)).toEqual(['saved', 'broken', 'plain']);
		expect(current.map(toast => toast.kind)).toEqual(['success', 'danger', 'info']);
		expect(current[0].id).not.toBe(current[1].id);
	});

	it('auto dismisses a toast after 4 seconds', () => {
		toasts.show('saved', 'success');
		expect(toasts.toasts()).toHaveLength(1);
		vi.advanceTimersByTime(3999);
		expect(toasts.toasts()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(toasts.toasts()).toHaveLength(0);
	});

	it('dismiss removes exactly the targeted toast', () => {
		toasts.show('first');
		toasts.show('second');
		const first = toasts.toasts()[0];
		toasts.dismiss(first.id);
		expect(toasts.toasts().map(toast => toast.message)).toEqual(['second']);
	});

	it('keeps other toasts when one expires', () => {
		toasts.show('first');
		vi.advanceTimersByTime(1000);
		toasts.show('second');
		vi.advanceTimersByTime(3000);
		expect(toasts.toasts().map(toast => toast.message)).toEqual(['second']);
	});
});
