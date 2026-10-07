import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService, TranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../locale';
import {ProductModalComponent} from './product-modal.component';
import {ProductView} from '../models';

function productView(stock: number): ProductView {
	return {
		id: 1,
		name: 'Rose',
		description: 'a red rose',
		imgUrl: 'https://img/rose',
		price: 90000,
		typeName: 'Daily',
		categoryName: 'Fresh',
		stock
	};
}

describe('ProductModalComponent', () => {
	let fixture: ComponentFixture<ProductModalComponent>;
	let component: ProductModalComponent;

	function create(product: ProductView, wished = false): HTMLElement {
		fixture = TestBed.createComponent(ProductModalComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('product', product);
		fixture.componentRef.setInput('wished', wished);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [ProductModalComponent],
			providers: [provideTranslateService()]
		});
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('renders the product with an in stock badge and the price', () => {
		const element = create(productView(5));
		expect((element.querySelector('[data-test="modal-stock"]') as HTMLElement).textContent).toContain('5');
		expect(element.textContent).toContain('Rose');
		expect(element.textContent).toContain('₫90,000');
		expect((element.querySelector('img') as HTMLImageElement).src).toBe('https://img/rose');
	});

	it('renders an out of stock badge and a disabled add for a dry product', () => {
		const element = create(productView(0));
		const badge = element.querySelector('[data-test="modal-stock"]') as HTMLElement;
		expect(badge.textContent).toContain('SHOP.OUT_OF_STOCK');
		expect(badge.classList).toContain('text-bg-danger');
		expect((element.querySelector('[data-test="modal-add"]') as HTMLButtonElement).disabled).toBe(true);
	});

	it('bounds the quantity between 1 and the available stock', () => {
		const element = create(productView(3));
		expect(component.qty()).toBe(1);
		expect((element.querySelector('[data-test="modal-qty-minus"]') as HTMLButtonElement).disabled).toBe(true);
		(element.querySelector('[data-test="modal-qty-plus"]') as HTMLElement).click();
		fixture.detectChanges();
		(element.querySelector('[data-test="modal-qty-plus"]') as HTMLElement).click();
		fixture.detectChanges();
		expect(component.qty()).toBe(3);
		expect((element.querySelector('[data-test="modal-qty-plus"]') as HTMLButtonElement).disabled).toBe(true);
		(element.querySelector('[data-test="modal-qty-plus"]') as HTMLElement).click();
		expect(component.qty()).toBe(3);
		(element.querySelector('[data-test="modal-qty-minus"]') as HTMLElement).click();
		fixture.detectChanges();
		expect(component.qty()).toBe(2);
		expect((element.querySelector('[data-test="modal-qty-minus"]') as HTMLButtonElement).disabled).toBe(false);
		(element.querySelector('[data-test="modal-qty-minus"]') as HTMLElement).click();
		(element.querySelector('[data-test="modal-qty-minus"]') as HTMLElement).click();
		expect(component.qty()).toBe(1);
	});

	it('resets the quantity when the product changes', () => {
		create(productView(5));
		component.incQty();
		expect(component.qty()).toBe(2);
		fixture.componentRef.setInput('product', productView(4));
		fixture.detectChanges();
		expect(component.qty()).toBe(1);
	});

	it('emits the chosen quantity on add and hides nothing itself', () => {
		const element = create(productView(5));
		const spy = vi.fn();
		component.addToCart.subscribe(spy);
		(element.querySelector('[data-test="modal-qty-plus"]') as HTMLElement).click();
		(element.querySelector('[data-test="modal-add"]') as HTMLElement).click();
		expect(spy).toHaveBeenCalledWith(2);
	});

	it('never emits add for an out of stock product', () => {
		const element = create(productView(0));
		const spy = vi.fn();
		component.addToCart.subscribe(spy);
		component.onAddToCart();
		(element.querySelector('[data-test="modal-add"]') as HTMLElement).click();
		expect(spy).not.toHaveBeenCalled();
	});

	it('emits the product on the wishlist heart click', () => {
		const element = create(productView(5));
		const spy = vi.fn();
		component.toggleWishlist.subscribe(spy);
		(element.querySelector('[data-test="modal-heart"]') as HTMLElement).click();
		expect(spy).toHaveBeenCalledWith(productView(5));
	});

	it('colors the heart from the wished input', () => {
		const element = create(productView(5), true);
		const heart = element.querySelector('[data-test="modal-heart"]') as HTMLElement;
		expect(heart.classList).toContain('text-danger');
		fixture.componentRef.setInput('wished', false);
		fixture.detectChanges();
		expect(heart.classList).toContain('text-secondary');
	});

	it('formats the price in the active locale', () => {
		const element = create(productView(5));
		TestBed.inject(TranslateService).use('vi');
		fixture.detectChanges();
		expect(element.textContent).toContain('90.000');
		expect(element.textContent).toContain('₫');
	});
});
