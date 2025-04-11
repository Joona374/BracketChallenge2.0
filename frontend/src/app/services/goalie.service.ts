import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Goalie } from "../models/goalie.model";
import { Observable, map } from "rxjs";

@Injectable({ providedIn: "root" })
export class GoalieService {
    private apiUrl = "http://localhost:5000/api/goalies";

    constructor(private http: HttpClient) { }

    getGoalies(): Observable<Goalie[]> {
        return this.http.get<any[]>(this.apiUrl).pipe(
            map(goalies => goalies.map(goalie => this.mapToGoalieModel(goalie)))
        );
    }

    private mapToGoalieModel(goalie: any): Goalie {
        return {
            id: goalie.id,
            api_id: goalie.api_id,
            firstName: goalie.first_name,
            lastName: goalie.last_name,
            team: goalie.team_abbr,
            position: goalie.position,
            jersey_number: goalie.jersey_number,
            birth_country: goalie.birth_country,
            birth_year: goalie.birth_year,
            headshot: goalie.headshot,
            isU23: goalie.is_U23,
            price: goalie.price,
            reg_gp: goalie.reg_gp,
            reg_gaa: goalie.reg_gaa,
            reg_save_pct: goalie.reg_save_pct,
            reg_shutouts: goalie.reg_shutouts,
            reg_wins: goalie.reg_wins,
            playoff_gp: goalie.playoff_gp,
            playoff_gaa: goalie.playoff_gaa,
            playoff_save_pct: goalie.playoff_save_pct,
            playoff_shutouts: goalie.playoff_shutouts,
            playoff_wins: goalie.playoff_wins
        };
    }
}
