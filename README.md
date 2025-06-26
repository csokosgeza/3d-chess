# WebGL 3D Chess

A 3D chess game built with Three.js that runs directly in your browser. This project showcases the use of WebGL for creating interactive 3D experiences.

## Live Demo

You can play the game live here: **[https://3d-chess-nine.vercel.app/](https://3d-chess-nine.vercel.app/)**

## Description

This project is a fully functional 3D chess game. It features a 3D board, complete set of pieces, and includes most of the standard chess rules. The game logic is separated from the rendering, making the code modular and easier to maintain. The game state, including valid moves, check, and checkmate, is handled by the logic scripts, while the visual representation is managed by Three.js.

## Features

The game includes the following chess rules and features:
* Standard piece movements
* Pawn promotion
* Castling (Kingside and Queenside)
* En Passant captures
* Check and Checkmate detection
* A user interface for pawn promotion choices
* A "Game Over" screen for checkmate and stalemate situations

### Not Yet Implemented
* **50-move rule**: The game does not currently track the 50-move rule for draws.
* **Threefold repetition**: This rule for draws is also not implemented.

## Customization

You can easily customize the appearance of the chess pieces. The 3D models for the pieces are loaded from the `assets/models/` directory. To use your own models, simply replace the `.glb` files in this directory with your own, making sure to keep the filenames the same:
* `pawn.glb`
* `rook.glb`
* `knight.glb`
* `bishop.glb`
* `queen.glb`
* `king.glb`

The `pieceLoader.js` script handles the loading and initial scaling of these models.

## Technology Stack

* **Graphics**: [Three.js](https://threejs.org/) (provides two versions, v0.150.0 and v0.152.0)
* **Animation**: [Tween.js](https://github.com/tweenjs/tween.js/) for smooth piece animations
* **Core Logic**: Vanilla JavaScript

## A Note on Language

The comments within the source code are written in **Hungarian**. If you are interested in contributing or would like to better understand the code, I am happy to translate the comments to English upon request.

## Support the Project

If you like this repository and find it useful, please consider supporting my work. It helps me to dedicate more time to open-source projects like this.

<a href="https://buymeacoffee.com/csokosgeza" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

You can support me via **[Buy Me a Coffee](https://buymeacoffee.com/csokosgeza)**. Thank you!
