(function() {
  console.log("PLAYER STARTED");

  // DOM Elements
  var imageEl = document.getElementById('signage-image');
  var videoEl = document.getElementById('signage-video');
  var overlayEl = document.getElementById('play-overlay');
  var debugBoxEl = document.getElementById('debug-box');
  var sleepPreventerEl = document.getElementById('sleep-preventer');
  
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
  var previousMediaType = null;
  var debugMode = false;
  var hasUserInteracted = false;

  // Base64 1-second blank loop video (exemption source to prevent iOS device sleeping)
  var sleepLockVideoBase64 = "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAzFtb292AAAAbG12aGQAAAAA3ndM1d53TNUAAV+QAAH0gAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACdXRyYWsAAABcdGtoZAAAAAPed0zV3ndM1QAAAAEAAAAAAAH0gAAAAAAAAAAAAAAAAAEAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAABtZGlhAAAAWG1kaGQAAAAA3ndM1d53TNUAAV+QAAH0gEF1eGgAAAAAc21oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAANGF1dGgAAAAAAAAACnVybCAAAAABAAABbW1pbmYAAABYdm1oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAANGF1dGgAAAAAAAAACnVybCAAAAABAAABXc3RibAAAAGRzdHNkAAAAAAAAAAEAAABUYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAQABgASAAAAEgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjC//8AAAA2YXZjQ0BlQED/2QAWY0BAcED54AAsCIAAADhAAAUdggCEhISAgP/gAAAAGWhlbHAAAAAAAGd1dGgAAAAAZWxmYQAAAAAAdHN0dHMAAAAAAAAAAQAAAAEAAAH0AAAAFHN0c3MAAAAAAAAAAQAAAAEAAAAUc3RzeQAAAAAAAAABAAAAAQAAADRzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAcc3RzeiAAAAAAAAAAAAAAAQAAAfQAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGV1ZHRhAAAAXW1ldGEAAAAAAAAAIWhkcm4AAAAAAAAAAElkM3Jhd3BkYXRhAAAAADU5aWRjMwAAAABhbHRyAAAAAGJwaWN0AAAAAGJ0eXBlAAAAAGNuYW1lAAAAAGNkYXRhAAAAAA==";

  // Initialize
  function init() {
    // Add default CSS transition class to active elements
    imageEl.className = 'fade-element';
    videoEl.className = 'fade-element';

    // Check if ?debug=1 is in URL
    var params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      debugMode = true;
      debugBoxEl.style.display = 'block';
    }

    // Set up user interaction listener
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
          
          previousMediaType = currentMediaType;
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

  // Perform smooth crossfade transitions between slides
  function transitionMedia(updateFn) {
    var activeEl = null;
    if (previousMediaType === 'image') activeEl = imageEl;
    else if (previousMediaType === 'video') activeEl = videoEl;

    // If there is an active element already showing, fade it out first
    if (activeEl && activeEl.style.display !== 'none') {
      activeEl.classList.add('fade-out');
      
      setTimeout(function() {
        // Swap sources & displays
        updateFn();
        
        // Prepare new element as transparent first, then fade it in
        var newEl = currentMediaType === 'image' ? imageEl : videoEl;
        newEl.classList.add('fade-out');
        newEl.offsetHeight; // trigger reflow
        newEl.classList.remove('fade-out');
      }, 500); // match transition duration in CSS
    } else {
      // Direct load if no previous active media
      updateFn();
      var newEl = currentMediaType === 'image' ? imageEl : videoEl;
      newEl.classList.remove('fade-out');
    }
  }

  // Update display based on current media state
  function updateDisplay() {
    transitionMedia(function() {
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

        // Hide autoplay overlay if it was showing
        overlayEl.style.display = 'none';

      } else if (currentMediaType === 'video') {
        // Hide image
        imageEl.style.display = 'none';
        imageEl.src = '';

        // Show video
        videoEl.style.display = 'block';
        
        // Enforce properties to bypass iOS Safari autoplay guidelines on source changes
        videoEl.muted = true;
        videoEl.defaultMuted = true;
        videoEl.playsInline = true;
        
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
          console.log("Autoplay check skipped (No promise returned)");
        }
      }
    });
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
    previousMediaType = null;
  }

  // Handle overlay click to bypass autoplay restrictions & wake lock iPad screen
  function handleOverlayClick() {
    hasUserInteracted = true;
    overlayEl.style.display = 'none';

    // Start background sleep preventer video
    sleepPreventerEl.src = sleepLockVideoBase64;
    var sleepPromise = sleepPreventerEl.play();
    if (sleepPromise !== undefined) {
      sleepPromise.then(function() {
        console.log("WAKE LOCK ACTIVATED: sleep prevention loop started");
      }).catch(function(e) {
        console.warn("WAKE LOCK ERROR: sleep prevention loop blocked", e);
      });
    }
    
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
