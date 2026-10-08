import {Component, OnInit, computed, inject, signal, viewChild} from '@angular/core';
import {CurrencyPipe, DatePipe} from '@angular/common';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faBan, faCheck, faChevronDown, faChevronUp, faTruck} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {PageChangedEvent, PaginationComponent} from 'ngx-bootstrap/pagination';
import {OrderService} from '../../services/order.service';
import {ToastService} from '../../core/toast.service';
import {Order, OrderStatus, Page} from '../../models';

const STATUS_OPTIONS: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
const TERMINAL: OrderStatus[] = ['COMPLETED', 'CANCELLED'];
const PAGE_SIZE = 12;

@Component({
	selector: 'app-admin-orders',
	imports: [CurrencyPipe, DatePipe, TranslatePipe, FaIconComponent, TooltipDirective, PaginationComponent],
	templateUrl: './orders.component.html',
	styleUrls: ['./orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
	readonly faTruck = faTruck;
	readonly faCheck = faCheck;
	readonly faBan = faBan;
	readonly faChevronDown = faChevronDown;
	readonly faChevronUp = faChevronUp;
	readonly statusOptions = STATUS_OPTIONS;
	readonly maxSize = 3;

	readonly page = signal(0);
	readonly status = signal<'' | OrderStatus>('');
	readonly from = signal('');
	readonly to = signal('');
	readonly content = signal<Order[]>([]);
	readonly totalElements = signal(0);
	readonly totalPages = signal(0);
	readonly expanded = signal<ReadonlySet<number>>(new Set());
	readonly busy = signal<number | null>(null);

	readonly pagination = viewChild(PaginationComponent);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');

	private readonly orderService = inject(OrderService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		const status = this.status();
		const from = this.from();
		const to = this.to();
		this.orderService.admin({
			status: status === '' ? undefined : status,
			from: from === '' ? undefined : from,
			to: to === '' ? undefined : to,
			page: this.page(),
			size: PAGE_SIZE
		}).subscribe({
			next: (data: Page<Order>) => this.applyPage(data),
			error: () => this.applyPage(null)
		});
	}

	onStatusChange(status: string): void {
		this.applyFilter(() => this.status.set(status as '' | OrderStatus));
	}

	onFromDateChange(value: string): void {
		this.applyFilter(() => this.from.set(value));
	}

	onToDateChange(value: string): void {
		this.applyFilter(() => this.to.set(value));
	}

	onPageChanged(event: PageChangedEvent): void {
		const target = event.page - 1;
		if (target === this.page()) {
			return;
		}
		this.page.set(target);
		this.load();
	}

	isExpanded(order: Order): boolean {
		return this.expanded().has(order.id);
	}

	toggleExpanded(order: Order): void {
		const next = new Set(this.expanded());
		if (next.has(order.id)) {
			next.delete(order.id);
		} else {
			next.add(order.id);
		}
		this.expanded.set(next);
	}

	forwardTargets(order: Order): OrderStatus[] {
		switch (order.status) {
			case 'PAID':
				return ['SHIPPED'];
			case 'SHIPPED':
				return ['COMPLETED'];
			default:
				return [];
		}
	}

	canCancel(order: Order): boolean {
		return !TERMINAL.includes(order.status);
	}

	onTransition(order: Order, status: OrderStatus): void {
		if (this.busy() !== null) {
			return;
		}
		this.busy.set(order.id);
		this.orderService.setStatus(order.id, status).subscribe({
			next: updated => this.applyMutation(updated, 'ADMIN.STATUS_UPDATED'),
			error: () => this.mutationFailed()
		});
	}

	onCancel(order: Order): void {
		if (this.busy() !== null) {
			return;
		}
		this.busy.set(order.id);
		this.orderService.cancel(order.id).subscribe({
			next: updated => this.applyMutation(updated, 'ADMIN.ORDER_CANCELLED'),
			error: () => this.mutationFailed()
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

	private applyMutation(updated: Order, messageKey: string): void {
		this.busy.set(null);
		this.content.update(list => list.map(candidate => candidate.id === updated.id ? updated : candidate));
		this.toast.success(this.translate.instant(messageKey));
	}

	private mutationFailed(): void {
		this.busy.set(null);
		this.toast.danger(this.translate.instant('ADMIN.ACTION_FAILED'));
	}

	private applyFilter(change: () => void): void {
		change();
		this.page.set(0);
		this.pagination()?.writeValue(1);
		this.load();
	}

	private applyPage(data: Page<Order> | null): void {
		this.content.set(data?.content ?? []);
		this.totalElements.set(data?.totalElements ?? 0);
		this.totalPages.set(data?.totalPages ?? 0);
		this.expanded.set(new Set());
	}
}
