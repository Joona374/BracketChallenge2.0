import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Matchups {
  west: any[];
  east: any[];
}

@Component({
  selector: 'app-user-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-view.component.html',
  styleUrl: './user-view.component.css'
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

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.teamName = params.get('teamName');
      if (this.teamName) {
        this.http.get<Matchups>('http://localhost:5000/api/bracket/matchups').subscribe({
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

    this.http.get(`http://localhost:5000/api/user/by-team-name?teamName=${teamName}`).subscribe({
      next: (response: any) => {
        const userId = response.userId;

        this.loadBracket(userId);
        this.loadLineup(userId);
        this.loadPredictions(userId);
        this.loadUserStats(userId);
      },
      error: (err) => {
        console.error('Error finding user by team name', err);
        this.error = 'Could not find user with this team name';
        this.loading = false;
      }
    });
  }

  loadBracket(userId: number): void {
    this.http.get(`http://localhost:5000/api/bracket/get-picks?user_id=${userId}`).subscribe({
      next: (res: any) => {
        this.userData.bracket = res.picks;
      },
      error: () => { },
      complete: () => this.checkLoadingComplete()
    });
  }

  loadLineup(userId: number): void {
    this.http.get(`http://localhost:5000/api/lineup/get?user_id=${userId}`).subscribe({
      next: (res: any) => {
        this.userData.lineup = res.lineup;
      },
      error: () => { },
      complete: () => this.checkLoadingComplete()
    });
  }

  loadPredictions(userId: number): void {
    this.http.get(`http://localhost:5000/api/predictions/get?user_id=${userId}`).subscribe({
      next: (res: any) => {
        this.userData.predictions = res.predictions;
      },
      error: () => { },
      complete: () => this.checkLoadingComplete()
    });
  }

  loadUserStats(userId: number): void {
    this.http.get(`http://localhost:5000/api/user/stats?userId=${userId}`).subscribe({
      next: (res: any) => {
        if (res && res.rank) {
          this.userRank = res.rank;
        }
        if (res && res.points) {
          this.userPoints = res.points;
        }
      },
      error: () => {
        this.userPoints = {
          total: 65,
          bracket: 30,
          lineup: 25,
          predictions: 10
        };
        this.userRank = 4;
      }
    });
  }

  checkLoadingComplete(): void {
    if (this.userData.bracket || this.userData.lineup || this.userData.predictions) {
      this.loading = false;
    }
  }

  setActiveTab(tab: 'bracket' | 'lineup' | 'predictions'): void {
    this.activeTab = tab;
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
    if (!this.userData.bracket || !this.userData.bracket[round]) {
      return [];
    }

    const matchups = [];

    if (round === 'round1') {
      const westMatchups = [...this.initialMatchups.west];
      const eastMatchups = [...this.initialMatchups.east];

      const allMatchups = [...westMatchups, ...eastMatchups];

      for (const matchup of allMatchups) {
        const id = matchup.id;
        const winner = this.userData.bracket.round1[id];

        matchups.push({
          id: id,
          team1: matchup.team1,
          team2: matchup.team2,
          winner: winner
        });
      }
    } else if (round === 'round2') {
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

    return matchups;
  }

  isTeamWinner(matchupId: string | number, team: string): boolean {
    if (!this.userData.bracket) return false;

    if (typeof matchupId === 'number' || (!isNaN(Number(matchupId)) && Number(matchupId) <= 8)) {
      return this.userData.bracket.round1[matchupId] === team;
    } else if (typeof matchupId === 'string') {
      if (matchupId.includes('semi')) {
        return this.userData.bracket.round2[`${matchupId}-winner`] === team;
      } else if (matchupId.includes('final') && !matchupId.includes('cup')) {
        return this.userData.bracket.round3[`${matchupId}-winner`] === team;
      } else if (matchupId === 'cup') {
        return this.userData.bracket.final['cup-winner'] === team;
      }
    }

    return false;
  }

  getSeriesResult(matchupId: string | number): string | null {
    if (!this.userData.bracket) return null;

    let games: number | undefined;

    if (typeof matchupId === 'number' || (!isNaN(Number(matchupId)) && Number(matchupId) <= 8)) {
      games = this.userData.bracket.round1Games?.[matchupId];
    } else if (typeof matchupId === 'string') {
      if (matchupId.includes('semi')) {
        games = this.userData.bracket.round2Games?.[`${matchupId}-winner`];
      } else if (matchupId.includes('final') && !matchupId.includes('cup')) {
        games = this.userData.bracket.round3Games?.[`${matchupId}-winner`];
      } else if (matchupId === 'cup-winner') {
        games = this.userData.bracket.finalGames?.['cup-winner'];
      }
    }

    return games ? games.toString() : null;
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

    return mockPlayers[position] || null;
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
      'goals': 'Most Goals',
      'assists': 'Most Assists',
      'points': 'Most Points',
      'rookiePoints': 'Rookie Points Leader',
      'wins': 'Most Wins (Goalie)'
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
}