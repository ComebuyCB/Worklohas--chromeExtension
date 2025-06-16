# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension that provides automatic attendance punching functionality for the NUEIP cloud attendance system. The extension consists of reminder notifications and automatic punch-in/out features.

## Architecture

### Extension Components

- **manifest.json**: Chrome extension manifest (v3) targeting `https://cloud.nueip.com/attendance_record*`
- **background.js**: Service worker handling alarms, notifications, and communication between components
- **content.js**: Content script that injects functionality into NUEIP pages and handles message passing
- **popup.html/popup.js**: Extension popup UI for configuring reminder settings
- **inject/testExtension-inject.js**: Injected script that adds UI controls and performs automatic punching

### Data Flow

1. User configures reminder settings in popup → stored in chrome.storage.local
2. Background script creates chrome.alarms based on settings
3. Content script injects UI and functionality into NUEIP attendance page
4. Injected script communicates with content script via window.postMessage
5. Settings persist across sessions using chrome.storage.local

### Key Features

- **Reminder System**: Time-based notifications using chrome.alarms API
- **Auto Punch**: Automatically fills missing attendance records with randomized times
- **UI Injection**: Adds floating control panel to NUEIP attendance page
- **Settings Persistence**: Saves user preferences for punch times and reminder settings

## File Structure

- `static/`: Contains third-party libraries (jQuery, Bootstrap, Vue.js) and assets
- `inject/`: Scripts injected directly into target website pages
- Main extension files are in root directory

## Development Notes

- Extension uses jQuery 3.5.1 for DOM manipulation
- Bootstrap 5.3.2 for UI styling
- No build process - pure vanilla JS with library dependencies
- Extensive console logging with prefixes (BG_, POP_, CB_) for debugging
- Randomization logic prevents detection by adding variance to punch times