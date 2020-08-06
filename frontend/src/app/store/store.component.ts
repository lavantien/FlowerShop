import {Component, OnDestroy, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {DataTranslateService} from '../_services/data-translate.service';
import {SharedService} from '../_services/shared.service';
import {Lightbox} from 'ngx-lightbox';
import {TranslateService} from '@ngx-translate/core';
import {Subscription} from 'rxjs';
import {faCartPlus, faDna, faSearch, faSortAmountDownAlt, faSortAmountUp} from '@fortawesome/free-solid-svg-icons';
import {SessionService} from '../_services/session.service';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';
import {Router} from "@angular/router";

@Component({
	selector: 'app-store',
	templateUrl: './store.component.html',
	styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit, OnDestroy {
	faSearch = faSearch;
	faCartPlus = faCartPlus;
	faDna = faDna;
	faSortAmountUp = faSortAmountUp;
	faSortAmountDownAlt = faSortAmountDownAlt;
	modalRef: BsModalRef;
	products: Product[] = [];
	categories: Category[] = [];
	types: Type[] = [];
	bgPrimary = '';
	tcPrimary = '';
	pagination = {
		totalItem: 0,
		itemPerPage: 24,
		currentPage: 1,
		maxSize: 3
	};
	displayProducts: Product[] = [];
	searchForm = {
		name: '',
		categoryName: '',
		typeName: ''
	};
	searchResults: Product[] = [];
	sortFlip = false;
	firstTimeSort = true;
	private subscriptions = new Subscription();
	isAdmin = false;
	isLoggedIn = false;

	constructor(private http: HttpClient,
	            private modalService: BsModalService,
	            private router: Router,
	            private dataTranslateService: DataTranslateService,
	            private sharedService: SharedService,
	            private sessionService: SessionService,
	            private lightbox: Lightbox,
	            public translate: TranslateService) {
	}

	ngOnInit() {
		this.isLoggedIn = localStorage.getItem('token') !== null && atob(localStorage.getItem('token')) !== '0+GUESS';
		this.isAdmin = localStorage.getItem('token') !== null && atob(localStorage.getItem('token')).substring(atob(localStorage.getItem('token')).indexOf('+') + 1) === 'ADMIN';
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
			this.bgPrimary = bg[0];
			this.tcPrimary = bg[1];
		}));
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(data => {
			if (!!data) {
				this.products = data;
				this.products.forEach(product => {
					product.imgUrl = product.imgUrl ? atob(product.imgUrl) : '';
					product.price = this.dataTranslateService.getPrice(product.price, 'vi');
					// TODO: Translate product name
					// TODO: Translate product production
				});
				this.searchResults = data;
				this.paging(this.searchResults);
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.products = [];
		}, () => {
		});
	}

	getCategories() {
		this.http.get<Category[]>('/api/category').subscribe(data => {
			if (!!data) {
				this.categories = data;
				this.searchForm.categoryName = this.categories[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.categories = [];
			this.searchForm.categoryName = '';
		}, () => {
		});
	}

	getTypes() {
		this.http.get<Type[]>('/api/type').subscribe(data => {
			if (!!data) {
				this.types = data;
				this.searchForm.typeName = this.types[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.types = [];
			this.searchForm.typeName = '';
		}, () => {
		});
	}

	paging(data: Product[]) {
		this.pagination.totalItem = data.length;
		this.displayProducts = data.slice((this.pagination.currentPage - 1) * this.pagination.itemPerPage,
			this.pagination.currentPage * this.pagination.itemPerPage);
	}

	onPageChanged(event: any) { // 1: 0 1 2 3   2: 4 5 6 7   3: 8 9 10 11
		this.displayProducts = this.searchResults.slice((event.page - 1) * event.itemsPerPage, event.page * event.itemsPerPage);
	}

	onSearch() {
		const searchResults: Product[] = [];
		this.products.forEach(product => {
			if (this.searchForm.name === '' && this.searchForm.typeName === product.typeName && this.searchForm.categoryName === product.categoryName) {
				searchResults.push(product);
			} else if (this.searchForm.name !== '' && product.name.toLowerCase().includes(this.searchForm.name.toLowerCase())) {
				searchResults.push(product);
			}
		});
		this.paging(searchResults);
		this.searchResults = searchResults;
	}

	onChangeCategory(mode: string) {
		if (mode === 'search') {
			this.searchForm.name = '';
			this.searchForm.typeName = this.types[this.types.findIndex(x => x.categoryName === this.searchForm.categoryName)].name;
			this.firstTimeSort = false;
		}
	}

	onChangeTypeSearch() {
		this.searchForm.name = '';
		this.firstTimeSort = false;
	}

	onOpenImage(index: number) {
		const album: {
			src: string;
			caption: string;
			thumb: string;
		}[] = [];
		const src = this.displayProducts[index].imgUrl;
		const thumb = this.displayProducts[index].imgUrl;
		let caption = '<b>' + this.displayProducts[index].name;
		let category = '';
		let type = '';
		let description: string;
		this.translate.get('DATA.' + this.displayProducts[index].categoryName).subscribe(rs => {
			category = rs;
		});
		this.translate.get('DATA.' + this.displayProducts[index].typeName).subscribe(rs => {
			type = rs;
		});
		description = this.displayProducts[index].description;
		caption += '</b> - (' + category + ' - ' + type + ').<br><i>' + description + '</i>';
		album.push({
			src,
			caption,
			thumb
		});
		this.lightbox.open(album, 0);
	}

	onSortPrice() {
		if (this.sortFlip) {
			this.products.sort((a, b) => a.price - b.price);
		} else {
			this.products.sort((a, b) => b.price - a.price);
		}
		const prevName = this.searchForm.name;
		this.searchForm.name = this.firstTimeSort && this.searchForm.name === '' ? ' ' : this.searchForm.name;
		this.onSearch();
		this.searchForm.name = prevName;
		this.sortFlip = !this.sortFlip;
	}

	onAddToCart(index: number) {
		this.sessionService.updateNewlyAddedProduct(this.displayProducts[index]);
	}

	trackByFn(index, item) {
		return index;
	}
}
