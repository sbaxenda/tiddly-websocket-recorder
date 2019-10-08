/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/action-startwebsocketserver.js
type: application/javascript
module-type: widget

  Action widget to start a WebSocket server

  <$action-startwebsocketserver $server=tiddlerDefiningWebSocketServer/>

  ex.

  <$action-startwebsocketserver $server="$:/WebSocketServer"/>

  starts a WebSocket server listening for connections as defined in the $server tiddlers 'protocol'://'address':'port' fields

  stores the websocket ??server?? index in the $server ws-index field

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
    console.log("action-startwss: WebSocketServer=", WebSocketServer, "$tw.node=", $tw.node);

    var Widget = require("$:/core/modules/widgets/widget.js").widget;

    var ActionStartWebSocketServer = function(parseTreeNode,options) {
	    this.initialise(parseTreeNode,options);
    };

    $tw.nodeMessageHandlers = $tw.nodeMessageHandlers || {};
    $tw.socketServer = $tw.socketServer || [];
    $tw.socketServerConnections = $tw.socketServerConnections || [];    
    //    $tw.browserMessageUtil = $tw.browserMessageUtil || {};

    function makeCounter() {
        let count = 0;

        return function() {
            return count++; // has access to the outer counter
        };
    }

    var getServerIx = makeCounter();

    /*
      Inherit from the base widget class
    */
    ActionStartWebSocketServer.prototype = new Widget();

    /*
      Render this widget into the DOM
    */
    ActionStartWebSocketServer.prototype.render = function(parent,nextSibling) {
	    this.computeAttributes();
	    this.execute();
    };

    /*
      Compute the internal state of the widget
    */
    ActionStartWebSocketServer.prototype.execute = function() {
	    this.server = this.getAttribute('$server', undefined);
    };

    /*
      Refresh the widget by ensuring our attributes are up to date
    */
    ActionStartWebSocketServer.prototype.refresh = function(changedTiddlers) {
	    var changedAttributes = this.computeAttributes();
	    if(Object.keys(changedAttributes).length) {
		    this.refreshSelf();
		    return true;
	    }
	    return this.refreshChildren(changedTiddlers);
    };

    /*
      Invoke the action associated with this widget
    */
    ActionStartWebSocketServer.prototype.invokeAction = function(triggeringWidget,event) {

        function updateWebSocketReadyState(socketReadyState, newServerIx) {

            function getWebSocketStateString(state) {
                const stateToString = {
                    0: "Connecting",
                    1: "Open",
                    2: "Closing",
                    3: "Closed"
                };
                return stateToString[state];
            }
            var CurrentServerTiddler = $tw.wiki.getTiddler(self.server);
            var extraFields = {};
            var serverIx;
            if (newServerIx !== undefined) {
                serverIx = newServerIx;
                extraFields["wss_index"] = newServerIx;  // Update server tiddler field with new server ix.
            }
            else {
                serverIx = CurrentServerTiddler.fields.wss_index;
            }
			var updatedServerTiddler = new $tw.Tiddler(CurrentServerTiddler, 
                                                       {"ws-readystate": getWebSocketStateString(
                                                           $tw.socketServer[serverIx].readyState)},
                                                       extraFields,
                                                       $tw.wiki.getModificationFields());
			$tw.wiki.addTiddler(updatedServerTiddler);
        }
        
        function setup(server) {

            function handleConnectionThisWebSocket(wss_index) {
                return function(client) {
                    handleConnection(wss_index, client);
                }
            }
            
            // TODO - add exception handling
            var ServerTiddler = $tw.wiki.getTiddler(server);
            //var IPAddress = ServerTiddler.fields.address;
            var IPAddress = "dummyNonsense";
            var PortNo = ServerTiddler.fields.port;
            var WSProtocol = ServerTiddler.fields.protocol;
            console.log(`starting WS Server at ${WSProtocol}://${IPAddress}:${PortNo}`);
            var newServerIx = getServerIx();

            console.log("pre-construction: WebSocketServer=", WebSocketServer, "$tw.node=", $tw.node);

            $tw.socketServer[newServerIx] = new WebSocketServer({port: PortNo});
            console.log("post-construction: WebSocketServer=", WebSocketServer, "$tw.node=", $tw.node);

            $tw.socketServerConnections[newServerIx] = [];  // List of connected clients

            // Set the onconnection function
            $tw.socketServer[newServerIx].on('connection', handleConnectionThisWebSocket(newServerIndex));

            updateWebSocketReadyState($tw.socketServer[newServerIx].readyState, newServerIx);           
        }

        /*
          This function handles connections to a client, by saving the client and adding
          the message handler wrapper to the client connection.
          
          The message handler part is a generic wrapper that checks to see if we have a
          handler function for the message type and if so it passes the message to the
          handler, if not it prints an error to the console.

        */
        function handleConnection(wss_index, client) {
            console.log("new connection on wss_index: ", wss_index);
            $tw.socketServerConnections[wss_index].push({'socket':client, 'active': true});
            client.on('message', function incoming(event) {
                var self = this;
                var thisIndex = $tw.socketServerConnections[wss_index].findIndex(function(connection) {return connection.socket === self;});
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
            $tw.socketServerConnections[wss_index][Object.keys($tw.socketServerConnections[wss_index]).length-1].socket.send(JSON.stringify({type: 'listTiddlers', source: 'handleConnection', client: client}));
        }

        var self = this;
        setup(this.server);

        return true; // Action was invoked
    };

    exports["action-startwebsocketserver"] = ActionStartWebSocketServer;

})();
