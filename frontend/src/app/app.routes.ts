import {Routes} from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'shop',
		pathMatch: 'full'
	},
	{path: 'test', loadComponent: () => import('./test/test.component').then(m => m.TestComponent)},
	{path: 'shop', loadComponent: () => import('./store/store.component').then(m => m.StoreComponent)},
	{path: 'contact', loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent)},
	{path: 'admin', loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)},
	{path: 'info', loadComponent: () => import('./info/info.component').then(m => m.InfoComponent)},
	{path: 'summary', loadComponent: () => import('./summary/summary.component').then(m => m.SummaryComponent)}
];
