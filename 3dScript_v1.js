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
statusElement.textContent = 'Hello';
// Dimensions du canvas (peuvent être ajustées)
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

outputCanvas.width = CANVAS_WIDTH;
outputCanvas.height = CANVAS_HEIGHT;

// Chargement des images 3D (remplacez par vos propres chemins !)
const imageLeft = new Image();
imageLeft.src = 'photos3d/gImgMer1.jpg'; // <-- REMPLACEZ CECI
const imageRight = new Image();
imageRight.src = 'photos3d/dImgMer1.jpg'; // <-- REMPLACEZ CECI

// Assurez-vous que les images sont chargées avant de les utiliser
let imagesLoaded = false;
let imagesToLoad = 2;

function imageLoaded() {
    imagesToLoad--;
    if (imagesToLoad === 0) {
        imagesLoaded = true;
        //statusElement.textContent = 'Statut : Images 3D chargées. Prêt.';
	updateStatusLog('Images 3D chargées. Prêt.');
    }
}

imageLeft.onload = imageLoaded;
imageRight.onload = imageLoaded;
imageLeft.onerror = () => { updateStatusLog('Erreur: Impossible de charger l\'image gauche.'); };
imageRight.onerror = () => { updateStatusLog('Erreur: Impossible de charger l\'image droite.'); };

// Nouvelle fonction pour mettre à jour le log de statut
function updateStatusLog(message) {
    const now = new Date();
    const timeString = now.toLocaleTimeString(); // Ex: 10:30:45 AM
    statusLogElement.value += `[${timeString}] ${message}\n`;
    // Faites défiler automatiquement vers le bas
    statusLogElement.scrollTop = statusLogElement.scrollHeight;
    // Mettre à jour aussi le statut court si vous le gardez
    statusElement.textContent = `Statut : ${message.split('\n')[0]}`; // Prend la première ligne du message
}


// Fonction pour initialiser et démarrer la webcam
async function setupWebcam() {
    updateStatusLog('Démarrage de la webcam...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamVideo.srcObject = stream;
        return new Promise((resolve) => {
            webcamVideo.onloadedmetadata = () => {
                webcamVideo.play();
                resolve();
            };
        });
    } catch (error) {
        console.error('Erreur d\'accès à la webcam:', error);
        updateStatusLog(`Erreur: Accès à la webcam refusé ou impossible. (${error.name} - ${error.message || ''})`);
        alert('Impossible d\'accéder à la webcam. Assurez-vous qu\'elle est connectée et que vous avez accordé la permission.');
    }
}

// Fonction pour charger le modèle FaceMesh
async function loadFaceMeshModel() {
    updateStatusLog('Chargement du modèle FaceMesh...');
    const detectorConfig = {
        // MODIFIEZ CETTE LIGNE
        runtime: 'tfjs', // Ancien: 'mediapipe'
        // solutionPath n'est plus nécessaire avec le runtime 'tfjs'
        // solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
    };
    try {
        model = await faceLandmarksDetection.createDetector(faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh, detectorConfig);
        updateStatusLog('Modèle FaceMesh chargé.');
        console.log('FaceMesh model loaded successfully with TFJS runtime.');
    } catch (error) {
        console.error('Erreur lors du chargement du modèle FaceMesh:', error);
        updateStatusLog(`Erreur: Impossible de charger le modèle FaceMesh. (${error.message})`);
    }
}


// Points clés des yeux pour FaceMesh (indices spécifiques des points du réseau FaceMesh)
// Ces indices peuvent varier légèrement selon les versions, mais ce sont les plus courants pour les contours des yeux.
const LEFT_EYE_LANDMARKS = Array.from({ length: 16 }, (_, i) => i + 33); // Ex: 33-48
const RIGHT_EYE_LANDMARKS = Array.from({ length: 16 }, (_, i) => i + 263); // Ex: 263-278
// Pour une détection plus robuste, on peut utiliser plus de points ou les points de la paupière.
// Il est souvent plus simple de se baser sur la présence d'une région globale de l'œil.

// Fonction principale de détection et d'affichage
async function detectAndDraw() {
    if (!model || !webcamVideo.srcObject || !imagesLoaded) {
        requestAnimationFrame(detectAndDraw);
        return;
    }

    // Effectuer la détection sur la frame actuelle de la vidéo
    const predictions = await model.estimateFaces(webcamVideo, { flipHorizontal: false });

    let leftEyeVisible = false;
    let rightEyeVisible = false;
    let currentStatusMessage = 'Deux yeux visibles (Écran Noir)'; // Statut par défaut si non modifié

    // Vérifier si des visages sont détectés
    if (predictions.length > 0) {
        // Pour cet exemple, on prend le premier visage détecté
        const face = predictions[0];

        // Ces indices sont des exemples basiques. Pour une détection d'occlusion robuste,
        // vous devriez analyser les groupes de points pour chaque œil et leur score de visibilité/confiance (la coordonnée Z).
        // Par exemple, si la moyenne des Z des points de l'œil est très faible, il est probablement occlus.
        const visibilityThreshold = 0.1; // Seuil de confiance pour la visibilité d'un point
        const minEyePointsForVisibility = 5; // Nombre minimum de points d'un œil pour le considérer visible

        // Exemples d'indices de points clés pour l'œil gauche et droit de FaceMesh
        // Ces listes ne sont pas exhaustives et peuvent nécessiter un ajustement précis
        // en fonction de la version exacte de FaceMesh et de vos besoins.
        // Utilisez une visualisation des 468 points pour affiner.
        const leftEyeRegionIndices = [
            33, 7, 163, 144, 145, 153, 154, 155, 133, // Contour externe
            246, 161, 160, 159, 158, 157, 173, // Contour interne
        ];
        const rightEyeRegionIndices = [
            362, 382, 381, 380, 374, 373, 390, 249, // Contour externe
            466, 388, 387, 386, 385, 384, 398, // Contour interne
        ];


        const checkEyeVisibility = (faceMesh, indices) => {
            let detectedPointsCount = 0;
            for (const idx of indices) {
                // Le FaceMesh retourne un tableau de 3 éléments [x, y, z]. Z peut représenter la profondeur ou la confiance/visibilité
                if (faceMesh[idx] && faceMesh[idx][2] > visibilityThreshold) {
                    detectedPointsCount++;
                }
            }
            return detectedPointsCount >= minEyePointsForVisibility;
        };

        if (face.scaledMesh) { // Vérifie si les points détaillés sont disponibles
            leftEyeVisible = checkEyeVisibility(face.scaledMesh, leftEyeRegionIndices);
            rightEyeVisible = checkEyeVisibility(face.scaledMesh, rightEyeRegionIndices);
        } else {
             // Fallback si scaledMesh n'est pas disponible (cas rare ou erreur)
             // Dans ce cas, on assume que si un visage est détecté, les yeux sont "probablement" visibles.
             // C'est moins précis.
             leftEyeVisible = true;
             rightEyeVisible = true;
        }

    } else {
        // Aucun visage détecté
        currentStatusMessage = 'Aucun visage détecté.';
    }

    // Effacer le canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Appliquer les règles d'affichage
    if (leftEyeVisible && !rightEyeVisible) {
        // Œil gauche visible seulement -> afficher image gauche
        ctx.drawImage(imageLeft, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        currentStatusMessage = 'Œil gauche visible (Image Gauche)';
    } else if (!leftEyeVisible && rightEyeVisible) {
        // Œil droit visible seulement -> afficher image droite
        ctx.drawImage(imageRight, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        currentStatusMessage = 'Œil droit visible (Image Droite)';
    } else {
        // Les deux yeux visibles ou aucun œil visible
        const twoEyesMode = document.querySelector('input[name="twoEyesMode"]:checked').value;

        if (twoEyesMode === 'black') {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            // Le statut est déjà défini par défaut ou par "Aucun visage détecté"
        } else if (twoEyesMode === 'sidebyside') {
            // Afficher les deux images côte à côte
            ctx.drawImage(imageLeft, 0, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT);
            ctx.drawImage(imageRight, CANVAS_WIDTH / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT);
            currentStatusMessage = 'Deux yeux visibles (Côté à Côte)';
        } else if (twoEyesMode === 'mono') {
            // Afficher une seule image (par exemple, la gauche)
            ctx.drawImage(imageLeft, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            currentStatusMessage = 'Deux yeux visibles (Image Unique)';
        }
        // Pas de mode de "fondue", car cela nécessiterait un blending d'images plus complexe et n'aurait pas de sens pour la 3D sans lunettes.
    }

    // Mettre à jour le log seulement si le statut a changé
    // Pour éviter de spammer le log avec le même message
    if (statusElement.textContent !== `Statut : ${currentStatusMessage.split('\n')[0]}`) {
         updateStatusLog(currentStatusMessage);
    }


    // Demander la prochaine frame d'animation
    requestAnimationFrame(detectAndDraw);
}

// Événement au clic du bouton de démarrage
startButton.addEventListener('click', async () => {
    // Nettoyer le log précédent si on redémarre
    statusLogElement.value = '';
    updateStatusLog('Démarrage de l\'application...');

    if (!model) {
        await loadFaceMeshModel();
    }
    await setupWebcam();
    // Démarrer la boucle de détection après que la webcam soit prête
    webcamVideo.addEventListener('loadeddata', () => {
        if (!intervalId) { // Empêche de démarrer plusieurs boucles
            // On démarre la boucle de détection principale ici
            updateStatusLog('Webcam démarrée. Détection en cours...');
            detectAndDraw();
        }
    });
});

// Initialisation au chargement de la page
window.onload = () => {
    updateStatusLog('Page chargée. Prêt à démarrer.');
    // Mettre à jour le statut court initial
    statusElement.textContent = 'Statut : En attente de démarrage...';
    // Pré-charger le modèle peut prendre du temps, donc on le fait au clic sur le bouton pour une meilleure UX.
};
