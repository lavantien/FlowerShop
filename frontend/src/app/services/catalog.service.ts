import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {definedParams} from './params';
import {CatalogQuery, Page, ProductInput, ProductView} from '../models';

@Injectable({providedIn: 'root'})
export class CatalogService {
	private readonly http = inject(HttpClient);

	page(query: CatalogQuery): Observable<Page<ProductView>> {
		return this.http.get<Page<ProductView>>(API.products.list, {
			params: definedParams({...query})
		});
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
