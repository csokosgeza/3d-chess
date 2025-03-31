// Copyright (c) 2025 Csókosgéza
// Minden jog fenntartva. / All rights reserved.

console.log("%cSakk 3D Projekt v1.0 - Készítette: Csókosgéza", "color: blue; font-weight: bold;");

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Importálás a chessLogic.js-ből
// import * as TWEEN from '@tweenjs/tween.js'; // Győződj meg róla, hogy importálod a TWEEN-t!
// Importálás a chessLogic.js-ből
import {
    BOARD_SIZE as LOGIC_BOARD_SIZE,
    initializeBoard as logicInitializeBoard, // <<< Átneveztük
    getPieceAtSquare,                     // <<< ÚJ import (bár lehet, nem használjuk közvetlenül)
    getValidMoves,                        // <<< Meglévő import
    makeMove as logicMakeMove,            // <<< Átneveztük (régi makeInternalMove helyett)
    promotePawn as logicPromotePawn,      // <<< Átneveztük
    isKingInCheck                         // <<< ÚJ import
} from './chessLogic.js';
import { loadChessPieces } from './pieceLoader.js';

// --- Alap Beállítások ---
let pendingPromotionCoords = null; // Tárolja a {row, col, color}-t, ha promócióra várunk
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 12);
camera.lookAt(0, 0, 0);
const canvas = document.getElementById('chessCanvas');
const promotionPanel = document.getElementById('promotion-choice'); // <<< ÚJ REFERENCIA
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;


// --- Tábla és Bábuk Konstansok ---
const SQUARE_SIZE = 1.5;
const BOARD_SIZE = 8;
const BOARD_THICKNESS = 0.5;
const TOTAL_BOARD_DIM = SQUARE_SIZE * BOARD_SIZE;
const BOARD_OFFSET = TOTAL_BOARD_DIM / 2 - SQUARE_SIZE / 2;
const WHITE_SQUARE_COLOR = 0xe3dac9;
const BLACK_SQUARE_COLOR = 0x7c5a43;
// const WHITE_PIECE_COLOR = 0xffffff; // <<< RÉGI - Teljesen fehér
const WHITE_PIECE_COLOR = 0xe8e8e8;
const BLACK_PIECE_COLOR = 0x333333;
const SELECTED_EMISSIVE_COLOR = 0xffff00; // Sárga kiemelés
const PIECE_Y_OFFSET_KNIGHT = 0.75;

// --- Leütött Bábuk Gyűjtéséhez ---
let capturedWhiteMeshes = []; // Fehér által leütött fekete bábuk
let capturedBlackMeshes = []; // Fekete által leütött fehér bábuk

let checkHighlightMesh = null;

const CAPTURED_AREA_OFFSET_X = TOTAL_BOARD_DIM / 2 + SQUARE_SIZE * 1.5; // X távolság a táblától
const CAPTURED_START_Z_WHITE = -TOTAL_BOARD_DIM / 2; // Fehér gyűjtő zóna (lent) Z kezdőpozíció
const CAPTURED_START_Z_BLACK = TOTAL_BOARD_DIM / 2 - SQUARE_SIZE * 0.8; // Fekete gyűjtő zóna (fent) Z kezdőpozíció
const CAPTURED_SPACING = SQUARE_SIZE * 0.9; // Bábuk közti távolság a gyűjtőben

const boardSquares = []; // [row][col] = { mesh, center }
const pieces = []; // Lista a bábu mesh-ekről

// --- Játék Állapot ---
let currentPlayer = 'white'; // Fehér kezd
let selectedPiece = null; // Jelenleg kiválasztott bábu (mesh)
// --- Interakcióhoz Szükséges Változók ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(); // Egér pozíciója normalizált koordinátákban (-1 to +1)
let highlightedSquares = []; // Tároló a kiemelt mezőknek
let isAnimating = false;
let animationsPending = 0;
let isGameOver = false;
let lastMoveResult = null; //Az utolsó lépés eredményének tárolása

let pieceBaseModels = {};

// --- HTML Elemek Referenciái (ÚJ) ---
const statusElement = document.getElementById('game-status');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessageElement = document.getElementById('game-over-message');
const newGameButton = document.getElementById('new-game-button');

let originalLightIntensity = { ambient: 0.6, directional: 0.8 };


// --- Fények ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(8, 18, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

// renderer.shadowMap.type = THREE.PCFShadowMap; // Alapértelmezett, enyhe élsimítás
// VAGY próbáld ki ezt keményebb árnyékokhoz:
// renderer.shadowMap.type = THREE.BasicShadowMap;
// VAGY ezt lágyabbhoz (ezzel nem lesz kontrasztosabb):
// renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Válassz egy Tone Mapping algoritmust:
// renderer.toneMapping = THREE.NoToneMapping; // Legnagyobb kontraszt, de "kifújhat" vagy túl sötét lehet
// renderer.toneMapping = THREE.LinearToneMapping; // Lineáris, kevésbé kontrasztos
// renderer.toneMapping = THREE.ACESFilmicToneMapping; // Filmszerű, általában jó kompromisszum
// renderer.toneMapping = THREE.ReinhardToneMapping; // Másik opció
// renderer.toneMappingExposure = 1.4; // Ezzel finomhangolhatod a kiválasztott tone mapping fényerejét (általában 1.0 jó)


// --- Kamera Vezérlés ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 5;
controls.maxDistance = 30;
controls.target.set(0, 0, 0);

// y kiemelés és forgatás beállítása bábunként, fehéret kell beállítani
const PIECE_ADJUSTMENTS = {
    // Típus: { yOffset: emelés_mértéke, initialRotationY: alap_forgatás_radianban }
    pawn:   { yOffset: 0.75, initialRotationY: 0 },     // <<< Kísérletezz ezekkel az értékekkel!
    rook:   { yOffset: 0.75,    initialRotationY: 0 },     // Placeholder, ha nincs modell
    knight: { yOffset: 0.75, initialRotationY: Math.PI*0.5 },     // <<< A huszárhoz már beállított érték
    bishop: { yOffset: 0.75,    initialRotationY: 0 },     // Placeholder
    queen:  { yOffset: 0.75,    initialRotationY: 0 },     // Placeholder
    king:   { yOffset: 0.75,    initialRotationY: 0 }      // Placeholder
};
// Alapértelmezett forgatás feketének (általában 180 fokkal kell elfordítani az alaphoz képest)
const BLACK_ROTATION_Y = Math.PI;


// --- Sakktábla Létrehozása ---
function createBoard() {
    const boardGroup = new THREE.Group();
    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE, BOARD_THICKNESS, SQUARE_SIZE);
    for (let row = 0; row < BOARD_SIZE; row++) {
        boardSquares[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            const isWhite = (row + col) % 2 === 0;
            const color = isWhite ? WHITE_SQUARE_COLOR : BLACK_SQUARE_COLOR;
            const squareMaterial = new THREE.MeshStandardMaterial({ color: color });
            const squareMesh = new THREE.Mesh(squareGeometry, squareMaterial);
            const x = (col * SQUARE_SIZE) - BOARD_OFFSET;
            const z = (row * SQUARE_SIZE) - BOARD_OFFSET;
            const y = -BOARD_THICKNESS / 2;
            squareMesh.position.set(x, y, z);
            squareMesh.receiveShadow = true;
            squareMesh.userData.isSquare = true; // Jelöljük, hogy ez egy mező
            squareMesh.userData.row = row;
            squareMesh.userData.col = col;
            boardGroup.add(squareMesh);
            boardSquares[row][col] = {
                mesh: squareMesh,
                center: new THREE.Vector3(x, 0, z)
            };
        }
    }
    scene.add(boardGroup);
    console.log("Sakktábla létrehozva.");
}

// --- Helyettesítő Bábu Geometriák ---
const pieceGeometries = {
    pawn: new THREE.ConeGeometry(SQUARE_SIZE * 0.3, SQUARE_SIZE * 0.6, 16),
    rook: new THREE.CylinderGeometry(SQUARE_SIZE * 0.35, SQUARE_SIZE * 0.35, SQUARE_SIZE * 0.7, 16),
    knight: new THREE.BoxGeometry(SQUARE_SIZE * 0.4, SQUARE_SIZE * 0.8, SQUARE_SIZE * 0.4),
    bishop: new THREE.ConeGeometry(SQUARE_SIZE * 0.3, SQUARE_SIZE * 0.8, 16),
    queen: new THREE.SphereGeometry(SQUARE_SIZE * 0.4, 16, 16),
    king: new THREE.CylinderGeometry(SQUARE_SIZE * 0.4, SQUARE_SIZE * 0.3, SQUARE_SIZE * 0.9, 16)
};
Object.values(pieceGeometries).forEach(geom => {
    geom.translate(0, geom.parameters.height ? geom.parameters.height / 2 : (geom.parameters.radius || SQUARE_SIZE * 0.4), 0);
});
pieceGeometries.knight.translate(0, pieceGeometries.knight.parameters.height / 2, 0);
pieceGeometries.queen.translate(0, pieceGeometries.queen.parameters.radius, 0);

// --- Bábuk Anyagai ---
const whitePieceMaterial = new THREE.MeshStandardMaterial({ color: WHITE_PIECE_COLOR });
const blackPieceMaterial = new THREE.MeshStandardMaterial({ color: BLACK_PIECE_COLOR });

if (BOARD_SIZE !== LOGIC_BOARD_SIZE) {
    console.error("Tábla méret inkonzisztencia a script.js és chessLogic.js között!");
}

// --- Bábu Mesh Létrehozása (BŐVÍTETT LOGOLÁSSAL) ---
function createPieceMesh(type, color) {
    console.log(`[createPieceMesh] Indítás: type=${type}, color=${color}`); // <<< LOG
    const baseModel = pieceBaseModels[type];
    let pieceMesh = undefined; // <<< Kezdőérték explicit undefined

    if (baseModel && baseModel !== null) {
        // --- Modell Klónozása ---
        console.log(`[createPieceMesh] Modell létezik (${type}). Klónozás...`);
        try {
            pieceMesh = baseModel.clone(); // <<< Itt kap értéket (elvileg)
            console.log(`[createPieceMesh] Klónozás sikeres (${type}), pieceMesh:`, pieceMesh ? 'OK' : 'HIBA/undefined'); // <<< LOG

            if (!pieceMesh) {
                 console.error(`[createPieceMesh] HIBA: baseModel.clone() undefined/null értéket adott vissza ${type}-hoz!`);
                 return null; // Ha a klónozás mégis hibás, lépjünk ki
            }

            const material = (color === 'white') ? whitePieceMaterial.clone() : blackPieceMaterial.clone();
            console.log(`[createPieceMesh] Anyag klónozva (${type}), bejárás indul...`);
            pieceMesh.traverse((node) => {
                if (node.isMesh) {
                    node.material = material;
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            console.log(`[createPieceMesh] Anyag beállítva (${type}).`);

            // Alap userData
            pieceMesh.userData = {
                type: type, color: color, isPiece: true, isCaptured: false,
                originalEmissive: material.emissive.getHex(),
            };

        } catch (cloneError) {
             console.error(`[createPieceMesh] HIBA a modell klónozása közben (${type}):`, cloneError);
             return null; // Hiba esetén kilépünk
        }

    } else {
        // --- Placeholder Geometria Használata ---
        console.log(`[createPieceMesh] Modell nem található (${type}), placeholder használata...`);
        const geometry = pieceGeometries[type];
        if (!geometry) {
            console.error(`[createPieceMesh] HIBA: Placeholder geometria sem található ehhez: ${type}`);
            return null; // <<< Kilépés, ha geometria sincs
        }
        console.log(`[createPieceMesh] Placeholder geometria OK (${type}). Anyag klónozása...`);
        const material = (color === 'white') ? whitePieceMaterial.clone() : blackPieceMaterial.clone();
        console.log(`[createPieceMesh] Anyag klónozva (${type}), Mesh létrehozása...`);
        try {
            pieceMesh = new THREE.Mesh(geometry, material); // <<< Itt kap értéket
             console.log(`[createPieceMesh] Placeholder Mesh létrehozva (${type}), pieceMesh:`, pieceMesh ? 'OK' : 'HIBA/undefined'); // <<< LOG

            if (!pieceMesh) {
                 console.error(`[createPieceMesh] HIBA: new THREE.Mesh() undefined/null értéket adott vissza ${type}-hoz!`);
                 return null; // Ha a létrehozás mégis hibás, lépjünk ki
            }

            pieceMesh.castShadow = true;
            pieceMesh.userData = {
                type: type, color: color, isPiece: true, isCaptured: false,
                originalEmissive: material.emissive.getHex(),
            };
        } catch (meshError) {
             console.error(`[createPieceMesh] HIBA a placeholder Mesh létrehozása közben (${type}):`, meshError);
             return null; // Hiba esetén kilépünk
        }
    }

    // --- Ellenőrzés a kritikus sor előtt ---
    console.log(`[createPieceMesh] Elérve a 'visible' beállítása előtt (${type}), pieceMesh:`, pieceMesh ? 'DEFINED' : 'UNDEFINED/NULL'); // <<< KRITIKUS LOG

    // Ha valamiért mégis undefined/null, itt logoljuk és kilépünk
    if (!pieceMesh) {
        console.error(`[createPieceMesh] KRITIKUS HIBA: pieceMesh még mindig undefined/null a 'visible' beállítása előtt (${type})!`);
        return null;
    }

    // script.js:218 környéke
    pieceMesh.visible = true;
    console.log(`[createPieceMesh] 'visible' beállítva true-ra (${type}).`); // <<< LOG utána

    return pieceMesh;
}

// --- Bábuk Felállítása ---
// --- Bábuk Felállítása (Tisztított Verzió) ---
function setupPieces() {
    console.log("Bábuk felállítása...");
    // 1. Régi mesh-ek eltávolítása
    pieces.forEach(p => {
        if (p.parent) p.parent.remove(p);
        else scene.remove(p);
        // TODO: Opcionálisan dispose() hívások a geometria/anyag felszabadításához
    });
    pieces.length = 0; // Tömb ürítése

    // Kezdőállás definiálása
    const startPosition = [
        ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
        ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
        ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
    ];

    // Végigmegyünk a táblán
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const pieceType = startPosition[row][col];
            if (pieceType) { // Ha van bábu a startpozíción
                const pieceColor = row < 4 ? 'black' : 'white'; // Szín meghatározása

                // Bábu mesh létrehozása (modellel vagy placeholderrel)
                const pieceMesh = createPieceMesh(pieceType, pieceColor);

                // Ellenőrizzük, sikerült-e a mesh létrehozása
                if (!pieceMesh) {
                    console.error(` Kihagyva: Nem sikerült mesh-t létrehozni ehhez: ${pieceType} at (${row}, ${col})`);
                    continue; // Ugrás a következő mezőre
                }

                // --- Innentől tudjuk, hogy pieceMesh létezik ---

                pieceMesh.castShadow = true; // Árnyék beállítása

                // Megfelelő mező adatainak lekérése
                const squareData = boardSquares[row][col];
                if (squareData && squareData.center) {
                    // Pozíció beállítása
                    pieceMesh.position.copy(squareData.center);
                    // TODO: Y pozíció finomhangolása itt, ha a betöltött modellek origója nem a talpukon van
					// Dinamikus Y eltolás és Forgatás ---
                    const adjustment = PIECE_ADJUSTMENTS[pieceType] || { yOffset: 0, initialRotationY: 0 }; // Védőháló, ha nincs definiálva
					
					// Y eltolás alkalmazása
                    pieceMesh.position.y += adjustment.yOffset;
					
					// Forgatás alkalmazása (fekete kap plusz 180 fokot)
                    pieceMesh.rotation.y = adjustment.initialRotationY + (pieceColor === 'black' ? BLACK_ROTATION_Y : 0);

                    // boardCoords beállítása a userData-ban
                    pieceMesh.userData.boardCoords = { row: row, col: col };
					
					// if (pieceType === 'knight') {
					//  	if (pieceColor === 'black') {
					//  		pieceMesh.rotation.y = Math.PI*0.6; // 180 fok feketének
					//  	} else {
					//  		pieceMesh.rotation.y = Math.PI*1.6; // 0 fok fehérnek (vagy fordítva, ha kell)
					// 	    }
					//  }

                    // Hozzáadás a jelenethez és a listához
                    scene.add(pieceMesh); // Közvetlenül a scene-hez
                    pieces.push(pieceMesh);
                } else {
                     console.error(`Nem található squareData a (${row}, ${col}) pozícióhoz!`);
                }
            } // end if(pieceType)
        } // end for col
    } // end for row

    console.log("Bábuk felállítva.", pieces.length);
}

/**
 * Beállítja egy bábu objektum (Mesh vagy Group) összes belső mesh-ének
 * emissive színét.
 * @param {THREE.Object3D} pieceObject A bábu mesh-e vagy csoportja.
 * @param {number} hexColor A beállítandó emissive szín hexadecimális értéke (pl. 0xffff00).
 */
function setPieceEmissive(pieceObject, hexColor) {
    if (!pieceObject) return;

    pieceObject.traverse((node) => {
        if (node.isMesh && node.material) {
            // Fontos lehet ellenőrizni, hogy az anyagnak van-e emissive tulajdonsága
            if (node.material.emissive) {
                node.material.emissive.setHex(hexColor);
            } else {
                // Ha pl. MeshBasicMaterial lenne, aminek nincs, itt kezelhetnénk
                // console.warn("Az anyagnak nincs emissive tulajdonsága:", node.material.type);
            }
        }
    });
}

// --- Kiválasztást Kezelő Függvények ---
function selectPiece(pieceMesh) {
    if (!pieceMesh || !pieceMesh.userData?.boardCoords) return;
    // Régi kiválasztás megszüntetése, ha van
    if (selectedPiece && selectedPiece !== pieceMesh) {
        deselectPiece(selectedPiece);
    }
    selectedPiece = pieceMesh;
    //pieceMesh.material.emissive.setHex(SELECTED_EMISSIVE_COLOR);
	setPieceEmissive(pieceMesh, SELECTED_EMISSIVE_COLOR);
	const { row, col } = pieceMesh.userData.boardCoords; // <<< boardCoords használata
    console.log(`Kiválasztva: ${pieceMesh.userData.color} ${pieceMesh.userData.type} at (${row}, ${col})`);


    // --- Érvényes lépések lekérése és vizualizáció (KEZDET) ---
    const validMoves = getValidMoves(row, col, currentPlayer);
    selectedPiece.userData.validMoves = validMoves; // Eltároljuk a mesh-ben
    console.log("Érvényes lépések:", validMoves);
    visualizeValidMoves(validMoves);
}



function deselectPiece(pieceMesh) {
    if (!pieceMesh || !pieceMesh.userData) return;
    // pieceMesh.material.emissive.setHex(pieceMesh.userData.originalEmissive || 0x000000);
	
	const originalColor = pieceMesh.userData.originalEmissive !== undefined
                          ? pieceMesh.userData.originalEmissive
                          : 0x000000; // Alapértelmezett fekete
    setPieceEmissive(pieceMesh, originalColor);

    // Érvényes lépések vizualizációjának eltüntetése
    clearValidMoveVisuals(); // Új függvény
    if(pieceMesh.userData) pieceMesh.userData.validMoves = null; // Töröljük a tárolt lépéseket

    if (selectedPiece === pieceMesh) {
        selectedPiece = null;
        console.log("Kiválasztás megszüntetve.");
    }
}

// --- Érvényes Lépések Vizualizációja ---
const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4, side: THREE.DoubleSide });

function visualizeValidMoves(moves) {
    clearValidMoveVisuals(); // Előző kiemelések törlése

    moves.forEach(move => {
        const squareData = boardSquares[move.row][move.col];
        if (squareData && squareData.mesh) {
            // Egyszerű megoldás: Adjunk hozzá egy vékony síkot a mező fölé
            const highlightGeometry = new THREE.PlaneGeometry(SQUARE_SIZE * 0.9, SQUARE_SIZE * 0.9); // Kicsit kisebb
            const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);

            // Pozícionálás a mező közepére, kicsit a tábla fölé
            highlightMesh.position.copy(squareData.center);
            highlightMesh.position.y += BOARD_THICKNESS / 2 + 0.01; // Pont a tábla felszíne fölé
            highlightMesh.rotation.x = -Math.PI / 2; // Fektessük el

            scene.add(highlightMesh);
            highlightedSquares.push(highlightMesh); // Tároljuk, hogy később eltávolíthassuk
        }
    });
}

function clearValidMoveVisuals() {
    highlightedSquares.forEach(mesh => scene.remove(mesh));
    highlightedSquares = []; // Lista kiürítése
}

// --- Leütött Bábuk Gyűjtése ---
function collectCapturedPiece(pieceMesh, moveAnimDuration = 400) { // Elfogadja a lépés animáció idejét
    if (!pieceMesh || !pieceMesh.userData) {
        console.error("Invalid pieceMesh provided to collectCapturedPiece", pieceMesh);
        return;
    }
    console.log("Collecting captured piece:", pieceMesh.userData);

    const pieceData = pieceMesh.userData; // { type, color, boardCoords }
    const targetArray = pieceData.color === 'white' ? capturedBlackMeshes : capturedWhiteMeshes; // Fehér üti a feketét -> capturedBlackMeshes
    const index = targetArray.length;

    // Célpozíció kiszámítása a tábla mellett
	
	// ---korábbi kód
	
    const rows = Math.floor(index / 2); // 2 oszlopban gyűjtjük
    const cols = index % 2;
    const sideMultiplier = (pieceData.color === 'white') ? 1 : -1; // Fehér ütött bábuk jobbra, feketék balra

    const targetX = sideMultiplier * CAPTURED_AREA_OFFSET_X + cols * CAPTURED_SPACING * sideMultiplier * 0.6; // Oszlopok egymás mellett
    const targetZ = (pieceData.color === 'white' ? CAPTURED_START_Z_BLACK : CAPTURED_START_Z_WHITE) + rows * CAPTURED_SPACING; // Sorok egymás alatt/felett
    //Fekete által ütött fehér: CAPTURED_START_Z_WHITE (tábla alja felé)
    // Fehér által ütött fekete: CAPTURED_START_Z_BLACK (tábla teteje felé)

	//---korábbi kód vége

	//const rows = Math.floor(index / 8); // <<< Módosítás: Hányadik sorban lesz (pl. 8 bábu/sor)
    // const cols = index % 8;             // <<< Módosítás: Hányadik oszlopban
    // const sideMultiplier = (pieceData.color === 'white') ? 1 : -1; // Eredeti ötlet
    // Legyen inkább fixen: Fehér ütött (fekete) bal oldalon, Fekete ütött (fehér) jobb oldalon
    // const sideX = TOTAL_BOARD_DIM / 2 + SQUARE_SIZE * 1.5; // Alap X távolság
    // const targetX = (pieceData.color === 'black') ? -sideX : sideX; // Fekete balra (-X), Fehér jobbra (+X)
    // Rendezés fentről lefelé mindkét oldalon
    // const targetZ = (TOTAL_BOARD_DIM / 2 - SQUARE_SIZE / 2) - rows * CAPTURED_SPACING;
    // Oszlopok egymás mellett (finomíthatod a spacing-et)
    // const finalX = targetX + (pieceData.color === 'black' ? -1 : 1) * cols * CAPTURED_SPACING * 0.6;
    // const targetY = BOARD_THICKNESS / 2 + 0.01; // Kicsit a tábla felett
	
	const adjustment = PIECE_ADJUSTMENTS[pieceData.type] || { yOffset: 0 };
	let targetY = BOARD_THICKNESS / 2 + 0.01; // Alap Y eltolás (nagyon pici) a tábla felszíne felett
	targetY += adjustment.yOffset; // Hozzáadjuk a bábu specifikus eltolását
	// if (pieceData.type === 'knight' || pieceData.type === 'pawn') {
        // Győződj meg róla, hogy a PIECE_Y_OFFSET_KNIGHT konstans elérhető itt
    //    targetY += PIECE_Y_OFFSET_KNIGHT; // <<< HOZZÁADJUK A HUSZÁR OFFSETJÉT
    //    console.log(`Applying knight Y-offset (${PIECE_Y_OFFSET_KNIGHT}) to captured position.`);
    
	
    // Itt lehetne `else if (pieceData.type === 'bishop') { targetY += BISHOP_OFFSET; }` stb., ha más modelleknek is kell
    const finalPosition = new THREE.Vector3(targetX, targetY, targetZ);
    const captureDuration = moveAnimDuration * 1.2; // Lehet picit rövidebb/hosszabb, mint a lépés

    console.log(`Animating capture of ${pieceData.color} ${pieceData.type} to ${finalPosition.toArray().join(',')}`);

    // Animáció indítása
    new TWEEN.Tween(pieceMesh.position)
        .to(finalPosition, captureDuration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => {
            pieceMesh.position.copy(finalPosition);
            const targetArray = pieceMesh.userData.color === 'white' ? capturedBlackMeshes : capturedWhiteMeshes;
            targetArray.push(pieceMesh);
            // pieceMesh.visible = false; // Alternatíva: elrejtés helyett mozgatás
            pieceMesh.userData.isCaptured = true; // <<< Jelöljük ütöttnek
            delete pieceMesh.userData.boardCoords;
            console.log("Capture animation complete.");
            checkAnimationsComplete(); // <<< MEGHÍVJUK A SZÁMLÁLÓ CSÖKKENTÉSÉHEZ (üres objektum elég itt)
        })
        .start();
}

// --- ÚJ FÜGGVÉNY: Sakkban lévő király kiemelése ---
function highlightCheckedKing(playerColor) {
    // Előző kiemelés eltávolítása
    if (checkHighlightMesh) {
        scene.remove(checkHighlightMesh);
        checkHighlightMesh.geometry.dispose(); // Geometria erőforrás felszabadítása
        checkHighlightMesh.material.dispose(); // Anyag erőforrás felszabadítása
        checkHighlightMesh = null;
    }

    // Ha megadtak színt (tehát van kit kiemelni)
    if (playerColor) {
        // Keressük meg a megfelelő színű, aktív király mesh-ét a 'pieces' tömbben
        const kingMesh = pieces.find(p =>
            p.userData.type === 'king' &&
            p.userData.color === playerColor &&
            !p.userData.isCaptured // Csak a táblán lévő királyt
        );

        if (kingMesh && kingMesh.userData.boardCoords) {
            // Megvan a király mesh és annak koordinátái
            const { row, col } = kingMesh.userData.boardCoords;
            const squareData = boardSquares[row][col]; // Adatok a megfelelő mezőről

            if (squareData && squareData.mesh) {
                // Hozzuk létre a kiemelést (pl. vörös gyűrű)
                const highlightGeometry = new THREE.RingGeometry(SQUARE_SIZE * 0.4, SQUARE_SIZE * 0.55, 32);
                const highlightMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000, // Vörös
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6
                });
                checkHighlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);

                // Pozícionálás a király mezője fölé
                checkHighlightMesh.position.copy(squareData.center);
                checkHighlightMesh.position.y += BOARD_THICKNESS / 2 + 0.02; // Kicsit a tábla felett
                checkHighlightMesh.rotation.x = -Math.PI / 2; // Fektessük el

                scene.add(checkHighlightMesh); // Hozzáadás a jelenethez
                console.log(`Sakk kiemelve ${playerColor} királyánál: (${row}, ${col})`); // <<< Log a sikerességről
            } else {
                 console.warn(`Nem található a mező adatai/mesh-e a ${playerColor} király kiemeléséhez (${row}, ${col}).`);
            }
        } else {
             console.warn(`Nem található az aktív ${playerColor} király mesh-e a 'pieces' tömbben a sakk kiemeléséhez.`);
        }
    }
}

// --- ÚJ FÜGGVÉNY: Játék Vége Panel Megjelenítése ---
function showGameOverOverlay(message) {
    console.log("!!! showGameOverOverlay meghívva üzenettel:", message); // Ellenőrző log

    // Hivatkozások lekérése és ellenőrzése
    const overlayElement = document.getElementById('game-over-overlay');
    // <<< MÓDOSÍTÁS: Közvetlenül az ID alapján keressük az üzenet helyét >>>
    const messageElement = document.getElementById('game-over-message');

    if (!overlayElement ) {
        console.error("HIBA: Az 'game-over-overlay' HTML elem nem található!");
        return; // Kilépünk, ha nincs overlay
    }
    if (!messageElement) {
        // Ha az üzenet helye nincs meg, akkor is jelenítsük meg az overlayt, de logoljuk
        console.error("HIBA: Az 'game-over-message' HTML elem nem található az overlay-en belül! Az overlay megjelenik, de szöveg nélkül.");
    } else {
        // Üzenet beállítása (ha az elem megvan)
        // A \n sortörést a CSS `white-space: pre-line;` tulajdonsága kezeli majd
        messageElement.textContent = message;
        console.log("Overlay üzenet beállítva:", message);
    }

    // Panel megjelenítése (hidden class eltávolítása)
    overlayElement.classList.add('visible');
    console.log("Overlay 'hidden' class eltávolítva.");

    // Kamera mozgatás letiltása (ha a controls létezik)
    if (controls) controls.enabled = false;
    console.log("Overlay megjelenítve, Controls (ha van) letiltva.");
}

// --- ÚJ FÜGGVÉNY: Fények Halványítása ---
function dimLights(duration = 750) { // Animáció hossza ms-ban
    console.log("Fények halványítása...");
    // Mentsük az eredeti intenzitásokat, ha még nem történt meg
    // (Lehet, hogy ezt az initializeGame-ben kellene megtenni)
    // originalLightIntensity.ambient = ambientLight.intensity;
    // originalLightIntensity.directional = directionalLight.intensity;

    const dimFactor = 0.3; // Mennyire halványuljon (30%-ra)

    new TWEEN.Tween(ambientLight)
        .to({ intensity: originalLightIntensity.ambient * dimFactor }, duration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();

    new TWEEN.Tween(directionalLight)
        .to({ intensity: originalLightIntensity.directional * dimFactor }, duration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
}

// --- ÚJ FÜGGVÉNY: Fények Visszaállítása ---
function restoreLights(duration = 200) {
    console.log("Fények visszaállítása...");
    new TWEEN.Tween(ambientLight)
        .to({ intensity: originalLightIntensity.ambient }, duration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();

    new TWEEN.Tween(directionalLight)
        .to({ intensity: originalLightIntensity.directional }, duration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
}

// --- MÓDOSÍTÁS: Inicializáló függvény, hogy újraindítható legyen ---
function initializeGame() {
    console.log("Játék inicializálása / újraindítása...");

    // Állapotok resetelése
    isGameOver = false;
    isAnimating = false;
    animationsPending = 0;
    currentPlayer = 'white';
    selectedPiece = null;
    pendingPromotionCoords = null;
    capturedWhiteMeshes = []; // Ki kell üríteni a tömböket is
    capturedBlackMeshes = [];

    // Panelek elrejtése
    promotionPanel.classList.add('hidden');
    if (gameOverOverlay) {
        console.log("initializeGame: Overlay elrejtése ('hidden' class hozzáadása)..."); // <<< ÚJ LOG
        gameOverOverlay.classList.remove('visible');
    } else {
        console.warn("initializeGame: gameOverOverlay elem nem található az elrejtéshez."); // <<< ÚJ LOG
    }
    // Kamera vezérlés engedélyezése
    controls.enabled = true;
	
	// <<< ÚJ: Fények visszaállítása >>>
    restoreLights();

    // Logikai tábla resetelése
    logicInitializeBoard();

    // Vizuális tábla TÖRLÉSE ÉS ÚJRAÉPÍTÉSE
    // 1. Töröljük a régi bábukat és highlightokat
    clearValidMoveVisuals();
    if(checkHighlightMesh) {
        scene.remove(checkHighlightMesh);
        checkHighlightMesh = null;
    }
    // Töröljük az ÖSSZES bábut a scene-ből és a 'pieces' tömbből
    pieces.forEach(p => {
        if (p.parent) p.parent.remove(p); // Eltávolítás a szülőből
        else scene.remove(p);
        // Geometria/Anyag dispose itt is hasznos lehet, ha újratöltünk modelleket
    });
    pieces.length = 0; // Tömb kiürítése

    // 2. Hozzuk létre újra a bábukat a kezdőállás szerint
    setupPieces(); // Ez újra feltölti a 'pieces' tömböt és hozzáadja a scene-hez

    // 3. Kezdeti állapot kiírása
    updateGameStatus();
    console.log("Játék inicializálva. Kezdő játékos:", currentPlayer);
}

// --- ÚJ FÜGGVÉNY: Promóciós Panel Gombok Frissítése ---
function updatePromotionPanelButtons(color) {
    const buttons = promotionPanel.querySelectorAll('button');
    buttons.forEach(button => {
        const pieceType = button.dataset.promoteTo;
        // Itt beállíthatod a gomb szövegét (Unicode karakter) vagy háttérképét
        // Példa Unicode karakterrel:
        const pieceChar = getPieceUnicode(pieceType, color); // <<< Szükség lehet erre a segédfüggvényre
        button.textContent = pieceChar;
        // Vagy class hozzáadása a CSS-hez:
        // button.className = `promotion-button ${color} ${pieceType}`;
    });
}

// Segédfüggvény (ha még nincs):
function getPieceUnicode(type, color) {
    const map = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    // Promóciónál csak ezeket engedjük:
    if (['queen', 'rook', 'bishop', 'knight'].includes(type)) {
         return map[color]?.[type] || '?';
    }
    return '?'; // Vagy hiba jelzés
}

// --- Kattintás Eseménykezelő ---
function onClick(event) {
    if (isGameOver || isAnimating || pendingPromotionCoords) {
        console.log("Interaction blocked (Game Over / Animating / Promotion Pending).");
        return;
    }

    // Egér pozíció és Raycaster (változatlan)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Metszéspontok keresése (aktív bábukkal)
    const intersectsPieces = raycaster.intersectObjects(pieces.filter(p => p.userData && !p.userData.isCaptured && p.visible), true); // <<< Fontos: true a rekurzív kereséshez!

    let clickedPieceMesh = null; // Ebben tároljuk a bábu legfelső objektumát

    if (intersectsPieces.length > 0) {
        let intersectedObject = intersectsPieces[0].object;
        console.log("Raycaster hit:", intersectedObject.name, intersectedObject.type); // Logoljuk, mit talált el

        // --- MÓDOSÍTÁS KEZDETE: Keressük meg a szülőt a userData-val ---
        // Haladjunk felfelé a szülőkön, amíg meg nem találjuk a bábu fő objektumát,
        // amelyiknek van userData.isPiece tulajdonsága.
        while (intersectedObject && !intersectedObject.userData?.isPiece) {
            console.log("Traversing up to parent:", intersectedObject.parent?.name);
            intersectedObject = intersectedObject.parent;
            // Biztonsági kilépés, ha elértük a scene-t vagy nincs több szülő
            if (!intersectedObject || intersectedObject === scene) {
                 intersectedObject = null; // Nem találtuk meg a bábu objektumot
                 break;
            }
        }

        if (intersectedObject && intersectedObject.userData?.isPiece) {
             clickedPieceMesh = intersectedObject; // Megvan a bábu objektum, amin a userData van
             console.log("Found piece object:", clickedPieceMesh.userData);
        } else {
             console.log("Could not find parent object with piece userData.");
             // Lehet, hogy valami mást talált el, ami nem bábu
        }
        // --- MÓDOSÍTÁS VÉGE ---
    }

    // Innentől a 'clickedPieceMesh' változó (ha nem null) a helyes bábu objektumra mutat

    if (clickedPieceMesh) { // Ha találtunk egy bábut
        if (clickedPieceMesh.userData.color === currentPlayer) {
            // Saját bábura kattintás
            if (selectedPiece === clickedPieceMesh) {
                deselectPiece(clickedPieceMesh);
            } else {
                selectPiece(clickedPieceMesh);
            }
        } else if (selectedPiece) {
            // Ellenfél bábujára kattintás (Ütési kísérlet)
            if (clickedPieceMesh.userData.boardCoords) {
                const targetCoords = clickedPieceMesh.userData.boardCoords;
                console.log(`Ütési kísérlet: ${selectedPiece.userData.type} -> <span class="math-inline">\{clickedPieceMesh\.userData\.type\} at \(</span>{targetCoords.row}, ${targetCoords.col})`);
                tryMove(targetCoords);
            } else {
                console.warn("A kattintott ellenfél bábunak nincs boardCoords adata.");
            }
        }
    } else { // Nem bábut találtunk el
        // Mezőre vagy üres helyre kattintás logikája (változatlan)
        const boardMeshes = boardSquares.flat().map(sq => sq.mesh);
        const intersectsSquares = raycaster.intersectObjects(boardMeshes);

        if (intersectsSquares.length > 0 && selectedPiece) {
            // Üres mezőre kattintottunk, miközben van saját kiválasztva -> LÉPÉSI KÍSÉRLET
            const clickedSquareMesh = intersectsSquares[0].object;
            const targetCoords = { row: clickedSquareMesh.userData.row, col: clickedSquareMesh.userData.col };
             console.log(`Lépési kísérlet üres mezőre: ${selectedPiece.userData.type} -> (${targetCoords.row}, ${targetCoords.col})`);
            tryMove(targetCoords); // Átadjuk az objektumot
        } else if (selectedPiece) {
            // Üres helyre (nem mezőre) kattintás, miközben van kiválasztva -> Deszelektálás
            deselectPiece(selectedPiece);
        }
        // Ha nincs kiválasztott bábu és mezőre/üresre kattintunk, nem csinálunk semmit
    }
}

// --- Lépés Megkísérlése ---
// --- Lépés Megkísérlése (ÁTÍRT VERZIÓ) ---
function tryMove(targetCoords) {
    // Kezdeti ellenőrzések (animáció, kiválasztás, adatok)
    if (isAnimating || !selectedPiece || !selectedPiece.userData.boardCoords) {
        console.log("tryMove hívás érvénytelen állapotban (animáció / nincs kiválasztás / hiányzó boardCoords).");
        if (selectedPiece) {
            deselectPiece(selectedPiece); // Szín visszaállítása és highlight törlése
        }
        selectedPiece = null;
        return;
    }

    const startCoords = selectedPiece.userData.boardCoords;
    const pieceToMove = selectedPiece; // Referencia mentése a mesh-re

    // 1. Érvényes lépés keresése a tárolt lépések között
    const validMoves = pieceToMove.userData.validMoves || [];
    const moveData = validMoves.find(move => move.row === targetCoords.row && move.col === targetCoords.col);

    if (!moveData) {
        // Nem érvényes célmező
        console.log("Érvénytelen lépés a célmezőre:", targetCoords);
        deselectPiece(pieceToMove); // Kijelölés megszüntetése
        selectedPiece = null;
        return;
    }

    // 2. Logikai lépés végrehajtása
    console.log("Érvényes lépés, hívás: logicMakeMove", startCoords, targetCoords, moveData);
    const moveResult = logicMakeMove(startCoords.row, startCoords.col, targetCoords.row, targetCoords.col, moveData);

    if (!moveResult) {
        // Hiba a sakklogikában
        console.error("Hiba történt a logicMakeMove végrehajtása során!");
        deselectPiece(pieceToMove);
        selectedPiece = null;
        // Hiba esetén is fel kell oldani a lock-ot, ha esetleg be lett állítva korábban
        // Bár itt még nem állítottuk be, de biztonság kedvéért:
        isAnimating = false;
        animationsPending = 0;
        return;
    }

    // 3. Sikeres logikai lépés -> Animációk és állapotfrissítés
    console.log("logicMakeMove eredmény:", moveResult);
	lastMoveResult = moveResult; // Mentsük el a lépés eredményét a globális változóba
    isAnimating = true;          // Animációk elkezdődnek -> Lock
    clearValidMoveVisuals();     // Kiemelések eltüntetése
    selectedPiece = null;        // Logikai kijelölés megszüntetése (a pieceToMove referenciát még használjuk!)

    // Globális számláló kezelése -----
    animationsPending = 1; // <<< RESET: Mindig van legalább 1 animáció (a lépő bábu)

    const targetCenter = boardSquares[targetCoords.row][targetCoords.col].center.clone();
    const moveDuration = 400; // Animáció hossza (ms)
	
	// Dinamikus Y eltolás a CÉLBAN ---
	// A LÉPŐ bábu típusa alapján határozzuk meg az eltolást
	const adjustment = PIECE_ADJUSTMENTS[pieceToMove.userData.type] || { yOffset: 0 };
	const targetPositionWithOffset = targetCenter.clone();
	targetPositionWithOffset.y += adjustment.yOffset; // Alkalmazzuk az eltolást
	
	// if (pieceData.type === 'knight' || pieceData.type === 'pawn'){
	//  	targetPositionWithOffset.y += PIECE_Y_OFFSET_KNIGHT; // Hozzáadjuk a kívánt emelést
	

    // --- Animációk Indítása ---

    // a) Ütés Animáció (ha volt ütés)
    if (moveResult.capturedPiece) {
        const capturePos = moveResult.capturedPosition;
        const capturedMesh = pieces.find(p =>
            p.userData?.boardCoords &&
            p.userData.boardCoords.row === capturePos.row &&
            p.userData.boardCoords.col === capturePos.col &&
            p.uuid !== pieceToMove.uuid // Ne magát a lépő bábut
        );

        if (capturedMesh) {
            animationsPending++; // <<< INCREMENT: Plusz egy animáció indul
            console.log("Captured piece mesh found at:", capturePos, capturedMesh.userData.uuid);
            collectCapturedPiece(capturedMesh, moveDuration); // Ez a függvény hívja a checkAnimationsComplete-et
        } else {
            console.warn("Nem található az ütött bábu mesh-e a várt pozíción:", capturePos);
            // Ha nem találtuk, nem indult animáció, nem növeltük a számlálót
        }
    }

    // b) Sáncolás Bástya Animáció (ha volt sánc)
    let rookMesh = null; // Definiáljuk itt, hogy elérhető legyen az onComplete-ben is
    if (moveResult.isCastle && moveData.rookStartCol !== undefined && moveData.rookEndCol !== undefined) {
        const rookStartCoords = { row: startCoords.row, col: moveData.rookStartCol };
        const rookEndCoords = { row: startCoords.row, col: moveData.rookEndCol };
        rookMesh = pieces.find(p =>
            p.userData?.boardCoords &&
            p.userData.boardCoords.row === rookStartCoords.row &&
            p.userData.boardCoords.col === rookStartCoords.col
        );

        if (rookMesh) {
            animationsPending++; // <<< INCREMENT: Plusz egy animáció indul
            const rookTargetCenter = boardSquares[rookEndCoords.row][rookEndCoords.col].center.clone();
            console.log(`Animating rook for castling from ${rookStartCoords.col} to ${rookEndCoords.col}`);
            new TWEEN.Tween(rookMesh.position)
                .to(rookTargetCenter, moveDuration * 0.8) // Kicsit gyorsabb lehet
                .easing(TWEEN.Easing.Quadratic.Out)
                .onComplete(() => {
                    console.log("Rook animation complete.");
                    rookMesh.position.copy(rookTargetCenter);
                    // FONTOS: Frissítjük a bástya belső koordinátáit is!
                    rookMesh.userData.boardCoords = { ...rookEndCoords };
                    checkAnimationsComplete(moveResult); // Ellenőrizzük, kész van-e minden
                })
                .start();
        } else {
            console.error("Castling error: Rook mesh not found at", rookStartCoords);
            // Ha nem találtuk, nem indult animáció, nem növeltük a számlálót
        }
    }

    // c) Lépő Bábu Animációja (Ez mindig van)
    console.log(`Animating main piece ${pieceToMove.userData.type} to ${targetCoords.row},${targetCoords.col}`);
    new TWEEN.Tween(pieceToMove.position)
        .to(targetPositionWithOffset, moveDuration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => {
            console.log("Main piece animation complete.");
            pieceToMove.position.copy(targetPositionWithOffset);
            pieceToMove.userData.boardCoords = { ...targetCoords }; // Bábu koordinátáinak frissítése
			// itt kell beállítani az y értéket ha besüllyed a bábú
			// if (pieceToMove.userData.type === 'knight') { // Vagy pl. ['knight', 'bishop'].includes(...) ha több modell is süllyed
				// Ugyanazt az értéket használd, mint setupPieces-ben!
			//	pieceToMove.position.y += 0.75;
			//	console.log("Applied Y-offset after move for knight.");
			// }
			const originalColor = pieceToMove.userData.originalEmissive !== undefined
                                       ? pieceToMove.userData.originalEmissive
                                       : 0x000000;
            setPieceEmissive(pieceToMove, originalColor); // Helper használata!
            console.log("Piece emissive reset after move.");
			
            // Szín visszaállítása (emissive)
            // if (pieceToMove.material) {
            //     pieceToMove.material.emissive.setHex(pieceToMove.userData.originalEmissive || 0x000000);
            // }
            checkAnimationsComplete(); // Ellenőrizzük, kész van-e minden
        })
        .start();

}


// --- ÚJ FÜGGVÉNY: Animációk Befejezésének Ellenőrzése ---
//let animationsPending = 0; // Globális vagy a tryMove scope-jában kell lennie

function checkAnimationsComplete() {
	console.log("[checkAnimationsComplete] Using lastMoveResult:", JSON.stringify(lastMoveResult));

    animationsPending--;
    console.log("[checkAnimationsComplete] Animation completed, pending:", animationsPending);

    if (animationsPending <= 0) {
        console.log("[checkAnimationsComplete] All animations finished.");
        // Itt jön az animáció UTÁNI logika

        // 1. Promóció ellenőrzése
        if (lastMoveResult && lastMoveResult.promotionPending) {
            console.log("[checkAnimationsComplete] Promotion detected! Waiting for player choice.");
            pendingPromotionCoords = { ...lastMoveResult.promotionPending };
            // Szükséges beállítani a promóciós panel gombjainak kinézetét a megfelelő színnel!
            updatePromotionPanelButtons(pendingPromotionCoords.color); // <<< ÚJ FÜGGVÉNY kell ehhez
            if (promotionPanel) {
                promotionPanel.classList.remove('hidden');
			} else { console.error("Promotion panel not found!"); }
            // isAnimating marad true, amíg a játékos nem választ!
        } else {
			console.log("[checkAnimationsComplete] No promotion detected or missing move result. Switching player.");
            // 2. Nincs promóció -> Játékosváltás és állapotfrissítés
            switchPlayer(); // <<< ÚJ FÜGGVÉNY (vagy ide beírva)
            checkGameState(); // <<< ÚJ FÜGGVÉNY
			
            if (!isGameOver) {
                isAnimating = false; // Interakció engedélyezése
                console.log("[checkAnimationsComplete] Interaction enabled.");
            } else {
                // Ha a játék véget ért, az isAnimating maradhat true vagy false,
                // de a lényeg, hogy az onClick elején az isGameOver ellenőrzés megállítja.
                // A tisztaság kedvéért itt is false-ra állíthatjuk.
                isAnimating = false;
                console.log("[checkAnimationsComplete] Game is over, interaction disabled.");
            }
		}
		lastMoveResult = null; // <<< Fontos: Nullázzuk ki a lépés végén!
    }
}

// --- ÚJ FÜGGVÉNY: Játékos Váltása ---
function switchPlayer() {
    currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
    console.log("Current player:", currentPlayer);
    // Esetleg frissítheted a kamera nézőpontját vagy más UI elemet itt
}

/**
 * Összegyűjti a megadott színű játékos összes lehetséges érvényes lépését a táblán.
 * @param {string} color A játékos színe ('white' vagy 'black').
 * @returns {Array} Az összes érvényes lépés objektumainak tömbje [{row, col, ...}, ...].
 */
function getAllValidMovesForPlayer(color) {
    const allMoves = [];
    for (const pieceMesh of pieces) {
        // Csak az aktív, megfelelő színű bábukkal foglalkozunk
        if (pieceMesh.userData &&
            !pieceMesh.userData.isCaptured &&
            pieceMesh.userData.color === color &&
            pieceMesh.userData.boardCoords)
        {
            const { row, col } = pieceMesh.userData.boardCoords;
            // Lekérjük az adott bábu érvényes lépéseit
            // Figyelem: a getValidMoves a JELENLEGI `currentPlayer`-t használja belsőleg
            // a sakkba lépés ellenőrzéséhez. Ha biztosra akarunk menni, hogy a
            // vizsgált 'color'-hoz tartozó lépéseket ellenőrzi helyesen, ideiglenesen
            // át kéne állítani a currentPlayer-t, vagy a getValidMoves-ot módosítani,
            // hogy fogadjon egy explicit 'playerColor' paramétert a sakk ellenőrzéshez.
            // Egyelőre feltételezzük, hogy a getValidMoves a paraméterként kapott
            // bábu színét veszi alapul a saját király sakkba lépésének ellenőrzéséhez.
            // Ha a `chessLogic.js`-ben a getValidMoves már így működik, akkor jó.
            // Ha nem, akkor a chessLogic.js-t is módosítani kellhet!

            // Ideális esetben a getValidMoves(row, col, playerColor) így működik:
            const validMovesForPiece = getValidMoves(row, col, color); // <<< Itt a 'color' a lényeg

            if (validMovesForPiece && validMovesForPiece.length > 0) {
                // Hozzáadjuk a talált lépéseket az összesített listához
                // A spread operátor (...) "kicsomagolja" a tömb elemeit
                allMoves.push(...validMovesForPiece);
            }
        }
    }
    // console.log(`Összes érvényes lépés ${color} számára:`, allMoves.length); // Debug log
    return allMoves;
}

/**
 * Ellenőrzi a játék állapotát (sakk, matt, patt) a SORON KÖVETKEZŐ játékosra nézve.
 * Frissíti a státuszüzenetet és beállítja az isGameOver jelzőt, ha a játék véget ért.
 */
function checkGameState() {
    console.log("--- checkGameState fut ---");
    const playerToCheck = currentPlayer;
    const opponentColor = (playerToCheck === 'white' ? 'black' : 'white');

    const isInCheck = isKingInCheck(playerToCheck);
    const allValidMoves = getAllValidMovesForPlayer(playerToCheck);

    console.log(`checkGameState: Játékos: ${playerToCheck}, Sakkban? ${isInCheck}, Lehetséges lépések: ${allValidMoves.length}`);

    let statusMessage = ""; // Az alsó státusz üzenetnek
    let finalOverlayMessage = ""; // A nagy overlay panel üzenetének

    if (allValidMoves.length === 0) {
        isGameOver = true; // Játék vége
        if (isInCheck) {
            // === MATT ===
            console.log("checkGameState: MATT észlelve!");
            const winner = opponentColor === 'white' ? 'Világos' : 'Sötét';
            // Formázzuk meg az üzenetet az overlay számára (akár több sorban is lehet \n-nel)
            finalOverlayMessage = `Matt!\n${winner} nyert.`;
            statusMessage = finalOverlayMessage.replace('\n', ' '); // Státuszba egy sorba írjuk
            console.log("GAME OVER: Checkmate! Winner:", opponentColor);
            highlightCheckedKing(playerToCheck); // Mattban lévő király kiemelése
            showGameOverOverlay(finalOverlayMessage); // <<< Javítva: Átadjuk a formázott üzenetet
            dimLights(); // <<< HOZZÁADVA: Fények halványítása
        } else {
            // === PATT ===
            console.log("checkGameState: PATT észlelve!");
            finalOverlayMessage = "Patt!\nDöntetlen.";
            statusMessage = finalOverlayMessage.replace('\n', ' '); // Státuszba egy sorba
            console.log("GAME OVER: Stalemate!");
            highlightCheckedKing(null); // Nincs sakk kiemelés
            showGameOverOverlay(finalOverlayMessage); // <<< Javítva: Átadjuk a formázott üzenetet
            dimLights(); // <<< HOZZÁADVA: Fények halványítása
        }
    } else if (isInCheck) {
        // === CSAK SAKK ===
        console.log("checkGameState: SAKK észlelve!");
        statusMessage = `Következő lépés: ${playerToCheck === 'white' ? 'Világos' : 'Sötét'} - SAKK!`;
        highlightCheckedKing(playerToCheck); // Sakk kiemelése
        // isGameOver marad false
    } else {
        // === NORMÁL JÁTÉKMENET ===
        console.log("checkGameState: Normál játékmenet.");
        statusMessage = `Következő lépés: ${playerToCheck === 'white' ? 'Világos' : 'Sötét'}`;
        highlightCheckedKing(null); // Nincs sakk, kiemelés törlése
        // isGameOver marad false
    }

    // Státusz elem frissítése
    if (statusElement) {
        statusElement.textContent = statusMessage;
    }
    console.log("--- checkGameState vége ---");
}

// --- ÚJ FÜGGVÉNY: Játékállapot Kijelzése ---
function updateGameStatus() {
    if (!statusElement) return; // Ha nincs status elem a HTML-ben

    let message = `Következő lépés: ${currentPlayer === 'white' ? 'Világos' : 'Sötét'}`;
    // Ellenőrizzük, hogy az AKTUÁLIS (most következő) játékos sakkban van-e
    const isInCheck = isKingInCheck(currentPlayer);

    if (isInCheck) {
        message += " - SAKK!";
        // TODO: Itt lehetne mattot is ellenőrizni később
        // (getAllValidMovesForPlayer(currentPlayer).length === 0)
    }

    statusElement.textContent = message;
    // TODO: Opcionálisan kiemelheted a sakkban lévő király 3D mesh-ét is
}

// --- ÚJ FÜGGVÉNY: Promóció Választás Kezelése ---
function handlePromotionChoice(event) {
    // Ellenőrzés, hogy gombra kattintottak-e és várunk-e promócióra
    if (!event.target.matches('#promotion-choice button') || !pendingPromotionCoords) {
        // Ha a panel látható, de nem gombra kattint, vagy hiba van, rejtsük el és oldjuk a lock-ot
        if (!promotionPanel.classList.contains('hidden')) {
             promotionPanel.classList.add('hidden');
             // Ha nem vártunk promócióra, de a panel látható volt, valami hiba történt
             if (!pendingPromotionCoords) {
                 console.warn("Promotion panel was visible but no promotion was pending. Hiding panel.");
                 isAnimating = false; // Oldjuk a lock-ot hiba esetén is
             }
        }
        return;
    }

    const chosenType = event.target.dataset.promoteTo;
    const { row, col, color } = pendingPromotionCoords;

    console.log(`[PromotionChoice] Játékos választása: ${chosenType} a (${row}, ${col}) mezőn.`);

    // 1. UI Panel Elrejtése
    promotionPanel.classList.add('hidden');

    // 2. Belső Logika Frissítése (chessLogic)
    console.log("[PromotionChoice] Hívás: logicPromotePawn(...)");
    const promotionSuccess = logicPromotePawn(row, col, chosenType);

    if (!promotionSuccess) {
        console.error("[PromotionChoice] Hiba a logicPromotePawn frissítésekor!");
        pendingPromotionCoords = null;
        isAnimating = false; // Hiba -> lock feloldása
        // Itt érdemes lehet visszarajzolni a táblát vagy hibaüzenetet adni
        return;
    }

    // 3. 3D Jelenet Frissítése (Gyalog cseréje)

    // a) Régi gyalog mesh megkeresése és eltávolítása
    console.log(`[PromotionChoice] Gyalog keresése (${row}, ${col})`);
    const pawnMeshIndex = pieces.findIndex(p =>
        p.userData?.boardCoords &&
        p.userData.boardCoords.row === row &&
        p.userData.boardCoords.col === col &&
        p.userData.type === 'pawn' // Fontos ellenőrzés
    );

    if (pawnMeshIndex !== -1) {
        const pawnMesh = pieces[pawnMeshIndex];
        console.log("[PromotionChoice] Megtalált gyalog mesh eltávolítása:", pawnMesh.uuid);
        if (pawnMesh.parent) {
            pawnMesh.parent.remove(pawnMesh);
        } else {
            scene.remove(pawnMesh); // Fallback
        }
        pieces.splice(pawnMeshIndex, 1); // Eltávolítás a listából
    } else {
        console.error(`[PromotionChoice] Hiba: Nem található a lecserélendő gyalog mesh a (${row}, ${col}) pozíción! A játék folytatódik az új bábuval.`);
        // Nem állunk meg, megpróbáljuk hozzáadni az újat
    }

    // b) Új bábu mesh létrehozása és hozzáadása
    console.log(`[PromotionChoice] Új mesh létrehozása: ${chosenType}, ${color}`);
    const newPieceMesh = createPieceMesh(chosenType, color); // Ezt a függvényt már definiáltad korábban

    if (!newPieceMesh) {
        console.error(`[PromotionChoice] Hiba az új mesh (${chosenType}) létrehozásakor!`);
        pendingPromotionCoords = null;
        isAnimating = false; // Hiba -> lock feloldása
        switchPlayer(); // Próbáljuk meg folytatni a játékot...
        updateGameStatus();
        return;
    }

    // Pozíció és userData beállítása az új mesh-en
    const finalPosition = boardSquares[row][col].center.clone();
    newPieceMesh.position.copy(finalPosition);
    newPieceMesh.userData.boardCoords = { row, col }; // Alap userData-t a createPieceMesh beállította
	
	// Dinamikus Y eltolás és Forgatás ---
    const adjustment = PIECE_ADJUSTMENTS[chosenType] || { yOffset: 0, initialRotationY: 0 };
	
	// Y eltolás alkalmazása
    newPieceMesh.position.y += adjustment.yOffset;
	
	// Forgatás alkalmazása
    newPieceMesh.rotation.y = adjustment.initialRotationY + (color === 'black' ? BLACK_ROTATION_Y : 0);
	
	// if (chosenType === 'knight') {
		// Ugyanazt az értéket használd, mint setupPieces-ben
	//  	newPieceMesh.position.y += 0.75;
	//  	if (color === 'black') { // A promóció színét használjuk
    //    newPieceMesh.rotation.y = Math.PI*0.6;
    // } else {
    //     newPieceMesh.rotation.y = Math.PI*1.6;
    // }
	// }

    // Hozzáadás a scene-hez és a pieces listához
    pieces.push(newPieceMesh);
    scene.add(newPieceMesh); // Győződj meg róla, hogy a scene-hez adod, nem csoporthoz, hacsak nincs jó okod rá
    console.log("[PromotionChoice] Új mesh hozzáadva:", newPieceMesh.uuid);

    // 4. Befejező Lépések
    pendingPromotionCoords = null; // Függő állapot törlése
    switchPlayer(); // Játékosváltás
    checkGameState(); // Állapot kijelzése
    isAnimating = false; // Interakció feloldása
    console.log("Promotion complete. Interaction enabled.");
}

async function initializeApp() {
    console.log("Alkalmazás inicializálásának indítása...");
    try {
        // 1. Modellek aszinkron betöltése
        console.log("Modellek betöltése...");
        pieceBaseModels = await loadChessPieces('assets/models/'); // Megvárjuk a betöltést
        console.log("Modellek betöltve:", Object.keys(pieceBaseModels).filter(k => pieceBaseModels[k]));
		
		// 2. Three.js alapok (Scene, Camera, Renderer, Fények, Controls)
        // Ezek létrehozása már valószínűleg a globális részben megtörtént.
        // Ha függvényben vannak, itt kell meghívni őket. Ellenőrizzük:
        // A scene, camera, renderer, lights, controls már a fájl elején létrejönnek, ez jó.
		
		// 3. Játék logika és vizuális elemek inicializálása
		logicInitializeBoard(); // Sakk logika resetelése (biztonság kedvéért itt is)
        createBoard();        // 3D tábla létrehozása (ezt csak egyszer kell az elején)
        setupPieces();        // Bábuk elhelyezése (ez használja a pieceBaseModels-t!)
		
		// 4. Kezdeti állapot beállítása
        currentPlayer = 'white'; // Biztosan fehér kezd
        selectedPiece = null;
        isGameOver = false;
        isAnimating = false;
        animationsPending = 0;
        pendingPromotionCoords = null;
        capturedWhiteMeshes = [];
        capturedBlackMeshes = [];
        clearValidMoveVisuals(); // Korábbi kiemelések törlése
        if(checkHighlightMesh) scene.remove(checkHighlightMesh); checkHighlightMesh = null; // Sakk kiemelés törlése
        if(gameOverOverlay) gameOverOverlay.classList.remove('visible'); // Game over panel elrejtése
        promotionPanel.classList.add('hidden'); // Promóciós panel elrejtése
        restoreLights(); // Alap fényerő
        controls.enabled = true; // Kamera engedélyezése

		// 5. Eseménykezelők hozzáadása (MOST, hogy minden elem létezik)
        window.addEventListener('resize', onWindowResize, false); // Ablak átméretezés
        canvas.addEventListener('click', onClick, false); // <<< FIGYELEM: Canvas-ra tesszük a kattintást!
        promotionPanel.addEventListener('click', handlePromotionChoice); // Promóció választás
        if (newGameButton) { // Új Játék gomb (ha létezik)
            // Ezt lehet, hogy csak egyszer kellene hozzáadni, nem minden initnél
            // De egyelőre nem okoz nagy gondot
            newGameButton.addEventListener('click', () => {
                console.log("Új Játék gomb megnyomva.");
                if(gameOverOverlay) gameOverOverlay.classList.remove('visible');
                initializeGame(); // Ez a resetelő függvény
            });
        } else { console.warn("Az 'Új Játék' gomb (new-game-button) nem található!"); }

		// 6. Kezdeti állapot kijelzése
        updateGameStatus();
        console.log(`3D Chess Initialized. Starting player: ${currentPlayer}`);
		
		// 7. Animációs ciklus indítása (CSAK ITT a végén!)
        animate();
		console.log("Sakk logika alapjai (chessLogic.js) integrálva, lépésgenerálás (R,B,N,Q) működik.");
		
		// Add the event listener (if not already present, but it was in your code)
		// window.addEventListener('click', onClick);

    } catch (error) {
        console.error("Hiba az alkalmazás inicializálása során:", error);
        if(statusElement) statusElement.textContent = "Hiba a játék betöltése közben.";
    }
}

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);
    TWEEN.update(); // <<<--- ÚJ SOR: TWEEN frissítése minden képkockában

    controls.update(); // Ha használsz OrbitControls-t, ez is kellhet
    renderer.render(scene, camera);
}

// --- Ablak átméretezés ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Indítás ---
initializeApp();
