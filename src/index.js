//@flow

import type { Server } from './server';

'use strict';

const ws = require('ws').Server;
const Server = require('./server')(ws);
const kurento = require('kurento-client');
const kurentoPipeline = require('./kurento-pipeline');

const kmsUrl = 'ws://kurento:8888/kurento';

console.log(`Using KMS WebSocket server at ${kmsUrl}`);

// Establish connection with Kurento Media Server using its URL
kurento(kmsUrl)
  .catch(error => {
    console.error(
      `Could not find media server at address ${kmsUrl}. Exiting:`,
      error
    );
    process.exit(1);
  })
  .then(kurentoClient => {
    const createPipeline = kurentoPipeline(
      kurentoClient,
      // We need to manually give this constructor to pipeline so it doesn't
      // have to import Kurento.
      kurento.register.complexTypes.IceCandidate
    );

    const server = Server({ port: 7000 });
    console.log('WS Server listening on port 7000');

    server.onConnection(client => {
      const pipeline = createPipeline(client);

      client.onMessage(handleMessages(client, pipeline));
      client.onError(handleError(pipeline));
      client.onClose(handleClose(pipeline));
    });
  });

function handleMessages(client, pipeline) {
  return message => {
    switch (message.id) {
      case 'start':
        const { rtspUri, sdpOffer } = message;

        handleStart(client, pipeline)(rtspUri, sdpOffer);
        break;
      case 'stop':
        console.log('Client stopped stream');
        pipeline.stop();
        break;
      case 'onIceCandidate':
        pipeline.handleIceCandidate(message.candidate);
        break;
      default:
        client.send({
          id: 'error',
          message: `Invalid message ID: ${message.id}`,
        });
        break;
    }
  };
}

function handleStart(client, pipeline) {
  return async (rtspUri, sdpOffer) => {
    console.log('START', rtspUri);

    try {
      console.log('Launching pipeline for RTSP URL:', rtspUri);
      pipeline.start(rtspUri, sdpOffer);
    } catch (error) {
      const [message, reason] = error;
      console.error(message);
      client.send({
        id: 'error',
        error: reason,
      });
    }
  };
}

function handleError(pipeline) {
  return error => {
    console.error('WebSocket error:', error);
    pipeline.stop();
  };
}

function handleClose(pipeline) {
  return (code, reason) => {
    console.info(`WebSocket closed with code ${code}: ${reason}`);
    pipeline.stop();
  };
}
