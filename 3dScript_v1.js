const webcamVideo = document.getElementById('webcamVideo');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const startButton = document.getElementById('startButton');
const statusElement = document.getElementById('status');
let model;
let intervalId;

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
        statusElement.textContent = 'Statut : Images 3D chargées. Prêt.';
    }
}

imageLeft.onload = imageLoaded;
imageRight.onload = imageLoaded;
imageLeft.onerror = () => { statusElement.textContent = 'Erreur: Impossible de charger l\'image gauche.'; };
imageRight.onerror = () => { statusElement.textContent = 'Erreur: Impossible de charger l\'image droite.'; };


// Fonction pour initialiser et démarrer la webcam
async function setupWebcam() {
    statusElement.textContent = 'Statut : Démarrage de la webcam...';
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
        statusElement.textContent = `Erreur: Accès à la webcam refusé ou impossible. (${error.name})`;
        alert('Impossible d\'accéder à la webcam. Assurez-vous qu\'elle est connectée et que vous avez accordé la permission.');
    }
}

// Fonction pour charger le modèle FaceMesh
async function loadFaceMeshModel() {
    statusElement.textContent = 'Statut : Chargement du modèle FaceMesh...';
    const detectorConfig = {
        // MODIFIEZ CETTE LIGNE
        runtime: 'tfjs', // Ancien: 'mediapipe'
        // solutionPath n'est plus nécessaire avec le runtime 'tfjs'
        // solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
    };
    try {
        model = await faceLandmarksDetection.createDetector(faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh, detectorConfig);
        statusElement.textContent = 'Statut : Modèle FaceMesh chargé.';
        console.log('FaceMesh model loaded successfully with TFJS runtime.');
    } catch (error) {
        console.error('Erreur lors du chargement du modèle FaceMesh:', error);
        statusElement.textContent = `Erreur: Impossible de charger le modèle FaceMesh. (${error.message})`;
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

    // Vérifier si des visages sont détectés
    if (predictions.length > 0) {
        // Pour cet exemple, on prend le premier visage détecté
        const face = predictions[0];

        // Vérifier la visibilité des yeux.
        // C'est une simplification. En réalité, on analyserait les points des yeux.
        // Si FaceMesh détecte suffisamment de points dans la région d'un œil,
        // on considère qu'il est "visible".
        // La librairie Face Landmarks Detection ne donne pas directement un booléen isOccluded.
        // Il faut le déduire de la présence et de la confiance des landmarks.
        // Pour simplifier, nous allons juste vérifier si les points clés des yeux sont "détectés" avec une certaine confiance.

        // Une approche plus robuste serait de vérifier la présence des points clés de l'œil et leur score de détection.
        // FaceMesh donne des points avec des coordonnées (x,y,z) et une `visibility` (confiance de détection).
        // Si la visibilité est faible ou si les points sont aberrants, l'œil est probablement masqué.

        // Pour cet exemple, nous allons simplifier :
        // Si FaceMesh ne détecte pas le visage du tout, alors aucun œil n'est visible.
        // Si un visage est détecté, nous allons supposer que les yeux sont visibles s'ils sont dans le champ de vision.
        // Une implémentation réelle devrait analyser les landmarks spécifiques de chaque œil pour l'occlusion.

        // --- Stratégie simplifiée pour la détection des yeux ---
        // Considérons un œil visible si un nombre suffisant de ses points clés sont détectés avec une bonne confiance.
        // FaceMesh retourne un tableau de 468 landmarks.
        // Les indices pour les yeux sont spécifiques, par exemple :
        // Œil gauche (vu de l'utilisateur) : indices 33, 7, 163, 144, 145, 153, 154, 155, 133...
        // Œil droit (vu de l'utilisateur) : indices 362, 382, 381, 380, 374, 373, 390, 249...
        // (Ces indices sont des exemples, consultez la documentation FaceMesh pour les indices exacts et un ensemble complet)

        // Pour une approche rapide, on peut vérifier la présence de landmarks clés des yeux.
        // Si le modèle détecte un visage, il fournira un tableau `mesh` de landmarks.
        // On peut vérifier si les landmarks d'une région spécifique (comme l'œil) sont présents et cohérents.

        // Placeholder pour la logique de détection d'occlusion basée sur les landmarks :
        const getEyeVisibility = (eyeLandmarks) => {
            let visibleCount = 0;
            const threshold = 0.8; // Seuil de visibilité (confiance) pour un point
            const minPointsForVisibility = eyeLandmarks.length * 0.5; // Ex: 50% des points de l'œil doivent être visibles

            for (const index of eyeLandmarks) {
                if (face.mesh[index] && face.mesh[index][2] > threshold) { // Z-coordinate is depth, or use face.mesh[index].visibility if available
                    visibleCount++;
                }
            }
            return visibleCount >= minPointsForVisibility;
        };

        // Note: Les indices exacts des landmarks pour FaceMesh peuvent être trouvés dans la documentation ou en les visualisant.
        // Pour cet exemple, je vais utiliser un proxy simple: si un visage est détecté, les deux yeux sont "initialement" visibles.
        // Une implémentation réelle devrait raffiner cela.
        leftEyeVisible = true; // Assume visible si un visage est détecté
        rightEyeVisible = true; // Assume visible si un visage est détecté

        // *** IMPORTANT ***
        // Ici, vous devrez implémenter une logique plus sophistiquée pour détecter l'occlusion.
        // Par exemple, si la "visibilité" (face.mesh[index][2] ou autre métrique) des points clés de l'œil tombe sous un certain seuil,
        // ou si un groupe de points clés de l'œil n'est pas détecté du tout.
        // Vous pouvez aussi analyser la profondeur (Z-coordinate) des points de la main si vous voulez réintroduire la détection de main,
        // mais comme discuté, la seule détection de l'occlusion est plus simple.

        // Une approche plus robuste pour l'occlusion serait d'utiliser un modèle spécifique ou d'analyser les relations géométriques
        // entre les points détectés. Si les points de l'œil sont incohérents ou absents, l'œil est occlus.

        // Exemple simplifié d'occlusion (à améliorer) :
        // Si le nombre de points détectés pour l'œil gauche est très faible, on suppose qu'il est masqué.
        // C'est très basique et pourrait nécessiter un seuil de confiance plus fin.
        if (predictions[0].scaledMesh) { // scaledMesh contient les 468 points si détectés
            // Vérifiez la "confiance" ou la présence des points de l'œil.
            // Ce sont des indices simplifiés. Vous devriez utiliser des groupes d'indices précis.
            const sampleLeftEyePoint = predictions[0].scaledMesh[133]; // Exemple d'un point de l'œil gauche
            const sampleRightEyePoint = predictions[0].scaledMesh[362]; // Exemple d'un point de l'œil droit

            // Si le point n'est pas détecté ou sa confiance est très basse, considérez l'œil masqué.
            // La "visibilité" ou "confiance" d'un point est souvent la 3ème coordonnée (z) ou une propriété spécifique.
            const visibilityThreshold = 0.1; // Ajustez ce seuil
            if (!sampleLeftEyePoint || sampleLeftEyePoint[2] < visibilityThreshold) { // [2] est la coordonnée Z (profondeur) ou confiance
                leftEyeVisible = false;
            }
            if (!sampleRightEyePoint || sampleRightEyePoint[2] < visibilityThreshold) {
                rightEyeVisible = false;
            }
        }
    } else {
        // Aucun visage détecté
        leftEyeVisible = false;
        rightEyeVisible = false;
    }

    // Effacer le canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Appliquer les règles d'affichage
    if (leftEyeVisible && !rightEyeVisible) {
        // Œil gauche visible seulement -> afficher image gauche
        ctx.drawImage(imageLeft, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        statusElement.textContent = 'Statut : Œil gauche visible (Image Gauche)';
    } else if (!leftEyeVisible && rightEyeVisible) {
        // Œil droit visible seulement -> afficher image droite
        ctx.drawImage(imageRight, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        statusElement.textContent = 'Statut : Œil droit visible (Image Droite)';
    } else {
        // Les deux yeux visibles ou aucun œil visible
        const twoEyesMode = document.querySelector('input[name="twoEyesMode"]:checked').value;

        if (twoEyesMode === 'black') {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            statusElement.textContent = 'Statut : Deux yeux visibles (Écran Noir)';
        } else if (twoEyesMode === 'sidebyside') {
            // Afficher les deux images côte à côte
            ctx.drawImage(imageLeft, 0, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT);
            ctx.drawImage(imageRight, CANVAS_WIDTH / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT);
            statusElement.textContent = 'Statut : Deux yeux visibles (Côté à Côte)';
        } else if (twoEyesMode === 'mono') {
            // Afficher une seule image (par exemple, la gauche)
            ctx.drawImage(imageLeft, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            statusElement.textContent = 'Statut : Deux yeux visibles (Image Unique)';
        }
        // Pas de mode de "fondue", car cela nécessiterait un blending d'images plus complexe et n'aurait pas de sens pour la 3D sans lunettes.
    }

    // Demander la prochaine frame d'animation
    requestAnimationFrame(detectAndDraw);
}

// Événement au clic du bouton de démarrage
startButton.addEventListener('click', async () => {
    if (!model) {
        await loadFaceMeshModel();
    }
    await setupWebcam();
    // Démarrer la boucle de détection après que la webcam soit prête
    webcamVideo.addEventListener('loadeddata', () => {
        if (!intervalId) { // Empêche de démarrer plusieurs boucles
            detectAndDraw();
            statusElement.textContent = 'Statut : Webcam démarrée. Détection en cours...';
        }
    });
});

// Initialisation au chargement de la page
window.onload = () => {
    statusElement.textContent = 'Statut : Prêt à charger les modèles et démarrer.';
    // Pré-charger le modèle peut prendre du temps, donc on le fait au clic sur le bouton pour une meilleure UX.
};
