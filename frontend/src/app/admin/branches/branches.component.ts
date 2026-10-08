import {Component, OnInit, TemplateRef, computed, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faBoxesStacked, faPen, faPlus, faTrash} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {BranchService} from '../../services/branch.service';
import {CatalogService} from '../../services/catalog.service';
import {GeoOptionsService} from '../../shared/geo-options.service';
import {ToastService} from '../../core/toast.service';
import {Branch, BranchInput, ProductView, StockRow} from '../../models';

@Component({
	selector: 'app-admin-branches',
	imports: [ReactiveFormsModule, TranslatePipe, FaIconComponent, TooltipDirective],
	templateUrl: './branches.component.html',
	styleUrls: ['./branches.component.scss']
})
export class AdminBranchesComponent implements OnInit {
	readonly faPlus = faPlus;
	readonly faPen = faPen;
	readonly faTrash = faTrash;
	readonly faBoxesStacked = faBoxesStacked;

	readonly branches = signal<Branch[]>([]);
	readonly editId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly stockBranch = signal<Branch | null>(null);
	readonly stockRows = signal<StockRow[]>([]);
	readonly products = signal<ProductView[]>([]);
	readonly stockSaving = signal<number | null>(null);
	readonly formCity = signal('');

	private readonly fb = inject(NonNullableFormBuilder);
	readonly form = this.fb.group({
		name: ['', Validators.required],
		address: ['', Validators.required],
		district: ['', Validators.required],
		city: ['Hồ Chí Minh', Validators.required],
		lat: [0, Validators.required],
		lng: [0, Validators.required],
		active: [true]
	});

	readonly geo = inject(GeoOptionsService);
	readonly districtsForCity = computed(() => {
		const city = this.formCity();
		return city === '' ? this.geo.districts() : this.geo.districts().filter(district => district.cityName === city);
	});

	private readonly branchService = inject(BranchService);
	private readonly catalog = inject(CatalogService);
	private readonly modalService = inject(BsModalService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);
	private modalRef?: BsModalRef;

	ngOnInit(): void {
		this.geo.load();
		this.load();
	}

	load(): void {
		this.branchService.list().subscribe({
			next: data => this.branches.set(data ?? []),
			error: () => this.branches.set([])
		});
	}

	onSubmit(): void {
		if (this.form.invalid || this.saving()) {
			return;
		}
		this.saving.set(true);
		const input: BranchInput = this.form.getRawValue();
		const id = this.editId();
		const saving = id === null ? this.branchService.create(input) : this.branchService.update(id, input);
		saving.subscribe({
			next: () => {
				this.saving.set(false);
				this.toast.success(this.translate.instant('ADMIN.BRANCH_SAVED'));
				this.resetForm();
				this.load();
			},
			error: () => {
				this.saving.set(false);
				this.toast.danger(this.translate.instant('ADMIN.BRANCH_SAVE_FAILED'));
			}
		});
	}

	editBranch(branch: Branch): void {
		this.editId.set(branch.id);
		this.form.patchValue({
			name: branch.name,
			address: branch.address,
			district: branch.district,
			city: branch.city,
			lat: branch.lat,
			lng: branch.lng,
			active: branch.active
		});
		this.formCity.set(branch.city);
	}

	resetForm(): void {
		this.editId.set(null);
		this.form.reset({name: '', address: '', district: '', city: 'Hồ Chí Minh', lat: 0, lng: 0, active: true});
		this.formCity.set('Hồ Chí Minh');
	}

	onCityChange(): void {
		const city = this.form.controls.city.value;
		this.formCity.set(city);
		const matching = this.geo.districts().find(district => district.cityName === city);
		this.form.controls.district.setValue(matching?.name ?? '');
	}

	onDelete(branch: Branch): void {
		this.branchService.remove(branch.id).subscribe({
			next: () => {
				this.toast.success(this.translate.instant('ADMIN.BRANCH_DELETED'));
				this.load();
			},
			error: error => {
				this.toast.danger(this.translate.instant(error.status === 409 ? 'ADMIN.BRANCH_HAS_STOCK' : 'ADMIN.BRANCH_DELETE_FAILED'));
			}
		});
	}

	openStockEditor(template: TemplateRef<void>, branch: Branch): void {
		this.stockBranch.set(branch);
		this.stockRows.set([]);
		this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
		this.branchService.stock(branch.id).subscribe({
			next: data => this.stockRows.set(data ?? []),
			error: () => this.stockRows.set([])
		});
		if (this.products().length === 0) {
			this.catalog.all({}).subscribe({
				next: rows => this.products.set(rows),
				error: () => this.products.set([])
			});
		}
	}

	quantityFor(productId: number): number {
		return this.stockRows().find(row => row.productId === productId)?.quantity ?? 0;
	}

	onQuantityInput(productId: number, value: string): void {
		const quantity = Math.max(0, Math.floor(Number(value) || 0));
		this.stockRows.update(rows => {
			const existing = rows.find(row => row.productId === productId);
			if (existing === undefined) {
				return [...rows, {productId, quantity}];
			}
			return rows.map(row => row.productId === productId ? {productId, quantity} : row);
		});
	}

	onSaveStock(productId: number): void {
		const branch = this.stockBranch();
		const quantity = this.quantityFor(productId);
		if (branch === null || this.stockSaving() !== null) {
			return;
		}
		this.stockSaving.set(productId);
		this.branchService.setStock(branch.id, {productId, quantity}).subscribe({
			next: row => {
				this.stockSaving.set(null);
				this.stockRows.update(rows => rows.map(candidate => candidate.productId === row.productId ? row : candidate));
				this.toast.success(this.translate.instant('ADMIN.STOCK_SAVED'));
			},
			error: () => {
				this.stockSaving.set(null);
				this.toast.danger(this.translate.instant('ADMIN.STOCK_FAILED'));
			}
		});
	}
}
