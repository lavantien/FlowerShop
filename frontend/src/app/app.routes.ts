import {Routes} from '@angular/router';
import {adminGuard} from './core/admin.guard';
import {authGuard} from './core/auth.guard';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'shop',
		pathMatch: 'full'
	},
	{
		path: 'shop',
		title: 'Shop',
		loadComponent: () => import('./store/store.component').then(m => m.StoreComponent)
	},
	{
		path: 'cart',
		title: 'Cart',
		canActivate: [authGuard],
		loadComponent: () => import('./cart/cart.component').then(m => m.CartComponent)
	},
	{
		path: 'contact',
		title: 'Contact',
		loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent)
	},
	{
		path: 'pay/:paymentId',
		title: 'Pay',
		loadComponent: () => import('./pay/pay.component').then(m => m.PayComponent)
	},
	{
		path: 'admin',
		title: 'Admin',
		canActivate: [adminGuard],
		loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent),
		children: [
			{path: '', pathMatch: 'full', redirectTo: 'products'},
			{
				path: 'products',
				title: 'Products',
				loadComponent: () => import('./admin/products/products.component').then(m => m.ProductsComponent)
			},
			{
				path: 'orders',
				title: 'Orders',
				loadComponent: () => import('./admin/orders/orders.component').then(m => m.AdminOrdersComponent)
			},
			{
				path: 'users',
				title: 'Users',
				loadComponent: () => import('./admin/users/users.component').then(m => m.AdminUsersComponent)
			},
			{
				path: 'taxonomy',
				title: 'Taxonomy',
				loadComponent: () => import('./admin/taxonomy/taxonomy.component').then(m => m.AdminTaxonomyComponent)
			},
			{
				path: 'coupons',
				title: 'Coupons',
				loadComponent: () => import('./admin/coupons/coupons.component').then(m => m.AdminCouponsComponent)
			},
			{
				path: 'branches',
				title: 'Branches',
				loadComponent: () => import('./admin/branches/branches.component').then(m => m.AdminBranchesComponent)
			},
			{
				path: 'dashboard',
				title: 'Dashboard',
				loadComponent: () => import('./admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
			}
		]
	},
	{
		path: 'info',
		title: 'Info',
		canActivate: [authGuard],
		loadComponent: () => import('./info/info.component').then(m => m.InfoComponent),
		children: [
			{path: '', pathMatch: 'full', redirectTo: 'orders'},
			{
				path: 'profile',
				title: 'Profile',
				loadComponent: () => import('./info/profile/profile.component').then(m => m.ProfileComponent)
			},
			{
				path: 'orders',
				title: 'Orders',
				loadComponent: () => import('./info/orders/orders.component').then(m => m.OrdersComponent)
			},
			{
				path: 'wishlist',
				title: 'Wishlist',
				loadComponent: () => import('./info/wishlist/wishlist.component').then(m => m.WishlistComponent)
			}
		]
	},
	{
		path: '**',
		title: 'Not found',
		loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent)
	}
];
