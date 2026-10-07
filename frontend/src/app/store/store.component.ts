import {Component, OnInit, TemplateRef, computed, effect, inject, signal, viewChild} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faCartPlus, faHeart, faMagnifyingGlass} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {CartService} from '../core/cart.service';
import {SessionService} from '../core/session.service';
import {ToastService} from '../core/toast.service';
import {CatalogService} from '../services/catalog.service';
import {TaxonomyService} from '../services/taxonomy.service';
import {WishlistService} from '../services/wishlist.service';
import {Category, Page, ProductSort, ProductView, Type} from '../models';
import {ProductModalComponent} from './product-modal.component';

@Component({
	selector: 'app-store',
	imports: [
		FormsModule,
		CurrencyPipe,
		TranslatePipe,
		FaIconComponent,
		TooltipDirective,
		PaginationComponent,
		ProductModalComponent
	],
	templateUrl: './store.component.html',
	styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit {
	readonly faMagnifyingGlass = faMagnifyingGlass;
	readonly faCartPlus = faCartPlus;
	readonly faHeart = faHeart;
	readonly sortOptions: ProductSort[] = ['name-asc', 'name-desc', 'price-asc', 'price-desc'];
	readonly sizeOptions = [6, 12, 24, 48];
	readonly maxSize = 3;

	readonly page = signal(0);
	readonly size = signal(12);
	readonly sort = signal<ProductSort>('name-asc');
	readonly searchText = signal('');
	readonly category = signal('');
	readonly type = signal('');
	readonly content = signal<ProductView[]>([]);
	readonly totalElements = signal(0);
	readonly totalPages = signal(0);
	readonly categories = signal<Category[]>([]);
	readonly wishlistIds = signal<ReadonlySet<number>>(new Set());

	readonly selected = signal<ProductView | null>(null);

	// the control owns its own 1 based page state; resetting it through the
	// value accessor avoids the NgModel echo that raced our page signal
	readonly pagination = viewChild(PaginationComponent);

	private readonly typesAll = signal<Type[]>([]);
	private modalRef?: BsModalRef;

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	readonly typesForCategory = computed(() => {
		const current = this.category();
		return current === '' ? this.typesAll() : this.typesAll().filter(t => t.categoryName === current);
	});
	readonly hasPrev = computed(() => this.page() > 0);
	readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
	readonly rangeLabel = computed(() => {
		if (this.content().length === 0) {
			return '';
		}
		const from = this.page() * this.size() + 1;
		const to = from + this.content().length - 1;
		return `${from}-${to} / ${this.totalElements()}`;
	});

	private readonly catalog = inject(CatalogService);
	private readonly taxonomy = inject(TaxonomyService);
	private readonly wishlist = inject(WishlistService);
	private readonly modalService = inject(BsModalService);
	private readonly cart = inject(CartService);
	readonly session = inject(SessionService);
	private readonly toast = inject(ToastService);
	readonly translate = inject(TranslateService);

	constructor() {
		// wishlist is member only: guests never fire the request, and the
		// heart state follows the session in and out
		effect(() => {
			if (this.session.isLoggedIn()) {
				this.wishlist.mine().subscribe({
					next: entries => this.wishlistIds.set(new Set(entries.map(entry => entry.product.id))),
					error: () => this.wishlistIds.set(new Set())
				});
			} else {
				this.wishlistIds.set(new Set());
			}
		});
	}

	ngOnInit() {
		this.load();
		this.taxonomy.categories().subscribe({
			next: data => this.categories.set(data ?? []),
			error: () => this.categories.set([])
		});
		this.taxonomy.types().subscribe({
			next: data => this.typesAll.set(data ?? []),
			error: () => this.typesAll.set([])
		});
	}

	load(): void {
		this.catalog.page({
			search: this.searchText(),
			category: this.category(),
			type: this.type(),
			sort: this.sort(),
			page: this.page(),
			size: this.size()
		}).subscribe({
			next: (data: Page<ProductView>) => this.applyPage(data),
			error: () => this.applyPage({content: [], totalElements: 0, totalPages: 0, page: this.page(), size: this.size()})
		});
	}

	onSearch(): void {
		this.applyFilter(() => this.page.set(0));
	}

	onCategoryChange(category: string): void {
		this.applyFilter(() => {
			this.category.set(category);
			this.type.set('');
		});
	}

	onTypeChange(type: string): void {
		this.applyFilter(() => this.type.set(type));
	}

	onSortChange(sort: string): void {
		this.applyFilter(() => this.sort.set(sort as ProductSort));
	}

	onSizeChange(size: string): void {
		this.applyFilter(() => this.size.set(Number(size)));
	}

	onPageChanged(event: PageChangedEvent): void {
		// the pagination control re-emits pageChanged when totalItems settles,
		// so only a real page move pays for a request
		const target = event.page - 1;
		if (target === this.page()) {
			return;
		}
		this.page.set(target);
		this.load();
	}

	openModal(product: ProductView, template: TemplateRef<void>): void {
		this.selected.set(product);
		this.modalRef = this.modalService.show(template);
	}

	onModalAddToCart(quantity: number): void {
		const product = this.selected();
		if (product === null) {
			return;
		}
		this.cart.add(product);
		this.cart.changeQuantity(product.id, quantity);
		this.modalRef?.hide();
	}

	addToCart(product: ProductView): void {
		this.cart.add(product);
	}

	toggleWishlist(product: ProductView): void {
		if (!this.session.isLoggedIn()) {
			this.session.requestLogin();
			return;
		}
		this.wishlist.toggle(product.id).subscribe({
			next: result => {
				const next = new Set(this.wishlistIds());
				if (result.added) {
					next.add(product.id);
				} else {
					next.delete(product.id);
				}
				this.wishlistIds.set(next);
				this.toast.show(this.translate.instant(result.added ? 'SHOP.WISHLIST_ADDED' : 'SHOP.WISHLIST_REMOVED'),
					result.added ? 'success' : 'info');
			}
		});
	}

	private applyFilter(change: () => void): void {
		change();
		this.page.set(0);
		this.pagination()?.writeValue(1);
		this.load();
	}

	private applyPage(data: Page<ProductView>): void {
		this.content.set(data.content ?? []);
		this.totalElements.set(data.totalElements);
		this.totalPages.set(data.totalPages);
	}
}
