(function() {
  console.log("PLAYER STARTED");

  // DOM Elements
  var imageEl = document.getElementById('signage-image');
  var videoEl = document.getElementById('signage-video');
  var overlayEl = document.getElementById('play-overlay');
  var debugBoxEl = document.getElementById('debug-box');
  var sleepPreventerEl = document.getElementById('sleep-preventer');
  
  // Widget DOM Elements
  var weatherWidgetEl = document.getElementById('weather-widget');
  var weatherCityEl = document.getElementById('weather-city');
  var weatherIconEl = document.getElementById('weather-icon');
  var weatherTempEl = document.getElementById('weather-temp');
  var weatherDescEl = document.getElementById('weather-desc');
  var weatherForecastEl = document.getElementById('weather-forecast');

  var newsWidgetEl = document.getElementById('news-widget');
  var newsBgEl = document.getElementById('news-bg');
  var newsTitleEl = document.getElementById('news-title');
  var newsDescEl = document.getElementById('news-desc');

  var instagramWidgetEl = document.getElementById('instagram-widget');
  var instagramIframeEl = document.getElementById('instagram-iframe');

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

  // News slideshow variables
  var newsIntervalId = null;
  var newsData = [];
  var newsCurrentIndex = 0;

  // Base64 1-second blank loop video (exemption source to prevent iOS device sleeping)
  var sleepLockVideoBase64 = "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAzFtb292AAAAbG12aGQAAAAA3ndM1d53TNUAAV+QAAH0gAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACdXRyYWsAAABcdGtoZAAAAAPed0zV3ndM1QAAAAEAAAAAAAH0gAAAAAAAAAAAAAAAAAEAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAABtZGlhAAAAWG1kaGQAAAAA3ndM1d53TNUAAV+QAAH0gEF1eGgAAAAAc21oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAANGF1dGgAAAAAAAAACnVybCAAAAABAAABbW1pbmYAAABYdm1oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAANGF1dGgAAAAAAAAACnVybCAAAAABAAABXc3RibAAAAGRzdHNkAAAAAAAAAAEAAABUYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAQABgASAAAAEgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjC//8AAAA2YXZjQ0BlQED/2QAWY0BAcED54AAsCIAAADhAAAUdggCEhISAgP/gAAAAGWhlbHAAAAAAAGd1dGgAAAAAZWxmYQAAAAAAdHN0dHMAAAAAAAAAAQAAAAEAAAH0AAAAFHN0c3MAAAAAAAAAAQAAAAEAAAAUc3RzeQAAAAAAAAABAAAAAQAAADRzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAcc3RzeiAAAAAAAAAAAAAAAQAAAfQAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGV1ZHRhAAAAXW1ldGEAAAAAAAAAIWhkcm4AAAAAAAAAAElkM3Jhd3BkYXRhAAAAADU5aWRjMwAAAABhbHRyAAAAAGJwaWN0AAAAAGJ0eXBlAAAAAGNuYW1lAAAAAGNkYXRhAAAAAA==";

  // Initialize
  function init() {
    // Add default CSS transition class to active elements
    imageEl.className = 'fade-element';
    videoEl.className = 'fade-element';
    weatherWidgetEl.className = 'widget-container fade-element';
    newsWidgetEl.className = 'widget-container fade-element';
    instagramWidgetEl.className = 'widget-container fade-element';

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
    else if (previousMediaType === 'weather') activeEl = weatherWidgetEl;
    else if (previousMediaType === 'news') activeEl = newsWidgetEl;
    else if (previousMediaType === 'instagram') activeEl = instagramWidgetEl;

    // If there is an active element already showing, fade it out first
    if (activeEl && activeEl.style.display !== 'none') {
      activeEl.classList.add('fade-out');
      
      setTimeout(function() {
        // Swap sources & displays
        updateFn();
        
        // Prepare new element as transparent first, then fade it in
        var newEl = null;
        if (currentMediaType === 'image') newEl = imageEl;
        else if (currentMediaType === 'video') newEl = videoEl;
        else if (currentMediaType === 'weather') newEl = weatherWidgetEl;
        else if (currentMediaType === 'news') newEl = newsWidgetEl;
        else if (currentMediaType === 'instagram') newEl = instagramWidgetEl;
        
        if (newEl) {
          newEl.classList.add('fade-out');
          newEl.offsetHeight; // trigger reflow
          newEl.classList.remove('fade-out');
        }
      }, 500); // match transition duration in CSS
    } else {
      // Direct load if no previous active media
      updateFn();
      var newEl = null;
      if (currentMediaType === 'image') newEl = imageEl;
      else if (currentMediaType === 'video') newEl = videoEl;
      else if (currentMediaType === 'weather') newEl = weatherWidgetEl;
      else if (currentMediaType === 'news') newEl = newsWidgetEl;
      else if (currentMediaType === 'instagram') newEl = instagramWidgetEl;
      
      if (newEl) newEl.classList.remove('fade-out');
    }
  }

  // Hide all media elements and cancel dynamic widget timers
  function hideAllMediaElements() {
    imageEl.style.display = 'none';
    imageEl.src = '';
    
    videoEl.style.display = 'none';
    videoEl.pause();
    videoEl.src = '';
    
    weatherWidgetEl.style.display = 'none';
    newsWidgetEl.style.display = 'none';
    
    instagramWidgetEl.style.display = 'none';
    instagramIframeEl.src = '';

    if (newsIntervalId) {
      clearInterval(newsIntervalId);
      newsIntervalId = null;
    }
  }

  // Update display based on current media state
  function updateDisplay() {
    transitionMedia(function() {
      // Clear previous displays and intervals
      hideAllMediaElements();

      if (currentMediaType === 'image') {
        // Show image
        imageEl.style.display = 'block';
        imageEl.src = currentMediaUrl;
        
        imageEl.onload = function() {
          console.log("IMAGE LOADED");
        };
        imageEl.onerror = function() {
          console.error("IMAGE PLAY ERROR / LOAD FAILED");
        };
        overlayEl.style.display = 'none';

      } else if (currentMediaType === 'video') {
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
        }
      } else if (currentMediaType === 'weather') {
        // Show weather widget
        weatherWidgetEl.style.display = 'flex';
        renderWeatherWidget(currentMediaUrl);
        overlayEl.style.display = 'none';
        
      } else if (currentMediaType === 'news') {
        // Show news widget
        newsWidgetEl.style.display = 'flex';
        renderNewsWidget(currentMediaUrl);
        overlayEl.style.display = 'none';
        
      } else if (currentMediaType === 'instagram') {
        // Show instagram embed widget
        instagramWidgetEl.style.display = 'flex';
        instagramIframeEl.src = currentMediaUrl;
        overlayEl.style.display = 'none';
      }
    });
  }

  // Renders the weather forecast dashboard
  function renderWeatherWidget(url) {
    var coords = url ? url.split(',') : ['-8.5307', '-36.4357'];
    var lat = coords[0] || '-8.5307';
    var lon = coords[1] || '-36.4357';
    
    fetch('/api/widgets/weather?lat=' + lat + '&lon=' + lon)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.current_weather) return;
        
        var cw = data.current_weather;
        var info = getWeatherInfo(cw.weathercode);
        
        weatherCityEl.textContent = "Palmeira, PE";
        weatherIconEl.textContent = info.icon;
        weatherTempEl.textContent = Math.round(cw.temperature) + '°C';
        weatherDescEl.textContent = info.desc;
        
        // Forecast rendering
        weatherForecastEl.innerHTML = '';
        if (data.daily && data.daily.time) {
          var days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
          // Render next 4 forecast days
          for (var i = 1; i <= 4; i++) {
            var date = new Date(data.daily.time[i] + 'T00:00:00');
            var dayName = days[date.getDay()];
            var code = data.daily.weathercode[i];
            var dayInfo = getWeatherInfo(code);
            var maxT = Math.round(data.daily.temperature_2m_max[i]);
            var minT = Math.round(data.daily.temperature_2m_min[i]);
            
            var forecastDay = document.createElement('div');
            forecastDay.className = 'forecast-day';
            forecastDay.innerHTML = '\
              <span class="day-name">' + dayName + '</span>\
              <span class="day-icon">' + dayInfo.icon + '</span>\
              <span class="day-temp">' + maxT + '° / ' + minT + '°</span>\
            ';
            weatherForecastEl.appendChild(forecastDay);
          }
        }
      })
      .catch(function(err) {
        console.error("Error loading weather details", err);
        weatherDescEl.textContent = "Erro ao carregar clima";
      });
  }

  // Maps WMO codes to Portuguese titles and emojis
  function getWeatherInfo(code) {
    if (code === 0) return { icon: "☀️", desc: "Céu limpo" };
    if (code === 1 || code === 2 || code === 3) return { icon: "⛅", desc: "Parcialmente nublado" };
    if (code === 45 || code === 48) return { icon: "🌫️", desc: "Nevoeiro" };
    if (code >= 51 && code <= 55) return { icon: "🌦️", desc: "Chuvisco leve" };
    if (code >= 61 && code <= 65) return { icon: "🌧️", desc: "Chuva contínua" };
    if (code >= 80 && code <= 82) return { icon: "🌧️", desc: "Pancadas de chuva" };
    if (code >= 95 && code <= 99) return { icon: "⛈️", desc: "Tempestades" };
    return { icon: "☁️", desc: "Nublado" };
  }

  // Renders the news articles slideshow
  function renderNewsWidget(url) {
    fetch('/api/widgets/news?url=' + encodeURIComponent(url))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || data.length === 0) return;
        newsData = data;
        newsCurrentIndex = 0;
        displayNewsSlide();
        
        // Slide rotation loop
        if (newsIntervalId) clearInterval(newsIntervalId);
        newsIntervalId = setInterval(function() {
          newsCurrentIndex = (newsCurrentIndex + 1) % newsData.length;
          displayNewsSlide();
        }, 10000); // Rotate news slides every 10s
      })
      .catch(function(err) {
        console.error("Error loading news details", err);
      });
  }

  // Display one news article slide
  function displayNewsSlide() {
    if (newsData.length === 0) return;
    var item = newsData[newsCurrentIndex];
    
    // Quick text fade-out
    var contentEl = document.querySelector('.news-content-box');
    contentEl.style.transition = 'opacity 0.3s ease';
    contentEl.style.opacity = '0';
    
    setTimeout(function() {
      newsTitleEl.textContent = item.title;
      newsDescEl.textContent = item.description || '';
      
      // Select news background image or sports fallback
      var bgUrl = item.imageUrl || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200";
      newsBgEl.style.backgroundImage = "url('" + bgUrl + "')";
      
      contentEl.style.opacity = '1';
    }, 300);
  }

  // Clear canvas
  function clearDisplay() {
    hideAllMediaElements();
    
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
