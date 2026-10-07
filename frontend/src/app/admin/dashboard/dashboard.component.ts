import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {ReportService} from '../../services/report.service';
import {OrderStatus, RevenueByDay, SalesReport, TopProduct} from '../../models';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

interface Bar {
	label: string;
	value: number;
	share: number;
}

function barsOf(rows: {label: string; value: number}[]): Bar[] {
	const max = Math.max(...rows.map(row => row.value), 0);
	return rows.map(row => ({...row, share: max === 0 ? 0 : (row.value / max) * 100}));
}

@Component({
	selector: 'app-admin-dashboard',
	imports: [CurrencyPipe, TranslatePipe],
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
	readonly from = signal('');
	readonly to = signal('');
	readonly report = signal<SalesReport | null>(null);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');
	readonly statuses = STATUSES;
	readonly revenueBars = computed(() => barsOf(
		this.dayRows().map(row => ({label: row.day, value: row.revenue}))
	));
	readonly statusBars = computed(() => barsOf(
		STATUSES.map(status => ({label: status, value: this.report()?.countsByStatus?.[status] ?? 0}))
	));
	readonly productBars = computed(() => barsOf(
		this.topRows().map(row => ({label: row.name, value: row.quantity}))
	));

	private readonly reportService = inject(ReportService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		const from = this.from();
		const to = this.to();
		this.reportService.sales({
			from: from === '' ? undefined : from,
			to: to === '' ? undefined : to
		}).subscribe({
			next: data => this.report.set(data),
			error: () => this.report.set(null)
		});
	}

	onFromChange(value: string): void {
		this.from.set(value);
		this.load();
	}

	onToChange(value: string): void {
		this.to.set(value);
		this.load();
	}

	countFor(status: OrderStatus): number {
		return this.report()?.countsByStatus?.[status] ?? 0;
	}

	private dayRows(): RevenueByDay[] {
		return this.report()?.revenueByDay ?? [];
	}

	private topRows(): TopProduct[] {
		return this.report()?.topProducts ?? [];
	}
}
