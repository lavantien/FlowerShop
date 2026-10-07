import {Injectable, signal} from '@angular/core';

export type ToastKind = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
}

const DISMISS_AFTER_MS = 4000;

@Injectable({providedIn: 'root'})
export class ToastService {
	private nextId = 0;
	private readonly toastsSignal = signal<Toast[]>([]);

	readonly toasts = this.toastsSignal.asReadonly();

	show(message: string, kind: ToastKind = 'info'): void {
		const id = ++this.nextId;
		this.toastsSignal.update(list => [...list, {id, message, kind}]);
		setTimeout(() => this.dismiss(id), DISMISS_AFTER_MS);
	}

	success(message: string): void {
		this.show(message, 'success');
	}

	danger(message: string): void {
		this.show(message, 'danger');
	}

	dismiss(id: number): void {
		this.toastsSignal.update(list => list.filter(toast => toast.id !== id));
	}
}
