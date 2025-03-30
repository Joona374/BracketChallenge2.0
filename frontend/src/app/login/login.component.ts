import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { RouterModule } from "@angular/router";

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

  constructor(private http: HttpClient) {}

  onSubmit() {
    this.message = "";
    this.error = "";

    this.http.post("http://localhost:5000/api/login", this.formData).subscribe({
      next: (res: any) => {
        localStorage.setItem("loggedInUser", JSON.stringify(res));
        this.message = res.message || "Login successful!";
        window.location.href = "/";
      },
      error: (err) => {
        this.error = err.error.error || "Login failed";
      },
    });
  }
}
