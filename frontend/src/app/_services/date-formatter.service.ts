import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class DateFormatterService {
	formatLocalDateTime(date: Date): string {
		const pad = (value: number) => String(value).padStart(2, '0');
		return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
			+ ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
	}
}
