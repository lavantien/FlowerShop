import {Component, OnInit, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faPen, faPlus, faTrash} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {TaxonomyService} from '../../services/taxonomy.service';
import {ToastService} from '../../core/toast.service';
import {Category, Type} from '../../models';

@Component({
	selector: 'app-admin-taxonomy',
	imports: [ReactiveFormsModule, TranslatePipe, FaIconComponent, TooltipDirective],
	templateUrl: './taxonomy.component.html',
	styleUrls: ['./taxonomy.component.scss']
})
export class AdminTaxonomyComponent implements OnInit {
	readonly faPlus = faPlus;
	readonly faPen = faPen;
	readonly faTrash = faTrash;

	readonly categories = signal<Category[]>([]);
	readonly types = signal<Type[]>([]);
	readonly editCategoryId = signal<number | null>(null);
	readonly editTypeId = signal<number | null>(null);

	private readonly fb = inject(NonNullableFormBuilder);
	readonly categoryForm = this.fb.group({name: ['', Validators.required]});
	readonly typeForm = this.fb.group({
		name: ['', Validators.required],
		categoryName: ['', Validators.required]
	});

	private readonly taxonomy = inject(TaxonomyService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		this.taxonomy.categories().subscribe({
			next: data => this.categories.set(data ?? []),
			error: () => this.categories.set([])
		});
		this.taxonomy.types().subscribe({
			next: data => this.types.set(data ?? []),
			error: () => this.types.set([])
		});
	}

	onCategorySubmit(): void {
		if (this.categoryForm.invalid) {
			return;
		}
		const input = this.categoryForm.getRawValue();
		const id = this.editCategoryId();
		const saving = id === null
			? this.taxonomy.createCategory(input)
			: this.taxonomy.updateCategory(id, input);
		saving.subscribe({
			next: () => this.afterTaxonomySave('ADMIN.TAXONOMY_SAVED'),
			error: error => this.saveFailed(error)
		});
	}

	onTypeSubmit(): void {
		if (this.typeForm.invalid) {
			return;
		}
		const input = this.typeForm.getRawValue();
		const id = this.editTypeId();
		const saving = id === null
			? this.taxonomy.createType(input)
			: this.taxonomy.updateType(id, input);
		saving.subscribe({
			next: () => this.afterTaxonomySave('ADMIN.TAXONOMY_SAVED'),
			error: error => this.saveFailed(error)
		});
	}

	editCategory(category: Category): void {
		this.editCategoryId.set(category.id);
		this.categoryForm.patchValue({name: category.name});
	}

	editType(type: Type): void {
		this.editTypeId.set(type.id);
		this.typeForm.patchValue({name: type.name, categoryName: type.categoryName});
	}

	resetCategoryForm(): void {
		this.editCategoryId.set(null);
		this.categoryForm.reset();
	}

	resetTypeForm(): void {
		this.editTypeId.set(null);
		this.typeForm.reset();
	}

	onCategoryDelete(category: Category): void {
		this.taxonomy.removeCategory(category.id).subscribe({
			next: () => this.afterDelete('ADMIN.TAXONOMY_DELETED'),
			error: error => this.deleteFailed(error)
		});
	}

	onTypeDelete(type: Type): void {
		this.taxonomy.removeType(type.id).subscribe({
			next: () => this.afterDelete('ADMIN.TAXONOMY_DELETED'),
			error: error => this.deleteFailed(error)
		});
	}

	private afterTaxonomySave(messageKey: string): void {
		this.toast.success(this.translate.instant(messageKey));
		this.resetCategoryForm();
		this.resetTypeForm();
		this.load();
	}

	private saveFailed(error: {status: number}): void {
		this.toast.danger(this.translate.instant(error.status === 409 ? 'ADMIN.NAME_IN_USE' : 'ADMIN.TAXONOMY_SAVE_FAILED'));
	}

	private afterDelete(messageKey: string): void {
		this.toast.success(this.translate.instant(messageKey));
		this.load();
	}

	private deleteFailed(error: {status: number}): void {
		this.toast.danger(this.translate.instant(error.status === 409 ? 'ADMIN.NAME_IN_USE' : 'ADMIN.TAXONOMY_DELETE_FAILED'));
	}
}
