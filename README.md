# Claude Session Manager v1.1

**Manage Claude Code session context by selecting/deselecting messages**

A clean, focused tool for managing Claude conversation context windows through selective message management.

## Features

✅ **View Messages** - See your conversation with content previews  
✅ **Select/Deselect** - Choose which messages to keep or remove  
✅ **Save Changes** - Write selected messages back to session file  
✅ **Backup/Restore** - Automatic backups before any changes  
✅ **Statistics** - Overview of session message counts  
✅ **Diagnostics** - Debug session file structure  

## Installation

### Option 1: Direct Use
```bash
node session-manager-v1.1.js <session-id>
```

### Option 2: Install Dependencies
```bash
npm install
npm start <session-id>
```

### Option 3: Global Install
```bash
npm install -g .
claude-session-manager <session-id>
```

## Usage

```bash
# Run with your Claude session ID
node session-manager-v1.1.js 824a59e5-88bb-42b0-93b9-d30ca3c9b797
```

### Interactive Menu

1. **📋 View Messages** - Browse your conversation
2. **✂️ Select/Deselect Messages** - Choose what to keep
   - Toggle individual messages
   - Select/deselect all
   - Select by message type
3. **💾 Save Changes** - Apply your selections
4. **🔄 Restore Backup** - Undo changes
5. **📊 Statistics** - View session stats
6. **🔍 Diagnostics** - Debug file structure

## How It Works

1. Loads your Claude session `.jsonl` file
2. Parses all message types (user, assistant, system)
3. Lets you select which messages to keep
4. Creates backup before saving changes
5. Writes only selected messages back to file

## Session File Location

The tool looks for session files in:
```
~/.claude/projects/<project-name>/<session-id>.jsonl
```

Backups are stored in:
```
~/.claude/projects/<project-name>/session-manager-backups/
```

## Why This Tool?

- **Context Window Management** - Keep conversations within token limits
- **Privacy Control** - Remove sensitive exchanges
- **Focus Enhancement** - Remove noise, keep important parts
- **Debugging Sessions** - Remove failed attempts, keep solutions

## Safe Usage

- ✅ **Always creates backups** before making changes
- ✅ **Restore functionality** to undo changes
- ✅ **Confirmation prompts** before saving
- ✅ **Non-destructive** by default (everything selected)

## Files

- `session-manager-v1.1.ts` - TypeScript source code
- `session-manager-v1.1.js` - Compiled JavaScript (ready to run)
- `package.json` - Dependencies and scripts
- `README.md` - This file
- `SESSION-MANAGER-V1.1-PLAN.md` - Development plan
- `SESSION-MANAGER-IMPROVEMENTS.md` - Improvement history

## Development

This is v1.1 - a clean, focused implementation that:
- Removes complex features that had issues
- Focuses on core select/save functionality
- Provides robust JSON parsing for all Claude formats
- Ensures string safety throughout

Built as a collaboration between human insight and Claude implementation.

---

**⚠️ Use responsibly** - This tool modifies your Claude session files. Always check backups are created before making changes. 