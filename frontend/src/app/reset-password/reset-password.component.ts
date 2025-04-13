import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { environment } from "../../environments/environment";


@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent {
  formData = {
    username: '',
    resetCode: '',
    newPassword: '',
    confirmPassword: ''
  };

  message: string = '';
  error: string = '';

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  onSubmit() {
    this.message = '';
    this.error = '';

    if (this.formData.newPassword !== this.formData.confirmPassword) {
      this.error = 'Salasanat eivät täsmää!';
      return;
    }

    const payload = {
      username: this.formData.username,
      resetCode: this.formData.resetCode,
      newPassword: this.formData.newPassword
    };

    this.http.post(`${environment.apiUrl}/reset-password`, payload).subscribe({
      next: (response: any) => {
        this.message = response.message;
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error) => {
        this.error = error.error.error || 'Salasanan nollaus epäonnistui';
      }
    });
  }
}
