import { Injectable } from '@angular/core';
import { ICommand } from '../app.component';

@Injectable({
  providedIn: 'root',
})
export class ReportCommandService {
  getCommandLatest(): ICommand | null {
    return this.getAllCommands().slice(-1)[0];
  }

  // 1. Save each command to localStorage
  saveCommand(command: ICommand) {
    const commandLatest = this.getCommandLatest();
    const data = this.getAllCommands();
    if (commandLatest && commandLatest.status === 'opening') {
      data[data.length - 1] = { ...command, time: commandLatest.time };
    } else {
      data.push(command);
    }
    localStorage.setItem(
      'AUTO-CAL-FUTURE-FUTURE_COMMANDS',
      JSON.stringify(data)
    );
  }

  // 2. Read all commands
  private getAllCommands(): ICommand[] {
    return JSON.parse(
      localStorage.getItem('AUTO-CAL-FUTURE-FUTURE_COMMANDS') || '[]'
    );
  }

  // 3. Filter by date range
  private filterByRange(range: 'today' | 'week' | 'month'): any[] {
    const now = new Date();
    const all = this.getAllCommands();
    return all.filter((c) => {
      const d = new Date(c.time);
      if (range === 'today') return d.toDateString() === now.toDateString();
      if (range === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        return d >= startOfWeek;
      }
      if (range === 'month')
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return false;
    });
  }

  // 4. Build summary message
  private buildSummary(range: 'today' | 'week' | 'month'): string {
    const commands = this.filterByRange(range).filter(
      (c) => c.status !== 'opening'
    );
    const wins = commands.filter((c) => c.status === 'win');
    const losses = commands.filter((c) => c.status === 'loss');
    // grossWin base on netProfit
    const grossWin = wins.reduce((sum, c) => sum + c.netProfit, 0);
    const grossLoss = losses.reduce((sum, c) => sum + Math.abs(c.netProfit), 0);
    // const avgWin = wins.length ? grossWin / wins.length : 0;
    // const avgLoss = losses.length ? grossLoss / losses.length : 0;
    const winRate = commands.length
      ? ((wins.length / commands.length) * 100).toFixed(0)
      : '0';
    const title =
      range === 'today'
        ? 'Hôm nay ' + new Date().getDate()
        : range === 'week'
        ? 'Tuần này'
        : 'Tháng này';

    return `
      📈 *${title}*
      Số lệnh: ${commands.length} (Win: ${wins.length} | Loss: ${losses.length})
      Win rate: ${winRate}%
      Gross: ${this.formatCurrency(grossWin)} | ${this.formatCurrency(
      grossLoss === 0 ? 0 : grossLoss,
      { hasMinus: true }
    )}
      Net: ${this.formatCurrency(grossWin - grossLoss)}
      `.trim();
    // Avg Win: ${this.formatCurrency(
    //   grossWin / wins.length
    // )} | Avg Loss: ${this.formatCurrency(grossLoss / losses.length)}
  }

  // 5. Format currency
  private formatCurrency(
    n: number,
    { hasMinus: hasPrefix }: { hasMinus: boolean } = { hasMinus: false }
  ): string {
    if (n === 0 || isNaN(n)) return '0';
    return (
      (hasPrefix ? '-' : n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2) + '$'
    );
  }

  // 6. Final: Submit all to Telegram
  syncReports() {
    const summary = [
      this.buildSummary('today'),
      this.buildSummary('week'),
      this.buildSummary('month'),
    ];

    /* const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.telegramChatId,
        text: summary,
        parse_mode: 'Markdown',
      }),
    }); */

    // console.log(summary);
    return summary;
  }
}
