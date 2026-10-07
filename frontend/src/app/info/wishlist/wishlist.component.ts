import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faCartPlus, faHeart} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {CartService} from '../../core/cart.service';
import {ToastService} from '../../core/toast.service';
import {WishlistService} from '../../services/wishlist.service';
import {WishlistEntry} from '../../models';

@Component({
	selector: 'app-wishlist',
	imports: [CurrencyPipe, TranslatePipe, FaIconComponent, TooltipDirective],
	templateUrl: './wishlist.component.html',
	styleUrls: ['./wishlist.component.scss']
})
export class WishlistComponent implements OnInit {
	readonly faHeart = faHeart;
	readonly faCartPlus = faCartPlus;

	readonly entries = signal<WishlistEntry[]>([]);

	private readonly wishlist = inject(WishlistService);
	private readonly cart = inject(CartService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		this.wishlist.mine().subscribe({
			next: data => this.entries.set(data ?? []),
			error: () => this.entries.set([])
		});
	}

	addToCart(productId: number): void {
		const entry = this.entries().find(candidate => candidate.product.id === productId);
		if (entry !== undefined) {
			this.cart.add(entry.product);
		}
	}

	// the heart on this page is always filled: a toggle here means remove
	onToggle(productId: number): void {
		this.wishlist.toggle(productId).subscribe({
			next: result => {
				if (result.added) {
					this.load();
					return;
				}
				this.entries.update(list => list.filter(entry => entry.product.id !== productId));
				this.toast.show(this.translate.instant('SHOP.WISHLIST_REMOVED'), 'info');
			}
		});
	}
}
