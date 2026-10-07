import {ApplicationRef, Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {AppComponent} from './app.component';
import {SessionService} from './_services/session.service';
import {Product} from './_models/product';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const cartProduct = (id: number, name: string, price: number): Product => ({
	id,
	name,
	description: `flower ${id}`,
	price,
	imgUrl: '',
	quantity: 5,
	saleAmount: 0,
	categoryName: 'Fresh',
	typeName: 'Daily'
});

describe('AppComponent rendering', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AppComponent>;

	beforeEach(() => {
		vi.stubGlobal('alert', vi.fn());
		vi.spyOn(window, 'scrollTo').mockImplementation(() => {
		});
		TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [
				provideNoopAnimations(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'shop', component: EmptyComponent},
					{path: 'admin', component: EmptyComponent},
					{path: 'info', component: EmptyComponent},
					{path: 'summary', component: EmptyComponent},
					{path: 'contact', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		localStorage.clear();
	});

	function createApp(citiesStatus = 200): ComponentFixture<AppComponent> {
		fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();
		if (citiesStatus === 200) {
			httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Hồ Chí Minh'}]);
			httpMock.expectOne('../assets/data/districts.json').flush([
				{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'},
				{name: 'Vũng Tàu', cityName: 'Bà Rịa'}
			]);
		} else if (citiesStatus === 500) {
			httpMock.expectOne('../assets/data/cities.json').flush('boom', {status: 500, statusText: 'Server Error'});
			httpMock.expectOne('../assets/data/districts.json').flush('boom', {status: 500, statusText: 'Server Error'});
		} else {
			httpMock.expectOne('../assets/data/cities.json').flush(null);
			httpMock.expectOne('../assets/data/districts.json').flush(null);
		}
		fixture.detectChanges();
		return fixture;
	}

	function lastModal(): HTMLElement {
		const modals = document.querySelectorAll('.modal-content');
		return modals[modals.length - 1] as HTMLElement;
	}

	function openModal(click: () => void): HTMLElement {
		click();
		TestBed.inject(ApplicationRef).tick();
		return lastModal();
	}

	function click(element: Element) {
		element.dispatchEvent(new Event('click', {bubbles: true}));
	}

	function setText(input: HTMLInputElement, value: string) {
		input.value = value;
		input.dispatchEvent(new Event('input', {bubbles: true}));
	}

	it('renders the guest navbar, drives the language select and the scroll buttons', () => {
		const component = createApp().componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		expect(component.isLoggedIn()).toBe(false);
		const langSelect = element.querySelector('select.btn-lang') as HTMLSelectElement;
		expect(Array.from(langSelect.options).map(option => option.value)).toEqual(['en', 'vi']);
		langSelect.value = 'vi';
		langSelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expect(component.translate.currentLang()).toBe('vi');
		click(element.querySelector('button.fixed-bottom') as Element);
		click(element.querySelector('button.fixed-bottom-2') as Element);
		expect(window.scrollTo).toHaveBeenCalledTimes(2);
		component.scrollLeft();
		component.scrollRight();
		expect(component.cities().length).toBe(1);
		expect(component.signUpForm.city).toBe('Hồ Chí Minh');
		expect(component.districts().length).toBe(2);
		expect(component.signUpForm.district).toBe('Bình Thạnh');
	});

	it('falls back to empty city data when the asset requests fail', () => {
		const component = createApp(500).componentInstance;
		expect(component.cities()).toEqual([]);
		expect(component.districts()).toEqual([]);
		expect(component.signUpForm.city).toBe('');
		expect(component.signUpForm.district).toBe('');
	});

	it('treats null city data as empty', () => {
		const component = createApp(404).componentInstance;
		expect(component.cities()).toEqual([]);
		expect(component.districts()).toEqual([]);
	});

	it('picks the fallback language when the browser locale is unusable', () => {
		vi.stubGlobal('navigator', {languages: ['fr-FR'], language: 'fr-FR'});
		const component = createApp().componentInstance;
		expect(component.translate.currentLang()).toBe('en');
		vi.unstubAllGlobals();
		vi.stubGlobal('navigator', {});
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [
				provideNoopAnimations(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([{path: '**', component: EmptyComponent}]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		const silent = TestBed.createComponent(AppComponent);
		silent.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Hồ Chí Minh'}]);
		httpMock.expectOne('../assets/data/districts.json').flush([{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'}]);
		expect(silent.componentInstance.translate.currentLang()).toBe('en');
	});

	it('renders the member navbar and logs out', () => {
		localStorage.setItem('token', btoa('4+MEMBER'));
		localStorage.setItem('phone', '0900000004');
		localStorage.setItem('detailAddress', 'A, Bình Thạnh, Hồ Chí Minh');
		const component = createApp().componentInstance;
		expect(component.isLoggedIn()).toBe(true);
		localStorage.removeItem('phone');
		localStorage.removeItem('detailAddress');
		const element: HTMLElement = fixture.nativeElement;
		const logout = Array.from(element.querySelectorAll('button'))
			.find(button => button.textContent?.trim() === '') as HTMLButtonElement;
		click(logout);
		const request = httpMock.expectOne('/api/user/logout');
		expect(request.request.body).toEqual({
			token: btoa('4+MEMBER'),
			phone: '',
			detailAddress: ''
		});
		request.flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.isLoggedIn()).toBe(true);
		click(logout);
		httpMock.expectOne('/api/user/logout')
			.flush({token: btoa('0+GUESS'), phone: '0', detailAddress: 'A, Bình Thạnh, Hồ Chí Minh'});
		fixture.detectChanges();
		expect(component.isLoggedIn()).toBe(false);
	});

	it('renders the admin navbar for an admin session', () => {
		localStorage.setItem('token', btoa('1+ADMIN'));
		const component = createApp().componentInstance;
		expect(component.isAdmin()).toBe(true);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('a.nav-link').length).toBeGreaterThan(0);
	});

	it('runs the login modal through validation failure, network failure and success', () => {
		const component = createApp().componentInstance;
		const modal = openModal(() => click(fixture.nativeElement.querySelector('button.btn-dark:not(.btn-lang)') as Element));
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		const footer = modal.querySelectorAll('.modal-footer button');
		const signUpModal = openModal(() => click(footer[1]));
		expect(signUpModal.textContent).toContain('MAIN.SIGN_UP');
		component.modalRef2.hide();
		const forgotModal = openModal(() => click(footer[2]));
		expect(forgotModal.textContent).toContain('MAIN.FORGOT_PASSWORD');
		component.modalRef2.hide();

		click(footer[0]);
		fixture.detectChanges();
		expect(component.wrongLogin).toBe(true);
		expect(component.loginForm.email).toBe('');

		setText(inputs[0], 'member@flowershop.example');
		setText(inputs[1], 'short');
		inputs[1].dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
		fixture.detectChanges();
		expect(component.wrongLogin).toBe(true);

		setText(inputs[0], 'member@flowershop.example');
		setText(inputs[1], '1234qwer');
		click(footer[0]);
		const brokenLogin = httpMock.expectOne('/api/user/login');
		brokenLogin.flush('boom', {status: 500, statusText: 'Server Error'});
		expect(component.isLoggedIn()).toBe(false);

		click(footer[0]);
		httpMock.expectOne('/api/user/login')
			.flush({token: btoa('4+MEMBER'), phone: '0900000004', detailAddress: 'A, Bình Thạnh, Hồ Chí Minh'});
		fixture.detectChanges();
		expect(component.isLoggedIn()).toBe(true);
		expect(localStorage.getItem('token')).toBe(btoa('4+MEMBER'));
		click(footer[3]);
		click(modal.querySelector('.btn-close') as Element);
	});

	it('creates a user from the sign up modal and chains into the login', () => {
		const component = createApp().componentInstance;
		const loginModal = openModal(() => click(fixture.nativeElement.querySelector('button.btn-dark:not(.btn-lang)') as Element));
		const modal = openModal(() => click(loginModal.querySelectorAll('.modal-footer button')[1]));
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		const selects = Array.from(modal.querySelectorAll('select')) as HTMLSelectElement[];
		const footer = modal.querySelectorAll('.modal-footer button');
		click(footer[0]);
		fixture.detectChanges();
		expect(component.wrongCreate).toBe(true);
		click(footer[1]);
		expect(component.signUpForm.name).toBe('');

		const [name, email, reEmail, password, rePassword, answer, reAnswer, phone, address] = inputs;
		setText(name, 'Member');
		setText(email, 'member@flowershop.example');
		setText(reEmail, 'member@flowershop.example');
		setText(password, '1234qwer');
		setText(rePassword, '1234qwer');
		setText(answer, 'demo');
		setText(reAnswer, 'demo');
		setText(phone, '0900000004');
		setText(address, 'A');
		selects[0].value = 'Hồ Chí Minh';
		selects[0].dispatchEvent(new Event('change', {bubbles: true}));
		selects[1].selectedIndex = 0;
		selects[1].dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		click(footer[0]);
		const create = httpMock.expectOne('/api/user/create');
		expect(create.request.body.email).toBe('member@flowershop.example');
		create.flush({});
		httpMock.expectOne('/api/user/login')
			.flush({token: btoa('4+MEMBER'), phone: '0900000004', detailAddress: 'A, Bình Thạnh, Hồ Chí Minh'});
		expect(alert).toHaveBeenCalledTimes(1);
		click(modal.querySelector('.btn-close') as Element);
	});

	it('validates the forgot password modal fields', () => {
		const component = createApp().componentInstance;
		const loginModal = openModal(() => click(fixture.nativeElement.querySelector('button.btn-dark:not(.btn-lang)') as Element));
		const modal = openModal(() => click(loginModal.querySelectorAll('.modal-footer button')[2]));
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		const footer = modal.querySelectorAll('.modal-footer button');
		click(footer[0]);
		fixture.detectChanges();
		expect(component.wrongForgot).toBe(true);
		expect(component.forgotPasswordForm.email).toBe('');
		setText(inputs[0], 'member@flowershop.example');
		setText(inputs[1], 'demo');
		setText(inputs[2], '1234qwer');
		setText(inputs[3], '1234qwer');
		inputs[3].dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
		httpMock.expectOne('/api/user/resetPassword').flush({token: btoa('0+GUESS')});
		fixture.detectChanges();
		expect(component.forgotPasswordForm.answer).toBe('demo');
		click(footer[1]);
		expect(component.forgotPasswordForm.answer).toBe('');
		click(modal.querySelector('.btn-close') as Element);
	});

	it('manages the cart from the cart modal and settles the order', () => {
		const component = createApp().componentInstance;
		const sessionService = TestBed.inject(SessionService);
		sessionService.updateNewlyAddedProduct(cartProduct(1, 'Rose', 20));
		sessionService.updateNewlyAddedProduct(cartProduct(2, 'Tulip', 30));
		sessionService.updateNewlyAddedProduct(cartProduct(1, 'Rose', 20));
		fixture.detectChanges();
		expect(component.countAddedProduct()).toBe(2);
		expect(component.totalPriceOfAddedProduct()).toBe(70);

		const modal = openModal(() => click(fixture.nativeElement.querySelector('button.btn-lang') as Element));
		expect(component.cartForm.phone).toBe('0');
		expect(component.cartForm.address).toBe('A');
		expect(component.cartForm.district).toBe('Bình Thạnh');
		expect(component.cartForm.city).toBe('Hồ Chí Minh');
		expect(modal.textContent).toContain('Rose');
		expect(modal.textContent).toContain('Tulip');
		const cartInputs = Array.from(modal.querySelectorAll('.personal-info input')) as HTMLInputElement[];
		const cartSelects = Array.from(modal.querySelectorAll('.personal-info select')) as HTMLSelectElement[];
		setText(cartInputs[0], '0900000004');
		setText(cartInputs[1], 'B');
		cartSelects[0].value = 'Hồ Chí Minh';
		cartSelects[0].dispatchEvent(new Event('change', {bubbles: true}));
		cartSelects[1].selectedIndex = 0;
		cartSelects[1].dispatchEvent(new Event('change', {bubbles: true}));
		TestBed.inject(ApplicationRef).tick();
		modal.querySelectorAll('tbody td fa-icon').forEach(faIcon => click(faIcon));
		TestBed.inject(ApplicationRef).tick();
		expect(component.countAddedProduct()).toBe(2);

		click(modal.querySelector('thead fa-icon') as Element);
		TestBed.inject(ApplicationRef).tick();
		expect(component.addedProducts()).toEqual([]);

		sessionService.updateNewlyAddedProduct(cartProduct(3, 'Lily', 25));
		TestBed.inject(ApplicationRef).tick();
		click(modal.querySelectorAll('tbody td fa-icon')[1] as Element);
		TestBed.inject(ApplicationRef).tick();
		expect(component.addedProducts()).toEqual([]);

		sessionService.updateNewlyAddedProduct(cartProduct(4, 'Orchid', 40));
		sessionService.updateNewlyAddedProduct(cartProduct(5, 'Daisy', 15));
		TestBed.inject(ApplicationRef).tick();
		click(modal.querySelector('.modal-footer button') as Element);
		const settle = httpMock.expectOne('/api/bill');
		expect(settle.request.method).toBe('POST');
		expect(settle.request.body.length).toBe(2);
		expect(settle.request.body[0].detailAddress).toBe('B, Bình Thạnh, Hồ Chí Minh');
		settle.flush([]);
		expect(alert).toHaveBeenCalledTimes(1);
		click(modal.querySelector('.modal-footer button') as Element);
		httpMock.expectOne('/api/bill').flush('boom', {status: 500, statusText: 'Server Error'});
		component.modalRef.hide();
		click(modal.querySelector('.btn-close') as Element);
	});

	it('renders the empty cart row when nothing is in the basket', () => {
		const component = createApp().componentInstance;
		localStorage.removeItem('phone');
		localStorage.removeItem('detailAddress');
		const modal = openModal(() => click(fixture.nativeElement.querySelector('button.btn-lang') as Element));
		expect(modal.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
		expect(component.cartForm.phone).toBe('');
		expect(component.cartForm.address).toBe('');
		click(modal.querySelector('.modal-footer button') as Element);
		httpMock.expectOne('/api/bill').flush('boom', {status: 500, statusText: 'Server Error'});
	});

	it('switches the shared theme and tears down on destroy', () => {
		const component = createApp().componentInstance;
		component.displayBg = 'BLUE';
		component.onChangeThemeColor();
		expect(component.bgPrimary()).toBe('bg-primary');
		expect(component.tcPrimary()).toBe('text-white');
		fixture.destroy();
	});
});
