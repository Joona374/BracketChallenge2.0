// bracket.component.ts
import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

interface Matchups {
  west: any[];
  east: any[];
}

interface RoundPicks {
  [key: string]: string | string[];
}

@Component({
  selector: "app-bracket",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./bracket.component.html",
  styleUrls: ["./bracket.component.css"],
})
export class BracketComponent implements OnInit {
  matchups: Matchups = { west: [], east: [] };

  userPicks: {
    round1: { [key: number]: string };
    round1Games: { [key: number]: number };

    round2: RoundPicks;
    round2Games: { [key: string]: number };

    round3: RoundPicks;
    round3Games: { [key: string]: number };

    final: RoundPicks;
    finalGames: { [key: string]: number };
  } = {
    round1: {},
    round1Games: {},

    round2: {},
    round2Games: {},

    round3: {},
    round3Games: {},

    final: {},
    finalGames: {},
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user?.id) {
      window.location.href = "/";
      return;
    }

    this.http.get("http://localhost:5000/api/bracket/matchups").subscribe({
      next: (data: any) => {
        this.matchups = data;
        this.loadPreviousPicks(user.id); // ← Load saved picks after matchups
      },
      error: (err) => {
        console.error("Failed to load matchups", err);
      },
    });

    this.http.get("http://localhost:5000/api/bracket/matchups").subscribe({
      next: (data: any) => {
        this.matchups = data;
        this.computeNextRounds();
      },
      error: (err) => {
        console.error("Failed to load matchups", err);
      },
    });
  }

  isArray(val: any): val is string[] {
    return Array.isArray(val);
  }

  pickWinner(matchupId: number | string, team: string) {
    if (typeof matchupId === "number") {
      this.userPicks.round1[matchupId] = team;
    } else if (matchupId.startsWith("w-") || matchupId.startsWith("e-")) {
      this.userPicks.round2[`${matchupId}-winner`] = team;
    } else if (matchupId.includes("final")) {
      this.userPicks.round3[`${matchupId}-winner`] = team;
    } else if (matchupId === "cup") {
      this.userPicks.final["cup-winner"] = team;
    }
    this.computeNextRounds();
  }

  getPick(matchupId: number | string, team: string): boolean {
    if (typeof matchupId === "number") {
      return this.userPicks.round1[matchupId] === team;
    } else if (matchupId.startsWith("w-") || matchupId.startsWith("e-")) {
      return this.userPicks.round2[`${matchupId}-winner`] === team;
    } else if (matchupId.includes("final")) {
      return this.userPicks.round3[`${matchupId}-winner`] === team;
    } else if (matchupId === "cup") {
      return this.userPicks.final["cup-winner"] === team;
    }
    return false;
  }

  isTeamSelectable(team: string): boolean {
    return typeof team === "string" && team.trim() !== "";
  }

  computeNextRounds() {
    const orderedPair = (
      first: string | undefined,
      second: string | undefined
    ): string[] => [first || "", second || ""];

    const extractWinners = (round: RoundPicks): RoundPicks => {
      const result: RoundPicks = {};
      for (const key in round) {
        if (key.endsWith("-winner")) result[key] = round[key];
      }
      return result;
    };

    // Step 1: Preserve all user-chosen winners
    const round2Winners = extractWinners(this.userPicks.round2);
    const round3Winners = extractWinners(this.userPicks.round3);
    const finalWinners = extractWinners(this.userPicks.final);

    // Step 2: Clear matchups (but NOT winners)
    this.userPicks.round2 = {};
    this.userPicks.round3 = {};
    this.userPicks.final = {};

    // Step 3: Build round2 matchups from round1
    const w1 = this.userPicks.round1[1];
    const w2 = this.userPicks.round1[2];
    const w3 = this.userPicks.round1[3];
    const w4 = this.userPicks.round1[4];
    const e1 = this.userPicks.round1[5];
    const e2 = this.userPicks.round1[6];
    const e3 = this.userPicks.round1[7];
    const e4 = this.userPicks.round1[8];

    this.userPicks.round2["w-semi"] = orderedPair(w1, w2);
    this.userPicks.round2["w-semi2"] = orderedPair(w3, w4);
    this.userPicks.round2["e-semi"] = orderedPair(e1, e2);
    this.userPicks.round2["e-semi2"] = orderedPair(e3, e4);

    // Validate Round 2 winners against Round 1 picks
    Object.keys(round2Winners).forEach((key) => {
      const winner = round2Winners[key] as string;
      if (key === "w-semi-winner" && ![w1, w2].includes(winner)) {
        delete round2Winners[key];
      } else if (key === "w-semi2-winner" && ![w3, w4].includes(winner)) {
        delete round2Winners[key];
      } else if (key === "e-semi-winner" && ![e1, e2].includes(winner)) {
        delete round2Winners[key];
      } else if (key === "e-semi2-winner" && ![e3, e4].includes(winner)) {
        delete round2Winners[key];
      }
    });

    // Step 4: Build round3 matchups from winners of round2
    const wf1 = round2Winners["w-semi-winner"] as string;
    const wf2 = round2Winners["w-semi2-winner"] as string;
    const ef1 = round2Winners["e-semi-winner"] as string;
    const ef2 = round2Winners["e-semi2-winner"] as string;

    this.userPicks.round3["west-final"] = orderedPair(wf1, wf2);
    this.userPicks.round3["east-final"] = orderedPair(ef1, ef2);

    // Validate Round 3 winners against Round 2 winners
    Object.keys(round3Winners).forEach((key) => {
      const winner = round3Winners[key] as string;
      if (key === "west-final-winner" && ![wf1, wf2].includes(winner)) {
        delete round3Winners[key];
      } else if (key === "east-final-winner" && ![ef1, ef2].includes(winner)) {
        delete round3Winners[key];
      }
    });

    // Step 5: Build cup matchup from winners of round3
    const cup1 = round3Winners["west-final-winner"] as string;
    const cup2 = round3Winners["east-final-winner"] as string;

    this.userPicks.final["cup"] = orderedPair(cup1, cup2);

    // Validate Cup winner against conference finals winners
    Object.keys(finalWinners).forEach((key) => {
      const winner = finalWinners[key] as string;
      if (key === "cup-winner" && ![cup1, cup2].includes(winner)) {
        delete finalWinners[key];
      }
    });

    // Step 6: Reapply preserved winners
    Object.assign(this.userPicks.round2, round2Winners);
    Object.assign(this.userPicks.round3, round3Winners);
    Object.assign(this.userPicks.final, finalWinners);
  }

  savePicks() {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    const payload = {
      user_id: user.id,
      picks: this.userPicks,
    };

    this.http
      .post("http://localhost:5000/api/bracket/save-picks", payload)
      .subscribe({
        next: () => {
          alert("Picks saved successfully!");
        },
        error: (err) => {
          console.error("Failed to save picks", err);
          alert("Error saving picks.");
        },
      });
  }

  loadPreviousPicks(userId: number) {
    this.http
      .get(`http://localhost:5000/api/bracket/get-picks?user_id=${userId}`)
      .subscribe({
        next: (res: any) => {
          this.userPicks = res.picks;
          this.computeNextRounds(); // Important to rebuild the bracket UI!
        },
        error: (err) => {
          if (err.status === 404) {
            console.log("No previous picks found for this user.");
          } else {
            console.error("Failed to load picks", err);
          }
        },
      });
  }

  resetBracket() {
    this.userPicks = {
      round1: {},
      round1Games: {},

      round2: {},
      round2Games: {},

      round3: {},
      round3Games: {},

      final: {},
      finalGames: {},
    };
    this.computeNextRounds();
  }

  getTeamClass(matchupId: number | string, team: string): string {
    if (!this.isTeamSelectable(team)) return "team disabled";

    const selected = this.getPick(matchupId, team);
    const teamClass = team.toLowerCase(); // assumes team is the 3-letter abbreviation like "NYR"
    return selected ? `team selected ${teamClass}` : "team";
  }
}
