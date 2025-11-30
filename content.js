// Global storage for findings
window.__hiddenPromptFindings = [];

let findingIdCounter = 0;

/**
 * Checks if an element is hidden or has very low visibility.
 * This includes checking CSS properties like display, visibility, opacity,
 * font-size, positioning, and color matching with background.
 * 
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} True if the element is effectively hidden
 */
function isHiddenOrLowVisibility(element) {
  if (!element) return false;

  // Check computed styles
  const styles = window.getComputedStyle(element);
  
  // Check display: none
  if (styles.display === 'none') return true;
  
  // Check visibility: hidden
  if (styles.visibility === 'hidden') return true;
  
  // Check opacity (very low or 0)
  const opacity = parseFloat(styles.opacity);
  if (opacity < 0.05) return true;
  
  // Check font-size (0 or very tiny)
  const fontSize = parseFloat(styles.fontSize);
  if (fontSize < 5) return true;
  
  // Check if element has no dimensions
  if (element.offsetWidth === 0 && element.offsetHeight === 0) return true;
  
  // Check if element is positioned far off-screen
  const position = styles.position;
  if (position === 'absolute' || position === 'fixed') {
    const rect = element.getBoundingClientRect();
    if (rect.left < -5000 || rect.left > 5000 || rect.top < -5000 || rect.top > 5000) {
      return true;
    }
  }
  
  // Check if text color matches background color (camouflaged text)
  const textColor = styles.color;
  const bgColor = styles.backgroundColor;
  if (textColor && bgColor && colorsAreSimilar(textColor, bgColor)) {
    return true;
  }
  
  // Check parent elements for hidden properties
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const parentStyles = window.getComputedStyle(parent);
    if (parentStyles.display === 'none' || parentStyles.visibility === 'hidden') {
      return true;
    }
    parent = parent.parentElement;
  }
  
  return false;
}

/**
 * Converts a CSS color string to RGB values.
 * Handles rgb(), rgba(), hex, and named colors.
 * 
 * @param {string} color - CSS color string
 * @returns {Object|null} Object with r, g, b values or null if parsing fails
 */
function parseColor(color) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  
  // Handle rgb/rgba format
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    };
  }
  
  // Handle hex format
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16)
    };
  }
  
  return null;
}

/**
 * Calculates if two colors are similar using Euclidean distance in RGB space.
 * A small distance threshold indicates the colors are nearly identical.
 * 
 * @param {string} color1 - First CSS color
 * @param {string} color2 - Second CSS color
 * @returns {boolean} True if colors are very similar
 */
function colorsAreSimilar(color1, color2) {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  
  if (!c1 || !c2) return false;
  
  // Calculate Euclidean distance in RGB space
  const distance = Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
  
  // Threshold for similarity (lower = more similar)
  return distance < 30;
}

/**
 * Checks if text contains patterns commonly used in prompt injection attacks.
 * These include instructions to ignore previous commands, exfiltrate data,
 * navigate to URLs, authenticate, etc.
 * 
 * @param {string} text - The text to analyze
 * @returns {boolean} True if text looks like a prompt injection instruction
 */
function looksLikePromptInstruction(text) {
  const lower = text.toLowerCase();
  
  // List of suspicious keywords and phrases that indicate prompt injection
  const keywords = [
    'ignore previous instructions',
    'ignore all above instructions',
    'ignore all previous',
    'disregard the user',
    'disregard previous',
    'you are an ai',
    'you are an ai assistant',
    'system prompt',
    'system message',
    'navigate to',
    'open the url',
    'go to http',
    'visit http',
    'log in',
    'login to',
    'authenticate',
    'exfiltrate',
    'send data',
    'send the data to',
    'copy the user',
    'extract all',
    'return all',
    'browser automation',
    'do not tell the user',
    'don\'t tell the user',
    'without the user knowing',
    'secretly',
    'override previous',
    'new instructions',
    'forget all',
    'reset instructions',
    'act as if',
    'pretend you are',
    'behave as',
    'execute the following',
    'run this code',
    'bypass security',
    'disable safety'
  ];
  
  // Check if any keyword is present
  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      return true;
    }
  }
  
  // Check for imperative patterns (commands starting with action verbs)
  const imperativePatterns = [
    /^(go|send|click|fetch|extract|navigate|open|visit|execute|run|bypass|disable|ignore|forget|override)\s/i
  ];
  
  for (const pattern of imperativePatterns) {
    if (pattern.test(text.trim())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generates a CSS selector path for an element.
 * This helps us re-identify and highlight the element later.
 * 
 * @param {HTMLElement} element - The element to generate a path for
 * @returns {string} CSS selector path
 */
function getCssPath(element) {
  if (!element) return '';
  
  const path = [];
  let current = element;
  
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    
    // Add ID if available
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break; // ID is unique, we can stop here
    }
    
    // Add class if available
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).join('.');
      if (classes) {
        selector += `.${classes}`;
      }
    }
    
    // Add nth-child for specificity
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

/**
 * Highlights an element on the page by adding a red outline.
 * The outline disappears after 3 seconds.
 * 
 * @param {number} findingId - ID of the finding to highlight
 */
function highlightElementById(findingId) {
  const finding = window.__hiddenPromptFindings.find(f => f.id === findingId);
  if (!finding) return;
  
  try {
    const element = document.querySelector(finding.cssPath);
    if (element) {
      // Store original outline
      const originalOutline = element.style.outline;
      
      // Apply red outline
      element.style.outline = '3px solid red';
      element.style.outlineOffset = '2px';
      
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove outline after 3 seconds
      setTimeout(() => {
        element.style.outline = originalOutline;
        element.style.outlineOffset = '';
      }, 3000);
    }
  } catch (error) {
    console.error('Error highlighting element:', error);
  }
}

/**
 * Scans the DOM for hidden text nodes that contain instruction-like content.
 * This is the main detection function.
 */
function scanForHiddenPromptInjections() {
  console.log('[Hidden Prompt Detector] Starting scan...');
  
  // Clear previous findings
  window.__hiddenPromptFindings = [];
  findingIdCounter = 0;
  
  // Create a TreeWalker to traverse all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    
    // Skip very short text or whitespace
    if (text.length < 10) continue;
    
    const parentElement = node.parentElement;
    if (!parentElement) continue;
    
    // Check if element is hidden
    const isHidden = isHiddenOrLowVisibility(parentElement);
    
    // Check if text looks like an instruction
    const isInstruction = looksLikePromptInstruction(text);
    
    // If both conditions are met, add to findings
    if (isHidden && isInstruction) {
      const reasons = [];
      
      const styles = window.getComputedStyle(parentElement);
      
      if (styles.display === 'none') reasons.push('display_none');
      if (styles.visibility === 'hidden') reasons.push('visibility_hidden');
      if (parseFloat(styles.opacity) < 0.05) reasons.push('opacity_near_zero');
      if (parseFloat(styles.fontSize) < 5) reasons.push('tiny_font_size');
      if (parentElement.offsetWidth === 0 && parentElement.offsetHeight === 0) {
        reasons.push('zero_dimensions');
      }
      
      const position = styles.position;
      if (position === 'absolute' || position === 'fixed') {
        const rect = parentElement.getBoundingClientRect();
        if (rect.left < -5000 || rect.left > 5000 || rect.top < -5000 || rect.top > 5000) {
          reasons.push('positioned_offscreen');
        }
      }
      
      const textColor = styles.color;
      const bgColor = styles.backgroundColor;
      if (textColor && bgColor && colorsAreSimilar(textColor, bgColor)) {
        reasons.push('hidden_color_match');
      }
      
      if (isInstruction) reasons.push('contains_suspicious_instructions');
      
      const rect = parentElement.getBoundingClientRect();
      
      window.__hiddenPromptFindings.push({
        id: findingIdCounter++,
        text: text,
        reason: reasons,
        cssPath: getCssPath(parentElement),
        boundingRect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      });
    }
  }
  
  // Scan HTML comments
  const comments = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_COMMENT,
    null,
    false
  );
  
  let comment;
  while (comment = comments.nextNode()) {
    const text = comment.textContent.trim();
    if (text.length < 10) continue;
    
    if (looksLikePromptInstruction(text)) {
      const parentElement = comment.parentElement;
      if (parentElement) {
        window.__hiddenPromptFindings.push({
          id: findingIdCounter++,
          text: text,
          reason: ['html_comment', 'contains_suspicious_instructions'],
          cssPath: getCssPath(parentElement),
          boundingRect: { top: 0, left: 0, width: 0, height: 0 }
        });
      }
    }
  }
  
  // Scan data-* attributes and other attributes
const allElements = document.querySelectorAll('*');
  allElements.forEach(element => {
    // Check all attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name === 'title' || attr.name === 'alt') {
        const text = attr.value.trim();
        if (text.length >= 10 && looksLikePromptInstruction(text)) {
          window.__hiddenPromptFindings.push({
            id: findingIdCounter++,
            text: text,
            reason: [`hidden_in_attribute_${attr.name}`, 'contains_suspicious_instructions'],
            cssPath: getCssPath(element),
            boundingRect: element.getBoundingClientRect()
          });
        }
      }
    });
  });
  
  console.log(`[Hidden Prompt Detector] Scan complete. Found ${window.__hiddenPromptFindings.length} suspicious items.`);
}

// Run scan when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanForHiddenPromptInjections);
} else {
  scanForHiddenPromptInjections();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_FINDINGS') {
    sendResponse({ findings: window.__hiddenPromptFindings });
    return true;
  }
  
  if (message.type === 'HIGHLIGHT_FINDING') {
    highlightElementById(message.id);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'RESCAN') {
    scanForHiddenPromptInjections();
    sendResponse({ findings: window.__hiddenPromptFindings });
    return true;
  }
});
