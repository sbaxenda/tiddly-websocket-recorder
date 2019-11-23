/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/BrowserWebSocketMonitorMessageHandlers.js
type: application/javascript
module-type: startup

  This handles messages sent to the browser.

  These are message handlers for messages sent to the browser. If you want to
  add more functions the easiest way is to use this file as a template and make a
  new file that adds the files you want. To do this you need should copy
  everything until the line

  $tw.browserMessageHandlers = $tw.browserMessageHandlers || {};

  this line makes sure that the object exists and doesn't overwrite what already
  exists and it lets the files that define handlers be loaded in any order.

  Remember that the file has to end with

  })();

  to close the function that wraps the contents.
  Also change the title of the tiddler in the second line of the file, otherwise
  it will overwrite this file.
\*/
(function () {

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    // Export name and synchronous status
    // exports.name = "web-sockets-setup";
    // exports.platforms = ["browser"];
    // exports.after = ["render"];
    // exports.synchronous = true;

    $tw.browserMessageHandlers = $tw.browserMessageHandlers || {};
    $tw.browserMessageUtil = $tw.browserMessageUtil || {};

    $tw.browserMessageHandlers.started_websocket_server = function(websocket_ix, data) {
        console.log(" $tw.browserMessageHandlers.started_websocket_server: ...");
        // Update state tiddler for websocket server with ServerIndex
        let wsStateTiddler = data.stateTiddler;
        let currentStateTiddler = $tw.wiki.getTiddler(wsStateTiddler);
        let updatedStateTiddler = new $tw.Tiddler(currentStateTiddler, 
                                                  {"wss_index": data.wss_index,
                                                   "server_state": data.server_state},
                                                  $tw.wiki.getModificationFields());
        console.log("started_websocket_server: updatedState: ", updatedStateTiddler);
		$tw.wiki.addTiddler(updatedStateTiddler);

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }

    $tw.browserMessageHandlers.stopped_websocket_server = function(websocket_ix, data) {
        console.log(" $tw.browserMessageHandlers.stopped_websocket_server: ...");
        // Update state tiddler for websocket server with ServerIndex
        let wsStateTiddler = data.stateTiddler;
        let currentStateTiddler = $tw.wiki.getTiddler(wsStateTiddler);
        let updatedStateTiddler = new $tw.Tiddler(currentStateTiddler,
                                                   {"server_state": data.server_state},
                                                  $tw.wiki.getModificationFields());
        console.log("stopped_websocket_server: updatedState: ", updatedStateTiddler);
		$tw.wiki.addTiddler(updatedStateTiddler);

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }

    $tw.browserMessageHandlers.started_web_server = function(websocket_ix, data) {
        console.log(" $tw.browserMessageHandlers.started_web_server: ...");
        // Update state tiddler for web server with ServerIndex
        let wsStateTiddler = data.stateTiddler;
        let currentStateTiddler = $tw.wiki.getTiddler(wsStateTiddler);
        let updatedStateTiddler = new $tw.Tiddler(currentStateTiddler,
                                                  {"web_server_index": data.web_server_index,
                                                   "server_state": data.server_state,
                                                   "WebSocketRecorderState": data.WebSocketRecorderState},
                                                  $tw.wiki.getModificationFields());
        console.log("started_web_server: updatedState: ", updatedStateTiddler);
		$tw.wiki.addTiddler(updatedStateTiddler);

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }

    $tw.browserMessageHandlers.stopped_web_server = function(websocket_ix, data) {
        console.log(" $tw.browserMessageHandlers.stopped_web_server: ...");
        // Update state tiddler for web server with ServerIndex
        let wsStateTiddler = data.stateTiddler;
        let currentStateTiddler = $tw.wiki.getTiddler(wsStateTiddler);
        let updatedStateTiddler = new $tw.Tiddler(currentStateTiddler,
                                                   {"server_state": data.server_state},
                                                  $tw.wiki.getModificationFields());
        console.log("stopped_web_server: updatedState: ", updatedStateTiddler);
		$tw.wiki.addTiddler(updatedStateTiddler);

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }

    $tw.browserMessageHandlers.toggled_web_server_websocket_recorder_state = function(websocket_ix, data) {
        console.log(" $tw.browserMessageHandlers. toggled_web_server_websocket_recorder_state: ...");
        // Update state tiddler for web server with ServerIndex
        let wsStateTiddler = data.stateTiddler;
        let currentStateTiddler = $tw.wiki.getTiddler(wsStateTiddler);
        let updatedStateTiddler = new $tw.Tiddler(currentStateTiddler,
                                                  {"WebSocketRecorderState": data.WebSocketRecorderState},
                                                  $tw.wiki.getModificationFields());
        console.log("toggled_web_server_websocket_recorder_state: updatedState: ", updatedStateTiddler);
		$tw.wiki.addTiddler(updatedStateTiddler);

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }
   

})();
