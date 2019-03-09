/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/action-websocketmessage.js
type: application/javascript
module-type: widget

  Action widget to send a websocket message to the endpoint defined by the $server parameter.

  <$action-websocketmessage $server=tiddlerDefiningEndpointConnectedTo/ $type=message_type $value=value/>

  Any other key=value pairs will be added to the JSON message sent

  ex:

  <$action-websocketmessage $server="$:/WebSocketEndPoint" $type=git $value=pull branch=foo/>

  sends:

  {
  "msg_type": "git",
  "value": "pull",
  "branch": foo
  }

  over the websocket connection defined by tiddler $:/WebSocketEndPoint

\*/
(function(){

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    var Widget = require("$:/core/modules/widgets/widget.js").widget;

    $tw.browserMessageUtil = $tw.browserMessageUtil || {};
    $tw.browserMessageSendLogger = $tw.browserMessageSendLogger || {};


    var ActionWebSocketMessage = function(parseTreeNode,options) {
	    this.initialise(parseTreeNode,options);
    };

    /*
      Inherit from the base widget class
    */
    ActionWebSocketMessage.prototype = new Widget();

    /*
      Render this widget into the DOM
    */
    ActionWebSocketMessage.prototype.render = function(parent,nextSibling) {
	    this.computeAttributes();
	    this.execute();
    };

    /*
      Compute the internal state of the widget
    */
    ActionWebSocketMessage.prototype.execute = function() {
	    this.server = this.getAttribute('$server', undefined);
	    this.type = this.getAttribute('$type', undefined);
	    this.value = this.getAttribute('$value', undefined);
    };

    /*
      Refresh the widget by ensuring our attributes are up to date
    */
    ActionWebSocketMessage.prototype.refresh = function(changedTiddlers) {
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
    ActionWebSocketMessage.prototype.invokeAction = function(triggeringWidget,event) {
        // Create the empty message object
        var message = {};
        // Add in the message type and value, if they exist
        message.msg_type = this.type;
        let value = this.value;
        let parsedValue;
        if (value !== undefined) {
            parsedValue = JSON.parse(this.value);
        }
        else {
            parsedValue = undefined;
        }
        //console.log(`value = ${value}, parsedValue => ${parsedValue}`);
        message.value = parsedValue;
        // For any other attributes passed to the widget add them to the message as
        // key: value pairs
        $tw.utils.each(this.attributes,function(attribute,name) {
		    if(name.charAt(0) !== "$") {
                message[name] = attribute;
		    }
	    });
        // We need a message type at a minimum to send anything
        if (message.msg_type) {

            // ws_index field of server tiddler tracks the WS instance.
            var CurrentServerTiddler = $tw.wiki.getTiddler(this.server);
            var socketIx;
            socketIx = CurrentServerTiddler.fields.ws_index;

            if (typeof $tw.socket[socketIx] !== 'undefined') {

                // Send the message
                $tw.socket[socketIx].send(JSON.stringify(message));

                // User defined logging if defined for msg_type, else generic
                if (typeof $tw.browserMessageSendLogger[message.msg_type] === 'function') {
                  $tw.browserMessageSendLogger[message.msg_type] (socketIx, message);
                }
                else
                {
                  $tw.browserMessageUtil.logMessageToTiddler(socketIx, message, "to EP");
                }
            }
        }

	    return true; // Action was invoked
    };

    exports["action-websocketmessage"] = ActionWebSocketMessage;

})();
