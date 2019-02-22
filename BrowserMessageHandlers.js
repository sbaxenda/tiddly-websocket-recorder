/*\
title: $:/plugins/sbaxenda/tiddly-websocket-recorder/BrowserMessageHandlers.js
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
    exports.name = "web-sockets-setup";
    exports.platforms = ["browser"];
    exports.after = ["render"];
    exports.synchronous = true;

    $tw.browserMessageHandlers = $tw.browserMessageHandlers || {};
    $tw.browserMessageUtil = $tw.browserMessageUtil || {};

    $tw.browserMessageUtil.logMessageToTiddler = function(websocket_ix, message, direction) {

        var tiddlerFields = {};
        tiddlerFields.type = "application/json";
        tiddlerFields.direction = direction;
        tiddlerFields.text = JSON.stringify(message, null, 2);
        var timeNow = $tw.utils.formatDateString(new Date(), "[UTC]YYYY0MM0DD0hh0mm0ssXXX");
        tiddlerFields.created = timeNow;
        tiddlerFields.modified = timeNow;

        tiddlerFields.websocketurl = $tw.socket[websocket_ix].url;
        tiddlerFields.websocketreadystate = $tw.socket[websocket_ix].readyState;
        tiddlerFields.ws_connection_index = websocket_ix;
        //tiddlerFields.webSocketProtocol = $tw.socket.protocol;
        //tiddlerFields.webSocket = $tw.socket;

        // Create a JSON Tiddler containing the JSON message
        var baseTitle = `${direction} ${tiddlerFields.websocketurl}`;
        tiddlerFields.title = $tw.wiki.generateNewTitle(baseTitle);
        $tw.wiki.addTiddler(new $tw.Tiddler(tiddlerFields));
    }

    
    /*
      Process a generic message (ie, build a tiddler containing the message)
    */
    $tw.browserMessageHandlers.generic = function(websocket_ix, data) {

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }



})();
