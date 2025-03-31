import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewsReelComponent } from './news-reel.component';

describe('NewsReelComponent', () => {
  let component: NewsReelComponent;
  let fixture: ComponentFixture<NewsReelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewsReelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewsReelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
