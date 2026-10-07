import {Component, OnInit, TemplateRef, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
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
import * as XLSX from 'xlsx';
import {ToastService} from '../core/toast.service';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';

type FormMode = 'search' | 'create' | 'edit';

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
export class AdminComponent implements OnInit {
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
	excelData = signal<Product[]>([]);
	numOfSortableCol = 5; // name, price, quantity, saleAmount, id
	sortFlip: boolean[] = [];
	firstTimeSort = true;
	isSelected = signal<boolean[]>([]);
	lightboxSrc = signal('');
	lightboxCaption = signal('');

	private readonly http = inject(HttpClient);
	private readonly modalService = inject(BsModalService);
	private readonly toast = inject(ToastService);
	readonly translate = inject(TranslateService);
	readonly translateWrongExcel = toSignal(this.translate.stream('ALERT.NOT_EXCEL'), {initialValue: ''});
	readonly translateWrongFormat = toSignal(this.translate.stream('ALERT.WRONG_FORMAT'), {initialValue: ''});
	readonly translateImportSuccessful = toSignal(this.translate.stream('ALERT.IMPORT_SUCCESSFUL'), {initialValue: ''});

	constructor() {
		for (let i = 0; i < this.numOfSortableCol; ++i) {
			this.sortFlip[i] = false;
		}
	}

	ngOnInit() {
		this.getProducts();
		this.getCategories();
		this.getTypes();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(data => {
			if (data) {
				this.data.set(data);
				this.productsOriginalDescription.length = 0;
				this.data().forEach(product => {
					this.productsOriginalDescription.push(product.description);
					product.description = product.description.slice(0, 50) + (product.description.length > 60 ? '...' : '');
				});
				this.searchResults.set(data);
				this.paging(this.searchResults());
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.data.set([]);
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

	onChangeCategory(mode: FormMode) {
		if (mode === 'search') {
			this.searchForm.name = '';
			const matching = this.types().find(type => type.categoryName === this.searchForm.categoryName);
			if (matching !== undefined) {
				this.searchForm.typeName = matching.name;
			}
		} else if (mode === 'create') {
			const matching = this.types().find(type => type.categoryName === this.createForm.categoryName);
			if (matching !== undefined) {
				this.createForm.typeName = matching.name;
			}
		} else {
			const matching = this.types().find(type => type.categoryName === this.editForm.categoryName);
			if (matching !== undefined) {
				this.editForm.typeName = matching.name;
			}
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
		this.http.post<Product>('/api/product/create', {...this.createForm}).subscribe(() => {
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		});
	}

	openEditModal(template: TemplateRef<void>, currentId: number) {
		const original = this.data().find(product => product.id === currentId);
		if (original === undefined) {
			return;
		}
		this.modalRef = this.modalService.show(template);
		this.currentId = currentId;
		this.editForm = structuredClone(original);
		this.editIndex = this.data().findIndex(product => product.id === currentId);
		this.editForm.description = this.productsOriginalDescription[this.editIndex];
	}

	onEdit() {
		this.http.put<Product>(`/api/product/${this.currentId}`, {...this.editForm}).subscribe(() => {
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
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
			});
		}
	}

	openImportExcelModal(template: TemplateRef<void>) {
		this.modalRef = this.modalService.show(template);
	}

	onFileChange(evt: Event) {
		const target = evt.target as HTMLInputElement;
		if (target.files === null || target.files.length !== 1) {
			throw new Error('Cannot use multiple files');
		}
		const file = target.files.item(0);
		if (file === null || file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
			this.toast.show(this.translateWrongExcel(), 'warning');
			return;
		}
		const reader: FileReader = new FileReader();
		reader.onload = () => {
			const workbook: XLSX.WorkBook = XLSX.read(reader.result, {type: 'array'});

			/* grab first sheet */
			const wsname: string = workbook.SheetNames[0];
			const ws: XLSX.WorkSheet = workbook.Sheets[wsname];

			/* save data */
			this.excelData.set(XLSX.utils.sheet_to_json<Product>(ws, {header: ['id', 'name', 'description', 'imgUrl', 'price', 'quantity', 'saleAmount', 'typeName', 'categoryName']}).slice(1));
			if (this.excelData().length > 0) {
				this.onImportExcel(this.excelData());
			} else {
				this.toast.show(this.translateWrongFormat(), 'warning');
			}
		};
		reader.readAsArrayBuffer(file);
	}

	onImportExcel(excelData: Product[]) {
		this.http.post<Product[]>('/api/product', excelData).subscribe(() => {
			this.toast.success(this.translateImportSuccessful());
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		});
	}

	onExportExcel() {
		/* prepare data */
		const tempDescriptions: string[] = [];
		this.data().forEach((row, index) => {
			tempDescriptions[index] = row.description;
			row.description = this.productsOriginalDescription[index];
		});

		/* generate worksheet */
		const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.data());

		/* generate workbook and add the worksheet */
		const wb: XLSX.WorkBook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, this.translate.currentLang() === 'vi' ? 'Sản phẩm' : 'Products');

		/* save to file */
		XLSX.writeFile(wb, buildExportFilename(this.translate.currentLang() ?? 'en', new Date()));

		/* restore data state */
		this.data().forEach((row, index) => {
			row.description = tempDescriptions[index];
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
