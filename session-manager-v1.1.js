#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeSessionManager = void 0;
const os_1 = require("os");
const path_1 = require("path");
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const commander_1 = require("commander");
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
class ClaudeSessionManager {
    constructor(sessionId) {
        this.lines = [];
        this.originalContent = "";
        this.sessionId = sessionId;
        const cwdProject = process.cwd().replace(/\//g, '-');
        this.sessionFile = (0, path_1.join)((0, os_1.homedir)(), ".claude", "projects", cwdProject, `${sessionId}.jsonl`);
        this.backupDir = (0, path_1.join)((0, os_1.homedir)(), ".claude", "projects", cwdProject, "session-manager-backups");
    }
    async initialize() {
        if (!await fs_extra_1.default.pathExists(this.sessionFile)) {
            throw new Error(`Session file not found: ${this.sessionFile}`);
        }
        await fs_extra_1.default.ensureDir(this.backupDir);
        // Load session
        this.originalContent = await fs_extra_1.default.readFile(this.sessionFile, "utf8");
        const rawLines = this.originalContent.split(/\r?\n/);
        // Parse lines - simple and robust
        this.lines = rawLines.map((line, index) => {
            const sessionLine = {
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
                }
                else if (typeof parsed.message?.content === 'string') {
                    content = parsed.message.content;
                }
                else if (Array.isArray(parsed.message?.content)) {
                    // Handle content arrays (tool use, etc)
                    content = parsed.message.content
                        .filter((item) => item.type === 'text' && item.text)
                        .map((item) => item.text)
                        .join('\n') || '[Complex content]';
                }
                else if (parsed.message?.content) {
                    content = JSON.stringify(parsed.message.content);
                }
                sessionLine.type = msgType;
                sessionLine.content = content;
                sessionLine.isMessage = ['user', 'assistant', 'message', 'system'].includes(msgType);
            }
            catch {
                // Non-JSON line - keep as is
            }
            return sessionLine;
        });
    }
    async interactiveMenu() {
        let running = true;
        while (running) {
            console.clear();
            this.displayHeader();
            const { action } = await inquirer_1.default.prompt([
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
    displayHeader() {
        const stats = this.getStats();
        console.log(chalk_1.default.bold.cyan('═══════════════════════════════════════════════════════'));
        console.log(chalk_1.default.bold.white(`Session: ${chalk_1.default.yellow(this.sessionId)}`));
        console.log(chalk_1.default.white(`Total Lines: ${stats.total} | Messages: ${stats.messages} | Selected: ${stats.selected}`));
        console.log(chalk_1.default.bold.cyan('═══════════════════════════════════════════════════════'));
        console.log();
    }
    getStats() {
        const stats = {
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
    async viewMessages() {
        const messages = this.lines.filter(l => l.isMessage);
        if (messages.length === 0) {
            console.log(chalk_1.default.red('\nNo messages found in this session.'));
            await this.pause();
            return;
        }
        // Simple table display
        const table = new cli_table3_1.default({
            head: ['ID', 'Type', 'Selected', 'Preview'],
            colWidths: [6, 12, 10, 60],
            wordWrap: true
        });
        messages.forEach(line => {
            const preview = this.truncate(line.content || '[No content]', 57);
            table.push([
                line.index.toString(),
                this.colorType(line.type || 'unknown'),
                line.selected ? chalk_1.default.green('✓') : chalk_1.default.red('✗'),
                preview
            ]);
        });
        console.log(table.toString());
        console.log(chalk_1.default.gray(`\nShowing ${messages.length} messages`));
        await this.pause();
    }
    async selectMessages() {
        const { mode } = await inquirer_1.default.prompt([
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
                console.log(chalk_1.default.green('All lines selected'));
                await this.pause();
                break;
            case 'none':
                this.lines.forEach(l => l.selected = false);
                console.log(chalk_1.default.red('All lines deselected'));
                await this.pause();
                break;
            case 'type':
                await this.selectByType();
                break;
        }
    }
    async selectIndividual() {
        const messages = this.lines.filter(l => l.isMessage);
        const choices = messages.map(line => ({
            name: `[${line.index}] ${line.type}: ${this.truncate(line.content || '', 60)}`,
            value: line.index,
            checked: line.selected
        }));
        const { selected } = await inquirer_1.default.prompt([
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
    async selectByType() {
        const types = Object.keys(this.getStats().byType);
        const { msgType, action } = await inquirer_1.default.prompt([
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
        console.log(chalk_1.default[shouldSelect ? 'green' : 'red'](`${action}ed ${count} ${msgType} messages`));
        await this.pause();
    }
    async saveChanges() {
        const selectedLines = this.lines.filter(l => l.selected);
        console.log(chalk_1.default.yellow(`\nPreparing to save ${selectedLines.length} lines...`));
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Save ${selectedLines.length} selected lines (removing ${this.lines.length - selectedLines.length} lines)?`,
                default: false
            }
        ]);
        if (!confirm) {
            console.log(chalk_1.default.yellow('Save cancelled'));
            await this.pause();
            return;
        }
        const spinner = (0, ora_1.default)('Saving changes...').start();
        try {
            // Create backup
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const backupFile = (0, path_1.join)(this.backupDir, `${this.sessionId}.${timestamp}.jsonl`);
            await fs_extra_1.default.writeFile(backupFile, this.originalContent);
            // Write selected lines
            const output = selectedLines.map(l => l.line).join('\n');
            await fs_extra_1.default.writeFile(this.sessionFile, output);
            spinner.succeed('Changes saved successfully!');
            console.log(chalk_1.default.gray(`Backup created: ${backupFile}`));
            // Update original content
            this.originalContent = output;
        }
        catch (error) {
            spinner.fail('Failed to save changes');
            console.error(chalk_1.default.red(error));
        }
        await this.pause();
    }
    async restoreBackup() {
        const backups = await fs_extra_1.default.readdir(this.backupDir);
        const sessionBackups = backups
            .filter(f => f.startsWith(`${this.sessionId}.`))
            .sort()
            .reverse();
        if (sessionBackups.length === 0) {
            console.log(chalk_1.default.yellow('No backups found'));
            await this.pause();
            return;
        }
        const { backup } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'backup',
                message: 'Select backup to restore:',
                choices: sessionBackups.slice(0, 10)
            }
        ]);
        const spinner = (0, ora_1.default)('Restoring backup...').start();
        try {
            const backupPath = (0, path_1.join)(this.backupDir, backup);
            const content = await fs_extra_1.default.readFile(backupPath, 'utf8');
            await fs_extra_1.default.writeFile(this.sessionFile, content);
            spinner.succeed('Backup restored!');
            console.log(chalk_1.default.yellow('Reinitializing session...'));
            await this.initialize();
        }
        catch (error) {
            spinner.fail('Restore failed');
            console.error(chalk_1.default.red(error));
        }
        await this.pause();
    }
    async showStatistics() {
        const stats = this.getStats();
        const table = new cli_table3_1.default();
        table.push(['Total Lines', stats.total], ['Messages', stats.messages], ['Selected', stats.selected], ['', ''], ['Message Types', '']);
        Object.entries(stats.byType).forEach(([type, count]) => {
            table.push([`  ${type}`, count]);
        });
        console.log(table.toString());
        await this.pause();
    }
    async runDiagnostics() {
        console.log(chalk_1.default.bold.cyan('\n=== Session Diagnostics ===\n'));
        let jsonLines = 0;
        let nonJsonLines = 0;
        let emptyLines = 0;
        this.lines.forEach(line => {
            if (!line.line || line.line.trim() === '') {
                emptyLines++;
            }
            else {
                try {
                    JSON.parse(line.line);
                    jsonLines++;
                }
                catch {
                    nonJsonLines++;
                }
            }
        });
        console.log(chalk_1.default.bold('File Statistics:'));
        console.log(`  Total lines: ${this.lines.length}`);
        console.log(`  JSON lines: ${chalk_1.default.green(jsonLines)}`);
        console.log(`  Non-JSON lines: ${chalk_1.default.yellow(nonJsonLines)}`);
        console.log(`  Empty lines: ${chalk_1.default.gray(emptyLines)}`);
        console.log(chalk_1.default.bold('\nMessage Types:'));
        Object.entries(this.getStats().byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        await this.pause();
    }
    truncate(str, maxLength) {
        if (!str)
            return '[No content]';
        const clean = str.replace(/\n/g, ' ').trim();
        return clean.length > maxLength
            ? clean.substring(0, maxLength - 3) + '...'
            : clean;
    }
    colorType(type) {
        const colors = {
            user: chalk_1.default.green,
            assistant: chalk_1.default.blue,
            message: chalk_1.default.blue,
            system: chalk_1.default.yellow
        };
        const color = colors[type] || chalk_1.default.gray;
        return color(type);
    }
    async pause() {
        await inquirer_1.default.prompt([{
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }]);
    }
}
exports.ClaudeSessionManager = ClaudeSessionManager;
// CLI
const program = new commander_1.Command()
    .name('claude-session-manager')
    .description('Manage Claude session context by selecting/deselecting messages')
    .version('1.1.0')
    .argument('<sessionId>', 'Session ID to manage')
    .action(async (sessionId) => {
    try {
        const manager = new ClaudeSessionManager(sessionId);
        const spinner = (0, ora_1.default)('Loading session...').start();
        await manager.initialize();
        spinner.succeed('Session loaded');
        await manager.interactiveMenu();
        console.log(chalk_1.default.bold.green('\n✨ Session management complete!'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error: ${error}`));
        process.exit(1);
    }
});
program.parse();
