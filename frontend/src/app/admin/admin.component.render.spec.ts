import {ApplicationRef, Component} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {provideRouter} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {beforeAll, beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {Product} from '../_models/product';
import {Category} from '../_models/category';
import {Type} from '../_models/type';

vi.mock('xlsx', async importOriginal => {
	const actual = await importOriginal<typeof import('xlsx')>();
	return {...actual, writeFile: vi.fn()};
});

let XLSX: typeof import('xlsx');
let AdminComponent: typeof import('./admin.component').AdminComponent;

@Component({selector: 'app-empty', template: ''})
class EmptyComponent {
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function product(id: number, name: string, price: number): Product {
	return {
		id,
		name,
		description: `flower ${id}`,
		price,
		imgUrl: 'aGk=',
		quantity: 5 + id,
		saleAmount: id,
		categoryName: 'Fresh',
		typeName: 'Daily'
	};
}

const products: Product[] = [product(1, 'Rose', 1), product(2, 'Tulip', 2), product(3, 'Lily', 3), {
	id: 4,
	name: 'Cactus',
	description: 'a plant with a very long description that definitely exceeds sixty characters in length',
	price: 4,
	imgUrl: '',
	quantity: 9,
	saleAmount: 0,
	categoryName: 'Fresh',
	typeName: 'Daily'
}];
const categories: Category[] = [{id: 1, name: 'Fresh'}];
const types: Type[] = [
	{id: 1, name: 'Daily', categoryName: 'Fresh'},
	{id: 2, name: 'Event', categoryName: 'Pot'}
];

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

describe('AdminComponent rendering', () => {
	let httpMock: HttpTestingController;
	let fixture: ComponentFixture<InstanceType<typeof AdminComponent>>;
	let writeFile: ReturnType<typeof vi.fn>;

	beforeAll(async () => {
		XLSX = await import('xlsx');
		({AdminComponent} = await import('./admin.component'));
	});

	beforeEach(() => {
		localStorage.setItem('token', btoa('1+ADMIN'));
		vi.stubGlobal('alert', vi.fn());
		writeFile = XLSX.writeFile as unknown as ReturnType<typeof vi.fn>;
		writeFile.mockClear();
		TestBed.configureTestingModule({
			imports: [AdminComponent],
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
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
		document.body.querySelectorAll('.modal, .modal-backdrop').forEach(node => node.remove());
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		localStorage.clear();
	});

	function flushProducts(productList: Product[]) {
		httpMock.expectOne('/api/product').flush(productList.map(p => ({...p})));
	}

	function flushBackend(productList: Product[] | string, status = 200) {
		const safeList = typeof productList === 'string' ? productList : productList.map(p => ({...p}));
		if (status === 200) {
			httpMock.expectOne('/api/product').flush(safeList);
			httpMock.expectOne('/api/category').flush(categories.map(c => ({...c})));
			httpMock.expectOne('/api/type').flush(types.map(t => ({...t})));
		} else {
			httpMock.expectOne('/api/product').flush(safeList, {status, statusText: 'Server Error'});
			httpMock.expectOne('/api/category').flush('boom', {status, statusText: 'Server Error'});
			httpMock.expectOne('/api/type').flush('boom', {status, statusText: 'Server Error'});
		}
	}

	function createAdmin(productList: Product[] = products): ComponentFixture<InstanceType<typeof AdminComponent>> {
		fixture = TestBed.createComponent(AdminComponent);
		fixture.detectChanges();
		flushBackend(productList);
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

	function setText(input: HTMLInputElement, value: string) {
		input.value = value;
		input.dispatchEvent(new Event('input', {bubbles: true}));
	}

	it('loads the table and drives every column sort in both directions', () => {
		const component = createAdmin().componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		expect(component.isAdmin).toBe(true);
		expect(component.data().map((p: Product) => p.name)).toEqual(['Rose', 'Tulip', 'Lily', 'Cactus']);
		expect(component.data()[0].imgUrl).toBe('hi');
		expect(component.data()[3].imgUrl).toBe('');
		expect(component.data()[0].price).toBe(1 * 23000.0 - 9770);
		expect(component.productsOriginalDescription.length).toBe(4);

		component.onSort(4);
		expect(component.data().map((p: Product) => p.name)).toEqual(['Cactus', 'Lily', 'Tulip', 'Rose']);
		component.translate.use('vi');
		tick();
		component.firstTimeSort = false;
		const headers = element.querySelectorAll('th');
		for (const header of [headers[0], headers[1], headers[3], headers[5], headers[6]]) {
			click(header);
			tick();
			click(header);
			tick();
		}
		component.onSort(9);
		expect(component.sortFlip.slice(0, 5)).toEqual([false, false, false, false, true]);
		expect(component.sortFlip[9]).toBe(true);
		component.onChangeCategory('create');

		element.querySelectorAll('tbody tr').forEach(row => click(row));
		tick();
		expect(component.isSelected().length).toBe(4);
	});

	it('redirects a non admin to the shop', () => {
		localStorage.setItem('token', btoa('4+MEMBER'));
		const component = createAdmin().componentInstance;
		expect(component.isAdmin).toBe(false);
	});

	it('keeps empty signals when the api fails', () => {
		fixture = TestBed.createComponent(AdminComponent);
		fixture.detectChanges();
		flushBackend('boom', 500);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		expect(component.data()).toEqual([]);
		expect(component.categories()).toEqual([]);
		expect(component.types()).toEqual([]);
		expect(fixture.nativeElement.textContent).toContain('ADMIN.NO_PRODUCT_FOUND');
	});

	it('searches from the filter bar and moves across pages', () => {
		const bigCatalogue = Array.from({length: 25}, (_, i) => product(i + 1, `Flower ${i + 1}`, i + 1));
		const component = createAdmin(bigCatalogue).componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		const nameInput = element.querySelector('input.form-control') as HTMLInputElement;
		setText(nameInput, 'flower 2');
		nameInput.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
		tick();
		expect(component.searchResults().length).toBe(7);

		const selects = element.querySelectorAll('.wrapper-filter select');
		const categorySelect = selects[0] as HTMLSelectElement;
		component.searchForm.categoryName = 'Fresh';
		categorySelect.selectedIndex = 0;
		categorySelect.dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		expect(component.searchForm.name).toBe('');
		const typeSelect = selects[1] as HTMLSelectElement;
		typeSelect.selectedIndex = 0;
		typeSelect.dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		expect(component.searchForm.name).toBe('');
		click(element.querySelector('.wrapper-filter button') as Element);
		tick();

		const perPage = selects[2] as HTMLSelectElement;
		perPage.value = '5';
		perPage.dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		expect(component.itemPerPage()).toBe('5');

		const pageButtons = element.querySelectorAll('.pagination-page a') as NodeListOf<HTMLElement>;
		const pageTwo = Array.from(pageButtons).find(button => button.textContent?.trim() === '2');
		click(pageTwo as Element);
		tick();
		expect(component.currentPage()).toBe(2);
		expect(component.displayProducts()[0].id).toBe(6);
	});

	it('opens the image lightbox from a row', () => {
		const component = createAdmin().componentInstance;
		click(fixture.nativeElement.querySelector('tbody img') as Element);
		tick();
		expect(component.lightboxSrc()).toBe('hi');
		expect(component.lightboxCaption()).toContain('<b>Rose');
	});

	it('creates a product from the create modal', () => {
		const component = createAdmin().componentInstance;
		const buttons = fixture.nativeElement.querySelectorAll('.wrapper-filter button');
		const modal = openModal(() => click(buttons[1]));
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		const description = modal.querySelector('textarea') as HTMLTextAreaElement;
		const selects = Array.from(modal.querySelectorAll('select')) as HTMLSelectElement[];
		const footer = modal.querySelectorAll('.modal-footer button');
		setText(inputs[0], 'Rose');
		description.value = 'red flower';
		description.dispatchEvent(new Event('input', {bubbles: true}));
		setText(inputs[1], '460000');
		setText(inputs[2], 'https://example.com/rose.png');
		setText(inputs[3], '5');
		setText(inputs[4], '0');
		selects[0].value = 'Fresh';
		selects[0].dispatchEvent(new Event('change', {bubbles: true}));
		selects[1].selectedIndex = 0;
		selects[1].dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		click(footer[0]);
		const create = httpMock.expectOne('/api/product/create');
		expect(create.request.body.name).toBe('Rose');
		create.flush({});
		flushProducts(products);
		tick();
		click(footer[1]);
		expect(component.createForm.name).toBe('');
		click(modal.querySelector('.btn-close') as Element);
	});

	it('edits a product from the edit modal', () => {
		const component = createAdmin().componentInstance;
		const editButton = fixture.nativeElement.querySelector('tbody .btn-edit') as Element;
		const modal = openModal(() => click(editButton));
		expect(component.currentId).toBe(1);
		expect(component.editForm.name).toBe('Rose');
		expect(component.editForm.description).toBe('flower 1');
		const inputs = Array.from(modal.querySelectorAll('input')) as HTMLInputElement[];
		const description = modal.querySelector('textarea') as HTMLTextAreaElement;
		const selects = Array.from(modal.querySelectorAll('select')) as HTMLSelectElement[];
		const footer = modal.querySelectorAll('.modal-footer button');
		setText(inputs[0], 'Roses');
		description.value = 'red flower edited';
		description.dispatchEvent(new Event('input', {bubbles: true}));
		setText(inputs[1], '2');
		setText(inputs[2], 'aGk=');
		setText(inputs[3], '6');
		setText(inputs[4], '1');
		component.editForm.categoryName = 'Fresh';
		selects[0].selectedIndex = 0;
		selects[0].dispatchEvent(new Event('change', {bubbles: true}));
		selects[1].selectedIndex = 0;
		selects[1].dispatchEvent(new Event('change', {bubbles: true}));
		tick();
		click(footer[0]);
		const edit = httpMock.expectOne('/api/product/1');
		expect(edit.request.method).toBe('PUT');
		expect(edit.request.body.name).toBe('Roses');
		edit.flush({});
		flushProducts(products);
		tick();
		click(footer[1]);
		expect(component.editForm.name).toBe('');
		const closeButton = modal.querySelector('.btn-close') as Element;
		component.modalRef.hide();
		click(closeButton);
		expect(component.editForm.description).toBe(component.data()[0].description);
	});

	it('deletes a single product when only one row is displayed', () => {
		const component = createAdmin([product(1, 'Rose', 1)]).componentInstance;
		const deleteButton = fixture.nativeElement.querySelector('tbody .btn-warning') as Element;
		const modal = openModal(() => click(deleteButton));
		expect(component.isSelected().length).toBe(1);
		click(modal.querySelector('.modal-footer button') as Element);
		const request = httpMock.expectOne('/api/product/1');
		expect(request.request.method).toBe('DELETE');
		request.flush({});
		flushProducts([product(1, 'Rose', 1)]);
		tick();
	});

	it('deletes the checked rows in bulk', () => {
		const component = createAdmin().componentInstance;
		component.selectRow(1);
		component.selectRow(2);
		tick();
		expect(component.isSelected()).toEqual([false, true, true, false]);
		const deleteButton = fixture.nativeElement.querySelector('tbody .btn-warning') as Element;
		const modal = openModal(() => click(deleteButton));
		expect(component.isSelected()).toEqual([true, true, true, false]);
		expect(modal.textContent).toContain('Rose');
		click(modal.querySelector('.modal-footer button') as Element);
		const request = httpMock.expectOne('/api/product');
		expect(request.request.method).toBe('DELETE');
		expect(request.request.body).toEqual([1, 2, 3]);
		request.flush({});
		flushProducts(products);
		tick();
	});

	it('exports the catalogue to excel in both languages', () => {
		const component = createAdmin().componentInstance;
		const exportButton = fixture.nativeElement.querySelectorAll('.wrapper-filter button')[3];
		click(exportButton);
		expect(writeFile).toHaveBeenCalledTimes(1);
		expect(writeFile.mock.calls[0][1]).toContain('.xlsx');
		component.translate.use('vi');
		tick();
		click(exportButton);
		expect(writeFile).toHaveBeenCalledTimes(2);
		expect(writeFile.mock.calls[1][1]).toContain('sản_phẩm');
	});

	it('rejects non excel files and empty sheets in the import modal', async () => {
		createAdmin();
		const buttons = fixture.nativeElement.querySelectorAll('.wrapper-filter button');
		const modal = openModal(() => click(buttons[2]));
		const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement;
		attachFile(fileInput, new File(['nope'], 'notes.txt', {type: 'text/plain'}));
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(1));

		const emptyWorkbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(emptyWorkbook, XLSX.utils.aoa_to_sheet([[
			'id', 'name', 'description', 'imgUrl', 'price', 'quantity', 'saleAmount', 'typeName', 'categoryName'
		]]), 'Sheet1');
		const empty = XLSX.write(emptyWorkbook, {bookType: 'xlsx', type: 'binary'}) as string;
		attachFile(fileInput, excelFile(empty, 'empty.xlsx'));
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
		click(modal.querySelector('.modal-footer button') as Element);
		const importRequest = await vi.waitFor(() => httpMock.expectOne(request =>
			request.url === '/api/product' && request.method === 'POST'));
		importRequest.flush([]);
		flushProducts(products);
		tick();
	});

	it('imports rows from an excel file through the file input', async () => {
		const component = createAdmin().componentInstance;
		const buttons = fixture.nativeElement.querySelectorAll('.wrapper-filter button');
		const modal = openModal(() => click(buttons[2]));
		const binary = excelBinary([
			{id: 9, name: 'Orchid', description: 'purple flower', imgUrl: '', price: 2, quantity: 7, saleAmount: 0, typeName: 'Daily', categoryName: 'Fresh'}
		]);
		const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement;
		attachFile(fileInput, excelFile(binary, 'products.xlsx'));
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		const importRequest = await vi.waitFor(() => httpMock.expectOne(request =>
			request.url === '/api/product' && request.method === 'POST'));
		expect(importRequest.request.method).toBe('POST');
		expect(importRequest.request.body[0].name).toBe('Orchid');
		importRequest.flush([]);
		flushProducts(products);
		tick();
		expect(alert).toHaveBeenCalledTimes(1);
		expect(component.modalRef).toBeDefined();
	});

	it('reports failures from the mutating endpoints', () => {
		const component = createAdmin().componentInstance;
		component.onCreate();
		httpMock.expectOne('/api/product/create').flush('boom', {status: 500, statusText: 'Server Error'});
		component.currentId = 1;
		component.onEdit();
		httpMock.expectOne('/api/product/1').flush('boom', {status: 500, statusText: 'Server Error'});
		component.isSelected.set([true]);
		component.onDelete();
		httpMock.expectOne('/api/product/1').flush('boom', {status: 500, statusText: 'Server Error'});
		component.onImportExcel(products);
		const importRequest = httpMock.match(request => request.url === '/api/product' && request.method === 'POST')[0];
		importRequest.flush('boom', {status: 500, statusText: 'Server Error'});
		tick();
	});

	it('treats null catalogue payloads as empty', () => {
		fixture = TestBed.createComponent(AdminComponent);
		fixture.detectChanges();
		httpMock.expectOne('/api/product').flush(null);
		httpMock.expectOne('/api/category').flush(null);
		httpMock.expectOne('/api/type').flush(null);
		fixture.detectChanges();
		expect(fixture.componentInstance.data()).toEqual([]);
		expect(fixture.componentInstance.categories()).toEqual([]);
		expect(fixture.componentInstance.types()).toEqual([]);
	});

	it('opens the delete modal on a mixed selection and closes it', () => {
		const component = createAdmin().componentInstance;
		const deleteButton = fixture.nativeElement.querySelector('tbody .btn-warning') as Element;
		const modal = openModal(() => click(deleteButton));
		component.selectRow(2);
		tick();
		expect(modal.textContent).toContain('Rose');
		expect(modal.textContent).not.toContain('Tulip');
		click(modal.querySelector('.btn-close') as Element);
		expect(component.currentId).toBe(1);
	});

	it('rejects an empty file selection', () => {
		createAdmin();
		const buttons = fixture.nativeElement.querySelectorAll('.wrapper-filter button');
		const modal = openModal(() => click(buttons[2]));
		const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement;
		Object.defineProperty(fileInput, 'files', {
			value: {length: 1, item: () => null, 0: null},
			configurable: true
		});
		fileInput.dispatchEvent(new Event('change', {bubbles: true}));
		expect(alert).toHaveBeenCalledTimes(1);
		click(modal.querySelector('.btn-close') as Element);
	});
});
