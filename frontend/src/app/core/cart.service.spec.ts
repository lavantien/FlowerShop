import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {CartItem, CartService} from './cart.service';

function item(id: number, price: number): CartItem {
	return {id, name: `Flower ${id}`, imgUrl: '', price, categoryName: 'Fresh', typeName: 'Daily'};
}

describe('CartService', () => {
	let cart: CartService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({});
		cart = TestBed.inject(CartService);
	});

	afterEach(() => {
		localStorage.clear();
		TestBed.resetTestingModule();
	});

	it('starts empty with zero totals', () => {
		expect(cart.isEmpty()).toBe(true);
		expect(cart.count()).toBe(0);
		expect(cart.subtotal()).toBe(0);
		expect(cart.lines()).toEqual([]);
	});

	it('adds a new product as one line', () => {
		cart.add(item(1, 250000));
		expect(cart.lines()).toEqual([{product: item(1, 250000), quantity: 1}]);
		expect(cart.count()).toBe(1);
		expect(cart.subtotal()).toBe(250000);
	});

	it('merges repeated adds of the same product into one line', () => {
		cart.add(item(1, 250000));
		cart.add(item(2, 120000));
		cart.add(item(1, 250000));
		cart.add(item(1, 250000));
		expect(cart.lines()).toHaveLength(2);
		expect(cart.lines()[0]).toEqual({product: item(1, 250000), quantity: 3});
		expect(cart.count()).toBe(4);
		expect(cart.subtotal()).toBe(3 * 250000 + 120000);
	});

	it('removes the line for a product id', () => {
		cart.add(item(1, 250000));
		cart.add(item(2, 120000));
		cart.remove(1);
		expect(cart.lines().map(line => line.product.id)).toEqual([2]);
		expect(cart.count()).toBe(1);
	});

	it('changes a quantity in place', () => {
		cart.add(item(1, 250000));
		cart.changeQuantity(1, 5);
		expect(cart.lines()[0].quantity).toBe(5);
		expect(cart.subtotal()).toBe(5 * 250000);
	});

	it('drops the line when the quantity drops below one', () => {
		cart.add(item(1, 250000));
		cart.changeQuantity(1, 0);
		expect(cart.isEmpty()).toBe(true);
	});

	it('clears every line', () => {
		cart.add(item(1, 250000));
		cart.add(item(2, 120000));
		cart.clear();
		expect(cart.isEmpty()).toBe(true);
		expect(cart.count()).toBe(0);
	});

	it('persists lines to localStorage and restores them on boot', () => {
		cart.add(item(1, 250000));
		cart.changeQuantity(1, 2);
		TestBed.tick();
		const raw = localStorage.getItem('cart');
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw ?? '[]')).toEqual([{product: item(1, 250000), quantity: 2}]);

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({});
		const reloaded = TestBed.inject(CartService);
		expect(reloaded.lines()).toEqual([{product: item(1, 250000), quantity: 2}]);
		expect(reloaded.count()).toBe(2);
	});

	it('ignores tampered storage and starts empty', () => {
		localStorage.setItem('cart', '[{"product": {"id": "x"}, "quantity": -1}]');
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({});
		expect(TestBed.inject(CartService).isEmpty()).toBe(true);
	});

	it('ignores broken json storage and starts empty', () => {
		localStorage.setItem('cart', '{oops');
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({});
		expect(TestBed.inject(CartService).isEmpty()).toBe(true);
	});
});
