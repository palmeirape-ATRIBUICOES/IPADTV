(function() {
  console.log("PLAYER STARTED");

  // DOM Elements
  var imageEl = document.getElementById('signage-image');
  var videoEl = document.getElementById('signage-video');
  var overlayEl = document.getElementById('play-overlay');
  var debugBoxEl = document.getElementById('debug-box');
  
  // Debug fields
  var debugSyncEl = document.getElementById('debug-sync');
  var debugTypeEl = document.getElementById('debug-type');
  var debugIdEl = document.getElementById('debug-id');
  var debugVersionEl = document.getElementById('debug-version');

  // Player State
  var currentMediaId = null;
  var currentMediaVersion = null;
  var currentMediaUrl = null;
  var currentMediaType = null;
  var debugMode = false;
  var hasUserInteracted = false;

  // Initialize
  function init() {
    // Check if ?debug=1 is in URL
    var params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      debugMode = true;
      debugBoxEl.style.display = 'block';
    }

    // Set up user interaction listener on overlay click
    overlayEl.addEventListener('click', handleOverlayClick);

    // Initial heartbeat and media check
    sendHeartbeat();
    checkMedia();

    // Start polling timers
    setInterval(checkMedia, 5000);      // Poll for media changes every 5s
    setInterval(sendHeartbeat, 10000);  // Send heartbeat every 10s
  }

  // Poll server for current media
  function checkMedia() {
    console.log("CHECKING MEDIA");
    
    fetch('/api/current-media')
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(function(media) {
        if (!media) {
          console.log("No media configured on server.");
          clearDisplay();
          return;
        }

        // Check if media ID or version has changed to avoid reloading same content
        if (media.id !== currentMediaId || media.version !== currentMediaVersion) {
          console.log("NEW MEDIA DETECTED", media);
          
          currentMediaId = media.id;
          currentMediaVersion = media.version;
          currentMediaUrl = media.url;
          currentMediaType = media.type;
          
          updateDisplay();
        }

        if (debugMode) {
          updateDebugPanel(media);
        }
      })
      .catch(function(error) {
        console.error("SERVER ERROR", error);
      });
  }

  // Update display based on current media state
  function updateDisplay() {
    if (currentMediaType === 'image') {
      // Hide video
      videoEl.style.display = 'none';
      videoEl.pause();
      videoEl.src = '';

      // Show image
      imageEl.style.display = 'block';
      imageEl.src = currentMediaUrl;
      
      imageEl.onload = function() {
        console.log("IMAGE LOADED");
      };
      imageEl.onerror = function() {
        console.error("IMAGE PLAY ERROR / LOAD FAILED");
      };

      // Hide autoplay overlay if we were showing it
      overlayEl.style.display = 'none';

    } else if (currentMediaType === 'video') {
      // Hide image
      imageEl.style.display = 'none';
      imageEl.src = '';

      // Show video
      videoEl.style.display = 'block';
      videoEl.src = currentMediaUrl;
      videoEl.load();

      // Trigger play
      var playPromise = videoEl.play();

      if (playPromise !== undefined) {
        playPromise.then(function() {
          console.log("VIDEO LOADED");
          overlayEl.style.display = 'none';
        }).catch(function(error) {
          console.warn("VIDEO PLAY ERROR (Autoplay blocked)", error);
          // Show overlay to get user interaction
          if (!hasUserInteracted) {
            overlayEl.style.display = 'flex';
          }
        });
      } else {
        // Fallback for older browsers that don't return promise on play()
        console.log("Autoplay check skipped (No promise returned)");
      }
    }
  }

  // Clear canvas
  function clearDisplay() {
    imageEl.style.display = 'none';
    imageEl.src = '';
    videoEl.style.display = 'none';
    videoEl.pause();
    videoEl.src = '';
    
    currentMediaId = null;
    currentMediaVersion = null;
    currentMediaUrl = null;
    currentMediaType = null;
  }

  // Handle overlay click to bypass autoplay restriction
  function handleOverlayClick() {
    hasUserInteracted = true;
    overlayEl.style.display = 'none';
    
    if (currentMediaType === 'video') {
      console.log("Resuming playback after user touch event");
      videoEl.play()
        .then(function() {
          console.log("VIDEO LOADED (Interactive)");
        })
        .catch(function(err) {
          console.error("VIDEO PLAY ERROR ON INTERACTION", err);
        });
    }
  }

  // Send Heartbeat to server
  function sendHeartbeat() {
    fetch('/api/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(function(res) {
        if (res.ok) {
          console.log("HEARTBEAT SENT");
        } else {
          console.warn("Heartbeat returned status " + res.status);
        }
      })
      .catch(function(err) {
        console.error("SERVER ERROR (Heartbeat failed)", err);
      });
  }

  // Update diagnostic box fields
  function updateDebugPanel(media) {
    var now = new Date();
    var timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    
    debugSyncEl.textContent = timeStr;
    debugTypeEl.textContent = media.type.toUpperCase();
    debugIdEl.textContent = media.id;
    debugVersionEl.textContent = media.version;
  }

  // Start
  init();
})();
