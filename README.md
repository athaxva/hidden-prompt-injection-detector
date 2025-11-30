# Hidden Prompt Injection Detector

A research prototype Chrome extension that detects hidden or invisible text on webpages that may contain malicious prompt-injection instructions intended to target AI-powered browsers.

### Features
- Scans DOM for hidden text (display:none, zero font-size, offscreen, opacity, etc.)
- Analyzes text for instruction-like language (ignore previous instructions, send data, etc.)
- Displays suspicious items in popup window
- Highlight elements visually in the page
- Local-only processing, no data sent externally

### Installation (Manual)
1. Download this repository as ZIP
2. Go to chrome://extensions
3. Enable Developer Mode
4. Click "Load unpacked" and select the `extension` folder
5. Open test.html and try scanning

### Research Purpose
This prototype demonstrates potential attack vectors for indirect prompt injection in agentic AI browsers.

