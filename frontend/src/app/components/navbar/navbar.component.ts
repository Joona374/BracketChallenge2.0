import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { AuthService, User } from '../../services/auth.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: "app-navbar",
  standalone: true,
  imports: [CommonModule, RouterModule, ClickOutsideDirective],
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.css"],
})
export class NavbarComponent implements OnInit, OnDestroy {
  get isLoggedIn(): boolean {
    return !!localStorage.getItem("loggedInUser");
  }

  deadline = new Date("2025-04-20T00:00:00+03:00"); // Set your lock-in deadline (Helsinki time)
  timeLeft: string = "";
  private intervalId: any;

  isMobileView = false;
  menuOpen = false;
  isDropdownOpen = false;
  user: any = null; // Add user property

  ngOnInit() {
    this.updateTimeLeft();
    this.intervalId = setInterval(() => this.updateTimeLeft(), 1000);

    this.checkViewport();
    window.addEventListener("resize", this.checkViewport.bind(this));

    // Load user from localStorage
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      this.user = JSON.parse(storedUser);
    }
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
    window.removeEventListener("resize", this.checkViewport.bind(this));
  }

  checkViewport() {
    this.isMobileView = window.innerWidth < 1000;
    if (!this.isMobileView) this.menuOpen = false;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  updateTimeLeft() {
    const now = new Date();
    const diff = this.deadline.getTime() - now.getTime();

    if (diff <= 0) {
      this.timeLeft = "LOCKED";
      clearInterval(this.intervalId);
      return;
    }

    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    this.timeLeft = `${days > 0 ? days + ":" : ""}${this.pad(hours)}:${this.pad(
      minutes
    )}:${this.pad(seconds)}`;
  }

  pad(n: number): string {
    return n.toString().padStart(2, "0");
  }

  getUserInitials(): string {
    if (!this.user?.username) return "";

    return this.user.username
      .split(" ")
      .map((name: string) => name[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }

  logout(): void {
    localStorage.removeItem("loggedInUser");
    this.user = null; // Clear user property when logging out
    window.location.href = "/";
  }
}
