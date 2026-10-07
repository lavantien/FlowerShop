import {firstValueFrom} from 'rxjs';
import {describe, expect, it} from 'vitest';
import {SessionService} from './session.service';
import {Product} from '../_models/product';

describe('SessionService', () => {
	const service = new SessionService();

	it('starts with no newly added product', async () => {
		expect(await firstValueFrom(service.getNewlyAddedProduct())).toBeNull();
	});

	it('emits each product pushed through updateNewlyAddedProduct', () => {
		const product: Product = {
			id: 1,
			name: 'Rose',
			description: 'red flower',
			price: 20,
			imgUrl: '',
			quantity: 5,
			saleAmount: 0,
			categoryName: 'Fresh',
			typeName: 'Daily'
		};
		const emissions: (Product | null)[] = [];
		service.getNewlyAddedProduct().subscribe(p => emissions.push(p));
		service.updateNewlyAddedProduct(product);
		expect(emissions).toEqual([null, product]);
	});
});
