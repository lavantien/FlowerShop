import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'app-info',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
	templateUrl: './info.component.html',
	styleUrls: ['./info.component.scss']
})
export class InfoComponent {
}
