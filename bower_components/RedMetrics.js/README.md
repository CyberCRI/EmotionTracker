# RedMetrics.js

JavaScript browser client for the open source game analytics service [RedMetrics.io](https://redmetrics.io). RedMetrics.js buffers requests and uses promises to make integration easy. 


## Use

### Installation

The simplest way to install RedMetrics.js is via bower:

```
bower install redmetrics.js
```

RedMetrics.js can be included as a global dependency or via an AMD module (like RequireJS). For example, here are the script tags necessary to include it as a global dependency.

```
<script type="text/javascript" src="bower_components/q/q.js"></script>
<script type="text/javascript" src="bower_components/q-xhr/q-xhr.js"></script>
<script type="text/javascript" src="bower_components/underscore/underscore.js"></script>
<script type="text/javascript" src="bower_components/redmetrics.js/redmetrics.js"></script>
```

### Example

Here's a short example that shows how to use the library.

```javascript
var options = { gameVersionId: "XXXXXXXX" }; // This game version will be different for each game
redmetrics.connect(options).then(function() {
	console.log("Connected to the RedMetrics server");
});

// ... Later on we have some events and snapshots to send

// Player started level 1
redmetrics.postEvent({
	type: "start",
	section: "level 1"
});

// Player gained 3 points
redmetrics.postEvent({
	type: "gain",
	section: "level 1",
	customData: 3
});

// ... Finally we disconnect from the server

redmetrics.disconnect();

```


### Connection 

To connect to the RedMetrics server, call `redmetrics.connect(options)`. The most important option is

* gameVersionId (String): Required. The unique identifier that identifies the version of the game you are recording data for. Example: "0d355cd6-1b08-4dec-989d-eb4850cba680" 

To connect to another server, you can also set the following options:

* protocol (String): Defaults to "https". 
* host (String): Defaults to api.redmetrics.api
* port (String): Defaults to 443.

Other options are available as well:

* bufferingDelay (Number): The minimum amount of time, in milliseconds, between subsequent requests to the server. The default is 5000, or 5 seconds. Decreasing this delay will increase the rapidity of the requests while decreasing their size. Increasing the delay has the opposite effect.
* player (Object): Describes the current player. Default is an anonymous player. This can be updated later with `redmetrics.updatePlayer()`


### Posting events

Once you are connected, you can post an event by calling `redmetrics.postEvent(event)`. The `event` object can have the following properties.

* type - String. Examples are "start", "end", "win", "fail", etc.
* customData - Any data structure. For "gain" and “lose” events, specifies the number of things are gained or lost.
* section - Section as array or dot-separated string (optional)
* coordinates - Coordinate where the event occurred as 2D- or 3D-array (optional)

The event will not be sent immediately, but will be buffered and sent with other events (see the `bufferingDelay` connection option). 


### Posting snapshots

Snapshots use a method similar to events - `redmetrics.postSnapshot(snapshot)`. The `snapshot` has the following properties: 

* customData - The value of the snapshot. Usually this is simply a JSON-encodable data structure that describes the state of the game.
* section - Section as array or dot-separated string (optional)

Snapshots are buffered just as events are to be sent in batches.


### Disconnecting 

To force the client to disconnect, just call `redmetrics.disconnect()`. For most purposes this is optional, but is useful for changing players.


### Player information

By default an anonymous player is created at connection time. This player can be modified by calling `redmetrics.updatePlayer(player)` with a `player` object that has some of the following properties: 

* birthDate - Date. This date _must not_ be more exact than the nearest month and year.
* region - String
* country - String
* gender - String (either "MALE", "FEMALE", or "OTHER")
* externalId - String that can be set by developers in order to link the player with another database. This _must not_ be a personally identifiable marker such as an email address.
* customData - Any JSON-encodable data structure. This _must not_ be contain personally identifiable markers such as name or exact address.

Alternatively, a player object can be provided as an connection option.


### Promises

RedMetrics.js uses the [Q library](https://github.com/kriskowal/q) so that all methods return promises. A promise returned by postEvent() or postSnapshot() will only be fulfilled when the data is sent to the server.


## Developing

### Tests

To run the tests, simply visit `tests.html` in a web browser. Certain browsers like Google Chrome require that the test page be hosted via a server rather than loaded from a file.

To use a different RedMetrics server for the tests, copy `testConfig.sample.js` to `testConfig.js`. Change the options within it as necessary.
