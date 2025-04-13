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
  matchup_code?: string; // Added matchup_code to align with bracket data
}

interface MatchupResult {
  matchupId: number;
  winner: string;
  games: number;
  matchupCode?: string; // Added to help with bracket scoring
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
  private apiUrl = '${environment.apiUrl}';

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

          console.log(this.selectedRound)
          // Initialize results arrays with the right size and include matchup codes
          this.eastRoundResults = this.eastRoundMatchups.map(m => ({
            matchupId: m.id || 0,
            winner: '',
            games: 4,
            matchupCode: m.matchup_code || ''
          }));

          this.westRoundResults = this.westRoundMatchups.map(m => ({
            matchupId: m.id || 0,
            winner: '',
            games: 4,
            matchupCode: m.matchup_code || ''
          }));
        } else {
          this.finalMatchup = data.final;
          if (this.finalMatchup && this.finalMatchup.id) {
            this.finalResult = {
              matchupId: this.finalMatchup.id,
              winner: '',
              games: 4,
              matchupCode: this.finalMatchup.matchup_code || 'cup'

            };
            console.log('Final matchup loaded:', this.finalMatchup)
            this.selectedRound = 4; // Set to final round
            console.log()
          } else {
            console.warn('Final matchup not found or invalid.');
          }
        }
      },
      error: (err) => {
        console.error(`Error loading round ${this.selectedRound} matchups:`, err);
      }
    });
  }

  // Get the bracket-compatible key based on round and matchup code
  getBracketKey(round: number, matchupCode: string): string {
    if (round === 1) {
      return matchupCode; // Round 1 uses direct codes like W1, E3
    } else if (round === 2) {
      // Convert from matchup codes to bracket keys
      if (matchupCode.startsWith('W')) {
        return matchupCode === 'W1' ? 'w-semi' : 'w-semi2';
      } else {
        return matchupCode === 'E1' ? 'e-semi' : 'e-semi2';
      }
    } else if (round === 3) {
      // Conference finals
      return matchupCode.startsWith('W') ? 'west-final' : 'east-final';
    } else {
      // Stanley Cup final
      return 'cup';
    }
  }

  // Format results for easy scoring against user brackets
  formatResultsForScoring(): any {
    const results: any = {
      round1: {}, round1Games: {},
      round2: {}, round2Games: {},
      round3: {}, round3Games: {},
      final: {}, finalGames: {}
    };

    // Process results based on round
    if (this.selectedRound === 1) {
      [...this.eastRoundResults, ...this.westRoundResults].forEach(r => {
        if (r.matchupCode && r.winner) {
          // Find corresponding matchup to get both teams
          const matchup = [...this.eastRoundMatchups, ...this.westRoundMatchups]
            .find(m => m.matchup_code === r.matchupCode);

          results.round1[r.matchupCode] = r.winner;
          results.round1Games[r.matchupCode] = r.games;
        }
      });
    } else if (this.selectedRound === 2) {
      // Group matchups by bracket key
      const bracketMatchups: Record<string, string[]> = {
        'w-semi': [], 'w-semi2': [], 'e-semi': [], 'e-semi2': []
      };

      [...this.eastRoundMatchups, ...this.westRoundMatchups].forEach(m => {
        const bracketKey = this.getBracketKey(2, m.matchup_code || '');
        if (bracketKey && bracketKey in bracketMatchups) {
          bracketMatchups[bracketKey] = [m.team1, m.team2];
        }
      });

      // Add teams to results
      for (const key in bracketMatchups) {
        if (bracketMatchups[key].length === 2) {
          results.round2[key] = bracketMatchups[key];
        }
      }

      // Add winners and game counts
      [...this.eastRoundResults, ...this.westRoundResults].forEach(r => {
        if (r.matchupCode && r.winner) {
          const bracketKey = this.getBracketKey(2, r.matchupCode);
          results.round2[`${bracketKey}-winner`] = r.winner;
          results.round2Games[bracketKey] = r.games;
        }
      });
    } else if (this.selectedRound === 3) {
      // Add west and east final matchups with teams array
      const westFinals = this.westRoundMatchups.find(m => m.round === 3);
      const eastFinals = this.eastRoundMatchups.find(m => m.round === 3);

      if (westFinals) {
        results.round3['west-final'] = [westFinals.team1, westFinals.team2];
      }

      if (eastFinals) {
        results.round3['east-final'] = [eastFinals.team1, eastFinals.team2];
      }

      // Add winners and game counts
      [...this.eastRoundResults, ...this.westRoundResults].forEach(r => {
        if (r.matchupCode && r.winner) {
          const bracketKey = this.getBracketKey(3, r.matchupCode);
          results.round3[`${bracketKey}-winner`] = r.winner;
          results.round3Games[bracketKey] = r.games;
        }
      });
    } else if (this.selectedRound === 4 && this.finalResult.winner && this.finalMatchup) {
      // Add cup final teams array
      results.final['cup'] = [this.finalMatchup.team1, this.finalMatchup.team2];


      // Add cup winner and game count
      results.final['cup-winner'] = this.finalResult.winner;
      results.finalGames['cup'] = this.finalResult.games;
    }



    return results;
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

    // Format results in the user-friendly structure for scoring
    const formattedResults = this.formatResultsForScoring();
    console.log('Formatted for bracket scoring:', formattedResults);

    // Send both the raw results and formatted results to API
    this.http.post(`${this.apiUrl}/bracket/save-results`, {
      round: this.selectedRound,
      results: results,
      formattedResults: formattedResults
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

  // Helper to get matchup display name
  getMatchupDisplayName(matchup: Matchup): string {
    return matchup.matchup_code || `${matchup.conference.substring(0, 1).toUpperCase()}?`;
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
