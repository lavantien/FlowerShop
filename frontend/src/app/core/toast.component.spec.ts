import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {ToastContainerComponent} from './toast.component';
import {ToastService} from './toast.service';

describe('ToastContainerComponent', () => {
	let service: ToastService;

	beforeEach(() => {
		TestBed.configureTestingModule({imports: [ToastContainerComponent]});
		service = TestBed.inject(ToastService);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('renders one bootstrap toast per entry with its kind class', () => {
		const fixture = TestBed.createComponent(ToastContainerComponent);
		service.show('saved', 'success');
		service.danger('broken');
		fixture.detectChanges();
		const container = fixture.nativeElement as HTMLElement;
		const toasts = Array.from(container.querySelectorAll('.toast'));
		expect(toasts).toHaveLength(2);
		expect(toasts[0].className).toContain('text-bg-success');
		expect(toasts[1].className).toContain('text-bg-danger');
		expect(container.textContent).toContain('saved');
		expect(container.textContent).toContain('broken');
	});

	it('renders nothing when there are no toasts', () => {
		const fixture = TestBed.createComponent(ToastContainerComponent);
		fixture.detectChanges();
		expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast')).toHaveLength(0);
	});

	it('dismisses a toast from its close button', () => {
		const fixture = TestBed.createComponent(ToastContainerComponent);
		service.show('saved', 'success');
		fixture.detectChanges();
		const container = fixture.nativeElement as HTMLElement;
		(container.querySelector('.btn-close') as HTMLElement).click();
		fixture.detectChanges();
		expect(container.querySelectorAll('.toast')).toHaveLength(0);
		expect(service.toasts()).toHaveLength(0);
	});
});
