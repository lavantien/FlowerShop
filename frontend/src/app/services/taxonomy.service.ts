import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {Category, CategoryInput, Type, TypeInput} from '../models';

@Injectable({providedIn: 'root'})
export class TaxonomyService {
	private readonly http = inject(HttpClient);

	categories(): Observable<Category[]> {
		return this.http.get<Category[]>(API.categories.list);
	}

	createCategory(input: CategoryInput): Observable<Category> {
		return this.http.post<Category>(API.categories.create, input);
	}

	updateCategory(id: number, input: CategoryInput): Observable<Category> {
		return this.http.put<Category>(API.categories.byId(id), input);
	}

	removeCategory(id: number): Observable<void> {
		return this.http.delete<void>(API.categories.byId(id));
	}

	types(): Observable<Type[]> {
		return this.http.get<Type[]>(API.types.list);
	}

	createType(input: TypeInput): Observable<Type> {
		return this.http.post<Type>(API.types.create, input);
	}

	updateType(id: number, input: TypeInput): Observable<Type> {
		return this.http.put<Type>(API.types.byId(id), input);
	}

	removeType(id: number): Observable<void> {
		return this.http.delete<void>(API.types.byId(id));
	}
}
