const webcamVideo = document.getElementById('webcamVideo');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const startButton = document.getElementById('startButton');
// Référence à la nouvelle zone de texte pour les logs
const statusLogElement = document.getElementById('statusLog');
// La barre de paragraphe reste pour le statut actuel si vous le souhaitez, sinon vous pouvez la retirer
const statusElement = document.getElementById('status');

let model;
let intervalId;

// Dimensions du canvas (peuvent être ajustées)
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
statusElement.textContent = 'Hello';
alert("hello");
outputCanvas.width = CANVAS_WIDTH;
outputCanvas.height = CANVAS_HEIGHT;
