import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(private http: HttpClient) {}

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

    this.http.post("http://localhost:5000/api/register", payload).subscribe({
      next: (response: any) => {
        this.message = response.message;
      },
      error: (error: any) => {
        this.error =
          error.error.message || "An error occurred during registration.";
      },
    });
  }
}
