import {Component, effect, inject, signal} from '@angular/core';
import {AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {AuthService} from '../../core/auth.service';
import {SessionService} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {GeoOptionsService} from '../geo-options.service';

export type AuthModalMode = 'login' | 'register' | 'forgot';

function mustMatch(field: string, confirmation: string): ValidatorFn {
	return (group: AbstractControl): ValidationErrors | null => {
		const first = group.get(field)?.value;
		const second = group.get(confirmation)?.value;
		return first === second ? null : {mismatch: true};
	};
}

@Component({
	selector: 'app-auth-modal',
	imports: [ReactiveFormsModule, TranslatePipe],
	templateUrl: './auth-modal.component.html'
})
export class AuthModalComponent {
	private readonly fb = inject(NonNullableFormBuilder);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	readonly session = inject(SessionService);
	readonly geo = inject(GeoOptionsService);
	readonly visible = signal(false);
	readonly mode = signal<AuthModalMode>('login');
	readonly wrongLogin = signal(false);
	readonly wrongCreate = signal(false);
	readonly wrongForgot = signal(false);

	readonly loginForm = this.fb.group({
		email: ['', [Validators.required, Validators.email]],
		password: ['', [Validators.required, Validators.minLength(6)]]
	});

	readonly registerForm = this.fb.group({
		name: ['', Validators.required],
		email: ['', [Validators.required, Validators.email]],
		reEmail: ['', [Validators.required, Validators.email]],
		password: ['', [Validators.required, Validators.minLength(6)]],
		rePassword: ['', Validators.required],
		answer: ['', Validators.required],
		reAnswer: ['', Validators.required],
		phone: [''],
		address: [''],
		city: ['Hồ Chí Minh', Validators.required],
		district: ['Bình Thạnh', Validators.required]
	}, {validators: [mustMatch('email', 'reEmail'), mustMatch('password', 'rePassword'), mustMatch('answer', 'reAnswer')]});

	readonly forgotForm = this.fb.group({
		email: ['', [Validators.required, Validators.email]],
		answer: ['', Validators.required],
		newPassword: ['', [Validators.required, Validators.minLength(6)]],
		reNewPassword: ['', Validators.required]
	}, {validators: mustMatch('newPassword', 'reNewPassword')});

	constructor() {
		// the navbar button and the interceptor 401 path share this one entry point
		effect(() => {
			if (this.session.loginRequested() > 0) {
				this.open();
			}
		});
	}

	open(): void {
		this.geo.load();
		this.visible.set(true);
	}

	close(): void {
		this.visible.set(false);
		this.resetFeedback();
	}

	switchMode(mode: AuthModalMode): void {
		this.mode.set(mode);
		this.resetFeedback();
	}

	resetLoginForm(): void {
		this.loginForm.reset();
		this.resetFeedback();
	}

	resetRegisterForm(): void {
		this.registerForm.reset();
		this.resetFeedback();
	}

	resetForgotForm(): void {
		this.forgotForm.reset();
		this.resetFeedback();
	}

	onCityChange(): void {
		const city = this.registerForm.controls.city.value;
		const first = this.geo.districts().find(district => district.cityName === city);
		if (first !== undefined) {
			this.registerForm.controls.district.setValue(first.name);
		}
	}

	onLogin(): void {
		this.wrongLogin.set(false);
		if (this.loginForm.invalid) {
			this.wrongLogin.set(true);
			return;
		}
		const {email, password} = this.loginForm.getRawValue();
		this.auth.login(email, password).subscribe({
			next: () => this.close(),
			error: () => this.wrongLogin.set(true)
		});
	}

	onRegister(): void {
		this.wrongCreate.set(false);
		if (this.registerForm.invalid) {
			this.wrongCreate.set(true);
			return;
		}
		const raw = this.registerForm.getRawValue();
		this.auth.register({
			name: raw.name,
			email: raw.email,
			password: raw.password,
			phone: raw.phone,
			address: raw.address,
			district: raw.district,
			city: raw.city,
			answer: raw.answer
		}).subscribe({
			next: () => {
				this.toast.success(this.translate.instant('ALERT.CREATE_USER_SUCCESSFUL'));
				this.auth.login(raw.email, raw.password).subscribe({
					next: () => this.close(),
					error: () => this.wrongCreate.set(true)
				});
			},
			error: () => this.wrongCreate.set(true)
		});
	}

	onForgot(): void {
		this.wrongForgot.set(false);
		if (this.forgotForm.invalid) {
			this.wrongForgot.set(true);
			return;
		}
		const raw = this.forgotForm.getRawValue();
		this.auth.resetPassword({email: raw.email, answer: raw.answer, newPassword: raw.newPassword}).subscribe({
			next: () => {
				this.toast.success(this.translate.instant('ALERT.RESET_PASSWORD_SUCCESSFUL'));
				this.close();
			},
			error: () => {
				this.toast.danger(this.translate.instant('ALERT.RESET_PASSWORD_FAILED'));
				this.wrongForgot.set(true);
			}
		});
	}

	private resetFeedback(): void {
		this.wrongLogin.set(false);
		this.wrongCreate.set(false);
		this.wrongForgot.set(false);
	}
}
