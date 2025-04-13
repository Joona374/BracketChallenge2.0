import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Player } from "../models/player.model";
import { Observable, map } from "rxjs";
import { environment } from "../../environments/environment";


@Injectable({ providedIn: "root" })
export class PlayerService {
  private apiUrl = `${environment.apiUrl}/players`;

  constructor(private http: HttpClient) { }

  getPlayers(): Observable<Player[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(players => players.map(player => this.mapToPlayerModel(player)))
    );
  }

  private mapToPlayerModel(player: any): Player {
    return {
      id: player.id,
      api_id: player.api_id,
      firstName: player.first_name,
      lastName: player.last_name,
      team: player.team_abbr,
      position: player.position,
      jersey_number: player.jersey_number,
      birth_country: player.birth_country,
      birth_year: player.birth_year,
      headshot: player.headshot,
      isU23: player.is_U23,
      price: player.price,
      reg_gp: player.reg_gp,
      reg_goals: player.reg_goals,
      reg_assists: player.reg_assists,
      reg_points: player.reg_points,
      reg_plus_minus: player.reg_plus_minus,
      playoff_goals: player.playoff_goals,
      playoff_assists: player.playoff_assists,
      playoff_points: player.playoff_points,
      playoff_plus_minus: player.playoff_plus_minus
    };
  }
}
