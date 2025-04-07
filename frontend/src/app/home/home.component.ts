import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.css"],
})
export class HomeComponent implements OnInit {
  loggedInUser: string | null = null;

  ngOnInit(): void {
    const user = localStorage.getItem("loggedInUser");
    this.loggedInUser = user ? JSON.parse(user).username : null;
  }

  logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "/";
  }

  getUserInitials(): string {
    if (!this.loggedInUser) return "";
    return this.loggedInUser
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }

  scrollToFeatures(): void {
    const featuresSection = document.querySelector('.features-section');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
