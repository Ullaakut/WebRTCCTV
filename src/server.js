'use strict';

module.exports = Server => options => {
  const { pingInterval = 10000, port = 8443 } = options;
  let connectionHandler;

  // Start the ws server
  const server = new Server({ port });

  server.on('connection', ws => {
    if (!connectionHandler) {
      return;
    }

    console.log('New connection');
    const client = createClient(ws);
    connectionHandler(client);
  });

  function createClient(ws) {
    let messageHandler, errorHandler, closeHandler;

    // Starts pinging the client every `pingInterval`ms
    const stopKeepAlive = startKeepAlive(ws);

    ws.on('error', error => {
      if (errorHandler) {
        errorHandler(error);
      }
    });

    ws.on('close', (code, reason) => {
      if (closeHandler) {
        closeHandler(code, reason);
        stopKeepAlive();
      }
    });

    ws.on('message', message => {
      if (messageHandler) {
        messageHandler(JSON.parse(message));
      }
    });

    return {
      onMessage(handler) {
        messageHandler = handler;
      },
      onError(handler) {
        errorHandler = handler;
      },
      onClose(handler) {
        closeHandler = handler;
      },
      send(message) {
        ws.send(JSON.stringify(message));
      },
    };
  }

  // Starts pinging a ws connection to make sure it stays alive
  function startKeepAlive(ws) {
    let isAlive = true;

    ws.on('pong', () => {
      isAlive = true;
    });

    // Every `pingInterval` ms, check if socket is still alive and send a new ping
    const timer = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, pingInterval);

    // Return a function that stops the ping timer
    return () => {
      clearInterval(timer);
    };
  }

  return {
    onConnection(handler) {
      connectionHandler = handler;
    },
  };
};