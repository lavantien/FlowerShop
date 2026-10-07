import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {describe, expect, it} from 'vitest';
import {routes} from './app.routes';
import {appConfig} from './app.config';
import {StoreComponent} from './store/store.component';
import {CartComponent} from './cart/cart.component';
import {ContactComponent} from './contact/contact.component';
import {PayComponent} from './pay/pay.component';
import {AdminComponent} from './admin/admin.component';
import {ProductsComponent} from './admin/products/products.component';
import {AdminOrdersComponent} from './admin/orders/orders.component';
import {AdminUsersComponent} from './admin/users/users.component';
import {AdminTaxonomyComponent} from './admin/taxonomy/taxonomy.component';
import {AdminCouponsComponent} from './admin/coupons/coupons.component';
import {AdminBranchesComponent} from './admin/branches/branches.component';
import {AdminDashboardComponent} from './admin/dashboard/dashboard.component';
import {InfoComponent} from './info/info.component';
import {ProfileComponent} from './info/profile/profile.component';
import {OrdersComponent} from './info/orders/orders.component';
import {WishlistComponent} from './info/wishlist/wishlist.component';
import {NotFoundComponent} from './not-found/not-found.component';

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

describe('app routes', () => {
	it('redirects the empty path to the shop', () => {
		expect(routes[0]).toEqual({path: '', redirectTo: 'shop', pathMatch: 'full'});
	});

	it('lazy loads every routed component', async () => {
		const loaded = await Promise.all(routes.slice(1).map(route => route.loadComponent!()));
		expect(loaded).toEqual([
			StoreComponent,
			CartComponent,
			ContactComponent,
			PayComponent,
			AdminComponent,
			InfoComponent,
			NotFoundComponent
		]);
	});

	it('guards the member and admin surfaces', () => {
		const byPath = new Map(routes.map(route => [route.path, route]));
		expect(byPath.get('info')?.canActivate).toBeDefined();
		expect(byPath.get('cart')?.canActivate).toBeDefined();
		expect(byPath.get('admin')?.canActivate).toBeDefined();
		expect(byPath.get('shop')?.canActivate).toBeUndefined();
		expect(byPath.get('pay/:paymentId')?.canActivate).toBeUndefined();
	});

	it('falls back to the wildcard not found route', () => {
		expect(routes[routes.length - 1].path).toBe('**');
	});

	it('splits the info surface into profile, orders, and wishlist children', async () => {
		const byPath = new Map(routes.map(route => [route.path, route]));
		const info = byPath.get('info');
		expect(info?.children?.length).toBe(4);
		expect(info?.children?.[0]).toEqual({path: '', pathMatch: 'full', redirectTo: 'orders'});
		const loaded = await Promise.all(info!.children!.slice(1).map(child => child.loadComponent!()));
		expect(loaded).toEqual([ProfileComponent, OrdersComponent, WishlistComponent]);
	});

	it('splits the admin surface into guarded children starting at products', async () => {
		const byPath = new Map(routes.map(route => [route.path, route]));
		const adminRoute = byPath.get('admin');
		expect(adminRoute?.canActivate).toBeDefined();
		expect(adminRoute?.children?.length).toBe(8);
		expect(adminRoute?.children?.[0]).toEqual({path: '', pathMatch: 'full', redirectTo: 'products'});
		const loaded = await Promise.all(adminRoute!.children!.slice(1).map(child => child.loadComponent!()));
		expect(loaded).toEqual([
			ProductsComponent,
			AdminOrdersComponent,
			AdminUsersComponent,
			AdminTaxonomyComponent,
			AdminCouponsComponent,
			AdminBranchesComponent,
			AdminDashboardComponent
		]);
	});
});

describe('appConfig', () => {
	it('boots a component with its providers installed', () => {
		TestBed.configureTestingModule({
			imports: [EmptyComponent],
			providers: [
				appConfig.providers,
				provideRouter([{path: '**', component: EmptyComponent}]),
				provideTranslateService()
			]
		});
		const fixture = TestBed.createComponent(EmptyComponent);
		fixture.detectChanges();
		expect(appConfig.providers.length).toBeGreaterThan(0);
		TestBed.resetTestingModule();
	});
});
