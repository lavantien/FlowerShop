import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {definedParams} from './params';
import {SalesQuery, SalesReport} from '../models';

@Injectable({providedIn: 'root'})
export class ReportService {
	private readonly http = inject(HttpClient);

	sales(query: SalesQuery = {}): Observable<SalesReport> {
		return this.http.get<SalesReport>(API.reports.sales, {
			params: definedParams({...query})
		});
	}
}
