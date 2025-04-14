import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LogoSelectionComponent } from '../logo-selection/logo-selection.component';
import { Player } from '../models/player.model';
import { environment } from "../../environments/environment";

interface User {
  id: number;
  username: string;
  teamName: string;
  logoUrl?: string;
}

interface BracketRound {
  name: string;
  correct: number;
  avgCorrect: number;
  bestCorrect: number;
  points: number;
  avgPoints: number;
  bestPoints: number;
}

interface TeamInfo {
  name: string;
  logoUrl: string;
  isActive: boolean;
  odds?: string;
}

interface MatchupTeam {
  name: string;
  logoUrl: string;
}

interface KeyMatchup {
  homeTeam: MatchupTeam;
  awayTeam: MatchupTeam;
  seriesStatus: string;
  nextGame?: string;
  yourPick: 'home' | 'away' | null;
}

interface BracketSummary {
  rounds: BracketRound[];
  totalCorrect: number;
  avgTotalCorrect: number;
  bestTotalCorrect: number;
  avgTotalPoints: number;
  bestTotalPoints: number;
  completed: number;
  total: number;
}

interface Trade {
  playerOut: string;
  playerIn: string;
  positionOut: string;
  positionIn: string;
  date: string;
}

interface LineupSummary {
  lineup: { [key: string]: number };
  remainingTrades: number;
  unusedBudget: number;
  totalValue: number;
  tradeHistory?: Trade[];
}

interface LineupPlayer {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  team: string;
  price: number;
}

interface PredictionCategory {
  name: string;
  userPicks: string[];
  currentTop3: string[];
  correctPicks: number;
}

interface ConnSmythe {
  player: string;
  teamLogo: string;
}

interface PredictionsSummary {
  completed: number;
  totalToComplete: number;
  top3Picks: string[];
  categories: PredictionCategory[];
  connSmythe?: ConnSmythe;
  totalCorrect: number;
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
  bracketSummary: BracketSummary = {
    rounds: [
      {
        name: 'First Round',
        correct: 6,
        avgCorrect: 5.2,
        bestCorrect: 8,
        points: 12,
        avgPoints: 10.4,
        bestPoints: 16
      },
      {
        name: 'Second Round',
        correct: 2,
        avgCorrect: 2.5,
        bestCorrect: 4,
        points: 8,
        avgPoints: 10,
        bestPoints: 16
      },
      {
        name: 'Conference Finals',
        correct: 1,
        avgCorrect: 0.8,
        bestCorrect: 2,
        points: 10,
        avgPoints: 8,
        bestPoints: 20
      },
      {
        name: 'Stanley Cup Final',
        correct: 0,
        avgCorrect: 0.3,
        bestCorrect: 1,
        points: 0,
        avgPoints: 3,
        bestPoints: 10
      }
    ],
    totalCorrect: 9,
    avgTotalCorrect: 8.8,
    bestTotalCorrect: 15,
    avgTotalPoints: 31.4,
    bestTotalPoints: 62,
    completed: 12,
    total: 15
  };
  lineupSummary: LineupSummary = {
    lineup: {},
    remainingTrades: 9,
    unusedBudget: 2000000,
    totalValue: 2000000,
    tradeHistory: []
  };
  predictionsSummary: PredictionsSummary = {
    completed: 0,
    totalToComplete: 3,
    top3Picks: [],
    categories: [],
    totalCorrect: 0
  };

  points = {
    total: 0,
    bracket: 0,
    lineup: 0,
    predictions: 0
  };

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

    this.http.get(`${environment.apiUrl}/user/stats?userId=${userId}`).subscribe({
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

    this.http.get(`${environment.apiUrl}/bracket/summary?userId=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.bracketSummary = data;
        }
      },
      error: (err) => {
        console.error("Failed to load bracket summary", err);
        this.bracketSummary = {
          rounds: [
            {
              name: 'Ensimmäinen kierros',
              correct: 6,
              avgCorrect: 5.2,
              bestCorrect: 8,
              points: 12,
              avgPoints: 10.4,
              bestPoints: 16
            },
            {
              name: 'Toinen kierros',
              correct: 2,
              avgCorrect: 2.5,
              bestCorrect: 4,
              points: 8,
              avgPoints: 10,
              bestPoints: 16
            },
            {
              name: 'Konferenssi finaalit',
              correct: 1,
              avgCorrect: 0.8,
              bestCorrect: 2,
              points: 10,
              avgPoints: 8,
              bestPoints: 20
            },
            {
              name: 'Stanley Cup Finaali',
              correct: 0,
              avgCorrect: 0.3,
              bestCorrect: 1,
              points: 0,
              avgPoints: 3,
              bestPoints: 10
            }
          ],
          totalCorrect: 9,
          avgTotalCorrect: 8.8,
          bestTotalCorrect: 15,
          avgTotalPoints: 31.4,
          bestTotalPoints: 62,
          completed: 12,
          total: 15
        };
      }
    });
  }

  loadLineupSummary(): void {
    const userId = this.user?.id;
    if (!userId) return;

    this.http.get(`${environment.apiUrl}/lineup/get?user_id=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.lineupSummary = {
            lineup: data.lineup || {},
            remainingTrades: data.remainingTrades || 9,
            unusedBudget: data.unusedBudget || 2000000,
            totalValue: data.totalValue || 2000000,
            tradeHistory: [
              {
                playerOut: "Mikko Rantanen",
                playerIn: "Nathan MacKinnon",
                positionOut: "OL",
                positionIn: "KH",
                date: "15.4.2025"
              },
              {
                playerOut: "Andrei Vasilevskiy",
                playerIn: "Igor Shesterkin",
                positionOut: "MV",
                positionIn: "MV",
                date: "17.4.2025"
              },
              {
                playerOut: "Roman Josi",
                playerIn: "Cale Makar",
                positionOut: "VP",
                positionIn: "VP",
                date: "20.4.2025"
              },
              {
                playerOut: "Brad Marchand",
                playerIn: "Artemi Panarin",
                positionOut: "VL",
                positionIn: "VL",
                date: "22.4.2025"
              },
              {
                playerOut: "Victor Hedman",
                playerIn: "Quinn Hughes",
                positionOut: "VP",
                positionIn: "VP",
                date: "25.4.2025"
              }
            ]
          };
        }
      },
      error: (err) => {
        console.error("Failed to load lineup summary", err);
        this.lineupSummary = {
          lineup: {},
          remainingTrades: 9,
          unusedBudget: 2000000,
          totalValue: 2000000,
          tradeHistory: [
            {
              playerOut: "Mikko Rantanen",
              playerIn: "Nathan MacKinnon",
              positionOut: "OL",
              positionIn: "KH",
              date: "15.4.2025"
            },
            {
              playerOut: "Andrei Vasilevskiy",
              playerIn: "Igor Shesterkin",
              positionOut: "MV",
              positionIn: "MV",
              date: "17.4.2025"
            },
            {
              playerOut: "Roman Josi",
              playerIn: "Cale Makar",
              positionOut: "VP",
              positionIn: "VP",
              date: "20.4.2025"
            },
            {
              playerOut: "Brad Marchand",
              playerIn: "Artemi Panarin",
              positionOut: "VL",
              positionIn: "VL",
              date: "22.4.2025"
            },
            {
              playerOut: "Victor Hedman",
              playerIn: "Quinn Hughes",
              positionOut: "VP",
              positionIn: "VP",
              date: "25.4.2025"
            }
          ]
        };
      }
    });
  }

  loadPlayers(): void {
    this.http.get<any[]>(`${environment.apiUrl}/players`).subscribe({
      next: (data) => {
        this.allPlayers = data.map(player => ({
          id: player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          position: player.position,
          team: player.team_abbr,
          price: player.price,
          isU23: player.is_U23,
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

    this.http.get(`${environment.apiUrl}/predictions/summary?userId=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.predictionsSummary = data;
        }
      },
      error: (err) => {
        console.error("Failed to load predictions summary", err);
        this.predictionsSummary = {
          completed: 17,
          totalToComplete: 21,
          top3Picks: ["Nathan MacKinnon", "Connor McDavid", "Leon Draisaitl"],
          categories: [
            {
              name: "Maalit",
              userPicks: ["Auston Matthews", "Steven Stamkos", "David Pastrnak"],
              currentTop3: ["Auston Matthews", "Sam Reinhart", "Zach Hyman"],
              correctPicks: 1
            },
            {
              name: "Syötöt",
              userPicks: ["Connor McDavid", "Nikita Kucherov", "Leon Draisaitl"],
              currentTop3: ["Nikita Kucherov", "Connor McDavid", "Nathan MacKinnon"],
              correctPicks: 2
            },
            {
              name: "Pisteet",
              userPicks: ["Connor McDavid", "Nikita Kucherov", "Nathan MacKinnon"],
              currentTop3: ["Nikita Kucherov", "Connor McDavid", "Nathan MacKinnon"],
              correctPicks: 3
            },
            {
              name: "Plus/Minus",
              userPicks: ["Cale Makar", "Victor Hedman", "Charlie McAvoy"],
              currentTop3: ["Cale Makar", "Devon Toews", "Mikko Rantanen"],
              correctPicks: 1
            },
            {
              name: "Torjuntaprosentti",
              userPicks: ["Andrei Vasilevskiy", "Igor Shesterkin", "Jake Oettinger"],
              currentTop3: ["Linus Ullmark", "Igor Shesterkin", "Jeremy Swayman"],
              correctPicks: 1
            },
            {
              name: "Voitot",
              userPicks: ["Andrei Vasilevskiy", "Igor Shesterkin", "Sergei Bobrovsky"],
              currentTop3: ["Andrei Vasilevskiy", "Frederik Andersen", "Jeremy Swayman"],
              correctPicks: 1
            }
          ],
          connSmythe: {
            player: "Nathan MacKinnon",
            teamLogo: "assets/team-logos/colorado.png"
          },
          totalCorrect: 9
        };
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
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

  openLogoSelectionModal(): void {
    this.showLogoSelectionModal = true;
  }

  closeLogoSelectionModal(): void {
    this.showLogoSelectionModal = false;
  }

  handleLogoSelected(logoUrl: string): void {
    if (this.user) {
      this.user.logoUrl = logoUrl;
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
