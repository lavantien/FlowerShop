import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faBan, faCheck, faTrash} from '@fortawesome/free-solid-svg-icons';
import {TooltipDirective} from 'ngx-bootstrap/tooltip';
import {AccountService} from '../../services/account.service';
import {ToastService} from '../../core/toast.service';
import {Role, User} from '../../models';

@Component({
	selector: 'app-admin-users',
	imports: [TranslatePipe, FaIconComponent, TooltipDirective],
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.scss']
})
export class AdminUsersComponent implements OnInit {
	readonly faTrash = faTrash;
	readonly faCheck = faCheck;
	readonly faBan = faBan;
	readonly roles: Role[] = ['USER', 'ADMIN'];

	readonly users = signal<User[]>([]);
	readonly busyId = signal<number | null>(null);

	readonly lang = computed(() => this.translate.currentLang() ?? 'en');

	private readonly account = inject(AccountService);
	private readonly toast = inject(ToastService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		this.account.list().subscribe({
			next: data => this.users.set(data ?? []),
			error: () => this.users.set([])
		});
	}

	onRoleChange(user: User, role: string): void {
		this.updateUser(user, {role: role as Role});
	}

	onToggleEnable(user: User): void {
		this.updateUser(user, {enable: !user.enable});
	}

	onDelete(user: User): void {
		if (this.busyId() !== null) {
			return;
		}
		this.busyId.set(user.id);
		this.account.remove(user.id).subscribe({
			next: () => {
				this.busyId.set(null);
				this.users.update(list => list.filter(candidate => candidate.id !== user.id));
				this.toast.success(this.translate.instant('ADMIN.USER_DELETED'));
			},
			error: error => {
				this.busyId.set(null);
				// a user with orders is refused with 409: disabling is the escape hatch
				this.toast.danger(this.translate.instant(error.status === 409 ? 'ADMIN.USER_HAS_ORDERS' : 'ADMIN.USER_DELETE_FAILED'));
			}
		});
	}

	private updateUser(user: User, patch: {role?: Role; enable?: boolean}): void {
		if (this.busyId() !== null) {
			return;
		}
		this.busyId.set(user.id);
		this.account.update(user.id, {
			name: user.name,
			phone: user.phone,
			role: patch.role ?? user.role,
			enable: patch.enable ?? user.enable
		}).subscribe({
			next: updated => {
				this.busyId.set(null);
				this.users.update(list => list.map(candidate => candidate.id === updated.id ? updated : candidate));
				this.toast.success(this.translate.instant('ADMIN.USER_UPDATED'));
			},
			error: () => {
				this.busyId.set(null);
				this.toast.danger(this.translate.instant('ADMIN.ACTION_FAILED'));
			}
		});
	}
}
