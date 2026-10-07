import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './api';
import {AdminUserUpdateRequest, PasswordChangeRequest, ProfileUpdateRequest, User} from '../models';

@Injectable({providedIn: 'root'})
export class AccountService {
	private readonly http = inject(HttpClient);

	me(): Observable<User> {
		return this.http.get<User>(API.users.me);
	}

	updateMe(request: ProfileUpdateRequest): Observable<User> {
		return this.http.put<User>(API.users.me, request);
	}

	changePassword(request: PasswordChangeRequest): Observable<void> {
		return this.http.post<void>(API.users.mePassword, request);
	}

	list(): Observable<User[]> {
		return this.http.get<User[]>(API.users.list);
	}

	update(id: number, request: AdminUserUpdateRequest): Observable<User> {
		return this.http.put<User>(API.users.byId(id), request);
	}

	remove(id: number): Observable<void> {
		return this.http.delete<void>(API.users.byId(id));
	}
}
