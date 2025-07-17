import { DecimalPipe, NgIf } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, DecimalPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  form!: FormGroup;

  margin: number | null = null;
  realMargin: number | null = null;
  SL: number | null = null;
  TP: number | null = null;
  SL1R: number | null = null;
  expectedRR: FormControl | null = null;

  @ViewChild('positionTypeInput')
  positionTypeInput!: ElementRef<HTMLInputElement>;

  readonly STORAGE_KEY = 'totalMargin';

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    const savedTotalMargin = localStorage.getItem(this.STORAGE_KEY);

    this.form = this.fb.group({
      totalMargin: [savedTotalMargin ? +savedTotalMargin : null],
      lossPercentViaMargin: [2, [Validators.required, Validators.min(0.01)]],
      leverage: [44, [Validators.required, Validators.min(1)]],
      expectedRR: [2, [Validators.required, Validators.min(0.1)]],
      realLossPercent: [0, [Validators.required, Validators.min(0.01)]],
      maxLoss: [
        {
          value: 100,
          // disabled: true
        },
      ],
      entryPrice: [],
      positionType: ['long'], // 🆕 default is long
    });

    this.expectedRR = <FormControl>this.form.get('expectedRR');

    this.form
      .get('totalMargin')!
      .valueChanges.subscribe(() => this.updateMaxLoss());
    this.form
      .get('lossPercentViaMargin')!
      .valueChanges.subscribe(() => this.updateMaxLoss());

    this.form.valueChanges.subscribe((values) => {
      if (values.totalMargin !== null && !isNaN(values.totalMargin)) {
        localStorage.setItem(this.STORAGE_KEY, values.totalMargin.toString());
      }
      this.calculate();
    });

    this.updateMaxLoss();
    this.calculate();
  }

  ngAfterViewInit() {
    // Delay to ensure the DOM is fully rendered
    setTimeout(() => {
      this.positionTypeInput.nativeElement.focus();
    });
  }

  calculate() {
    if (this.form.invalid) {
      return;
    }

    const { leverage, realLossPercent, entryPrice, expectedRR, positionType } =
      this.form.getRawValue();
    const maxLoss = this.form.get('maxLoss')!.value;
    const lossRatio = realLossPercent / 100;

    this.margin = maxLoss / lossRatio;
    this.realMargin = this.margin / leverage;

    if (entryPrice) {
      const lossAmount = entryPrice * lossRatio;
      const isLong = positionType === 'long';

      // 🔵 Current SL/TP
      this.SL = isLong ? entryPrice - lossAmount : entryPrice + lossAmount;
      this.TP = isLong
        ? entryPrice + expectedRR * lossAmount
        : entryPrice - expectedRR * lossAmount;

      // 🔴 SL 1R
      const onePercentMove = entryPrice * 0.01; // 1% of entry price
      this.SL1R = isLong
        ? entryPrice - onePercentMove
        : entryPrice + onePercentMove;
    } else {
      this.SL = this.TP = this.SL1R = null;
    }
  }

  updateMaxLoss() {
    const total = this.form.get('totalMargin')!.value;
    const percent = this.form.get('lossPercentViaMargin')!.value;

    if (!isNaN(total) && !isNaN(percent)) {
      const loss = total * (percent / 100);
      this.form.get('maxLoss')!.setValue(loss, { emitEvent: false });
    }
  }
}
