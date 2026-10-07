import {Injectable, computed, effect, signal} from '@angular/core';

// Structural subset shared by the v2 product and the v3 productView, so the
// cart keeps working across the contract migration without its own model.
export interface CartItem {
	id: number;
	name: string;
	imgUrl: string;
	price: number;
	categoryName: string;
	typeName: string;
}

export interface CartLine {
	product: CartItem;
	quantity: number;
}

const STORAGE_KEY = 'cart';

function isCartItem(value: unknown): value is CartItem {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return typeof candidate['id'] === 'number'
		&& typeof candidate['name'] === 'string'
		&& typeof candidate['imgUrl'] === 'string'
		&& typeof candidate['price'] === 'number'
		&& typeof candidate['categoryName'] === 'string'
		&& typeof candidate['typeName'] === 'string';
}

function isCartLine(value: unknown): value is CartLine {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return isCartItem(candidate['product']) && typeof candidate['quantity'] === 'number' && candidate['quantity'] >= 1;
}

function restore(): CartLine[] {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === null) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(isCartLine);
	} catch {
		return [];
	}
}

@Injectable({providedIn: 'root'})
export class CartService {
	private readonly linesSignal = signal<CartLine[]>(restore());

	readonly lines = this.linesSignal.asReadonly();
	readonly isEmpty = computed(() => this.lines().length === 0);
	readonly count = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
	readonly subtotal = computed(() => this.lines().reduce((sum, line) => sum + line.product.price * line.quantity, 0));

	constructor() {
		effect(() => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines()));
		});
	}

	add(product: CartItem): void {
		this.linesSignal.update(lines => {
			const index = lines.findIndex(line => line.product.id === product.id);
			if (index === -1) {
				return [...lines, {product, quantity: 1}];
			}
			return lines.map((line, i) => i === index ? {product, quantity: line.quantity + 1} : line);
		});
	}

	remove(productId: number): void {
		this.linesSignal.update(lines => lines.filter(line => line.product.id !== productId));
	}

	// a non positive quantity drops the line, mirroring the minus button in the cart table
	changeQuantity(productId: number, quantity: number): void {
		if (quantity < 1) {
			this.remove(productId);
			return;
		}
		this.linesSignal.update(lines =>
			lines.map(line => line.product.id === productId ? {...line, quantity} : line));
	}

	clear(): void {
		this.linesSignal.set([]);
	}
}
