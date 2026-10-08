import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {SeededGenerator} from '../../testing/seeded-generator';
import {CartItem, CartLine, CartService} from './cart.service';

const validItem: CartItem = {
	id: 7,
	name: 'Hoa hồng đỏ',
	imgUrl: 'https://img/rose',
	price: 250000,
	categoryName: 'Fresh',
	typeName: 'Daily'
};

function validLine(id: number, quantity: number): CartLine {
	return {product: {...validItem, id}, quantity};
}

function validJson(...lines: CartLine[]): string {
	return JSON.stringify(lines);
}

function lineJson(line: CartLine): string {
	return JSON.stringify(line);
}

function corruptCartJson(gen: SeededGenerator): string[] {
	return [
		'', '{', '][', 'null', 'true', '0', '"cart"', '{}',
		'null,sd', '{"lines":' + validJson(validLine(1, 1)) + '}',
		'[null,null]', '[1,2,3]', '[[]]', '[{"product":null,"quantity":1}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":1e999}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":-1e999}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":0}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":-4}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":"2"}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":null}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":true}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":{}}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":1}]',
		'[{"product":' + JSON.stringify(validItem) + ',"quantity":1e308}]',
		'[{"product":{"id":1e999,"name":"x","imgUrl":"","price":1,"categoryName":"c","typeName":"t"},"quantity":1}]',
		'[{"product":{"id":7,"name":"x","imgUrl":"","price":1e999,"categoryName":"c","typeName":"t"},"quantity":1}]',
		'[{"product":' + JSON.stringify({...validItem, price: -250000}) + ',"quantity":1}]',
		'[{"product":' + JSON.stringify({...validItem, name: ''}) + ',"quantity":1}]',
		'[{"product":' + JSON.stringify({...validItem, imgUrl: gen.string(200)}) + ',"quantity":2}]',
		'[{"product":{"id":"7","name":"x","imgUrl":"","price":1,"categoryName":"c","typeName":"t"},"quantity":1}]',
		'[{"product":{"id":7,"name":7,"imgUrl":"","price":1,"categoryName":"c","typeName":"t"},"quantity":1}]',
		'[{"product":{"id":7,"name":"x","imgUrl":"","price":"1","categoryName":"c","typeName":"t"},"quantity":1}]',
		'[{"product":{"id":7,"name":"x","imgUrl":true,"price":1,"categoryName":"c","typeName":"t"},"quantity":1}]',
		'[{"product":{"id":7,"name":"x","imgUrl":"","price":1,"categoryName":[],"typeName":"t"},"quantity":1}]',
		'[{"product":{"id":7,"name":"x","imgUrl":"","price":1,"categoryName":"c","typeName":null},"quantity":1}]',
		'[{"product":{"id":7},"quantity":1}]',
		'[{"quantity":1}]',
		'[{"product":' + JSON.stringify(validItem) + '}]',
		'[' + '{"a":'.repeat(3000) + '1' + '}'.repeat(3000) + ']',
		validJson(validLine(1, 1)) + ',,'
	];
}

describe('CartService fuzz', () => {
	let gen: SeededGenerator;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({});
		gen = new SeededGenerator();
	});

	afterEach(() => {
		localStorage.clear();
		TestBed.resetTestingModule();
	});

	function boot(): CartService {
		return TestBed.runInInjectionContext(() => new CartService());
	}

	it('never throws on corrupt cart storage and keeps only predicate valid lines', () => {
		for (const payload of corruptCartJson(gen)) {
			localStorage.clear();
			localStorage.setItem('cart', payload);
			const bootCart = (): CartService => boot();
			expect(bootCart).not.toThrow();
			const cart = bootCart();
			for (const line of cart.lines()) {
				expect(Number.isFinite(line.product.id), payload.slice(0, 60)).toBe(true);
				expect(Number.isFinite(line.product.price)).toBe(true);
				expect(Number.isFinite(line.quantity)).toBe(true);
				expect(line.quantity).toBeGreaterThanOrEqual(1);
				expect(typeof line.product.name).toBe('string');
			}
			expect(cart.count()).toBe(cart.lines().reduce((sum, line) => sum + line.quantity, 0));
			expect(cart.subtotal()).toBe(cart.lines().reduce((sum, line) => sum + line.product.price * line.quantity, 0));
		}
	});

	it('keeps the valid lines of a mixed payload and drops only the junk', () => {
		const junkShapes = [
			'null',
			JSON.stringify({product: {id: 'x'}, quantity: -3}),
			JSON.stringify({product: null, quantity: 1}),
			JSON.stringify({product: {id: 3, name: 'x', imgUrl: '', price: 1, categoryName: 'c', typeName: 't'}, quantity: 0})
		];
		for (const junk of junkShapes) {
			localStorage.clear();
			localStorage.setItem('cart', `[${lineJson(validLine(2, 3))},${junk},${lineJson(validLine(5, 1))}]`);
			const cart = boot();
			expect(cart.lines(), junk).toEqual([validLine(2, 3), validLine(5, 1)]);
			expect(cart.count()).toBe(4);
			expect(cart.subtotal()).toBe(4 * validItem.price);
		}
	});

	it('re-persists only the kept lines, self healing the storage', () => {
		localStorage.setItem('cart', `[${lineJson(validLine(2, 2))},null,{"product":{"id":1e999},"quantity":1}]`);
		const cart = boot();
		TestBed.tick();
		expect(JSON.parse(localStorage.getItem('cart') ?? 'invalid')).toEqual([validLine(2, 2)]);
		expect(cart.lines()).toEqual([validLine(2, 2)]);
	});

	it('keeps every line a filled cart saved through the service across a full reload', () => {
		const cart = boot();
		cart.add(validItem);
		cart.add({...validItem, id: 9});
		cart.changeQuantity(validItem.id, 3);
		TestBed.tick();
		const saved = JSON.parse(localStorage.getItem('cart') ?? 'invalid');
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({});
		const reloaded = boot();
		expect(saved).toEqual([validLine(validItem.id, 3), validLine(9, 1)]);
		expect(reloaded.lines()).toEqual([validLine(validItem.id, 3), validLine(9, 1)]);
		expect(reloaded.count()).toBe(4);
		expect(reloaded.subtotal()).toBe(4 * validItem.price);
	});

	it('drops the line for non finite or non positive generated quantities', () => {
		const quantities = [NaN, Infinity, -Infinity, 0, -1, -1e308, gen.intBetween(-999, 0)];
		for (const quantity of quantities) {
			localStorage.clear();
			const cart = boot();
			cart.add(validItem);
			cart.changeQuantity(validItem.id, quantity);
			expect(cart.isEmpty(), `quantity=${String(quantity)}`).toBe(true);
		}
	});

	it('accepts finite generated quantities at and above the boundary of one', () => {
		const quantities = [1, 2, 1.5, 1e15, gen.intBetween(1, 99)];
		for (const quantity of quantities) {
			localStorage.clear();
			const cart = boot();
			cart.add(validItem);
			cart.changeQuantity(validItem.id, quantity);
			expect(cart.lines()).toEqual([{product: validItem, quantity}]);
			expect(cart.count()).toBe(quantity);
		}
	});

	it('leaves the cart untouched for a change on an absent product', () => {
		const cart = boot();
		cart.add(validItem);
		cart.changeQuantity(validItem.id + 1000, 3);
		expect(cart.lines()).toEqual([{product: validItem, quantity: 1}]);
	});

	it('merges generated products exactly, keeping count and subtotal integers', () => {
		const cart = boot();
		const generated: CartItem[] = [];
		for (let i = 0; i < 40; i++) {
			generated.push({
				id: gen.intBetween(1, 8),
				name: gen.string(12),
				imgUrl: '',
				price: gen.intBetween(1, 500) * 1000,
				categoryName: 'Fresh',
				typeName: 'Daily'
			});
		}
		for (const product of generated) {
			cart.add(product);
		}
		const byId = new Map<number, {product: CartItem; quantity: number}>();
		for (const product of generated) {
			const existing = byId.get(product.id);
			if (existing === undefined) {
				byId.set(product.id, {product, quantity: 1});
			} else {
				existing.quantity += 1;
				existing.product = product;
			}
		}
		expect(cart.lines()).toEqual([...byId.values()]);
		expect(cart.count()).toBe(generated.length);
		expect(cart.subtotal()).toBe(cart.lines().reduce((sum, line) => sum + line.product.price * line.quantity, 0));
		expect(Number.isInteger(cart.count())).toBe(true);
	});
});
