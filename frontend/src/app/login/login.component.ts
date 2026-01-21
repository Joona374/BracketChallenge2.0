import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { WarmupService } from "../services/warmup.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.css"],
})
export class LoginComponent implements OnInit, OnDestroy {
  formData = {
    username: "",
    password: "",
  };

  message: string = "";
  error: string = "";
  isLoading: boolean = false;
  loadingStartTime: number = 0;
  loadingMessage: string = "";
  loadingMessageIndex: number = 0;
  loadingTimer: any;
  retryTimer: any;

  private loadingMessages = [
    "Palvelin herää kylmästä tilasta... Odota hetki.",
    "Palvelin käynnistyy... Kiitos kärsivällisyydestä.",
    "Vielä hetki... Palvelin on lähes valmis.",
    "Lähes valmista... Odota vielä vähän.",
    "Palvelin käynnistyy... Kiitos odottamisesta."
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private warmupService: WarmupService
  ) { }

  ngOnInit(): void {
    // Warm up the backend (Render cold start mitigation)
    this.warmupService.warmupBackend();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private startLoadingState(): void {
    this.isLoading = true;
    this.loadingStartTime = Date.now();
    this.loadingMessageIndex = 0;
    this.loadingMessage = this.loadingMessages[0];

    // Update message every 10 seconds
    this.loadingTimer = setInterval(() => {
      this.loadingMessageIndex = (this.loadingMessageIndex + 1) % this.loadingMessages.length;
      this.loadingMessage = this.loadingMessages[this.loadingMessageIndex];
    }, 10000);

    // Show retry message after 90 seconds
    this.retryTimer = setTimeout(() => {
      this.loadingMessage = "Palvelin näyttää olevan hidas. Yritä uudelleen tai odota vielä.";
    }, 90000);
  }

  private stopLoadingState(): void {
    this.isLoading = false;
    this.clearTimers();
  }

  onSubmit() {
    this.message = "";
    this.error = "";
    this.startLoadingState();

    this.authService.login(this.formData.username, this.formData.password).subscribe({
      next: (response) => {
        this.stopLoadingState();
        this.message = "Kirjautuminen onnistui!";
        // Store the full response which includes isAdmin and logoUrl
        localStorage.setItem('loggedInUser', JSON.stringify(response));

        // Dispatch a custom event to notify other components about the updated user data
        window.dispatchEvent(new CustomEvent('user-data-updated', { detail: response }));

        // Navigate to home page after ensuring the data is processed
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 100); // Small delay to ensure data is available
      },
      error: (err) => {
        this.stopLoadingState();
        this.error = err.error?.error || "Kirjautuminen epäonnistui";
      },
    });
  }
}
