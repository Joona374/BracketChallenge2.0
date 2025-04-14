import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, Renderer2 } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { RouterModule } from "@angular/router";
import { environment } from "../../../environments/environment";
import { Subscription, timer } from "rxjs";
import { switchMap } from "rxjs/operators";

interface Headline {
  id: number;
  headline: string;
  created: string;
  team_name: string | null;
}

interface FormattedHeadline {
  teamName: string | null;
  content: string;
  created: string;
}

@Component({
  selector: "app-news-reel",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./news-reel.component.html",
  styleUrls: ["./news-reel.component.css"],
})
export class NewsReelComponent implements OnInit, OnDestroy, AfterViewInit {
  formattedHeadlines: FormattedHeadline[] = [];
  repeatedHeadlines: FormattedHeadline[] = [];

  @ViewChild('newsTrack') newsTrack!: ElementRef;

  private subscription: Subscription | null = null;
  private refreshInterval = 5 * 60 * 1000; // Refresh every 5 minutes
  private repeatCount = 10; // Number of times to repeat headlines
  private scrollSpeed = 110; // Pixels per second - adjust this to change speed

  constructor(private http: HttpClient, private renderer: Renderer2) { }

  ngOnInit(): void {
    // Setup timer to refresh headlines periodically
    this.subscription = timer(0, this.refreshInterval)
      .pipe(switchMap(() => this.fetchHeadlines()))
      .subscribe({
        next: (data) => {
          // If no headlines are returned from API, use fallback headlines
          if (data.length === 0) {
            this.useDefaultHeadlines();
          } else {
            this.formattedHeadlines = data.map((h: Headline) => ({
              teamName: h.team_name,
              content: h.headline,
              created: h.created
            }));
          }
          this.createRepeatedHeadlines();
        },
        error: (err) => {
          console.error('Failed to fetch headlines:', err);
          this.useDefaultHeadlines();
          this.createRepeatedHeadlines();
        }
      });
  }

  ngAfterViewInit(): void {
    // Initial calculation
    setTimeout(() => this.updateScrollDuration(), 100);

    // Set up window resize listener to recalculate
    window.addEventListener('resize', () => this.updateScrollDuration());
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    window.removeEventListener('resize', () => this.updateScrollDuration());
  }

  private fetchHeadlines() {
    console.log("Fetching headlines from API...");
    return this.http.get<Headline[]>(`${environment.apiUrl}/headlines`);
  }

  private useDefaultHeadlines() {
    // Fallback headlines in case API fails or returns no data
    this.formattedHeadlines = [
      { teamName: "Playoffs", content: "🔥 Bracket Deadline: April 20 at 21:00 EET", created: "2023-04-20T21:00:00Z" },
      { teamName: "NHL", content: "🧊 Eastern Conference could get wild", created: "2023-04-19T18:00:00Z" },
      { teamName: "BracketChallenge", content: "🚨 Make your picks before the puck drops!", created: "2023-04-18T12:00:00Z" },
      { teamName: "Stanley", content: "🏆 Who will hoist the Cup? You decide!", created: "2023-04-17T09:00:00Z" },
      { teamName: "Hockey", content: "😤 Don't sleep on the underdogs", created: "2023-04-16T15:00:00Z" }
    ];
  }

  private createRepeatedHeadlines() {
    // Create repeated headlines array by repeating the headlines array multiple times
    this.repeatedHeadlines = [];
    for (let i = 0; i < this.repeatCount; i++) {
      this.repeatedHeadlines.push(...this.formattedHeadlines);
    }

    // Update the scroll duration after headlines have been updated
    setTimeout(() => this.updateScrollDuration(), 100);
  }

  // Used to ensure consistent URLs, even for null team names
  getTeamNameForUrl(teamName: string | null): string {
    return teamName ? teamName.replace(/\s+/g, ' ') : 'system';
  }

  // Used to display a user-friendly team name without spaces
  getDisplayTeamName(teamName: string | null): string {
    if (!teamName) return 'System';
    // Remove spaces and capitalize each word
    return teamName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private updateScrollDuration(): void {
    if (!this.newsTrack) return;

    const trackElement = this.newsTrack.nativeElement;
    const trackWidth = trackElement.scrollWidth;

    // With our new animation starting at translateX(0), the total scrolling 
    // distance is just the track width (plus a small buffer)
    const totalDistance = trackWidth + 100; // Add small buffer for smoother transition

    // Calculate duration based on desired pixels per second speed
    const durationInSeconds = totalDistance / this.scrollSpeed;

    // Set the animation duration directly on the element
    this.renderer.setStyle(
      trackElement,
      'animation-duration',
      `${durationInSeconds}s`
    );

    console.log(`News reel: ${trackWidth}px wide, ${durationInSeconds}s duration at ${this.scrollSpeed}px/s`);
  }

  formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(',', '');
  }
}
