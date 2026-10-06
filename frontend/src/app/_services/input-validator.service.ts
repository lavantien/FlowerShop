import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class InputValidatorService {
	constructor() {
	}

	isEmail(email: string): boolean {
		const regexEmail = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return regexEmail.test(email.toLowerCase());
	}

	isPassword(pw: string): boolean {
		return pw.length > 6;
	}

	isInteger(num: number): boolean {
		const regexInteger = /^\d+$/;
		return regexInteger.test(num.toString());
	}
}
