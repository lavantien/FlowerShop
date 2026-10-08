import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {API} from '../services/api';
import {LoginRequest, LoginResponse, RegisterRequest, ResetPasswordRequest, User} from '../models';
import {SessionService} from './session.service';

@Injectable({providedIn: 'root'})
export class AuthService {
	private readonly http = inject(HttpClient);
	private readonly session = inject(SessionService);

	login(email: string, password: string): Observable<LoginResponse> {
		const body: LoginRequest = {email, password};
		return this.http.post<LoginResponse>(API.auth.login, body).pipe(
			tap(response => this.session.login(response.token, response.user))
		);
	}

	logout(): Observable<void> {
		return this.http.post<void>(API.auth.logout, null).pipe(
			tap(() => this.session.logout())
		);
	}

	register(input: RegisterRequest): Observable<User> {
		return this.http.post<User>(API.users.create, input);
	}

	resetPassword(input: ResetPasswordRequest): Observable<LoginResponse> {
		return this.http.post<LoginResponse>(API.users.resetPassword, input).pipe(
			tap(response => this.session.login(response.token, response.user))
		);
	}
}
