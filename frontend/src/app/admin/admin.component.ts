import {Component, OnDestroy, OnInit, TemplateRef} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {
	faFileDownload,
	faFileUpload,
	faPen,
	faPlusSquare,
	faSearch,
	faSortAmountDownAlt,
	faSortAmountUp,
	faTrash
} from '@fortawesome/free-solid-svg-icons';
import {DataTranslateService} from '../_services/data-translate.service';
import {TranslateService} from '@ngx-translate/core';
import {SharedService} from '../_services/shared.service';
import * as XLSX from 'xlsx';
import {Lightbox} from 'ngx-lightbox';
import {Subscription} from 'rxjs';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';
import {Router} from "@angular/router";

@Component({
	selector: 'app-admin',
	templateUrl: './admin.component.html',
	styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
	modalRef: BsModalRef;
	data: Product[] = [];
	displayProducts: Product[] = [];
	productsOriginalDescription: string[] = [];
	categories: Category[] = [];
	types: Type[] = [];
	pagination = {
		totalItem: 0,
		itemPerPage: 20,
		currentPage: 1,
		maxSize: 5
	};
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
	searchResults: Product[] = [];
	currentId = 0;
	editIndex = 0;
	faSearch = faSearch;
	faPlusSquare = faPlusSquare;
	faPen = faPen;
	faTrash = faTrash;
	faFileUpload = faFileUpload;
	faFileDownload = faFileDownload;
	faSortAmountUp = faSortAmountUp;
	faSortAmountDownAlt = faSortAmountDownAlt;
	bgPrimary = '';
	tcPrimary = '';
	excelData: any[] = [];
	numOfSortableCol = 5; // name, price, quantity, saleAmount, id
	sortFlip: boolean[] = [];
	firstTimeSort = true;
	isSelected: boolean[] = [];
	isAdmin = false;
	private subscriptions = new Subscription();
	translateWrongExcel = '';
	translateWrongFormat = '';
	translateImportSuccessful = '';

	constructor(private http: HttpClient,
	            private router: Router,
	            private modalService: BsModalService,
	            private dataTranslateService: DataTranslateService,
	            private sharedService: SharedService,
	            private lightbox: Lightbox,
	            public translate: TranslateService) {
		for (let i = 0; i < this.numOfSortableCol; ++i) {
			this.sortFlip[i] = false;
		}
		this.subscriptions.add(this.sharedService.getGlobalBackgroundPrimary().subscribe(bg => {
			this.bgPrimary = bg[0];
			this.tcPrimary = bg[1];
		}));
		this.subscriptions.add(this.translate.stream('ALERT.NOT_EXCEL').subscribe(rs => {
			this.translateWrongExcel = rs;
		}));
		this.subscriptions.add(this.translate.stream('ALERT.WRONG_FORMAT').subscribe(rs => {
			this.translateWrongFormat = rs;
		}));
		this.subscriptions.add(this.translate.stream('ALERT.IMPORT_SUCCESSFUL').subscribe(rs => {
			this.translateImportSuccessful = rs;
		}));
	}

	ngOnInit() {
		this.getProducts();
		this.getCategories();
		this.getTypes();
		this.isAdmin = localStorage.getItem('token') !== null && atob(localStorage.getItem('token')).substring(atob(localStorage.getItem('token')).indexOf('+') + 1) === 'ADMIN';
		if (!this.isAdmin) {
			this.router.navigate(['/shop']);
		}
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(data => {
			if (!!data) {
				this.data = data;
				this.productsOriginalDescription.length = 0;
				this.data.forEach(product => {
					product.imgUrl = product.imgUrl ? atob(product.imgUrl) : '';
					this.productsOriginalDescription.push(product.description);
					product.description = product.description.substr(0, 50) + (product.description.length > 60 ? '...' : '');
					product.price = this.dataTranslateService.getPrice(product.price, 'vi');
				});
				this.searchResults = data;
				this.paging(this.searchResults);
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.data = [];
		}, () => {
		});
	}

	paging(data: Product[]) {
		this.pagination.totalItem = data.length;
		this.displayProducts = data.slice((this.pagination.currentPage - 1) * this.pagination.itemPerPage,
			this.pagination.currentPage * this.pagination.itemPerPage);
		this.isSelected.length = 0;
		for (let i = 0; i < this.displayProducts.length; ++i) {
			this.isSelected.push(false);
		}
	}

	onPageChanged(event: any) { // 1: 0 1 2 3   2: 4 5 6 7   3: 8 9 10 11
		this.displayProducts = this.searchResults.slice((event.page - 1) * event.itemsPerPage, event.page * event.itemsPerPage);
		this.isSelected.length = 0;
		for (let i = 0; i < this.displayProducts.length; ++i) {
			this.isSelected.push(false);
		}
	}

	onSearch() {
		const searchResults: Product[] = [];
		this.data.forEach(product => {
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
		} else if (mode === 'create') {
			this.createForm.typeName = this.types[this.types.findIndex(x => x.categoryName === this.createForm.categoryName)].name;
		} else if (mode === 'edit') {
			this.editForm.typeName = this.types[this.types.findIndex(x => x.categoryName === this.editForm.categoryName)].name;
		}
		this.firstTimeSort = false;
	}

	onChangeTypeSearch() {
		this.searchForm.name = '';
		this.firstTimeSort = false;
	}

	getCategories() {
		this.http.get<Category[]>('/api/category').subscribe(data => {
			if (!!data) {
				this.categories = data;
				this.createForm.categoryName = this.categories[0].name;
				this.searchForm.categoryName = this.categories[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.categories = [];
			this.createForm.categoryName = '';
			this.searchForm.categoryName = '';
		}, () => {
		});
	}

	getTypes() {
		this.http.get<Type[]>('/api/type').subscribe(data => {
			if (!!data) {
				this.types = data;
				this.createForm.typeName = this.types[0].name;
				this.searchForm.typeName = this.types[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.types = [];
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

	openCreateModal(template: TemplateRef<any>) {
		this.modalRef = this.modalService.show(template);
	}

	onCreate() {
		this.http.post<Product>('/api/product/create', () => {
			this.createForm.imgUrl = btoa(this.createForm.imgUrl);
			this.createForm.price = this.dataTranslateService.getPrice(this.createForm.price, 'en');
			return this.createForm;
		}).subscribe(() => {
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	openEditModal(template: TemplateRef<any>, currentId: number) {
		this.modalRef = this.modalService.show(template);
		this.currentId = currentId;
		this.editForm = JSON.parse(JSON.stringify(this.data.find(x => x.id === this.currentId)));
		this.editIndex = this.data.findIndex(x => x.id === this.currentId);
		this.editForm.description = this.productsOriginalDescription[this.editIndex];
	}

	onEdit() {
		this.http.put<Product>(`/api/product/${this.currentId}`, () => {
			this.editForm.imgUrl = btoa(this.editForm.imgUrl);
			this.createForm.price = this.dataTranslateService.getPrice(this.createForm.price, 'en');
			return this.editForm;
		}).subscribe(() => {
			this.getProducts();
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	onCloseEdit() {
		this.editForm.description = this.data[this.editIndex].description;
	}

	openDeleteModal(template: TemplateRef<any>, currentId: number) {
		this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
		this.currentId = currentId;
	}

	onDelete() {
		if (this.isSelected.length === 1) {
			this.http.delete<any>(`/api/product/${this.currentId}`).subscribe(data => {
				this.getProducts();
			}, error => {
				console.log(`Error: ${error}`);
			}, () => {
			});
		} else {
			const delProdIds: number[] = [];
			for (let i = 0; i < this.isSelected.length; ++i) {
				if (this.isSelected[i]) {
					delProdIds.push(this.displayProducts[i].id);
				}
			}
			this.http.request<any>('delete', `/api/product`, {body: delProdIds}).subscribe(data => {
				this.getProducts();
			}, error => {
				console.log(`Error: ${error}`);
			}, () => {
			});
		}
	}

	openImportExcelModal(template: TemplateRef<any>) {
		this.modalRef = this.modalService.show(template);
	}

	onFileChange(evt: any) {
		/* wire up file reader */
		const target: DataTransfer = (evt.target) as DataTransfer;
		if (target.files.length !== 1) {
			throw new Error('Cannot use multiple files');
		}
		if (target.files.item(0).type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
			alert(this.translateWrongExcel);
			return;
		}
		const reader: FileReader = new FileReader();
		reader.onload = (e: any) => {
			/* read workbook */
			const bstr: string = e.target.result;
			const wb: XLSX.WorkBook = XLSX.read(bstr, {type: 'binary'});

			/* grab first sheet */
			const wsname: string = wb.SheetNames[0];
			const ws: XLSX.WorkSheet = wb.Sheets[wsname];

			/* save data */
			this.excelData = XLSX.utils.sheet_to_json(ws, {header: ['id', 'name', 'description', 'imgUrl', 'price', 'quantity', 'saleAmount', 'typeName', 'categoryName']}).slice(1);
			if (!!this.excelData && typeof this.excelData === typeof this.data) {
				this.onImportExcel(this.excelData as Product[]);
			} else {
				alert(this.translateWrongFormat);
			}
		};
		reader.readAsBinaryString(target.files[0]);
	}

	onImportExcel(excelData: Product[]) {
		this.http.post<Product[]>('/api/product', () => {
			this.data.forEach(data => {
				data.price = this.dataTranslateService.getPrice(data.price, 'en');
			});
			return this.data;
		}).subscribe(data => {
			if (data === excelData) {
				alert(this.translateImportSuccessful);
				this.getProducts();
			}
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	onExportExcel() {
		/* prepare data */
		const tempDescriptions: string[] = [];
		this.data.forEach((data, index) => {
			tempDescriptions[index] = data.description;
			data.description = this.productsOriginalDescription[index];
			if (this.translate.currentLang !== 'en-US') {
				data.price = this.dataTranslateService.getPrice(data.price, 'en');
			}
		});

		/* generate worksheet */
		const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.data);

		/* generate workbook and add the worksheet */
		const wb: XLSX.WorkBook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, `${this.translate.currentLang === 'en-US' ? 'Products' : 'Sản phẩm'}`);

		/* save to file */
		XLSX.writeFile(wb, `${this.translate.currentLang === 'en-US' ? 'data' : 'sản_phẩm'}__${new Date().toLocaleDateString(this.translate.currentLang)}__${new Date().toLocaleTimeString(this.translate.currentLang)}.xlsx`);

		/* restore data state */
		this.data.forEach((data, index) => {
			data.description = tempDescriptions[index];
			if (this.translate.currentLang !== 'en-US') {
				data.price = this.dataTranslateService.getPrice(data.price, 'vi');
			}
		});
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
		description = this.productsOriginalDescription[this.productsOriginalDescription.findIndex(x => x.includes(this.displayProducts[index].description.substring(0, this.displayProducts[index].description.length - 3)))];
		caption += '</b> - (' + category + ' - ' + type + ').<br><i>' + description + '</i>';
		album.push({
			src,
			caption,
			thumb
		});
		this.lightbox.open(album, 0);
	}

	onSort(sortWhat: number) {
		// sortWhat <-> name, price, quantity, saleAmount, id
		if (this.sortFlip[sortWhat]) {
			switch (sortWhat) {
				case 0:
					this.data.sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang));
					break;
				case 1:
					this.data.sort((a, b) => a.price - b.price);
					break;
				case 2:
					this.data.sort((a, b) => a.quantity - b.quantity);
					break;
				case 3:
					this.data.sort((a, b) => a.saleAmount - b.saleAmount);
					break;
				case 4:
					this.data.sort((a, b) => a.id - b.id);
					break;
				default:
					break;
			}
		} else {
			switch (sortWhat) {
				case 0:
					this.data.sort((a, b) => b.name.localeCompare(a.name, this.translate.currentLang));
					break;
				case 1:
					this.data.sort((a, b) => b.price - a.price);
					break;
				case 2:
					this.data.sort((a, b) => b.quantity - a.quantity);
					break;
				case 3:
					this.data.sort((a, b) => b.saleAmount - a.saleAmount);
					break;
				case 4:
					this.data.sort((a, b) => b.id - a.id);
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
		this.isSelected[index] = !this.isSelected[index];
	}

	trackByFn(index, item) {
		return index;
	}
}
