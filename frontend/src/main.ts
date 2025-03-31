import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { importProvidersFrom } from "@angular/core";
import { provideHttpClient } from "@angular/common/http"; // 👈 Add this
import { Routes } from "@angular/router";

import { AppComponent } from "./app/app.component";
import { RegisterComponent } from "./app/register/register.component";
import { HomeComponent } from "./app/home/home.component";
import { LoginComponent } from "./app/login/login.component";
import { BracketComponent } from "./app/bracket/bracket.component"; // 👈
import { LineupPageComponent } from "./app/lineup-page/lineup-page.component";

const routes: Routes = [
  { path: "", component: HomeComponent }, // default route
  { path: "register", component: RegisterComponent },
  { path: "login", component: LoginComponent },
  { path: "bracket", component: BracketComponent },
  { path: "lineup", component: LineupPageComponent },
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient()],
});
