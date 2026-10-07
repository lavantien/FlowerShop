import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {WishlistComponent} from './wishlist.component';
import {CartService} from '../../core/cart.service';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {ProductView, WishlistEntry} from '../../models';

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: 'A',
	district: 'Bình Thạnh',
	city: 'Hồ Chí Minh',
	role: 'USER',
	enable: true
};

function productView(id: number, stock: number): ProductView {
	return {
		id,
		name: `Flower ${id}`,
		description: `flower ${id}`,
		imgUrl: `https://img/${id}`,
		price: 100000,
		typeName: 'Daily',
		categoryName: 'Fresh',
		stock
	};
}

function entry(id: number, stock: number): WishlistEntry {
	return {product: productView(id, stock), createdAt: '2026-10-01T00:00:00Z'};
}

describe('WishlistComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<WishlistComponent>;
	let component: WishlistComponent;
	let cart: CartService;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [WishlistComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		cart = TestBed.inject(CartService);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', member);
		fixture = TestBed.createComponent(WishlistComponent);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	function flush(entries: WishlistEntry[]): void {
		httpMock.expectOne('/api/wishlist/me').flush(entries);
		fixture.detectChanges();
	}

	it('renders the wishlist grid with prices and stock aware add buttons', () => {
		fixture.detectChanges();
		flush([entry(1, 5), entry(2, 0)]);
		const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.card');
		expect(cards.length).toBe(2);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('Flower 1');
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('₫100,000');
		const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="wishlist-add"]');
		expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
		expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
	});

	it('shows the empty state when the list is empty or fails', () => {
		fixture.detectChanges();
		flush([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('INFO.NO_WISHLIST');
		component.load();
		httpMock.expectOne('/api/wishlist/me').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.entries()).toEqual([]);
	});

	it('removes an entry through the toggle and toasts', () => {
		const show = vi.spyOn(toast, 'show');
		fixture.detectChanges();
		flush([entry(1, 5), entry(2, 5)]);
		((fixture.nativeElement as HTMLElement).querySelectorAll('[data-test="wishlist-heart"]')[0] as HTMLButtonElement).click();
		httpMock.expectOne('/api/wishlist/me/1').flush({added: false});
		fixture.detectChanges();
		expect(component.entries().map(remaining => remaining.product.id)).toEqual([2]);
		expect(show).toHaveBeenCalledWith(expect.any(String), 'info');
	});

	it('reloads when a toggle unexpectedly re adds', () => {
		fixture.detectChanges();
		flush([entry(1, 5)]);
		component.onToggle(1);
		httpMock.expectOne('/api/wishlist/me/1').flush({added: true});
		httpMock.expectOne('/api/wishlist/me').flush([entry(1, 5), entry(2, 5)]);
		expect(component.entries().length).toBe(2);
	});

	it('adds a wished product to the cart', () => {
		fixture.detectChanges();
		flush([entry(1, 5)]);
		(fixture.nativeElement.querySelector('[data-test="wishlist-add"]') as HTMLButtonElement).click();
		expect(cart.lines()).toEqual([{product: productView(1, 5), quantity: 1}]);
	});
});
