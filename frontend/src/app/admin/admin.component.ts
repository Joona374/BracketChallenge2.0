import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from "../../environments/environment";

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
  result?: { // Add result property to store existing results
    winner: string;
    games: number;
  };
}

interface MatchupResult {
  matchupId: number;
  winner: string;
  games: number;
  matchupCode?: string; // Added to help with bracket scoring
}

// Add interface for registration codes
interface RegistrationCode {
  id: number;
  code: string;
  created_at: string;
  is_used: boolean;
}

// Add interface for users
interface User {
  id: number;
  username: string;
  team_name: string;
  logo1_url?: string;
  logo2_url?: string;
  logo3_url?: string;
  logo4_url?: string;
  selected_logo_url: string;
  is_admin: boolean;
}

// Add interface for headlines
interface Headline {
  id: number;
  headline: string;
  created: string;
  team_name: string | null;
  is_active: boolean;
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
  activeTab: 'bracket' | 'codes' | 'userLogos' | 'settings' | 'headlines' = 'bracket';

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

  // Registration code management
  registrationCodes: RegistrationCode[] = [];
  newCodesAmount: number = 1;
  generatedCodes: string[] = [];
  codeMessage: string = '';
  codeError: string = '';

  // User logo management
  users: User[] = [];
  selectedUser: User | null = null;
  logoFormData: {
    logo1_url?: string;
    logo2_url?: string;
    logo3_url?: string;
    logo4_url?: string;
    selected_logo_url?: string;
  } = {};
  logoMessage: string = '';
  logoError: string = '';

  // File upload properties
  selectedFile: File | null = null;
  uploadingLogo: 'logo1' | 'logo2' | 'logo3' | 'logo4' | 'selected' | null = null;
  uploadInProgress: boolean = false;
  imagePreview: string | ArrayBuffer | null = null;

  // Headlines management
  headlines: Headline[] = [];
  filteredHeadlines: Headline[] = [];
  newHeadline: { headline: string; team_name: string | null } = {
    headline: '',
    team_name: null
  };
  headlineMessage: string = '';
  headlineError: string = '';
  selectedHeadlineId: number | null = null;
  headlinesFilter = {
    showInactive: false,
    team: 'all'
  };
  userTeams: { id: number; team_name: string }[] = [];

  // API URL
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    // Load teams from API
    this.loadTeams();

    // Load any existing matchups when the component initializes
    this.loadInitialMatchups();
  }

  // Tab navigation
  setActiveTab(tab: 'bracket' | 'codes' | 'userLogos' | 'settings' | 'headlines'): void {
    this.activeTab = tab;

    // Load appropriate data for the selected tab
    if (tab === 'codes') {
      this.loadRegistrationCodes();
    } else if (tab === 'userLogos') {
      this.loadUsers();
    } else if (tab === 'headlines') {
      this.loadHeadlines();
    }
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

          // Initialize results arrays with the right size and include matchup codes
          // If matchup already has results, use those values
          this.eastRoundResults = this.eastRoundMatchups.map(m => ({
            matchupId: m.id || 0,
            winner: m.result?.winner || '',
            games: m.result?.games || 4,
            matchupCode: m.matchup_code || ''
          }));

          this.westRoundResults = this.westRoundMatchups.map(m => ({
            matchupId: m.id || 0,
            winner: m.result?.winner || '',
            games: m.result?.games || 4,
            matchupCode: m.matchup_code || ''
          }));
        } else {
          this.finalMatchup = data.final;
          if (this.finalMatchup && this.finalMatchup.id) {
            this.finalResult = {
              matchupId: this.finalMatchup.id,
              winner: this.finalMatchup.result?.winner || '',
              games: this.finalMatchup.result?.games || 4,
              matchupCode: this.finalMatchup.matchup_code || 'cup'
            };
            this.selectedRound = 4; // Set to final round
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

  // Registration code management
  loadRegistrationCodes(): void {
    this.http.get<RegistrationCode[]>(`${environment.apiUrl}/registration-codes`).subscribe({
      next: (data) => {
        this.registrationCodes = data;
      },
      error: (err) => {
        console.error('Error loading registration codes:', err);
        this.codeError = 'Failed to load registration codes';
      }
    });
  }

  generateRegistrationCodes(): void {
    // Reset messages
    this.codeMessage = '';
    this.codeError = '';
    this.generatedCodes = [];

    if (this.newCodesAmount < 1) {
      this.codeError = 'Please enter a valid number of codes to generate (minimum 1)';
      return;
    }

    this.http.post<{ message: string, codes: string[] }>(`${environment.apiUrl}/registration-codes`, {
      amount: this.newCodesAmount
    }).subscribe({
      next: (response) => {
        this.codeMessage = response.message;
        this.generatedCodes = response.codes;
        // Reload the full list of codes
        this.loadRegistrationCodes();
      },
      error: (err) => {
        console.error('Error generating registration codes:', err);
        this.codeError = err.error?.message || 'Failed to generate registration codes';
      }
    });
  }

  // User logo management
  loadUsers(): void {
    this.http.get<User[]>(`${this.apiUrl}/users`).subscribe({
      next: (data) => {
        this.users = data;
        this.selectedUser = null; // Reset selection
        this.logoFormData = {}; // Reset form
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.logoError = 'Failed to load users';
      }
    });
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    // Initialize form with current values
    this.logoFormData = {
      logo1_url: user.logo1_url,
      logo2_url: user.logo2_url,
      logo3_url: user.logo3_url,
      logo4_url: user.logo4_url,
      selected_logo_url: user.selected_logo_url
    };
    this.logoMessage = '';
    this.logoError = '';
  }

  updateUserLogos(): void {
    if (!this.selectedUser) {
      this.logoError = 'No user selected';
      return;
    }

    // Filter out empty values to only update provided URLs
    const logoUpdates: any = {};
    if (this.logoFormData.logo1_url) logoUpdates.logo1_url = this.logoFormData.logo1_url;
    if (this.logoFormData.logo2_url) logoUpdates.logo2_url = this.logoFormData.logo2_url;
    if (this.logoFormData.logo3_url) logoUpdates.logo3_url = this.logoFormData.logo3_url;
    if (this.logoFormData.logo4_url) logoUpdates.logo4_url = this.logoFormData.logo4_url;
    if (this.logoFormData.selected_logo_url) logoUpdates.selected_logo_url = this.logoFormData.selected_logo_url;

    this.http.put<any>(`${this.apiUrl}/users/${this.selectedUser.id}/logos`, logoUpdates).subscribe({
      next: (response) => {
        this.logoMessage = 'User logos updated successfully';
        // Update the user in the list
        const index = this.users.findIndex(u => u.id === this.selectedUser!.id);
        if (index !== -1) {
          this.users[index] = response.user;
          this.selectedUser = response.user;
        }
      },
      error: (err) => {
        console.error('Error updating user logos:', err);
        this.logoError = err.error?.message || 'Failed to update user logos';
      }
    });
  }

  // File handling methods
  onFileSelected(event: any, logoPosition: 'logo1' | 'logo2' | 'logo3' | 'logo4' | 'selected'): void {
    this.uploadingLogo = logoPosition;
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;

      // Show preview
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  uploadSelectedFile(): void {
    if (!this.selectedUser || !this.selectedFile || !this.uploadingLogo || !this.imagePreview) {
      this.logoError = 'Please select a user, logo position, and file to upload';
      return;
    }

    // Get the position number
    const positionMap = {
      'logo1': 1,
      'logo2': 2,
      'logo3': 3,
      'logo4': 4,
      'selected': 0
    };

    // Set upload in progress
    this.uploadInProgress = true;
    this.logoMessage = '';
    this.logoError = '';

    // Send the image data to the server
    this.http.post<any>(`${this.apiUrl}/users/${this.selectedUser.id}/upload-logo`, {
      image_data: this.imagePreview,
      position: positionMap[this.uploadingLogo]
    }).subscribe({
      next: (response) => {
        // Update the form data with the new URL
        if (this.uploadingLogo === 'logo1') {
          this.logoFormData.logo1_url = response.url;
        } else if (this.uploadingLogo === 'logo2') {
          this.logoFormData.logo2_url = response.url;
        } else if (this.uploadingLogo === 'logo3') {
          this.logoFormData.logo3_url = response.url;
        } else if (this.uploadingLogo === 'logo4') {
          this.logoFormData.logo4_url = response.url;
        } else if (this.uploadingLogo === 'selected') {
          this.logoFormData.selected_logo_url = response.url;
        }

        // Clear the file input
        this.selectedFile = null;
        this.imagePreview = null;
        this.uploadInProgress = false;
        this.logoMessage = 'Logo uploaded successfully!';

        // Also update the user object
        if (this.selectedUser) {
          if (this.uploadingLogo === 'logo1') {
            this.selectedUser.logo1_url = response.url;
          } else if (this.uploadingLogo === 'logo2') {
            this.selectedUser.logo2_url = response.url;
          } else if (this.uploadingLogo === 'logo3') {
            this.selectedUser.logo3_url = response.url;
          } else if (this.uploadingLogo === 'logo4') {
            this.selectedUser.logo4_url = response.url;
          } else if (this.uploadingLogo === 'selected') {
            this.selectedUser.selected_logo_url = response.url;
          }
        }
      },
      error: (err) => {
        console.error('Error uploading logo:', err);
        this.logoError = err.error?.error || 'Failed to upload logo';
        this.uploadInProgress = false;
      }
    });
  }

  cancelUpload(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.uploadingLogo = null;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => {
        // Success
        alert('Copied to clipboard!');
      },
      () => {
        // Failed
        alert('Failed to copy');
      }
    );
  }

  setAsActive(logoNumber: number): void {
    if (!this.selectedUser) return;

    // Set the selected logo URL based on the logo number
    switch (logoNumber) {
      case 1:
        this.logoFormData.selected_logo_url = this.logoFormData.logo1_url;
        break;
      case 2:
        this.logoFormData.selected_logo_url = this.logoFormData.logo2_url;
        break;
      case 3:
        this.logoFormData.selected_logo_url = this.logoFormData.logo3_url;
        break;
      case 4:
        this.logoFormData.selected_logo_url = this.logoFormData.logo4_url;
        break;
    }

    this.logoMessage = `Logo ${logoNumber} set as active`;
  }

  // Add method to delete a result
  deleteMatchupResult(matchupCode: string | undefined): void {
    if (!matchupCode) {
      alert('Invalid matchup code');
      return;
    }

    if (!confirm(`Are you sure you want to delete the result for matchup ${matchupCode}?`)) {
      return; // User cancelled
    }

    this.http.delete(`${this.apiUrl}/bracket/delete-result/${matchupCode}`).subscribe({
      next: () => {
        alert(`Result for matchup ${matchupCode} deleted successfully`);

        // Reset the local result data
        if (this.selectedRound < 4) {
          const eastResult = this.eastRoundResults.find(r => r.matchupCode === matchupCode);
          if (eastResult) {
            eastResult.winner = '';
            eastResult.games = 4;
          }

          const westResult = this.westRoundResults.find(r => r.matchupCode === matchupCode);
          if (westResult) {
            westResult.winner = '';
            westResult.games = 4;
          }
        } else if (this.finalResult.matchupCode === matchupCode) {
          this.finalResult.winner = '';
          this.finalResult.games = 4;
        }
      },
      error: (err) => {
        console.error('Error deleting result:', err);
        alert('Failed to delete result. Please try again.');
      }
    });
  }

  // Check if a result exists for a matchup
  hasExistingResult(matchupCode: string | undefined): boolean {
    if (!matchupCode) {
      return false; // If no matchup code, there's no result
    }

    if (this.selectedRound < 4) {
      const eastResult = this.eastRoundResults.find(r => r.matchupCode === matchupCode);
      if (eastResult && eastResult.winner) return true;

      const westResult = this.westRoundResults.find(r => r.matchupCode === matchupCode);
      if (westResult && westResult.winner) return true;
    } else if (this.finalResult.matchupCode === matchupCode && this.finalResult.winner) {
      return true;
    }

    return false;
  }

  // Headlines management
  loadHeadlines(): void {
    this.headlineMessage = '';
    this.headlineError = '';

    // Reset edit mode
    this.selectedHeadlineId = null;

    // Load user teams for headline association
    this.loadUserTeams();

    // Call the admin endpoint to get all headlines including inactive ones
    this.http.get<Headline[]>(`${this.apiUrl}/admin/headlines`).subscribe({
      next: (data) => {
        this.headlines = data;
        this.filterHeadlines();
      },
      error: (err) => {
        console.error('Error loading headlines:', err);
        this.headlineError = 'Failed to load headlines';
      }
    });
  }

  // Load user teams for headlines
  loadUserTeams(): void {
    this.http.get<User[]>(`${this.apiUrl}/users`).subscribe({
      next: (data) => {
        this.userTeams = data.map(user => ({
          id: user.id,
          team_name: user.team_name
        }));
      },
      error: (err) => {
        console.error('Error loading user teams:', err);
      }
    });
  }

  createHeadline(): void {
    // Validate input
    if (!this.newHeadline.headline || this.newHeadline.headline.trim() === '') {
      this.headlineError = 'Headline text cannot be empty';
      return;
    }

    this.headlineMessage = '';
    this.headlineError = '';

    // Create new headline via API
    this.http.post<any>(`${this.apiUrl}/headlines`, this.newHeadline).subscribe({
      next: (response) => {
        this.headlineMessage = 'Headline created successfully';

        // Add the new headline to the list with the returned ID
        const newHeadline: Headline = {
          id: response.id,
          headline: this.newHeadline.headline,
          created: new Date().toISOString(),
          team_name: this.newHeadline.team_name,
          is_active: true
        };

        // Add to beginning of array (newest first)
        this.headlines.unshift(newHeadline);

        // Clear form
        this.newHeadline = {
          headline: '',
          team_name: null
        };

        // Update filtered list
        this.filterHeadlines();
      },
      error: (err) => {
        console.error('Error creating headline:', err);
        this.headlineError = err.error?.message || 'Failed to create headline';
      }
    });
  }

  startEditHeadline(headline: Headline): void {
    // Set the selected headline ID to enable edit mode
    this.selectedHeadlineId = headline.id;
  }

  saveHeadline(headline: Headline): void {
    // Validate input
    if (!headline.headline || headline.headline.trim() === '') {
      this.headlineError = 'Headline text cannot be empty';
      return;
    }

    this.headlineMessage = '';
    this.headlineError = '';

    // Update headline via API
    this.http.put<any>(`${this.apiUrl}/admin/headlines/${headline.id}`, {
      headline: headline.headline,
      team_name: headline.team_name,
      is_active: headline.is_active
    }).subscribe({
      next: (response) => {
        this.headlineMessage = 'Headline updated successfully';

        // Update local headline data
        const index = this.headlines.findIndex(h => h.id === headline.id);
        if (index !== -1) {
          this.headlines[index] = response.headline;
        }

        // Exit edit mode
        this.selectedHeadlineId = null;

        // Update filtered list
        this.filterHeadlines();
      },
      error: (err) => {
        console.error('Error updating headline:', err);
        this.headlineError = err.error?.message || 'Failed to update headline';
      }
    });
  }

  cancelEditHeadline(): void {
    // Exit edit mode without saving
    this.selectedHeadlineId = null;

    // Refresh headlines to reset any changes
    this.loadHeadlines();
  }

  deleteHeadline(headlineId: number): void {
    if (!confirm('Are you sure you want to delete this headline?')) {
      return;
    }

    this.headlineMessage = '';
    this.headlineError = '';

    // Delete headline via API
    this.http.delete<any>(`${this.apiUrl}/admin/headlines/${headlineId}`).subscribe({
      next: () => {
        this.headlineMessage = 'Headline deleted successfully';

        // Remove from local array
        this.headlines = this.headlines.filter(h => h.id !== headlineId);

        // Update filtered list
        this.filterHeadlines();
      },
      error: (err) => {
        console.error('Error deleting headline:', err);
        this.headlineError = err.error?.message || 'Failed to delete headline';
      }
    });
  }

  filterHeadlines(): void {
    // Filter headlines based on active status and team
    this.filteredHeadlines = this.headlines.filter(h => {
      // Filter by active status
      if (!this.headlinesFilter.showInactive && !h.is_active) {
        return false;
      }

      // Filter by team
      if (this.headlinesFilter.team === 'all') {
        return true;
      } else if (this.headlinesFilter.team === 'global') {
        return h.team_name === null;
      } else {
        return h.team_name === this.headlinesFilter.team;
      }
    });
  }
}
