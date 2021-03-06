/*\
  title: $:/plugins/sbaxenda/tiddly-websocket-recorder/action-connectwebsocket.js
  type: application/javascript
  module-type: widget

  Action widget to connect websocket

  <$action-connectwebsocket $server=tiddlerDefiningEndpointToConnectTo/>

  ex.

  <$action-connectwebsocket $server="$:/WebSocketEndPoint"/>

  establishes a websocket connection at endpoint defined in $server tiddlers 'protocol'://'address':'port' fields

  stores the websocket index in the $server ws-index field

\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    var Widget = require("$:/core/modules/widgets/widget.js").widget;

    var ActionConnectWebSocket = function(parseTreeNode,options) {
	    this.initialise(parseTreeNode,options);
    };

    $tw.browserMessageHandlers = $tw.browserMessageHandlers || {};
    $tw.browserMessageUtil = $tw.browserMessageUtil || {};

    function makeCounter() {
        let count = 0;

        return function() {
            return count++; // has access to the outer counter
        };
    }

    var getSocketIx = makeCounter();

    /*
      Inherit from the base widget class
    */
    ActionConnectWebSocket.prototype = new Widget();

    /*
      Render this widget into the DOM
    */
    ActionConnectWebSocket.prototype.render = function(parent,nextSibling) {
	    this.computeAttributes();
	    this.execute();
    };

    /*
      Compute the internal state of the widget
    */
    ActionConnectWebSocket.prototype.execute = function() {
	    this.server = this.getAttribute('$server', undefined);
    };

    /*
      Refresh the widget by ensuring our attributes are up to date
    */
    ActionConnectWebSocket.prototype.refresh = function(changedTiddlers) {
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
    ActionConnectWebSocket.prototype.invokeAction = function(triggeringWidget,event) {

        function updateWebSocketReadyState(socketReadyState, newSocketIx) {

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
            var socketIx;
            if (newSocketIx !== undefined) {
                socketIx = newSocketIx;
                extraFields["ws_index"] = newSocketIx;  // Update server tiddler field with new socket ix.
            }
            else {
                socketIx = CurrentServerTiddler.fields.ws_index;
            }
			var updatedServerTiddler = new $tw.Tiddler(CurrentServerTiddler, 
                                                       {"ws-readystate": getWebSocketStateString(
                                                           $tw.socket[socketIx].readyState)},
                                                       extraFields,
                                                       $tw.wiki.getModificationFields());
			$tw.wiki.addTiddler(updatedServerTiddler);
        }
        
        function setup(server) {

            function parseMessageThisWebSocket(ws_index) {
                return function(event) {
                    parseMessage(ws_index, event);
                }
            }
            
            // TODO - add exception handling
            var ServerTiddler = $tw.wiki.getTiddler(server);
            var IPAddress = ServerTiddler.fields.address;
            var PortNo = ServerTiddler.fields.port;
            var WSProtocol = ServerTiddler.fields.protocol;
            //console.log(`connecting to ${WSProtocol}://${IPAddress}:${PortNo}`);
            $tw.socket = $tw.socket || [];
            var newSocketIx = getSocketIx();
            $tw.socket[newSocketIx] = new WebSocket(`${WSProtocol}://${IPAddress}:${PortNo}`);
            $tw.socket[newSocketIx].onopen = openSocket;
            $tw.socket[newSocketIx].onclose = closeSocket;
            $tw.socket[newSocketIx].onerror = errorSocket;
            $tw.socket[newSocketIx].onmessage = parseMessageThisWebSocket(newSocketIx);
            $tw.socket[newSocketIx].binaryType = "arraybuffer";
            $tw.socket[newSocketIx].rxCount = 0;
            $tw.socket[newSocketIx].txCount = 0;

            updateWebSocketReadyState($tw.socket[newSocketIx].readyState, newSocketIx);
            //console.log(Object.keys($tw.socket[socketIx])); - none visible ?
            
        }
        /*
          If anything needs to be done to set things up when a socket is opened
          put it in this function
        */
        var openSocket = function() {
            var ServerTiddler = $tw.wiki.getTiddler(self.server);
            var socketIx = ServerTiddler.fields.ws_index;
            updateWebSocketReadyState($tw.socket[socketIx].readyState);
        }
        var closeSocket = openSocket; // just updating status. so same function as open
        var errorSocket = openSocket; // ditto

        /*
          If the message from the websocket server has a message type and that message type
          matches a handler, then data is passed to the handler function.
        */
        var parseMessage = function(ws_index, event) {

            $tw.socket[ws_index].rxCount =  $tw.socket[ws_index].rxCount + 1;

            var eventData = JSON.parse(event.data);
            var msgTypeKey = $tw.browserMessageUtil.options.messageTypeKey;
            //console.log("Event data: ",event.data);
            if ((eventData[msgTypeKey]) &&
                (typeof $tw.browserMessageHandlers[eventData[msgTypeKey]] === 'function')) {
                //console.log(Object.keys($tw.browserMessageHandlers));
                $tw.browserMessageHandlers[eventData[msgTypeKey]](ws_index, eventData);
            }
            else {
                //console.log("unrecognised messageType-> treating as generic:",eventData);
                $tw.browserMessageHandlers.generic(ws_index, eventData);
            }
        }

        var self = this;
        setup(this.server);

        return true; // Action was invoked
    };

    exports["action-connectwebsocket"] = ActionConnectWebSocket;

})();
