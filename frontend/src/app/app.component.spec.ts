import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {AppComponent} from './app.component';

describe('AppComponent reset password', () => {
	let httpMock: HttpTestingController;

	beforeEach(() => {
		vi.stubGlobal('alert', vi.fn());
		TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	function createApp(): AppComponent {
		const component = TestBed.createComponent(AppComponent).componentInstance;
		httpMock.match(() => true).forEach(req => req.flush([{name: 'Hồ Chí Minh'}]));
		return component;
	}

	function fillForgotPasswordForm(component: AppComponent) {
		component.forgotPasswordForm.email = 'member@flowershop.example';
		component.forgotPasswordForm.answer = 'demo';
		component.forgotPasswordForm.password = '1234qwer';
		component.forgotPasswordForm.rePassword = '1234qwer';
		component.modalRef = {hide: vi.fn()} as unknown as BsModalRef;
		component.modalRef2 = {hide: vi.fn()} as unknown as BsModalRef;
	}

	it('posts the raw answer and password to reset password', () => {
		const component = createApp();
		fillForgotPasswordForm(component);
		component.onVerify();
		const req = httpMock.expectOne('/api/user/resetPassword');
		expect(req.request.method).toBe('POST');
		expect(req.request.body).toEqual({
			email: 'member@flowershop.example',
			answer: 'demo',
			password: '1234qwer',
			rePassword: '1234qwer'
		});
		req.flush({token: btoa('0+GUESS')});
		expect(alert).toHaveBeenCalledTimes(1);
	});

	it('forwards the raw password into the login request on success', () => {
		const component = createApp();
		fillForgotPasswordForm(component);
		component.onVerify();
		httpMock.expectOne('/api/user/resetPassword').flush({token: btoa('4+MEMBER')});
		const login = httpMock.expectOne('/api/user/login');
		expect(login.request.body).toBe(btoa('member@flowershop.example' + 'j0z' + '1234qwer'));
		login.flush({token: btoa('4+MEMBER'), phone: '0900000004', detailAddress: 'A, Bình Thạnh, Hồ Chí Minh'});
		expect(component.loginForm.password).toBe('1234qwer');
	});
});
