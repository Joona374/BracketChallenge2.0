import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LogoSelectionComponent } from '../logo-selection/logo-selection.component';
import { Player } from '../models/player.model';

interface User {
  id: number;
  username: string;
  teamName: string;
  logoUrl?: string;
}

interface BracketSummary {
  completed: number;
  total: number;
  topPick?: string;
}

interface LineupSummary {
  lineup: { [key: string]: number };  // Changed from LineupPlayer | null to number
  remainingTrades: number;
  unusedBudget: number;
  totalValue: number;
}

interface LineupPlayer {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  team: string;
  price: number;
}

interface PredictionsSummary {
  completed: number;
  totalToComplete: number;
  top3Picks: string[];
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LogoSelectionComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.css'
})
export class UserDashboardComponent implements OnInit {
  user: User | null = null;
  userRank: number | null = null;
  bracketSummary: BracketSummary = { completed: 0, total: 15 };
  lineupSummary: LineupSummary = {
    lineup: {},
    remainingTrades: 9,
    unusedBudget: 5000000,
    totalValue: 5000000
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

  // Logo selection modal control
  showLogoSelectionModal = false;

  private allPlayers: Player[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadUserFromStorage();
    this.loadUserStats();
    this.loadBracketSummary();
    this.loadLineupSummary();
    this.loadPredictionsSummary();
    this.loadPlayers();
  }

  loadUserFromStorage(): void {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
        this.user = null;
      }
    } else {
      window.location.href = "/";
    }
  }

  loadUserStats(): void {
    const userId = this.user?.id;
    if (!userId) return;

    this.http.get(`http://localhost:5000/api/user/stats?userId=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.userRank = data.rank;
          if (data.points) {
            this.points = {
              total: data.points.total || 0,
              bracket: data.points.bracket || 0,
              lineup: data.points.lineup || 0,
              predictions: data.points.predictions || 0
            };
          }
        }
      },
      error: (err) => {
        console.error("Failed to load user stats", err);
        // Reset points to 0 if there's an error
        this.points = {
          total: 0,
          bracket: 0,
          lineup: 0,
          predictions: 0
        };
      }
    });
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
      }
    });
  }

  loadLineupSummary(): void {
    const userId = this.user?.id;
    if (!userId) return;

    this.http.get(`http://localhost:5000/api/lineup/get?user_id=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.lineupSummary = {
            lineup: data.lineup || {},
            remainingTrades: data.remainingTrades || 9,
            unusedBudget: data.unusedBudget || 5000000,
            totalValue: data.totalValue || 5000000
          };
        }
      },
      error: (err) => {
        console.error("Failed to load lineup summary", err);
        this.lineupSummary = {
          lineup: {},
          remainingTrades: 9,
          unusedBudget: 5000000,
          totalValue: 5000000
        };
      }
    });
  }

  loadPlayers(): void {
    this.http.get<any[]>('http://localhost:5000/api/players').subscribe({
      next: (data) => {
        this.allPlayers = data.map(player => ({
          id: player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          position: player.position,
          team: player.team_abbr,
          price: player.price,
          isU23: player.is_U23,
          // ... other fields mapped as needed
        }));
      },
      error: (err) => {
        console.error("Failed to load players", err);
        this.allPlayers = [];
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

  // Logo selection handling
  openLogoSelectionModal(): void {
    this.showLogoSelectionModal = true;
  }

  closeLogoSelectionModal(): void {
    this.showLogoSelectionModal = false;
  }

  handleLogoSelected(logoUrl: string): void {
    if (this.user) {
      this.user.logoUrl = logoUrl;
      // Logo update is now handled by the event dispatch in the LogoSelectionComponent
      // Other components will update automatically when they receive the event
    }
  }

  getPlayerByPosition(position: string): LineupPlayer | null {
    if (position === "MV") {
      position = "G"
    } else if (position === "OL") {
      position = "R"
    } else if (position === "KH") {
      position = "C"
    } else if (position === "VL") {
      position = "L"
    } else if (position === "VP") {
      position = "LD"
    } else if (position === "OP") {
      position = "RD"
    }


    if (!this.lineupSummary.lineup || !this.allPlayers.length) return null;

    const playerId = this.lineupSummary.lineup[position];
    if (!playerId) return null;

    const player = this.allPlayers.find(p => p.id === playerId);
    if (!player) return null;

    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      team: player.team,
      price: player.price
    };
  }
}
