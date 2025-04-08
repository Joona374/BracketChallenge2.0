import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Team {
  id?: number;
  code: string;
  name: string;
  logo_url?: string;
}

interface Matchup {
  id?: number;
  team1: string;
  team2: string;
  round: number;
  conference: string;
}

interface MatchupResult {
  matchupId: number;
  winner: string;
  games: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  // Tab navigation
  activeTab: 'bracket' | 'users' | 'settings' = 'bracket';

  // Bracket management
  bracketPhase: 'setup' | 'update' = 'setup';

  // Teams data - will be populated from API
  teams: Team[] = [];

  // Initial matchup setup
  eastMatchups: Matchup[] = Array(4).fill(0).map(() => ({
    team1: '',
    team2: '',
    round: 1,
    conference: 'east'
  }));

  westMatchups: Matchup[] = Array(4).fill(0).map(() => ({
    team1: '',
    team2: '',
    round: 1,
    conference: 'west'
  }));

  // Round results update
  selectedRound: number = 1;
  eastRoundMatchups: Matchup[] = [];
  westRoundMatchups: Matchup[] = [];
  finalMatchup: Matchup | null = null;

  eastRoundResults: MatchupResult[] = [];
  westRoundResults: MatchupResult[] = [];
  finalResult: MatchupResult = { matchupId: 0, winner: '', games: 4 };

  // API URL
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    // Load teams from API
    this.loadTeams();

    // Load any existing matchups when the component initializes
    this.loadInitialMatchups();
  }

  // Tab navigation
  setActiveTab(tab: 'bracket' | 'users' | 'settings'): void {
    this.activeTab = tab;
  }

  // Bracket phase toggle
  setBracketPhase(phase: 'setup' | 'update'): void {
    this.bracketPhase = phase;

    if (phase === 'update') {
      this.loadRoundMatchups();
    } else {
      this.loadInitialMatchups();
    }
  }

  // Load initial matchups from database
  loadInitialMatchups(): void {
    this.http.get<{ east: Matchup[], west: Matchup[] }>(`${this.apiUrl}/bracket/matchups`).subscribe({
      next: (data) => {
        if (data.east && data.east.length === 4) {
          this.eastMatchups = data.east;
        }
        if (data.west && data.west.length === 4) {
          this.westMatchups = data.west;
        }
      },
      error: (err) => {
        // If no matchups exist yet, use defaults
        if (err.status === 404) {
          console.log('No matchups found. Using defaults.');
        } else {
          console.error('Error loading matchups:', err);
        }
      }
    });
  }

  // Save initial matchups
  saveInitialMatchups(): void {
    // Validate matchups before saving
    if (!this.validateMatchups()) {
      alert('Please select all teams and ensure no team is selected twice.');
      return;
    }

    // Send matchups to API
    this.http.post(`${this.apiUrl}/bracket/save-matchups`, {
      east: this.eastMatchups,
      west: this.westMatchups
    }).subscribe({
      next: () => {
        alert('Initial matchups saved successfully!');
      },
      error: (err) => {
        console.error('Error saving matchups:', err);
        alert('Failed to save matchups. Please try again.');
      }
    });
  }

  // Load matchups for the selected round
  loadRoundMatchups(): void {
    this.http.get<{ east: Matchup[], west: Matchup[], final: Matchup | null }>(
      `${this.apiUrl}/bracket/round-matchups?round=${this.selectedRound}`
    ).subscribe({
      next: (data) => {
        if (this.selectedRound < 4) {
          this.eastRoundMatchups = data.east || [];
          this.westRoundMatchups = data.west || [];

          // Initialize results arrays with the right size
          this.eastRoundResults = this.eastRoundMatchups.map(m => ({
            matchupId: m.id || 0,
            winner: '',
            games: 4
          }));

          this.westRoundResults = this.westRoundMatchups.map(m => ({
            matchupId: m.id || 0,
            winner: '',
            games: 4
          }));
        } else {
          this.finalMatchup = data.final;
          if (this.finalMatchup && this.finalMatchup.id) {
            this.finalResult = {
              matchupId: this.finalMatchup.id,
              winner: '',
              games: 4
            };
          }
        }
      },
      error: (err) => {
        console.error(`Error loading round ${this.selectedRound} matchups:`, err);
      }
    });
  }

  // Save round results
  saveRoundResults(): void {
    let results: MatchupResult[] = [];

    if (this.selectedRound < 4) {
      // Combine results from both conferences
      results = [...this.eastRoundResults, ...this.westRoundResults];
    } else {
      // Only the final result
      if (this.finalResult.winner) {
        results = [this.finalResult];
      }
    }

    // Validate results before saving
    if (!this.validateResults(results)) {
      alert('Please select a winner for each matchup.');
      return;
    }

    // Send results to API
    this.http.post(`${this.apiUrl}/bracket/save-results`, {
      round: this.selectedRound,
      results: results
    }).subscribe({
      next: () => {
        alert(`Round ${this.selectedRound} results saved successfully!`);
      },
      error: (err) => {
        console.error('Error saving results:', err);
        alert('Failed to save results. Please try again.');
      }
    });
  }

  // Load teams from API
  loadTeams(): void {
    this.http.get<Team[]>(`${this.apiUrl}/teams`).subscribe({
      next: (data) => {
        this.teams = data;
      },
      error: (err) => {
        console.error('Error loading teams:', err);
      }
    });
  }

  // Helper to get team name from code
  getTeamName(code: string): string {
    const team = this.teams.find(t => t.code === code);
    return team ? team.name : code;
  }

  // Validation functions
  validateMatchups(): boolean {
    const allMatchups = [...this.eastMatchups, ...this.westMatchups];
    const allTeams: string[] = [];

    // Check if all teams are selected
    for (const matchup of allMatchups) {
      if (!matchup.team1 || !matchup.team2) {
        return false;
      }

      // Check for duplicates
      if (matchup.team1 === matchup.team2 ||
        allTeams.includes(matchup.team1) ||
        allTeams.includes(matchup.team2)) {
        return false;
      }

      allTeams.push(matchup.team1, matchup.team2);
    }

    return true;
  }

  validateResults(results: MatchupResult[]): boolean {
    // Check if all matchups have a winner selected
    return results.every(r => r.winner !== '');
  }
}
