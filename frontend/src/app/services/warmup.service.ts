import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WarmupService {
  private hasWarmedUp = false;

  constructor(private http: HttpClient) {}

  /**
   * Send a lightweight request to wake up the Render backend.
   * Only sends once per session to avoid unnecessary requests.
   */
  warmupBackend(): void {
    if (this.hasWarmedUp) {
      return;
    }

    this.hasWarmedUp = true;

    // Use the simple /api endpoint which just returns a welcome message
    this.http.get(`${environment.apiUrl}`, { responseType: 'text' }).subscribe({
      next: () => {
        console.log('Backend warmed up successfully');
      },
      error: () => {
        // Silently fail - this is just a warmup ping
        console.log('Backend warmup ping sent');
      }
    });
  }
}
