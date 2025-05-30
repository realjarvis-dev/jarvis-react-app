// Performance measurement script for before optimization
(function() {
  // Create global variables to store timing information
  window.privyInitStart = null;
  window.privyInitEnd = null;
  window.chatPanelMountTime = null;

  // Create global functions to mark start and end of Privy initialization
  window.markPrivyInitStart = function() {
    window.privyInitStart = performance.now();
    console.log('Privy initialization started at:', window.privyInitStart);
  };

  window.markPrivyInitEnd = function() {
    window.privyInitEnd = performance.now();
    const duration = window.privyInitEnd - window.privyInitStart;
    console.log('Privy initialization ended at:', window.privyInitEnd);
    console.log('Privy initialization took:', duration, 'ms');
    
    // Create or update the performance display
    updatePerformanceDisplay();
  };

  // Function to mark when chat panel is mounted
  window.markChatPanelMounted = function() {
    window.chatPanelMountTime = performance.now();
    console.log('Chat panel mounted at:', window.chatPanelMountTime);
    
    // Update the display with chat panel mount time
    updatePerformanceDisplay();
  };

  // Function to check if Privy is ready
  function checkPrivyReady() {
    const isReady = document.querySelector('[data-privy-ready="true"]');
    if (isReady) {
      window.markPrivyInitEnd();
    } else {
      setTimeout(checkPrivyReady, 100);
    }
  }

  // Start checking if Privy is ready
  setTimeout(checkPrivyReady, 500);

  // Function to update the performance display
  function updatePerformanceDisplay() {
    // Create or get the performance display element
    let performanceDisplay = document.getElementById('performance-display');
    if (!performanceDisplay) {
      performanceDisplay = document.createElement('div');
      performanceDisplay.id = 'performance-display';
      performanceDisplay.style.position = 'fixed';
      performanceDisplay.style.top = '10px';
      performanceDisplay.style.right = '10px';
      performanceDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      performanceDisplay.style.color = 'white';
      performanceDisplay.style.padding = '10px';
      performanceDisplay.style.borderRadius = '5px';
      performanceDisplay.style.zIndex = '9999';
      performanceDisplay.style.fontSize = '12px';
      performanceDisplay.style.fontFamily = 'monospace';
      document.body.appendChild(performanceDisplay);
    }

    // Update the content
    let content = '<strong>BEFORE OPTIMIZATION</strong><br>';
    
    if (window.privyInitStart && window.privyInitEnd) {
      const privyDuration = window.privyInitEnd - window.privyInitStart;
      content += `Privy Init: ${privyDuration.toFixed(2)} ms<br>`;
    } else {
      content += 'Privy Init: Measuring...<br>';
    }
    
    if (window.chatPanelMountTime && window.privyInitStart) {
      const totalTime = window.chatPanelMountTime - window.privyInitStart;
      content += `Total Load: ${totalTime.toFixed(2)} ms<br>`;
    }
    
    performanceDisplay.innerHTML = content;
  }

  // Mark the start of Privy initialization
  window.markPrivyInitStart();
})();
