import {Component, computed, effect, inject, input, output, signal} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faCartPlus, faHeart, faMinus, faPlus} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {ProductView} from '../models';

const MAX_QUANTITY = 99;

@Component({
	selector: 'app-product-modal',
	imports: [CurrencyPipe, TranslatePipe, FaIconComponent, TooltipDirective],
	templateUrl: './product-modal.component.html',
	styleUrls: ['./product-modal.component.scss']
})
export class ProductModalComponent {
	readonly faCartPlus = faCartPlus;
	readonly faHeart = faHeart;
	readonly faMinus = faMinus;
	readonly faPlus = faPlus;

	readonly product = input.required<ProductView>();
	readonly wished = input(false);
	readonly addToCart = output<number>();
	readonly toggleWishlist = output<ProductView>();

	readonly qty = signal(1);

	private readonly translate = inject(TranslateService);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	readonly maxQty = computed(() => Math.min(this.product().stock, MAX_QUANTITY));

	constructor() {
		// a different product in the same modal restarts from one unit
		effect(() => {
			this.product();
			this.qty.set(1);
		});
	}

	incQty(): void {
		if (this.qty() < this.maxQty()) {
			this.qty.update(value => value + 1);
		}
	}

	decQty(): void {
		if (this.qty() > 1) {
			this.qty.update(value => value - 1);
		}
	}

	onAddToCart(): void {
		if (this.product().stock < 1) {
			return;
		}
		this.addToCart.emit(this.qty());
	}

	onToggleWishlist(): void {
		this.toggleWishlist.emit(this.product());
	}
}
