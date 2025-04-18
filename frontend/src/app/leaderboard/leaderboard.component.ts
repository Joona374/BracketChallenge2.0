import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from "../../environments/environment";


interface LeaderboardEntry {
  id: number;
  rank: number;
  username: string;
  teamName: string;
  logoUrl?: string; // Add optional logoUrl field
  totalPoints: number;
  bracketPoints: number;
  predictionsPoints: number;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css'
})
export class LeaderboardComponent implements OnInit {
  leaderboardEntries: LeaderboardEntry[] = [];
  sortKey: keyof LeaderboardEntry = 'totalPoints'; // Initialize with totalPoints
  sortAsc = false; // Set to false for descending order (highest points first)
  loading: boolean = false;
  error: string | null = null; // To display error messages

  // To highlight the current user in the table
  currentUserId: number = 0;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    this.currentUserId = user?.id || 0;

    this.loadLeaderboard();
  }

  loadLeaderboard(): void {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/leaderboard`).subscribe({
      next: (data) => {
        this.leaderboardEntries = data;
        this.sortLeaderboard();
        this.updateRanks();
        this.loading = false;
      },
      error: (err) => {
        // console.error('Failed to load leaderboard', err);
        // Set empty leaderboard and show zeros if no data
        this.leaderboardEntries = [];
        this.loading = false;
      }
    });
  }

  // New method to ensure leaderboard is always properly sorted
  sortLeaderboard(): void {
    // Sort the array based on the key and direction
    this.leaderboardEntries.sort((a, b) => {
      const valA = a[this.sortKey];
      const valB = b[this.sortKey];

      // If either value is undefined, handle the comparison accordingly
      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return this.sortAsc ? -1 : 1;
      if (valB === undefined) return this.sortAsc ? 1 : -1;

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;

      // If values are equal, use rank as a tiebreaker (lower rank is better)
      if (a.rank < b.rank) return -1;
      if (a.rank > b.rank) return 1;
      return 0;
    });
  }

  sortBy(key: keyof LeaderboardEntry): void {
    if (this.sortKey === key) {
      // If already sorting by this key, toggle direction
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = false; // Default to descending when switching keys
    }

    this.sortLeaderboard(); // Use the sorting method
    this.updateRanks();
  }

  // updateRanks is no longer needed because the backend now provides correct ranks, including ties.
  // This method is now a no-op.
  updateRanks(): void {
    // No action needed; backend provides correct rank field.
  }

  isCurrentUser(id: number): boolean {
    return id === this.currentUserId;
  }

  // Get the top three teams for the podium display
  getTopThree(): LeaderboardEntry[] {
    // Create a copy of the entries, sort by totalPoints in descending order, and take the first 3
    const sortedEntries = [...this.leaderboardEntries]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 3);

    // If there are fewer than 3 entries, pad the array
    while (sortedEntries.length < 3) {
      sortedEntries.push({
        id: 0,
        rank: sortedEntries.length + 1,
        username: 'N/A',
        teamName: 'No Team',
        totalPoints: 0,
        bracketPoints: 0,
        predictionsPoints: 0
      });
    }

    return sortedEntries;
  }
}
