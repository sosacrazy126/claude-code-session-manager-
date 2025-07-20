# Session Manager v1.1 - Refactoring Plan

## Current State (Prototype Success)
- ✅ Core select/deselect functionality works
- ✅ Can view messages with content
- ✅ Backup/restore provides safety
- ✅ Good UI/UX foundation
- ❌ Prune/compress have issues (will remove)

## v1.1 Goals
1. **Simplify** - Remove broken features
2. **Stabilize** - Fix remaining string handling issues  
3. **Focus** - Context window management via selection
4. **Foundation** - Clean codebase for future features

## Core Features to Keep
1. **View Messages** - See what's in your session
2. **Select/Deselect** - Choose what to keep
   - Individual toggle
   - Select all/none
   - Select by type
3. **Save Changes** - Write selected messages back
4. **Backup/Restore** - Safety first
5. **Statistics** - Session overview
6. **Diagnostics** - Debug tool

## Features to Remove
- ❌ Prune by count (index issues)
- ❌ Smart compression (complex, buggy)
- ❌ Search (string handling issues)
- ❌ Importance scoring (not essential)

## Technical Improvements
1. **Robust JSON handling** - Support all Claude formats
2. **String safety** - Ensure all content is stringified
3. **Simplify types** - Remove complex Message interfaces
4. **Better error handling** - Graceful failures

## File Structure (Proposed)
```
src/
  session-manager-v1.1.ts   # Clean rewrite
  types.ts                  # Simple, clear types
  utils.ts                  # String helpers, JSON parsing
dist/
  session-manager.js        # Compiled output
```

## Implementation Steps
1. **Strip down** current session-manager.ts
2. **Keep only** working features
3. **Fix** string handling throughout
4. **Test** with real sessions
5. **Document** usage clearly

## Success Criteria
- Can load any Claude session
- Can toggle message selection
- Can save selection back to file
- No crashes on any operation
- Clean, maintainable code

## Future Features (v1.2+)
- Smart filtering rules
- Batch operations
- Session merging
- Export formats
- Context size calculator 