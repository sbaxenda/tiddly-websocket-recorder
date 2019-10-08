/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/BrowserWebSocketMonitoryMessageHandlers.js
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
        // Update state tiddler for websocket serve with ServerIndex
        let wsStateTiddler = data.stateTiddler;
        let currentStateTiddler = $tw.wiki.getTiddler(wsStateTiddler);
        let updatedStateTiddler = new $tw.Tiddler(currentStateTiddler, 
                                                   {"wss_index": data.wss_index},
                                                  $tw.wiki.getModificationFields());
        console.log("updatedState: ", updatedStateTiddler);
		$tw.wiki.addTiddler(updatedStateTiddler);

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }

})();
