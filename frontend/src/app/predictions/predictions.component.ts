import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Player } from "../models/player.model";
import { Goalie } from "../models/goalie.model";
import { PlayerService } from "../services/player.service";
import { GoalieService } from "../services/goalie.service";
import { HttpClient } from "@angular/common/http";
import { TooltipComponent } from "../tooltip/tooltip.component";
import { environment } from "../../environments/environment";


type PredictionCategory =
  | "connSmythe"
  | "penaltyMinutes"
  | "goals"
  | "defensePoints"
  | "U23Points"
  | "goalieGaa"
  | "finnishPoints";

interface PlayerBase {
  id: number;
  firstName: string;
  lastName: string;
  team: string;
  position: string;
  [key: string]: any; // Allow access to any property
}

@Component({
  selector: "app-predictions",
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipComponent],
  templateUrl: "./predictions.component.html",
  styleUrls: ["./predictions.component.css"],
})
export class PredictionsComponent implements OnInit {
  players: Player[] = [];
  goalies: Goalie[] = [];
  searchTerm: string = "";

  // Current category being viewed
  selectedCategory: PredictionCategory = "U23Points";

  // Store picks for each category (up to 3 players per category)
  predictions: Record<PredictionCategory, PlayerBase[]> = {
    connSmythe: [],
    penaltyMinutes: [],
    goals: [],
    defensePoints: [],
    U23Points: [],
    goalieGaa: [],
    finnishPoints: []
  };

  // Category display names
  categoryLabels: Record<PredictionCategory, string> = {
    connSmythe: "Conn Smythe -voittaja",
    penaltyMinutes: "Jäähypörssi",
    goals: "Maalipörssi",
    defensePoints: "Puolustajien pistepörssi",
    U23Points: "U23 pistepörssi",
    goalieGaa: "Paras GAA -maalivahti",
    finnishPoints: "Suomalaisten pistepörssi"
  };

  // Update these initial values at the class level
  sortKey: keyof Player | keyof Goalie | null = 'reg_points';  // Allow null for reset functionality
  sortAsc: boolean = false;  // Keep false for descending order

  constructor(private playerService: PlayerService, private goalieService: GoalieService, private http: HttpClient) { }

  ngOnInit(): void {
    this.playerService.getPlayers().subscribe((data) => {
      this.players = data;
      this.loadPredictions();
    });

    this.goalieService.getGoalies().subscribe(data => {
      this.goalies = data;
    });
  }

  // Get filtered players based on selected category and search term
  get filteredPlayers(): (Player | Goalie)[] {
    let result: (Player | Goalie)[] = [];

    // Apply category filters
    switch (this.selectedCategory) {
      case "defensePoints":
        result = this.players.filter(p => p.position === "D");
        break;
      case "U23Points":
        result = this.players.filter(p => p.isU23 === true);
        break;
      case "goalieGaa":
        result = this.goalies;
        break;
      case "finnishPoints":
        result = this.players.filter(p => p.birth_country === "FIN");
        break;
      default:
        result = this.players;
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

  private sortedPlayers(players: (Player | Goalie)[]): (Player | Goalie)[] {
    if (!this.sortKey) return players;

    return players.slice().sort((a, b) => {
      const aValue = this.sortKey && a.hasOwnProperty(this.sortKey) ? a[this.sortKey as keyof typeof a] : undefined;
      const bValue = this.sortKey && b.hasOwnProperty(this.sortKey) ? b[this.sortKey as keyof typeof b] : undefined;

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

  sortBy(key: keyof Player | keyof Goalie): void {
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

  selectPlayer(player: Player | Goalie): void {
    const currentPicks = this.predictions[this.selectedCategory];

    if (currentPicks.length < 3) {
      currentPicks.push(player);
    } else {
      alert("Olet jo valinnut kolme pelaajaa tähän kategoriaan.");
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
      alert("Sinun täytyy olla kirjautunut sisään tallentaaksesi veikkauksesi.");
      return;
    }

    // Check if all categories have 3 picks
    const allCategoriesFilled = Object.values(this.predictions).every(
      (picks) => picks.length === 3
    );

    if (!allCategoriesFilled) {
      alert("Täytä kaikki kategoriat (3 valintaa per kategoria) ennen kuin tallennat.");
      return;
    }

    // Create payload for API
    const payload = {
      user_id: user.id,
      predictions: this.predictions
    };

    // Send HTTP POST request to save predictions
    this.http.post(`${environment.apiUrl}/predictions/save`, payload)
      .subscribe({
        next: (response: any) => {
          alert("✅ Veikkaukset tallennettu onnistuneesti!");
        },
        error: (err) => {
          console.error("Veikkausten tallentaminen epäonnistui:", err);
          alert("❌ Virhe veikkauksia tallentaessa. Yritä uudelleen.");
        }
      });
  }

  resetPredictions(): void {
    if (confirm("Haluatko varmasti nollata tällä hetkellä valitut Top 3 veikkaukset?")) {
      // Reset all categories
      Object.keys(this.predictions).forEach(key => {
        this.predictions[key as PredictionCategory] = [];
      });
      console.log("Veikkaukset nollattu");
    }
  }

  loadPredictions(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user?.id) {
      console.log("No user logged in, skipping prediction load");
      return;
    }

    this.http.get(`${environment.apiUrl}/predictions/get?user_id=${user.id}`)
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
                    return this.players.find(p => p.id === savedPlayer.id) || this.goalies.find(g => g.id === savedPlayer.id) || null;
                  })
                  .filter((p: PlayerBase | null): p is PlayerBase => p !== null);
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

  castToPredictionCategory(key: string): PredictionCategory {
    return key as PredictionCategory;
  }

  // Helper methods to safely access properties with type checking
  isPlayer(obj: Player | Goalie): obj is Player {
    return obj.position !== 'G';
  }

  isGoalie(obj: Player | Goalie): obj is Goalie {
    return obj.position === 'G';
  }

  // Safe getters for player properties
  getGoals(player: Player | Goalie): number {
    return this.isPlayer(player) ? player.reg_goals || 0 : 0;
  }

  getAssists(player: Player | Goalie): number {
    return this.isPlayer(player) ? player.reg_assists || 0 : 0;
  }

  getPoints(player: Player | Goalie): number {
    return this.isPlayer(player) ? player.reg_points || 0 : 0;
  }

  getPlusMinus(player: Player | Goalie): number {
    return this.isPlayer(player) ? player.reg_plus_minus || 0 : 0;
  }

  // Safe getters for goalie properties
  getGaa(player: Player | Goalie): string {
    return this.isGoalie(player) ? (player.reg_gaa || 0).toFixed(2) : '0.00';
  }

  getSavePct(player: Player | Goalie): string {
    return this.isGoalie(player) ? ((player.reg_save_pct || 0) * 100).toFixed(2) : '0.00';
  }

  getShutouts(player: Player | Goalie): number {
    return this.isGoalie(player) ? player.reg_shutouts || 0 : 0;
  }

  getWins(player: Player | Goalie): number {
    return this.isGoalie(player) ? player.reg_wins || 0 : 0;
  }
}