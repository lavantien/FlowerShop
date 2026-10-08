import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {provideRouter, Router} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {AppComponent} from './app.component';
import {CartService} from './core/cart.service';
import {SessionService, SessionUser} from './core/session.service';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'USER',
	enable: true
};

const admin: SessionUser = {...member, id: 1, role: 'ADMIN'};

describe('AppComponent shell', () => {
	let httpMock: HttpTestingController;
	let session: SessionService;
	let cart: CartService;
	let fixture: ComponentFixture<AppComponent>;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [
				provideNoopAnimations(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'shop', component: EmptyComponent},
					{path: 'cart', component: EmptyComponent},
					{path: 'admin', component: EmptyComponent},
					{path: 'info', component: EmptyComponent},
					{path: 'contact', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		session = TestBed.inject(SessionService);
		cart = TestBed.inject(CartService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	function createShell(): ComponentFixture<AppComponent> {
		fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();
		return fixture;
	}

	function element(): HTMLElement {
		return fixture.nativeElement;
	}

	it('renders the guest navbar with the login button and the cart counter', () => {
		createShell();
		const component = fixture.componentInstance;
		expect(component.isLoggedIn()).toBe(false);
		expect(element().querySelectorAll('a.nav-link').length).toBeGreaterThan(0);
		expect(element().querySelector('button.btn-dark:not(.btn-lang)')).not.toBeNull();
		expect(element().textContent).not.toContain('(' + 0 + ')');
	});

	it('drives the language select', () => {
		createShell();
		const component = fixture.componentInstance;
		const langSelect = element().querySelector('select.btn-lang') as HTMLSelectElement;
		expect(Array.from(langSelect.options).map(option => option.value)).toEqual(['en', 'vi']);
		langSelect.value = 'vi';
		langSelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expect(component.translate.currentLang()).toBe('vi');
	});

	it('picks the fallback language when the browser locale is unusable', () => {
		vi.stubGlobal('navigator', {languages: ['fr-FR'], language: 'fr-FR'});
		const component = createShell().componentInstance;
		expect(component.translate.currentLang()).toBe('en');
	});

	it('reflects the cart count from the cart service', () => {
		createShell();
		cart.add({id: 1, name: 'Rose', imgUrl: '', price: 250000, categoryName: 'Fresh', typeName: 'Daily'});
		fixture.detectChanges();
		expect(element().textContent).toContain('(1)');
	});

	it('renders the member navbar and logs out through the v3 endpoint', () => {
		session.login('token-1', member);
		createShell();
		expect(fixture.componentInstance.isLoggedIn()).toBe(true);
		const logout = element().querySelector('button.btn-dark:not(.btn-lang)') as HTMLButtonElement;
		logout.click();
		const request = httpMock.expectOne('/api/auth/logout');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toBeNull();
		request.flush(null, {status: 204, statusText: 'No Content'});
		fixture.detectChanges();
		expect(fixture.componentInstance.isLoggedIn()).toBe(false);
	});

	it('renders the admin navbar for an admin session', () => {
		session.login('token-1', admin);
		createShell();
		expect(fixture.componentInstance.isAdmin()).toBe(true);
		expect(element().querySelector('a[routerLink="/admin"]')).not.toBeNull();
		expect(element().querySelector('a[routerLink="/shop"]')).toBeNull();
	});

	it('opens the auth modal through the shared login request path', () => {
		createShell();
		expect(element().querySelector('app-auth-modal .modal')).toBeNull();
		(element().querySelector('button.btn-dark:not(.btn-lang)') as HTMLButtonElement).click();
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([]);
		httpMock.expectOne('../assets/data/districts.json').flush([]);
		fixture.detectChanges();
		expect(element().querySelector('app-auth-modal .modal')).not.toBeNull();
		expect(element().textContent).toContain('MAIN.LOGIN');
	});

	it('hosts the toast container', () => {
		createShell();
		expect(element().querySelector('app-toasts')).not.toBeNull();
	});

	it('pins the credit footer with a new-tab source link', () => {
		createShell();
		const footer = element().querySelector('footer.app-footer') as HTMLElement;
		expect(footer).not.toBeNull();
		expect(footer.textContent).toContain('MAIN.CREDIT');
		const link = footer.querySelector('a.footer-source') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe('https://github.com/lavantien/FlowerShop');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener');
		expect(link.getAttribute('aria-label')).toBe('MAIN.SOURCE');
		expect(link.querySelector('svg path')).not.toBeNull();
	});

	it('navigates a member to the cart page from the navbar button', () => {
		session.login('token-1', member);
		createShell();
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
		(element().querySelector('[data-test="nav-cart"]') as HTMLButtonElement).click();
		expect(navigate).toHaveBeenCalledWith(['/cart']);
	});

	it('opens the login modal instead when a guest taps the cart', () => {
		createShell();
		(element().querySelector('[data-test="nav-cart"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([]);
		httpMock.expectOne('../assets/data/districts.json').flush([]);
		fixture.detectChanges();
		expect(element().querySelector('app-auth-modal .modal')).not.toBeNull();
	});
});
