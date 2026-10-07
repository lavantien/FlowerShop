import {Component, OnDestroy, OnInit, TemplateRef, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {
	faArrowDownShortWide,
	faArrowUpShortWide,
	faFileArrowDown,
	faFileArrowUp,
	faMagnifyingGlass,
	faPen,
	faSquarePlus,
	faTrash
} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {Subscription} from 'rxjs';
import * as XLSX from 'xlsx';
import {DataTranslateService} from '../_services/data-translate.service';
import {SharedService} from '../_services/shared.service';
import {TokenService} from '../_services/token.service';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';

export function buildExportFilename(lang: string, date: Date): string {
	const name = lang === 'vi' ? 'sản_phẩm' : 'data';
	return `${name}__${date.toLocaleDateString(lang)}__${date.toLocaleTimeString(lang)}.xlsx`;
}

@Component({
	selector: 'app-admin',
	imports: [
		FormsModule,
		TranslatePipe,
		FaIconComponent,
		TooltipDirective,
		PaginationComponent
	],
	templateUrl: './admin.component.html',
	styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
	modalRef!: BsModalRef;
	data = signal<Product[]>([]);
	displayProducts = signal<Product[]>([]);
	productsOriginalDescription: string[] = [];
	categories = signal<Category[]>([]);
	types = signal<Type[]>([]);
	totalItem = signal(0);
	itemPerPage = signal(20);
	currentPage = signal(1);
	readonly maxSize = 5;
	createForm = {
		name: '',
		description: '',
		price: 0,
		imgUrl: '',
		quantity: 0,
		saleAmount: 0,
		categoryName: '',
		typeName: ''
	};
	editForm = {
		name: '',
		description: '',
		price: 0,
		imgUrl: '',
		quantity: 0,
		saleAmount: 0,
		categoryName: '',
		typeName: ''
	};
	searchForm = {
		name: '',
		categoryName: '',
		typeName: ''
	};
	searchResults = signal<Product[]>([]);
	currentId = 0;
	editIndex = 0;
	faMagnifyingGlass = faMagnifyingGlass;
	faSquarePlus = faSquarePlus;
	faPen = faPen;
	faTrash = faTrash;
	faFileArrowUp = faFileArrowUp;
	faFileArrowDown = faFileArrowDown;
	faArrowUpShortWide = faArrowUpShortWide;
	faArrowDownShortWide = faArrowDownShortWide;
	bgPrimary = signal('');
	tcPrimary = signal('');
	excelData = signal<Product[]>([]);
	numOfSortableCol = 5; // name, price, quantity, saleAmount, id
	sortFlip: boolean[] = [];
	firstTimeSort = true;
	isSelected = signal<boolean[]>([]);
	isAdmin = false;
	lightboxSrc = signal('');
	lightboxCaption = signal('');
	translateWrongExcel = signal('');
	translateWrongFormat = signal('');
	translateImportSuccessful = signal('');

	private readonly http = inject(HttpClient);
	private readonly router = inject(Router);
	private readonly modalService = inject(BsModalService);
	private readonly dataTranslateService = inject(DataTranslateService);
	private readonly sharedService = inject(SharedService);
	private readonly tokenService = inject(TokenService);
	readonly translate = inject(TranslateService);
	private readonly subscriptions = new Subscription();

	constructor() {
		for (let i = 0; i < this.numOfSortableCol; ++i) {
			this.sortFlip[i] = false;
		}
		this.subscriptions.add(this.sharedService.getGlobalBackgroundPrimary().subscribe(bg => {
			this.bgPrimary.set(bg[0]);
			this.tcPrimary.set(bg[1]);
		}));
		this.subscriptions.add(this.translate.stream('ALERT.NOT_EXCEL').subscribe(rs => {
			this.translateWrongExcel.set(rs);
		}));
		this.subscriptions.add(this.translate.stream('ALERT.WRONG_FORMAT').subscribe(rs => {
			this.translateWrongFormat.set(rs);
		}));
		this.subscriptions.add(this.translate.stream('ALERT.IMPORT_SUCCESSFUL').subscribe(rs => {
			this.translateImportSuccessful.set(rs);
		}));
	}

	ngOnInit() {
		this.getProducts();
		this.getCategories();
		this.getTypes();
		this.isAdmin = this.tokenService.isAdmin();
		if (!this.isAdmin) {
			this.router.navigate(['/shop']);
		}
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(data => {
			if (data) {
				this.data.set(data);
				this.productsOriginalDescription.length = 0;
				this.data().forEach(product => {
					product.imgUrl = product.imgUrl ? atob(product.imgUrl) : '';
					this.productsOriginalDescription.push(product.description);
					product.description = product.description.substr(0, 50) + (product.description.length > 60 ? '...' : '');
					product.price = this.dataTranslateService.getPrice(product.price, 'vi');
				});
				this.searchResults.set(data);
				this.paging(this.searchResults());
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.data.set([]);
		}, () => {
		});
	}

	paging(data: Product[]) {
		this.totalItem.set(data.length);
		this.displayProducts.set(data.slice((this.currentPage() - 1) * this.itemPerPage(),
			this.currentPage() * this.itemPerPage()));
		this.isSelected.set(this.displayProducts().map(() => false));
	}

	onPageChanged(event: PageChangedEvent) { // 1: 0 1 2 3   2: 4 5 6 7   3: 8 9 10 11
		this.displayProducts.set(this.searchResults().slice((event.page - 1) * event.itemsPerPage, event.page * event.itemsPerPage));
		this.isSelected.set(this.displayProducts().map(() => false));
	}

	onSearch() {
		const searchResults: Product[] = [];
		this.data().forEach(product => {
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
		} else if (mode === 'create') {
			this.createForm.typeName = this.types()[this.types().findIndex(x => x.categoryName === this.createForm.categoryName)].name;
		} else if (mode === 'edit') {
			this.editForm.typeName = this.types()[this.types().findIndex(x => x.categoryName === this.editForm.categoryName)].name;
		}
		this.firstTimeSort = false;
	}

	onChangeTypeSearch() {
		this.searchForm.name = '';
		this.firstTimeSort = false;
	}

	getCategories() {
		this.http.get<Category[]>('/api/category').subscribe(data => {
			if (data) {
				this.categories.set(data);
				this.createForm.categoryName = this.categories()[0].name;
				this.searchForm.categoryName = this.categories()[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.categories.set([]);
			this.createForm.categoryName = '';
			this.searchForm.categoryName = '';
		}, () => {
		});
	}

	getTypes() {
		this.http.get<Type[]>('/api/type').subscribe(data => {
			if (data) {
				this.types.set(data);
				this.createForm.typeName = this.types()[0].name;
				this.searchForm.typeName = this.types()[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.types.set([]);
			this.createForm.typeName = '';
			this.searchForm.typeName = '';
		}, () => {
		});
	}

	onRefreshCreateForm() {
		this.createForm = {
			name: '',
			description: '',
			price: 0,
			imgUrl: '',
			quantity: 0,
			saleAmount: 0,
			categoryName: '',
			typeName: ''
		};
	}

	onRefreshEditForm() {
		this.editForm = {
			name: '',
			description: '',
			price: 0,
			imgUrl: '',
			quantity: 0,
			saleAmount: 0,
			categoryName: '',
			typeName: ''
		};
	}

	openCreateModal(template: TemplateRef<void>) {
		this.modalRef = this.modalService.show(template);
	}

	onCreate() {
		const body = {
			...this.createForm,
			imgUrl: btoa(this.createForm.imgUrl),
			price: this.dataTranslateService.getPrice(this.createForm.price, 'en')
		};
		this.http.post<Product>('/api/product/create', body).subscribe(() => {
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	openEditModal(template: TemplateRef<void>, currentId: number) {
		this.modalRef = this.modalService.show(template);
		this.currentId = currentId;
		this.editForm = JSON.parse(JSON.stringify(this.data().find(x => x.id === this.currentId)));
		this.editIndex = this.data().findIndex(x => x.id === this.currentId);
		this.editForm.description = this.productsOriginalDescription[this.editIndex];
	}

	onEdit() {
		const body = {
			...this.editForm,
			imgUrl: btoa(this.editForm.imgUrl),
			price: this.dataTranslateService.getPrice(this.editForm.price, 'en')
		};
		this.http.put<Product>(`/api/product/${this.currentId}`, body).subscribe(() => {
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	onCloseEdit() {
		this.editForm.description = this.data()[this.editIndex].description;
	}

	openDeleteModal(template: TemplateRef<void>, currentId: number) {
		this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
		this.currentId = currentId;
	}

	onDelete() {
		if (this.isSelected().length === 1) {
			this.http.delete<void>(`/api/product/${this.currentId}`).subscribe(() => {
				this.getProducts();
			}, error => {
				console.log(`Error: ${error}`);
			}, () => {
			});
		} else {
			const delProdIds: number[] = [];
			for (let i = 0; i < this.isSelected().length; ++i) {
				if (this.isSelected()[i]) {
					delProdIds.push(this.displayProducts()[i].id);
				}
			}
			this.http.request<void>('delete', `/api/product`, {body: delProdIds}).subscribe(() => {
				this.getProducts();
			}, error => {
				console.log(`Error: ${error}`);
			}, () => {
			});
		}
	}

	openImportExcelModal(template: TemplateRef<void>) {
		this.modalRef = this.modalService.show(template);
	}

	onFileChange(evt: Event) {
		/* wire up file reader */
		const target = evt.target as HTMLInputElement;
		if (target.files === null || target.files.length !== 1) {
			throw new Error('Cannot use multiple files');
		}
		const file = target.files.item(0);
		if (file === null || file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
			alert(this.translateWrongExcel());
			return;
		}
		const reader: FileReader = new FileReader();
		reader.onload = () => {
			/* read workbook */
			const bstr: string = reader.result as string;
			const wb: XLSX.WorkBook = XLSX.read(bstr, {type: 'binary'});

			/* grab first sheet */
			const wsname: string = wb.SheetNames[0];
			const ws: XLSX.WorkSheet = wb.Sheets[wsname];

			/* save data */
			this.excelData.set(XLSX.utils.sheet_to_json<Product>(ws, {header: ['id', 'name', 'description', 'imgUrl', 'price', 'quantity', 'saleAmount', 'typeName', 'categoryName']}).slice(1));
			if (this.excelData().length > 0) {
				this.onImportExcel(this.excelData());
			} else {
				alert(this.translateWrongFormat());
			}
		};
		reader.readAsBinaryString(target.files[0]);
	}

	onImportExcel(excelData: Product[]) {
		const body = excelData.map(product => ({
			...product,
			price: this.dataTranslateService.getPrice(product.price, 'en')
		}));
		this.http.post<Product[]>('/api/product', body).subscribe(() => {
			alert(this.translateImportSuccessful());
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	onExportExcel() {
		/* prepare data */
		const isVi = this.translate.currentLang() === 'vi';
		const tempDescriptions: string[] = [];
		this.data().forEach((data, index) => {
			tempDescriptions[index] = data.description;
			data.description = this.productsOriginalDescription[index];
			if (!isVi) {
				data.price = this.dataTranslateService.getPrice(data.price, 'en');
			}
		});

		/* generate worksheet */
		const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.data());

		/* generate workbook and add the worksheet */
		const wb: XLSX.WorkBook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, isVi ? 'Sản phẩm' : 'Products');

		/* save to file */
		XLSX.writeFile(wb, buildExportFilename(this.translate.currentLang() ?? 'en', new Date()));

		/* restore data state */
		this.data().forEach((data, index) => {
			data.description = tempDescriptions[index];
			if (!isVi) {
				data.price = this.dataTranslateService.getPrice(data.price, 'vi');
			}
		});
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
		const description: string = this.productsOriginalDescription[this.productsOriginalDescription.findIndex(x => x.includes(this.displayProducts()[index].description.substring(0, this.displayProducts()[index].description.length - 3)))];
		caption += '</b> - (' + category + ' - ' + type + ').<br><i>' + description + '</i>';
		this.lightboxSrc.set(src);
		this.lightboxCaption.set(caption);
		this.modalRef = this.modalService.show(template);
	}

	onSort(sortWhat: number) {
		// sortWhat <-> name, price, quantity, saleAmount, id
		if (this.sortFlip[sortWhat]) {
			switch (sortWhat) {
				case 0:
					this.data.update(products => [...products].sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang() ?? 'en')));
					break;
				case 1:
					this.data.update(products => [...products].sort((a, b) => a.price - b.price));
					break;
				case 2:
					this.data.update(products => [...products].sort((a, b) => a.quantity - b.quantity));
					break;
				case 3:
					this.data.update(products => [...products].sort((a, b) => a.saleAmount - b.saleAmount));
					break;
				case 4:
					this.data.update(products => [...products].sort((a, b) => a.id - b.id));
					break;
				default:
					break;
			}
		} else {
			switch (sortWhat) {
				case 0:
					this.data.update(products => [...products].sort((a, b) => b.name.localeCompare(a.name, this.translate.currentLang() ?? 'en')));
					break;
				case 1:
					this.data.update(products => [...products].sort((a, b) => b.price - a.price));
					break;
				case 2:
					this.data.update(products => [...products].sort((a, b) => b.quantity - a.quantity));
					break;
				case 3:
					this.data.update(products => [...products].sort((a, b) => b.saleAmount - a.saleAmount));
					break;
				case 4:
					this.data.update(products => [...products].sort((a, b) => b.id - a.id));
					break;
				default:
					break;
			}
		}
		const prevName = this.searchForm.name;
		this.searchForm.name = this.firstTimeSort && this.searchForm.name === '' ? ' ' : this.searchForm.name;
		this.onSearch();
		this.searchForm.name = prevName;
		this.sortFlip[sortWhat] = !this.sortFlip[sortWhat];
	}

	selectRow(index: number) {
		this.isSelected.update(selected => selected.map((flag, i) => i === index ? !flag : flag));
	}
}
