import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'app-admin',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
	templateUrl: './admin.component.html',
	styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
}
