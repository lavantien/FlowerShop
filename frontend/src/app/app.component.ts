import {Component, inject} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {
	faChartLine,
	faHandshake,
	faRightFromBracket,
	faRightToBracket,
	faShoppingCart,
	faStore,
	faUser,
	faWarehouse
} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {NgxSpinnerComponent} from 'ngx-spinner';
import {AuthService} from './core/auth.service';
import {CartService} from './core/cart.service';
import {SessionService} from './core/session.service';
import {ToastContainerComponent} from './core/toast.component';
import {AuthModalComponent} from './shared/auth-modal/auth-modal.component';

@Component({
	selector: 'app-root',
	imports: [
		RouterOutlet,
		RouterLink,
		RouterLinkActive,
		TranslatePipe,
		FaIconComponent,
		TooltipDirective,
		NgxSpinnerComponent,
		ToastContainerComponent,
		AuthModalComponent
	],
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {
	readonly faStore = faStore;
	readonly faUser = faUser;
	readonly faWarehouse = faWarehouse;
	readonly faHandshake = faHandshake;
	readonly faRightToBracket = faRightToBracket;
	readonly faRightFromBracket = faRightFromBracket;
	readonly faChartLine = faChartLine;
	readonly faShoppingCart = faShoppingCart;

	private readonly auth = inject(AuthService);
	private readonly cart = inject(CartService);
	private readonly router = inject(Router);

	readonly session = inject(SessionService);
	readonly translate = inject(TranslateService);
	readonly isLoggedIn = this.session.isLoggedIn;
	readonly isAdmin = this.session.isAdmin;
	readonly cartCount = this.cart.count;

	constructor() {
		this.translate.addLangs(['en', 'vi']);
		const browserLang = this.translate.getBrowserLang() ?? 'en';
		this.translate.use(browserLang.match(/en|vi/) ? browserLang : 'en');
	}

	onLogout(): void {
		this.auth.logout().subscribe({next: () => this.router.navigate(['/shop'])});
	}
}
