import {Component, DOCUMENT, OnInit, computed, inject, signal} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faMinus, faPlus, faTrashCan} from '@fortawesome/free-solid-svg-icons';
import {CartService} from '../core/cart.service';
import {SessionService} from '../core/session.service';
import {ToastService} from '../core/toast.service';
import {BranchService} from '../services/branch.service';
import {CouponService} from '../services/coupon.service';
import {OrderService} from '../services/order.service';
import {GeoOptionsService} from '../shared/geo-options.service';
import {Branch, CheckoutRequest, CouponValidation} from '../models';

@Component({
	selector: 'app-cart',
	imports: [RouterLink, ReactiveFormsModule, CurrencyPipe, TranslatePipe, FaIconComponent],
	templateUrl: './cart.component.html',
	styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
	readonly faMinus = faMinus;
	readonly faPlus = faPlus;
	readonly faTrashCan = faTrashCan;

	readonly cart = inject(CartService);
	readonly session = inject(SessionService);
	readonly geo = inject(GeoOptionsService);

	private readonly fb = inject(NonNullableFormBuilder);
	private readonly branchService = inject(BranchService);
	private readonly couponService = inject(CouponService);
	private readonly orderService = inject(OrderService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);
	private readonly document = inject(DOCUMENT);

	readonly branches = signal<Branch[]>([]);
	readonly branchId = signal(0);
	readonly couponCode = signal('');
	readonly coupon = signal<CouponValidation | null>(null);
	readonly submitting = signal(false);
	readonly invalidCheckout = signal(false);

	readonly form = this.fb.group({
		phone: ['', [Validators.required, Validators.pattern('[0-9]{9,11}')]],
		address: ['', Validators.required],
		district: ['', Validators.required],
		city: ['Hồ Chí Minh', Validators.required]
	});

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	readonly discount = computed(() => this.coupon()?.discountAmount ?? 0);
	readonly payable = computed(() => Math.max(this.cart.subtotal() - this.discount(), 0));

	ngOnInit(): void {
		this.geo.load();
		const user = this.session.user();
		this.form.patchValue({
			phone: user?.phone ?? '',
			address: user?.address ?? '',
			district: user?.district ?? '',
			city: user?.city || 'Hồ Chí Minh'
		});
		this.branchService.list().subscribe({
			next: data => this.branches.set(data ?? []),
			error: () => this.branches.set([])
		});
	}

	onCityChange(): void {
		const city = this.form.controls.city.value;
		const first = this.geo.districts().find(district => district.cityName === city);
		if (first !== undefined) {
			this.form.controls.district.setValue(first.name);
		}
	}

	onBranchChange(value: string): void {
		this.branchId.set(Number(value));
	}

	inc(productId: number): void {
		const line = this.cart.lines().find(candidate => candidate.product.id === productId);
		if (line !== undefined) {
			this.cart.changeQuantity(productId, line.quantity + 1);
			this.resetCoupon();
		}
	}

	dec(productId: number): void {
		const line = this.cart.lines().find(candidate => candidate.product.id === productId);
		if (line !== undefined && line.quantity > 1) {
			this.cart.changeQuantity(productId, line.quantity - 1);
			this.resetCoupon();
		}
	}

	remove(productId: number): void {
		this.cart.remove(productId);
		this.resetCoupon();
	}

	applyCoupon(): void {
		const code = this.couponCode().trim();
		if (code === '') {
			this.coupon.set(null);
			return;
		}
		this.couponService.validate({code, subtotal: this.cart.subtotal()}).subscribe({
			next: validation => this.coupon.set(validation),
			error: () => {
				this.coupon.set(null);
				this.toast.danger(this.translate.instant('CART.COUPON_INVALID'));
			}
		});
	}

	removeCoupon(): void {
		this.couponCode.set('');
		this.coupon.set(null);
	}

	onCheckout(): void {
		this.invalidCheckout.set(false);
		if (this.form.invalid || this.cart.isEmpty()) {
			this.invalidCheckout.set(true);
			return;
		}
		if (this.submitting()) {
			return;
		}
		this.submitting.set(true);
		const raw = this.form.getRawValue();
		const request: CheckoutRequest = {
			items: this.cart.lines().map(line => ({productId: line.product.id, quantity: line.quantity})),
			phone: raw.phone,
			address: raw.address,
			district: raw.district,
			city: raw.city
		};
		if (this.branchId() > 0) {
			request.branchId = this.branchId();
		}
		if (this.coupon() !== null) {
			request.couponCode = this.coupon()!.code;
		}
		this.orderService.checkout(request).subscribe({
			next: response => {
				this.cart.clear();
				this.redirectToGateway(response.payment.redirectUrl);
			},
			error: () => {
				this.submitting.set(false);
				this.toast.danger(this.translate.instant('CART.ORDER_FAILED'));
			}
		});
	}

	redirectToGateway(url: string): void {
		this.document.location.assign(url);
	}

	private resetCoupon(): void {
		this.coupon.set(null);
	}
}
