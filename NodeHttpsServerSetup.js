/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/NodeHttpsServerSetup.js
type: application/javascript
module-type: startup

  This is the node component that runs a HTTPS server with a WebSocketServer.

\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    // copy in nodeWSS options from tiddly-websocket-recorder options settings
    const optionsTiddler = $tw.wiki.getTiddler('$:/plugins/sbaxenda/tiddly-websocket-recorder/base-options');
    const enableWebSocketServer = optionsTiddler.fields['option-enable-websocket-server'];


    // require the websockets module if we are running node
    const WebSocketServer = ($tw.node && (enableWebSocketServer === "true")) ? require('ws').Server : undefined;
    const fs = $tw.node ? require("fs"): undefined;
	const https = $tw.node ?  require('https'): undefined;

    /*
      This sets up the HTTPS server
    */
    var setup = function () {

        /*
          temporarily: Lets run a https server on 9999
          TODO: factor this out into parameterised values settable vi wss monitor interface
        */

	    const options = {
            cert: fs.readFileSync('./develop-WebSocketRecorder/server.crt'),
            key: fs.readFileSync('./develop-WebSocketRecorder/dev-key.pem')
	    //     dhparam: fs.readFileSync("/path/dhparams.pem")
	    };

	    function writeVal(res, label, value) {
	        res.write(label);
	        res.write(value);
	        res.write("\n"); 
	    }
	    
	    const simpleServer = https.createServer(options, (req, res) => {

            console.log("Request to simpleServer listening on port: 9999");

	        const { method, url } = req;

	        res.writeHead(200);
	        res.write("Hello, World\n\n");
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

        const wss = new WebSocketServer({ noServer: true, simpleServer });

	    wss.on('connection', function connection(ws) {
            ws.on('message', function incoming(message) {
		        console.log('simpleServer received: %s', message);
            });

	        ws.send(JSON.stringify({simpleServerOn9999: 'something'}));
	    });

        simpleServer.on('upgrade', function upgrade(request, socket, head) {
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request);
            });
        });

	    simpleServer.listen(9999);


	    const forwardingServerOptions = {
            cert: fs.readFileSync('./develop-WebSocketRecorder/server.crt'),
            key: fs.readFileSync('./develop-WebSocketRecorder/dev-key.pem')
	    //     dhparam: fs.readFileSync("/path/dhparams.pem")
	    };

	    const forwardingServer = https.createServer(forwardingServerOptions, (req, res) => {

            //const https = require('https');

            console.log("Request to forwardingServer listening on port: 7777");
            console.log("  req.url= ", req.url);
            // console.log("  req=", req);

            const forwardedOptions = {
                hostname: 'www.google.com.au',
                port: 443,
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

	    const forwardingWss = new WebSocketServer({ noServer: true, forwardingServer });
	    //console.log("forwardingWss = ", forwardingWss);

	    forwardingWss.on('connection', function connection(ws) {
            ws.on('message', function incoming(message) {
		        console.log('forwardingWSS received: %s', message);
            });

	        ws.send(JSON.stringify({forwardingServer7777: 'something'}));
	    });

        forwardingServer.on('upgrade', function upgrade(request, socket, head) {
            forwardingWss.handleUpgrade(request, socket, head, function done(ws) {
                forwardingWss.emit('connection', ws, request);
            });
        });

	    forwardingServer.listen(7777);

    }

    //module.exports = setup;
    if (WebSocketServer) {
        setup()
    }

})();
