import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from "../../environments/environment";
import { Player } from '../models/player.model';
import { Goalie } from '../models/goalie.model';

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
  private matchupData: any = null;

  logoUrl: string | null = null;

  lineupSummary: any = {
    lineup: {},
    remainingTrades: 0,
    unusedBudget: 0,
    totalValue: 0,
    tradeHistory: []
  };
  allPlayers: Player[] = [];
  allGoalies: Goalie[] = [];

  // Position name mapping
  positionNames: { [key: string]: string } = {
    'L': 'Vasen laitahyökkääjä',
    'C': 'Keskushyökkääjä',
    'R': 'Oikea laitahyökkääjä',
    'LD': 'Vasen puolustaja',
    'RD': 'Oikea puolustaja',
    'G': 'Maalivahti',
    'VL': 'Vasen laitahyökkääjä',
    'KH': 'Keskushyökkääjä',
    'OL': 'Oikea laitahyökkääjä',
    'VP': 'Vasen puolustaja',
    'OP': 'Oikea puolustaja',
    'MV': 'Maalivahti'
  };

  positionMapping = {
    'L': 'VL',
    'C': 'KH',
    'R': 'OL',
    'LD': 'VP',
    'RD': 'OP',
    'G': 'MV'
  };

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
            console.log(matchups);
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

    this.loadPlayers();
    this.loadGoalies();
  }

  loadUserData(teamName: string): void {
    this.loading = true;
    this.error = null;

    const encodedTeamName = encodeURIComponent(teamName);
    console.log('Encoded team name:', encodedTeamName);

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

        console.log('User ID:', userId);

        this.loadBracket(userId, onRequestComplete);
        this.loadLineup(userId, onRequestComplete);
        this.loadPredictions(userId, onRequestComplete);
        this.loadUserStats(userId);
        this.loadPlayers();
        this.loadLineupSummary(userId);
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
        console.log('Lineup data:', res);
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
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.allPlayers = [];
      }
    });
  }

  loadGoalies(): void {
    this.http.get<any[]>(`${environment.apiUrl}/goalies`).subscribe({
      next: (data) => {
        this.allGoalies = data.map(goalie => ({
          id: goalie.id,
          api_id: goalie.api_id,
          firstName: goalie.first_name,
          lastName: goalie.last_name,
          position: goalie.position,
          team: goalie.team_abbr,
          price: goalie.price,
          isU23: goalie.is_U23,
          jersey_number: goalie.jersey_number,
          birth_country: goalie.birth_country,
          birth_year: goalie.birth_year,
          headshot: goalie.headshot,
          reg_gp: goalie.reg_gp,
          reg_gaa: goalie.reg_gaa,
          reg_save_pct: goalie.reg_save_pct,
          reg_shutouts: goalie.reg_shutouts,
          reg_wins: goalie.reg_wins,
          playoff_gp: goalie.playoff_gp,
          playoff_gaa: goalie.playoff_gaa,
          playoff_save_pct: goalie.playoff_save_pct,
          playoff_shutouts: goalie.playoff_shutouts,
          playoff_wins: goalie.playoff_wins
        }));
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.allGoalies = [];
      }
    });
  }

  loadLineupSummary(userId: Number): void {
    // Use logged-in user id if not viewing another user
    if (!userId) {
      console.log('User ID not found. Please log in again.');
    }



    this.http.get(`${environment.apiUrl}/lineup/get?user_id=${userId}`).subscribe({
      next: (data: any) => {
        if (data) {
          this.lineupSummary.lineup = data.lineup || {};
          this.lineupSummary.remainingTrades = data.remainingTrades || 0;
          this.lineupSummary.unusedBudget = data.unusedBudget || 0;
          this.lineupSummary.totalValue = data.totalValue || 0;

          // Fetch trade history
          this.http.get<any[]>(`${environment.apiUrl}/lineup/history?user_id=${userId}`).subscribe({
            next: (trades: any[]) => {
              this.lineupSummary.tradeHistory = trades || [];
              console.log('Trade history:', trades);
            },
            error: () => {
              this.lineupSummary.tradeHistory = [];
            }
          });

          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.lineupSummary = {
          lineup: {},
          remainingTrades: 0,
          unusedBudget: 0,
          totalValue: 0,
          tradeHistory: []
        };
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
      // For round 1, use the initial matchups that were loaded on component init
      const westMatchups = this.initialMatchups.west || [];
      const eastMatchups = this.initialMatchups.east || [];

      // Process Western Conference matchups
      westMatchups.forEach((m: any) => {
        matchups.push({
          id: m.matchupCode,
          team1: m.team1,
          team2: m.team2,
          winner: this.userData.bracket.round1[m.matchupCode] || ''
        });
      });

      // Process Eastern Conference matchups
      eastMatchups.forEach((m: any) => {
        matchups.push({
          id: m.matchupCode,
          team1: m.team1,
          team2: m.team2,
          winner: this.userData.bracket.round1[m.matchupCode] || ''
        });
      });
    } else if (round === 'round2') {
      const bracketData = this.userData.bracket;
      // Round 2 west matchups
      if (bracketData.round2['w-semi']) {
        matchups.push({
          id: 'w-semi',
          team1: bracketData.round2['w-semi'][0] || '',
          team2: bracketData.round2['w-semi'][1] || '',
          winner: bracketData.round2['w-semi-winner'] || ''
        });
      }
      if (bracketData.round2['w-semi2']) {
        matchups.push({
          id: 'w-semi2',
          team1: bracketData.round2['w-semi2'][0] || '',
          team2: bracketData.round2['w-semi2'][1] || '',
          winner: bracketData.round2['w-semi2-winner'] || ''
        });
      }
      // Round 2 east matchups
      if (bracketData.round2['e-semi']) {
        matchups.push({
          id: 'e-semi',
          team1: bracketData.round2['e-semi'][0] || '',
          team2: bracketData.round2['e-semi'][1] || '',
          winner: bracketData.round2['e-semi-winner'] || ''
        });
      }
      if (bracketData.round2['e-semi2']) {
        matchups.push({
          id: 'e-semi2',
          team1: bracketData.round2['e-semi2'][0] || '',
          team2: bracketData.round2['e-semi2'][1] || '',
          winner: bracketData.round2['e-semi2-winner'] || ''
        });
      }
    } else if (round === 'round3') {
      const bracketData = this.userData.bracket;
      // Conference Finals
      if (bracketData.round3['west-final']) {
        matchups.push({
          id: 'west-final',
          team1: bracketData.round3['west-final'][0] || '',
          team2: bracketData.round3['west-final'][1] || '',
          winner: bracketData.round3['west-final-winner'] || ''
        });
      }
      if (bracketData.round3['east-final']) {
        matchups.push({
          id: 'east-final',
          team1: bracketData.round3['east-final'][0] || '',
          team2: bracketData.round3['east-final'][1] || '',
          winner: bracketData.round3['east-final-winner'] || ''
        });
      }
    } else if (round === 'final') {
      const bracketData = this.userData.bracket;
      if (bracketData.final['cup']) {
        matchups.push({
          id: 'cup',
          team1: bracketData.final['cup'][0] || '',
          team2: bracketData.final['cup'][1] || '',
          winner: bracketData.final['cup-winner'] || ''
        });
      }
    }

    this.matchupsByRoundCache[round] = matchups;
    return matchups;
  }

  private getRoundNumber(round: string): number {
    switch (round) {
      case 'round1': return 1;
      case 'round2': return 2;
      case 'round3': return 3;
      case 'final': return 4;
      default: return 1;
    }
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

  formatBudget(value: number): string {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  }

  getPlayerByPosition(position: string): Player | Goalie | null {
    // Map UI slot to backend slot
    let slot = position;
    if (position === 'MV') slot = 'G';
    if (position === 'OL') slot = 'R';
    if (position === 'KH') slot = 'C';
    if (position === 'VL') slot = 'L';
    if (position === 'VP') slot = 'LD';
    if (position === 'OP') slot = 'RD';

    if (!this.lineupSummary.lineup) return null;
    const playerId = this.lineupSummary.lineup[slot];
    if (!playerId) return null;

    // Check if this is a goalie position
    if (slot === 'G') {
      return this.allGoalies.find(g => g.id === playerId) || null;
    } else {
      return this.allPlayers.find(p => p.id === playerId) || null;
    }
  }

  getPositionName(positionCode: string): string {
    return this.positionNames[positionCode] || positionCode;
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

  formatPosition(positionCode: string): string {
    return this.positionMapping[positionCode as keyof typeof this.positionMapping] || positionCode;
  }
}