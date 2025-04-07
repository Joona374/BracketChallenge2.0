import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { Router } from "@angular/router";
import { DatePipe } from "@angular/common";
import { AuthService, User } from "../../app/services/auth.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.css"],
})
export class HomeComponent implements OnInit, OnDestroy {
  loggedInUser: string | null = null;
  userLogo: string | null = null;
  private userSubscription: Subscription | null = null;

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    // Subscribe to auth changes
    this.userSubscription = this.authService.currentUser$.subscribe((user: User | null) => {
      this.loggedInUser = user ? user.username : null;
      this.userLogo = user?.logoUrl || null;
      console.log('HomeComponent Auth State Updated:', { loggedInUser: this.loggedInUser, userLogo: this.userLogo });
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  logout(): void {
    this.authService.logout();
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
