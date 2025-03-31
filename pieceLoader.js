// pieceLoader.js
import * as THREE from 'three';
// Importáld a GLTFLoader-t a Three.js megfelelő helyéről
// Az útvonal eltérhet attól függően, hogyan telepítetted a Three.js-t
// Ez a példa az 'addons' mappából importálást feltételezi:
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Betölt és előkészít egy 3D modellt aszinkron módon.
 * @param {string} url A modell fájl elérési útja.
 * @returns {Promise<THREE.Object3D>} Egy Promise, ami a betöltött és feldolgozott modellel (pl. THREE.Group) tér vissza.
 */
function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            // Sikeres betöltés callback
            (gltf) => {
                const model = gltf.scene; // A betöltött modell (általában egy Group)

                console.log(`Modell betöltve: ${url}`, model);

                // Méretezés és középre igazítás (Nagyon fontos lehet!)
                // A modellek gyakran eltérő méretűek és az origójuk sem biztos, hogy a bábu aljának közepe.
                // Ezt kísérletezéssel kell beállítani a modellhez!

                // 1. Méret meghatározása és skálázás
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                // Tegyük fel, hogy a bábu magassága (Y tengely mentén) kb. SQUARE_SIZE * 0.8 - 1.0 legyen.
                // (A SQUARE_SIZE kb. 1.5 volt, tehát 1.2 - 1.5 körüli magasság a cél.)
                const desiredHeight = 1.5; // <<< Állítsd be ezt kísérletezéssel!
                const scale = desiredHeight / size.y;
                model.scale.set(scale, scale, scale); // Egységes skálázás

                // 2. Középre igazítás az XZ síkon és az alapra helyezés az Y síkon
                // Újraszámoljuk a határoló dobozt a skálázás után
                box.setFromObject(model);
                box.getCenter(center); // Új középpont
                const postScaleSize = box.getSize(new THREE.Vector3());

                // Eltolás: X és Z szerint középre, Y szerint az alapjára
                model.position.x -= center.x;
                model.position.z -= center.z;
                model.position.y -= box.min.y; // Az objektum alját az Y=0 síkra helyezi

                // 3. Árnyékok beállítása (minden mesh-re a modellben)
                model.traverse( function ( node ) {
                    if ( node.isMesh ) {
                         node.castShadow = true;
                         node.receiveShadow = true;
                         // Esetleg anyagok finomhangolása itt, ha szükséges
                         //node.material.metalness = 0.1; node.material.roughness = 0.6;
                    }
                } );

                resolve(model); // A feldolgozott modellel térünk vissza
            },
            // Betöltés közbeni állapot (progress - opcionális)
            undefined,
            // Hiba callback
            (error) => {
                console.error(`Hiba a(z) ${url} modell betöltésekor:`, error);
                reject(error);
            }
        );
    });
}

/**
 * Betölti a szükséges sakkbábú modelleket.
 * Jelenleg csak a huszárt, a többihez null-t ad vissza (vagy placeholdert).
 * @param {string} [basePath='assets/models/'] A modellek mappájának elérési útja.
 * @returns {Promise<object>} Egy Promise, ami egy objektummal tér vissza,
 * pl. { knight: THREE.Group, pawn: null, ... }
 */
export async function loadChessPieces(basePath = 'assets/models/') {
    console.log("Kezdődik a Huszár modell betöltése...");
    try {
        const knightModel = await loadModel(`${basePath}knight.glb`);
		const pawnModel = await loadModel(`${basePath}pawn.glb`);
		const kingModel = await loadModel(`${basePath}king.glb`);
		const bishopModel = await loadModel(`${basePath}bishop.glb`);
		const rookModel = await loadModel(`${basePath}rook.glb`);
		const queenModel = await loadModel(`${basePath}queen.glb`);
        // Később itt betöltheted a többi modellt is hasonlóan:
        // const pawnModel = await loadModel(`${basePath}pawn.glb`);
        // ... stb ...

        console.log("Huszár modell betöltve és feldolgozva.");
        // Add vissza az objektumot a betöltött modellekkel (vagy null-lal a többire)
        return {
            pawn: pawnModel, // <<< Placeholder, nincs még betöltve
            rook: rookModel, // <<< Placeholder
            knight: knightModel, // <<< A betöltött huszár
            bishop: bishopModel, // <<< Placeholder
            queen: queenModel, // <<< Placeholder
            king: kingModel // <<< Placeholder
            // Később cseréld le ezeket a betöltött modellekre
        };
    } catch (error) {
        console.error("Hiba történt a modellek betöltése közben:", error);
        // Hiba esetén üres objektumot vagy placeholdereket adunk vissza
        return { pawn: null, rook: null, knight: null, bishop: null, queen: null, king: null };
    }
}