export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  team: string;
  position: "F" | "D" | "G";
  isRookie: boolean;
  price: number;
}
