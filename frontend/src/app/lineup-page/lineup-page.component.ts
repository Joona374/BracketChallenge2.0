import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Player } from "../models/player.model";
import { PlayerService } from "../services/player.service";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";

type SlotKey = "L" | "C" | "R" | "LD" | "RD" | "G";

@Component({
  selector: "app-lineup-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./lineup-page.component.html",
  styleUrls: ["./lineup-page.component.css"],
})
export class LineupPageComponent implements OnInit {
  readonly forwardSlots = ["L", "C", "R"] as const;
  readonly defenderSlots = ["LD", "RD"] as const;
  readonly goalieSlot = "G" as const;

  players: Player[] = [];
  slotKeys: SlotKey[] = ["L", "C", "R", "LD", "RD", "G"];

  slotMap: Record<SlotKey, Player | null> = {
    L: null,
    C: null,
    R: null,
    LD: null,
    RD: null,
    G: null,
  };

  selectedSlot: SlotKey | null = null;
  searchTerm: string = "";
  totalsBudget: number = 2000000;

  // Trade and lineup lock properties
  lineupLocked: boolean = false;
  remainingTrades: number = 9;
  maxTrades: number = 9;

  // Add this helper method to track unsaved changes
  private hasUnsavedChanges = false;

  // Add these new properties
  private originalLineup: Record<SlotKey, Player | null> = {
    L: null, C: null, R: null, LD: null, RD: null, G: null
  };
  private pendingTradeSlots: Set<SlotKey> = new Set();

  // Add confirmed trades counter
  private confirmedTradesUsed: number = 0;

  constructor(private playerService: PlayerService, private http: HttpClient) { }

  ngOnInit(): void {
    this.playerService.getPlayers().subscribe((data) => {
      this.players = data;
      // After players are loaded, load saved lineup if it exists
      this.loadSavedLineup();
    });
  }

  loadSavedLineup(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    if (!user?.id) {
      console.log("User not logged in, not loading lineup");
      return;
    }

    this.http.get(`http://localhost:5000/api/lineup/get?user_id=${user.id}`)
      .subscribe({
        next: (res: any) => {
          if (res.lineup) {
            const savedLineup = res.lineup;

            // Create a map of player IDs to player objects for quick lookup
            const playerMap = new Map<number, Player>();
            this.players.forEach(player => playerMap.set(player.id, player));

            // For each slot, find the player by ID and assign it
            Object.keys(savedLineup).forEach(slot => {
              const playerId = savedLineup[slot];
              if (playerId !== null) {
                this.slotMap[slot as SlotKey] = playerMap.get(playerId) || null;
              }
            });

            // Store the original lineup state
            Object.keys(this.slotMap).forEach(slot => {
              this.originalLineup[slot as SlotKey] = this.slotMap[slot as SlotKey];
            });

            this.pendingTradeSlots.clear();

            // Update budget and trades info
            this.totalsBudget = res.effectiveBudget;
            this.remainingTrades = res.remainingTrades;

            // Check if all slots are filled to determine if lineup is locked
            const filledSlots = Object.values(this.slotMap).filter(player => player !== null).length;
            if (filledSlots === this.slotKeys.length) {
              this.lineupLocked = true;
            }
            console.log("Lineup loaded successfully");
          }
        },
        error: (err) => {
          if (err.status === 404) {
            console.log("No saved lineup found for this user");
          } else {
            console.error("Failed to load saved lineup", err);
          }
        }
      });
  }

  get availablePlayers(): Player[] {
    // Start with all players
    let result = this.players;

    // Create a set of player IDs that are already assigned to slots
    const assignedPlayerIds = new Set<number>();
    Object.values(this.slotMap).forEach(player => {
      if (player) assignedPlayerIds.add(player.id);
    });

    // Filter out players already assigned to any slot
    result = result.filter(p => !assignedPlayerIds.has(p.id));

    if (this.selectedSlot) {
      const positionMap: Record<SlotKey, "L" | "C" | "R" | "D" | "G"> = {
        L: "L",
        C: "C",
        R: "R",
        LD: "D",
        RD: "D",
        G: "G",
      };

      const required = positionMap[this.selectedSlot];
      // Now we only need to filter by position since assigned players are already excluded
      result = result.filter(p => p.position === required);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.firstName.toLowerCase().includes(term) ||
          p.lastName.toLowerCase().includes(term) ||
          p.team.toLowerCase().includes(term)
      );
    }

    return this.sortedPlayers(result);
  }

  get remainingBudget(): number {
    const usedBudget = Object.values(this.slotMap)
      .filter((player) => player !== null)
      .reduce((sum, player) => sum + (player?.price || 0), 0);
    return this.totalsBudget - usedBudget;
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

  // Add getter for actual remaining trades
  get effectiveRemainingTrades(): number {
    const pendingTrades = this.slotKeys.reduce((count, slot) => {
      const originalPlayer = this.originalLineup[slot];
      const currentPlayer = this.slotMap[slot];
      return count + (originalPlayer?.id !== currentPlayer?.id ? 1 : 0);
    }, 0);
    return this.maxTrades - (this.confirmedTradesUsed + pendingTrades);
  }

  onSlotClick(slot: SlotKey): void {
    if (this.lineupLocked) {
      // Check if removing this player would exceed trade limit
      if (this.slotMap[slot] &&
        this.slotMap[slot] !== this.originalLineup[slot] &&
        this.effectiveRemainingTrades <= 0) {
        alert('You have no trades remaining for this playoff season.');
        return;
      }
      if (this.slotMap[slot]) {
        this.slotMap[slot] = null;
      }
      this.selectedSlot = slot;
    } else {
      this.selectedSlot = this.selectedSlot === slot ? null : slot;
    }
  }

  assignPlayerToSlot(player: Player): void {
    if (this.lineupLocked && this.effectiveRemainingTrades < 0) {
      alert('You have no trades remaining for this playoff season.');
      return;
    }

    // Check if adding this player would exceed the budget
    let currentPrice = 0;
    if (this.selectedSlot) {
      const currentlyAssigned = this.slotMap[this.selectedSlot];
      currentPrice = currentlyAssigned?.price || 0;
    }

    if (this.remainingBudget + currentPrice < player.price) {
      alert(
        `Cannot afford ${player.firstName} ${player.lastName} (${this.formatPrice(player.price)}). Remaining budget: ${this.formatPrice(this.remainingBudget)}`
      );
      return;
    }

    if (this.selectedSlot) {
      // Mark slot for pending trade if the new player is different from original
      if (this.lineupLocked && player !== this.originalLineup[this.selectedSlot]) {
        this.pendingTradeSlots.add(this.selectedSlot);
      }

      this.slotMap[this.selectedSlot] = player;
      this.selectedSlot = null;
      return;
    }

    // No slot selected — find the first empty matching slot
    const positionToSlots: Record<"L" | "C" | "R" | "D" | "G", SlotKey[]> = {
      L: ["L"],
      C: ["C"],
      R: ["R"],
      D: ["LD", "RD"],
      G: ["G"],
    };

    const matchingSlots = positionToSlots[player.position as keyof typeof positionToSlots];
    for (const slot of matchingSlots) {
      if (!this.slotMap[slot]) {
        this.slotMap[slot] = player;
        return;
      }
    }

    // Optional: alert user if no matching slot is available
    alert(`No empty slot available for position ${player.position}`);
  }

  formatPlayer(slot: SlotKey): string {
    const player = this.slotMap[slot];
    if (!player) {
      if (slot === "L") return "VL";
      else if (slot === "C") return "KH";
      else if (slot === "R") return "OL";
      else if (slot === "LD") return "VP";
      else if (slot === "RD") return "OP";
      else return "MV";

    };
    return `${player.firstName[0]}. ${player.lastName} (${this.formatPrice(player.price)})`;
  }

  // Helper method to format price as currency
  formatPrice(price: number): string {
    return "$" + price.toLocaleString();
  }

  sortKey: keyof Player | null = 'price';  // Changed from null to 'price'
  sortAsc: boolean = false;  // Changed from true to false for descending order

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

  getPlayerClass(slot: SlotKey): string[] {
    const player = this.slotMap[slot];
    if (!player) return [];
    const team = player.team?.toLowerCase();
    return ["team", "selected", team];
  }

  clearLineup(): void {
    // Don't allow clearing lineup after it's locked
    if (this.lineupLocked) {
      alert("Your lineup is locked. You can only make trades by replacing individual players.");
      return;
    }
    this.slotKeys.forEach((key) => (this.slotMap[key] = null));
    this.selectedSlot = null;
  }

  resetLineup(): void {
    // Restore original lineup
    Object.keys(this.originalLineup).forEach(slot => {
      this.slotMap[slot as SlotKey] = this.originalLineup[slot as SlotKey];
    });
    this.pendingTradeSlots.clear();
    this.selectedSlot = null;
  }

  saveLineup(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    if (!user?.id) {
      alert("You must be logged in to save your lineup.");
      return;
    }

    // Check if all positions are filled
    const emptySlots = this.slotKeys.filter(key => this.slotMap[key] === null);
    if (emptySlots.length > 0) {
      alert(`Please fill all positions before saving. Empty positions: ${emptySlots.join(', ')}`);
      return;
    }

    const lineupPayload = Object.entries(this.slotMap).reduce(
      (acc, [slot, player]) => {
        acc[slot as SlotKey] = player ? player.id : null;
        return acc;
      },
      {} as Record<SlotKey, number | null>
    );

    // Calculate trades used if lineup is locked
    const tradesUsed = this.lineupLocked ? this.slotKeys.reduce((count, slot) => {
      const originalPlayer = this.originalLineup[slot];
      const currentPlayer = this.slotMap[slot];
      return count + (originalPlayer?.id !== currentPlayer?.id ? 1 : 0);
    }, 0) : 0;

    this.http.post("http://localhost:5000/api/lineup/save", {
      user_id: user.id,
      lineup: lineupPayload,
      tradesUsed: tradesUsed,
      unusedBudget: this.remainingBudget
    }).subscribe({
      next: () => {
        if (!this.lineupLocked) {
          this.lineupLocked = true;
          // Store the newly saved lineup as original
          Object.keys(this.slotMap).forEach(slot => {
            this.originalLineup[slot as SlotKey] = this.slotMap[slot as SlotKey];
          });
          alert("✅ Lineup saved! Your lineup is now locked for the playoffs. You have 9 trades available.");
        } else {
          // Count trades used in this save
          const tradesUsed = this.slotKeys.reduce((count, slot) => {
            const originalPlayer = this.originalLineup[slot];
            const currentPlayer = this.slotMap[slot];
            return count + (originalPlayer?.id !== currentPlayer?.id ? 1 : 0);
          }, 0);

          this.confirmedTradesUsed += tradesUsed;

          // Update original lineup
          Object.keys(this.slotMap).forEach(slot => {
            this.originalLineup[slot as SlotKey] = this.slotMap[slot as SlotKey];
          });

          alert(`✅ ${tradesUsed} trade${tradesUsed > 1 ? 's' : ''} completed! You have ${this.effectiveRemainingTrades} trades remaining.`);
        }
      },
      error: (err) => {
        console.error("Lineup save error:", err);
        alert("❌ Failed to save lineup.");
      },
    });
  }
}
