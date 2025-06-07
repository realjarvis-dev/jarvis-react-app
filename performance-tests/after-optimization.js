// Performance measurement script for after optimization
(function() {
  // Create global variables to store timing information
  window.privyInitStart = null;
  window.privyInitEnd = null;
  window.walletInitStart = null;
  window.walletInitEnd = null;
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

  // Create global functions to mark start and end of wallet initialization
  window.markWalletInitStart = function() {
    window.walletInitStart = performance.now();
    console.log('Wallet initialization started at:', window.walletInitStart);
    
    // Update the display
    updatePerformanceDisplay();
  };

  window.measureWalletInitTime = function() {
    window.walletInitEnd = performance.now();
    const duration = window.walletInitEnd - window.walletInitStart;
    console.log('Wallet initialization ended at:', window.walletInitEnd);
    console.log('Wallet initialization took:', duration, 'ms');
    
    // Update the display
    updatePerformanceDisplay();
  };

  // Function to mark when chat panel is mounted
  window.markChatPanelMounted = function() {
    window.chatPanelMountTime = performance.now();
    console.log('Chat panel mounted at:', window.chatPanelMountTime);
    
    // Update the display with chat panel mount time
    updatePerformanceDisplay();
  };

  // Function to mark when welcome message is rendered
  window.markWelcomeMessageRendered = function() {
    window.welcomeMessageRenderTime = performance.now();
    console.log('Welcome message rendered at:', window.welcomeMessageRenderTime);
    
    // Update the display
    updatePerformanceDisplay();
  };

  // Function to check if welcome message is rendered
  function checkWelcomeMessageRendered() {
    const welcomeMessage = document.querySelector('p[class*="text-center text-base"]');
    if (welcomeMessage) {
      window.markWelcomeMessageRendered();
    } else {
      setTimeout(checkWelcomeMessageRendered, 50);
    }
  }

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
  
  // Start checking if welcome message is rendered
  setTimeout(checkWelcomeMessageRendered, 1000);

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
    let content = '<strong>AFTER OPTIMIZATION</strong><br>';
    
    if (window.privyInitStart && window.privyInitEnd) {
      const privyDuration = window.privyInitEnd - window.privyInitStart;
      content += `Privy Auth: ${privyDuration.toFixed(2)} ms<br>`;
    } else {
      content += 'Privy Auth: Measuring...<br>';
    }
    
    if (window.walletInitStart && window.walletInitEnd) {
      const walletDuration = window.walletInitEnd - window.walletInitStart;
      content += `Wallet Init: ${walletDuration.toFixed(2)} ms<br>`;
    } else if (window.walletInitStart) {
      content += 'Wallet Init: Loading...<br>';
    }
    
    if (window.chatPanelMountTime && window.privyInitStart) {
      const totalTime = window.chatPanelMountTime - window.privyInitStart;
      content += `Initial Load: ${totalTime.toFixed(2)} ms<br>`;
    }
    
    if (window.welcomeMessageRenderTime && window.privyInitStart) {
      const welcomeTime = window.welcomeMessageRenderTime - window.privyInitStart;
      content += `Welcome Msg: ${welcomeTime.toFixed(2)} ms<br>`;
    }
    
    performanceDisplay.innerHTML = content;
  }

  // Mark the start of Privy initialization
  window.markPrivyInitStart();
})();
