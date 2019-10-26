/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/WebSocketMonitorMessageHandlers.js
type: application/javascript
module-type: startup

  These are message handler functions for the web socket server Monitor.

  This web socket server is is used to setup additional web socket servers, by triggering
  the necessary server side (node) functionaity in response to the received messages.

\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    // copy in nodeWSS options from tiddly-websocket-recorder options settings
    var optionsTiddler = $tw.wiki.getTiddler('$:/plugins/sbaxenda/tiddly-websocket-recorder/base-options');
    var enableWebSocketServer = optionsTiddler.fields['option-enable-websocket-server'];
    var SERVER_PORT = optionsTiddler.fields['option-monitor-websocket-server-port'];
    //var enableWebSocketServer = $tw.nodeOptions['enableWSS'];

    // require the websockets module if we are running node
    var WebSocketServer = ($tw.node && (enableWebSocketServer === "true")) ? require('ws').Server : undefined;
    //console.log("WebSocketMonitorMessageHandlers: WebSocketServer=", WebSocketServer, "$tw.node=", $tw.node);

    function makeCounter() {
        let count = 0;

        return function() {
            return count++; // has access to the outer counter
        };
    }

    var getServerIx = makeCounter();

    $tw.nodeMessageHandlers = $tw.nodeMessageHandlers || {};
    $tw.websocketServer = [];
    $tw.websocketServerConnections = [];


    /*
      WebSocket Server control messages
    */
    $tw.nodeMessageHandlers.start_websocket_server = function(data) {

        // console.log(data);

        let IPAddress = "dummyNonsense";  // TODO: Link up to IP address tiddler
        let PortNo = data.port;
        let WSProtocol = data.protocol;
        console.log(`starting WS Server at ${WSProtocol}://${IPAddress}:${PortNo}`);
        var newServerIx = getServerIx();

        try {
            $tw.websocketServer[newServerIx] = new WebSocketServer({port: PortNo});
            $tw.websocketServer[newServerIx].on('connection', handleConnectionThisWebSocket(newServerIx));
            $tw.websocketServerConnections[newServerIx] = [];
            let serverAddress = $tw.websocketServer[newServerIx].address();


            // Report success and new WSS index back to caller
            $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_websocket_server', stateTiddler: data.wsServerStateTiddler, wss_index: newServerIx, serverAddress: serverAddress} ));


        } catch (e) {
            console.log(e);
        }

    }

    /*
      WebServer control messages
    */
    $tw.nodeMessageHandlers.start_web_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.start_web_server -->");
        console.log(data);
        console.log("<--");
    }


    function handleConnectionThisWebSocket(wss_index) {
        return function(client) {
            handleConnection(wss_index, client);
        }
    }

    function handleConnection(wss_index, client) {
        console.log("new connection on WSS wss_index: ", wss_index);
        $tw.websocketServerConnections[wss_index].push({'socket':client, 'active': true});
        client.on('message', function incoming(event) {
            var self = this;
            var thisIndex = $tw.websocketServerConnections[wss_index].findIndex(function(connection) {return connection.socket === self;});
            try {
                var eventData = JSON.parse(event);
                // Add the source to the eventData object so it can be used later.
                //eventData.source_connection = $tw.connections.indexOf(this);
                eventData.source_connection = thisIndex;
                if (typeof $tw.nodeMessageHandlers[eventData.messageType] === 'function') {
                    $tw.nodeMessageHandlers[eventData.messageType](eventData);
                } else {
                    console.log('No handler for message of type ', eventData.messageType);
                }
            } catch (e) {
                console.log(e);
            }
        });
        $tw.websocketServerConnections[wss_index][Object.keys($tw.websocketServerConnections[wss_index]).length-1].socket.send(JSON.stringify({type: 'helloFromNodeWSS ', source: 'handleConnection WSS', client: client}));
    }


    $tw.nodeMessageHandlers.stop_websocket_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.stop_websocket_server -->");
        console.log(data);
        console.log("<--");
    }

    $tw.nodeMessageHandlers.stop_web_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.stop_web_server -->");
        console.log(data);
        console.log("<--");
    }

    /*
      Report client connections
    */
    $tw.nodeMessageHandlers.getServerClientConnections = function(data) {
        let clientIx = data.source_connection;
        console.log("nodeMessageHandlers.getServerClientConnections, clientIx:", clientIx, " -->");
        let response = {clientCount: $tw.connections.length, clients: []};
        for (const connection of $tw.connections) {
            let client = {};
            client.active = connection.active;
            client.socket = connection.socket;
            response.clients.push(client);
        }
        $tw.connections[clientIx].socket.send(JSON.stringify(response));
        console.log($tw.connections);
        console.log("<--");
    }


})()
