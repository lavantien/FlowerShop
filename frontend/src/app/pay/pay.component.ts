import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {PaymentService} from '../services/payment.service';
import {ToastService} from '../core/toast.service';
import {PaymentView} from '../models';

@Component({
	selector: 'app-pay',
	imports: [RouterLink, CurrencyPipe, TranslatePipe],
	templateUrl: './pay.component.html',
	styleUrls: ['./pay.component.scss']
})
export class PayComponent implements OnInit {
	readonly payment = signal<PaymentView | null>(null);
	readonly loadFailed = signal(false);
	readonly working = signal(false);

	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly payments = inject(PaymentService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	private readonly paramMap = toSignal(this.route.paramMap, {initialValue: this.route.snapshot.paramMap});
	private readonly queryParamMap = toSignal(this.route.queryParamMap, {initialValue: this.route.snapshot.queryParamMap});

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		const id = this.paramMap().get('paymentId');
		const sig = this.queryParamMap().get('sig');
		if (id === null || sig === null) {
			this.fail(this.translate.instant('PAY.BAD_LINK'));
			return;
		}
		this.payments.byId(id, sig).subscribe({
			next: view => {
				this.payment.set(view);
				this.loadFailed.set(false);
			},
			error: () => this.fail(this.translate.instant('PAY.LOAD_FAILED'))
		});
	}

	onPay(): void {
		this.act('confirm');
	}

	onCancel(): void {
		this.act('cancel');
	}

	private act(action: 'confirm' | 'cancel'): void {
		const view = this.payment();
		const id = this.paramMap().get('paymentId');
		const sig = this.queryParamMap().get('sig');
		if (view === null || id === null || sig === null || view.status !== 'PENDING' || this.working()) {
			return;
		}
		this.working.set(true);
		const call = action === 'confirm' ? this.payments.confirm(id, sig) : this.payments.cancel(id, sig);
		call.subscribe({
			next: result => {
				this.working.set(false);
				if (result.status === 'CONFIRMED') {
					this.toast.success(this.translate.instant('PAY.CONFIRMED_TOAST'));
				} else {
					this.toast.show(this.translate.instant('PAY.CANCELLED_TOAST'), 'info');
				}
				void this.router.navigate(['/info']);
			},
			error: () => {
				this.working.set(false);
				this.toast.danger(this.translate.instant('PAY.ACTION_FAILED'));
			}
		});
	}

	private fail(message: string): void {
		this.payment.set(null);
		this.loadFailed.set(true);
		this.toast.danger(message);
	}

	statusClass(status: string): string {
		if (status === 'CONFIRMED') {
			return 'badge text-bg-success';
		}
		return status === 'PENDING' ? 'badge text-bg-warning' : 'badge text-bg-secondary';
	}
}
