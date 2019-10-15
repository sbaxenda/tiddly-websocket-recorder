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
    $tw.browserMessageUtil.options = $tw.browserMessageUtil.options || {};

    // copy in tiddly-websocket-recorder prettify JSON option
    var optionsTiddler = $tw.wiki.getTiddler('$:/plugins/sbaxenda/tiddly-websocket-recorder/base-options');
    var prettifyJSON = optionsTiddler.fields['option-prettify-json'];
    $tw.browserMessageUtil.options.prettifyJSON = prettifyJSON;

    function makeJSON_Writer(prettifyPredicate) {
        if (prettifyPredicate === "true") {
            return function(msg) {
                return JSON.stringify(msg, null, 2);
            };
        }
        else {
            return function(msg) {
                return JSON.stringify(msg);
            };
        }
    }

    let JSON_Writer = makeJSON_Writer($tw.browserMessageUtil.options.prettifyJSON);

    function getBaseTitle(websocket_ix, direction) {
        let msgNo;
        let returnVal;

        if (direction === "from EP") {
            msgNo = $tw.socket[websocket_ix].rxCount;
        }
        else {
            msgNo = $tw.socket[websocket_ix].txCount;
        }
        returnVal = `${direction} ${$tw.socket[websocket_ix].url} ${msgNo}`;
        return returnVal;
    }



    $tw.browserMessageUtil.logMessageToTiddler = function(websocket_ix, message, direction) {

        var tiddlerFields = {};
        tiddlerFields.type = "application/json";
        tiddlerFields.direction = direction;
        tiddlerFields.text = JSON_Writer(message);

        tiddlerFields.websocketurl = $tw.socket[websocket_ix].url;
        tiddlerFields.websocketreadystate = $tw.socket[websocket_ix].readyState;
        tiddlerFields.ws_connection_index = websocket_ix;

        // Create a JSON Tiddler containing the JSON message
        var baseTitle = `${direction} ${tiddlerFields.websocketurl}`;
        tiddlerFields.title = $tw.wiki.generateNewTitle(getBaseTitle(websocket_ix, direction));
        $tw.wiki.addTiddler(new $tw.Tiddler(tiddlerFields, $tw.wiki.getModificationFields()));
    }

    /*
      Process a generic incoming (received) message (ie, build a tiddler containing the message)
    */
    $tw.browserMessageHandlers.generic = function(websocket_ix, data) {

        $tw.browserMessageUtil.logMessageToTiddler(websocket_ix, data, "from EP");
    }

})();
