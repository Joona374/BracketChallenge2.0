export interface Player {
  id: number;
  api_id?: number;
  firstName: string;
  lastName: string;
  team: string;
  position: string;
  jersey_number?: string;
  birth_country?: string;
  birth_year?: number;
  headshot?: string;
  isU23: boolean;
  price: number;
  reg_gp?: number;
  reg_goals?: number;
  reg_assists?: number;
  reg_points?: number;
  reg_plus_minus?: number;
  playoff_goals?: number;
  playoff_assists?: number;
  playoff_points?: number;
  playoff_plus_minus?: number;
}
