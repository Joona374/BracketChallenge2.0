import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface LeaderboardEntry {
  id: number;
  rank: number;
  username: string;
  teamName: string;
  totalPoints: number;
  bracketPoints: number;
  lineupPoints: number;
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
  sortKey: keyof LeaderboardEntry | null = 'totalPoints';
  sortAsc = false;
  loading: boolean = false;
  error: string | null = null; // To display error messages

  // To highlight the current user in the table
  currentUserId: number = 0;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    this.currentUserId = user?.id || 0;

    this.loadLeaderboardData();
  }

  loadLeaderboardData(): void {
    this.loading = true;
    this.error = null;

    this.http.get<LeaderboardEntry[]>('http://localhost:5000/api/leaderboard')
      .subscribe({
        next: (data) => {
          this.leaderboardEntries = data;
          this.updateRanks();
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load leaderboard data', err);
          this.error = 'Failed to load leaderboard data. Using mock data instead.';
          // this.loadMockData(); // Fallback to mock data
          this.loading = false;
          this.updateRanks();
        }
      });

  }



  loadMockData(): void {
    this.leaderboardEntries = [
      {
        id: 1,
        rank: 1,
        username: 'IceKing',
        teamName: 'joonanpojat',
        totalPoints: 87,
        bracketPoints: 45,
        lineupPoints: 32,
        predictionsPoints: 10
      },
      {
        id: 2,
        rank: 2,
        username: 'PuckMaster',
        teamName: 'Toronto Titans',
        totalPoints: 76,
        bracketPoints: 30,
        lineupPoints: 36,
        predictionsPoints: 10
      },
      {
        id: 3,
        rank: 3,
        username: 'HockeyFan99',
        teamName: 'Boston Bruisers',
        totalPoints: 70,
        bracketPoints: 40,
        lineupPoints: 20,
        predictionsPoints: 10
      },
      {
        id: 4,
        rank: 4,
        username: 'StanleyCupDreams',
        teamName: 'Pittsburgh Power',
        totalPoints: 65,
        bracketPoints: 25,
        lineupPoints: 30,
        predictionsPoints: 10
      },
      {
        id: 5,
        rank: 5,
        username: 'GoalieGuru',
        teamName: 'Montreal Magic',
        totalPoints: 60,
        bracketPoints: 25,
        lineupPoints: 20,
        predictionsPoints: 15
      },
      {
        id: 6,
        rank: 6,
        username: 'DefenseFirst',
        teamName: 'New York Knights',
        totalPoints: 55,
        bracketPoints: 20,
        lineupPoints: 25,
        predictionsPoints: 10
      },
      {
        id: 7,
        rank: 7,
        username: 'LightTheLamp',
        teamName: 'Tampa Thunderbolts',
        totalPoints: 50,
        bracketPoints: 20,
        lineupPoints: 20,
        predictionsPoints: 10
      },
      {
        id: 8,
        rank: 8,
        username: 'HatTrickHero',
        teamName: 'Vegas Victors',
        totalPoints: 45,
        bracketPoints: 15,
        lineupPoints: 20,
        predictionsPoints: 10
      },
      {
        id: 9,
        rank: 9,
        username: 'BlueLineDefender',
        teamName: 'Nashville Noise',
        totalPoints: 40,
        bracketPoints: 15,
        lineupPoints: 15,
        predictionsPoints: 10
      },
      {
        id: 10,
        rank: 10,
        username: 'TopShelf',
        teamName: 'Edmonton Express',
        totalPoints: 35,
        bracketPoints: 10,
        lineupPoints: 15,
        predictionsPoints: 10
      }
    ];
    this.updateRanks();
  }

  sortBy(key: keyof LeaderboardEntry): void {
    if (this.sortKey === key) {
      // If already sorting by this key, toggle direction
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = false; // Default to ascending when switching keys
    }

    // Sort the array based on the key and direction
    this.leaderboardEntries.sort((a, b) => {
      if (a[key] < b[key]) return this.sortAsc ? -1 : 1;
      if (a[key] > b[key]) return this.sortAsc ? 1 : -1;
      return 0;
    });

    this.updateRanks();
  }

  updateRanks(): void {
    // Update rank based on totalPoints (regardless of current sort)
    const ranked = [...this.leaderboardEntries].sort((a, b) => b.totalPoints - a.totalPoints);
    ranked.forEach((entry, index) => {
      const targetEntry = this.leaderboardEntries.find(e => e.id === entry.id);
      if (targetEntry) {
        targetEntry.rank = index + 1;
      }
    });
  }

  isCurrentUser(id: number): boolean {
    return id === this.currentUserId;
  }
}
