import {Component, OnInit, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {DataTranslateService} from '../_services/data-translate.service';
import {TokenService} from '../_services/token.service';
import {Product} from '../_models/product';
import {Bill} from '../_models/bill';
import {User} from '../_models/user';

@Component({
	selector: 'app-info',
	imports: [
		FormsModule,
		TranslatePipe
	],
	templateUrl: './info.component.html',
	styleUrls: ['./info.component.scss']
})
export class InfoComponent implements OnInit {
	isAdmin = false;
	isLoggedIn = false;
	user = signal<User>({
		name: 'GUESS',
		email: 'a@mail.com',
		password: 'abcxyz',
		answer: '112233',
		phone: '012',
		address: 'A',
		district: 'Bình Thạnh',
		city: 'Hồ Chí Minh'
	});
	products = signal<Product[]>([]);
	billsRender = signal<Product[]>([]);
	userId = 0;
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
		if (this.isAdmin) {
			this.router.navigate(['/admin']);
		}
		if (!this.isLoggedIn) {
			this.router.navigate(['/shop']);
		}
		this.userId = this.tokenService.userId();
		this.getUser();
		this.getProducts();
	}

	getUser() {
		if (this.userId === 0) {
			this.user.set({
				name: 'GUESS',
				email: 'a@mail.com',
				password: 'abcxyz',
				answer: '112233',
				phone: '012',
				address: 'A',
				district: 'Bình Thạnh',
				city: 'Hồ Chí Minh'
			});
		} else {
			this.http.get<User>(`api/user/${this.userId}`).subscribe(rs => {
				if (rs) {
					rs.address = localStorage.getItem('detailAddress') ?? '';
					this.user.set(rs);
				}
			}, error => {
				console.log(`Error: ${error}`);
			}, () => {
			});
		}
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
		this.http.get<Bill[]>(`/api/bill/user/${this.userId}`).subscribe(rs => {
			if (rs) {
				rs.forEach(item => {
					this.billsRender.update(bills => [...bills, this.products()[this.products().findIndex(x => x.id === item.productId)]]);
					this.countOfIndividualProduct.update(counts => [...counts, item.productQuantity]);
					this.totalPriceOfIndividualProduct.update(prices => [...prices, item.price]);
					this.totalPriceOfAddedProduct.update(total => total + item.price);
					this.settlementDate.update(dates => [...dates, item.settlementDate]);
				});
			}
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}
}
