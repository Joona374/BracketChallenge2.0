import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { TooltipComponent } from "../tooltip/tooltip.component";
import { environment } from "../../environments/environment";


@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TooltipComponent],
  templateUrl: "./register.component.html",
  styleUrl: "./register.component.css",
})
export class RegisterComponent {
  formData = {
    username: "",
    teamName: "",
    password: "",
    confirmPassword: "",
    registrationCode: "",
  };

  message: string = "";
  error: string = "";

  constructor(private http: HttpClient) { }

  onSubmit() {
    this.message = ""; // Clear previous messages
    this.error = ""; // Clear previous errors

    if (this.formData.password !== this.formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const payload = {
      username: this.formData.username,
      teamName: this.formData.teamName,
      password: this.formData.password,
      registrationCode: this.formData.registrationCode,
    };

    this.http.post(`${environment.apiUrl}/register`, payload).subscribe({
      next: (response: any) => {
        this.message = response.message;

        // Generate funny news headline in Finnish
        this.http.post(`${environment.apiUrl}/generate-headline`, {
          teamName: this.formData.teamName,
          language: "fi"
        }).subscribe({
          error: (err) => console.error("Failed to generate headline:", err)
        });

        // After successful registration, log the user in
        const loginPayload = {
          username: this.formData.username,
          password: this.formData.password
        };

        this.http.post(`${environment.apiUrl}/login`, loginPayload).subscribe({
          next: (loginResponse: any) => {
            // Save user data to localStorage
            localStorage.setItem("loggedInUser", JSON.stringify(loginResponse));

            // Redirect to homepage
            window.location.href = "/";
          },
          error: (loginError) => {
            this.error = "Registration successful, but automatic login failed. Please login manually.";
            console.error("Auto-login error:", loginError);
          }
        });
      },
      error: (error: any) => {
        this.error =
          error.error.message || "An error occurred during registration.";
      },
    });
  }
}
