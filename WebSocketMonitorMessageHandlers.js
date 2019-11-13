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

    function writeVal(res, label, value) {
	    res.write(label);
	    res.write(value);
	    res.write("\n");
	}

    function logMessageToTiddler(websocket, message, direction, doNotPersistKeyList, copyToFieldKeyList) {

        
        function getBaseTitle(url, direction) {
            let msgNo;
            let returnVal;
            // returnVal = `${direction} ${websocket.url} ${msgNo}`;
            returnVal = `${direction} ${url}/ `;
            return returnVal;
        }


        /*// Abort processing if message has a do not persist key
        let dnpKeys = doNotPersistKeyList.split(" ");
        dnpKeys.forEach((key) => {
            if (message.hasOwnProperty(key)) {
                console.log("logMessageToTiddler(): Not persisting, message has key=", key);
                return;
            }
            console.log("logMessageToTiddler(): persisting");

        });*/

        
        let theURL = `wss://${websocket._socket.remoteAddress}:${websocket._socket.remotePort}`;

        var tiddlerFields = {};
        tiddlerFields.type = "application/json";
        tiddlerFields.direction = direction;
        tiddlerFields.text = message;

        tiddlerFields.websocketurl = theURL;
        tiddlerFields.websocketreadystate = websocket.readyState;
        //tiddlerFields.ws_connection_index = websocket_ix;  // Doesn't apply here

        // Create a JSON Tiddler containing the JSON message
        // var baseTitle = `${direction} ${theURL}`;
        tiddlerFields.title = $tw.wiki.generateNewTitle(getBaseTitle(theURL, direction));
        $tw.wiki.addTiddler(new $tw.Tiddler(tiddlerFields,
                                            $tw.wiki.getCreationFields(),
                                            $tw.wiki.getModificationFields()));
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
            $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_websocket_server', stateTiddler: data.wsServerStateTiddler, wss_index: newServerIx, serverAddress: serverAddress, server_state: 'Running'} ));


        } catch (e) {
            console.log("start_websocket_server exception= ", e);
        }

    }

    $tw.nodeMessageHandlers.stop_websocket_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.stop_websocket_server -->");
        console.log(data);
        console.log("<--");

        $tw.websocketServer[data["wss_index"]].close();

        // Report result to caller
        $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'stopped_websocket_server', stateTiddler: data.wsServerStateTiddler, wss_index: data["wss_index"], server_state: 'Closed'} ));

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
        let WebServerWebsocketDoNotPersistKeyList;
        let WebServerWebsocketCopyToFieldKeyList;
        let WebServerSecurityPath = data.securityPath;
        let WebServerCertFilename = data.certFilename;
        let WebServerKeyFilename = data.keyFilename;
        let WebServerDhParamsFilename = data.dhParamsFilename;

        console.log(`starting ${WebServerType} WebServer at ${WebServerProtocol}://${IPAddress}:${WebServerPortNo}`);
        if (WebServerType === "Forwarding") {
            WebServerForwardingHost = data.forwardingHost;
            WebServerForwardingPort = data.forwardingPort;
            WebServerForwardingPath = data.forwardingPath;
            WebServerWebsocketForwardingHost = data.forwardingWebsocketHost;
            WebServerWebsocketForwardingPort = data.forwardingWebsocketPort;
            WebServerWebsocketForwardingPath = data.forwardingWebsocketPath;
            WebServerWebsocketDoNotPersistKeyList = data.dnpKeyList;
            WebServerWebsocketCopyToFieldKeyList = data.ctfKeyList;
            console.log("  forwardingHost= ", WebServerForwardingHost);
            console.log("  forwardingPort= ", WebServerForwardingPort);
            console.log("  forwardingPath= ", WebServerForwardingPath);
            console.log("  forwardingHost(ws)= ", WebServerWebsocketForwardingHost);
            console.log("  forwardingPort(ws)= ", WebServerWebsocketForwardingPort);
            console.log("  forwardingPath(ws)= ", WebServerWebsocketForwardingPath);
            console.log("  securityPath= ", WebServerSecurityPath);
            console.log("  certFilename= ", WebServerCertFilename);
            console.log("  keyFilename= ", WebServerKeyFilename);
            console.log("  dhParamsFilename= ", WebServerDhParamsFilename);
            console.log("  dnpKeyList= ", WebServerWebsocketDoNotPersistKeyList);
            console.log("  ctfKeylist= ", WebServerWebsocketCopyToFieldKeyList);
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
                $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_web_server', stateTiddler: data.wsServerStateTiddler, web_server_index: newServerIx, serverAddress: 'TBD', server_state: 'Running'} ));
            }

        } catch (e) {
            console.log("start_web_server exception= ", e);
        }

        // Read file at path (returns undefined on error)
        function readFile(path, filename) {
            let returnVal;
            try {
                let filePath = `${path}/${filename}`;
                console.log("readFile reading filename= ", filePath);
                returnVal = fs.readFileSync(filePath);
            }
            catch(err) {
                console.log(`readFile() path= ${path}, filename= ${filename}, err= ${err}`);
            }
            return returnVal;
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

            const optionsEchoServer = {
                cert:    readFile(WebServerSecurityPath, WebServerCertFilename),
                key:     readFile(WebServerSecurityPath, WebServerKeyFilename),
	            // dhparam: readFile(WebServerSecurityPath, WebServerDhParamsFilename),
	        };

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

	            ws.send(JSON.stringify({SecureEchoWebServerHello: 'Hello from SecureEchoWebServer'}));
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

            const optionsForwardingServer = {
                cert:    readFile(WebServerSecurityPath, WebServerCertFilename),
                key:     readFile(WebServerSecurityPath, WebServerKeyFilename),
	            // dhparam: readFile(WebServerSecurityPath, WebServerDhParamsFilename),
	        };

            let theSecureServer = https.createServer(optionsForwardingServer, (req, res) => {

                // TODO: look at replacing this with https://github.com/TooTallNate/node-https-proxy-agent (or similar)

                console.log("Request to forwardingServer listening on port: %s", port);
                console.log("  req.url= ", req.url);

                //const headerExclusions = ['host', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-user'];
                const headerExclusions = ['host'];

                const forwardedHeaders = {};
                for (let key in req.headers) {
                    if (req.headers.hasOwnProperty(key) && (!headerExclusions.includes(key))) {
                        forwardedHeaders[key] = req.headers[key];
                    }
                }

                const forwardedOptions = {
                    hostname: WebServerForwardingHost,
                    port: WebServerForwardingPort,
                    path: req.url,
                    method: req.method,
                    headers: forwardedHeaders
                };
                // console.log("  forwardedOptions.headers= ", forwardedOptions.headers);


                const forwardedReq = https.request(forwardedOptions, (forwardedRes) => {
                    res.writeHead(forwardedRes.statusCode, forwardedRes.headers)
                    forwardedRes.pipe(res, {
                        end: true
                    });
                });

                req.pipe(forwardedReq, {
                    end: true
                });

	        });

            // Open client to forwarded WebSocketServer
            let fwdHost = WebServerWebsocketForwardingHost;
            let fwdPort = WebServerWebsocketForwardingPort;
            let fwdPath = WebServerWebsocketForwardingPath;
            let theClientWebSocket;

	        const forwardingWss = new WebSocketServer({ noServer: true, theSecureServer });
	        //console.log("forwardingWss = ", forwardingWss);

            let doNotPersistKeyList = WebServerWebsocketDoNotPersistKeyList;
            let copyToFieldKeyList = WebServerWebsocketCopyToFieldKeyList;
            

	        forwardingWss.on('connection', function connection(ws) {
                // console.log('forwardingWss new connection, ws= ',ws);
                ws.on('message', function incoming(message) {
		            console.log('forwardingWSS received: message= ', message);
                    forwardingWebSocketClient.send(message);

                    // log message "to EP..."
                    logMessageToTiddler(ws, message, "to EP", doNotPersistKeyList, copyToFieldKeyList)
                 });

                const forwardingWebSocketClient = new WebSocket(`wss://${fwdHost}:${fwdPort}`);
                //console.log("forwardingWebSocketClient = ", forwardingWebSocketClient);
                forwardingWebSocketClient.onmessage = function(event) {
                    let message = event.data;
                    console.log("forwardingWebSocketClient: received message=", message);
                    theClientWebSocket.send(message);

                    // log message "from EP ..."
                    logMessageToTiddler(ws, message, "from EP", doNotPersistKeyList, copyToFieldKeyList)

                };

	            // ws.send(JSON.stringify({forwardingSecureServer: 'Opened forwardingWebSocketClient'}));
                // console.log("*** ", $tw.wiki.getModificationFields());
                // $tw.wiki.addTiddler(new $tw.Tiddler({title: "MaryLivesAgain", text: 'Hello from Node'}, $tw.wiki.getModificationFields()));
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
            theSecureServer.webSocketServer = forwardingWss;
            return(theSecureServer);
        }

    }

    $tw.nodeMessageHandlers.stop_web_server = function(data) {
        console.log("WebSocketMonitorMessageHandlers.stop_web_server -->");
        console.log(data);
        console.log("<--");

        if ($tw.webServer[data["web_server_index"]].hasOwnProperty("webSocketServer")) {
            $tw.webServer[data["web_server_index"]].webSocketServer.close();
        }
        $tw.webServer[data["web_server_index"]].close();

        // Report result to caller
        $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'stopped_web_server', stateTiddler: data.wsServerStateTiddler, web_server_index: data["web_server_index"], server_state: 'Closed'} ));

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
