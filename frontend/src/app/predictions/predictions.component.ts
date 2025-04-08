import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Player } from "../models/player.model";
import { PlayerService } from "../services/player.service";
import { HttpClient } from "@angular/common/http";

type PredictionCategory =
  | "connSmythe"
  | "penaltyMinutes"
  | "goals"
  | "points"
  | "defensePoints"
  | "U23Points"
  | "goalieGaa"
  | "finnishPoints";

@Component({
  selector: "app-predictions",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./predictions.component.html",
  styleUrls: ["./predictions.component.css"],
})
export class PredictionsComponent implements OnInit {
  players: Player[] = [];
  searchTerm: string = "";

  // Current category being viewed
  selectedCategory: PredictionCategory = "points";

  // Store picks for each category (up to 3 players per category)
  predictions: Record<PredictionCategory, Player[]> = {
    connSmythe: [],
    penaltyMinutes: [],
    goals: [],
    points: [],
    defensePoints: [],
    U23Points: [],
    goalieGaa: [],
    finnishPoints: []
  };

  // Category display names
  categoryLabels: Record<PredictionCategory, string> = {
    connSmythe: "Conn Smythe voittaja",
    penaltyMinutes: "Jäähypörssi",
    goals: "Maalipörssi",
    points: "Pistepörssi",
    defensePoints: "Puolustajien pistepörssi",
    U23Points: "U23 pistepörssi",
    goalieGaa: "Paras GAA Maalivahti",
    finnishPoints: "Suomalaisten pisepörssi"
  };

  sortKey: keyof Player | null = null;
  sortAsc: boolean = true;

  constructor(private playerService: PlayerService, private http: HttpClient) { }

  ngOnInit(): void {
    this.playerService.getPlayers().subscribe((data) => {
      this.players = data;
      // After players are loaded, load saved predictions if they exist
      this.loadPredictions();
    });
  }

  // Get filtered players based on selected category and search term
  get filteredPlayers(): Player[] {
    let result = this.players;

    // Apply category filters
    switch (this.selectedCategory) {
      case "defensePoints":
        result = result.filter(p => p.position === "D");
        break;
      case "U23Points":
        result = result.filter(p => p.isU23 === true);
        break;
      case "goalieGaa":
        result = result.filter(p => p.position === "G");
        break;
      case "finnishPoints":
        result = result.filter(p => p.birth_country === "FIN");
        break;
    }

    // Filter out already picked players for this category
    const pickedIds = this.predictions[this.selectedCategory].map(p => p.id);
    result = result.filter(p => !pickedIds.includes(p.id));

    // Apply search term filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p =>
        p.firstName.toLowerCase().includes(term) ||
        p.lastName.toLowerCase().includes(term) ||
        p.team.toLowerCase().includes(term)
      );
    }

    return this.sortedPlayers(result);
  }

  private sortedPlayers(players: Player[]): Player[] {
    if (!this.sortKey) return players;

    return players.slice().sort((a, b) => {
      const aValue = a[this.sortKey!];
      const bValue = b[this.sortKey!];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return this.sortAsc
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return this.sortAsc
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return this.sortAsc ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }

  sortBy(key: keyof Player): void {
    if (this.sortKey === key) {
      if (this.sortAsc) {
        this.sortAsc = false; // 2nd click → descending
      } else {
        this.sortKey = null; // 3rd click → reset
      }
    } else {
      this.sortKey = key; // 1st click → new key ascending
      this.sortAsc = true;
    }
  }

  selectPlayer(player: Player): void {
    const currentPicks = this.predictions[this.selectedCategory];

    if (currentPicks.length < 3) {
      currentPicks.push(player);
    } else {
      alert("You've already selected 3 players for this category.");
    }
  }

  removePlayer(category: PredictionCategory, index: number): void {
    this.predictions[category].splice(index, 1);
  }

  changeCategory(category: PredictionCategory): void {
    this.selectedCategory = category;
  }

  savePredictions(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user?.id) {
      alert("You must be logged in to save your predictions.");
      return;
    }

    // Create payload for API
    const payload = {
      user_id: user.id,
      predictions: this.predictions
    };

    // Send HTTP POST request to save predictions
    this.http.post("http://localhost:5000/api/predictions/save", payload)
      .subscribe({
        next: (response: any) => {
          alert("✅ Predictions saved successfully!");
        },
        error: (err) => {
          console.error("Failed to save predictions:", err);
          alert("❌ Error saving predictions. Please try again.");
        }
      });
  }

  resetPredictions(): void {
    if (confirm("Are you sure you want to reset all your predictions?")) {
      // Reset all categories
      Object.keys(this.predictions).forEach(key => {
        this.predictions[key as PredictionCategory] = [];
      });
      console.log("All predictions reset");
    }
  }

  loadPredictions(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user?.id) {
      console.log("No user logged in, skipping prediction load");
      return;
    }

    this.http.get(`http://localhost:5000/api/predictions/get?user_id=${user.id}`)
      .subscribe({
        next: (response: any) => {
          if (response && response.predictions) {
            console.log("Retrieved saved predictions:", response.predictions);

            // Only apply predictions that contain valid player objects
            const validPredictions = { ...this.predictions };

            // For each prediction category, find the player in our loaded players list
            Object.keys(response.predictions).forEach(category => {
              if (response.predictions[category]?.length) {
                validPredictions[category as PredictionCategory] = response.predictions[category]
                  .map((savedPlayer: any) => {
                    // Find the player with matching ID from our loaded players list
                    return this.players.find(p => p.id === savedPlayer.id) || null;
                  })
                  .filter((p: Player | null): p is Player => p !== null);
              }
            });

            this.predictions = validPredictions;
            console.log("Applied saved predictions:", this.predictions);
          } else {
            console.log("No saved predictions found or empty data returned");
          }
        },
        error: (err) => {
          if (err.status === 404) {
            console.log("No predictions have been saved yet");
          } else {
            console.error("Failed to load predictions:", err);
          }
        }
      });
  }

  // Add this method to resolve the error
  castToPredictionCategory(key: string): PredictionCategory {
    return key as PredictionCategory;
  }
}