#!/usr/bin/env node
import { homedir } from "os";
import { join } from "path";
import fs from "fs-extra";
import chalk from "chalk";
import inquirer from "inquirer";
import { Command } from "commander";
import ora from "ora";
import Table from "cli-table3";

// Simple types - no complex interfaces
interface SessionLine {
  index: number;
  line: string;
  type?: string;
  content?: string;
  selected: boolean;
  isMessage: boolean;
}

interface SessionStats {
  total: number;
  messages: number;
  selected: number;
  byType: Record<string, number>;
}

export class ClaudeSessionManager {
  private sessionId: string;
  private sessionFile: string;
  private backupDir: string;
  private lines: SessionLine[] = [];
  private originalContent: string = "";

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const cwdProject = process.cwd().replace(/\//g, '-');
    this.sessionFile = join(homedir(), ".claude", "projects", cwdProject, `${sessionId}.jsonl`);
    this.backupDir = join(homedir(), ".claude", "projects", cwdProject, "session-manager-backups");
  }

  async initialize(): Promise<void> {
    if (!await fs.pathExists(this.sessionFile)) {
      throw new Error(`Session file not found: ${this.sessionFile}`);
    }

    await fs.ensureDir(this.backupDir);
    
    // Load session
    this.originalContent = await fs.readFile(this.sessionFile, "utf8");
    const rawLines = this.originalContent.split(/\r?\n/);
    
    // Parse lines - simple and robust
    this.lines = rawLines.map((line, index) => {
      const sessionLine: SessionLine = {
        index,
        line,
        selected: true, // All selected by default
        isMessage: false
      };

      if (!line || line.trim() === '') {
        return sessionLine; // Empty line
      }

      try {
        const parsed = JSON.parse(line);
        
        // Extract type and content - handle various formats
        let msgType = parsed.type || parsed.message?.type || parsed.message?.role || 'unknown';
        let content = '';

        // Extract content - safely handle all formats
        if (typeof parsed.content === 'string') {
          content = parsed.content;
        } else if (typeof parsed.message?.content === 'string') {
          content = parsed.message.content;
        } else if (Array.isArray(parsed.message?.content)) {
          // Handle content arrays (tool use, etc)
          content = parsed.message.content
            .filter((item: any) => item.type === 'text' && item.text)
            .map((item: any) => item.text)
            .join('\n') || '[Complex content]';
        } else if (parsed.message?.content) {
          content = JSON.stringify(parsed.message.content);
        }

        sessionLine.type = msgType;
        sessionLine.content = content;
        sessionLine.isMessage = ['user', 'assistant', 'message', 'system'].includes(msgType);
        
      } catch {
        // Non-JSON line - keep as is
      }

      return sessionLine;
    });
  }

  async interactiveMenu(): Promise<void> {
    let running = true;

    while (running) {
      console.clear();
      this.displayHeader();

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📋 View Messages', value: 'view' },
            { name: '✂️  Select/Deselect Messages', value: 'select' },
            { name: '💾 Save Changes', value: 'save' },
            { name: '🔄 Restore Backup', value: 'restore' },
            { name: '📊 Statistics', value: 'stats' },
            { name: '🔍 Diagnostics', value: 'diagnostics' },
            { name: '❌ Exit', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'view':
          await this.viewMessages();
          break;
        case 'select':
          await this.selectMessages();
          break;
        case 'save':
          await this.saveChanges();
          break;
        case 'restore':
          await this.restoreBackup();
          break;
        case 'stats':
          await this.showStatistics();
          break;
        case 'diagnostics':
          await this.runDiagnostics();
          break;
        case 'exit':
          running = false;
          break;
      }
    }
  }

  private displayHeader(): void {
    const stats = this.getStats();
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log(chalk.bold.white(`Session: ${chalk.yellow(this.sessionId)}`));
    console.log(chalk.white(`Total Lines: ${stats.total} | Messages: ${stats.messages} | Selected: ${stats.selected}`));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log();
  }

  private getStats(): SessionStats {
    const stats: SessionStats = {
      total: this.lines.length,
      messages: this.lines.filter(l => l.isMessage).length,
      selected: this.lines.filter(l => l.selected).length,
      byType: {}
    };

    this.lines.forEach(line => {
      if (line.type) {
        stats.byType[line.type] = (stats.byType[line.type] || 0) + 1;
      }
    });

    return stats;
  }

  private async viewMessages(): Promise<void> {
    const messages = this.lines.filter(l => l.isMessage);
    
    if (messages.length === 0) {
      console.log(chalk.red('\nNo messages found in this session.'));
      await this.pause();
      return;
    }

    // Simple table display
    const table = new Table({
      head: ['ID', 'Type', 'Selected', 'Preview'],
      colWidths: [6, 12, 10, 60],
      wordWrap: true
    });

    messages.forEach(line => {
      const preview = this.truncate(line.content || '[No content]', 57);
      table.push([
        line.index.toString(),
        this.colorType(line.type || 'unknown'),
        line.selected ? chalk.green('✓') : chalk.red('✗'),
        preview
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray(`\nShowing ${messages.length} messages`));
    await this.pause();
  }

  private async selectMessages(): Promise<void> {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Selection mode:',
        choices: [
          { name: 'Toggle Individual Messages', value: 'individual' },
          { name: 'Select All', value: 'all' },
          { name: 'Deselect All', value: 'none' },
          { name: 'Select by Type', value: 'type' }
        ]
      }
    ]);

    switch (mode) {
      case 'individual':
        await this.selectIndividual();
        break;
      case 'all':
        this.lines.forEach(l => l.selected = true);
        console.log(chalk.green('All lines selected'));
        await this.pause();
        break;
      case 'none':
        this.lines.forEach(l => l.selected = false);
        console.log(chalk.red('All lines deselected'));
        await this.pause();
        break;
      case 'type':
        await this.selectByType();
        break;
    }
  }

  private async selectIndividual(): Promise<void> {
    const messages = this.lines.filter(l => l.isMessage);
    
    const choices = messages.map(line => ({
      name: `[${line.index}] ${line.type}: ${this.truncate(line.content || '', 60)}`,
      value: line.index,
      checked: line.selected
    }));

    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Toggle messages (space to select/deselect):',
        choices,
        pageSize: 15
      }
    ]);

    // Update selection
    this.lines.forEach(line => {
      if (line.isMessage) {
        line.selected = selected.includes(line.index);
      }
    });
  }

  private async selectByType(): Promise<void> {
    const types = Object.keys(this.getStats().byType);
    
    const { msgType, action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'msgType',
        message: 'Select message type:',
        choices: types
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: ['Select', 'Deselect']
      }
    ]);

    const shouldSelect = action === 'Select';
    let count = 0;

    this.lines.forEach(line => {
      if (line.type === msgType) {
        line.selected = shouldSelect;
        count++;
      }
    });

    console.log(chalk[shouldSelect ? 'green' : 'red'](
      `${action}ed ${count} ${msgType} messages`
    ));
    await this.pause();
  }

  private async saveChanges(): Promise<void> {
    const selectedLines = this.lines.filter(l => l.selected);
    
    console.log(chalk.yellow(`\nPreparing to save ${selectedLines.length} lines...`));
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Save ${selectedLines.length} selected lines (removing ${this.lines.length - selectedLines.length} lines)?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Save cancelled'));
      await this.pause();
      return;
    }

    const spinner = ora('Saving changes...').start();

    try {
      // Create backup
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFile = join(this.backupDir, `${this.sessionId}.${timestamp}.jsonl`);
      await fs.writeFile(backupFile, this.originalContent);
      
      // Write selected lines
      const output = selectedLines.map(l => l.line).join('\n');
      await fs.writeFile(this.sessionFile, output);
      
      spinner.succeed('Changes saved successfully!');
      console.log(chalk.gray(`Backup created: ${backupFile}`));
      
      // Update original content
      this.originalContent = output;
      
    } catch (error) {
      spinner.fail('Failed to save changes');
      console.error(chalk.red(error));
    }
    
    await this.pause();
  }

  private async restoreBackup(): Promise<void> {
    const backups = await fs.readdir(this.backupDir);
    const sessionBackups = backups
      .filter(f => f.startsWith(`${this.sessionId}.`))
      .sort()
      .reverse();

    if (sessionBackups.length === 0) {
      console.log(chalk.yellow('No backups found'));
      await this.pause();
      return;
    }

    const { backup } = await inquirer.prompt([
      {
        type: 'list',
        name: 'backup',
        message: 'Select backup to restore:',
        choices: sessionBackups.slice(0, 10)
      }
    ]);

    const spinner = ora('Restoring backup...').start();

    try {
      const backupPath = join(this.backupDir, backup);
      const content = await fs.readFile(backupPath, 'utf8');
      await fs.writeFile(this.sessionFile, content);
      
      spinner.succeed('Backup restored!');
      console.log(chalk.yellow('Reinitializing session...'));
      
      await this.initialize();
      
    } catch (error) {
      spinner.fail('Restore failed');
      console.error(chalk.red(error));
    }
    
    await this.pause();
  }

  private async showStatistics(): Promise<void> {
    const stats = this.getStats();
    
    const table = new Table();
    table.push(
      ['Total Lines', stats.total],
      ['Messages', stats.messages],
      ['Selected', stats.selected],
      ['', ''],
      ['Message Types', '']
    );
    
    Object.entries(stats.byType).forEach(([type, count]) => {
      table.push([`  ${type}`, count]);
    });

    console.log(table.toString());
    await this.pause();
  }

  private async runDiagnostics(): Promise<void> {
    console.log(chalk.bold.cyan('\n=== Session Diagnostics ===\n'));
    
    let jsonLines = 0;
    let nonJsonLines = 0;
    let emptyLines = 0;
    
    this.lines.forEach(line => {
      if (!line.line || line.line.trim() === '') {
        emptyLines++;
      } else {
        try {
          JSON.parse(line.line);
          jsonLines++;
        } catch {
          nonJsonLines++;
        }
      }
    });
    
    console.log(chalk.bold('File Statistics:'));
    console.log(`  Total lines: ${this.lines.length}`);
    console.log(`  JSON lines: ${chalk.green(jsonLines)}`);
    console.log(`  Non-JSON lines: ${chalk.yellow(nonJsonLines)}`);
    console.log(`  Empty lines: ${chalk.gray(emptyLines)}`);
    
    console.log(chalk.bold('\nMessage Types:'));
    Object.entries(this.getStats().byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    await this.pause();
  }

  private truncate(str: string, maxLength: number): string {
    if (!str) return '[No content]';
    const clean = str.replace(/\n/g, ' ').trim();
    return clean.length > maxLength 
      ? clean.substring(0, maxLength - 3) + '...'
      : clean;
  }

  private colorType(type: string): string {
    const colors: Record<string, any> = {
      user: chalk.green,
      assistant: chalk.blue,
      message: chalk.blue,
      system: chalk.yellow
    };
    const color = colors[type] || chalk.gray;
    return color(type);
  }

  private async pause(): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }
}

// CLI
const program = new Command()
  .name('claude-session-manager')
  .description('Manage Claude session context by selecting/deselecting messages')
  .version('1.1.0')
  .argument('<sessionId>', 'Session ID to manage')
  .action(async (sessionId) => {
    try {
      const manager = new ClaudeSessionManager(sessionId);
      const spinner = ora('Loading session...').start();
      
      await manager.initialize();
      spinner.succeed('Session loaded');
      
      await manager.interactiveMenu();
      
      console.log(chalk.bold.green('\n✨ Session management complete!'));
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program.parse(); 