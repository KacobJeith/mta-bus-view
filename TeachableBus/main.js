// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import "@babel/polyfill";
import * as mobilenetModule from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

// Number of classes to classify
const NUM_CLASSES = 4;
// Webcam Image size. Must be 227. 
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 800*720/1280;
// K value for KNN
const TOPK = 10;


class Main {
  constructor() {
    // Initiate variables
    this.infoTexts = [];
    this.training = -1; // -1 when no class is being trained
    this.videoPlaying = false;
    this.videoSpeed = 1;

    // Initiate deeplearn.js math and knn classifier objects
    this.bindPage();

    this.csvOutput = [['Frame Time', 'Class Index']];
    this.video = document.createElement('video');
    this.video.setAttribute('controls', '');
    this.video.setAttribute('preload', 'none');

    // Add video element to DOM
    document.body.appendChild(this.video);

    this.video.src = "TheBus.mp4";
    this.videoName = "TheBus";
    this.video.playbackRate = this.videoSpeed;
    this.video.width = IMAGE_WIDTH;
    this.video.height = IMAGE_HEIGHT;

    this.video.addEventListener('playing', () => this.videoPlaying = true);
    this.video.addEventListener('paused', () => this.videoPlaying = false);

    var labels = [
      'Moving',
      'Stopped @ Bus Stop',
      'Stopped @ Intersection',
      'Stopped @ Obstruction'
    ]

    // Select Video
    const vidSelect = document.createElement('div');
    document.body.appendChild(vidSelect);
    vidSelect.style.marginBottom = '10px';

    var vidHandle = this.video;

    this.createInfoText(vidSelect, 'Select Video')
    this.addFileSelect('Select & Upload Video', (e) => {
      console.log('Selected Video: ', e.target.files[0])
      var name = e.target.files[0].name
      this.videoName = name.split('.').slice(0,1)[0];
      console.log(this.videoName)
      vidHandle.src = name;
      this.video.playbackRate = 10;
    })


    this.addButton(document.body, 'Toggle Video Speed', () => {
      if (this.videoSpeed == 1) {
        this.videoSpeed = 10;
        this.video.playbackRate = 10;
      } else {
        this.videoSpeed = 1;
        this.video.playbackRate = 1;
      }
    })
    
    //Select Model
    const classifierSelect = document.createElement('div');
    document.body.appendChild(classifierSelect);
    classifierSelect.style.marginBottom = '10px';
    
    this.createInfoText(classifierSelect, 'Select & Upload Model')
    this.addFileSelect('Select & Upload Model', (e) => this.load(e.target.files[0]))

    // Create training buttons and info texts    
    for (let i = 0; i < labels.length; i++) {
      const div = document.createElement('div');
      document.body.appendChild(div);
      div.style.marginBottom = '10px';

      // Create training button
      const button = document.createElement('button')
      button.innerText = labels[i];
      div.appendChild(button);

      // Listen for mouse events when clicking the button
      button.addEventListener('mousedown', () => this.training = i);
      button.addEventListener('mouseup', () => this.training = -1);

      this.createInfoText(div, " No examples added", (infoText) => this.infoTexts.push(infoText));
    }

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.style.marginBottom = '10px';

    // Create Download Model Button
    this.addButton(document.body, 'Download Model', () => this.save())
    this.addButton(document.body, 'Download Prediction CSV', () => this.processEntireVideo())
  }

  processEntireVideo() {
    
    //let csvContent = "data:text/csv;charset=utf-8" + this.csvOutput.map(row=>row.join(",")).join("\n");

    var lineArray = [];

    this.csvOutput.forEach(function (infoArray, index) {
      var line = infoArray.join(",");
      lineArray.push(line);//index == 0 ? "data:text/csv;charset=utf-8," + line : line);
    });

    var csvContent = lineArray.join("\n");
    
    // var encodedUri = encodeURI(csvContent);
    var name = this.videoName + '_predictions.csv';

    this.download(name, csvContent);
  }

  addButton(div, text, callback = () => {}) {
    const button = document.createElement('button')
    button.innerText = text;
    button.addEventListener('click', async () => {
      callback();
    })
    div.appendChild(button);
  }

  createInfoText(div, text, callback = () => {}) {
    // Create info text
    const infoText = document.createElement('span')
    infoText.innerText = text;
    div.appendChild(infoText);
    callback(infoText)
  }

  addFileSelect(text, callback) {
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    document.body.appendChild(div);

    // Create Download Model Button
    const button = document.createElement('input')
    button.type = 'file';
    button.style.marginBottom = '10px';
    button.innerText = text;
    button.addEventListener('change', (event) => { 
      callback(event)
    })
    document.body.appendChild(button);
    
  }

  save() {
    let dataset = this.knn.getClassifierDataset()
    var datasetObj = {}
    
    Object.keys(dataset).forEach((key) => {
      let data = dataset[key].dataSync();
      // use Array.from() so when JSON.stringify() it coverts to an array string e.g [0.1,-0.2...] 
      // instead of object e.g {0:"0.1", 1:"-0.2"...}
      datasetObj[key] = Array.from(data); 
    });

    let jsonStr = JSON.stringify(datasetObj)

    // localStorage.setItem("myKNN", jsonStr);
    this.download('trainedClassifier.knn', jsonStr, 'text/plain;charset=utf-8')
  }

  load(file) {
  
    var classifier = this.knn;

    this.readFileIntoMemory(file, function(fileInfo) {
      console.info("Read file " + fileInfo.name + " of size " + fileInfo.size);

      if (fileInfo) {
        var string = new TextDecoder("utf-8").decode(fileInfo.content);
        
        let tensorObj = JSON.parse(string)
        //covert back to tensor
        Object.keys(tensorObj).forEach((key) => {
          tensorObj[key] = tf.tensor(tensorObj[key], [tensorObj[key].length / 1000, 1000])
        })

        classifier.setClassifierDataset(tensorObj);
       }
  });
   
  
   
 }

 readFileIntoMemory (file, callback) {
  var reader = new FileReader();
  reader.onload = function () {
      callback({
          name: file.name,
          size: file.size,
          type: file.type,
          content: new Uint8Array(this.result)
       });
  };
  reader.readAsArrayBuffer(file);
}

  download(filename, text, encoding = '') {

    var element = document.createElement('a');
    var downloadData = new Blob([text], { type: encoding});//'text/plain;charset=utf-8' });
    var downloadURL = URL.createObjectURL(downloadData);
    element.setAttribute('href', downloadURL);
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
  }

  async bindPage() {
    this.knn = knnClassifier.create();
    this.mobilenet = await mobilenetModule.load();

    

    this.start();
  }

  start() {
    if (this.timer) {
      this.stop();
    }
    this.video.play();
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }

  stop() {
    this.video.pause();
    cancelAnimationFrame(this.timer);
  }

  async animate() {
    
    if (this.videoPlaying && this.video.paused == false) {
      // Get image data from video element
      const frame = this.video.currentTime
      const image = tf.fromPixels(this.video);

      let logits;
      // 'conv_preds' is the logits activation of MobileNet.
      const infer = () => this.mobilenet.infer(image, 'conv_preds');

      // Train class if one of the buttons is held down
      if (this.training != -1) {
        logits = infer();

        // Add current image to classifier
        this.knn.addExample(logits, this.training)
      }

      const numClasses = this.knn.getNumClasses();
      if (numClasses > 0 ) {

        // If classes have been added run predict
        logits = infer();
        const res = await this.knn.predictClass(logits, TOPK);
        // console.log('Prediction: ', res.classIndex)
        this.csvOutput.push([frame, res.classIndex])

        for (let i = 0; i < NUM_CLASSES; i++) {

          // The number of examples for each class
          const exampleCount = this.knn.getClassExampleCount();

          // Make the predicted class bold
          if (res.classIndex == i) {
            this.infoTexts[i].style.fontWeight = 'bold';
          } else {
            this.infoTexts[i].style.fontWeight = 'normal';
          }

          // Update info text
          if (exampleCount[i] > 0) {
            this.infoTexts[i].innerText = ` ${exampleCount[i]} examples - ${res.confidences[i] * 100}%`
          }
        }
      }

      // Dispose image when done
      image.dispose();
      if (logits != null) {
        logits.dispose();
      }
    }
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }
}

window.addEventListener('load', () => new Main());