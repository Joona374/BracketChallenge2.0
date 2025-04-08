import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.css"],
})
export class LoginComponent {
  formData = {
    username: "",
    password: "",
  };

  message: string = "";
  error: string = "";

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  onSubmit() {
    this.message = "";
    this.error = "";

    this.authService.login(this.formData.username, this.formData.password).subscribe({
      next: (response) => {
        this.message = "Login successful!";
        // Store the full response which includes isAdmin
        localStorage.setItem('loggedInUser', JSON.stringify(response));
        // Navigate to home page after successful login
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error = err.error?.error || "Login failed";
      },
    });
  }
}
