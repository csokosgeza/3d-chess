// chessLogic.js

export const BOARD_SIZE = 8;

// --- Belső Tábla Állapota ---
let internalBoard = []; // 8x8 tömb, elemei: null vagy { type, color, hasMoved }
let enPassantTargetSquare = null; // Lehetséges en passant célmező: { row, col } vagy null
// A sáncolási jogokat most a bábuk hasMoved flag-je alapján kezeljük a getValidMoves-ban.
// A currentPlayer-t a script.js-ből kapjuk meg, itt nem tároljuk.

// --- Kezdőállapot Felállítása ---
export function initializeBoard() {
    internalBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    const startPosition = [
        ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
        ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
        [], [], [], [], // Ezek null-lal lesznek feltöltve
        ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
        ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
    ];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            let pieceType = null;
            let pieceColor = null;
            if (r === 0 || r === 1) {
                pieceType = startPosition[r][c];
                if (pieceType) pieceColor = 'black';
            } else if (r === 6 || r === 7) {
                pieceType = startPosition[r][c];
                 if (pieceType) pieceColor = 'white';
            }
            // Üres sorok (2-5) automatikusan null maradnak az inicializálás miatt

            if (pieceType) {
                internalBoard[r][c] = {
                    type: pieceType,
                    color: pieceColor,
                    hasMoved: false // Kezdetben egy bábu sem mozdult
                };
            } else {
                internalBoard[r][c] = null;
            }
        }
    }
    enPassantTargetSquare = null; // En passant törlése
    console.log("Belső tábla inicializálva (hasMoved flag, enPassant nullázva).");
}

// --- Segédfüggvények ---

function isValidCoords(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getPieceAt(row, col, board = internalBoard) {
    if (!isValidCoords(row, col)) return null;
    return board[row][col];
}

function isEmpty(row, col, board = internalBoard) {
    return isValidCoords(row, col) && board[row][col] === null;
}

function isOpponent(row, col, myColor, board = internalBoard) {
    if (!isValidCoords(row, col)) return false;
    const piece = board[row][col];
    return piece !== null && piece.color !== myColor;
}

function cloneBoard(boardToClone) {
    return boardToClone.map(row =>
        row.map(piece => (piece ? { ...piece } : null))
    );
}

function findKing(kingColor, boardState) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = boardState[r]?.[c];
            if (piece && piece.type === 'king' && piece.color === kingColor) {
                return { row: r, col: c };
            }
        }
    }
    console.error(`Hiba: ${kingColor} király nem található a táblán!`);
    return null;
}

function isPathClear(r1, c1, r2, c2, currentBoard) {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let r = r1 + dr;
    let c = c1 + dc;
    while (r !== r2 || c !== c2) {
        if (!isValidCoords(r, c)) return false; // Hibás útvonal
        if (currentBoard[r]?.[c]) return false; // Akadály
        r += dr;
        c += dc;
    }
    return true; // Tiszta az út
}

// --- Sakk-detektálás ---

export function isSquareAttacked(targetRow, targetCol, attackerColor, board) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r]?.[c];
            if (piece && piece.color === attackerColor) {
                const type = piece.type;
                const dr = targetRow - r;
                const dc = targetCol - c;

                if (type === 'pawn') {
                    const direction = attackerColor === 'white' ? -1 : 1;
                    if (dr === direction && Math.abs(dc) === 1) return true;
                } else if (type === 'knight') {
                    if ((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2)) return true;
                } else if (type === 'king') {
                    if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) return true;
                } else if (type === 'rook' || type === 'queen') {
                    if ((dr === 0 || dc === 0) && isPathClear(r, c, targetRow, targetCol, board)) return true;
                }
                 if (type === 'bishop' || type === 'queen') { // Fontos: 'if', nem 'else if'!
                    if (Math.abs(dr) === Math.abs(dc) && isPathClear(r, c, targetRow, targetCol, board)) return true;
                }
            }
        }
    }
    return false;
}

// --- Pszeudo-Legális Lépésgenerálók (Sakk-szűrés nélkül) ---
// Ezek a függvények csak a bábu alap mozgási lehetőségeit adják vissza

function getRawPawnMoves(r, c, board, color) {
    const moves = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    const promotionRank = color === 'white' ? 0 : 7;
    const r1 = r + direction; // Cél sor (egy lépés / ütés)

    // Előre 1
    if (isValidCoords(r1, c) && isEmpty(r1, c, board)) {
        const isPromotion = (r1 === promotionRank);
        // Ha promóció, generáljuk az összes lehetőséget
        if (isPromotion) {
             ['queen', 'rook', 'bishop', 'knight'].forEach(promoteTo => {
                moves.push({ row: r1, col: c, isPromotion: true, promoteTo: promoteTo });
            });
        } else {
            moves.push({ row: r1, col: c });
        }
        // Előre 2 (csak ha az 1. lépés is üres volt és kezdő mezőn áll)
        if (r === startRow && !isPromotion) { // Promóciós lépésből nem lehet duplát
            const r2 = r + 2 * direction;
            if (isValidCoords(r2, c) && isEmpty(r2, c, board)) {
                moves.push({ row: r2, col: c, isDoubleStep: true }); // Jelöljük a dupla lépést
            }
        }
    }
    // Átlós ütés
    for (const dc of [-1, 1]) {
        const nc = c + dc; // Cél oszlop
        if (isValidCoords(r1, nc)) {
            // Normál ütés
            if (isOpponent(r1, nc, color, board)) {
                const isPromotion = (r1 === promotionRank);
                 if (isPromotion) {
                     ['queen', 'rook', 'bishop', 'knight'].forEach(promoteTo => {
                        moves.push({ row: r1, col: nc, isPromotion: true, promoteTo: promoteTo });
                     });
                } else {
                    moves.push({ row: r1, col: nc });
                }
            }
            // En Passant ütés
            else if (enPassantTargetSquare && r1 === enPassantTargetSquare.row && nc === enPassantTargetSquare.col) {
                 // Ellenőrizzük, hogy tényleg ellenfél gyalogja van-e mellettünk (ahonnan duplát lépett)
                 if (isValidCoords(r, nc) && isOpponent(r, nc, color, board) && board[r][nc]?.type === 'pawn') {
                     moves.push({ row: r1, col: nc, isEnPassant: true, capturedPawnPos: { row: r, col: nc } });
                 }
            }
        }
    }
    return moves;
}

function getRawRookMoves(r, c, board, color) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
        for (let i = 1; ; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (!isValidCoords(nr, nc)) break;
            if (isEmpty(nr, nc, board)) {
                moves.push({ row: nr, col: nc });
            } else {
                if (isOpponent(nr, nc, color, board)) moves.push({ row: nr, col: nc });
                break;
            }
        }
    }
    return moves;
}

function getRawBishopMoves(r, c, board, color) {
    const moves = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of directions) {
        for (let i = 1; ; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (!isValidCoords(nr, nc)) break;
            if (isEmpty(nr, nc, board)) {
                moves.push({ row: nr, col: nc });
            } else {
                if (isOpponent(nr, nc, color, board)) moves.push({ row: nr, col: nc });
                break;
            }
        }
    }
    return moves;
}

function getRawKnightMoves(r, c, board, color) {
    const moves = [];
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of knightMoves) {
        const nr = r + dr;
        const nc = c + dc;
        if (isValidCoords(nr, nc)) {
            if (isEmpty(nr, nc, board) || isOpponent(nr, nc, color, board)) {
                moves.push({ row: nr, col: nc });
            }
        }
    }
    return moves;
}

function getRawQueenMoves(r, c, board, color) {
    return [...getRawRookMoves(r, c, board, color), ...getRawBishopMoves(r, c, board, color)];
}

function getRawKingMoves(r, c, board, color) {
    const moves = [];
    const kingPiece = board[r]?.[c]; // Lekérjük a király objektumát

    // Normál (1 mezős) lépések
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (isValidCoords(nr, nc)) {
            if (isEmpty(nr, nc, board) || isOpponent(nr, nc, color, board)) {
                moves.push({ row: nr, col: nc });
            }
        }
    }

    // Sáncolás lehetőségének generálása
    if (kingPiece && !kingPiece.hasMoved) {
        // Királyoldal (rövid sánc)
        const kRookCol = 7;
        const kRook = getPieceAt(r, kRookCol, board);
        if (kRook && kRook.type === 'rook' && kRook.color === color && !kRook.hasMoved &&
            isEmpty(r, c + 1, board) && isEmpty(r, c + 2, board))
        {
            moves.push({ row: r, col: c + 2, isCastle: true, type: 'K', rookStartCol: kRookCol, rookEndCol: c + 1 });
        }
        // Vezéroldal (hosszú sánc)
        const qRookCol = 0;
        const qRook = getPieceAt(r, qRookCol, board);
         if (qRook && qRook.type === 'rook' && qRook.color === color && !qRook.hasMoved &&
            isEmpty(r, c - 1, board) && isEmpty(r, c - 2, board) && isEmpty(r, c - 3, board))
         {
            moves.push({ row: r, col: c - 2, isCastle: true, type: 'Q', rookStartCol: qRookCol, rookEndCol: c - 1 });
        }
    }
    return moves;
}

/**
 * Összegyűjti az összes pszeudo-legális lépést.
 */
function generatePseudoLegalMoves(r, c, board) {
    const piece = board[r]?.[c];
    if (!piece) return [];
    const { type, color } = piece;
    switch (type) {
        case 'pawn':   return getRawPawnMoves(r, c, board, color);
        case 'rook':   return getRawRookMoves(r, c, board, color);
        case 'knight': return getRawKnightMoves(r, c, board, color);
        case 'bishop': return getRawBishopMoves(r, c, board, color);
        case 'queen':  return getRawQueenMoves(r, c, board, color);
        case 'king':   return getRawKingMoves(r, c, board, color);
        default:       return [];
    }
}

// --- FŐ LÉPÉSGENERÁLÓ (Sakk szűréssel) ---
export function getValidMoves(startRow, startCol, currentPlayer, board = internalBoard) {
    const piece = getPieceAt(startRow, startCol, board);
    const validMoves = [];

    if (!piece || piece.color !== currentPlayer) {
        return [];
    }

    const opponentColor = currentPlayer === 'white' ? 'black' : 'white';
    const pseudoMoves = generatePseudoLegalMoves(startRow, startCol, board);

    const kingPos = findKing(currentPlayer, board);
    if (!kingPos) return []; // Hiba: nincs király
    const isCurrentlyInCheck = isSquareAttacked(kingPos.row, kingPos.col, opponentColor, board);

    for (const move of pseudoMoves) {
        const tempBoard = cloneBoard(board);
        const movedPiece = tempBoard[startRow][startCol];

        // En Passant szimuláció
        if (move.isEnPassant) {
            // Itt már a moveData-t is használhatnánk, ha a generatePseudoLegalMoves átadja a capturedPawnPos-t
             const capturedPawnRow = startRow;
             const capturedPawnCol = move.col;
             tempBoard[capturedPawnRow][capturedPawnCol] = null;
             // A `capturedPawnPos` a getRawPawnMoves által került bele a move objektumba
        }

        // Bábu mozgatása
        tempBoard[move.row][move.col] = movedPiece;
        tempBoard[startRow][startCol] = null;

        // Sáncolás szimuláció
        if (move.isCastle) {
             // A rookStartCol és rookEndCol a getRawKingMoves által került bele
             const rook = tempBoard[startRow][move.rookStartCol];
             if(rook) {
                 tempBoard[startRow][move.rookEndCol] = rook;
                 tempBoard[startRow][move.rookStartCol] = null;
             }
        }

        // Átváltozás szimulálása (Vezérré)
        if (move.isPromotion && tempBoard[move.row][move.col]) {
            // A sakk teszteléshez elég a vezér
            tempBoard[move.row][move.col].type = 'queen';
            // A `promoteTo` információ a `move` objektumban továbbra is megvan
        }

        // Király pozíciója a lépés UTÁN
        const tempKingPos = (movedPiece.type === 'king')
                           ? { row: move.row, col: move.col }
                           : findKing(currentPlayer, tempBoard); // Újra kell keresni, ha más lépett

        if (!tempKingPos) continue; // Hiba

        // Sakk ellenőrzés a lépés UTÁN
        const isKingSafeAfterMove = !isSquareAttacked(tempKingPos.row, tempKingPos.col, opponentColor, tempBoard);

        if (isKingSafeAfterMove) {
            if (move.isCastle) {
                // Extra sánc ellenőrzések az EREDETI táblán:
                // a) Nem lehetett sakkban ELŐTTE
                if (isCurrentlyInCheck) continue;
                // b) Nem haladhat át támadott mezőn
                const transitCol = startCol + Math.sign(move.col - startCol);
                if (isSquareAttacked(startRow, transitCol, opponentColor, board)) continue;
                // Ha minden OK, mehet a lépés
                validMoves.push(move);
            } else {
                // Normál legális lépés
                validMoves.push(move);
            }
        }
    }
    return validMoves;
}

// --- Lépés Végrehajtása ---
// Ez a függvény nagyrészt jó volt, csak a currentPlayer kezelése nem ide tartozik
export function makeMove(startRow, startCol, endRow, endCol, moveData = {}, board = internalBoard) {
    const pieceToMove = board[startRow][startCol];
    if (!pieceToMove) {
        console.error("[makeMove] Hiba: Nincs bábu a start mezőn!");
        return false;
    }
		

    let capturedPiece = board[endRow][endCol];
    let capturedPosition = { row: endRow, col: endCol };
    let isEnPassantCapture = false;
    let isCastle = moveData.isCastle || false;

    // En passant célmező törlése
    enPassantTargetSquare = null; // Minden lépésnél töröljük, csak utána állítjuk be, ha kell

    // En Passant ütés
    if (pieceToMove.type === 'pawn' && moveData.isEnPassant) {
        const capturedPawnPos = moveData.capturedPawnPos; // Ezt a getRawPawnMoves adja
        if (capturedPawnPos) {
            capturedPiece = board[capturedPawnPos.row][capturedPawnPos.col];
            board[capturedPawnPos.row][capturedPawnPos.col] = null;
            capturedPosition = capturedPawnPos;
            isEnPassantCapture = true;
            console.log(`En passant capture at (${capturedPawnPos.row}, ${capturedPawnPos.col})`);
        } else { console.error("EP move missing capturedPawnPos!"); }
    }

    // Bábu mozgatása
    board[endRow][endCol] = pieceToMove;
    board[startRow][startCol] = null;

    // Sáncolás - Bástya mozgatása
    if (isCastle) {
        // A moveData tartalmazza a rookStartCol és rookEndCol adatokat a getRawKingMoves-ból
        const rook = board[startRow][moveData.rookStartCol];
        if (rook) {
            board[startRow][moveData.rookEndCol] = rook;
            board[startRow][moveData.rookStartCol] = null;
            rook.hasMoved = true; // Bástya mozdult
            console.log(`Castling: Rook moved from ${moveData.rookStartCol} to ${moveData.rookEndCol}`);
        } else { console.error("Castling error: Rook not found!"); }
         // A király hasMoved flagjét az általános rész kezeli
    }

    // hasMoved flag beállítása
    if (!pieceToMove.hasMoved) {
        pieceToMove.hasMoved = true;
    }

    // Új en passant célmező beállítása (ha gyalog duplát lépett)
    // A moveData-ból kellene jönnie az isDoubleStep flagnek
    if (pieceToMove.type === 'pawn' && moveData.isDoubleStep) {
        enPassantTargetSquare = { row: (startRow + endRow) / 2, col: endCol };
        console.log("En passant target set:", enPassantTargetSquare);
    } else {
        // Biztosítjuk, hogy más lépésnél törlődjön, ha a korábbi nullázás nem volt elég
        enPassantTargetSquare = null;
    }

    // Promóció detektálása (változatlan)
    let promotionPendingData = null;
    const promotionRow = (pieceToMove.color === 'white') ? 0 : 7;
	console.log(`[makeMove] Promotion Check: PieceType='${pieceToMove.type}', EndRow=${endRow}, RequiredPromotionRow=${promotionRow}`);
    if (pieceToMove.type === 'pawn' && endRow === promotionRow) {
        promotionPendingData = { color: pieceToMove.color, row: endRow, col: endCol };
		console.log("[makeMove] Promotion PENDING DETECTED! Data:", promotionPendingData);
    } else {
         console.log("[makeMove] No promotion detected this move.");
    }

    console.log(`Belső tábla frissítve: ${pieceToMove.color} ${pieceToMove.type} lépett ${startRow},${startCol} -> ${endRow},${endCol}`);

    return {
        movedPiece: pieceToMove, // A kulcs 'movedPiece', az értéke a 'pieceToMove' változóból jön
        capturedPiece: capturedPiece, // Az ütött bábu objektuma (vagy null)
        capturedPosition: capturedPosition, // Hol történt az ütés
        isEnPassantCapture: isEnPassantCapture,
        isCastle: isCastle,
        promotionPending: promotionPendingData
    };
}

// --- Bábu Átváltoztatása ---
export function promotePawn(row, col, promotionPieceType, board = internalBoard) {
    // ... (Változatlan, jónak tűnik) ...
    const piece = board[row][col];
    if (!piece || piece.type !== 'pawn') { /* ... hiba ... */ return false; }
    if (!['queen', 'rook', 'bishop', 'knight'].includes(promotionPieceType)) { /* ... hiba ... */ return false; }
    board[row][col] = {
        type: promotionPieceType,
        color: piece.color,
        hasMoved: true
    };
    console.log(`Pawn at (${row}, ${col}) promoted to ${promotionPieceType}`);
    return true;
}

// --- Segédfüggvények, amiket a script.js is használhat ---
// Ezeket érdemes exportálni

export function getPieceAtSquare(row, col) {
    return getPieceAt(row, col, internalBoard);
}

// Opcionális: Exportáljuk az isKingInCheck függvényt
export function isKingInCheck(playerColor, board = internalBoard) {
    const kingPos = findKing(playerColor, board);
    if (!kingPos) return false; // Nincs király -> nincs sakkban
    const opponentColor = playerColor === 'white' ? 'black' : 'white';
    return isSquareAttacked(kingPos.row, kingPos.col, opponentColor, board);
}

// initializeBoard(); // Ezt kívülről kell hívni
