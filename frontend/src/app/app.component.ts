import {Component, OnDestroy, OnInit, TemplateRef, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {
	faAnglesDown,
	faAnglesUp,
	faArrowLeft,
	faArrowRight,
	faChartLine,
	faHandshake,
	faMagnifyingGlass,
	faMinus,
	faPlus,
	faRightFromBracket,
	faRightToBracket,
	faShoppingCart,
	faStore,
	faUser,
	faWarehouse
} from '@fortawesome/free-solid-svg-icons';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {NgxSpinnerComponent} from 'ngx-spinner';
import {Subscription} from 'rxjs';
import {ToastContainerComponent} from './core/toast.component';
import {InputValidatorService} from './_services/input-validator.service';
import {SharedService} from './_services/shared.service';
import {SessionService} from './_services/session.service';
import {TokenService} from './_services/token.service';
import {DateFormatterService} from './_services/date-formatter.service';
import {Product} from './_models/product';
import {User} from './_models/user';
import {Bill} from './_models/bill';

@Component({
	selector: 'app-root',
	imports: [
		FormsModule,
		RouterOutlet,
		RouterLink,
		RouterLinkActive,
		TranslatePipe,
		FaIconComponent,
		TooltipDirective,
		NgxSpinnerComponent,
		ToastContainerComponent
	],
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
	isAdmin = signal(false);
	isLoggedIn = signal(false);
	faAnglesUp = faAnglesUp;
	faAnglesDown = faAnglesDown;
	faArrowLeft = faArrowLeft;
	faArrowRight = faArrowRight;
	faStore = faStore;
	faUser = faUser;
	faWarehouse = faWarehouse;
	faHandshake = faHandshake;
	faMagnifyingGlass = faMagnifyingGlass;
	faRightToBracket = faRightToBracket;
	faRightFromBracket = faRightFromBracket;
	faChartLine = faChartLine;
	faShoppingCart = faShoppingCart;
	faMinus = faMinus;
	faPlus = faPlus;
	modalRef!: BsModalRef;
	modalRef2!: BsModalRef;
	loginForm = {
		email: '',
		password: ''
	};
	signUpForm = {
		name: '',
		email: '',
		reEmail: '',
		password: '',
		rePassword: '',
		answer: '',
		reAnswer: '',
		phone: '',
		address: '',
		district: 'Bình Thạnh',
		city: 'Hồ Chí Minh'
	};
	forgotPasswordForm = {
		email: '',
		answer: '',
		password: '',
		rePassword: ''
	};
	cartForm = {
		phone: '',
		address: '',
		district: 'Bình Thạnh',
		city: 'Hồ Chí Minh'
	};
	cities = signal<City[]>([]);
	districts = signal<District[]>([]);
	bgPrimary = signal('');
	tcPrimary = signal('');
	displayBg = 'LIGHT';
	displayBgs = ['LIGHT', 'BLUE', 'GRAY', 'GREEN', 'RED', 'YELLOW', 'TEAL', 'BLACK', 'WHITE', 'TRANS'];
	bgs = ['bg-light', 'bg-primary', 'bg-secondary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark', 'bg-white', 'bg-transparent'];
	tcs = ['text-dark', 'text-white', 'text-white', 'text-white', 'text-white', 'text-dark', 'text-white', 'text-white', 'text-dark', 'text-dark'];
	addedProducts = signal<Product[]>([]);
	countOfIndividualProduct = signal<number[]>([]);
	totalPriceOfIndividualProduct = signal<number[]>([]);
	countAddedProduct = signal(0);
	totalPriceOfAddedProduct = signal(0);
	wrongLogin = false;
	wrongCreate = false;
	wrongForgot = false;
	translate_CREATE_USER_SUCCESSFUL = signal('');
	translate_RESET_PASSWORD_FAILED = signal('');
	translate_RESET_PASSWORD_SUCCESSFUL = signal('');
	translate_ORDER_SUCCESSFUL = signal('');

	private readonly http = inject(HttpClient);
	private readonly router = inject(Router);
	private readonly modalService = inject(BsModalService);
	private readonly inputValidator = inject(InputValidatorService);
	private readonly sharedService = inject(SharedService);
	private readonly sessionService = inject(SessionService);
	private readonly tokenService = inject(TokenService);
	private readonly dateFormatter = inject(DateFormatterService);
	readonly translate = inject(TranslateService);
	private readonly subscriptions = new Subscription();

	constructor() {
		this.translate.addLangs(['en', 'vi']);
		const browserLang = this.translate.getBrowserLang() ?? 'en';
		this.translate.use(browserLang.match(/en|vi/) ? browserLang : 'en');
		this.subscriptions.add(this.sharedService.getGlobalBackgroundPrimary().subscribe(bg => {
			this.bgPrimary.set(bg[0]);
			this.tcPrimary.set(bg[1]);
		}));
		this.subscriptions.add(this.sessionService.getNewlyAddedProduct().subscribe(product => {
			if (product) {
				const prodIndex = this.addedProducts().findIndex(x => x.id === product.id);
				if (prodIndex === -1) {
					this.addedProducts.update(products => [...products, product]);
					this.countOfIndividualProduct.update(counts => [...counts, 1]);
					this.totalPriceOfIndividualProduct.update(prices => [...prices, product.price]);
					this.countAddedProduct.update(count => count + 1);
				} else {
					this.countOfIndividualProduct.update(counts => counts.map((count, i) => i === prodIndex ? count + 1 : count));
					this.totalPriceOfIndividualProduct.update(prices => prices.map((price, i) => i === prodIndex ? price + product.price : price));
				}
				this.totalPriceOfAddedProduct.update(total => total + product.price);
			} else {
				this.countAddedProduct.set(0);
			}
		}));
		this.subscriptions.add(this.translate.stream('ALERT.CREATE_USER_SUCCESSFUL').subscribe(rs => {
			this.translate_CREATE_USER_SUCCESSFUL.set(rs);
		}));
		this.subscriptions.add(this.translate.stream('ALERT.RESET_PASSWORD_FAILED').subscribe(rs => {
			this.translate_RESET_PASSWORD_FAILED.set(rs);
		}));
		this.subscriptions.add(this.translate.stream('ALERT.RESET_PASSWORD_SUCCESSFUL').subscribe(rs => {
			this.translate_RESET_PASSWORD_SUCCESSFUL.set(rs);
		}));
		this.subscriptions.add(this.translate.stream('ALERT.ORDER_SUCCESSFUL').subscribe(rs => {
			this.translate_ORDER_SUCCESSFUL.set(rs);
		}));
		if (!localStorage.getItem('token')) {
			localStorage.setItem('token', btoa('0+GUESS'));
			localStorage.setItem('phone', '0');
			localStorage.setItem('detailAddress', 'A, Bình Thạnh, Hồ Chí Minh');
		}
	}

	ngOnInit() {
		this.getCities();
		this.getDistricts();
		this.isLoggedIn.set(this.tokenService.isLoggedIn());
		this.isAdmin.set(this.tokenService.isAdmin());
		if (this.isAdmin()) {
			this.router.navigate(['/admin']);
		}
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	getCities() {
		this.http.get<City[]>('../assets/data/cities.json').subscribe(data => {
			if (data) {
				this.cities.set(data);
				this.signUpForm.city = this.cities()[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.cities.set([]);
			this.signUpForm.city = '';
		}, () => {
		});
	}

	getDistricts() {
		this.http.get<District[]>('../assets/data/districts.json').subscribe(data => {
			if (data) {
				this.districts.set(data);
				this.signUpForm.district = this.districts()[0].name;
			}
		}, error => {
			console.log(`Error: ${error}`);
			this.districts.set([]);
			this.signUpForm.district = '';
		}, () => {
		});
	}

	onChangeThemeColor() {
		this.sharedService.updateGlobalBackgroundPrimary([this.bgs[this.displayBgs.findIndex(x => x === this.displayBg)], this.tcs[this.displayBgs.findIndex(x => x === this.displayBg)]]);
	}

	openLoginModal(template: TemplateRef<void>) {
		this.modalRef = this.modalService.show(template);
	}

	// btoa throws on anything outside Latin1, so passwords with Vietnamese or
	// emoji would crash the login click; encode the UTF-8 bytes instead.
	private toBase64Utf8(value: string): string {
		return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
	}

	onLogin() {
		if (!this.inputValidator.isEmail(this.loginForm.email) || !this.inputValidator.isPassword(this.loginForm.password)) {
			this.wrongLogin = true;
			this.onRefreshLoginForm();
			return;
		}
		this.wrongLogin = false;
		this.http.post<TokenDto>('/api/user/login', this.toBase64Utf8(this.loginForm.email + 'j0z' + this.loginForm.password), {headers: new HttpHeaders({'Content-Type': 'text/plain'})}).subscribe((rs) => {
			localStorage.removeItem('token');
			localStorage.setItem('token', rs.token);
			localStorage.removeItem('phone');
			localStorage.setItem('phone', rs.phone);
			localStorage.removeItem('detailAddress');
			localStorage.setItem('detailAddress', rs.detailAddress);
			this.isLoggedIn.set(true);
			this.isAdmin.set(this.tokenService.isAdmin());
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
			this.modalRef.hide();
		});
	}

	onLogout() {
		const tokenDto: TokenDto = {
			token: localStorage.getItem('token') ?? '',
			phone: localStorage.getItem('phone') ?? '',
			detailAddress: localStorage.getItem('detailAddress') ?? ''
		};
		this.http.post<TokenDto>('/api/user/logout', tokenDto).subscribe((rs) => {
			localStorage.removeItem('token');
			localStorage.setItem('token', rs.token);
			localStorage.removeItem('phone');
			localStorage.setItem('phone', rs.phone);
			localStorage.removeItem('detailAddress');
			localStorage.setItem('detailAddress', rs.detailAddress);
			this.isLoggedIn.set(false);
			this.isAdmin.set(false);
			this.router.navigate(['/shop']);
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
		});
	}

	openSignUpModal(template: TemplateRef<void>) {
		this.modalRef2 = this.modalService.show(template);
	}

	onCreateUser() {
		if (!this.inputValidator.isEmail(this.signUpForm.email) || !this.inputValidator.isPassword(this.signUpForm.password) || this.signUpForm.password !== this.signUpForm.rePassword || this.signUpForm.email !== this.signUpForm.reEmail || this.signUpForm.answer !== this.signUpForm.reAnswer) {
			this.wrongCreate = true;
			this.onRefreshSignUpForm();
			return;
		}
		this.wrongCreate = false;
		this.http.post<User>('/api/user/create', this.signUpForm).subscribe(() => {
			alert(this.translate_CREATE_USER_SUCCESSFUL());
			this.loginForm.email = this.signUpForm.email;
			this.loginForm.password = this.signUpForm.password;
			this.onLogin();
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
			this.modalRef2.hide();
		});
	}

	openForgotPasswordModal(template: TemplateRef<void>) {
		this.modalRef2 = this.modalService.show(template);
	}

	onVerify() {
		if (!this.inputValidator.isEmail(this.forgotPasswordForm.email) || !this.inputValidator.isPassword(this.forgotPasswordForm.password) || this.forgotPasswordForm.password !== this.forgotPasswordForm.rePassword) {
			this.wrongForgot = true;
			this.onRefreshForgotPasswordForm();
			return;
		}
		this.wrongForgot = false;
		this.http.post<TokenDto>('/api/user/resetPassword', this.forgotPasswordForm).subscribe((rs) => {
			if (atob(rs.token) === '0+GUESS') {
				alert(this.translate_RESET_PASSWORD_FAILED());
			} else {
				alert(this.translate_RESET_PASSWORD_SUCCESSFUL());
				this.loginForm.email = this.forgotPasswordForm.email;
				this.loginForm.password = this.forgotPasswordForm.password;
				this.onLogin();
			}
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
			this.modalRef2.hide();
		});
	}

	openCartModal(template: TemplateRef<void>) {
		this.cartForm.phone = localStorage.getItem('phone') ?? '';
		const detailAddress = localStorage.getItem('detailAddress') ?? '';
		const endAddress = detailAddress.indexOf(', ');
		const endDistrict = detailAddress.lastIndexOf(', ');
		this.cartForm.address = detailAddress.substring(0, endAddress);
		this.cartForm.district = detailAddress.substring(endAddress + 2, endDistrict);
		this.cartForm.city = detailAddress.substring(endDistrict + 2);
		this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
	}

	cancelAndDecreaseItem(index: number) {
		if (index === -1) {
			this.totalPriceOfAddedProduct.set(0);
			this.countAddedProduct.set(0);
			this.addedProducts.set([]);
			this.countOfIndividualProduct.set([]);
			this.totalPriceOfIndividualProduct.set([]);
			return;
		}
		this.totalPriceOfAddedProduct.update(total => total - this.addedProducts()[index].price);
		if (this.countOfIndividualProduct()[index] === 1) {
			this.addedProducts.update(products => products.filter((product, i) => i !== index));
			this.countOfIndividualProduct.update(counts => counts.filter((count, i) => i !== index));
			this.totalPriceOfIndividualProduct.update(prices => prices.filter((price, i) => i !== index));
			this.countAddedProduct.update(count => count - 1);
		} else {
			this.countOfIndividualProduct.update(counts => counts.map((count, i) => i === index ? count - 1 : count));
			this.totalPriceOfIndividualProduct.update(prices => prices.map((price, i) => i === index ? price - this.addedProducts()[index].price : price));
		}
	}

	increaseItem(index: number) {
		this.countOfIndividualProduct.update(counts => counts.map((count, i) => i === index ? count + 1 : count));
		this.totalPriceOfIndividualProduct.update(prices => prices.map((price, i) => i === index ? price + this.addedProducts()[index].price : price));
		this.totalPriceOfAddedProduct.update(total => total + this.addedProducts()[index].price);
	}

	onSettle() {
		const bills: Bill[] = [];
		const today = new Date();
		const todayStr = this.dateFormatter.formatLocalDateTime(today);
		const userId = this.tokenService.userId();
		for (let i = 0; i < this.addedProducts().length; ++i) {
			const bill: Bill = {
				placementDate: todayStr,
				productId: this.addedProducts()[i].id,
				productQuantity: this.countOfIndividualProduct()[i],
				price: Math.ceil(this.totalPriceOfIndividualProduct()[i]),
				userId: userId,
				settlementDate: todayStr,
				status: 'SUCCESS',
				phone: this.cartForm.phone,
				detailAddress: this.cartForm.address + ', ' + this.cartForm.district + ', ' + this.cartForm.city
			};
			bills.push(bill);
		}
		this.http.post<Bill[]>('/api/bill', bills).subscribe(() => {
			alert(this.translate_ORDER_SUCCESSFUL());
		}, error => {
			console.log(`Error: ${error}`);
		}, () => {
			this.modalRef.hide();
		});
	}

	onRefreshLoginForm() {
		this.loginForm = {
			email: '',
			password: ''
		};
	}

	onRefreshSignUpForm() {
		this.signUpForm = {
			name: '',
			email: '',
			reEmail: '',
			password: '',
			rePassword: '',
			answer: '',
			reAnswer: '',
			phone: '',
			address: '',
			district: 'Bình Thạnh',
			city: 'Hồ Chí Minh'
		};
	}

	onRefreshForgotPasswordForm() {
		this.forgotPasswordForm = {
			email: '',
			answer: '',
			password: '',
			rePassword: ''
		};
	}

	scrollTop() {
		window.scrollTo(0, 0);
	}

	scrollBottom() {
		window.scrollTo(0, document.body.scrollHeight);
	}

	scrollLeft() {
		window.scrollTo(0, window.pageYOffset);
	}

	scrollRight() {
		window.scrollTo(document.body.scrollWidth, window.pageYOffset);
	}
}

interface City {
	name: string;
}

interface District {
	name: string;
	cityName: string;
}

interface TokenDto {
	token: string;
	phone: string;
	detailAddress: string;
}
