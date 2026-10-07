import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {ContactComponent} from './contact.component';

describe('ContactComponent', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [ContactComponent],
			providers: [
				provideRouter([]),
				provideTranslateService()
			]
		});
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('renders the contact card', () => {
		const fixture = TestBed.createComponent(ContactComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('div').textContent).toContain('La Văn Tiến');
	});
});
