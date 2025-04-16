import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from "../../environments/environment";


interface Matchups {
  west: any[];
  east: any[];
}

@Component({
  selector: 'app-user-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-view.component.html',
  styleUrl: './user-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush // Enable OnPush strategy
})
export class UserViewComponent implements OnInit {
  teamName: string | null = null;
  userData: any = {
    bracket: null,
    lineup: null,
    predictions: null
  };
  userRank: number | null = null;
  userPoints = {
    total: 0,
    bracket: 0,
    lineup: 0,
    predictions: 0
  };

  loading: boolean = true;
  error: string | null = null;
  activeTab: 'bracket' | 'lineup' | 'predictions' = 'bracket';

  initialMatchups: Matchups = { west: [], east: [] };

  private matchupsByRoundCache: { [key: string]: any[] } = {};
  private teamWinnerCache: { [key: string]: boolean } = {};

  logoUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef // Inject ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.teamName = params.get('teamName');
      if (this.teamName) {
        this.http.get<Matchups>(`${environment.apiUrl}/bracket/matchups`).subscribe({
          next: (matchups) => {
            this.initialMatchups = matchups;
            if (this.teamName) {
              this.loadUserData(this.teamName);
            }
          },
          error: (err) => {
            console.error('Failed to load initial matchups', err);
            this.error = 'Failed to load initial matchup data';
          }
        });
      }
    });
  }

  loadUserData(teamName: string): void {
    this.loading = true;
    this.error = null;

    const encodedTeamName = encodeURIComponent(teamName);

    this.http.get(`${environment.apiUrl}/user/by-team-name?teamName=${encodedTeamName}`).subscribe({
      next: (response: any) => {
        const userId = response.userId;
        this.logoUrl = response.logoUrl; // Store the logo URL

        // Keep track of loading requests
        let pendingRequests = 3; // bracket, lineup, predictions
        const onRequestComplete = () => {
          pendingRequests--;
          if (pendingRequests <= 0) {
            // Force loading to false when all requests complete
            this.loading = false;
            this.cdr.markForCheck();
          }
        };

        this.loadBracket(userId, onRequestComplete);
        this.loadLineup(userId, onRequestComplete);
        this.loadPredictions(userId, onRequestComplete);
        this.loadUserStats(userId);
      },
      error: (err) => {
        console.error('Error finding user by team name', err);
        this.error = 'Could not find user with this team name';
        this.loading = false;

        // Load mock data even if user lookup fails
        this.loadMockData();
        this.cdr.markForCheck();
      }
    });
  }

  loadMockData(): void {
    // Placeholder data to show when API requests fail
    this.userPoints = {
      total: 65,
      bracket: 30,
      lineup: 25,
      predictions: 10
    };
    this.userRank = 4;
    // You could add more mock data here if needed
    console.log("Mock data loaded:", this.userPoints, this.userRank);
  }

  loadBracket(userId: number, onComplete: () => void): void {
    this.http.get(`${environment.apiUrl}/bracket/get-picks?user_id=${userId}`).subscribe({
      next: (res: any) => {
        this.userData.bracket = res.picks;
      },
      error: (err) => {
        console.error('Error loading bracket data', err);
        this.loadMockData();
        this.userData.bracket = {}; // Set empty default
      },
      complete: () => {
        onComplete(); // Just call onComplete, remove checkLoadingComplete call
      }
    });
  }

  loadLineup(userId: number, onComplete: () => void): void {
    this.http.get(`${environment.apiUrl}/lineup/get?user_id=${userId}`).subscribe({
      next: (res: any) => {
        this.userData.lineup = res.lineup;
      },
      error: (err) => {
        console.error('Error loading lineup data', err);
        this.loadMockData();
        this.userData.lineup = {}; // Set empty default
      },
      complete: () => {
        onComplete(); // Just call onComplete, remove checkLoadingComplete call
      }
    });
  }

  loadPredictions(userId: number, onComplete: () => void): void {
    this.http.get(`${environment.apiUrl}/predictions/get?user_id=${userId}`).subscribe({
      next: (res: any) => {
        this.userData.predictions = res.predictions;
      },
      error: (err) => {
        console.error('Error loading predictions data', err);
        this.loadMockData();
        this.userData.predictions = {}; // Set empty default
      },
      complete: () => {
        onComplete(); // Just call onComplete, remove checkLoadingComplete call
      }
    });
  }

  loadUserStats(userId: number): void {
    this.http.get(`${environment.apiUrl}/user/stats?userId=${userId}`).subscribe({
      next: (res: any) => {
        if (res && res.rank) {
          this.userRank = res.rank;
        }
        if (res && res.points) {
          this.userPoints = res.points;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading user stats', err);
        // Use placeholder stats if request fails
        this.loadMockData();
      }
    });
  }

  checkLoadingComplete(): void {
    // Mark loading as complete regardless of whether data exists
    // This fixes the issue where the page would get stuck loading if no data was found
    this.loading = false;
    this.cdr.markForCheck();
  }

  setActiveTab(tab: 'bracket' | 'lineup' | 'predictions'): void {
    this.activeTab = tab;
    this.matchupsByRoundCache = {}; // Clear cache on tab change
    this.teamWinnerCache = {};
  }

  getTotalPoints(): number {
    return this.userPoints.total;
  }

  getBracketPoints(): number {
    return this.userPoints.bracket;
  }

  getLineupPoints(): number {

    return this.userPoints.lineup;
  }

  getPredictionsPoints(): number {
    return this.userPoints.predictions;
  }

  getUserRank(): number | null {
    return this.userRank;
  }

  getBracketCompletionCount(): number {
    if (!this.userData.bracket) return 0;

    let count = 0;

    count += Object.keys(this.userData.bracket.round1 || {}).length;

    const round2Winners = Object.keys(this.userData.bracket.round2 || {})
      .filter(key => key.endsWith('-winner')).length;
    count += round2Winners;

    const round3Winners = Object.keys(this.userData.bracket.round3 || {})
      .filter(key => key.endsWith('-winner')).length;
    count += round3Winners;

    if (this.userData.bracket.final?.['cup-winner']) {
      count += 1;
    }

    return count;
  }

  getChampionPick(): string | null {
    if (!this.userData.bracket || !this.userData.bracket.final) {
      return null;
    }

    return this.userData.bracket.final['cup-winner'] || null;
  }

  getMatchupsByRound(round: string): any[] {
    if (this.matchupsByRoundCache[round]) {
      return this.matchupsByRoundCache[round];
    }

    if (!this.userData.bracket || !this.userData.bracket[round]) {
      return [];
    }

    const matchups = [];

    if (round === 'round1') {
      // Define the first round matchups based on the E1, E2, W1, W2, etc. format
      // This is a mapping of the codes to the actual team matchups
      const firstRoundTeams = {
        // Western Conference (first 4 matchups)
        'W1': { team1: 'OTT', team2: 'FLA' },
        'W2': { team1: 'PIT', team2: 'NYR' },
        'W3': { team1: 'BUF', team2: 'TBL' },
        'W4': { team1: 'PHI', team2: 'CAR' },
        // Eastern Conference (second 4 matchups)
        'E1': { team1: 'STL', team2: 'COL' },
        'E2': { team1: 'TBL', team2: 'VGK' },
        'E3': { team1: 'CAR', team2: 'EDM' },
        'E4': { team1: 'NYR', team2: 'VAN' }
      };

      // Process Western Conference matchups (first 4)
      const westCodes = ['W1', 'W2', 'W3', 'W4'];
      westCodes.forEach(code => {
        if (this.userData.bracket.round1[code]) {
          matchups.push({
            id: code,
            team1: firstRoundTeams[code as keyof typeof firstRoundTeams].team1,
            team2: firstRoundTeams[code as keyof typeof firstRoundTeams].team2,
            winner: this.userData.bracket.round1[code]
          });
        }
      });

      // Process Eastern Conference matchups (second 4)
      const eastCodes = ['E1', 'E2', 'E3', 'E4'];
      eastCodes.forEach(code => {
        if (this.userData.bracket.round1[code]) {
          matchups.push({
            id: code,
            team1: firstRoundTeams[code as keyof typeof firstRoundTeams].team1,
            team2: firstRoundTeams[code as keyof typeof firstRoundTeams].team2,
            winner: this.userData.bracket.round1[code]
          });
        }
      });
    } else if (round === 'round2') {
      // Existing code for round2
      const keys = ['w-semi', 'w-semi2', 'e-semi', 'e-semi2'];

      for (const key of keys) {
        if (this.userData.bracket.round2[key] && Array.isArray(this.userData.bracket.round2[key])) {
          const teams = this.userData.bracket.round2[key];
          const winner = this.userData.bracket.round2[`${key}-winner`];

          matchups.push({
            id: key,
            team1: teams[0] || 'TBD',
            team2: teams[1] || 'TBD',
            winner: winner
          });
        }
      }
    } else if (round === 'round3') {
      // Existing code for round3
      const keys = ['west-final', 'east-final'];

      for (const key of keys) {
        if (this.userData.bracket.round3[key] && Array.isArray(this.userData.bracket.round3[key])) {
          const teams = this.userData.bracket.round3[key];
          const winner = this.userData.bracket.round3[`${key}-winner`];

          matchups.push({
            id: key,
            team1: teams[0] || 'TBD',
            team2: teams[1] || 'TBD',
            winner: winner
          });
        }
      }
    }

    this.matchupsByRoundCache[round] = matchups;
    return matchups;
  }

  isTeamWinner(matchupId: string | number, team: string): boolean {
    const cacheKey = `${matchupId}-${team}`;
    if (this.teamWinnerCache[cacheKey] !== undefined) {
      return this.teamWinnerCache[cacheKey];
    }

    if (!this.userData.bracket) return false;

    let result = false;

    if (typeof matchupId === 'string' && (matchupId.startsWith('E') || matchupId.startsWith('W')) &&
      !matchupId.includes('semi') && !matchupId.includes('final')) {
      // Handle new round 1 format with codes like E1, W1, etc.
      result = this.userData.bracket.round1[matchupId] === team;
    } else if (typeof matchupId === 'string') {
      if (matchupId.includes('semi')) {
        result = this.userData.bracket.round2[`${matchupId}-winner`] === team;
      } else if (matchupId.includes('final') && !matchupId.includes('cup')) {
        result = this.userData.bracket.round3[`${matchupId}-winner`] === team;
      } else if (matchupId === 'cup') {
        result = this.userData.bracket.final['cup-winner'] === team;
      }
    }

    this.teamWinnerCache[cacheKey] = result;
    return result;
  }

  getSeriesResult(matchupId: string | number): string | null {
    if (!this.userData.bracket) return null;

    let games: number | undefined;


    if (typeof matchupId === 'string' && (matchupId.startsWith('E') || matchupId.startsWith('W')) &&
      !matchupId.includes('semi') && !matchupId.includes('final')) {
      // Handle new round 1 format with codes like E1, W1, etc.
      games = this.userData.bracket.round1Games?.[matchupId];
    } else if (typeof matchupId === 'string') {
      if (matchupId.includes('semi')) {
        // Access round2Games directly with the matchup ID (no "-winner" suffix)
        games = this.userData.bracket.round2Games?.[matchupId];
      } else if (matchupId.includes('final') && !matchupId.includes('cup')) {
        // Access round3Games directly with the matchup ID (no "-winner" suffix)
        games = this.userData.bracket.round3Games?.[matchupId];
      } else if (matchupId === 'cup-winner' || matchupId === 'cup') {
        // Use 'cup' key for finalGames
        games = this.userData.bracket.finalGames?.['cup'];
      }
    }
    games = games || 0; // Default to 0 if undefined
    const games_string = games.toString();
    return games_string.length > 0 ? games_string : null;
  }

  getFinalTeams(): string[] {
    if (!this.userData.bracket || !this.userData.bracket.final || !this.userData.bracket.final.cup) {
      return ['TBD', 'TBD'];
    }

    return this.userData.bracket.final.cup;
  }

  getUsedBudget(): number {
    if (!this.userData.lineup) return 0;

    return 4250000;
  }

  formatBudget(amount: number): string {
    return '$' + amount.toLocaleString();
  }

  getPlayerByPosition(position: string): any {
    if (!this.userData.lineup) return null;

    const mockPlayers: { [key: string]: { id: number; firstName: string; lastName: string; position: string; team: string; price: number } } = {
      'L': { id: 1, firstName: 'Connor', lastName: 'McDavid', position: 'L', team: 'EDM', price: 950000 },
      'C': { id: 2, firstName: 'Nathan', lastName: 'MacKinnon', position: 'C', team: 'COL', price: 930000 },
      'R': { id: 3, firstName: 'David', lastName: 'Pastrnak', position: 'R', team: 'BOS', price: 890000 },
      'LD': { id: 4, firstName: 'Cale', lastName: 'Makar', position: 'D', team: 'COL', price: 870000 },
      'RD': { id: 5, firstName: 'Roman', lastName: 'Josi', position: 'D', team: 'NSH', price: 820000 },
      'G': { id: 6, firstName: 'Andrei', lastName: 'Vasilevskiy', position: 'G', team: 'TBL', price: 790000 }
    };

    return null;
  }

  getPlayerName(position: string): string {
    const player = this.getPlayerByPosition(position);
    if (!player) return '';
    return `${player.firstName} ${player.lastName}`;
  }

  getPlayerTeam(position: string): string {
    const player = this.getPlayerByPosition(position);
    if (!player) return '';
    return player.team;
  }

  getPlayerPrice(position: string): number {
    const player = this.getPlayerByPosition(position);
    if (!player) return 0;
    return player.price;
  }

  getPlayerTeamClass(position: string): string {
    const player = this.getPlayerByPosition(position);
    if (!player) return '';
    return player.team.toLowerCase();
  }

  getPredictionCategories(): string[] {
    if (!this.userData.predictions) return [];
    return Object.keys(this.userData.predictions);
  }

  getCategoryLabel(category: string): string {
    const labels = {
      'connSmythe': 'Conn Smythe -voittaja',
      'penaltyMinutes': 'Jäähypörssi',
      'goals': 'Maalipörssi',
      'defensePoints': 'Puolustajien Pistepörssi',
      'U23Points': 'U23 Pistepörssi',
      'goalieWins': 'Eniten Voittoja - MV',
      'finnishPoints': 'Suomalaisten Pistepörssi'
    };
    return labels[category as keyof typeof labels] || category;
  }

  getPredictionsByCategory(category: string): any[] {
    if (!this.userData.predictions || !this.userData.predictions[category]) {
      return [];
    }
    return this.userData.predictions[category];
  }

  getEmptySlotsArray(category: string): number[] {
    if (!this.userData.predictions || !this.userData.predictions[category]) {
      return [0, 1, 2];
    }

    const picksCount = this.userData.predictions[category].length;
    if (picksCount >= 3) return [];

    return Array(3 - picksCount).fill(0).map((_, i) => i);
  }

  getGoalieClass(): string {
    return 'default-goalie-class';
  }

  getTeamClasses(matchupId: string | number, team: string): { [key: string]: boolean } {
    const isWinner = this.isTeamWinner(matchupId, team);
    const teamCode = team.toLowerCase();

    // Base classes
    const classes: { [key: string]: boolean } = {
      'winner': isWinner,
    };

    // Add team-specific class
    if (team) {
      classes[`team-${teamCode}`] = true;
    }

    return classes;
  }
}