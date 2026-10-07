import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {Coupon, CouponInput, CouponValidateRequest, CouponValidation} from '../models';

@Injectable({providedIn: 'root'})
export class CouponService {
	private readonly http = inject(HttpClient);

	list(): Observable<Coupon[]> {
		return this.http.get<Coupon[]>(API.coupons.list);
	}

	create(input: CouponInput): Observable<Coupon> {
		return this.http.post<Coupon>(API.coupons.list, input);
	}

	update(id: number, input: CouponInput): Observable<Coupon> {
		return this.http.put<Coupon>(API.coupons.byId(id), input);
	}

	remove(id: number): Observable<void> {
		return this.http.delete<void>(API.coupons.byId(id));
	}

	validate(request: CouponValidateRequest): Observable<CouponValidation> {
		return this.http.post<CouponValidation>(API.coupons.validate, request);
	}
}
