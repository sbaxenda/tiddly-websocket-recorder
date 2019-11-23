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

    $tw.monitorMessageHandlers = $tw.monitorMessageHandlers || {};
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


        let theMessage = JSON.parse(message);

        // Abort processing if message has a do not persist key
        let dnpKeys = doNotPersistKeyList.split(" ");
        for (let key of dnpKeys) {
            if (theMessage.hasOwnProperty(key)) {
                return;
            }
        }
        
        let theURL = `wss://${websocket._socket.remoteAddress}:${websocket._socket.remotePort}`;

        var tiddlerFields = {};
        tiddlerFields.type = "application/json";
        tiddlerFields.direction = direction;
        tiddlerFields.text = message;

        tiddlerFields.websocketurl = theURL;
        tiddlerFields.websocketreadystate = websocket.readyState;
        //tiddlerFields.ws_connection_index = websocket_ix;  // Doesn't apply here

        // copy specified message keys to tiddler fields
        let ctfKeys = copyToFieldKeyList.split(" ");
        for (let key of ctfKeys) {
            tiddlerFields[key] = theMessage[key];
        }

        // Create a JSON Tiddler containing the JSON message
        tiddlerFields.title = $tw.wiki.generateNewTitle(getBaseTitle(theURL, direction));
        $tw.wiki.addTiddler(new $tw.Tiddler(tiddlerFields,
                                            $tw.wiki.getCreationFields(),
                                            $tw.wiki.getModificationFields()));
    }


    function makeConnectionHandler(serverIx) {
        // let serverIx = getWebsockeServerIx();

        console.log("makeConnectionHandler: serverIx =", serverIx);

        return function(client) {
            handleConnection(client, serverIx);
        }
    };
    
    /*
      WebSocket Server control messages
    */
    $tw.monitorMessageHandlers.start_websocket_server = function(data) {

        let IPAddress = "dummyNonsense";  // TODO: Link up to IP address tiddler
        let PortNo = data.port;
        let WSProtocol = data.protocol;
        var newServerIx = getWebsocketServerIx();
        console.log(`starting WS Server at ${WSProtocol}://${IPAddress}:${PortNo}, newServerIx=${newServerIx}`);

        try {
            $tw.websocketServer[newServerIx] = new WebSocketServer({port: PortNo});
            $tw.websocketServer[newServerIx].connections = [];
            $tw.websocketServer[newServerIx].on('connection', makeConnectionHandler(newServerIx));

            // Report success and new WSS index back to caller
            let serverAddress = $tw.websocketServer[newServerIx].address();
            $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_websocket_server', stateTiddler: data.wsServerStateTiddler, wss_index: newServerIx, serverAddress: serverAddress, server_state: 'Running'} ));


        } catch (e) {
            console.log("start_websocket_server exception= ", e);
        }

    }

    $tw.monitorMessageHandlers.stop_websocket_server = function(data) {
        console.log(data);
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
    $tw.monitorMessageHandlers.start_web_server = function(data) {

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
            // console.log("  forwardingHost= ", WebServerForwardingHost);
            // console.log("  forwardingPort= ", WebServerForwardingPort);
            // console.log("  forwardingPath= ", WebServerForwardingPath);
            // console.log("  forwardingHost(ws)= ", WebServerWebsocketForwardingHost);
            // console.log("  forwardingPort(ws)= ", WebServerWebsocketForwardingPort);
            // console.log("  forwardingPath(ws)= ", WebServerWebsocketForwardingPath);
            // console.log("  securityPath= ", WebServerSecurityPath);
            // console.log("  certFilename= ", WebServerCertFilename);
            // console.log("  keyFilename= ", WebServerKeyFilename);
            // console.log("  dhParamsFilename= ", WebServerDhParamsFilename);
            // console.log("  dnpKeyList= ", WebServerWebsocketDoNotPersistKeyList);
            // console.log("  ctfKeylist= ", WebServerWebsocketCopyToFieldKeyList);
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

                let webSocketRecorderState = "On"; // recording defaults to on
                if ($tw.webServer[newServerIx].hasOwnProperty('forwardingWebSocketClient')) {
                    webSocketRecorderState = forwardingWebSocketClient.recordWebSocketMessages;
                }
                // Report success and new WSS index back to caller
                $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'started_web_server', stateTiddler: data.wsServerStateTiddler, web_server_index: newServerIx, serverAddress: 'TBD', server_state: 'Running', WebSocketRecorderState: webSocketRecorderState} ));
            }

        } catch (e) {
            console.log("start_web_server exception= ", e);
        }

        // Read file at path (returns undefined on error)
        function readFile(path, filename) {
            let returnVal;
            try {
                let filePath = `${path}/${filename}`;
                returnVal = fs.readFileSync(filePath);
            }
            catch(err) {
                console.log(`readFile() path= ${path}, filename= ${filename}, err= ${err}`);
            }
            return returnVal;
        }

        function startEchoWebServer(port) {
            let theServer = http.createServer({}, (req, res) => {

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

                // console.log("Request to forwardingServer listening on port: %s", port);
                // console.log("  req.url= ", req.url);

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
            // let fwdPath = WebServerWebsocketForwardingPath;
            let theClientWebSocket;
            let forwardingWebSocketClient;

            let forwardingWss = new WebSocketServer({ noServer: true, theSecureServer });
            theSecureServer.webSocketServer = forwardingWss;

            let doNotPersistKeyList = WebServerWebsocketDoNotPersistKeyList;
            let copyToFieldKeyList = WebServerWebsocketCopyToFieldKeyList;
            

	        forwardingWss.on('connection', function connection(ws) {
                ws.on('message', function incoming(message) {
                    forwardingWebSocketClient.send(message);

                    if (forwardingWebSocketClient.recordWebSocketMessages === "On") {
                        // log message "to EP..."
                        logMessageToTiddler(ws, message, "to EP", doNotPersistKeyList, copyToFieldKeyList)
                    }
                });

                let forwardingWebSocketClient = new WebSocket(`wss://${fwdHost}:${fwdPort}`);
                forwardingWebSocketClient.recordWebSocketMessages = "On";
                theSecureServer.forwardingWebSocketClient = forwardingWebSocketClient;

                forwardingWebSocketClient.onmessage = function(event) {
                    let message = event.data;
                    theClientWebSocket.send(message);
                    if (forwardingWebSocketClient.recordWebSocketMessages === "On") {
                        // log message "from EP ..."
                        logMessageToTiddler(ws, message, "from EP", doNotPersistKeyList, copyToFieldKeyList)
                    }
                };

	        });

            theSecureServer.on('upgrade', function upgrade(request, socket, head) {
                forwardingWss.handleUpgrade(request, socket, head, function done(ws) {
                    // console.log("** handling upgrade done()");
                    theClientWebSocket = ws;
                    forwardingWss.emit('connection', ws, request);
                });
            });

	        theSecureServer.listen(port);
            return(theSecureServer);
        }

    }

     $tw.monitorMessageHandlers.stop_web_server = function(data) {

        if ($tw.webServer[data["web_server_index"]].hasOwnProperty("webSocketServer")) {
            console.log("stop_web_server: closing webSocketServer");
            $tw.webServer[data["web_server_index"]].webSocketServer.close();
        }
        if ($tw.webServer[data["web_server_index"]].hasOwnProperty("forwardingWebSocketClient")) {
            console.log("stop_web_server: closing forwardingWebSocketClient");
            $tw.webServer[data["web_server_index"]].forwardingWebSocketClient.close();
        }
        $tw.webServer[data["web_server_index"]].close();

        // Report result to caller
        $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'stopped_web_server', stateTiddler: data.wsServerStateTiddler, web_server_index: data["web_server_index"], server_state: 'Closed'} ));

    }

     $tw.monitorMessageHandlers.toggle_web_server_websocket_recorder_state = function(data) {
         
         let newState = "Off";

         // console.log("$tw.webServer[data[web_server_index]]= ", $tw.webServer[data["web_server_index"]]);

         if ($tw.webServer[data["web_server_index"]].hasOwnProperty("forwardingWebSocketClient")) {
            console.log("toggle_web_server_websocket_recorder_state: toggling WS recorder");
            let currentState = $tw.webServer[data["web_server_index"]].forwardingWebSocketClient.recordWebSocketMessages;
            if (currentState === "On") {
                newState = "Off";
            }
            else {
                newState = "On";
            }
            $tw.webServer[data["web_server_index"]].forwardingWebSocketClient.recordWebSocketMessages = newState;
        }

        // Report result to caller
        $tw.connections[data.source_connection].socket.send(JSON.stringify({messageType: 'toggled_web_server_websocket_recorder_state', stateTiddler: data.wsServerStateTiddler, /*web_server_index: data["web_server_index"],*/ WebSocketRecorderState: newState} ));

    }

    
    /*
     * A new client websocket has connected to wss index serverIx
     */
    function handleConnection(client, serverIx) {
        console.log("new connection on WSS server index: ", serverIx);
        $tw.websocketServer[serverIx].connections.push({'socket':client, 'active': true});
        let clientIx = $tw.websocketServer[serverIx].connections.length - 1;
        
        client.on('message', function incoming(event) {
            var self = this;
            var thisIndex = $tw.websocketServer[serverIx].connections.findIndex(function(connection) {return connection.socket === self;});
            try {
                var eventData = JSON.parse(event);
                // Add the source to the eventData object so it can be used later.
                //eventData.source_connection = $tw.connections.indexOf(this);
                eventData.source_connection = thisIndex;
                eventData.server_index = serverIx;
                if (typeof $tw.nodeMessageHandlers[eventData.messageType] === 'function') {
                    $tw.nodeMessageHandlers[eventData.messageType](eventData);
                } else {
                    console.log('No $tw.nodeMessageHandler for message of type ', eventData.messageType);
                }
            } catch (e) {
                console.log(e);
            }
        });
        $tw.websocketServer[serverIx].connections[Object.keys($tw.websocketServer[serverIx].connections).length-1].socket.send(JSON.stringify({type: 'helloFromNodeWSS handleConnection', source: 'handleConnection:', clientIx: clientIx, serverIx: serverIx}));
    }

    /*
      This is just a test function to make sure that everthing is working.
      It just displays the contents of the data in the console.
    */
    $tw.monitorMessageHandlers.test = function(data) {
        console.log("monitorMessageHandlers.test -->");
        console.log(data);
        console.log("<--");
    }
    /*
      Echo the received message back to client websocket
    */
    $tw.monitorMessageHandlers.echo = function(data) {
        let clientIx = data.source_connection;
        console.log("monitorMessageHandlers.echo, clientIx:", clientIx, " -->");
        $tw.connections[clientIx].socket.send(JSON.stringify(data));
        console.log(data);
        console.log("<--");
    }

    /*
      Report client connections
    */
    $tw.monitorMessageHandlers.getMonitorClientConnections = function(data) {
        let clientIx = data.source_connection;
        console.log("monitorMessageHandlers.getMonitorClientConnections, clientIx:", clientIx, " -->");
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
