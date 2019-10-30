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
    const WebSocket = $tw.node ? require('ws'): undefined;
    const fs = $tw.node ? require("fs"): undefined;
    const http = $tw.node ? require('http'): undefined;
    const https = $tw.node ? require('https'): undefined;

    function makeCounter() {
        let count = 0;

        return function() {
            return count++; // has access to the outer counter
        };
    }

    var getWebsocketServerIx = makeCounter();
    var getWebServerIx = makeCounter();

    $tw.nodeMessageHandlers = $tw.nodeMessageHandlers || {};
    $tw.websocketServer = [];
    $tw.websocketServerConnections = [];

    $tw.webServer = [];

    // if ($tw.node) {
	    const optionsEchoServer = {
            cert: fs.readFileSync('./develop-WebSocketRecorder/server.crt'),
            key: fs.readFileSync('./develop-WebSocketRecorder/dev-key.pem')
	        //     dhparam: fs.readFileSync("/path/dhparams.pem")
	    };

        const optionsForwardingServer = {
            cert: fs.readFileSync('./develop-WebSocketRecorder/server.crt'),
            key: fs.readFileSync('./develop-WebSocketRecorder/dev-key.pem')
	        //     dhparam: fs.readFileSync("/path/dhparams.pem")
	    };
    // }
    // else {
	//     const optionsEchoServer = {};
	//     const optionsForwardingServer = {};
    // }

    function writeVal(res, label, value) {
	    res.write(label);
	    res.write(value);
	    res.write("\n");
	}

    /*
      WebSocket Server control messages
    */
    $tw.nodeMessageHandlers.start_websocket_server = function(data) {

        // console.log(data);

        let IPAddress = "dummyNonsense";  // TODO: Link up to IP address tiddler
        let PortNo = data.port;
        let WSProtocol = data.protocol;
        console.log(`starting WS Server at ${WSProtocol}://${IPAddress}:${PortNo}`);
        var newServerIx = getWebsocketServerIx();

        try {
            $tw.websocketServer[newServerIx] = new WebSocketServer({port: PortNo});
            $tw.websocketServer[newServerIx].on('connection', handleConnectionThisWebSocket(newServerIx));
            $tw.websocketServerConnections[newServerIx] = [];
            let serverAddress = $tw.websocketServer[newServerIx].address();


            // Report success and new WSS index back to caller
            $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_websocket_server', stateTiddler: data.wsServerStateTiddler, wss_index: newServerIx, serverAddress: serverAddress} ));


        } catch (e) {
            console.log("start_websocket_server exception= ", e);
        }

    }

    $tw.nodeMessageHandlers.stop_websocket_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.stop_websocket_server -->");
        console.log(data);
        console.log("<--");
    }

    /*
      Webserver control messages

      {"messageType":"start_web_server","protocol":"http","port":"1234","serverType":"Forwarding",
      "wsServerStateTiddler":"$:/Web-Server-State-1448435960","forwardingHost":"www.google.com.au",
      "forwardingPort":"443"}
    */
    $tw.nodeMessageHandlers.start_web_server = function(data) {

        let WebServerProtocol = data.protocol;
        let IPAddress = "dummyNonsense";  // TODO: Link up to IP address tiddler
        let WebServerPortNo = data.port;
        let WebServerType = data.serverType;
        let WebServerForwardingHost;
        let WebServerForwardingPort;
        let WebServerForwardingPath;
        let WebServerWebsocketForwardingHost;
        let WebServerWebsocketForwardingPort;
        let WebServerWebsocketForwardingPath;

        console.log(`starting ${WebServerType} WebServer at ${WebServerProtocol}://${IPAddress}:${WebServerPortNo}`);
        if (WebServerType === "Forwarding") {
            WebServerForwardingHost = data.forwardingHost;
            WebServerForwardingPort = data.forwardingPort;
            WebServerForwardingPath = data.forwardingPath;
            WebServerWebsocketForwardingHost = data.forwardingWebsocketHost;
            WebServerWebsocketForwardingPort = data.forwardingWebsocketPort;
            WebServerWebsocketForwardingPath = data.forwardingWebsocketPath;
            console.log("  forwardingHost= ", WebServerForwardingHost);
            console.log("  forwardingPort= ", WebServerForwardingPort);
            console.log("  forwardingPath= ", WebServerForwardingPath);
            console.log("  forwardingHost(ws)= ", WebServerWebsocketForwardingHost);
            console.log("  forwardingPort(ws)= ", WebServerWebsocketForwardingPort);
            console.log("  forwardingPath(ws)= ", WebServerWebsocketForwardingPath);
        }

        var newServerIx = getWebServerIx();

        try {

            if (WebServerType === "Echo") {
                if (WebServerProtocol === "http") {
                    $tw.webServer[newServerIx] = startEchoWebServer(WebServerPortNo);
                }
                else {
                    $tw.webServer[newServerIx] = startSecureEchoWebServer(WebServerPortNo);
                }
            }
            else if (WebServerType === "Forwarding") {
                if (WebServerProtocol === "http") {
                    $tw.webServer[newServerIx] = startForwardingWebServer(WebServerPortNo);
                }
                else
                {
                    $tw.webServer[newServerIx] = startSecureForwardingWebServer(WebServerPortNo);
                }
            } else {
                console.log("Unkown webServer type = %s", WebServerType);
                // Indicate unknown type to condition success response
                WebServerType = "Unknown";
            }

            if (WebServerType !== "Unknown") {
                // Report success and new WSS index back to caller
                $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_web_server', stateTiddler: data.wsServerStateTiddler, web_server_index: newServerIx, serverAddress: 'TBD'} ));
            }

        } catch (e) {
            console.log("start_web_server exception= ", e);
        }

        function startEchoWebServer(port) {
            let theServer = http.createServer({}, (req, res) => {
                console.log("Request to EchoWebServer listening on port: ", port);

	            const { method, url } = req;

	            res.writeHead(200);
	            res.write("---- request values ----\n");
	            writeVal(res, 'method= ', method);
	            writeVal(res, 'url= ', url);
	            writeVal(res, 'req.rawHeaders= ', JSON.stringify(req.rawHeaders, null, 2));
	            res.write("\n\n");
	            res.write("---- result values ----\n");
	            res.write("res.getHeaders = ");
                res.write(JSON.stringify(res.getHeaders()));
	            res.end('');
            });

            const wss = new WebSocketServer({ noServer: true, theServer });

	        wss.on('connection', function connection(ws) {
                ws.on('message', function incoming(message) {
		            console.log('EchoWebServer on port %s received: %s', port, message);
                    // echo back to sender
                    ws.send(message);
                });

	            ws.send(JSON.stringify({EchoWebServerHello: 'Hello World!'}));
	        });

            theServer.on('upgrade', function upgrade(request, socket, head) {
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    wss.emit('connection', ws, request);
                });
            });

            theServer.listen(port);
            return(theServer);
        }

        function startSecureEchoWebServer(port) {
            let theSecureServer = https.createServer(optionsEchoServer, (req, res) => {
                console.log("Request to SecureEchoWebServer listening on port: ", port);

	            const { method, url } = req;

	            res.writeHead(200);
	            res.write("---- request values ----\n");
	            writeVal(res, 'method= ', method);
	            writeVal(res, 'url= ', url);
	            writeVal(res, 'req.rawHeaders= ', JSON.stringify(req.rawHeaders, null, 2));
	            res.write("\n\n");
	            res.write("---- result values ----\n");
	            res.write("res.getHeaders = ");
                res.write(JSON.stringify(res.getHeaders()));
	            res.end('');
            });

            const wss = new WebSocketServer({ noServer: true, theSecureServer });

	        wss.on('connection', function connection(ws) {
                ws.on('message', function incoming(message) {
		            console.log('SecureEchoWebServer on port %s received: %s', port, message);
                    // echo back to sender
                    ws.send(message);
                });

	            ws.send(JSON.stringify({SecureEchoWebServerHello: 'Hello World!'}));
	        });

            theSecureServer.on('upgrade', function upgrade(request, socket, head) {
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    wss.emit('connection', ws, request);
                });
            });

	        theSecureServer.listen(port);
            //console.log("theEcho SS - ", theSecureServer);
            return(theSecureServer);
        }


        function startForwardingWebServer(port) {
            console.log("startForwardingWebServer - stub");
        }

        function startSecureForwardingWebServer(port) {
            let theSecureServer = https.createServer(optionsForwardingServer, (req, res) => {

                console.log("Request to forwardingServer listening on port: %s", port);
                console.log("  req.url= ", req.url);
                // console.log("  req=", req);

                const forwardedOptions = {
                    hostname: WebServerForwardingHost,
                    port: WebServerForwardingPort,
                    path: req.url,
                    method: req.method
                };

                const forwardedReq = https.request(forwardedOptions, (forwardedRes) => {
                    // console.log('statusCode [internal]:', forwardedRes.statusCode);
                    // console.log('headers [internal]:', forwardedRes.headers);

                    forwardedRes.on('data', (d) => {
                        res.write(d);
                    });

                    forwardedRes.on('end', () => {
                        res.end();
                    });
                });

                forwardedReq.on('error', (e) => {
                    console.error(e);
                });
                forwardedReq.end();


	        });

            // Open client to forwarded WebSocketServer
            let fwdHost = WebServerWebsocketForwardingHost;
            let fwdPort = WebServerWebsocketForwardingPort;
            let fwdPath = WebServerWebsocketForwardingPath;
            let theClientWebSocket;

            const forwardingWebSocketClient = new WebSocket(`wss://${fwdHost}:${fwdPort}`);
            //console.log("forwardingWebSocketClient = ", forwardingWebSocketClient);
            forwardingWebSocketClient.onmessage = function(event) {
                console.log("forwardingWebSocketClient: received event.data=", event.data);
                if (theClientWebSocket !== undefined) {
                    theClientWebSocket.send(event.data);
                } else {
                    console.log("forwardingWebSocketClient: silently dropping messge (as no client connection).");
                }
            };

	        const forwardingWss = new WebSocketServer({ noServer: true, theSecureServer });
	        //console.log("forwardingWss = ", forwardingWss);

	        forwardingWss.on('connection', function connection(ws) {
                ws.on('message', function incoming(message) {
		            console.log('forwardingWSS received: message= ', message);
                    forwardingWebSocketClient.send(message);
                });

	            ws.send(JSON.stringify({forwardingSecureServer: 'something'}));
	        });

            theSecureServer.on('upgrade', function upgrade(request, socket, head) {
                forwardingWss.handleUpgrade(request, socket, head, function done(ws) {
                    console.log("** handling upgrade done()");
                    theClientWebSocket = ws;
                    forwardingWss.emit('connection', ws, request);
                });
            });

	        theSecureServer.listen(port);
            //console.log("theForwarding SS - ", theSecureServer);
            return(theSecureServer);
        }

    }

    $tw.nodeMessageHandlers.stop_web_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.stop_web_server -->");
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
