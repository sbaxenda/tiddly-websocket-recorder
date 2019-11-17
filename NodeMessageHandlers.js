/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/NodeMessageHandlers.js
type: application/javascript
module-type: startup

  These are message handler functions for the web socket servers. Use this file
  as a template for extending the web socket functions.

  This handles messages sent to the node process.
\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    // This lets you add to the $tw.nodeMessageHandlers object without overwriting
    // existing handler functions
    $tw.nodeMessageHandlers = $tw.nodeMessageHandlers || {};

    /*
      This is just a test function to make sure that everthing is working.
      It just displays the contents of the data in the console.
    */
    $tw.nodeMessageHandlers.test = function(data) {
        console.log("nodeMessageHandlers.test -->");
        console.log(data);
        console.log("<--");
    }
    /*
      Echo the received message back to client websocket
    */
    $tw.nodeMessageHandlers.echo = function(data) {
        let serverIx = data.server_index;
        let clientIx = data.source_connection;

        console.log(`nodeMessageHandlers.echo, serverIx: ${serverIx}, clientIx: ${clientIx} -->`);
        $tw.websocketServer[serverIx].connections[clientIx].socket.send(JSON.stringify(data));
        console.log(data);
        console.log("<--");
    }

    /*
      Report client connections
    */
    $tw.nodeMessageHandlers.getServerClientConnections = function(data) {
        let serverIx = data.server_index;
        let clientIx = data.source_connection;

        console.log(`nodeMessageHandlers.getServerClientConnections, serverIx: ${serverIx}, clientIx: ${clientIx} -->`);
        let response = {clientCount: $tw.websocketServer[serverIx].connections.length, clients: []};
        for (const connection of $tw.websocketServer[serverIx].connections) {
            let client = {};
            client.active = connection.active;
            client.socket = connection.socket;
            response.clients.push(client);
        }
        $tw.websocketServer[serverIx].connections[clientIx].socket.send(JSON.stringify(response));
        console.log($tw.connections);
        console.log("<--");
    }

})()
