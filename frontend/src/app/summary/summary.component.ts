import {Component, OnInit, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {DataTranslateService} from '../_services/data-translate.service';
import {TokenService} from '../_services/token.service';
import {Product} from '../_models/product';
import {Bill} from '../_models/bill';

@Component({
	selector: 'app-summary',
	imports: [
		TranslatePipe
	],
	templateUrl: './summary.component.html',
	styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit {
	isAdmin = false;
	isLoggedIn = false;
	products = signal<Product[]>([]);
	billsRender = signal<Product[]>([]);
	userIds = signal<number[]>([]);
	countOfIndividualProduct = signal<number[]>([]);
	totalPriceOfIndividualProduct = signal<number[]>([]);
	totalPriceOfAddedProduct = signal(0);
	settlementDate = signal<string[]>([]);

	private readonly http = inject(HttpClient);
	private readonly router = inject(Router);
	private readonly dataTranslateService = inject(DataTranslateService);
	private readonly tokenService = inject(TokenService);
	readonly translate = inject(TranslateService);

	ngOnInit() {
		this.isLoggedIn = this.tokenService.isLoggedIn();
		this.isAdmin = this.tokenService.isAdmin();
		if (!this.isLoggedIn) {
			this.router.navigate(['/shop']);
		}
		this.getProducts();
	}

	getProducts() {
		this.http.get<Product[]>('/api/product').subscribe(products => {
			if (products) {
				this.products.set(products);
				this.products().forEach(product => {
					product.imgUrl = product.imgUrl ? atob(product.imgUrl) : '';
					product.price = this.dataTranslateService.getPrice(product.price, 'vi');
				});
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.products.set([]);
		}, () => {
			this.getBills();
		});
	}

	getBills() {
		this.http.get<Bill[]>('/api/bill').subscribe(rs => {
			if (rs) {
				rs.forEach(item => {
					this.billsRender.update(bills => [...bills, this.products()[this.products().findIndex(x => x.id === item.productId)]]);
					this.countOfIndividualProduct.update(counts => [...counts, item.productQuantity]);
					this.totalPriceOfIndividualProduct.update(prices => [...prices, item.price]);
					this.totalPriceOfAddedProduct.update(total => total + item.price);
					this.settlementDate.update(dates => [...dates, item.settlementDate]);
					this.userIds.update(ids => [...ids, item.userId]);
				});
			}
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}
}
