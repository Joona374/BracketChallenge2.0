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

interface MatchupComparison {
  matchupTitle?: string; // Now optional since we're not displaying it
  userPickedTeam: string;
  actualWinner: string;
  userPickedGames: number;
  actualGames: number;
  userCorrect: boolean;
  gamesCorrect: boolean;
}

interface RoundMatchups {
  name: string;
  matchups: MatchupComparison[];
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
  roundMatchups: RoundMatchups[];
}

interface Trade {
  playerOut: string;
  playerIn: string;
  positionOut: string;
  positionIn: string;
  date: string;
  playerOutId?: number; // Added for direct player ID reference
  playerInId?: number;  // Added for direct player ID reference
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
  userPicks: Player[];
  currentTop3: Player[];
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
    total: 15,
    roundMatchups: [
      {
        name: 'Ensimmäinen kierros',
        matchups: [
          {
            userPickedTeam: "BOS",
            actualWinner: "BOS",
            userPickedGames: 6,
            actualGames: 7,
            userCorrect: true,
            gamesCorrect: false
          },
          {
            userPickedTeam: "FLA",
            actualWinner: "FLA",
            userPickedGames: 5,
            actualGames: 5,
            userCorrect: true,
            gamesCorrect: true
          },
          {
            userPickedTeam: "NYR",
            actualWinner: "NYR",
            userPickedGames: 4,
            actualGames: 5,
            userCorrect: true,
            gamesCorrect: false
          },
          {
            userPickedTeam: "CAR",
            actualWinner: "CAR",
            userPickedGames: 6,
            actualGames: 6,
            userCorrect: true,
            gamesCorrect: true
          },
          {
            userPickedTeam: "DAL",
            actualWinner: "VGK",
            userPickedGames: 7,
            actualGames: 6,
            userCorrect: false,
            gamesCorrect: false
          },
          {
            userPickedTeam: "COL",
            actualWinner: "COL",
            userPickedGames: 6,
            actualGames: 5,
            userCorrect: true,
            gamesCorrect: false
          },
          {
            userPickedTeam: "EDM",
            actualWinner: "EDM",
            userPickedGames: 5,
            actualGames: 5,
            userCorrect: true,
            gamesCorrect: true
          },
          {
            userPickedTeam: "VAN",
            actualWinner: "VAN",
            userPickedGames: 7,
            actualGames: 5,
            userCorrect: true,
            gamesCorrect: false
          }
        ]
      },
      {
        name: 'Toinen kierros',
        matchups: [
          {
            userPickedTeam: "BOS",
            actualWinner: "FLA",
            userPickedGames: 7,
            actualGames: 7,
            userCorrect: false,
            gamesCorrect: true
          },
          {
            userPickedTeam: "CAR",
            actualWinner: "NYR",
            userPickedGames: 6,
            actualGames: 6,
            userCorrect: false,
            gamesCorrect: true
          },
          {
            userPickedTeam: "COL",
            actualWinner: "COL",
            userPickedGames: 7,
            actualGames: 6,
            userCorrect: true,
            gamesCorrect: false
          },
          {
            userPickedTeam: "EDM",
            actualWinner: "EDM",
            userPickedGames: 6,
            actualGames: 6,
            userCorrect: true,
            gamesCorrect: true
          }
        ]
      },
      {
        name: 'Konferenssifinaalit',
        matchups: [
          {
            userPickedTeam: "NYR",
            actualWinner: "FLA",
            userPickedGames: 7,
            actualGames: 6,
            userCorrect: false,
            gamesCorrect: false
          },
          {
            userPickedTeam: "COL",
            actualWinner: "EDM",
            userPickedGames: 7,
            actualGames: 6,
            userCorrect: false,
            gamesCorrect: false
          }
        ]
      },
      {
        name: 'Stanley Cup Finaali',
        matchups: [
          {
            userPickedTeam: "EDM",
            actualWinner: "Kesken",
            userPickedGames: 6,
            actualGames: 0,
            userCorrect: false,
            gamesCorrect: false
          }
        ]
      }
    ]
  };
  lineupSummary: LineupSummary = {
    lineup: {},
    remainingTrades: 9,
    unusedBudget: 2000000,
    totalValue: 0,
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
    predictions: 0,
    predictionsR1: 0,
    predictionsR2: 0,
    predictionsR3: 0,
    predictionsFinal: 0
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
            console.log("User points data:", data.points);
            this.points = {
              total: data.points.total || 0,
              bracket: data.points.bracket || 0,
              lineup: data.points.lineup || 0,
              predictions: data.points.predictions || 0,
              predictionsR1: data.points.predictionsR1 || 0,
              predictionsR2: data.points.predictionsR2 || 0,
              predictionsR3: data.points.predictionsR3 || 0,
              predictionsFinal: data.points.predictionsFinal || 0
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
          predictions: 0,
          predictionsR1: 0,
          predictionsR2: 0,
          predictionsR3: 0,
          predictionsFinal: 0
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
          total: 15,
          roundMatchups: [
            {
              name: 'Ensimmäinen kierros',
              matchups: [
                {
                  userPickedTeam: "BOS",
                  actualWinner: "BOS",
                  userPickedGames: 6,
                  actualGames: 7,
                  userCorrect: true,
                  gamesCorrect: false
                },
                {
                  userPickedTeam: "FLA",
                  actualWinner: "FLA",
                  userPickedGames: 5,
                  actualGames: 5,
                  userCorrect: true,
                  gamesCorrect: true
                },
                {
                  userPickedTeam: "NYR",
                  actualWinner: "NYR",
                  userPickedGames: 4,
                  actualGames: 5,
                  userCorrect: true,
                  gamesCorrect: false
                },
                {
                  userPickedTeam: "CAR",
                  actualWinner: "CAR",
                  userPickedGames: 6,
                  actualGames: 6,
                  userCorrect: true,
                  gamesCorrect: true
                },
                {
                  userPickedTeam: "DAL",
                  actualWinner: "VGK",
                  userPickedGames: 7,
                  actualGames: 6,
                  userCorrect: false,
                  gamesCorrect: false
                },
                {
                  userPickedTeam: "COL",
                  actualWinner: "COL",
                  userPickedGames: 6,
                  actualGames: 5,
                  userCorrect: true,
                  gamesCorrect: false
                },
                {
                  userPickedTeam: "EDM",
                  actualWinner: "EDM",
                  userPickedGames: 5,
                  actualGames: 5,
                  userCorrect: true,
                  gamesCorrect: true
                },
                {
                  userPickedTeam: "VAN",
                  actualWinner: "VAN",
                  userPickedGames: 7,
                  actualGames: 5,
                  userCorrect: true,
                  gamesCorrect: false
                }
              ]
            },
            {
              name: 'Toinen kierros',
              matchups: [
                {
                  userPickedTeam: "BOS",
                  actualWinner: "FLA",
                  userPickedGames: 7,
                  actualGames: 7,
                  userCorrect: false,
                  gamesCorrect: true
                },
                {
                  userPickedTeam: "CAR",
                  actualWinner: "NYR",
                  userPickedGames: 6,
                  actualGames: 6,
                  userCorrect: false,
                  gamesCorrect: true
                },
                {
                  userPickedTeam: "COL",
                  actualWinner: "COL",
                  userPickedGames: 7,
                  actualGames: 6,
                  userCorrect: true,
                  gamesCorrect: false
                },
                {
                  userPickedTeam: "EDM",
                  actualWinner: "EDM",
                  userPickedGames: 6,
                  actualGames: 6,
                  userCorrect: true,
                  gamesCorrect: true
                }
              ]
            },
            {
              name: 'Konferenssifinaalit',
              matchups: [
                {
                  userPickedTeam: "NYR",
                  actualWinner: "FLA",
                  userPickedGames: 7,
                  actualGames: 6,
                  userCorrect: false,
                  gamesCorrect: false
                },
                {
                  userPickedTeam: "COL",
                  actualWinner: "EDM",
                  userPickedGames: 7,
                  actualGames: 6,
                  userCorrect: false,
                  gamesCorrect: false
                }
              ]
            },
            {
              name: 'Stanley Cup Finaali',
              matchups: [
                {
                  userPickedTeam: "EDM",
                  actualWinner: "Kesken",
                  userPickedGames: 6,
                  actualGames: 0,
                  userCorrect: false,
                  gamesCorrect: false
                }
              ]
            }
          ]
        };
      }
    });
  }

  loadLineupSummary(): void {
    const userId = this.user?.id;
    if (!userId) return;

    // Fetch lineup summary as before
    this.http.get(`${environment.apiUrl}/lineup/get?user_id=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          // Fetch trade history from backend
          this.http.get<any[]>(`${environment.apiUrl}/lineup/history?user_id=${userId}`).subscribe({
            next: (trades: any[]) => {
              this.lineupSummary = {
                lineup: data.lineup || {},
                remainingTrades: data.remainingTrades || 9,
                unusedBudget: data.unusedBudget || 0,
                totalValue: data.totalValue || 0,
                tradeHistory: trades || []
              };
            },
            error: (err) => {
              // Fallback to no trade history if error
              this.lineupSummary = {
                lineup: data.lineup || {},
                remainingTrades: data.remainingTrades || 9,
                unusedBudget: data.unusedBudget || 0,
                totalValue: data.totalValue || 0,
                tradeHistory: []
              };
            }
          });
        }
      },
      error: (err) => {
        console.error("Failed to load lineup summary", err);
        this.lineupSummary = {
          lineup: {},
          remainingTrades: 9,
          unusedBudget: 2000000,
          totalValue: 0,
          tradeHistory: []
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
          console.log("Predictions summary data:", data);
          // Transform the string arrays into Player arrays
          if (data.categories) {
            data.categories = data.categories.map((category: any) => ({
              ...category,
              userPicks: category.userPicks.map((pick: any) => typeof pick === 'string'
                ? this.findPlayerByName(pick)
                : pick),
              currentTop3: category.currentTop3.map((pick: any) => typeof pick === 'string'
                ? this.findPlayerByName(pick)
                : pick)
            }));
          }
          this.predictionsSummary = data;
        }
      },
      error: (err) => {
        console.error("Failed to load predictions summary", err);
        this.predictionsSummary = {
          completed: 0,
          totalToComplete: 3,
          top3Picks: [],
          categories: [],
          totalCorrect: 0
        };
      }
    });
  }

  private findPlayerByName(playerName: string): Player {
    // Split the name into first and last name
    const [firstName, ...lastNameParts] = playerName.split(' ');
    const lastName = lastNameParts.join(' ');

    // Try to find the player in allPlayers
    const player = this.allPlayers.find(p =>
      p.firstName === firstName && p.lastName === lastName
    );

    // If player is not found, create a minimal player object
    if (!player) {
      return {
        id: 0,
        firstName,
        lastName,
        team: '',
        position: '',
        isU23: false,
        price: 0
      };
    }

    return player;
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

  isPlayerInList(player: any, playerList: any[]): boolean {
    return playerList.some(p => p.id === player.id);
  }

  getCategoryLabel(categoryName: string): string {
    const labels: { [key: string]: string } = {
      'connSmythe': 'Conn Smythe -voittaja',
      'penaltyMinutes': 'Jäähypörssi',
      'goals': 'Maalipörssi',
      'defensePoints': 'Puolustajien Pistepörssi',
      'U23Points': 'U23 Pistepörssi',
      'goalieWins': 'Eniten Voittoja - MV',
      'finnishPoints': 'Suomalaisten Pistepörssi'
    };
    return labels[categoryName] || categoryName;
  }
}
