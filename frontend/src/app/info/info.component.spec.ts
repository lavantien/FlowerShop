import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {InfoComponent} from './info.component';
import {ProfileComponent} from './profile/profile.component';
import {OrdersComponent} from './orders/orders.component';
import {WishlistComponent} from './wishlist/wishlist.component';
import {SessionService, SessionUser} from '../core/session.service';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: '12 Nguyen Hue',
	district: 'Bình Thạnh',
	city: 'Hồ Chí Minh',
	role: 'USER',
	enable: true
};

describe('InfoComponent shell', () => {
	let fixture: ComponentFixture<InfoComponent>;

	function configure(): void {
		TestBed.configureTestingModule({
			imports: [InfoComponent],
			providers: [
				provideRouter([
					{
						path: 'info',
						component: InfoComponent,
						children: [
							{path: '', pathMatch: 'full', redirectTo: 'orders'},
							{path: 'profile', component: ProfileComponent},
							{path: 'orders', component: OrdersComponent},
							{path: 'wishlist', component: WishlistComponent}
						]
					},
					{path: '**', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		TestBed.inject(SessionService).login('token-1', member);
		fixture = TestBed.createComponent(InfoComponent);
	}

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		localStorage.clear();
	});

	it('renders the three tabs', () => {
		configure();
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('INFO.ORDERS');
		expect(element.textContent).toContain('INFO.PROFILE');
		expect(element.textContent).toContain('INFO.WISHLIST');
		expect(element.querySelector('router-outlet')).not.toBeNull();
	});

	it('redirects the bare info path to the order history', async () => {
		configure();
		const router = TestBed.inject(Router);
		await router.navigate(['/info']);
		expect(router.url).toBe('/info/orders');
	});

	it('hosts the wishlist child under its tab', async () => {
		configure();
		const router = TestBed.inject(Router);
		await router.navigate(['/info/wishlist']);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('INFO.NO_WISHLIST');
	});
});
