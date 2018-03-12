var videoOutput;
var webRtcPeer;
var exitFullscreenButton;
var fullscreenButton;
var startButton;
var stopButton;
var pauseButton;
var paused = false;
var ws;

// When document is loaded, initialize the script's variables
// and event callbacks
window.onload = function () {
  // Variables referencing elements
  exitFullscreenButton = $('#exitFullscreen');
  startButton = $('#start');
  stopButton = $('#stop');
  fullscreenButton = $('#fullscreen');
  pauseButton = $('#pause');
  videoOutput = $('#videoOutput')[0];

  // Create the console to write stuff in the interface
  // for easier debugging
  console = new Console();

  // Bind event handlers to the buttons
  startButton.click(start);
  exitFullscreenButton.click(exitFullscreen);
  fullscreenButton.click(enterFullscreen);
  stopButton.click(stop);
  pauseButton.click(togglePause);

  document.getElementById('start').disabled = false;
  document.getElementById('stop').disabled = true;

  ws = new WebSocket('${SIGNALING_URI}');

  // Event binder for when a message is received
  ws.onmessage = function (message) {
    var parsedMessage = JSON.parse(message.data);
    console.info('Received message: ' + message.data);

    switch (parsedMessage.id) {
      // The response the signaling server will send to a start request
      case 'startResponse':
        startResponse(parsedMessage);
        break;
      // The message the signaling server will send if an error occurs
      case 'error':
        onError('Error message from server: ' + parsedMessage.error);
        break;
      // The message the signaling server will send if a new iceCandidate is
      // received
      case 'iceCandidate':
        webRtcPeer.addIceCandidate(parsedMessage.candidate);
        break;
      // Unknown cases
      default:
        onError('Unrecognized message', parsedMessage);
    }
  };

  // Create a webRtcPeer and initialize the media player
  // then proceeds to generate an SdpOffer that the signaling server
  // will forward to KMS
  function start() {
    showSpinner(videoOutput);

    console.log('Creating WebRtcPeer and generating local sdp offer ...');
    var options = {
      remoteVideo: videoOutput,
      onicecandidate: onIceCandidate,
      mediaConstraints: {
        audio: false,
        video: true,
      },
    };

    webRtcPeer =
      kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
        if (error) return onError(error);
        console.info('Generating SDP offer...');
        this.generateOffer(onOffer);
        console.info('SDP offer generated');
        return null;
      });

    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
  }

  // Send local candidates to the signaling server to be forwarded to KMS
  function onIceCandidate(candidate) {
    console.log('Local candidate' + JSON.stringify(candidate));

    // force TURN candidates
    //   if(candidate.candidate.indexOf('relay') === -1){
    //       return;
    //   }

    var message = {
      id: 'onIceCandidate',
      candidate: candidate,
    };
    sendMessage(message);
  }

  // Callback used to send the offer to the signaling server to be forwarded to
  // KMS
  function onOffer(error, offerSdp) {
    if (error) return onError(error);

    console.info('Invoking SDP offer callback function ' + location.host);
    var message = {
      id: 'start',
      rtspUri: 'rtsp://fake_camera:8554/live.sdp',
      sdpOffer: offerSdp,
    };
    sendMessage(message);
    return null;
  }

  // Process the SDP answer from KMS in order to start playing the stream
  function startResponse(message) {
    console.log('SDP answer received from server. Processing ...');
    webRtcPeer.processAnswer(message.sdpAnswer);
  }

  // Stops the stream and disconnects the WebRTCPeer from KMS
  function stop() {
    console.log('Stopping RTSP streaming...');

    if (webRtcPeer) {
      webRtcPeer.dispose();
      webRtcPeer = null;

      var message = {
        id: 'stop',
      };
      sendMessage(message);
    }
    hideSpinner(videoOutput);

    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
  }

  // Helper to send messages through the WebSocket
  function sendMessage(message) {
    var jsonMessage = JSON.stringify(message);
    console.log('Sending message: ' + jsonMessage);
    ws.send(jsonMessage);
  }
};

// Close the websocket when the window is closing
window.onbeforeunload = function () {
  ws.close();
};

// Simply changes the CSS class of the media player to put it in fullscreen
function enterFullscreen() {
  console.log('Starting fullscreen mode');

  videoOutput.classList.add('fullscreen');
  exitFullscreenButton.addClass('visible');
}

// Simply resets the class of the media player to put it back in normal mode
function exitFullscreen() {
  console.log('Stopping fullscreen mode');

  videoOutput.classList.remove('fullscreen');
  exitFullscreenButton.removeClass('visible');
}

// Error callback
function onError(error) {
  console.error(error);
}

// Hide the background of the video and shows a spinner instead
// Currently we don't have a spinner
function showSpinner() {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].poster = './assets/transparent-1px.png';
  }
  $('.loader').show();
}

// Shows the background again and hides the spinner
function hideSpinner() {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].src = '';
    arguments[i].poster = './assets/WebRTC.png';
  }
  $('.loader').hide();
}

// Pauses the media player from receiving the stream
// Unpauses if it was paused.
function togglePause() {
  if (!paused) {
    webRtcPeer.remoteVideo.pause();
    console.info('Video paused.');
  } else {
    webRtcPeer.remoteVideo.load();
    console.info('Video unpaused.');
  }
  paused = !paused;
}
