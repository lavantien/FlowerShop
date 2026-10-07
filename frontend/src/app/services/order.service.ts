import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {definedParams} from './params';
import {
	AdminOrderQuery,
	CheckoutRequest,
	CheckoutResponse,
	Order,
	OrderStatus,
	OrderStatusChangeRequest,
	Page
} from '../models';

@Injectable({providedIn: 'root'})
export class OrderService {
	private readonly http = inject(HttpClient);

	checkout(request: CheckoutRequest): Observable<CheckoutResponse> {
		return this.http.post<CheckoutResponse>(API.orders.place, request);
	}

	mine(page: number, size: number): Observable<Page<Order>> {
		return this.http.get<Page<Order>>(API.orders.mine, {
			params: definedParams({page, size})
		});
	}

	admin(query: AdminOrderQuery): Observable<Page<Order>> {
		return this.http.get<Page<Order>>(API.orders.list, {
			params: definedParams({...query})
		});
	}

	byId(id: number): Observable<Order> {
		return this.http.get<Order>(API.orders.byId(id));
	}

	cancel(id: number): Observable<Order> {
		return this.http.post<Order>(API.orders.cancel(id), null);
	}

	setStatus(id: number, status: OrderStatus): Observable<Order> {
		const body: OrderStatusChangeRequest = {status};
		return this.http.post<Order>(API.orders.status(id), body);
	}
}
