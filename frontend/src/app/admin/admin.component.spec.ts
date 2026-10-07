import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {AdminComponent} from './admin.component';
import {ProductsComponent} from './products/products.component';
import {SessionService, SessionUser} from '../core/session.service';

const admin: SessionUser = {
	id: 1,
	name: 'Admin',
	email: 'admin@flowershop.example',
	phone: '0900000001',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'ADMIN',
	enable: true
};

describe('AdminComponent shell', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminComponent>;

	function configure(): void {
		TestBed.configureTestingModule({
			imports: [AdminComponent],
			providers: [
				provideRouter([
					{
						path: 'admin',
						component: AdminComponent,
						children: [
							{path: '', pathMatch: 'full', redirectTo: 'products'},
							{path: 'products', component: ProductsComponent}
						]
					},
					{path: '**', component: AdminComponent}
				]),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminComponent);
	}

	function flushChildRequests(): void {
		httpMock.match(() => true).forEach(request => request.flush([]));
	}

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	it('renders the products tab', () => {
		configure();
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('ADMIN.TAB_PRODUCTS');
		expect(element.querySelector('router-outlet')).not.toBeNull();
	});

	it('redirects the bare admin path to the products child', async () => {
		configure();
		fixture.detectChanges();
		const router = TestBed.inject(Router);
		await router.navigate(['/admin']);
		expect(router.url).toBe('/admin/products');
		fixture.detectChanges();
		flushChildRequests();
	});

	it('hosts the products child under its tab', async () => {
		configure();
		fixture.detectChanges();
		const router = TestBed.inject(Router);
		await router.navigate(['/admin/products']);
		// zoneless activation instantiates the child on the next change detection
		fixture.detectChanges();
		flushChildRequests();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});
});
