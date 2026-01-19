import { Component, OnInit } from "@angular/core";
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
export class LoginComponent implements OnInit {
  formData = {
    username: "",
    password: "",
  };

  message: string = "";
  error: string = "";

  constructor(
    private authService: AuthService,
    private router: Router,
    private warmupService: WarmupService
  ) { }

  ngOnInit(): void {
    // Warm up the backend (Render cold start mitigation)
    this.warmupService.warmupBackend();
  }

  onSubmit() {
    this.message = "";
    this.error = "";

    this.authService.login(this.formData.username, this.formData.password).subscribe({
      next: (response) => {
        this.message = "Login successful!";
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
        this.error = err.error?.error || "Login failed";
      },
    });
  }
}
