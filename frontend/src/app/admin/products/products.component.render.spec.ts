import {ApplicationRef, Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeAll, beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import '../../locale';
import {ToastService} from '../../core/toast.service';
import {SessionService, SessionUser} from '../../core/session.service';
import {Page, ProductView} from '../../models';

vi.mock('xlsx', async importOriginal => {
	const actual = await importOriginal<typeof import('xlsx')>();
	return {...actual, writeFile: vi.fn()};
});

let XLSX: typeof import('xlsx');
let ProductsComponent: typeof import('./products.component').ProductsComponent;

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

function productView(id: number, name: string, price: number): ProductView {
	return {
		id,
		name,
		description: `flower ${id}`,
		imgUrl: 'https://img.example/rose.png',
		price,
		typeName: 'Daily',
		categoryName: 'Fresh',
		stock: 5 + id
	};
}

const products: ProductView[] = [
	productView(1, 'Rose', 1),
	productView(2, 'Tulip', 2),
	productView(3, 'Lily', 3),
	productView(4, 'Cactus', 4)
];
const categories = [{id: 1, name: 'Fresh'}];
const types = [
	{id: 1, name: 'Daily', categoryName: 'Fresh'},
	{id: 2, name: 'Event', categoryName: 'Pot'}
];

function pageOf(content: ProductView[], totalElements = content.length, totalPages = 1): Page<ProductView> {
	return {content, totalElements, totalPages, page: 0, size: 12};
}

function excelBinary(rows: object[]): string {
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Sheet1');
	return XLSX.write(workbook, {bookType: 'xlsx', type: 'binary'}) as string;
}

function excelFile(binary: string, name: string): File {
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; ++i) {
		bytes[i] = binary.charCodeAt(i) & 0xff;
	}
	return new File([bytes], name, {type: XLSX_MIME});
}

function attachFile(input: HTMLInputElement, file: File) {
	Object.defineProperty(input, 'files', {
		value: {length: 1, item: () => file, 0: file},
		configurable: true
	});
}

describe('ProductsComponent rendering', () => {
	let httpMock: HttpTestingController;
	let toastShow: ReturnType<typeof vi.spyOn>;
	let toastDanger: ReturnType<typeof vi.spyOn>;
	let fixture: ComponentFixture<InstanceType<typeof ProductsComponent>>;
	let writeFile: ReturnType<typeof vi.fn>;

	beforeAll(async () => {
		XLSX = await import('xlsx');
		({ProductsComponent} = await import('./products.component'));
	});

	beforeEach(() => {
		localStorage.clear();
		writeFile = XLSX.writeFile as unknown as ReturnType<typeof vi.fn>;
		writeFile.mockClear();
		TestBed.configureTestingModule({
			imports: [ProductsComponent],
			providers: [
				provideNoopAnimations(),
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([
					{path: 'shop', component: EmptyComponent},
					{path: 'admin', component: EmptyComponent}
				]),
				provideTranslateService()
			]
		});
		httpMock = TestBed.inject(HttpTestingController);
		TestBed.inject(SessionService).login('token-1', admin);
		const toast = TestBed.inject(ToastService);
		toastShow = vi.spyOn(toast, 'show');
		toastDanger = vi.spyOn(toast, 'danger');
	});

	afterEach(() => {
		try {
			httpMock.verify();
		} finally {
			TestBed.resetTestingModule();
			document.body.querySelectorAll('.modal, .modal-backdrop').forEach(node => node.remove());
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
			localStorage.clear();
		}
	});

	function flushBackend(pageData: Page<ProductView> | string, status = 200) {
		if (status === 200) {
			httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(pageData);
			httpMock.expectOne('/api/category').flush(categories);
			httpMock.expectOne('/api/type').flush(types);
		} else {
			httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET')
				.flush(pageData, {status, statusText: 'Server Error'});
			httpMock.expectOne('/api/category').flush('boom', {status, statusText: 'Server Error'});
			httpMock.expectOne('/api/type').flush('boom', {status, statusText: 'Server Error'});
		}
	}

	function mount(pageData: Page<ProductView> = pageOf(products)): ComponentFixture<InstanceType<typeof ProductsComponent>> {
		fixture = TestBed.createComponent(ProductsComponent);
		fixture.detectChanges();
		flushBackend(pageData);
		fixture.detectChanges();
		return fixture;
	}

	function tick() {
		TestBed.inject(ApplicationRef).tick();
	}

	function lastModal(): HTMLElement {
		const modals = document.querySelectorAll('.modal-content');
		return modals[modals.length - 1] as HTMLElement;
	}

	function openModal(click: () => void): HTMLElement {
		click();
		tick();
		return lastModal();
	}

	function click(element: Element) {
		element.dispatchEvent(new Event('click', {bubbles: true}));
	}

	function setInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
		input.value = value;
		input.dispatchEvent(new Event('input', {bubbles: true}));
	}

	it('loads the paged table with stock and empty signals on failure', () => {
		const component = mount().componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		expect(component.content().map(product => product.name)).toEqual(['Rose', 'Tulip', 'Lily', 'Cactus']);
		expect(element.querySelectorAll('[data-test="admin-products-edit"]').length).toBe(4);
		expect(element.textContent).toContain('6');

		fixture = TestBed.createComponent(ProductsComponent);
		fixture.detectChanges();
		flushBackend('boom', 500);
		fixture.detectChanges();
		const failed = fixture.componentInstance;
		expect(failed.content()).toEqual([]);
		expect(failed.categories()).toEqual([]);
		expect(failed.typesAll()).toEqual([]);
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('treats null catalogue payloads as empty', () => {
		fixture = TestBed.createComponent(ProductsComponent);
		fixture.detectChanges();
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(null);
		httpMock.expectOne('/api/category').flush(null);
		httpMock.expectOne('/api/type').flush(null);
		fixture.detectChanges();
		expect(fixture.componentInstance.content()).toEqual([]);
		expect(fixture.componentInstance.categories()).toEqual([]);
		expect(fixture.componentInstance.typesAll()).toEqual([]);
	});

	it('sends the search and filter values as catalog query params', () => {
		mount();
		const element: HTMLElement = fixture.nativeElement;
		const search = element.querySelector('[data-test="admin-products-search"]') as HTMLInputElement;
		setInput(search, 'flower 2');
		search.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
		tick();
		const searched = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET');
		expect(searched.request.params.get('search')).toBe('flower 2');
		expect(searched.request.params.get('page')).toBe('0');
		searched.flush(pageOf([productView(2, 'Tulip', 2)]));

		const categorySelect = element.querySelector('[data-test="admin-products-category"]') as HTMLSelectElement;
		categorySelect.value = 'Fresh';
		categorySelect.dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		const filtered = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET');
		expect(filtered.request.params.get('category')).toBe('Fresh');
		expect(filtered.request.params.get('search')).toBe('flower 2');
		filtered.flush(pageOf([]));
		tick();
		expect((fixture.nativeElement as HTMLElement).textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('toggles the name and price sorts through the server whitelist', () => {
		mount();
		const element: HTMLElement = fixture.nativeElement;
		const headers = element.querySelectorAll('th');
		click(headers[1]);
		tick();
		let request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET');
		expect(request.request.params.get('sort')).toBe('name-desc');
		request.flush(pageOf(products));
		click(headers[3]);
		tick();
		request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET');
		expect(request.request.params.get('sort')).toBe('price-asc');
		request.flush(pageOf(products));
		expect(fixture.componentInstance.sortDirection('name')).toBeNull();
	});

	it('moves across pages through the pagination control', () => {
		mount(pageOf(products, 26, 3));
		const pageButtons = (fixture.nativeElement as HTMLElement)
			.querySelectorAll('.pagination-page a') as NodeListOf<HTMLElement>;
		const pageTwo = Array.from(pageButtons).find(button => button.textContent?.trim() === '2');
		click(pageTwo as Element);
		tick();
		const request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET');
		expect(request.request.params.get('page')).toBe('1');
		request.flush(pageOf([productView(5, 'Orchid', 5)], 26, 3));
		expect(fixture.componentInstance.page()).toBe(1);
		expect(fixture.componentInstance.isSelected()).toEqual([false]);
	});

	it('opens the image lightbox from a row', () => {
		const component = mount().componentInstance;
		click((fixture.nativeElement as HTMLElement).querySelector('tbody img') as Element);
		tick();
		expect(component.lightboxProduct()?.name).toBe('Rose');
		expect(lastModal().textContent).toContain('Rose');
	});

	it('creates a product from the create modal', () => {
		mount();
		const modal = openModal(() => click((fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-products-create"]') as Element));
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		setInput(inputs[0], 'Rose');
		setInput(modal.querySelector('textarea') as HTMLTextAreaElement, 'red flower');
		setInput(inputs[1], '460000');
		setInput(inputs[2], 'https://example.com/rose.png');
		const selects = Array.from(modal.querySelectorAll('select')) as HTMLSelectElement[];
		selects[0].value = 'Fresh';
		selects[0].dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		expect((fixture.componentInstance as InstanceType<typeof ProductsComponent>).form.controls.typeName.value)
			.toBe('Daily');
		selects[1].value = 'Daily';
		selects[1].dispatchEvent(new Event('change', {bubbles: true}));
		click(modal.querySelector('[data-test="admin-product-save"]') as Element);
		const create = httpMock.expectOne('/api/product/create');
		expect(create.request.body.name).toBe('Rose');
		expect(create.request.body.typeName).toBe('Daily');
		create.flush(productView(9, 'Rose', 460000));
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(pageOf(products));
		tick();
	});

	it('edits a product from the edit modal', () => {
		mount();
		const modal = openModal(() => click((fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-products-edit"]') as Element));
		const component = fixture.componentInstance;
		expect(component.editId()).toBe(1);
		expect(component.form.controls.name.value).toBe('Rose');
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		setInput(inputs[0], 'Roses');
		setInput(inputs[1], '2');
		click(modal.querySelector('[data-test="admin-product-save"]') as Element);
		const edit = httpMock.expectOne('/api/product/1');
		expect(edit.request.method).toBe('PUT');
		expect(edit.request.body.name).toBe('Roses');
		edit.flush(productView(1, 'Roses', 2));
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(pageOf(products));
		tick();
	});

	it('selects rows and deletes them in bulk from the delete modal', () => {
		const component = mount().componentInstance;
		const element = fixture.nativeElement as HTMLElement;
		element.querySelectorAll('tbody tr').forEach(row => click(row));
		tick();
		expect(component.isSelected()).toEqual([true, true, true, true]);
		const modal = openModal(() => click(element.querySelector('[data-test="admin-products-delete"]') as Element));
		expect(modal.textContent).toContain('Rose');
		expect(modal.textContent).toContain('Cactus');
		click(modal.querySelector('[data-test="admin-product-confirm-delete"]') as Element);
		const request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'DELETE');
		expect(request.request.body).toEqual([1, 2, 3, 4]);
		request.flush(null);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(pageOf(products));
		tick();
	});

	it('exports the filtered catalogue across every page in both languages', () => {
		mount(pageOf(products, 4, 1));
		const exportButton = (fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-products-export"]') as Element;
		click(exportButton);
		const request = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET');
		expect(request.request.params.get('size')).toBe('48');
		request.flush(pageOf(products, 4, 1));
		expect(writeFile).toHaveBeenCalledTimes(1);
		expect(writeFile.mock.calls[0][1]).toContain('.xlsx');

		fixture.componentInstance.translate.use('vi');
		tick();
		click(exportButton);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(pageOf(products, 4, 1));
		expect(writeFile).toHaveBeenCalledTimes(2);
		expect(writeFile.mock.calls[1][1]).toContain('sản_phẩm');
	});

	it('rejects non excel files and empty sheets in the import modal', async () => {
		mount();
		const modal = openModal(() => click((fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-products-import"]') as Element));
		const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement;
		attachFile(fileInput, new File(['nope'], 'notes.txt', {type: 'text/plain'}));
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		await vi.waitFor(() => expect(toastShow).toHaveBeenCalledTimes(1));

		const emptyWorkbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(emptyWorkbook, XLSX.utils.aoa_to_sheet([[
			'id', 'name', 'description', 'imgUrl', 'price', 'typeName', 'categoryName'
		]]), 'Sheet1');
		const empty = XLSX.write(emptyWorkbook, {bookType: 'xlsx', type: 'binary'}) as string;
		attachFile(fileInput, excelFile(empty, 'empty.xlsx'));
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		await vi.waitFor(() => expect(toastShow).toHaveBeenCalledTimes(2));
		expect((modal.querySelector('[data-test="admin-product-import-button"]') as HTMLButtonElement).disabled)
			.toBe(true);
	});

	it('imports rows from an excel file through the file input', async () => {
		mount();
		const modal = openModal(() => click((fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-products-import"]') as Element));
		const binary = excelBinary([{
			id: 9, name: 'Orchid', description: 'purple flower', imgUrl: '', price: 2,
			typeName: 'Daily', categoryName: 'Fresh'
		}]);
		const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement;
		attachFile(fileInput, excelFile(binary, 'products.xlsx'));
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		const importButton = await vi.waitFor(() => {
			const button = modal.querySelector('[data-test="admin-product-import-button"]') as HTMLButtonElement;
			expect(button.disabled).toBe(false);
			return button;
		});
		importButton.click();
		const importRequest = httpMock.expectOne(req => req.url === '/api/product' && req.method === 'POST');
		expect(importRequest.request.body[0].name).toBe('Orchid');
		expect(importRequest.request.body[0]).not.toHaveProperty('quantity');
		importRequest.flush([]);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'GET').flush(pageOf(products));
		tick();
	});

	it('rejects an empty file selection', () => {
		mount();
		const modal = openModal(() => click((fixture.nativeElement as HTMLElement)
			.querySelector('[data-test="admin-products-import"]') as Element));
		const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement;
		Object.defineProperty(fileInput, 'files', {
			value: {length: 1, item: () => null, 0: null},
			configurable: true
		});
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		expect(toastShow).toHaveBeenCalledTimes(1);
	});

	it('reports failures from the mutating endpoints', () => {
		mount();
		const component = fixture.componentInstance;
		component.openCreateModal({} as never);
		component.form.patchValue({name: 'Rose', price: 1, categoryName: 'Fresh', typeName: 'Daily'});
		component.onSubmit();
		httpMock.expectOne('/api/product/create').flush('boom', {status: 500, statusText: 'Server Error'});

		component.selectRow(0);
		component.onDelete();
		httpMock.expectOne('/api/product/1').flush('boom', {status: 500, statusText: 'Server Error'});

		component.onImportExcel([{name: 'Rose', description: '', imgUrl: '', price: 1, typeName: 'Daily', categoryName: 'Fresh'}]);
		httpMock.expectOne(req => req.url === '/api/product' && req.method === 'POST')
			.flush('boom', {status: 500, statusText: 'Server Error'});
		tick();
		expect(toastDanger).toHaveBeenCalledTimes(3);
	});
});
