import {Component, OnDestroy, OnInit, TemplateRef, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {
	faArrowDownShortWide,
	faArrowUpShortWide,
	faCartPlus,
	faDna,
	faMagnifyingGlass
} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {Subscription} from 'rxjs';
import {DataTranslateService} from '../_services/data-translate.service';
import {SharedService} from '../_services/shared.service';
import {SessionService} from '../_services/session.service';
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
export class StoreComponent implements OnInit, OnDestroy {
	faMagnifyingGlass = faMagnifyingGlass;
	faCartPlus = faCartPlus;
	faDna = faDna;
	faArrowUpShortWide = faArrowUpShortWide;
	faArrowDownShortWide = faArrowDownShortWide;
	modalRef!: BsModalRef;
	products = signal<Product[]>([]);
	categories = signal<Category[]>([]);
	types = signal<Type[]>([]);
	bgPrimary = signal('');
	tcPrimary = signal('');
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
	isAdmin = false;
	isLoggedIn = false;

	private readonly http = inject(HttpClient);
	private readonly router = inject(Router);
	private readonly modalService = inject(BsModalService);
	private readonly dataTranslateService = inject(DataTranslateService);
	private readonly sharedService = inject(SharedService);
	private readonly sessionService = inject(SessionService);
	readonly translate = inject(TranslateService);
	private readonly subscriptions = new Subscription();

	ngOnInit() {
		const token = localStorage.getItem('token');
		this.isLoggedIn = token !== null && atob(token) !== '0+GUESS';
		this.isAdmin = token !== null && atob(token).substring(atob(token).indexOf('+') + 1) === 'ADMIN';
		if (this.isAdmin) {
			this.router.navigate(['/admin']);
		}
		if (!this.isLoggedIn) {
			this.router.navigate(['/shop']);
		}
		this.getProducts();
		this.getCategories();
		this.getTypes();
		this.subscriptions.add(this.sharedService.getGlobalBackgroundPrimary().subscribe(bg => {
			this.bgPrimary.set(bg[0]);
			this.tcPrimary.set(bg[1]);
		}));
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(data => {
			if (data) {
				this.products.set(data);
				this.products().forEach(product => {
					product.imgUrl = product.imgUrl ? atob(product.imgUrl) : '';
					product.price = this.dataTranslateService.getPrice(product.price, 'vi');
					// TODO: Translate product name
					// TODO: Translate product production
				});
				this.searchResults.set(data);
				this.paging(this.searchResults());
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.products.set([]);
		}, () => {
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
		}, () => {
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
		}, () => {
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

	onChangeCategory(mode: string) {
		if (mode === 'search') {
			this.searchForm.name = '';
			this.searchForm.typeName = this.types()[this.types().findIndex(x => x.categoryName === this.searchForm.categoryName)].name;
			this.firstTimeSort = false;
		}
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
		this.sessionService.updateNewlyAddedProduct(this.displayProducts()[index]);
	}
}
