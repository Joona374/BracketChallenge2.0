import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DeadlineStatus {
    deadline_passed: boolean;
    time_remaining: string;
    deadline_timestamp: string;
}

@Injectable({
    providedIn: 'root'
})
export class DeadlineService {
    private apiUrl = `${environment.apiUrl}/deadline/status`;
    private deadlineStatusSubject = new BehaviorSubject<DeadlineStatus | null>(null);
    private deadlineStatus$ = this.deadlineStatusSubject.asObservable();
    private cachedStatus: Observable<DeadlineStatus> | null = null;

    // Helsinki time (UTC+3) deadline: April 20, 2025 00:00
    private helsinkiDeadline = new Date('2025-04-10T00:00:00.000+03:00');

    constructor(private http: HttpClient) { }

    /**
     * Get the current deadline status
     */
    getDeadlineStatus(): Observable<DeadlineStatus> {
        if (!this.cachedStatus) {
            this.cachedStatus = this.http.get<DeadlineStatus>(this.apiUrl).pipe(
                // Adjust the backend response to use Helsinki time
                map(status => {
                    const now = new Date();
                    const deadline_passed = now >= this.helsinkiDeadline;

                    // Calculate time remaining in Helsinki timezone
                    let time_remaining = 'Unknown';
                    if (now < this.helsinkiDeadline) {
                        const diff = this.helsinkiDeadline.getTime() - now.getTime();
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        time_remaining = `${days} days, ${hours} hours, ${minutes} minutes`;
                    } else {
                        time_remaining = 'Deadline has passed';
                    }

                    return {
                        deadline_passed,
                        time_remaining,
                        deadline_timestamp: this.helsinkiDeadline.toISOString()
                    };
                }),
                tap(status => this.deadlineStatusSubject.next(status)),
                catchError(error => {
                    console.error('Error fetching deadline status:', error);

                    // Use local calculation for deadline if API fails
                    const now = new Date();
                    const deadline_passed = now >= this.helsinkiDeadline;

                    let time_remaining = 'Unknown';
                    if (now < this.helsinkiDeadline) {
                        const diff = this.helsinkiDeadline.getTime() - now.getTime();
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        time_remaining = `${days} days, ${hours} hours, ${minutes} minutes`;
                    } else {
                        time_remaining = 'Deadline has passed';
                    }

                    return of({
                        deadline_passed,
                        time_remaining,
                        deadline_timestamp: this.helsinkiDeadline.toISOString()
                    });
                }),
                // Cache the response for a short time
                shareReplay({ bufferSize: 1, refCount: true, windowTime: 60000 })
            );
        }
        return this.cachedStatus;
    }

    /**
     * Check if the deadline has passed
     */
    isDeadlinePassed(): Observable<boolean> {
        return this.getDeadlineStatus().pipe(
            map(status => status.deadline_passed)
        );
    }

    /**
     * Get the time remaining until the deadline
     */
    getTimeRemaining(): Observable<string> {
        return this.getDeadlineStatus().pipe(
            map(status => status.time_remaining)
        );
    }

    /**
     * Force reload the deadline status (useful after component navigation)
     */
    refreshDeadlineStatus(): Observable<DeadlineStatus> {
        this.cachedStatus = null;
        return this.getDeadlineStatus();
    }
}