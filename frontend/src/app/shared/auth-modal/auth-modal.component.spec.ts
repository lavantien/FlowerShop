import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {AuthModalComponent} from './auth-modal.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';

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

describe('AuthModalComponent', () => {
	let httpMock: HttpTestingController;
	let session: SessionService;
	let toasts: ToastService;
	let fixture: ComponentFixture<AuthModalComponent>;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AuthModalComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		session = TestBed.inject(SessionService);
		toasts = TestBed.inject(ToastService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		localStorage.clear();
	});

	function create(): ComponentFixture<AuthModalComponent> {
		fixture = TestBed.createComponent(AuthModalComponent);
		fixture.detectChanges();
		return fixture;
	}

	function openViaRequest(cities: object[] = [], districts: object[] = []): HTMLElement {
		session.requestLogin();
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush(cities);
		httpMock.expectOne('../assets/data/districts.json').flush(districts);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	function fillLogin(email: string, password: string): void {
		const inputs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.modal-body input'));
		(inputs[0] as HTMLInputElement).value = email;
		(inputs[0] as HTMLInputElement).dispatchEvent(new Event('input', {bubbles: true}));
		(inputs[1] as HTMLInputElement).value = password;
		(inputs[1] as HTMLInputElement).dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
	}

	it('stays hidden until the session requests a login', () => {
		const element = create().nativeElement as HTMLElement;
		expect(element.querySelector('.modal')).toBeNull();
		const modal = openViaRequest();
		expect(modal.querySelector('.modal')).not.toBeNull();
		expect(modal.textContent).toContain('MAIN.LOGIN');
	});

	it('rejects an invalid login form without any request', () => {
		create();
		openViaRequest();
		fixture.componentInstance.onLogin();
		expect(fixture.componentInstance.wrongLogin()).toBe(true);
		expect(httpMock.match(() => true)).toHaveLength(0);
	});

	it('posts the json login body and closes on success', () => {
		create();
		openViaRequest();
		fillLogin('member@flowershop.example', '1234qwer');
		fixture.componentInstance.onLogin();
		const request = httpMock.expectOne('/api/auth/login');
		expect(request.request.body).toEqual({email: 'member@flowershop.example', password: '1234qwer'});
		request.flush({token: 'token-1', user: member});
		fixture.detectChanges();
		expect(session.isLoggedIn()).toBe(true);
		expect(fixture.componentInstance.visible()).toBe(false);
	});

	it('flags a wrong login on 401', () => {
		create();
		openViaRequest();
		fillLogin('member@flowershop.example', '1234qwer');
		fixture.componentInstance.onLogin();
		httpMock.expectOne('/api/auth/login')
			.flush({title: 'Unauthorized', status: 401}, {status: 401, statusText: 'Unauthorized'});
		fixture.detectChanges();
		expect(fixture.componentInstance.wrongLogin()).toBe(true);
		expect(fixture.componentInstance.visible()).toBe(true);
	});

	it('switches to the register view and back', () => {
		const element = openViaRequestAfterCreate();
		const footer = Array.from(element.querySelectorAll('.modal-footer button'));
		(footer[1] as HTMLElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.mode()).toBe('register');
		expect(element.textContent).toContain('MAIN.RE_ANSWER');
		(Array.from(element.querySelectorAll('.modal-footer button'))[1] as HTMLElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.mode()).toBe('login');
	});

	it('switches to the forgot view', () => {
		const element = openViaRequestAfterCreate();
		const footer = Array.from(element.querySelectorAll('.modal-footer button'));
		(footer[2] as HTMLElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.mode()).toBe('forgot');
		expect(element.textContent).toContain('MAIN.RE_NEW_PASSWORD');
	});

	it('rejects a register form with mismatching confirmations', () => {
		create();
		openViaRequest();
		fixture.componentInstance.switchMode('register');
		const component = fixture.componentInstance;
		component.registerForm.patchValue({
			name: 'Member',
			email: 'member@flowershop.example',
			reEmail: 'other@flowershop.example',
			password: '1234qwer',
			rePassword: '1234qwer',
			answer: 'demo',
			reAnswer: 'demo'
		});
		component.onRegister();
		expect(component.registerForm.invalid).toBe(true);
		expect(component.wrongCreate()).toBe(true);
		expect(httpMock.match(() => true)).toHaveLength(0);
	});

	it('registers with the contract body, toasts and chains the login', () => {
		create();
		openViaRequest();
		fixture.componentInstance.switchMode('register');
		const component = fixture.componentInstance;
		component.registerForm.patchValue({
			name: 'Member',
			email: 'member@flowershop.example',
			reEmail: 'member@flowershop.example',
			password: '1234qwer',
			rePassword: '1234qwer',
			answer: 'demo',
			reAnswer: 'demo',
			phone: '0900000004',
			address: 'A'
		});
		component.onRegister();
		const createRequest = httpMock.expectOne('/api/user/create');
		expect(createRequest.request.body).toEqual({
			name: 'Member',
			email: 'member@flowershop.example',
			password: '1234qwer',
			phone: '0900000004',
			address: 'A',
			district: 'Bình Thạnh',
			city: 'Hồ Chí Minh',
			answer: 'demo'
		});
		createRequest.flush(member);
		expect(toasts.toasts().map(toast => toast.kind)).toEqual(['success']);
		const login = httpMock.expectOne('/api/auth/login');
		expect(login.request.body).toEqual({email: 'member@flowershop.example', password: '1234qwer'});
		login.flush({token: 'token-1', user: member});
		expect(session.isLoggedIn()).toBe(true);
		expect(component.visible()).toBe(false);
	});

	it('flags a duplicate email on register 409', () => {
		create();
		openViaRequest();
		fixture.componentInstance.switchMode('register');
		const component = fixture.componentInstance;
		component.registerForm.patchValue({
			name: 'Member',
			email: 'member@flowershop.example',
			reEmail: 'member@flowershop.example',
			password: '1234qwer',
			rePassword: '1234qwer',
			answer: 'demo',
			reAnswer: 'demo'
		});
		component.onRegister();
		httpMock.expectOne('/api/user/create')
			.flush({title: 'Conflict', status: 409, code: 'EMAIL_IN_USE'}, {status: 409, statusText: 'Conflict'});
		expect(component.wrongCreate()).toBe(true);
		expect(component.visible()).toBe(true);
	});

	it('resets the register form to its defaults', () => {
		create();
		openViaRequest();
		const component = fixture.componentInstance;
		component.switchMode('register');
		component.registerForm.patchValue({name: 'Member', email: 'x@y.z'});
		component.resetRegisterForm();
		expect(component.registerForm.getRawValue().name).toBe('');
		expect(component.registerForm.getRawValue().city).toBe('Hồ Chí Minh');
		expect(component.registerForm.getRawValue().district).toBe('Bình Thạnh');
	});

	it('resets the district when the city select changes', () => {
		create();
		openViaRequest(
			[{name: 'Hồ Chí Minh'}, {name: 'Vũng Tàu'}],
			[
				{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'},
				{name: 'Gò Vấp', cityName: 'Hồ Chí Minh'},
				{name: 'Bà Rịa', cityName: 'Vũng Tàu'}
			]
		);
		const component = fixture.componentInstance;
		expect(component.geo.cities()).toHaveLength(2);
		component.switchMode('register');
		component.registerForm.controls.city.setValue('Vũng Tàu');
		component.onCityChange();
		expect(component.registerForm.controls.district.value).toBe('Bà Rịa');
	});

	it('rejects a forgot form with mismatching passwords', () => {
		create();
		openViaRequest();
		const component = fixture.componentInstance;
		component.switchMode('forgot');
		component.forgotForm.patchValue({
			email: 'member@flowershop.example',
			answer: 'demo',
			newPassword: '1234qwer',
			reNewPassword: 'different'
		});
		component.onForgot();
		expect(component.wrongForgot()).toBe(true);
		expect(httpMock.match(() => true)).toHaveLength(0);
	});

	it('resets the password and seeds the new session', () => {
		create();
		openViaRequest();
		const component = fixture.componentInstance;
		component.switchMode('forgot');
		component.forgotForm.patchValue({
			email: 'member@flowershop.example',
			answer: 'demo',
			newPassword: '1234qwer',
			reNewPassword: '1234qwer'
		});
		component.onForgot();
		const request = httpMock.expectOne('/api/user/resetPassword');
		expect(request.request.body).toEqual({email: 'member@flowershop.example', answer: 'demo', newPassword: '1234qwer'});
		request.flush({token: 'token-2', user: member});
		expect(session.isLoggedIn()).toBe(true);
		expect(session.token()).toBe('token-2');
		expect(component.visible()).toBe(false);
		expect(toasts.toasts().map(toast => toast.kind)).toEqual(['success']);
	});

	it('toasts the failure and stays open on a wrong answer', () => {
		create();
		openViaRequest();
		const component = fixture.componentInstance;
		component.switchMode('forgot');
		component.forgotForm.patchValue({
			email: 'member@flowershop.example',
			answer: 'wrong',
			newPassword: '1234qwer',
			reNewPassword: '1234qwer'
		});
		component.onForgot();
		httpMock.expectOne('/api/user/resetPassword')
			.flush({title: 'Unauthorized', status: 401}, {status: 401, statusText: 'Unauthorized'});
		expect(component.wrongForgot()).toBe(true);
		expect(component.visible()).toBe(true);
		expect(toasts.toasts().map(toast => toast.kind)).toEqual(['danger']);
	});

	it('close hides the modal and clears the inline errors', () => {
		create();
		openViaRequest();
		const component = fixture.componentInstance;
		component.wrongLogin.set(true);
		component.close();
		expect(component.visible()).toBe(false);
		expect(component.wrongLogin()).toBe(false);
	});

	function openViaRequestAfterCreate(): HTMLElement {
		create();
		return openViaRequest();
	}
});
