import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShelfRoutingModule } from './shelf-routing-module';
import { LayoutComponent } from './layout/layout';
import { HomeComponent } from './pages/home/home';
import { ViewerComponent } from './pages/viewer/viewer';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ShelfRoutingModule,
    LayoutComponent,
    HomeComponent,
    ViewerComponent
  ]
})
export class ShelfModule { }