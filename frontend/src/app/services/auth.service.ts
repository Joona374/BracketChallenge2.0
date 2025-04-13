import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from "../../environments/environment";


export interface User {
    id: number;
    username: string;
    teamName: string;
    logoUrl?: string;
}

@Injectable({
    providedIn: 'root'
})

export class AuthService {
    private readonly API_URL = `${environment.apiUrl}`;
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient, private router: Router) {
        // Load user from localStorage on service init
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            this.currentUserSubject.next(JSON.parse(storedUser));
        }
    }

    login(username: string, password: string): Observable<any> {
        return this.http.post<any>(`${this.API_URL}/login`, { username, password })
            .pipe(
                tap(response => {
                    if (response && response.id) {
                        // Store user details and update current user subject
                        const user: User = {
                            id: response.id,
                            username: response.username,
                            teamName: response.teamName,
                            logoUrl: response.logoUrl
                        };
                        localStorage.setItem('loggedInUser', JSON.stringify(user));
                        this.currentUserSubject.next(user);
                    }
                })
            );
    }

    logout(): void {
        // Remove user from local storage and reset the subject
        localStorage.removeItem('loggedInUser');
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
    }

    isLoggedIn(): boolean {
        return !!this.currentUserSubject.value;
    }

    getCurrentUser(): User | null {
        return this.currentUserSubject.value;
    }

    getUserId(): string | null {
        const user = this.getCurrentUser();
        return user ? user.id.toString() : null;
    }

    updateUserLogo(logoUrl: string): void {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            currentUser.logoUrl = logoUrl;
            localStorage.setItem('loggedInUser', JSON.stringify(currentUser));
            // Notify any subscribers about the change
            this.currentUserSubject.next(currentUser);
        }
    }
}