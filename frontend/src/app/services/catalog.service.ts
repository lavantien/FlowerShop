import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {EMPTY, Observable, expand, map, toArray} from 'rxjs';
import {API} from './api';
import {definedParams} from './params';
import {CatalogQuery, Page, ProductInput, ProductView} from '../models';

// the api clamps page size to 48 rows, page walks use the ceiling
const MAX_PAGE_SIZE = 48;

@Injectable({providedIn: 'root'})
export class CatalogService {
	private readonly http = inject(HttpClient);

	page(query: CatalogQuery): Observable<Page<ProductView>> {
		return this.http.get<Page<ProductView>>(API.products.list, {
			params: definedParams({...query})
		});
	}

	// walks every page of a filtered query for whole-resultset consumers
	// like the admin excel export
	all(query: CatalogQuery): Observable<ProductView[]> {
		const fetch = (page: number): Observable<Page<ProductView>> =>
			this.page({...query, page, size: MAX_PAGE_SIZE});
		return fetch(0).pipe(
			expand(data => data.page + 1 < data.totalPages ? fetch(data.page + 1) : EMPTY),
			map(data => data.content),
			toArray(),
			map(pages => pages.flat())
		);
	}

	byId(id: number): Observable<ProductView> {
		return this.http.get<ProductView>(API.products.byId(id));
	}

	bulkUpsert(inputs: ProductInput[]): Observable<ProductView[]> {
		return this.http.post<ProductView[]>(API.products.list, inputs);
	}

	create(input: ProductInput): Observable<ProductView> {
		return this.http.post<ProductView>(API.products.create, input);
	}

	update(id: number, input: ProductInput): Observable<ProductView> {
		return this.http.put<ProductView>(API.products.byId(id), input);
	}

	remove(id: number): Observable<void> {
		return this.http.delete<void>(API.products.byId(id));
	}

	removeMany(ids: number[] | null): Observable<void> {
		return this.http.delete<void>(API.products.list, {body: ids});
	}
}
