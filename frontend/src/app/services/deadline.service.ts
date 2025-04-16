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

    // We no longer use a hardcoded deadline - this is fetched from the server

    constructor(private http: HttpClient) { }

    /**
     * Get the current deadline status
     */
    getDeadlineStatus(): Observable<DeadlineStatus> {
        if (!this.cachedStatus) {
            this.cachedStatus = this.http.get<DeadlineStatus>(this.apiUrl).pipe(
                tap(status => this.deadlineStatusSubject.next(status)),
                catchError(error => {
                    console.error('Error fetching deadline status:', error);

                    // Return a fallback status if the API call fails
                    return of({
                        deadline_passed: false,
                        time_remaining: 'Unknown',
                        deadline_timestamp: new Date().toISOString()
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
     * Get the deadline timestamp
     */
    getDeadlineTimestamp(): Observable<string> {
        return this.getDeadlineStatus().pipe(
            map(status => status.deadline_timestamp)
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