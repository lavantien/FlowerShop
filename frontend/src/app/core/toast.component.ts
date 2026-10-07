import {Component, inject} from '@angular/core';
import {ToastService} from './toast.service';

@Component({
	selector: 'app-toasts',
	template: `
		<div class="toast-container position-fixed top-0 end-0 p-3">
			@for (toast of toasts(); track toast.id) {
				<div [class]="'toast show align-items-center text-bg-' + toast.kind" role="status" aria-live="polite">
					<div class="d-flex">
						<div class="toast-body">{{toast.message}}</div>
						<button (click)="dismiss(toast.id)" type="button" class="btn-close btn-close-white me-2 m-auto"
						        aria-label="Close"></button>
					</div>
				</div>
			}
		</div>
	`
})
export class ToastContainerComponent {
	private readonly toastService = inject(ToastService);

	readonly toasts = this.toastService.toasts;

	dismiss(id: number): void {
		this.toastService.dismiss(id);
	}
}
