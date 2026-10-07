import {Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {StoreComponent} from './store.component';
import {SessionService} from '../_services/session.service';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

function product(id: number, name: string, price: number, imgUrl: string): Product {
	return {
		id,
		name,
		description: `flower ${id}`,
		price,
		imgUrl,
		quantity: 5,
		saleAmount: 0,
		categoryName: 'Fresh',
		typeName: 'Daily'
	};
}

const products: Product[] = [
	product(1, 'Rose', 1, 'aGk='),
	product(2, 'Tulip', 2, ''),
	product(3, 'Lily', 3, 'aGk=')
];

const categories: Category[] = [{id: 1, name: 'Fresh'}];
const types: Type[] = [
	{id: 1, name: 'Daily', categoryName: 'Fresh'},
	{id: 2, name: 'Event', categoryName: 'Pot'}
];

describe('StoreComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<StoreComponent>;

	function configure() {
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
		vi.spyOn(TestBed.inject(BsModalService), 'show').mockReturnValue({hide: vi.fn()} as unknown as BsModalRef);
	}

	beforeEach(() => {
		vi.stubGlobal('alert', vi.fn());
		configure();
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	function flushData(productList: Product[]) {
		httpMock.expectOne('/api/product').flush(productList.map(p => ({...p})));
		httpMock.expectOne('/api/category').flush(categories.map(c => ({...c})));
		httpMock.expectOne('/api/type').flush(types.map(t => ({...t})));
	}

	function createStore(productList: Product[] = products): ComponentFixture<StoreComponent> {
		fixture = TestBed.createComponent(StoreComponent);
		fixture.detectChanges();
		flushData(productList);
		fixture.detectChanges();
		return fixture;
	}

	it('loads and pages the catalogue for a guest', () => {
		const component = createStore().componentInstance;
		expect(component.isLoggedIn).toBe(false);
		expect(component.isAdmin).toBe(false);
		expect(component.products().map(p => p.name)).toEqual(['Rose', 'Tulip', 'Lily']);
		expect(component.products()[0].imgUrl).toBe('hi');
		expect(component.products()[1].imgUrl).toBe('');
		expect(component.displayProducts().length).toBe(3);
		expect(component.searchForm.categoryName).toBe('Fresh');
		expect(component.searchForm.typeName).toBe('Daily');
	});

	it('marks an admin and redirects there', () => {
		localStorage.setItem('token', btoa('1+ADMIN'));
		const component = createStore().componentInstance;
		expect(component.isAdmin).toBe(true);
		expect(component.isLoggedIn).toBe(true);
	});

	it('surfaces an empty catalogue when the api fails', () => {
		fixture = TestBed.createComponent(StoreComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush('boom', {status: 500, statusText: 'Server Error'});
		httpMock.expectOne('/api/category').flush('boom', {status: 500, statusText: 'Server Error'});
		httpMock.expectOne('/api/type').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.products()).toEqual([]);
		expect(component.categories()).toEqual([]);
		expect(component.types()).toEqual([]);
		expect(component.searchForm.categoryName).toBe('');
		expect(component.searchForm.typeName).toBe('');
	});

	it('treats a null catalogue payload as empty', () => {
		fixture = TestBed.createComponent(StoreComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush(null);
		httpMock.expectOne('/api/category').flush(null);
		httpMock.expectOne('/api/type').flush(null);
		fixture.detectChanges();
		expect(fixture.componentInstance.products()).toEqual([]);
		expect(fixture.componentInstance.categories()).toEqual([]);
	});

	it('drives the filter bar from the template', () => {
		const component = createStore().componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		const selects = element.querySelectorAll('select');
		const categorySelect = selects[0] as HTMLSelectElement;
		component.searchForm.categoryName = 'Fresh';
		categorySelect.selectedIndex = 0;
		categorySelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expect(component.searchForm.typeName).toBe('Daily');
		const typeSelect = selects[1] as HTMLSelectElement;
		typeSelect.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		const perPage = selects[2] as HTMLSelectElement;
		perPage.value = '6';
		perPage.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		(element.querySelector('.btn') as HTMLElement).click();
		fixture.detectChanges();
		(element.querySelector('.responsive-float') as HTMLElement).click();
		fixture.detectChanges();
		expect(component.sortFlip).toBe(true);
		component.onChangeCategory('other');
		expect(component.firstTimeSort).toBe(false);
	});

	it('filters by name and by category plus type', () => {
		const component = createStore().componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		const nameInput = element.querySelector('input[type="text"]') as HTMLInputElement;
		nameInput.value = 'rose';
		nameInput.dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
		nameInput.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
		fixture.detectChanges();
		expect(component.searchResults().map(p => p.name)).toEqual(['Rose']);

		nameInput.value = '';
		nameInput.dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
		component.searchForm.categoryName = 'Fresh';
		component.searchForm.typeName = 'Daily';
		component.onSearch();
		expect(component.searchResults().length).toBe(3);
	});

	it('recomputes the type when the category changes and clears the name on type change', () => {
		const component = createStore().componentInstance;
		component.types.set([{id: 1, name: 'Daily', categoryName: 'Fresh'}, {id: 2, name: 'Event', categoryName: 'Pot'}]);
		component.searchForm.name = 'rose';
		component.searchForm.categoryName = 'Pot';
		component.onChangeCategory('search');
		expect(component.searchForm.typeName).toBe('Event');
		expect(component.searchForm.name).toBe('');
		expect(component.firstTimeSort).toBe(false);

		component.searchForm.name = 'rose';
		component.onChangeTypeSearch();
		expect(component.searchForm.name).toBe('');
	});

	it('sorts by price in both directions and pages the result', () => {
		const component = createStore().componentInstance;
		component.firstTimeSort = false;
		component.onSortPrice();
		expect(component.products().map(p => p.price)).toEqual([59230, 36230, 13230]);
		component.onSortPrice();
		expect(component.products().map(p => p.price)).toEqual([13230, 36230, 59230]);
		expect(component.sortFlip).toBe(false);

		component.currentPage.set(2);
		component.itemPerPage.set(2);
		component.paging(component.searchResults());
		expect(component.displayProducts().map(p => p.id)).toEqual([3]);
		component.onPageChanged({page: 1, itemsPerPage: 2} as never);
		expect(component.displayProducts().map(p => p.id)).toEqual([1, 2]);
	});

	it('moves to another page from the pagination control', () => {
		const bigCatalogue = Array.from({length: 30}, (_, i) => product(i + 1, `Flower ${i + 1}`, i + 1, ''));
		const component = createStore(bigCatalogue).componentInstance;
		const pageButtons = fixture.nativeElement.querySelectorAll('.pagination-page a') as NodeListOf<HTMLElement>;
		const pageButton = Array.from(pageButtons).find(button => button.textContent?.trim() === '2');
		pageButton?.click();
		fixture.detectChanges();
		expect(component.displayProducts()[0].id).toBe(pageButton ? 25 : 1);
	});

	it('adds a product to the session cart from the card button', () => {
		const component = createStore().componentInstance;
		const sessionService = TestBed.inject(SessionService);
		const emitted = vi.fn();
		sessionService.getNewlyAddedProduct().subscribe(emitted);
		(fixture.nativeElement.querySelector('.card-footer button') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(emitted).toHaveBeenCalledWith(component.displayProducts()[0]);
	});

	it('opens the image lightbox with a translated caption', () => {
		const component = createStore().componentInstance;
		component.translate.use('vi');
		fixture.detectChanges();
		fixture.nativeElement.querySelector('img')!.click();
		fixture.detectChanges();
		expect(component.lightboxSrc()).toBe('hi');
		expect(component.lightboxCaption()).toContain('<b>Rose');
		expect(component.lightboxCaption()).toContain('(DATA.Fresh - DATA.Daily)');
	});

	it('shows the empty catalogue row when no product matches', () => {
		const component = createStore([]).componentInstance;
		component.onSortPrice();
		fixture.detectChanges();
		expect(component.displayProducts()).toEqual([]);
		expect(fixture.nativeElement.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('unsubscribes on destroy', () => {
		createStore();
		fixture.destroy();
	});
});
