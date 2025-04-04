import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface User {
  id: number;
  username: string;
  teamName: string;
}

interface BracketSummary {
  completed: number;
  total: number;
  topPick?: string;
}

interface LineupSummary {
  forwards: number;
  defenders: number;
  goalies: number;
  totalBudget: number;
  usedBudget: number;
}

interface PredictionsSummary {
  completed: number;
  totalToComplete: number;
  top3Picks: string[];
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.css'
})
export class UserDashboardComponent implements OnInit {
  user: User | null = null;
  bracketSummary: BracketSummary = { completed: 0, total: 15 };
  lineupSummary: LineupSummary = {
    forwards: 0,
    defenders: 0,
    goalies: 0,
    totalBudget: 5000000,
    usedBudget: 0,
  };
  predictionsSummary: PredictionsSummary = {
    completed: 0,
    totalToComplete: 3,
    top3Picks: [],
  };

  // Mock point values (to be implemented fully later)
  points = {
    total: 0,
    bracket: 0,
    lineup: 0,
    predictions: 0
  };

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    const storedUser = localStorage.getItem("loggedInUser");

    if (!storedUser) {
      window.location.href = "/";
      return;
    }

    this.user = JSON.parse(storedUser);

    // Load user's data
    this.loadBracketSummary();
    this.loadLineupSummary();
    this.loadPredictionsSummary();
  }

  loadBracketSummary(): void {
    const userId = this.user?.id;
    if (!userId) return;

    this.http.get(`http://localhost:5000/api/bracket/summary?userId=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.bracketSummary = data;
        }
      },
      error: (err) => {
        console.error("Failed to load bracket summary", err);
        // Use mock data when API fails or isn't implemented yet
        this.bracketSummary = {
          completed: 8,
          total: 15,
          topPick: "Colorado Avalanche"
        };
        this.points.bracket = 24;
        this.points.total += this.points.bracket;
      }
    });
  }

  loadLineupSummary(): void {
    const userId = this.user?.id;
    if (!userId) return;

    this.http.get(`http://localhost:5000/api/lineup/summary?userId=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.lineupSummary = data;
        }
      },
      error: (err) => {
        console.error("Failed to load lineup summary", err);
        // Use mock data when API fails or isn't implemented yet
        this.lineupSummary = {
          forwards: 6,
          defenders: 4,
          goalies: 1,
          totalBudget: 5000000,
          usedBudget: 4250000
        };
        this.points.lineup = 18;
        this.points.total += this.points.lineup;
      }
    });
  }

  loadPredictionsSummary(): void {
    const userId = this.user?.id;
    if (!userId) return;

    this.http.get(`http://localhost:5000/api/predictions/summary?userId=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.predictionsSummary = data;
        }
      },
      error: (err) => {
        console.error("Failed to load predictions summary", err);
        // Use mock data when API fails or isn't implemented yet
        this.predictionsSummary = {
          completed: 2,
          totalToComplete: 3,
          top3Picks: ["Nathan MacKinnon", "Connor McDavid"]
        };
        this.points.predictions = 12;
        this.points.total += this.points.predictions;
      }
    });
  }

  formatCurrency(value: number): string {
    return "$" + value.toLocaleString();
  }

  getProgressPercentage(completed: number, total: number): number {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  getUserInitials(): string {
    if (!this.user?.username) return "";
    return this.user.username
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }
}
