import {Injectable, computed, signal} from '@angular/core';
import {Role, User} from '../models';

export type {Role};
export type SessionUser = User;

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function isSessionUser(value: unknown): value is SessionUser {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return Number.isFinite(candidate['id'])
		&& typeof candidate['name'] === 'string'
		&& typeof candidate['email'] === 'string'
		&& (candidate['role'] === 'USER' || candidate['role'] === 'ADMIN');
}

@Injectable({providedIn: 'root'})
export class SessionService {
	private readonly tokenSignal = signal<string | null>(null);
	private readonly userSignal = signal<SessionUser | null>(null);
	private readonly loginRequestedCount = signal(0);

	readonly token = this.tokenSignal.asReadonly();
	readonly user = this.userSignal.asReadonly();
	readonly isLoggedIn = computed(() => this.user() !== null);
	readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
	readonly loginRequested = this.loginRequestedCount.asReadonly();

	constructor() {
		this.restore();
	}

	login(token: string, user: SessionUser): void {
		this.tokenSignal.set(token);
		this.userSignal.set(user);
		localStorage.setItem(TOKEN_KEY, token);
		localStorage.setItem(USER_KEY, JSON.stringify(user));
	}

	logout(): void {
		this.tokenSignal.set(null);
		this.userSignal.set(null);
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
	}

	requestLogin(): void {
		this.loginRequestedCount.update(count => count + 1);
	}

	private restore(): void {
		const token = localStorage.getItem(TOKEN_KEY);
		const rawUser = localStorage.getItem(USER_KEY);
		if (token === null || rawUser === null) {
			return;
		}
		try {
			const parsed: unknown = JSON.parse(rawUser);
			if (isSessionUser(parsed)) {
				this.login(token, parsed);
			} else {
				this.logout();
			}
		} catch {
			this.logout();
		}
	}
}
