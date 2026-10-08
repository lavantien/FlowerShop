import {Component, OnInit, TemplateRef, computed, inject, signal, viewChild} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {
	faArrowDownShortWide,
	faArrowUpShortWide,
	faFileArrowDown,
	faFileArrowUp,
	faPen,
	faSquarePlus,
	faTrash
} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {CatalogService} from '../../services/catalog.service';
import {TaxonomyService} from '../../services/taxonomy.service';
import {ToastService} from '../../core/toast.service';
import {Category, Page, ProductInput, ProductSort, ProductView, Type} from '../../models';
import {readExcel, writeExportWorkbook} from './excel';

@Component({
	selector: 'app-admin-products',
	imports: [
		ReactiveFormsModule,
		CurrencyPipe,
		TranslatePipe,
		FaIconComponent,
		TooltipDirective,
		PaginationComponent
	],
	templateUrl: './products.component.html',
	styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {
	readonly faSquarePlus = faSquarePlus;
	readonly faPen = faPen;
	readonly faTrash = faTrash;
	readonly faFileArrowUp = faFileArrowUp;
	readonly faFileArrowDown = faFileArrowDown;
	readonly faArrowUpShortWide = faArrowUpShortWide;
	readonly faArrowDownShortWide = faArrowDownShortWide;
	readonly sizeOptions = [12, 24, 48];
	readonly maxSize = 5;

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
	readonly typesAll = signal<Type[]>([]);
	readonly isSelected = signal<boolean[]>([]);
	readonly editId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly excelRows = signal<ProductInput[]>([]);
	readonly lightboxProduct = signal<ProductView | null>(null);
	readonly formCategory = signal('');

	readonly pagination = viewChild(PaginationComponent);

	private readonly fb = inject(NonNullableFormBuilder);
	readonly form = this.fb.group({
		name: ['', Validators.required],
		description: [''],
		imgUrl: [''],
		price: [0, [Validators.required, Validators.min(0)]],
		categoryName: ['', Validators.required],
		typeName: ['', Validators.required]
	});

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	readonly typesForFilter = computed(() => {
		const current = this.category();
		return current === '' ? this.typesAll() : this.typesAll().filter(candidate => candidate.categoryName === current);
	});
	readonly typesForCategory = computed(() => {
		const current = this.formCategory();
		return current === '' ? this.typesAll() : this.typesAll().filter(candidate => candidate.categoryName === current);
	});
	readonly selectedProducts = computed(() => this.content().filter((product, index) => this.isSelected()[index]));

	private readonly catalog = inject(CatalogService);
	private readonly taxonomy = inject(TaxonomyService);
	private readonly modalService = inject(BsModalService);
	private readonly toast = inject(ToastService);
	readonly translate = inject(TranslateService);
	private modalRef?: BsModalRef;

	ngOnInit(): void {
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
			error: () => this.applyPage(null)
		});
	}

	onSearch(): void {
		this.applyFilter(() => this.searchText.set(this.searchText().trim()));
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

	onSortToggle(field: 'name' | 'price'): void {
		const current = this.sort();
		const next: ProductSort = current === `${field}-asc` ? `${field}-desc` : `${field}-asc`;
		this.applyFilter(() => this.sort.set(next));
	}

	sortDirection(field: 'name' | 'price'): 'asc' | 'desc' | null {
		const current = this.sort();
		return current === `${field}-asc` ? 'asc' : current === `${field}-desc` ? 'desc' : null;
	}

	onSizeChange(size: string): void {
		this.applyFilter(() => this.size.set(Number(size)));
	}

	onPageChanged(event: PageChangedEvent): void {
		const target = event.page - 1;
		if (target === this.page()) {
			return;
		}
		this.page.set(target);
		this.load();
	}

	selectRow(index: number): void {
		this.isSelected.update(selected => selected.map((flag, i) => i === index ? !flag : flag));
	}

	openCreateModal(template: TemplateRef<void>): void {
		this.editId.set(null);
		this.form.reset();
		this.formCategory.set('');
		this.modalRef = this.modalService.show(template);
	}

	openEditModal(template: TemplateRef<void>, product: ProductView): void {
		this.editId.set(product.id);
		this.form.patchValue({
			name: product.name,
			description: product.description,
			imgUrl: product.imgUrl,
			price: product.price,
			categoryName: product.categoryName,
			typeName: product.typeName
		});
		this.formCategory.set(product.categoryName);
		this.modalRef = this.modalService.show(template);
	}

	onFormCategoryChange(): void {
		const categoryName = this.form.controls.categoryName.value;
		this.formCategory.set(categoryName);
		const matching = this.typesAll().find(candidate => candidate.categoryName === categoryName);
		this.form.controls.typeName.setValue(matching?.name ?? '');
	}

	onSubmit(): void {
		if (this.form.invalid || this.saving()) {
			return;
		}
		this.saving.set(true);
		const input = this.form.getRawValue();
		const saving = this.editId() === null
			? this.catalog.create(input)
			: this.catalog.update(this.editId()!, input);
		saving.subscribe({
			next: () => {
				this.saving.set(false);
				this.modalRef?.hide();
				this.toast.success(this.translate.instant('ADMIN.PRODUCT_SAVED'));
				this.load();
			},
			error: () => {
				this.saving.set(false);
				this.toast.danger(this.translate.instant('ADMIN.SAVE_FAILED'));
			}
		});
	}

	openDeleteModal(template: TemplateRef<void>): void {
		if (this.selectedProducts().length === 0) {
			return;
		}
		this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
	}

	onDelete(): void {
		const ids = this.selectedProducts().map(product => product.id);
		const request = ids.length === 1 ? this.catalog.remove(ids[0]) : this.catalog.removeMany(ids);
		request.subscribe({
			next: () => {
				this.modalRef?.hide();
				this.toast.success(this.translate.instant('ADMIN.PRODUCT_DELETED'));
				this.load();
			},
			error: () => this.toast.danger(this.translate.instant('ADMIN.DELETE_FAILED'))
		});
	}

	openImportExcelModal(template: TemplateRef<void>): void {
		this.excelRows.set([]);
		this.modalRef = this.modalService.show(template);
	}

	onFileChange(evt: Event): void {
		const target = evt.target as HTMLInputElement;
		if (target.files === null || target.files.length !== 1) {
			throw new Error('Cannot use multiple files');
		}
		readExcel(target.files.item(0)).subscribe({
			next: rows => this.excelRows.set(rows),
			error: (reason: string) => this.toast.show(
				this.translate.instant(reason === 'not-excel' ? 'ALERT.NOT_EXCEL' : 'ALERT.WRONG_FORMAT'), 'warning')
		});
	}

	onImportExcel(rows: ProductInput[]): void {
		if (rows.length === 0) {
			return;
		}
		this.catalog.bulkUpsert(rows).subscribe({
			next: () => {
				this.modalRef?.hide();
				this.toast.success(this.translate.instant('ALERT.IMPORT_SUCCESSFUL'));
				this.load();
			},
			error: () => this.toast.danger(this.translate.instant('ADMIN.IMPORT_FAILED'))
		});
	}

	onExportExcel(): void {
		this.catalog.all({
			search: this.searchText(),
			category: this.category(),
			type: this.type(),
			sort: this.sort()
		}).subscribe({
			next: rows => writeExportWorkbook(rows, this.translate.currentLang() ?? 'en'),
			error: () => this.toast.danger(this.translate.instant('ADMIN.EXPORT_FAILED'))
		});
	}

	onOpenImage(product: ProductView, template: TemplateRef<void>): void {
		this.lightboxProduct.set(product);
		this.modalRef = this.modalService.show(template);
	}

	private applyFilter(change: () => void): void {
		change();
		this.page.set(0);
		this.pagination()?.writeValue(1);
		this.load();
	}

	private applyPage(data: Page<ProductView> | null): void {
		this.content.set(data?.content ?? []);
		this.totalElements.set(data?.totalElements ?? 0);
		this.totalPages.set(data?.totalPages ?? 0);
		this.isSelected.set(this.content().map(() => false));
	}
}
