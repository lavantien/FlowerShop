import {ApplicationRef} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {AdminBranchesComponent} from './branches.component';
import {SessionService, SessionUser} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {Branch, Page, ProductView, StockRow} from '../../models';

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

function branch(id: number, name: string, active = true): Branch {
	return {
		id,
		name,
		address: `${name} address`,
		district: 'Bình Thạnh',
		city: 'Hồ Chí Minh',
		lat: 10.7769 + id,
		lng: 106.7009 + id,
		active
	};
}

function productView(id: number): ProductView {
	return {
		id,
		name: `Flower ${id}`,
		description: `flower ${id}`,
		imgUrl: `https://img/${id}`,
		price: 100000,
		typeName: 'Daily',
		categoryName: 'Fresh',
		stock: 0
	};
}

const branches: Branch[] = [branch(1, 'Quận 1'), branch(2, 'Bình Thạnh', false)];

describe('AdminBranchesComponent', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<AdminBranchesComponent>;
	let component: AdminBranchesComponent;
	let toast: ToastService;

	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({
			imports: [AdminBranchesComponent],
			providers: [
				provideNoopAnimations(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		toast = TestBed.inject(ToastService);
		TestBed.inject(SessionService).login('token-1', admin);
		fixture = TestBed.createComponent(AdminBranchesComponent);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			document.body.querySelectorAll('.modal, .modal-backdrop').forEach(node => node.remove());
			localStorage.clear();
		}
	});

	function mount(list: Branch[] = branches): void {
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Hồ Chí Minh'}]);
		httpMock.expectOne('../assets/data/districts.json').flush([
			{name: 'Bình Thạnh', cityName: 'Hồ Chí Minh'},
			{name: 'Quận 1', cityName: 'Hồ Chí Minh'}
		]);
		httpMock.expectOne('/api/branch').flush(list);
		fixture.detectChanges();
	}

	function reload(): void {
		httpMock.expectOne('/api/branch').flush(branches);
		fixture.detectChanges();
	}

	function tick() {
		TestBed.inject(ApplicationRef).tick();
	}

	function click(element: Element) {
		element.dispatchEvent(new Event('click', {bubbles: true}));
	}

	function lastModal(): HTMLElement {
		const modals = document.querySelectorAll('.modal-content');
		return modals[modals.length - 1] as HTMLElement;
	}

	function openStock(branch: Branch, rows: StockRow[] = [{productId: 1, quantity: 25}, {productId: 2, quantity: 0}], expectProducts = true): HTMLElement {
		const element = fixture.nativeElement as HTMLElement;
		const buttons = Array.from(element.querySelectorAll('[data-test="admin-branch-stock"]')) as HTMLButtonElement[];
		click(buttons[branches.indexOf(branch)]);
		tick();
		httpMock.expectOne(`/api/branch/${branch.id}/stock`).flush(rows);
		if (expectProducts) {
			httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET')
				.flush({
					content: [productView(1), productView(2)],
					totalElements: 2,
					totalPages: 1,
					page: 0,
					size: 48
				} as Page<ProductView>);
		}
		fixture.detectChanges();
		return lastModal();
	}

	it('loads the branch table', () => {
		mount();
		const element = fixture.nativeElement as HTMLElement;
		expect(component.branches().length).toBe(2);
		expect(element.textContent).toContain('Quận 1');
		expect(element.querySelectorAll('[data-test="admin-branch-stock"]').length).toBe(2);
	});

	it('shows the empty state when the api fails', () => {
		fixture.detectChanges();
		httpMock.expectOne('../assets/data/cities.json').flush([]);
		httpMock.expectOne('../assets/data/districts.json').flush([]);
		httpMock.expectOne('/api/branch').flush('boom', {status: 500, statusText: 'Server Error'});
		fixture.detectChanges();
		expect(component.branches()).toEqual([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_BRANCHES');
	});

	it('creates a branch from the form body', () => {
		const success = vi.spyOn(toast, 'success');
		mount();
		const element = fixture.nativeElement as HTMLElement;
		(element.querySelector('[data-test="admin-branch-name"]') as HTMLInputElement).value = 'Thủ Đức';
		element.querySelector('[data-test="admin-branch-name"]')!.dispatchEvent(new Event('input', {bubbles: true}));
		(element.querySelector('[data-test="admin-branch-address"]') as HTMLInputElement).value = 'Xa lộ Hà Nội';
		element.querySelector('[data-test="admin-branch-address"]')!.dispatchEvent(new Event('input', {bubbles: true}));
		const district = element.querySelector('[data-test="admin-branch-district"]') as HTMLSelectElement;
		district.value = 'Bình Thạnh';
		district.dispatchEvent(new Event('change', {bubbles: true}));
		const lat = element.querySelector('[data-test="admin-branch-lat"]') as HTMLInputElement;
		lat.value = '10.85';
		lat.dispatchEvent(new Event('input', {bubbles: true}));
		fixture.detectChanges();
		(element.querySelector('[data-test="admin-branch-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/branch');
		expect(request.request.method).toBe('POST');
		expect(request.request.body.name).toBe('Thủ Đức');
		expect(request.request.body.lat).toBe(10.85);
		expect(request.request.body.city).toBe('Hồ Chí Minh');
		request.flush(branch(3, 'Thủ Đức'));
		reload();
		expect(success).toHaveBeenCalledTimes(1);
		expect(component.form.controls.name.value).toBe('');
	});

	it('resets the district when the city changes', () => {
		mount();
		component.form.controls.city.setValue('Đà Nẵng');
		component.onCityChange();
		expect(component.formCity()).toBe('Đà Nẵng');
		expect(component.form.controls.district.value).toBe('');
	});

	it('edits a branch through the row id', () => {
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-edit"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(component.editId()).toBe(1);
		expect(component.form.controls.name.value).toBe('Quận 1');
		const lng = (fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-lng"]') as HTMLInputElement;
		lng.value = '106.72';
		lng.dispatchEvent(new Event('input', {bubbles: true}));
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-save"]') as HTMLButtonElement).click();
		const request = httpMock.expectOne('/api/branch/1');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body.lng).toBe(106.72);
		request.flush(branch(1, 'Quận 1'));
		reload();
		expect(component.editId()).toBeNull();
	});

	it('toasts when a branch save fails', () => {
		const danger = vi.spyOn(toast, 'danger');
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-edit"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-save"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/branch/1').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.saving()).toBe(false);
	});

	it('surfaces a stock rows 409 on delete as the has-stock toast', () => {
		const danger = vi.spyOn(toast, 'danger');
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-delete"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/branch/1').flush(
			{title: 'Conflict', status: 409, code: 'STOCK_ROWS_EXIST'},
			{status: 409, statusText: 'Conflict'}
		);
		expect(danger).toHaveBeenCalledTimes(1);
		expect(danger.mock.calls[0][0]).toBe('ADMIN.BRANCH_HAS_STOCK');
	});

	it('deletes a branch without stock', () => {
		const success = vi.spyOn(toast, 'success');
		mount();
		((fixture.nativeElement as HTMLElement).querySelector('[data-test="admin-branch-delete"]') as HTMLButtonElement).click();
		httpMock.expectOne('/api/branch/1').flush(null);
		reload();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('renders the stock editor with a row for every product', () => {
		mount();
		const modal = openStock(branches[0]);
		expect(component.stockBranch()?.id).toBe(1);
		expect(component.quantityFor(1)).toBe(25);
		expect(component.quantityFor(2)).toBe(0);
		expect(component.quantityFor(999)).toBe(0);
		const quantities = modal.querySelectorAll('[data-test="admin-stock-quantity"]') as NodeListOf<HTMLInputElement>;
		expect(quantities.length).toBe(2);
		expect((quantities[0] as HTMLInputElement).value).toBe('25');
		expect(modal.textContent).toContain('Flower 1');
		click(modal.querySelector('.btn-close') as Element);
	});

	it('sets absolute stock through the put endpoint from the modal', () => {
		const success = vi.spyOn(toast, 'success');
		mount();
		const modal = openStock(branches[0]);
		const quantities = modal.querySelectorAll('[data-test="admin-stock-quantity"]') as NodeListOf<HTMLInputElement>;
		quantities[0].value = '7';
		quantities[0].dispatchEvent(new Event('input', {bubbles: true}));
		click(modal.querySelector('[data-test="admin-stock-save"]') as Element);
		const request = httpMock.expectOne('/api/branch/1/stock');
		expect(request.request.method).toBe('PUT');
		expect(request.request.body).toEqual({productId: 1, quantity: 7});
		request.flush({productId: 1, quantity: 7} as StockRow);
		expect(component.quantityFor(1)).toBe(7);
		expect(component.stockSaving()).toBeNull();
		expect(success).toHaveBeenCalledTimes(1);
	});

	it('toasts when the stock put fails', () => {
		const danger = vi.spyOn(toast, 'danger');
		mount();
		const modal = openStock(branches[0]);
		click(modal.querySelector('[data-test="admin-stock-save"]') as Element);
		httpMock.expectOne('/api/branch/1/stock').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(danger).toHaveBeenCalledTimes(1);
		expect(component.stockSaving()).toBeNull();
	});

	it('appends a row when editing a product the backend omitted', () => {
		mount();
		const modal = openStock(branches[0], [{productId: 1, quantity: 25}]);
		const quantities = modal.querySelectorAll('[data-test="admin-stock-quantity"]') as NodeListOf<HTMLInputElement>;
		quantities[1].value = '3';
		quantities[1].dispatchEvent(new Event('input', {bubbles: true}));
		expect(component.stockRows().find(row => row.productId === 2)?.quantity).toBe(3);
		click(modal.querySelector('.btn-close') as Element);
	});

	it('reuses the loaded product list across stock editors', () => {
		mount();
		const modal = openStock(branches[0]);
		click(modal.querySelector('.btn-close') as Element);
		const second = openStock(branches[1], [{productId: 1, quantity: 5}], false);
		expect(httpMock.match(req => req.url === '/api/product').length).toBe(0);
		expect(component.quantityFor(1)).toBe(5);
		click(second.querySelector('.btn-close') as Element);
	});
});
