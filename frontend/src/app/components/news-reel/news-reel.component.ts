import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-news-reel",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./news-reel.component.html",
  styleUrls: ["./news-reel.component.css"],
})
export class NewsReelComponent {
  headlines: string[] = [
    "🔥 Bracket Deadline: April 20 at 21:00 EET",
    "🧊 Eastern Conference could get wild",
    "🚨 Make your picks before the puck drops!",
    "🏆 Who will hoist the Cup? You decide!",
    "😤 Don’t sleep on the underdogs",
  ];
}
