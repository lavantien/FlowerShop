import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {SessionService, SessionUser} from './session.service';

export interface LoginResponse {
	token: string;
	user: SessionUser;
}

export interface RegisterInput {
	name: string;
	email: string;
	password: string;
	phone: string;
	address: string;
	district: string;
	city: string;
	answer: string;
}

export interface ResetPasswordInput {
	email: string;
	answer: string;
	newPassword: string;
}

@Injectable({providedIn: 'root'})
export class AuthService {
	private readonly http = inject(HttpClient);
	private readonly session = inject(SessionService);

	login(email: string, password: string): Observable<LoginResponse> {
		return this.http.post<LoginResponse>('/api/auth/login', {email, password}).pipe(
			tap(response => this.session.login(response.token, response.user))
		);
	}

	// header only by contract, the interceptor attaches the token
	logout(): Observable<void> {
		return this.http.post<void>('/api/auth/logout', null).pipe(
			tap(() => this.session.logout())
		);
	}

	register(input: RegisterInput): Observable<SessionUser> {
		return this.http.post<SessionUser>('/api/user/create', input);
	}

	resetPassword(input: ResetPasswordInput): Observable<LoginResponse> {
		return this.http.post<LoginResponse>('/api/user/resetPassword', input).pipe(
			tap(response => this.session.login(response.token, response.user))
		);
	}
}
