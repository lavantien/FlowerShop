import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService, TranslateService} from '@ngx-translate/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../locale';
import {StoreComponent} from './store.component';
import {CartService} from '../core/cart.service';
import {SessionService, SessionUser} from '../core/session.service';
import {Category, Page, ProductView, Type} from '../models';

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

function productView(id: number, name: string, price: number, stock: number): ProductView {
	return {
		id,
		name,
		description: `flower ${id}`,
		imgUrl: `https://img/${name.toLowerCase()}`,
		price,
		typeName: 'Daily',
		categoryName: 'Fresh',
		stock
	};
}

const firstPage: Page<ProductView> = {
	content: [productView(1, 'Rose', 90000, 5), productView(2, 'Tulip', 120000, 3)],
	totalElements: 30,
	totalPages: 3,
	page: 0,
	size: 12
};

const categories: Category[] = [{id: 1, name: 'Fresh'}, {id: 2, name: 'Pot'}];
const types: Type[] = [
	{id: 1, name: 'Daily', categoryName: 'Fresh'},
	{id: 2, name: 'Event', categoryName: 'Pot'}
];

describe('StoreComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<StoreComponent>;
	let component: StoreComponent;
	let cart: CartService;
	let session: SessionService;

	function configure(loggedIn: boolean): void {
		TestBed.configureTestingModule({
			imports: [StoreComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'shop', component: EmptyComponent},
					{path: 'admin', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		cart = TestBed.inject(CartService);
		session = TestBed.inject(SessionService);
		if (loggedIn) {
			session.login('token-1', member);
		}
		vi.spyOn(TestBed.inject(BsModalService), 'show').mockReturnValue({hide: vi.fn()} as unknown as BsModalRef);
		fixture = TestBed.createComponent(StoreComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		httpMock.expectOne(req => req.url === '/api/category').flush(categories);
		httpMock.expectOne(req => req.url === '/api/type').flush(types);
	}

	function expectProducts(query: Record<string, string>, page: Page<ProductView> = firstPage): void {
		const testReq = httpMock.expectOne(req => req.url === '/api/product');
		for (const [key, value] of Object.entries(query)) {
			expect(testReq.request.params.get(key)).toBe(value);
		}
		testReq.flush(page);
		fixture.detectChanges();
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

	it('loads page 0 with the default query and renders the server page without slicing', () => {
		configure(false);
		expectProducts({page: '0', size: '12', sort: 'name-asc'});
		expect(component.content().map(p => p.name)).toEqual(['Rose', 'Tulip']);
		expect(component.content()[0].imgUrl).toBe('https://img/rose');
		expect(component.content()[0].price).toBe(90000);
	});

	it('keeps the applied filters out of the query when they are empty', () => {
		configure(false);
		const testReq = httpMock.expectOne(req => req.url === '/api/product');
		expect([...testReq.request.params.keys()].sort()).toEqual(['page', 'size', 'sort']);
		testReq.flush(firstPage);
	});

	it('computes the paging state off the server page', () => {
		configure(false);
		expectProducts({});
		expect(component.totalElements()).toBe(30);
		expect(component.totalPages()).toBe(3);
		expect(component.hasPrev()).toBe(false);
		expect(component.hasNext()).toBe(true);
		expect(component.rangeLabel()).toBe('1-2 / 30');
	});

	it('resets to page 0 and reloads when a filter changes', () => {
		configure(false);
		expectProducts({});
		component.onPageChanged({page: 3, itemsPerPage: 12} as never);
		expectProducts({page: '2'});
		component.onCategoryChange('Fresh');
		expectProducts({page: '0', category: 'Fresh'});
		component.onTypeChange('Daily');
		expectProducts({page: '0', category: 'Fresh', type: 'Daily'});
		component.onSortChange('price-desc');
		expectProducts({page: '0', category: 'Fresh', type: 'Daily', sort: 'price-desc'});
		component.onSizeChange('24');
		expectProducts({page: '0', size: '24'});
		expect(component.pagination()?.page).toBe(1);
	});

	it('applies the search text on submit', () => {
		configure(false);
		expectProducts({});
		component.searchText.set('rose');
		component.onSearch();
		expectProducts({page: '0', search: 'rose', sort: 'name-asc'});
	});

	it('narrows the type options to the chosen category', () => {
		configure(false);
		expectProducts({});
		expect(component.typesForCategory().map(t => t.name)).toEqual(['Daily', 'Event']);
		component.category.set('Fresh');
		expect(component.typesForCategory().map(t => t.name)).toEqual(['Daily']);
		component.category.set('Pot');
		expect(component.typesForCategory().map(t => t.name)).toEqual(['Event']);
	});

	it('moves across pages through the pagination control', () => {
		configure(false);
		expectProducts({});
		const pageButtons = fixture.nativeElement.querySelectorAll('.pagination-page a') as NodeListOf<HTMLElement>;
		const pageTwo = Array.from(pageButtons).find(button => button.textContent?.trim() === '2');
		pageTwo?.click();
		fixture.detectChanges();
		expectProducts({page: '1'});
		expect(component.page()).toBe(1);
		expect(component.hasPrev()).toBe(true);
	});

	it('drives the filter bar from the template', () => {
		configure(false);
		expectProducts({});
		const element: HTMLElement = fixture.nativeElement;
		const selects = element.querySelectorAll('select');
		const categorySelect = selects[0] as HTMLSelectElement;
		categorySelect.value = 'Fresh';
		categorySelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expectProducts({page: '0', category: 'Fresh'});
		expect(component.category()).toBe('Fresh');

		const sortSelect = selects[selects.length - 2] as HTMLSelectElement;
		sortSelect.value = 'price-asc';
		sortSelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expectProducts({page: '0', category: 'Fresh', sort: 'price-asc'});

		const sizeSelect = selects[selects.length - 1] as HTMLSelectElement;
		sizeSelect.value = '24';
		sizeSelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expectProducts({page: '0', category: 'Fresh', sort: 'price-asc', size: '24'});
		expect(component.size()).toBe(24);

		const nameInput = element.querySelector('input[type="text"]') as HTMLInputElement;
		nameInput.value = 'rose';
		nameInput.dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
		nameInput.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
		fixture.detectChanges();
		expectProducts({page: '0', category: 'Fresh', sort: 'price-asc', size: '24', search: 'rose'});
	});

	it('surfaces an empty page when the api fails', () => {
		configure(false);
		const testReq = httpMock.expectOne(req => req.url === '/api/product');
		testReq.flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.content()).toEqual([]);
		expect(component.totalElements()).toBe(0);
		expect(component.totalPages()).toBe(0);
		expect(component.rangeLabel()).toBe('');
		expect(fixture.nativeElement.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('formats prices through the currency pipe in both locales', () => {
		configure(false);
		expectProducts({});
		const footer = (fixture.nativeElement.querySelector('.card-footer') as HTMLElement).textContent ?? '';
		expect(footer).toContain('₫90,000');
		TestBed.inject(TranslateService).use('vi');
		fixture.detectChanges();
		const footerVi = (fixture.nativeElement.querySelector('.card-footer') as HTMLElement).textContent ?? '';
		expect(footerVi).toContain('90.000');
	});

	it('opens the detail modal for the chosen product', () => {
		configure(false);
		expectProducts({});
		const product = component.content()[0];
		component.openModal(product, {} as never);
		fixture.detectChanges();
		expect(component.selected()).toBe(product);
	});

	it('adds the modal quantity as an absolute cart line', () => {
		configure(false);
		expectProducts({});
		const product = component.content()[0];
		component.openModal(product, {} as never);
		component.onModalAddToCart(3);
		expect(cart.lines()).toEqual([{product, quantity: 3}]);
		component.onModalAddToCart(2);
		expect(cart.lines()).toEqual([{product, quantity: 2}]);
	});

	it('ignores a modal add without a selected product', () => {
		configure(false);
		expectProducts({});
		component.onModalAddToCart(2);
		expect(cart.lines()).toEqual([]);
	});

	it('quick-adds a single unit from the card button', () => {
		configure(false);
		expectProducts({});
		const product = component.content()[1];
		component.addToCart(product);
		expect(cart.lines()).toEqual([{product, quantity: 1}]);
	});

	it('blocks the card add when the product is out of stock', () => {
		configure(false);
		expectProducts({}, {...firstPage, content: [productView(9, 'Dry', 1000, 0)]});
		const element: HTMLElement = fixture.nativeElement;
		expect((element.querySelector('[data-test="store-add"]') as HTMLButtonElement).disabled).toBe(true);
	});

	it('asks a guest to log in when toggling the wishlist', () => {
		configure(false);
		expectProducts({});
		component.toggleWishlist(component.content()[0]);
		expect(session.loginRequested()).toBe(1);
		httpMock.expectNone(req => req.url.startsWith('/api/wishlist'));
		expect(cart.lines()).toEqual([]);
	});

	it('loads the wishlist ids for a member on boot', () => {
		configure(true);
		httpMock.expectOne('/api/wishlist/me').flush([
			{product: productView(1, 'Rose', 90000, 5), createdAt: '2026-10-01T00:00:00Z'},
			{product: productView(2, 'Tulip', 120000, 3), createdAt: '2026-10-02T00:00:00Z'}
		]);
		fixture.detectChanges();
		expectProducts({});
		expect(component.wishlistIds().has(1)).toBe(true);
		expect(component.wishlistIds().has(2)).toBe(true);
		expect(component.wishlistIds().has(3)).toBe(false);
	});

	it('toggles the wishlist heart for a member and keeps the set in sync', () => {
		configure(true);
		httpMock.expectOne('/api/wishlist/me').flush([]);
		fixture.detectChanges();
		expectProducts({});
		expect(component.wishlistIds().has(1)).toBe(false);
		component.toggleWishlist(component.content()[0]);
		httpMock.expectOne('/api/wishlist/me/1').flush({added: true});
		fixture.detectChanges();
		expect(component.wishlistIds().has(1)).toBe(true);
		component.toggleWishlist(component.content()[0]);
		httpMock.expectOne('/api/wishlist/me/1').flush({added: false});
		fixture.detectChanges();
		expect(component.wishlistIds().has(1)).toBe(false);
	});

	it('clears the wishlist ids when the session ends', () => {
		configure(true);
		httpMock.expectOne('/api/wishlist/me').flush([
			{product: productView(1, 'Rose', 90000, 5), createdAt: '2026-10-01T00:00:00Z'}
		]);
		fixture.detectChanges();
		expectProducts({});
		expect(component.wishlistIds().has(1)).toBe(true);
		session.logout();
		fixture.detectChanges();
		expect(component.wishlistIds().has(1)).toBe(false);
	});
});
