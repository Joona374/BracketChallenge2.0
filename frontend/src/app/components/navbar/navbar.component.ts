import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { AuthService, User } from '../../services/auth.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { DeadlineService } from '../../services/deadline.service';

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

  deadline: Date | null = null; // Will be set from backend
  timeLeft: string = "";
  private intervalId: any;

  isMobileView = false;
  menuOpen = false;
  isDropdownOpen = false;
  user: any = null; // User property

  // Reference to event listener for cleanup
  private logoUpdateListener: any;

  constructor(private deadlineService: DeadlineService) { }

  ngOnInit() {
    // Fetch deadline from backend
    this.deadlineService.getDeadlineStatus().subscribe(status => {
      this.deadline = new Date(status.deadline_timestamp);
      this.updateTimeLeft();
      this.intervalId = setInterval(() => this.updateTimeLeft(), 1000);
    });

    this.checkViewport();
    window.addEventListener("resize", this.checkViewport.bind(this));

    // Update how we load the user object
    this.loadUserFromStorage();

    // Add event listener to update user when storage changes
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Add listener for logo updates
    this.logoUpdateListener = this.handleLogoUpdate.bind(this);
    window.addEventListener('user-logo-updated', this.logoUpdateListener);

    // Add listener for user data updates
    window.addEventListener('user-data-updated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.user = customEvent.detail;
      this.user = (event as CustomEvent).detail;
      // Validate the logo URL exists and is not empty
      if (this.user && (!this.user.logoUrl || this.user.logoUrl === "null" || this.user.logoUrl === "undefined")) {
        this.user.logoUrl = null;
      }
      console.log('User updated in navbar:', this.user);
    });
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
    window.removeEventListener("resize", this.checkViewport.bind(this));
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
    window.removeEventListener('user-logo-updated', this.logoUpdateListener);

  }

  loadUserFromStorage() {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);

        // Validate the logo URL exists and is not empty
        if (this.user && (!this.user.logoUrl || this.user.logoUrl === "null" || this.user.logoUrl === "undefined")) {
          this.user.logoUrl = null;
        }


      } catch (error) {
        this.user = null;
      }
    }
  }

  handleStorageChange(event: StorageEvent) {
    if (event.key === 'loggedInUser') {
      this.loadUserFromStorage();
    }
  }

  handleLogoUpdate(event: CustomEvent) {
    if (this.user) {
      this.user.logoUrl = event.detail.logoUrl;

      // Validate the logo URL exists and is not empty
      if (!this.user.logoUrl || this.user.logoUrl === "null" || this.user.logoUrl === "undefined") {
        this.user.logoUrl = null;
      }
      console.log('Logo updated in navbar:', this.user.logoUrl);
    }
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
    if (!this.deadline) {
      this.timeLeft = '';
      return;
    }
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
    this.user = null;
    window.location.href = "/";
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.menuOpen = false; // Also close the mobile menu
  }
}
