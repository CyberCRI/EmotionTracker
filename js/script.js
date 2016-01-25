var vid = document.getElementById('videoel');
var overlay = document.getElementById('overlay');
var overlayCC = overlay.getContext('2d');
var sketchCanvas =document.getElementById('sketch');

var isTracked = false;
videoSizeX = 400;
videoSizeY = 300;
// clmtrackr.js line:651
wireFace = {
	lineWidth: 2,
	fillStyle: "rgb(200,200,200)",
	strokeStyle: "rgb(130,255,50)"
}
var isRecord = false;
actualPageEmotionData = {
	emotionValue: [0,0,0,0],
	iteration: 0
}
actualPageID = "";
groupEmotionData = [];

// param website (with redmetrics ID)
websiteID = "d08eb03e-1f07-496e-84c2-13392686d2e1";

vid.width = overlay.width = sketchCanvas.width = videoSizeX;
vid.height = overlay.height = sketchCanvas.height = videoSizeY;


/********** initiate and param redmetrics **********/

var options = { gameVersionId: websiteID };
redmetrics.connect(options).then(function() {
	console.log("Connected to the RedMetrics server");
});

function postResult(emotionArray,page) {
	redmetrics.postEvent({
		type: "emotions",
		section: page,
		customData: emotionArray
	});
}

function getPageData(pageID) {
	Q.xhr.get('https://api.redmetrics.io/v1/event?game=c48926c5-3ff7-4123-a6a8-fcebfa4fd92a&gameVersion=d08eb03e-1f07-496e-84c2-13392686d2e1&entityType=event'+'&section='+pageID).done(function(resp) {
		if(resp.data.length > 0){
			var tempArray = [];
			var tempIteration = 0;
			for(var i=0;i<resp.data.length;i++){
				// if(resp.data[i].section == pageID){ // double equal because you compare string with int

				// }
				if(i == 0){
					tempArray = resp.data[i].customData;
					tempIteration += 1;
				}
				else{
					var j = i;
					for(var z=0;z<resp.data[j].customData.length;z++){
						tempArray[z] += resp.data[j].customData[z];
					}
					tempIteration += 1;
				}
			}
			for(var i=0;i<tempArray.length;i++){
				tempArray[i] /= tempIteration;
			}
			groupEmotionData = tempArray;
			updateGroupInfo(groupEmotionData);
		}
		else{
			console.log('first user to record emotion on this page');
			updateGroupInfo(null)
		}
	})
}
// getPageData(1);

/********** check and set up video/webcam **********/

function enablestart() {
	var startbutton = document.getElementById('startbutton');
	startbutton.value = "start";
	startbutton.disabled = null;
}

/*var insertAltVideo = function(video) {
	if (supports_video()) {
		if (supports_ogg_theora_video()) {
			video.src = "../media/cap12_edit.ogv";
		} else if (supports_h264_baseline_video()) {
			video.src = "../media/cap12_edit.mp4";
		} else {
			return false;
		}
		//video.play();
		return true;
	} else return false;
}*/
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

// check for camerasupport
if (navigator.getUserMedia) {
	// set up stream
	
	var videoSelector = {video : true};
	if (window.navigator.appVersion.match(/Chrome\/(.*?) /)) {
		var chromeVersion = parseInt(window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10);
		if (chromeVersion < 20) {
			videoSelector = "video";
		}
	};

	navigator.getUserMedia(videoSelector, function( stream ) {
		if (vid.mozCaptureStream) {
			vid.mozSrcObject = stream;
		} else {
			vid.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
		}
		vid.play();
	}, function() {
		//insertAltVideo(vid);
		alert("There was some problem trying to fetch video from your webcam. If you have a webcam, please make sure to accept when the browser asks for access to your webcam.");
	});
} else {
	//insertAltVideo(vid);
	alert("This demo depends on getUserMedia, which your browser does not seem to support. :(");
}

vid.addEventListener('canplay', enablestart, false);

/*********** setup of emotion detection *************/

var ctrack = new clm.tracker({useWebGL : true});
ctrack.init(pModel);

function startVideo() {
	if(!isTracked){ // Start video tracking
		isTracked = true;
		// start video
		vid.play();
		// start tracking
		ctrack.start(vid);
		// start loop to draw face
		drawLoop();
		// start recording
		startRecording("machin");
		// start button value to "stop"
		document.getElementById('startbutton').value = "stop";
	}
	else if(isTracked){ // Stop video tracking
		document.getElementById('startbutton').value = "start";
		isTracked = false;
		console.log(stopRecording());
	}
}

function drawLoop() {
	if(isTracked){
		requestAnimFrame(drawLoop);
		overlayCC.clearRect(0, 0, videoSizeX, videoSizeY);
		//psrElement.innerHTML = "score :" + ctrack.getScore().toFixed(4);
		if (ctrack.getCurrentPosition()) {
			ctrack.draw(overlay);
		}
		var cp = ctrack.getCurrentParameters();
		var er = ec.meanPredict(cp);
		if (er) {
			if(isRecord){
				var tempEmotionValue = [];
				for(var i=0;i<er.length;i++){
					tempEmotionValue.push(er[i].value);
				}
				record(tempEmotionValue);
			}
			updateData(er);
			for (var i = 0;i < er.length;i++) {
				if (er[i].value > 0.4) {
					document.getElementById('icon'+(i+1)).style.visibility = 'visible';
				} else {
					document.getElementById('icon'+(i+1)).style.visibility = 'hidden';
				}
			}
		}
	}
	else if(!isTracked){
		// stop track
		ctrack.stop();
		// clear canvas
		overlayCC.clearRect(0, 0, videoSizeX, videoSizeY);
		// reset emotion value
		var cp = ctrack.getCurrentParameters();
		var er = ec.meanPredict(cp);
		for(var i=0;i<er.length;i++){
			er[i].value = 0;
		}
		if(er){
			updateData(er);
			// hide icons
			for(var i=0;i<er.length;i++) {
				document.getElementById('icon'+(i+1)).style.visibility = 'hidden';
			}
		}
	}
}

var ec = new emotionClassifier();
ec.init(emotionModel);
var emotionData = ec.getBlank();	

/************ d3 code for barchart *****************/

var margin = {top : 20, right : 10, bottom : 10, left : 20},
	width = 270 - margin.left - margin.right,
	height = 100 - margin.top - margin.bottom;

var barWidth = 30;

var formatPercent = d3.format(".0%");

var x = d3.scale.linear()
	.domain([0, ec.getEmotions().length]).range([margin.left, width+margin.left]);

var y = d3.scale.linear()
	.domain([0,1]).range([0, height]);

var svg = d3.select("#emotion_chart").append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)

svg.selectAll("rect").
  data(emotionData).
  enter().
  append("svg:rect").
  attr("x", function(datum, index) { return x(index); }).
  attr("y", function(datum) { return height - y(datum.value); }).
  attr("height", function(datum) { return y(datum.value); }).
  attr("width", barWidth).
  attr("fill", "#2d578b");

svg.selectAll("text.labels").
  data(emotionData).
  enter().
  append("svg:text").
  attr("x", function(datum, index) { return x(index) + barWidth; }).
  attr("y", function(datum) { return height - y(datum.value); }).
  attr("dx", -barWidth/2).
  attr("dy", "1.2em").
  attr("text-anchor", "middle").
  text(function(datum) { return datum.value;}).
  attr("fill", "white").
  attr("class", "labels");

svg.selectAll("text.yAxis").
  data(emotionData).
  enter().append("svg:text").
  attr("x", function(datum, index) { return x(index) + barWidth; }).
  attr("y", height).
  attr("dx", -barWidth/2).
  attr("text-anchor", "middle").
  attr("style", "font-size: 12").
  text(function(datum) { return datum.emotion;}).
  attr("transform", "translate(0, 18)").
  attr("class", "yAxis");

function updateData(data) {
	// update
	var rects = svg.selectAll("rect")
		.data(data)
		.attr("y", function(datum) { return height - y(datum.value); })
		.attr("height", function(datum) { return y(datum.value); });
	var texts = svg.selectAll("text.labels")
		.data(data)
		.attr("y", function(datum) { return height - y(datum.value); })
		.text(function(datum) { return datum.value.toFixed(1);});

	// enter 
	rects.enter().append("svg:rect");
	texts.enter().append("svg:text");

	// exit
	rects.exit().remove();
	texts.exit().remove();
}

function updateGroupInfo(data) {
	if(data == null){

	}
	else{
		
	}
}

/******** stats ********/

stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
document.getElementById('container').appendChild( stats.domElement );

// update stats on every iteration
document.addEventListener('clmtrackrIteration', function(event) {
	stats.update();
}, false);

/******** API recording ********/

function startRecording(pageID) {
	isRecord = true;
	actualPageID = pageID;
	for(var i=0;i<actualPageEmotionData.emotionValue.length;i++){
		actualPageEmotionData.emotionValue[i] = 0;
	}
	actualPageEmotionData.iteration = 0;
}

function stopRecording() {
	// create average of emotion on the session
	var tempEmotionValue = []
	for(var i=0;i<actualPageEmotionData.emotionValue.length;i++){
		tempEmotionValue.push(actualPageEmotionData.emotionValue[i]/actualPageEmotionData.iteration);
	}
	return tempEmotionValue;
}

function record(frameEmotion) { // Array of emotion on this frame
	for(var i=0;i<frameEmotion.length;i++){
		actualPageEmotionData.emotionValue[i] += frameEmotion[i];
		actualPageEmotionData.iteration += 1;
	}
}

window.onbeforeunload = function(){
	if(isRecord){
		var tempEmotionValue = stopRecording();
		postResult(tempEmotionValue,actualPageID);
	}
	else{
		console.log('test ok');
	}
}