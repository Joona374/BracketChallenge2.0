import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogoSelectionComponent } from './logo-selection.component';

describe('LogoSelectionComponent', () => {
  let component: LogoSelectionComponent;
  let fixture: ComponentFixture<LogoSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoSelectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogoSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
