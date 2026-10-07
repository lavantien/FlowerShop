import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {CurrencyPipe, DatePipe} from '@angular/common';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {OrderService} from '../../services/order.service';
import {ToastService} from '../../core/toast.service';
import {Order, Page} from '../../models';

@Component({
	selector: 'app-orders',
	imports: [CurrencyPipe, DatePipe, TranslatePipe, PaginationComponent],
	templateUrl: './orders.component.html',
	styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
	readonly orders = signal<Order[]>([]);
	readonly totalElements = signal(0);
	readonly totalPages = signal(0);
	readonly page = signal(0);
	readonly size = 12;
	readonly maxSize = 3;
	readonly cancelling = signal<number | null>(null);

	private readonly orderService = inject(OrderService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	readonly rangeLabel = computed(() => {
		if (this.orders().length === 0) {
			return '';
		}
		const from = this.page() * this.size + 1;
		const to = from + this.orders().length - 1;
		return `${from}-${to} / ${this.totalElements()}`;
	});

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		this.orderService.mine(this.page(), this.size).subscribe({
			next: (data: Page<Order>) => this.applyPage(data),
			error: () => this.applyPage({content: [], totalElements: 0, totalPages: 0, page: this.page(), size: this.size})
		});
	}

	onPageChanged(event: PageChangedEvent): void {
		// the control re-emits its own page when totalItems settles, ignore it
		const target = event.page - 1;
		if (target === this.page()) {
			return;
		}
		this.page.set(target);
		this.load();
	}

	canCancel(order: Order): boolean {
		return order.status === 'PENDING';
	}

	onCancel(order: Order): void {
		if (this.cancelling() !== null) {
			return;
		}
		this.cancelling.set(order.id);
		this.orderService.cancel(order.id).subscribe({
			next: updated => {
				this.cancelling.set(null);
				this.orders.update(list => list.map(candidate => candidate.id === updated.id ? updated : candidate));
				this.toast.success(this.translate.instant('INFO.ORDER_CANCELLED'));
			},
			error: () => {
				this.cancelling.set(null);
				this.toast.danger(this.translate.instant('INFO.ORDER_CANCEL_FAILED'));
			}
		});
	}

	statusBadge(status: string): string {
		switch (status) {
			case 'PENDING':
				return 'badge text-bg-warning';
			case 'PAID':
				return 'badge text-bg-primary';
			case 'SHIPPED':
				return 'badge text-bg-info';
			case 'COMPLETED':
				return 'badge text-bg-success';
			default:
				return 'badge text-bg-secondary';
		}
	}

	private applyPage(data: Page<Order>): void {
		this.orders.set(data.content ?? []);
		this.totalElements.set(data.totalElements);
		this.totalPages.set(data.totalPages);
	}
}
