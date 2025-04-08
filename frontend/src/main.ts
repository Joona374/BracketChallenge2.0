import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { importProvidersFrom } from "@angular/core";
import { provideHttpClient } from "@angular/common/http";
import { Routes } from "@angular/router";

import { AppComponent } from "./app/app.component";
import { RegisterComponent } from "./app/register/register.component";
import { HomeComponent } from "./app/home/home.component";
import { LoginComponent } from "./app/login/login.component";
import { BracketComponent } from "./app/bracket/bracket.component";
import { LineupPageComponent } from "./app/lineup-page/lineup-page.component";
import { PredictionsComponent } from "./app/predictions/predictions.component";
import { UserDashboardComponent } from "./app/user-dashboard/user-dashboard.component";
import { LeaderboardComponent } from "./app/leaderboard/leaderboard.component";
import { UserViewComponent } from "./app/user-view/user-view.component";
import { RulesComponent } from "./app/rules/rules.component";
import { VoteComponent } from "./app/vote/vote.component";
import { AdminComponent } from "./app/admin/admin.component";

const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "register", component: RegisterComponent },
  { path: "login", component: LoginComponent },
  { path: "bracket", component: BracketComponent },
  { path: "lineup", component: LineupPageComponent },
  { path: "predictions", component: PredictionsComponent },
  { path: "dashboard", component: UserDashboardComponent },
  { path: "leaderboard", component: LeaderboardComponent },
  { path: "user/:teamName", component: UserViewComponent },
  { path: "rules", component: RulesComponent },
  { path: "vote", component: VoteComponent },
  { path: "admin", component: AdminComponent },
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient()],
});
