import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineupPageComponent } from './lineup-page.component';

describe('LineupPageComponent', () => {
  let component: LineupPageComponent;
  let fixture: ComponentFixture<LineupPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineupPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LineupPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
