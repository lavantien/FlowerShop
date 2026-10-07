import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {PaymentActionResult, PaymentView} from '../models';

@Injectable({providedIn: 'root'})
export class PaymentService {
	private readonly http = inject(HttpClient);

	byId(paymentId: string, sig: string): Observable<PaymentView> {
		return this.http.get<PaymentView>(API.payments.byId(paymentId), {
			params: new HttpParams().set('sig', sig)
		});
	}

	confirm(paymentId: string, sig: string): Observable<PaymentActionResult> {
		return this.http.post<PaymentActionResult>(API.payments.confirm(paymentId), null, {
			params: new HttpParams().set('sig', sig)
		});
	}

	cancel(paymentId: string, sig: string): Observable<PaymentActionResult> {
		return this.http.post<PaymentActionResult>(API.payments.cancel(paymentId), null, {
			params: new HttpParams().set('sig', sig)
		});
	}
}
