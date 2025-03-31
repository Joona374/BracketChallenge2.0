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
  // Instead of saying SlotKey[] = [...]
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

  constructor(private playerService: PlayerService, private http: HttpClient) {}

  ngOnInit(): void {
    this.playerService.getPlayers().subscribe((data) => {
      this.players = data;
    });
  }

  get availablePlayers(): Player[] {
    let result = this.players;

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

      result = result.filter(
        (p) =>
          p.position === required &&
          !Object.values(this.slotMap).some((assigned) => assigned?.id === p.id)
      );
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

      return 0;
    });
  }

  assignPlayerToSlot(player: Player): void {
    if (this.selectedSlot) {
      // If a slot is selected, assign to that one
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

    const matchingSlots =
      positionToSlots[player.position as keyof typeof positionToSlots];

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
    if (!player) return slot;
    return `${player.firstName[0]}. ${player.lastName} (${player.team})`;
  }

  sortKey: keyof Player | null = null;
  sortAsc: boolean = true;

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
    this.slotKeys.forEach((key) => (this.slotMap[key] = null));
    this.selectedSlot = null;
  }

  saveLineup(): void {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user?.id) {
      alert("You must be logged in to save your lineup.");
      return;
    }

    const lineupPayload = Object.entries(this.slotMap).reduce(
      (acc, [slot, player]) => {
        acc[slot as SlotKey] = player ? player.id : null;
        return acc;
      },
      {} as Record<SlotKey, number | null>
    );

    this.http
      .post("http://localhost:5000/api/lineup/save", {
        user_id: user.id, // ✅ this was missing!
        lineup: lineupPayload,
      })
      .subscribe({
        next: () => alert("✅ Lineup saved!"),
        error: (err) => {
          console.error("Lineup save error:", err);
          alert("❌ Failed to save lineup.");
        },
      });
  }
}
