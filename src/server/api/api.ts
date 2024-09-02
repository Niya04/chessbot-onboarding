import { WebsocketRequestHandler } from "express-ws";
import { Router } from "express";
import { parseMessage } from "../../common/message/parse-message.ts";
import {
    RegisterWebsocketMessage,
    GameInterruptedMessage,
    GameStartedMessage,
    PlacementMessage,
} from "../../common/message/messages.ts";
import { clientManager, socketManager } from "./managers.ts";
import { GameManager } from "./game-manager.ts";
import { PieceType } from "../../common/game-types.ts";
import { GameEngine } from "../../common/game-engine.ts"

export let gameManager: GameManager | null = null;

/**
 * An endpoint used to establish a websocket connection with the server.
 *
 * The websocket is used to stream moves to and from the client.
 */
export const websocketHandler: WebsocketRequestHandler = (ws, req) => {
    ws.on("close", () => {
        socketManager.handleSocketClosed(req.cookies.id);
    });

    ws.on("message", (data) => {
        const message = parseMessage(data.toString());
        console.log("Received message: " + message.toJson());

        if (message instanceof RegisterWebsocketMessage) {
            socketManager.registerSocket(req.cookies.id, ws);
        } else if (
            message instanceof GameInterruptedMessage ||
            message instanceof PlacementMessage
        ) {
            if (gameManager !== null) gameManager?.handleMessage(message, req.cookies.id);
        }
    });
};

export const apiRouter = Router();

apiRouter.get("/client-information", (req, res) => {
    const clientType = clientManager.getClientType(req.cookies.id);
    /**
     * Note the client currently redirects to home from the game over screen
     * So removing the isGameEnded check here results in an infinite loop
     */
    const isGameActive = gameManager !== null && !gameManager.isGameEnded();
    return res.send({
        clientType,
        isGameActive,
    });
});

//
apiRouter.get("/game-state", (_, res) => {
    if (gameManager === null) {
        console.warn("Invalid attempt to fetch game state");
        return res.status(400).send({ message: "No game is currently active" });
    }
    return res.status(200).send(gameManager.getGameState());
});

apiRouter.get("/board-state", (_, res) => {
    if (gameManager === null) {
        console.warn("Invalid attempt to fetch board state");
        return res.status(400).send({ message: "No game is currently active" });
    }
    return res.status(200).send(gameManager.getBoardState());
});

apiRouter.post("/start-game", (req, res) => {
    const hostPiece = req.query.hostPiece as PieceType;
    gameManager = new GameManager(
        new GameEngine(),
        socketManager,
        hostPiece,
        clientManager,
    );
    clientManager.sendToClient(new GameStartedMessage());
    return res.send({ message: "success" });
});
