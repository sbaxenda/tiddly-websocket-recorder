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

            console.log("Starting simpleServer on port: 9999");

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

	    const wss = new WebSocketServer({ simpleServer });
	    //console.log("wss = ", wss);

	    wss.on('connection', function connection(ws) {
            ws.on('message', function incoming(message) {
		        console.log('simpleServer received: %s', message);
            });

	        ws.send(JSON.stringify({simpleServerOn9999: 'something'}));
	    });

	    simpleServer.listen(9999);


	    const forwardingServer = https.createServer(options, (req, res) => {

            console.log("Starting forwardingServer on port: 7777");
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

	    const forwardingWss = new WebSocketServer({ forwardingServer });
	    //console.log("forwardingWss = ", forwardingWss);

	    forwardingWss.on('connection', function connection(ws) {
            ws.on('message', function incoming(message) {
		        console.log('forwardingWSS received: %s', message);
            });

	        ws.send(JSON.stringify({forwardingServer7777: 'something'}));
	    });

	    server.listen(7777);
    }


    //module.exports = setup;
    if (WebSocketServer) {
        setup()
    }

})();
