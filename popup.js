/**
 * Popup script for the Hidden Prompt Injection Detector extension.
 * Handles communication with content script and displays findings.
 */

document.addEventListener('DOMContentLoaded', () => {
  loadFindings();
  
  // Add event listener for rescan button
  document.getElementById('rescan-btn').addEventListener('click', () => {
    rescanPage();
  });
});

/**
 * Loads findings from the content script of the active tab.
 */
function loadFindings() {
  const statusEl = document.getElementById('status');
  const containerEl = document.getElementById('findings-container');
  
  statusEl.textContent = 'Scanning...';
  containerEl.innerHTML = '';
  
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      statusEl.textContent = 'Error: No active tab found.';
      return;
    }
    
    const activeTab = tabs[0];
    
    // Check if we can access this tab (chrome:// pages are restricted)
    if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
      statusEl.textContent = 'Cannot scan Chrome internal pages.';
      return;
    }
    
    // Send message to content script to get findings
    chrome.tabs.sendMessage(
      activeTab.id,
      { type: 'GET_FINDINGS' },
      (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Error: Unable to scan this page. Try refreshing the page.';
          console.error(chrome.runtime.lastError);
          return;
        }
        
        if (response && response.findings) {
          displayFindings(response.findings);
        } else {
          statusEl.textContent = 'Error: No response from page.';
        }
      }
    );
  });
}

/**
 * Rescans the current page for hidden prompt injections.
 */
function rescanPage() {
  const statusEl = document.getElementById('status');
  const containerEl = document.getElementById('findings-container');
  
  statusEl.textContent = 'Re-scanning...';
  containerEl.innerHTML = '';
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      statusEl.textContent = 'Error: No active tab found.';
      return;
    }
    
    const activeTab = tabs[0];
    
    chrome.tabs.sendMessage(
      activeTab.id,
      { type: 'RESCAN' },
      (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Error: Unable to rescan. Try refreshing the page.';
          console.error(chrome.runtime.lastError);
          return;
        }
        
        if (response && response.findings) {
          displayFindings(response.findings);
        } else {
          statusEl.textContent = 'Error: No response from page.';
        }
      }
    );
  });
}

/**
 * Displays the findings in the popup UI.
 * 
 * @param {Array} findings - Array of finding objects
 */
function displayFindings(findings) {
  const statusEl = document.getElementById('status');
  const containerEl = document.getElementById('findings-container');
  
  containerEl.innerHTML = '';
  
  if (!findings || findings.length === 0) {
    statusEl.textContent = '✅ No suspicious hidden instructions detected on this page.';
    statusEl.className = 'status success';
    return;
  }
  
  statusEl.textContent = `⚠️ Found ${findings.length} suspicious hidden ${findings.length === 1 ? 'item' : 'items'}:`;
  statusEl.className = 'status warning';
  
  findings.forEach((finding) => {
    const card = createFindingCard(finding);
    containerEl.appendChild(card);
  });
}

/**
 * Creates a card element for a single finding.
 * 
 * @param {Object} finding - The finding object
 * @returns {HTMLElement} The card element
 */
function createFindingCard(finding) {
  const card = document.createElement('div');
  card.className = 'finding-card';
  
  // Text snippet (truncated to 200 characters)
  const textEl = document.createElement('div');
  textEl.className = 'finding-text';
  const truncatedText = finding.text.length > 200 
    ? finding.text.substring(0, 200) + '...' 
    : finding.text;
  textEl.textContent = truncatedText;
  
  // Reasons
  const reasonsEl = document.createElement('div');
  reasonsEl.className = 'finding-reasons';
  const reasonsText = finding.reason.map(r => formatReason(r)).join(', ');
  reasonsEl.innerHTML = `<strong>Why suspicious:</strong> ${reasonsText}`;
  
  // Highlight button
  const buttonEl = document.createElement('button');
  buttonEl.className = 'btn-highlight';
  buttonEl.textContent = '🎯 Highlight on Page';
  buttonEl.addEventListener('click', () => {
    highlightFinding(finding.id);
  });
  
  card.appendChild(textEl);
  card.appendChild(reasonsEl);
  card.appendChild(buttonEl);
  
  return card;
}

/**
 * Formats a reason string to be more human-readable.
 * 
 * @param {string} reason - The reason string
 * @returns {string} Formatted reason
 */
function formatReason(reason) {
  const formatMap = {
    'display_none': 'Display: none',
    'visibility_hidden': 'Visibility: hidden',
    'opacity_near_zero': 'Opacity near 0',
    'tiny_font_size': 'Tiny font size',
    'zero_dimensions': 'Zero dimensions',
    'positioned_offscreen': 'Positioned off-screen',
    'hidden_color_match': 'Text color matches background',
    'contains_suspicious_instructions': 'Contains suspicious instructions',
    'html_comment': 'Hidden in HTML comment',
  };
  
  // Handle attribute reasons
  if (reason.startsWith('hidden_in_attribute_')) {
    const attrName = reason.replace('hidden_in_attribute_', '');
    return `Hidden in ${attrName} attribute`;
  }
  
  return formatMap[reason] || reason;
}

/**
 * Sends a message to the content script to highlight a finding.
 * 
 * @param {number} findingId - The ID of the finding to highlight
 */
function highlightFinding(findingId) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    
    const activeTab = tabs[0];
    
    chrome.tabs.sendMessage(
      activeTab.id,
      { type: 'HIGHLIGHT_FINDING', id: findingId },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error highlighting:', chrome.runtime.lastError);
        }
      }
    );
  });
}
