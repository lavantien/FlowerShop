import {Component, OnInit, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, AbstractControl, ValidatorFn, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {AccountService} from '../../services/account.service';
import {SessionService} from '../../core/session.service';
import {ToastService} from '../../core/toast.service';
import {GeoOptionsService} from '../../shared/geo-options.service';

function mustMatch(field: string, confirmation: string): ValidatorFn {
	return (group: AbstractControl): ValidationErrors | null => {
		const first = group.get(field)?.value;
		const second = group.get(confirmation)?.value;
		return first === second ? null : {mismatch: true};
	};
}

@Component({
	selector: 'app-profile',
	imports: [ReactiveFormsModule, TranslatePipe],
	templateUrl: './profile.component.html',
	styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
	readonly email = signal('');
	readonly savingProfile = signal(false);
	readonly profileFailed = signal(false);
	readonly changingPassword = signal(false);
	readonly passwordFailed = signal(false);

	readonly geo = inject(GeoOptionsService);

	private readonly fb = inject(NonNullableFormBuilder);
	private readonly account = inject(AccountService);
	private readonly session = inject(SessionService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	readonly profileForm = this.fb.group({
		name: ['', Validators.required],
		phone: ['', [Validators.required, Validators.pattern('[0-9]{9,11}')]],
		address: ['', Validators.required],
		district: ['', Validators.required],
		city: ['Hồ Chí Minh', Validators.required]
	});

	readonly passwordForm = this.fb.group({
		currentPassword: ['', Validators.required],
		newPassword: ['', [Validators.required, Validators.minLength(6)]],
		reNewPassword: ['', Validators.required]
	}, {validators: mustMatch('newPassword', 'reNewPassword')});

	ngOnInit(): void {
		this.geo.load();
		const user = this.session.user();
		this.email.set(user?.email ?? '');
		this.profileForm.patchValue({
			name: user?.name ?? '',
			phone: user?.phone ?? '',
			address: user?.address ?? '',
			district: user?.district ?? '',
			city: user?.city || 'Hồ Chí Minh'
		});
	}

	onCityChange(): void {
		const city = this.profileForm.controls.city.value;
		const first = this.geo.districts().find(district => district.cityName === city);
		if (first !== undefined) {
			this.profileForm.controls.district.setValue(first.name);
		}
	}

	onSaveProfile(): void {
		this.profileFailed.set(false);
		if (this.profileForm.invalid) {
			this.profileFailed.set(true);
			return;
		}
		if (this.savingProfile()) {
			return;
		}
		this.savingProfile.set(true);
		this.account.updateMe(this.profileForm.getRawValue()).subscribe({
			next: user => {
				this.savingProfile.set(false);
				const token = this.session.token();
				if (token !== null) {
					this.session.login(token, user);
				}
				this.toast.success(this.translate.instant('INFO.PROFILE_SAVED'));
			},
			error: () => {
				this.savingProfile.set(false);
				this.profileFailed.set(true);
				this.toast.danger(this.translate.instant('INFO.PROFILE_FAILED'));
			}
		});
	}

	onChangePassword(): void {
		this.passwordFailed.set(false);
		if (this.passwordForm.invalid) {
			this.passwordFailed.set(true);
			return;
		}
		if (this.changingPassword()) {
			return;
		}
		this.changingPassword.set(true);
		const {currentPassword, newPassword} = this.passwordForm.getRawValue();
		this.account.changePassword({currentPassword, newPassword}).subscribe({
			next: () => {
				this.changingPassword.set(false);
				this.passwordForm.reset();
				this.toast.success(this.translate.instant('INFO.PASSWORD_CHANGED'));
			},
			error: () => {
				this.changingPassword.set(false);
				this.passwordFailed.set(true);
				this.toast.danger(this.translate.instant('INFO.PASSWORD_FAILED'));
			}
		});
	}
}
