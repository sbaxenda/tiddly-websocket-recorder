/*\
  title: $:/plugins/sbaxenda/tiddly-websocket-recorder/action-disconnectwebsocket.js
  type: application/javascript
  module-type: widget

  Action widget to dis-connect websocket

  <$action-disconnectwebsocket $server=tiddlerDefiningEndpointToDisconnectFrom/>

  ex.

  <$action-disconnectwebsocket $server="$:/WebSocketEndPoint"/>

  disconnects a websocket connection at endpoint defined in $server tiddlers 'protocol'://'address':'port' fields

\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    var Widget = require("$:/core/modules/widgets/widget.js").widget;

    var ActionDisConnectWebSocket = function(parseTreeNode,options) {
	    this.initialise(parseTreeNode,options);
    };

    /*
      Inherit from the base widget class
    */
    ActionDisConnectWebSocket.prototype = new Widget();

    /*
      Render this widget into the DOM
    */
    ActionDisConnectWebSocket.prototype.render = function(parent,nextSibling) {
	    this.computeAttributes();
	    this.execute();
    };

    /*
      Compute the internal state of the widget
    */
    ActionDisConnectWebSocket.prototype.execute = function() {
	    this.server = this.getAttribute('$server', undefined);
    };

    /*
      Refresh the widget by ensuring our attributes are up to date
    */
    ActionDisConnectWebSocket.prototype.refresh = function(changedTiddlers) {
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
    ActionDisConnectWebSocket.prototype.invokeAction = function(triggeringWidget,event) {

        var CurrentServerTiddler = $tw.wiki.getTiddler(this.server);
        var socketIx = CurrentServerTiddler.fields.ws_index;

        //console.log("ws-disconnect", socketIx, $tw.socket[socketIx].readyState, WebSocket.OPEN);
        
        // Ignore unless currently connected
        if (socketIx != undefined && $tw.socket[socketIx].readyState == WebSocket.OPEN) {
            
            // Send close to endpoint
            $tw.socket[socketIx].close();
            //console.log("ws-disconnect - calling close()");
        }

        return true; // Action was invoked
    };

    exports["action-disconnectwebsocket"] = ActionDisConnectWebSocket;

})();
