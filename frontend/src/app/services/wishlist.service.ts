import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {WishlistEntry, WishlistToggleResult} from '../models';

@Injectable({providedIn: 'root'})
export class WishlistService {
	private readonly http = inject(HttpClient);

	mine(): Observable<WishlistEntry[]> {
		return this.http.get<WishlistEntry[]>(API.wishlist.mine);
	}

	toggle(productId: number): Observable<WishlistToggleResult> {
		return this.http.post<WishlistToggleResult>(API.wishlist.toggle(productId), null);
	}
}
