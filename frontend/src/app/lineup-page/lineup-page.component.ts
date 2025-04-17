import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Player } from "../models/player.model";
import { Goalie } from "../models/goalie.model";
import { PlayerService } from "../services/player.service";
import { GoalieService } from "../services/goalie.service";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { DeadlineService } from "../services/deadline.service";
import { TooltipComponent } from "../tooltip/tooltip.component";

type SlotKey = "L" | "C" | "R" | "LD" | "RD" | "G";
type PlayerPosition = "L" | "C" | "R" | "D" | "G";
type SortableEntity = Player | Goalie;

@Component({
  selector: "app-lineup-page",
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipComponent],
  templateUrl: "./lineup-page.component.html",
  styleUrls: ["./lineup-page.component.css"],
})
export class LineupPageComponent implements OnInit {
  readonly forwardSlots = ["L", "C", "R"] as const;
  readonly defenderSlots = ["LD", "RD"] as const;
  readonly goalieSlot = "G" as const;

  players: Player[] = [];
  goalies: Goalie[] = [];
  slotKeys: SlotKey[] = ["L", "C", "R", "LD", "RD", "G"];

  slotMap: Record<SlotKey, Player | Goalie | null> = {
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

  // Properties for the original lineup
  private originalLineup: Record<SlotKey, Player | Goalie | null> = {
    L: null, C: null, R: null, LD: null, RD: null, G: null
  };
  private pendingTradeSlots: Set<SlotKey> = new Set();

  // Sorting properties
  sortKey: string | null = 'price';
  sortAsc: boolean = false;

  // Deadline property
  deadlinePassed: boolean = false;
  gracePeriodActive: boolean = false;
  gracePeriodEnd: string = '';

  constructor(
    private playerService: PlayerService,
    private goalieService: GoalieService,
    private http: HttpClient,
    private deadlineService: DeadlineService
  ) { }

  ngOnInit(): void {
    // Check deadline and grace period status
    this.deadlineService.getDeadlineStatus().subscribe({
      next: (status) => {
        this.deadlinePassed = status.deadline_passed;
        this.gracePeriodActive = !!status.grace_period_active;
        this.gracePeriodEnd = status.grace_period_end || '';
      },
      error: (err) => {
        console.error('Error checking deadline status:', err);
        this.deadlinePassed = false;
        this.gracePeriodActive = false;
      }
    });

    // Load both players and goalies
    this.playerService.getPlayers().subscribe((data) => {
      this.players = data;

      // After players are loaded, also load goalies
      this.goalieService.getGoalies().subscribe((goalieData) => {
        this.goalies = goalieData;

        // After both are loaded, load saved lineup
        this.loadSavedLineup();
      });
    });
  }

  // Helper methods to handle player and goalie stats safely
  getPlayerStats(entity: Player | Goalie, stat: string): number {
    if (this.isPlayer(entity)) {
      return (entity as any)[stat] || 0;
    }
    return 0;
  }

  getGoalieStats(entity: Player | Goalie, stat: string): number {
    if (this.isGoalie(entity)) {
      return (entity as any)[stat] || 0;
    }
    return 0;
  }

  isPlayer(entity: Player | Goalie): boolean {
    return entity && entity.position !== 'G';
  }

  isGoalie(entity: Player | Goalie): boolean {
    return entity && entity.position === 'G';
  }

  formatSavePercentage(entity: Player | Goalie): string {
    if (this.isGoalie(entity)) {
      const goalie = entity as Goalie;
      return (goalie.reg_save_pct || 0).toFixed(3);
    }
    return '0.000';
  }

  formatGAA(entity: Player | Goalie): string {
    if (this.isGoalie(entity)) {
      const goalie = entity as Goalie;
      return (goalie.reg_gaa || 0).toFixed(2);
    }
    return '0.00';
  }

  loadSavedLineup(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    if (!user?.id) {
      console.log("User not logged in, not loading lineup");
      return;
    }

    this.http.get(`${environment.apiUrl}/lineup/get?user_id=${user.id}`)
      .subscribe({
        next: (res: any) => {
          if (res.lineup) {
            const savedLineup = res.lineup;

            // Create maps for both players and goalies for quick lookup
            const playerMap = new Map<number, Player>();
            const goalieMap = new Map<number, Goalie>();

            this.players.forEach(player => playerMap.set(player.id, player));
            this.goalies.forEach(goalie => goalieMap.set(goalie.id, goalie));

            // For each slot, find the player by ID and assign it
            Object.keys(savedLineup).forEach(slot => {
              const playerId = savedLineup[slot];
              if (playerId !== null) {
                if (slot === 'G') {
                  this.slotMap[slot as SlotKey] = goalieMap.get(playerId) || null;
                } else {
                  this.slotMap[slot as SlotKey] = playerMap.get(playerId) || null;
                }
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

  isGoalieSlotSelected(): boolean {
    return this.selectedSlot === 'G';
  }

  get availablePlayers(): Array<Player | Goalie> {
    // Show either players or goalies based on the selected slot
    if (this.isGoalieSlotSelected()) {
      return this.availableGoalies;
    } else {
      return this.availableSkaters;
    }
  }

  private get availableSkaters(): Player[] {
    // Only show skaters (non-goalie players)
    let result = this.players;

    // Create a set of player IDs that are already assigned to slots
    const assignedPlayerIds = new Set<number>();
    Object.entries(this.slotMap).forEach(([slot, entity]) => {
      if (entity && slot !== 'G') {
        assignedPlayerIds.add(entity.id);
      }
    });

    // Filter out players already assigned to any slot
    result = result.filter(p => !assignedPlayerIds.has(p.id));

    if (this.selectedSlot && this.selectedSlot !== 'G') {
      const positionMap: Record<SlotKey, PlayerPosition> = {
        L: "L",
        C: "C",
        R: "R",
        LD: "D",
        RD: "D",
        G: "G",
      };

      const required = positionMap[this.selectedSlot];
      // Filter by position
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

    return this.sortedEntities(result) as Player[];
  }

  private get availableGoalies(): Goalie[] {
    let result = this.goalies;

    // Create a set of goalie IDs that are already assigned
    const assignedGoalieId = this.slotMap.G?.id;

    // Filter out goalies already assigned
    if (assignedGoalieId) {
      result = result.filter(g => g.id !== assignedGoalieId);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.firstName.toLowerCase().includes(term) ||
          g.lastName.toLowerCase().includes(term) ||
          g.team.toLowerCase().includes(term)
      );
    }

    return this.sortedEntities(result) as Goalie[];
  }

  get remainingBudget(): number {
    const usedBudget = Object.values(this.slotMap)
      .filter((player) => player !== null)
      .reduce((sum, player) => sum + (player?.price || 0), 0);
    return this.totalsBudget - usedBudget;
  }

  private sortedEntities<T extends SortableEntity>(entities: T[]): T[] {
    if (!this.sortKey) return entities;

    return entities.slice().sort((a, b) => {
      const aValue = a[this.sortKey as keyof T];
      const bValue = b[this.sortKey as keyof T];

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

  // Get actual remaining trades
  get effectiveRemainingTrades(): number {
    if (!this.deadlinePassed) {
      return this.maxTrades; // Always return max trades before deadline
    }

    // After deadline, count used trades
    const pendingTrades = this.slotKeys.reduce((count, slot) => {
      const originalPlayer = this.originalLineup[slot];
      const currentPlayer = this.slotMap[slot];
      return count + (originalPlayer?.id !== currentPlayer?.id ? 1 : 0);
    }, 0);
    return this.remainingTrades - pendingTrades;
  }

  onSlotClick(slot: SlotKey): void {
    if (this.gracePeriodActive) {
      alert('Kokoonpanon vaihdot on estetty alkuvaiheen aikana (24.4.2025 07:00 UTC+3 asti).');
      return;
    }

    // If deadline has passed, use trade system
    if (this.deadlinePassed) {
      if (this.slotMap[slot] &&
        this.slotMap[slot] !== this.originalLineup[slot] &&
        this.effectiveRemainingTrades <= 0) {
        alert('Sinulla ei ole enää vaihtoja jäljellä.');
        return;
      }
      if (this.slotMap[slot]) {
        this.slotMap[slot] = null;
      }
      this.selectedSlot = slot;
    } else {
      // Before deadline, allow free switches
      this.selectedSlot = this.selectedSlot === slot ? null : slot;
    }
  }

  private formatPlayerForDisplay(player: Player | Goalie | null): string {
    if (!player) return 'Empty slot';
    return `${player.firstName} ${player.lastName} (${this.formatPrice(player.price)})`;
  }

  assignPlayerToSlot(entity: Player | Goalie): void {
    if (this.gracePeriodActive) {
      alert('Kokoonpanon vaihdot on estetty alkuvaiheen aikana (24.4.2025 07:00 UTC+3 asti).');
      return;
    }

    if (this.deadlinePassed && this.effectiveRemainingTrades <= 0) {
      alert('Sinulla ei ole enää vaihtoja jäljellä.');
      return;
    }

    // Check if adding this player would exceed the budget
    let currentPrice = 0;
    if (this.selectedSlot) {
      const currentlyAssigned = this.slotMap[this.selectedSlot];
      currentPrice = currentlyAssigned?.price || 0;
    }

    if (this.remainingBudget + currentPrice < entity.price) {
      let fundsToUse = this.remainingBudget + currentPrice;
      alert(
        `${entity.firstName} ${entity.lastName} on liian kallis (${this.formatPrice(entity.price)}). Rahaa käytettävissä: ${this.formatPrice(fundsToUse)}`
      );
      return;
    }

    if (this.selectedSlot) {
      const currentPlayer = this.slotMap[this.selectedSlot];

      // If after deadline and making a change, show confirmation
      if (this.deadlinePassed && currentPlayer && entity.id !== currentPlayer.id) {
        const confirmed = confirm(
          `Vahvista vaihto:\n\n` +
          `${this.formatPlayerForDisplay(currentPlayer)} →\n` +
          `${this.formatPlayerForDisplay(entity)}\n\n` +
          `Sinulla on ${this.effectiveRemainingTrades} vaihtoa jäljellä.\n` +
          `Haluatko jatkaa?`
        );

        if (!confirmed) return;

        if (entity !== this.originalLineup[this.selectedSlot]) {
          this.pendingTradeSlots.add(this.selectedSlot);
        }
      }

      this.slotMap[this.selectedSlot] = entity;
      this.selectedSlot = null;
      return;
    }

    // No slot selected — find the first empty matching slot
    const positionToSlots: Record<PlayerPosition, SlotKey[]> = {
      L: ["L"],
      C: ["C"],
      R: ["R"],
      D: ["LD", "RD"],
      G: ["G"],
    };

    const matchingSlots = positionToSlots[entity.position as PlayerPosition];
    for (const slot of matchingSlots) {
      if (!this.slotMap[slot]) {
        this.slotMap[slot] = entity;
        return;
      }
    }

    // Optional: alert user if no matching slot is available
    alert(`No empty slot available for position ${entity.position}`);
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

  sortBy(key: string): void {
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
    if (this.gracePeriodActive) {
      alert('Kokoonpanon tyhjennys on estetty alkuvaiheen aikana (24.4.2025 07:00 UTC+3 asti).');
      return;
    }

    // Don't allow clearing lineup after deadline
    if (this.deadlinePassed) {
      alert("Lineup clearing is disabled after the deadline. You can only make trades by replacing individual players.");
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
    if (this.gracePeriodActive) {
      alert('Kokoonpanon tallennus on estetty alkuvaiheen aikana (24.4.2025 07:00 UTC+3 asti).');
      return;
    }

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

    // If after deadline, show confirmation for all trades
    if (this.deadlinePassed) {
      const trades = this.slotKeys
        .filter(slot => {
          const originalPlayer = this.originalLineup[slot];
          const currentPlayer = this.slotMap[slot];
          return originalPlayer?.id !== currentPlayer?.id;
        })
        .map(slot => {
          const originalPlayer = this.originalLineup[slot];
          const currentPlayer = this.slotMap[slot];
          return `${this.formatPlayerForDisplay(originalPlayer)} → ${this.formatPlayerForDisplay(currentPlayer)}`;
        });

      if (trades.length > 0) {
        const confirmed = confirm(
          `Vahvista seuraavat vaihdot:\n\n${trades.join('\n')}\n\n` +
          `Yhteensä ${trades.length} vaihto${trades.length > 1 ? 'a' : ''}.\n` +
          `Sinulla on ${this.effectiveRemainingTrades} vaihtoa jäljellä tämän jälkeen.\n\n` +
          `Haluatko jatkaa?`
        );

        if (!confirmed) return;
      }
    }

    const lineupPayload = Object.entries(this.slotMap).reduce(
      (acc, [slot, player]) => {
        acc[slot as SlotKey] = player ? player.id : null;
        return acc;
      },
      {} as Record<SlotKey, number | null>
    );

    // Only count trades after deadline
    const tradesUsed = this.deadlinePassed ?
      this.slotKeys.reduce((count, slot) => {
        const originalPlayer = this.originalLineup[slot];
        const currentPlayer = this.slotMap[slot];
        return count + (originalPlayer?.id !== currentPlayer?.id ? 1 : 0);
      }, 0) : 0;

    this.http.post(`${environment.apiUrl}/lineup/save`, {
      user_id: user.id,
      lineup: lineupPayload,
      tradesUsed: tradesUsed,
      unusedBudget: this.remainingBudget
    }).subscribe({
      next: (res: any) => {
        if (!this.deadlinePassed) {
          // Store the newly saved lineup as original
          Object.keys(this.slotMap).forEach(slot => {
            this.originalLineup[slot as SlotKey] = this.slotMap[slot as SlotKey];
          });
          alert('✅ Kokoonpano tallennettu! Voit muokata sitä vapaasti deadlineen asti.');
        } else {
          // Update remaining trades and original lineup
          this.remainingTrades -= tradesUsed;
          Object.keys(this.slotMap).forEach(slot => {
            this.originalLineup[slot as SlotKey] = this.slotMap[slot as SlotKey];
          });
          alert(`✅ ${tradesUsed} vaihto${tradesUsed > 1 ? 'a' : ''} tehty! Sinulla on ${this.effectiveRemainingTrades} vaihtoa jäljellä.`);
        }
      },
      error: (err) => {
        console.error("Lineup save error:", err);
        alert("❌ Kentällisen tallennus epäonnistui.");
      },
    });
  }
}
