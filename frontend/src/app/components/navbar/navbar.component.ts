import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-navbar",
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  ngOnInit() {
    this.updateTimeLeft();
    this.intervalId = setInterval(() => this.updateTimeLeft(), 1000);

    this.checkViewport();
    window.addEventListener("resize", this.checkViewport.bind(this));
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

  logout(): void {
    localStorage.removeItem("loggedInUser");
    window.location.href = "/";
  }
}
