import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {AdminTaxonomyComponent} from './taxonomy.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {Category, Type} from '../../models';

const admin: SessionUser = {
	id: 1,
	name: 'Admin',
	email: 'admin@flowershop.example',
	phone: '0900000001',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'ADMIN',
	enable: true
};

const categories: Category[] = [{id: 1, name: 'Fresh'}, {id: 2, name: 'Pot'}];
const types: Type[] = [
	{id: 1, name: 'Daily', categoryName: 'Fresh'},
	{id: 2, name: 'Event', categoryName: 'Pot'}
];

describe('AdminTaxonomyComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminTaxonomyComponent>;
	let component: AdminTaxonomyComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminTaxonomyComponent],
			providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminTaxonomyComponent);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			localStorage.clear();
		}
	});

	function mount(lists: {categories?: Category[]; types?: Type[]} = {}): void {
		fixture.detectChanges();
		httpMock.expectOne('/api/category').flush(lists.categories ?? categories);
		httpMock.expectOne('/api/type').flush(lists.types ?? types);
		fixture.detectChanges();
	}

	function reload(): void {
		httpMock.expectOne('/api/category').flush(categories);
		httpMock.expectOne('/api/type').flush(types);
		fixture.detectChanges();
	}

	it('loads both sections', () => {
		mount();
		const element = fixture.nativeElement as HTMLElement;
		expect(component.categories().length).toBe(2);
		expect(component.types().length).toBe(2);
		expect(element.querySelectorAll('[data-test="admin-category-delete"]').length).toBe(2);
		expect(element.querySelectorAll('[data-test="admin-type-delete"]').length).toBe(2);
	});

	it('shows the empty states when the api fails', () => {
		fixture.detectChanges();
		httpMock.expectOne('/api/category').flush('boom', {status: 500, statusText: 'Server Error'});
		httpMock.expectOne('/api/type').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		const element = fixture.nativeElement as HTMLElement;
		expect(element.textContent).toContain('ADMIN.NO_CATEGORIES');
		expect(element.textContent).toContain('ADMIN.NO_TYPES');
	});

	it('creates a category through the create endpoint', () => {
		const success = vi.spyOn(toast, 'success');
		mount();
		const input = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-name"]') as HTMLInputElement;
		input.value = 'Dried';
		input.dispatchEvent(new Event('input', {bubbles: true}));
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/category/create');
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({name: 'Dried'});
		request.flush({id: 3, name: 'Dried'});
		reload();
		expect(component.categoryForm.controls.name.value).toBe('');
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('refuses to submit an empty category name', () => {
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-save"]') as HTMLButtonElement).click();
		expect(httpMock.match(req => req.method === 'POST').length).toBe(0);
	});

	it('edits a category through the row id', () => {
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-edit"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(component.editCategoryId()).toBe(1);
		expect(component.categoryForm.controls.name.value).toBe('Fresh');
		const input = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-name"]') as HTMLInputElement;
		input.value = 'Greener';
		input.dispatchEvent(new Event('input', {bubbles: true}));
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/category/1');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body).toEqual({name: 'Greener'});
		request.flush({id: 1, name: 'Greener'});
		reload();
		expect(component.editCategoryId()).toBeNull();
	});

	it('surfaces a name-in-use 409 as the name toast', () => {
		const danger = vi.spyOn(toast, 'danger');
		mount();
		const input = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-name"]') as HTMLInputElement;
		input.value = 'Fresh';
		input.dispatchEvent(new Event('input', {bubbles: true}));
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-save"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/category/create').flush(
			{title: 'Conflict', status: 409, code: 'NAME_IN_USE'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.categoryForm.controls.name.value).toBe('Fresh');
	});

	it('creates a type with its category binding', () => {
		const success = vi.spyOn(toast, 'success');
		mount();
		const nameInput = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-type-name"]') as HTMLInputElement;
		nameInput.value = 'Weekly';
		nameInput.dispatchEvent(new Event('input', {bubbles: true}));
		const categorySelect = (fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-type-category"]') as HTMLSelectElement;
		categorySelect.value = 'Pot';
		categorySelect.dispatchEvent(new Event('change', {bubbles: true}));
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-type-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/type/create');
		expect(request.request.body).toEqual({name: 'Weekly', categoryName: 'Pot'});
		request.flush({id: 3, name: 'Weekly', categoryName: 'Pot'});
		reload();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('deletes a type and reports a referenced name 409', () => {
		const danger = vi.spyOn(toast, 'danger');
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-type-delete"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/type/1').flush(
			{title: 'Conflict', status: 409, code: 'NAME_IN_USE'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.NAME_IN_USE');
	});

	it('deletes a category and reloads both sections', () => {
		const success = vi.spyOn(toast, 'success');
		mount({categories: [{id: 1, name: 'Fresh'}], types: []});
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-category-delete"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/category/1').flush(null);
		reload();
		expect(success).toHaveBeenCalledTimes(1);
		expect(component.categories().length).toBe(2);
	});
});
