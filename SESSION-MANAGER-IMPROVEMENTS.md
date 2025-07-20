# Session Manager Improvements

## Overview
The session manager has been enhanced to better handle various JSON formats and provide improved user feedback when dealing with session files.

## Key Improvements

### 1. Enhanced JSON Parsing
- **Multiple Format Support**: Now handles different JSON structures:
  - Standard format: `{ type: 'user', content: '...' }`
  - Nested format: `{ message: { type: 'user', content: '...' } }`
  - Role-based format: `{ role: 'user', content: '...' }`
  - Mixed content fields: Supports both `content` and `text` fields

### 2. Better Error Handling
- **Graceful Degradation**: When messages can't be found, provides helpful feedback
- **Debug Mode**: Set `DEBUG=1` environment variable for detailed parsing information
- **Empty Content Handling**: Displays `[No content]` instead of crashing

### 3. New Diagnostics Feature
- **Menu Option**: Added "🔍 Diagnostics" to the main menu
- **Comprehensive Analysis**: 
  - Counts JSON vs non-JSON lines
  - Identifies different JSON structures in use
  - Shows sample messages from each structure type
  - Provides recommendations for fixing issues

### 4. Improved User Experience
- **Better Feedback**: All operations now show results and wait for user confirmation
- **Search Improvements**: 
  - Validates search input
  - Shows match count
  - Handles empty results gracefully
- **Statistics Display**: Shows message counts by type and importance level

### 5. Robustness Improvements
- **Null Safety**: All string operations handle null/undefined values
- **Multiple Content Fields**: Checks both `content` and `text` fields
- **Empty Session Handling**: Provides helpful messages when no messages are found

## Usage

### Running with Debug Mode
```bash
DEBUG=1 npx session-manager <session-id>
```

### Using Diagnostics
1. Run the session manager
2. Select "🔍 Diagnostics" from the menu
3. Review the analysis to understand your session file structure

## Testing
A test script was created to verify the improvements work with various JSON formats. The session manager now successfully handles:
- Standard Claude session formats
- Nested message structures
- Role-based formats
- Mixed formats in the same file
- Non-JSON diagnostic lines
- Empty lines
- Missing or null content

## Troubleshooting

If messages aren't displaying:
1. Run diagnostics to check the JSON structure
2. Enable debug mode to see parsing details
3. Check if messages use a different field name for content
4. Verify the session file isn't corrupted

The improvements ensure the session manager is more resilient and provides better feedback when encountering different session file formats.