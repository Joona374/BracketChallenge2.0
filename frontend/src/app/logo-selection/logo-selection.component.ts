import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-logo-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logo-selection.component.html',
  styleUrls: ['./logo-selection.component.css']
})
export class LogoSelectionComponent implements OnInit {
  @Output() closeModal = new EventEmitter<void>();
  @Output() logoSelected = new EventEmitter<string>();

  logoUrls: string[] = [];
  loading = true;
  error: string | null = null;
  selectedLogo: string | null = null;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.fetchLogoOptions();
  }

  fetchLogoOptions(): void {
    this.loading = true;
    this.error = null;

    const userId = this.getUserId();
    if (!userId) {
      this.error = 'User session not found. Please log in again.';
      this.loading = false;
      return;
    }

    this.http.get<any>(`http://localhost:5000/api/user-logos?userId=${userId}`).subscribe({
      next: (logos) => {
        // Convert the object of logo URLs to an array and filter out null values
        const allLogos = Object.values(logos);
        this.logoUrls = allLogos.filter(logo => logo !== null) as string[];
        console.log('Fetched logo URLs:', this.logoUrls);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching logo options:', err);
        this.error = 'Logo vaihtoehtojen lataus epäonnistui. Yritä uudelleen myöhemmin.';
        this.loading = false;
      }
    });
  }

  selectLogo(url: string): void {
    this.selectedLogo = url;
  }

  saveSelection(): void {
    if (!this.selectedLogo) return;

    const userId = this.getUserId();
    if (!userId) {
      this.error = 'User session not found. Please log in again.';
      return;
    }

    this.http.post('http://localhost:5000/api/user/logo', {
      userId: userId,
      logoUrl: this.selectedLogo
    }).subscribe({
      next: () => {
        if (this.selectedLogo) {
          this.logoSelected.emit(this.selectedLogo);
        }
        this.closeModal.emit();
        // Update the user in localStorage with new logo
        if (this.selectedLogo) {
          this.updateUserLogo(this.selectedLogo);

          // Dispatch a custom event that other components can listen for
          window.dispatchEvent(new CustomEvent('user-logo-updated', {
            detail: { logoUrl: this.selectedLogo }
          }));
        }
      },
      error: (err) => {
        console.error('Error saving logo selection:', err);
        this.error = 'Failed to save your logo selection. Please try again.';
      }
    });
  }

  private getUserId(): number | null {
    const storedUser = localStorage.getItem('loggedInUser');
    if (!storedUser) return null;

    try {
      const user = JSON.parse(storedUser);
      return user.id;
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return null;
    }
  }

  private updateUserLogo(logoUrl: string): void {
    const storedUser = localStorage.getItem('loggedInUser');
    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);
      user.logoUrl = logoUrl;
      localStorage.setItem('loggedInUser', JSON.stringify(user));
    } catch (e) {
      console.error('Error updating user logo in localStorage:', e);
    }
  }

  cancel(): void {
    this.closeModal.emit();
  }
}
