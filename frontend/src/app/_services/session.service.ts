import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {Product} from '../_models/product';

@Injectable({
	providedIn: 'root'
})
export class SessionService {
	private newlyAddedProduct = new BehaviorSubject<Product | null>(null);

	public getNewlyAddedProduct() {
		return this.newlyAddedProduct.asObservable();
	}

	public updateNewlyAddedProduct(product: Product) {
		this.newlyAddedProduct.next(product);
	}
}
