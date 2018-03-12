'use strict';

module.exports = (kurentoClient, IceCandidate) => client => {
  let pipeline;
  let webRtcEndpoint;

  // Used to buffer ice candidates until webRtcEndpoint is ready to process them
  let iceCandidatesQueue = [];

  // Start an RTSP stream using client's offer
  function start(rtspUri, sdpOffer) {
    return startStream(rtspUri, sdpOffer).catch(pipelineError);
  }

  // Start the RTSP stream
  async function startStream(rtspUri, sdpOffer) {
    // Create the media pipeline
    const { playerEndpoint } = await createPipeline(rtspUri, sdpOffer);

    // Start the pipeline
    await playerEndpoint.play();
  }

  // Create the kurento pipeline composed of a WebRTCEndpoint and a PlayerEndpoint
  // The PlayerEndpoint sends the stream into the pipeline
  // The WebRtcEndpoint forwards it to the browser
  async function createPipeline(rtspUri, sdpOffer) {
    console.log(`Creating KMS pipeline with RTSP stream: ${rtspUri}`);

    pipeline = await kurentoClient.create('MediaPipeline');

    pipeline.on('Error', pipelineError);

    // Create the 2 endpoints in parallel
    const [playerEndpoint, webRtcEndpoint] = await Promise.all([
      createPlayerEndpoint(rtspUri),
      createWebRtcEndpoint(sdpOffer),
    ]);

    // Connect the playerEndpoint to the webRtcEndpoint
    await playerEndpoint.connect(webRtcEndpoint, 'VIDEO');

    return {
      playerEndpoint,
      webRtcEndpoint,
      pipeline,
    };
  }

  // Create and start the player endpoint
  async function createPlayerEndpoint(rtspUri) {
    const playerOptions = {
      uri: rtspUri,
      useEncodedMedia: false,

      // Reduce the buffering in order to decrease latency to the minimum
      // Using 0 as the networkCache value could cause stability problems
      networkCache: 100,
    };

    const playerEndpoint = await pipeline.create(
      'PlayerEndpoint',
      playerOptions
    );

    playerEndpoint.on('Error', pipelineError);

    return playerEndpoint;
  }

  // Create and setup the WebRTC endpoint
  async function createWebRtcEndpoint(sdpOffer) {
    webRtcEndpoint = await pipeline.create('WebRtcEndpoint');

    webRtcEndpoint.on('Error', pipelineError);

    // If we already had ICE candidates queued, we add them to the WebRTC endpoint
    // We can safely assume there won't be candidates added to the queue while we empty it
    // since `webRtcEndpoint` has been set, so handleIceCandidate will directly send them to it
    await Promise.all(
      iceCandidatesQueue.map(candidate =>
        webRtcEndpoint.addIceCandidate(candidate)
      )
    );

    // Ask Kurento to process the SDP offer in order to get an SDP answer
    const sdpAnswer = await webRtcEndpoint.processOffer(sdpOffer);

    // Send sdp answer to client
    client.send({
      id: 'startResponse',
      sdpAnswer,
    });

    // Start gathering local ICE candidates and send them to the client
    webRtcEndpoint.on('OnIceCandidate', event => {
      const candidate = IceCandidate(event.candidate);
      client.send({
        id: 'iceCandidate',
        candidate,
      });
    });
    await webRtcEndpoint.gatherCandidates();

    return webRtcEndpoint;
  }

  function handleIceCandidate(candidate) {
    const kurentoCandidate = IceCandidate(candidate);
    if (webRtcEndpoint) {
      console.info('Candidate received, forwarding to WebRTC endpoint');
      webRtcEndpoint.addIceCandidate(kurentoCandidate);
    } else {
      console.info('Candidate received, queuing...');
      // Push this IceCandidate into the queue
      iceCandidatesQueue.push(kurentoCandidate);
    }
  }

  // Release pipeline for this camera after a stream could not start
  function pipelineError(error) {
    console.error('Pipeline error:', error);
    client.send({
      id: 'error',
      error: 'Pipeline error',
    });
    stop();
  }

  // Release pipeline
  function stop() {
    if (!pipeline) {
      return;
    }
    console.info('Releasing pipeline');
    pipeline.release();
    pipeline = null;
    webRtcEndpoint = null;
    iceCandidatesQueue = [];
  }

  return {
    start,
    stop,
    handleIceCandidate,
  };
};
