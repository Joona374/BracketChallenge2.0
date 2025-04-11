export interface Goalie {
    id: number;
    api_id: number;
    firstName: string;
    lastName: string;
    team: string;
    position: string;
    jersey_number: string;
    birth_country: string;
    birth_year: number;
    headshot: string;
    isU23: boolean;
    price: number;
    reg_gp: number;
    reg_gaa: number;
    reg_save_pct: number;
    reg_shutouts: number;
    reg_wins: number;
    playoff_gp: number;
    playoff_gaa: number;
    playoff_save_pct: number;
    playoff_shutouts: number;
    playoff_wins: number;
}
