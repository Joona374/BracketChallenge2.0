import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-home",
  imports: [CommonModule, RouterModule],
  standalone: true,
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
})
export class HomeComponent {
  loggedInUser: string | null = null;

  ngOnInit() {
    this.loggedInUser = localStorage.getItem("loggedInUser");
  }

  logout() {
    localStorage.removeItem("loggedInUser");
    window.location.reload();
  }
}
