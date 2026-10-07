import {Component, OnInit, TemplateRef, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {
	faArrowDownShortWide,
	faArrowUpShortWide,
	faCartPlus,
	faMagnifyingGlass
} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {CartService} from '../core/cart.service';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';

@Component({
	selector: 'app-store',
	imports: [
		FormsModule,
		TranslatePipe,
		FaIconComponent,
		TooltipDirective,
		PaginationComponent
	],
	templateUrl: './store.component.html',
	styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit {
	faMagnifyingGlass = faMagnifyingGlass;
	faCartPlus = faCartPlus;
	faArrowUpShortWide = faArrowUpShortWide;
	faArrowDownShortWide = faArrowDownShortWide;
	modalRef!: BsModalRef;
	products = signal<Product[]>([]);
	categories = signal<Category[]>([]);
	types = signal<Type[]>([]);
	totalItem = signal(0);
	itemPerPage = signal(24);
	currentPage = signal(1);
	readonly maxSize = 3;
	displayProducts = signal<Product[]>([]);
	searchForm = {
		name: '',
		categoryName: '',
		typeName: ''
	};
	searchResults = signal<Product[]>([]);
	lightboxSrc = signal('');
	lightboxCaption = signal('');
	sortFlip = false;
	firstTimeSort = true;

	private readonly http = inject(HttpClient);
	private readonly modalService = inject(BsModalService);
	private readonly cart = inject(CartService);
	readonly translate = inject(TranslateService);

	ngOnInit() {
		this.getProducts();
		this.getCategories();
		this.getTypes();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(data => {
			if (data) {
				this.products.set(data);
				this.searchResults.set(data);
				this.paging(this.searchResults());
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.products.set([]);
		});
	}

	getCategories() {
		this.http.get<Category[]>('/api/category').subscribe(data => {
			if (data) {
				this.categories.set(data);
				this.searchForm.categoryName = this.categories()[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.categories.set([]);
			this.searchForm.categoryName = '';
		});
	}

	getTypes() {
		this.http.get<Type[]>('/api/type').subscribe(data => {
			if (data) {
				this.types.set(data);
				this.searchForm.typeName = this.types()[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.types.set([]);
			this.searchForm.typeName = '';
		});
	}

	paging(data: Product[]) {
		this.totalItem.set(data.length);
		this.displayProducts.set(data.slice((this.currentPage() - 1) * this.itemPerPage(),
			this.currentPage() * this.itemPerPage()));
	}

	onPageChanged(event: PageChangedEvent) { // 1: 0 1 2 3   2: 4 5 6 7   3: 8 9 10 11
		this.displayProducts.set(this.searchResults().slice((event.page - 1) * event.itemsPerPage, event.page * event.itemsPerPage));
	}

	onSearch() {
		const searchResults: Product[] = [];
		this.products().forEach(product => {
			if (this.searchForm.name === '' && this.searchForm.typeName === product.typeName && this.searchForm.categoryName === product.categoryName) {
				searchResults.push(product);
			} else if (this.searchForm.name !== '' && product.name.toLowerCase().includes(this.searchForm.name.toLowerCase())) {
				searchResults.push(product);
			}
		});
		this.paging(searchResults);
		this.searchResults.set(searchResults);
	}

	onChangeCategory() {
		this.searchForm.name = '';
		const matching = this.types().find(type => type.categoryName === this.searchForm.categoryName);
		if (matching !== undefined) {
			this.searchForm.typeName = matching.name;
		}
		this.firstTimeSort = false;
	}

	onChangeTypeSearch() {
		this.searchForm.name = '';
		this.firstTimeSort = false;
	}

	onOpenImage(index: number, template: TemplateRef<void>) {
		const src = this.displayProducts()[index].imgUrl;
		let caption = '<b>' + this.displayProducts()[index].name;
		let category = '';
		let type = '';
		this.translate.get('DATA.' + this.displayProducts()[index].categoryName).subscribe(rs => {
			category = String(rs);
		});
		this.translate.get('DATA.' + this.displayProducts()[index].typeName).subscribe(rs => {
			type = String(rs);
		});
		const description: string = this.displayProducts()[index].description;
		caption += '</b> - (' + category + ' - ' + type + ').<br><i>' + description + '</i>';
		this.lightboxSrc.set(src);
		this.lightboxCaption.set(caption);
		this.modalRef = this.modalService.show(template);
	}

	onSortPrice() {
		if (this.sortFlip) {
			this.products.update(products => [...products].sort((a, b) => a.price - b.price));
		} else {
			this.products.update(products => [...products].sort((a, b) => b.price - a.price));
		}
		const prevName = this.searchForm.name;
		this.searchForm.name = this.firstTimeSort && this.searchForm.name === '' ? ' ' : this.searchForm.name;
		this.onSearch();
		this.searchForm.name = prevName;
		this.sortFlip = !this.sortFlip;
	}

	onAddToCart(index: number) {
		this.cart.add(this.displayProducts()[index]);
	}
}
