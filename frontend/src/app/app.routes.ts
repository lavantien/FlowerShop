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
		path: 'contact',
		title: 'Contact',
		loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent)
	},
	{
		path: 'admin',
		title: 'Admin',
		canActivate: [adminGuard],
		loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
	},
	{
		path: 'info',
		title: 'Info',
		canActivate: [authGuard],
		loadComponent: () => import('./info/info.component').then(m => m.InfoComponent)
	},
	{
		path: 'summary',
		title: 'Summary',
		canActivate: [adminGuard],
		loadComponent: () => import('./summary/summary.component').then(m => m.SummaryComponent)
	},
	{
		path: '**',
		title: 'Not found',
		loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent)
	}
];
