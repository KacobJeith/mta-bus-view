const functions = require('firebase-functions');
const Video = require('@google-cloud/video-intelligence').v1p2beta1;
var admin = require("firebase-admin");

admin.initializeApp(functions.config().firebase);

exports.processVideo = functions.https.onRequest(async function (_request, response) {
	console.log('Beginning video process...' + _request.query.filename);
 	const saveName = _request.query.filename.split('.');
 	console.log('saving to: '+ saveName[0]);


  	const video = new Video.VideoIntelligenceServiceClient();

 	const gcsUri = 'gs://mta-bus-view-originals.appspot.com/' + _request.query.filename;

 	const request = {
 	  inputUri: gcsUri,
 	  features: ['OBJECT_TRACKING'],
 	  locationId: 'us-east1',
 	};

 	console.log('Waiting for operation to complete...');

 	// Detects objects in a video
 	const [operation] = await video.annotateVideo(request);
 	const results = await operation.promise();

 	//Gets annotations for video
 	const annotations = results[0].annotationResults[0];

 	saveResultsToDatabase(annotations, saveName[0]);

 	response.send("Attempting to process the video!");
});

const saveResultsToDatabase = (annotations, savePath) => {
	admin.database().ref(savePath).set(annotations);					
}

exports.autoProcessVideo = functions.storage.bucket('mta-bus-view-originals').object().onFinalize(async function (object) {
	console.log('New File: ' + object.name);
	console.log('Processing Triggered');

	const video = new Video.VideoIntelligenceServiceClient();

	const gcsUri = 'gs://mta-bus-view-originals/' + object.name;

	const request = {
		inputUri: gcsUri,
		features: ['OBJECT_TRACKING'],
		locationId: 'us-east1',
	};

	console.log('Waiting for Video Intelligence Response...');

 	const [operation] = await video.annotateVideo(request);
 	const results = await operation.promise();
 	const annotations = results[0].annotationResults[0];

 	const saveName = object.name.split('.');
 	console.log('saving to: /annotations/'+ saveName[0]);

 	admin.database().ref('annotations/' + saveName[0]).set(annotations);
 	admin.database().ref('processQueue/').push().set({
	  annotationsPath: saveName[0],
	  gsPath: object.name
	});

});


