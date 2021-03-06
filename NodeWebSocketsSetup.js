/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/NodeWebSocketsSetup.js
type: application/javascript
module-type: startup

  This is the node component of the web sockets. It works with
  web-sockets-setup.js and ActionWebSocketMessage.js which set up the browser
  side and make the action widget used to send messages to the node process.

  To extend this you make a new file that adds functions to the
  $tw.monitorMessageHandlers object.

\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    // Export name and synchronous status
    exports.name = "NodeWebSocketsSetup";
    exports.platforms = ["node"];
    exports.after = ["startup"];
    exports.synchronous = true;

    exports.startup = function() {

        function uncaughtExceptionHandler(e) {
            console.log("uncaughtExceptionHandler: exception= ", e);
        }

        // TODO: do this properly (ie, securely)
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        process.on('uncaughtException',uncaughtExceptionHandler);

        // copy in nodeWSS options from tiddly-websocket-recorder options settings
        var optionsTiddler = $tw.wiki.getTiddler('$:/plugins/sbaxenda/tiddly-websocket-recorder/base-options');
        var enableWebSocketServer = optionsTiddler.fields['option-enable-websocket-server'];
        var SERVER_PORT = optionsTiddler.fields['option-monitor-websocket-server-port'];
        //$tw.nodeOptions = {enableWSS: enableWebSocketServer};


        // require the websockets module if we are running node
        var WebSocketServer = ($tw.node && (enableWebSocketServer === "true")) ? require('ws').Server : undefined;
        //var Git = $tw.node ? require('simple-git') : undefined;
        var fs = $tw.node ? require("fs"): undefined;

        // initialise the empty $tw.monitorMessageHandlers object. This holds the functions that
        // are used for each monitor message type
        $tw.monitorMessageHandlers = $tw.monitorMessageHandlers || {};

        $tw.connections = [];

        /*
          This sets up the websocket server and attaches it to the $tw object
        */
        var setup = function () {
            // We need to get the ip address of the node process so that we can connect
            // to the websocket server from the browser
            var ip = require("ip");
            var ipAddress = ip.address();
            // Create the tiddler that holds the IP address
            var fileData = `title: $:/ServerIP\n\n${ipAddress}`;

            $tw.wiki.addTiddler(new $tw.Tiddler({title: "$:/ServerIP", text: ipAddress}));

            // This is the port used by the web socket server
            //var SERVER_PORT = 8051;
            // Create the web socket server on the defined port
            $tw.wss = new WebSocketServer({port: SERVER_PORT});
            // Initialise the connections array
            //var connections = new Array;
            // Put a 0 in the array to start, it wasn't working without putting something // here for some reason.

            //$tw.connections.push(0);
            // Set the onconnection function
            $tw.wss.on('connection', handleConnection);
        }

        /*
          This function handles connections to a client.
          It currently only supports one client and if a new client connection is made
          it will replace the current connection.
          This function saves the connection and adds the message handler wrapper to
          the client connection.
          The message handler part is a generic wrapper that checks to see if we have a
          handler function for the message type and if so it passes the message to the
          handler, if not it prints an error to the console.

          connection objects are:
          {
          "socket": socketObject,
          "name": the user name for the wiki using this connection
          }
        */
        function handleConnection(client) {
            $tw.connections.push({'socket':client, 'active': true});
            let clientIx =  $tw.connections.length - 1;
            
            console.log("Monitor WSS: new connection, clientIx= ", clientIx);

            client.on('message', function incoming(event) {
                var self = this;
                var thisIndex = $tw.connections.findIndex(function(connection) {return connection.socket === self;});
                // console.log("  thisIndex= ", thisIndex); 
                if (typeof event === 'object') {
                    //console.log(Object.keys(event));
                }
                try {
                    var eventData = JSON.parse(event);
                    // Add the source to the eventData object so it can be used later.
                    //eventData.source_connection = $tw.connections.indexOf(this);
                    eventData.source_connection = thisIndex;
                    if (typeof $tw.monitorMessageHandlers[eventData.messageType] === 'function') {
                        $tw.monitorMessageHandlers[eventData.messageType](eventData);
                    } else {
                        console.log('No handler for message of type ', eventData.messageType);
                    }
                } catch (e) {
                    console.log(e);
                }
            });
            $tw.connections[Object.keys($tw.connections).length-1].socket.send(JSON.stringify({type: 'helloFromNodeWSS Monitor port', source: 'handleConnection', clientIx: clientIx}));
        }

        //module.exports = setup;
        if (WebSocketServer) {
            setup()
            setTimeout(function() {testFunction()}, 10000)

            var testFunction = function() {
                if ($tw.connections[0]) {
                    if (typeof $tw.connections[0].socket.send === 'function') {
                        $tw.connections[0].socket.send(JSON.stringify({type: "delayed .. helloFromNodeWSS Monitor port"}))
                    } else {
                        setTimeout(testFunction, 1000)
                    }
                } else {
                    setTimeout(testFunction, 1000)
                }
            }
        }
    }

})();
