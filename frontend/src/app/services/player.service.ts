import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Player } from "../models/player.model";
import { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class PlayerService {
  private apiUrl = "http://localhost:5000/api/players";

  constructor(private http: HttpClient) {}

  getPlayers(): Observable<Player[]> {
    return this.http.get<Player[]>(this.apiUrl);
  }
}
