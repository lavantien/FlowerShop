import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormsModule} from '@angular/forms';
import {CarouselModule} from 'ngx-bootstrap/carousel';
import {ModalModule} from 'ngx-bootstrap/modal';
import {PaginationModule} from 'ngx-bootstrap/pagination';
import {TooltipModule} from 'ngx-bootstrap/tooltip';
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome';
import {LightboxModule} from 'ngx-lightbox';
import {NgxSpinnerModule} from 'ngx-spinner';

@NgModule({
	declarations: [],
	imports: [
		CommonModule
	],
	exports: [
		TranslateModule,
		FormsModule,
		FontAwesomeModule,
		ModalModule,
		PaginationModule,
		TooltipModule,
		CarouselModule,
		LightboxModule,
		NgxSpinnerModule
	]
})
export class SharedModule {
}
