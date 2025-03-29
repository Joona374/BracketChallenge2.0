import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { importProvidersFrom } from "@angular/core";
import { provideHttpClient } from "@angular/common/http"; // 👈 Add this
import { Routes } from "@angular/router";

import { AppComponent } from "./app/app.component";
import { RegisterComponent } from "./app/register/register.component";

const routes: Routes = [
  { path: "", redirectTo: "register", pathMatch: "full" }, // default route
  { path: "register", component: RegisterComponent },
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient()],
});
