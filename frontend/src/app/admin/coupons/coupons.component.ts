import {Component, OnInit, inject, signal} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faPen, faPlus, faTrash} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {CouponService} from '../../services/coupon.service';
import {ToastService} from '../../core/toast.service';
import {Coupon, CouponInput, CouponKind} from '../../models';

@Component({
	selector: 'app-admin-coupons',
	imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, TranslatePipe, FaIconComponent, TooltipDirective],
	templateUrl: './coupons.component.html',
	styleUrls: ['./coupons.component.scss']
})
export class AdminCouponsComponent implements OnInit {
	readonly faPlus = faPlus;
	readonly faPen = faPen;
	readonly faTrash = faTrash;
	readonly kinds: CouponKind[] = ['PERCENT', 'FIXED'];

	readonly coupons = signal<Coupon[]>([]);
	readonly editId = signal<number | null>(null);
	readonly saving = signal(false);

	private readonly fb = inject(NonNullableFormBuilder);
	readonly form = this.fb.group({
		code: ['', [Validators.required, Validators.pattern('[A-Za-z0-9_-]+')]],
		kind: ['PERCENT' as CouponKind, Validators.required],
		value: [0, [Validators.required, Validators.min(1)]],
		expiresAt: [''],
		active: [true]
	});

	private readonly couponService = inject(CouponService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		this.couponService.list().subscribe({
			next: data => this.coupons.set(data ?? []),
			error: () => this.coupons.set([])
		});
	}

	isPercent(kind: CouponKind): boolean {
		return kind === 'PERCENT';
	}

	onSubmit(): void {
		if (this.form.invalid || this.saving()) {
			return;
		}
		this.saving.set(true);
		const raw = this.form.getRawValue();
		const input: CouponInput = {
			code: raw.code,
			kind: raw.kind,
			value: raw.value,
			active: raw.active,
			expiresAt: raw.expiresAt === '' ? null : raw.expiresAt
		};
		const id = this.editId();
		const saving = id === null ? this.couponService.create(input) : this.couponService.update(id, input);
		saving.subscribe({
			next: () => {
				this.saving.set(false);
				this.toast.success(this.translate.instant('ADMIN.COUPON_SAVED'));
				this.resetForm();
				this.load();
			},
			error: error => {
				this.saving.set(false);
				this.toast.danger(this.translate.instant(error.status === 409 ? 'ADMIN.CODE_IN_USE' : 'ADMIN.COUPON_SAVE_FAILED'));
			}
		});
	}

	editCoupon(coupon: Coupon): void {
		this.editId.set(coupon.id);
		this.form.patchValue({
			code: coupon.code,
			kind: coupon.kind,
			value: coupon.value,
			expiresAt: coupon.expiresAt === null ? '' : coupon.expiresAt.slice(0, 10),
			active: coupon.active
		});
	}

	resetForm(): void {
		this.editId.set(null);
		this.form.reset({code: '', kind: 'PERCENT', value: 0, expiresAt: '', active: true});
	}

	onToggleActive(coupon: Coupon): void {
		this.couponService.update(coupon.id, {...coupon, active: !coupon.active}).subscribe({
			next: () => {
				this.toast.success(this.translate.instant('ADMIN.COUPON_SAVED'));
				this.load();
			},
			error: () => this.toast.danger(this.translate.instant('ADMIN.COUPON_SAVE_FAILED'))
		});
	}

	onDelete(coupon: Coupon): void {
		this.couponService.remove(coupon.id).subscribe({
			next: () => {
				this.toast.success(this.translate.instant('ADMIN.COUPON_DELETED'));
				this.load();
			},
			error: () => this.toast.danger(this.translate.instant('ADMIN.COUPON_DELETE_FAILED'))
		});
	}
}
