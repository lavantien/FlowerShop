import {Injectable} from '@angular/core';

const GUEST_TOKEN = '0+GUESS';

@Injectable({
	providedIn: 'root'
})
export class TokenService {
	private decode(): string {
		const token = localStorage.getItem('token');
		return token === null ? '' : atob(token);
	}

	userId(): number {
		const id = parseInt(this.decode().split('+')[0], 10);
		return Number.isNaN(id) ? 0 : id;
	}

	role(): string {
		return this.decode().split('+')[1] ?? '';
	}

	isAdmin(): boolean {
		return this.role() === 'ADMIN';
	}

	isLoggedIn(): boolean {
		const decoded = this.decode();
		return decoded !== '' && decoded !== GUEST_TOKEN;
	}
}
