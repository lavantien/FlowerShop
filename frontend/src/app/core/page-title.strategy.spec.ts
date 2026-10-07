import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Title} from '@angular/platform-browser';
import {provideRouter, Router, TitleStrategy} from '@angular/router';
import {describe, expect, it} from 'vitest';
import {PageTitleStrategy} from './page-title.strategy';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

describe('PageTitleStrategy', () => {
	it('appends the app name to the route title', async () => {
		TestBed.configureTestingModule({
			imports: [EmptyComponent],
			providers: [
				provideRouter([{path: 'shop', title: 'Shop', component: EmptyComponent}]),
				{provide: TitleStrategy, useClass: PageTitleStrategy}
			]
		});
		await TestBed.inject(Router).navigate(['/shop']);
		expect(TestBed.inject(Title).getTitle()).toBe('Shop - FlowerShop');
	});

	it('falls back to the bare app name without a route title', async () => {
		TestBed.configureTestingModule({
			imports: [EmptyComponent],
			providers: [
				provideRouter([{path: 'contact', component: EmptyComponent}]),
				{provide: TitleStrategy, useClass: PageTitleStrategy}
			]
		});
		await TestBed.inject(Router).navigate(['/contact']);
		expect(TestBed.inject(Title).getTitle()).toBe('FlowerShop');
	});
});
