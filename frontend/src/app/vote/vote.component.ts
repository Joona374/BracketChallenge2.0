import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { RouterModule } from '@angular/router';
import { TooltipComponent } from '../tooltip/tooltip.component';
import { environment } from "../../environments/environment";



interface PrizeDistribution {
  first: number;
  second: number;
  third: number;
}

@Component({
  selector: 'app-vote',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TooltipComponent],
  templateUrl: './vote.component.html',
  styleUrl: './vote.component.css'
})
export class VoteComponent implements OnInit, OnDestroy {
  // Entry fee options
  entryFeeOptions = [10, 15, 20, 25, 30];
  selectedEntryFee: number | null = null;

  // Prize distribution
  prizeDistribution: PrizeDistribution = {
    first: 70,
    second: 20,
    third: 10
  };

  // Previous vote (if user has already voted)
  previousVote: {
    entryFee: number;
    distribution: PrizeDistribution;
  } | null = null;

  // Total distribution (should always be 100%)
  get totalDistribution(): number {
    return this.prizeDistribution.first +
      this.prizeDistribution.second +
      this.prizeDistribution.third;
  }

  // Current voting stats
  entryFeeVotes: Record<number, number> = {};
  averageDistribution: PrizeDistribution = {
    first: 60,
    second: 25,
    third: 15
  };

  // UI state
  voteSuccess = false;
  voteError = false;
  errorMessage = '';
  showVotingStats = false;
  hasUserVoted = false;
  votingTimeRemaining = '';
  votingDeadlinePassed = false;
  isLoggedIn = false;

  // Deadline settings
  private votingDeadline = new Date('2025-04-23T00:00:00'); // Set to first playoff game
  private timerSubscription: Subscription | null = null;

  // Step size for distribution adjustment
  private readonly stepSize = 2;

  // Mock number of players for prize pool calculation
  private numberOfPlayers = 15;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadVotingData();
    this.startDeadlineTimer();
    this.checkLoginStatus();
    this.checkUserVote();
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  checkLoginStatus(): void {
    const storedUser = localStorage.getItem('loggedInUser');
    this.isLoggedIn = !!storedUser;
  }

  startDeadlineTimer(): void {
    // Update immediately
    this.updateRemainingTime();

    // Then update every second
    this.timerSubscription = interval(1000).subscribe(() => {
      this.updateRemainingTime();
    });
  }

  updateRemainingTime(): void {
    const now = new Date();
    const timeRemaining = this.votingDeadline.getTime() - now.getTime();

    if (timeRemaining <= 0) {
      this.votingTimeRemaining = 'Voting has ended';
      this.votingDeadlinePassed = true;
      if (this.timerSubscription) {
        this.timerSubscription.unsubscribe();
      }
      return;
    }

    // Calculate days, hours, minutes, seconds
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    // Format the string based on remaining time
    if (days > 0) {
      this.votingTimeRemaining = `${days} päivän, ${hours} tunnin`;
    } else if (hours > 0) {
      this.votingTimeRemaining = `${hours} tunnin, ${minutes} minuutin`;
    } else if (minutes > 0) {
      this.votingTimeRemaining = `${minutes} minuutin, ${seconds} sekunnin`;
    } else {
      this.votingTimeRemaining = `${seconds} sekunnin`;
    }
  }

  loadVotingData(): void {
    this.http.get<any>(`${environment.apiUrl}/votes/stats`).subscribe({
      next: (response) => {
        this.entryFeeVotes = response.entryFeeVotes;
        this.averageDistribution = response.averageDistribution;
        this.showVotingStats = true;
      },
      error: (error) => {
        console.error('Error loading voting data:', error);
      }
    });
  }

  checkUserVote(): void {
    const storedUser = localStorage.getItem('loggedInUser');
    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);
      this.http.get<any>(`${environment.apiUrl}/votes/user/${user.id}`).subscribe({
        next: (response) => {
          if (response && response.vote) {
            this.hasUserVoted = true;
            this.previousVote = {
              entryFee: response.vote.entry_fee,
              distribution: {
                first: response.vote.first_place_percentage,
                second: response.vote.second_place_percentage,
                third: response.vote.third_place_percentage
              }
            };
          }
        },
        error: (error) => {
          console.error('Error checking user vote:', error);
        }
      });
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }

  selectEntryFee(fee: number): void {
    if (this.hasUserVoted || this.votingDeadlinePassed) return;
    this.selectedEntryFee = fee;
  }

  adjustDistribution(position: keyof PrizeDistribution): void {
    if (this.hasUserVoted || this.votingDeadlinePassed) return;

    // Capture the values of all sliders before any changes
    const previousValues = {
      first: this.prizeDistribution.first,
      second: this.prizeDistribution.second,
      third: this.prizeDistribution.third
    };

    // Get the current position's value that was just changed
    const currentValue = this.prizeDistribution[position];
    const previousValue = previousValues[position];

    // Calculate the raw change (can be any value, not necessarily 2%)
    const rawChange = currentValue - previousValue;

    // If no change, exit early
    if (rawChange === 0) return;

    console.log(`${position} raw change: ${rawChange}`);

    // Enforce 2% increments by rounding to nearest 2% step and adding to previous value
    // This allows odd numbers like 33% to properly go to 35% (not 36%)
    const roundedChange = Math.round(rawChange / this.stepSize) * this.stepSize;
    const newValue = previousValue + roundedChange;

    console.log(`Enforcing 2% increment: ${previousValue} + ${roundedChange} = ${newValue}`);

    // Apply the enforced 2% increment value
    this.prizeDistribution[position] = newValue;

    // Determine the direction and amount of change
    const change = roundedChange; // This is now guaranteed to be a multiple of 2

    // Get the other positions we need to adjust
    const positions: Array<keyof PrizeDistribution> = ['first', 'second', 'third'];
    const otherPositions = positions.filter(p => p !== position);

    // When a slider is adjusted by 2%, distribute 1% change to each of the other sliders
    const adjust = -change / 2;

    // Check if adjusting either slider would take it below 0 or above 100
    if (previousValues[otherPositions[0]] + adjust < 0) {
      // First slider can't go below 0, put all adjustment on second slider
      this.prizeDistribution[otherPositions[0]] = 0;
      this.prizeDistribution[otherPositions[1]] = previousValues[otherPositions[1]] - change;
    }
    else if (previousValues[otherPositions[1]] + adjust < 0) {
      // Second slider can't go below 0, put all adjustment on first slider
      this.prizeDistribution[otherPositions[0]] = previousValues[otherPositions[0]] - change;
      this.prizeDistribution[otherPositions[1]] = 0;
    }
    else if (previousValues[otherPositions[0]] + adjust > 100) {
      // First slider can't go above 100, put all adjustment on second slider
      this.prizeDistribution[otherPositions[0]] = 100;
      this.prizeDistribution[otherPositions[1]] = previousValues[otherPositions[1]] - change;
    }
    else if (previousValues[otherPositions[1]] + adjust > 100) {
      // Second slider can't go above 100, put all adjustment on first slider
      this.prizeDistribution[otherPositions[0]] = previousValues[otherPositions[0]] - change;
      this.prizeDistribution[otherPositions[1]] = 100;
    }
    else {
      // Both sliders can be adjusted normally by 1% each
      this.prizeDistribution[otherPositions[0]] = previousValues[otherPositions[0]] + adjust;
      this.prizeDistribution[otherPositions[1]] = previousValues[otherPositions[1]] + adjust;
    }

    // Final check to ensure the total is exactly 100%
    const total = this.totalDistribution;
    if (total !== 100) {
      const diff = 100 - total;

      // Find a position that can accommodate the difference
      for (const pos of otherPositions) {
        const newValue = this.prizeDistribution[pos] + diff;
        if (newValue >= 0 && newValue <= 100) {
          this.prizeDistribution[pos] = newValue;
          break;
        }
      }
    }
  }

  canSubmitVote(): boolean {
    return this.isLoggedIn && !!this.selectedEntryFee && this.totalDistribution === 100 && !this.votingDeadlinePassed;
  }

  submitVote(): void {
    if (!this.canSubmitVote()) return;

    // Get the user from localStorage
    const storedUser = localStorage.getItem('loggedInUser');
    if (!storedUser) {
      this.voteError = true;
      this.errorMessage = 'You must be logged in to vote';
      setTimeout(() => this.voteError = false, 3000);
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      const voteData = {
        userId: user.id,
        entryFee: this.selectedEntryFee,
        distribution: this.prizeDistribution
      };

      this.http.post(`${environment.apiUrl}/votes`, voteData).subscribe({
        next: () => {
          this.voteSuccess = true;
          this.hasUserVoted = true;
          this.loadVotingData(); // Refresh stats
          setTimeout(() => this.voteSuccess = false, 3000);
        },
        error: (error) => {
          this.voteError = true;
          this.errorMessage = error.error.error || 'Failed to submit vote';
          setTimeout(() => this.voteError = false, 3000);
        }
      });
    } catch (e) {
      this.voteError = true;
      this.errorMessage = 'Error processing user data';
      setTimeout(() => this.voteError = false, 3000);
    }
  }

  // Helper methods for UI
  getTotalVotes(): number {
    return Object.values(this.entryFeeVotes).reduce((sum, count) => sum + count, 0);
  }

  getVotePercentage(votes: number | undefined): number {
    const total = this.getTotalVotes();
    if (!total || !votes) return 0;
    return Math.round((votes / total) * 100);
  }

  getPlayers(): number {
    return this.numberOfPlayers;
  }

  getPrizePool(): number {
    if (!this.selectedEntryFee) return 0;
    return this.selectedEntryFee * this.numberOfPlayers;
  }

  calculatePrize(position: keyof PrizeDistribution): number {
    if (!this.selectedEntryFee) return 0;
    const pool = this.getPrizePool();
    return Math.round((pool * this.prizeDistribution[position]) / 100);
  }

  // Fixed methods for pie chart visualization
  getSegmentStyle(position: keyof PrizeDistribution): object {
    const percentage = this.averageDistribution[position];
    const degrees = 3.6 * percentage; // 3.6 degrees per percentage point (360 / 100)

    if (position === 'first') {
      return {
        'clip-path': `polygon(50% 50%, 50% 0%, ${percentage > 50 ? '100% 0%, 100% 100%, 50% 50%' : '${50 + 50 * Math.sin(Math.PI * 2 * percentage / 100)}% ${50 - 50 * Math.cos(Math.PI * 2 * percentage / 100)}%'})`,
        'transform': 'rotate(0deg)',
        'background-color': '#ff4444',
        'height': '100%',
        'width': '100%',
        'position': 'absolute'
      };
    } else if (position === 'second') {
      const firstPercentage = this.averageDistribution.first;
      const startAngle = (firstPercentage / 100) * 360;
      return {
        'transform': `rotate(${startAngle}deg)`,
        'clip-path': `polygon(50% 50%, 50% 0%, ${percentage > 50 ? '100% 0%, 100% 100%, 50% 50%' : '${50 + 50 * Math.sin(Math.PI * 2 * percentage / 100)}% ${50 - 50 * Math.cos(Math.PI * 2 * percentage / 100)}%'})`,
        'background-color': '#44ff44',
        'height': '100%',
        'width': '100%',
        'position': 'absolute'
      };
    } else { // third
      const combinedPercentage = this.averageDistribution.first + this.averageDistribution.second;
      const startAngle = (combinedPercentage / 100) * 360;
      return {
        'transform': `rotate(${startAngle}deg)`,
        'clip-path': `polygon(50% 50%, 50% 0%, ${percentage > 50 ? '100% 0%, 100% 100%, 50% 50%' : '${50 + 50 * Math.sin(Math.PI * 2 * percentage / 100)}% ${50 - 50 * Math.cos(Math.PI * 2 * percentage / 100)}%'})`,
        'background-color': '#4444ff',
        'height': '100%',
        'width': '100%',
        'position': 'absolute'
      };
    }
  }

  // Simpler approach using conic-gradient for the pie chart
  getPieChartStyle(): object {
    const first = this.averageDistribution.first;
    const second = this.averageDistribution.second;
    const third = this.averageDistribution.third;

    return {
      'background': `conic-gradient(
        #ff4444 0% ${first}%, 
        #44ff44 ${first}% ${first + second}%, 
        #4444ff ${first + second}% 100%
      )`
    };
  }
}
