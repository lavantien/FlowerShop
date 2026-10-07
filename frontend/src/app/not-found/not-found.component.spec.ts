import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, describe, expect, it} from 'vitest';
import {NotFoundComponent} from './not-found.component';

describe('NotFoundComponent', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [NotFoundComponent],
			providers: [provideRouter([]), provideTranslateService()]
		});
	});

	it('renders the 404 marker, the message and a link back to the shop', () => {
		const fixture = TestBed.createComponent(NotFoundComponent);
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('h1')?.textContent?.trim()).toBe('404');
		expect(element.textContent).toContain('NOT_FOUND.MESSAGE');
		const link = element.querySelector('a.btn') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('/shop');
		expect(link.textContent).toContain('NOT_FOUND.BACK');
	});
});
