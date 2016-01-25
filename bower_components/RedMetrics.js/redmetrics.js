// Uses AMD or browser globals to create a module.

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(["q-xhr"], factory);
    } else {
        // Browser globals
        root.redmetrics = factory(root.b);
    }
}(this, function (b) {
    var playerId = null;
    var eventQueue = [];
    var snapshotQueue = [];
    var postDeferred = null;
    var timerId = null;

    var redmetrics = {
        connected: false,
        options: {}
    };

    function getUserTime() {
        return new Date().toISOString();
    }

    function sendData() {
        if(eventQueue.length == 0 && snapshotQueue == 0) return;

        Q.spread([sendEvents(), sendSnapshots()], function(eventCount, snaphotCount) {
            postDeferred.resolve({
                events: eventCount,
                snapshots: snaphotCount
            });
        }).fail(function(error) {
            postDeferred.reject(new Error("Error posting data: " + error));
        }).fin(function() {
            // Create new deferred
            postDeferred = Q.defer();
        });
    }

    function sendEvents() {
        if(eventQueue.length == 0) return Q.fcall(function() { 
            return 0; 
        });

        var request = Q.xhr({
            url: redmetrics.options.baseUrl + "/v1/event/",
            method: "POST",
            data: JSON.stringify(eventQueue),
            contentType: "application/json"
        }).then(function(result) {
           return result.data.length;
        }).fail(function(error) {
            throw new Error("Error posting events: " + error);
        });

        // Clear queue
        eventQueue = [];

        return request;
    }

    function sendSnapshots() {
        if(snapshotQueue.length == 0) return Q.fcall(function() { 
            return 0; 
        });

        var request = Q.xhr({
            url: redmetrics.options.baseUrl + "/v1/snapshot/",
            method: "POST",
            data: JSON.stringify(snapshotQueue),
            contentType: "application/json"
        }).then(function(result) {
            return result.data.length;
        }).fail(function(error) {
            throw new Error("Error posting snapshots: " + error);
        });

        // Clear queue
        snapshotQueue = [];

        return request;
    }

    redmetrics.connect = function(connectionOptions) {
        // Get options passed to the factory. Works even if connectionOptions is undefined 
        redmetrics.options = _.defaults({}, connectionOptions, {
            protocol: "https",
            host: "api.redmetrics.io",
            port: 443,
            bufferingDelay: 5000,
            player: {}
        });

        // Build base URL
        if(!redmetrics.options.baseUrl) {
            redmetrics.options.baseUrl = redmetrics.options.protocol + "://" + redmetrics.options.host + ":" + redmetrics.options.port;
        }

        if(!redmetrics.options.gameVersionId) {
            throw new Error("Missing options.gameVersionId");
        }

        function getStatus() {
            return Q.xhr.get(redmetrics.options.baseUrl + "/status").fail(function(error) {
                redmetrics.connected = false;
                throw new Error("Cannot connect to RedMetrics server", redmetrics.options.baseUrl);
            });
        }

        function checkGameVersion() {
            return Q.xhr.get(redmetrics.options.baseUrl + "/v1/gameVersion/" + redmetrics.options.gameVersionId).fail(function(error) {
                redmetrics.connected = false;
                throw new Error("Invalid gameVersionId");
            });
        }

        function createPlayer() {
            return Q.xhr({
                url: redmetrics.options.baseUrl + "/v1/player/",
                method: "POST",
                data: JSON.stringify(redmetrics.options.player),
                contentType: "application/json"
            }).then(function(result) {
                redmetrics.connected = true;
                playerId = result.data.id;

                postDeferred = Q.defer();

                // Start sending events
                timerId = window.setInterval(sendData, redmetrics.options.bufferingDelay)
            }).fail(function(error) {
                redmetrics.connected = false;
                throw new Error("Cannot create player: " + error);
            });
        }

        return getStatus().then(checkGameVersion).then(createPlayer);
    };

    redmetrics.disconnect = function() {
        // TODO: flush event queue ?

        // Reset state 
        redmetrics.connected = false;
        redmetrics.options = {};
        playerId = null;
        eventQueue = [];

        if(timerId) {
            window.clearInterval(timerId);
            timerId = null;
        }

        if(postDeferred) {
            postDeferred.reject(new Error("RedMetrics was disconnected by user"));
            postDeferred = null;
        }

        // Return empty promise
        return Q.fcall(function() {}); 
    };

    redmetrics.postEvent = function(event) {
        if(!redmetrics.connected) throw new Error("RedMetrics is not connected");

        if(event.section && _.isArray(event.section)) {
            event.section = event.section.join(".");
        }

        eventQueue.push(_.extend(event, {
            gameVersion: redmetrics.options.gameVersionId,
            player: playerId,
            userTime: getUserTime()
        }));

        return postDeferred.promise;
    };

    redmetrics.postSnapshot = function(snapshot) {
        if(!redmetrics.connected) throw new Error("RedMetrics is not connected");

        if(snapshot.section && _.isArray(snapshot.section)) {
            snapshot.section = snapshot.section.join(".");
        }

        snapshotQueue.push(_.extend(snapshot, {
            gameVersion: redmetrics.options.gameVersionId,
            player: playerId,
            userTime: getUserTime()
        }));

        return postDeferred.promise;
    };

    redmetrics.updatePlayer = function(player) {
        if(!redmetrics.connected) throw new Error("RedMetrics is not connected");

        return Q.xhr({
            url: redmetrics.options.baseUrl + "/v1/player/" + playerId,
            method: "PUT",
            data: JSON.stringify(redmetrics.options.player),
            contentType: "application/json"
        }).then(function() {
            redmetrics.options.player = player;
            return redmetrics.options.player;
        }).fail(function(error) {
            throw new Error("Cannot update player:", error)
        });
    }

    return redmetrics;
}));


/*
    SNAPSHOT_FRAME_DELAY = 60 # Only record a snapshot every 60 frames

    eventQueue = []
    snapshotQueue = []
    timerId = null
    playerId = null
    playerInfo = {} # Current state of player 
    snapshotFrameCounter = 0 ## Number of frames since last snapshot

    configIsValid = -> options.metrics and options.metrics.gameVersionId and options.metrics.host 

    sendResults = ->
        sendEvents()
        sendSnapshots()

    sendEvents = ->
        if eventQueue.length is 0 then return 

        # Send AJAX request
        jqXhr = $.ajax 
        url: options.metrics.host + "/v1/event/" 
        type: "POST"
        data: JSON.stringify(eventQueue)
        processData: false
        contentType: "application/json"

        # Clear queue
        eventQueue = []

    sendSnapshots = ->
        if snapshotQueue.length is 0 then return 

        # Send AJAX request
        jqXhr = $.ajax 
        url: options.metrics.host + "/v1/snapshot/" 
        type: "POST"
        data: JSON.stringify(snapshotQueue)
        processData: false
        contentType: "application/json"

        # Clear queue
        snapshotQueue = []

    io =
        enterPlaySequence: ->
        if not configIsValid() then return 

        # Reset snapshot counter so that it will be sent on the first frame
        snapshotFrameCounter = SNAPSHOT_FRAME_DELAY

        # Create player
        jqXhr = $.ajax 
            url: options.metrics.host + "/v1/player/"
            type: "POST"
            data: "{}"
            processData: false
            contentType: "application/json"
        jqXhr.done (data, textStatus) -> 
            playerId = data.id
            # Start sending events
            timerId = window.setInterval(sendResults, 5000)
        jqXhr.fail (__, textStatus, errorThrown) -> 
            throw new Error("Cannot create player: #{errorThrown}")
 
        leavePlaySequence: -> 
        # If metrics session was not created then ignore
        if not playerId then return

        # Send last data before stopping 
        sendResults()

        # Stop sending events
        window.clearInterval(timerId)
        playerId = null

        provideData: -> 
        global: 
            events: []
            player: playerInfo

        establishData: (ioData, additionalData) -> 
        # Only send data in play sequence
        if not playerId then return 

        # Contains updated playerInfo if necessary
        newPlayerInfo = null
        userTime = new Date().toISOString()

        # Expecting a format like { player: {}, events: [ type: "", section: [], coordinates: [], customData: }, ... ] }
        for circuitId in _.pluck(options.circuitMetas, "id") 
            # Collate all data into the events queue (disregard individual circuits)

            # Set game version and player IDs on events
            for event in ioData[circuitId].events
            # If event section is array, change it to a dot.separated string
            if event.section and _.isArray(event.section)
                event.section = event.section.join(".")

            eventQueue.push _.extend event, 
                gameVersion: options.metrics.gameVersionId
                player: playerId
                userTime: userTime

            if snapshotFrameCounter++ >= SNAPSHOT_FRAME_DELAY
            # Reset snapshot counter
            snapshotFrameCounter = 0

            # Send input memory and input IO data as snapshots
            snapshotQueue.push 
                gameVersion: options.metrics.gameVersionId
                player: playerId
                userTime: userTime
                customData:
                inputIo: additionalData.inputIoData
                memory: additionalData.memoryData

            # Update player info
            if not _.isEqual(ioData[circuitId].player, playerInfo) 
            newPlayerInfo = ioData[circuitId].player

        # Update player info if necessary
        if newPlayerInfo
            jqXhr = $.ajax 
            url: options.metrics.host + "/v1/player/" + playerId
            type: "PUT"
            data: JSON.stringify(newPlayerInfo)
            processData: false
            contentType: "application/json"
            playerInfo = newPlayerInfo

        return null # avoid accumulating results

        destroy: -> # NOP

    return io
*/