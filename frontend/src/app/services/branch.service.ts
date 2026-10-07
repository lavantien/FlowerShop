import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {Branch, BranchInput, StockRow, StockSetRequest} from '../models';

@Injectable({providedIn: 'root'})
export class BranchService {
	private readonly http = inject(HttpClient);

	list(): Observable<Branch[]> {
		return this.http.get<Branch[]>(API.branches.list);
	}

	create(input: BranchInput): Observable<Branch> {
		return this.http.post<Branch>(API.branches.list, input);
	}

	update(id: number, input: BranchInput): Observable<Branch> {
		return this.http.put<Branch>(API.branches.byId(id), input);
	}

	remove(id: number): Observable<void> {
		return this.http.delete<void>(API.branches.byId(id));
	}

	stock(branchId: number): Observable<StockRow[]> {
		return this.http.get<StockRow[]>(API.branches.stock(branchId));
	}

	setStock(branchId: number, request: StockSetRequest): Observable<StockRow> {
		return this.http.put<StockRow>(API.branches.stock(branchId), request);
	}
}
