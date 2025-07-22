import { DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ReportCommandService } from './services/report-command.service';

export interface ICommand {
  time: string;
  positionType: 'long' | 'short';
  status: 'opening' | 'loss' | 'win';
  netProfit: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgClass, NgFor, DecimalPipe],
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
  expectedRRControl: FormControl | null = null;

  @ViewChild('positionTypeInput')
  positionTypeInput!: ElementRef<HTMLInputElement>;

  private readonly STORAGE_KEY = 'AUTO-CAL-FUTURE-TOTAL_MARGIN';

  confirmState:
    | 'opening'
    | 'confirmed'
    | 'visible-open'
    | 'visible-win'
    | 'visible-loss'
    | 'invisible' = 'invisible';

  reports: string[] = [];

  hasReportKey: boolean = !!localStorage.getItem('AUTO-CAL-FUTURE-REPORT_KEY');

  constructor(
    private fb: FormBuilder,
    private reportCommandService: ReportCommandService
  ) {}

  ngOnInit() {
    const savedTotalMargin = localStorage.getItem(this.STORAGE_KEY);

    this.form = this.fb.group({
      totalMargin: [savedTotalMargin ? +savedTotalMargin : null],
      lossPercentViaMargin: [1, [Validators.required, Validators.min(0.01)]],
      leverage: [44, [Validators.required, Validators.min(1)]],
      expectedRR: [2, [Validators.required, Validators.min(0.1)]],
      realLossPercent: [0, [Validators.required, Validators.min(0.01)]],
      maxLoss: [
        {
          value: 1,
          // disabled: true
        },
      ],
      entryPrice: [],
      positionType: ['long'], // 🆕 default is long
      netProfit: [0],
    });

    const commandLatest = this.reportCommandService.getCommandLatest();
    if (commandLatest && commandLatest.status === 'opening') {
      this.form.patchValue(commandLatest);
    }
    this.reports = this.reportCommandService.syncReports();
    console.log(this.reports);

    this.expectedRRControl = <FormControl>this.form.get('expectedRR');

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

  confirmAction() {
    const { netProfit, totalMargin } = this.form.getRawValue();
    const command = {
      ...this.form.getRawValue(),
      time: '',
      // positionType,
      status: '',
      // netProfit,
      // gross: 0,
      // winRate: 0,
      // margin: this.margin,
      // realMargin: this.realMargin,
      // SL: this.SL,
      // TP: this.TP,
      // SL1R: this.SL1R,
      // expectedRR: this.expectedRR.value,
    };
    if (
      ['visible-open', 'visible-win', 'visible-loss'].includes(
        this.confirmState
      )
    ) {
      const state = this.confirmState.split('-')[1];
      if (state === 'open') {
        command.status = 'opening';
        command.time = new Date().toISOString();
        this.confirmState = 'opening';
        this.reportCommandService.saveCommand(command);
      }
      if (netProfit === 0) return;
      if (state === 'win') {
        this.saveCommand({ ...command, status: 'win' }, totalMargin);
      } else {
        this.saveCommand(
          { ...command, status: 'loss', netProfit: -netProfit },
          totalMargin
        );
      }
    }
  }

  private saveCommand(command: ICommand, totalMargin: number) {
    const { status } = command;
    command.status = status;
    this.confirmState = 'invisible';
    this.reportCommandService.saveCommand(command);
    this.reports = this.reportCommandService.syncReports();
    this.resetForm(totalMargin + command.netProfit);
  }

  private resetForm(totalMargin: number) {
    localStorage.setItem(this.STORAGE_KEY, totalMargin.toString());
    const formValues = {
      totalMargin,
      lossPercentViaMargin: 1,
      leverage: 44,
      expectedRR: 2,
      realLossPercent: 0,
      maxLoss: 1,
      entryPrice: null,
      positionType: 'long',
      netProfit: 0,
    };
    this.form.patchValue(formValues);
    this.confirmState = 'invisible';
  }
}
