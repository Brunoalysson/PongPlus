const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 4000 });

let playerPosition = 200;
let opponentPosition = 200;
let ball = { x: 395, y: 195, dx: 2, dy: 2 };


let lobbyPlayers = []; // Array para armazenar os jogadores no lobby
let gamePlayers = []; // Array para armazenar os jogadores nas partidas
let games = []; // Array para armazenar as informações das partidas
const minimumPlayers = 2; // Número mínimo de jogadores para iniciar uma partida


// Função para atualizar a posição da bola
function updateBallPosition() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Colisão com as bordas verticais
    if (ball.y < 0 || ball.y > 390) {
        ball.dy *= -1;
    }

    // Colisão com as raquetes
    if (ball.x <= 20 && ball.y >= playerPosition && ball.y <= playerPosition + 80) {
        ball.dx *= -1;
    }

    if (ball.x >= 770 && ball.y >= opponentPosition && ball.y <= opponentPosition + 80) {
        ball.dx *= -1;
    }

    // Verificar se a bola saiu da tela
    if (ball.x < 0 || ball.x > 800) {
        ball = { x: 395, y: 195, dx: 2, dy: 2 }; // Reiniciar a bola no centro
    }
}

// Função para enviar o estado do jogo para os clientes
function sendGameState() {
    const gameState = {
        playerPosition: playerPosition,
        opponentPosition: opponentPosition,
        ball: ball
    };

    wss.clients.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gameState));
        }
    });
}

wss.on('connection', function(socket) {
    console.log('Novo cliente conectado');

    // Adicionar jogador ao lobby
    lobbyPlayers.push(socket);

    // Evento de recebimento de mensagens do cliente
    socket.on('message', function(message) {
        const data = JSON.parse(message);

        if (data.type === 'playerPosition') {
            playerPosition = data.position;
        } else if (data.type === 'chatMessage') {
            // Enviar mensagem de chat para todos os jogadores no lobby
            sendChatMessageToLobby(data.message);
        } else if (data.type === 'createGame') {
            // Criar uma nova partida e adicionar o jogador como seu criador
            createGame(socket);
        } else if (data.type === 'joinGame') {
            // Entrar em uma partida existente
            joinGame(socket, data.gameId);
        } else if (data.type === 'startGame') {
            // Iniciar a partida, somente o criador da partida pode fazer isso
            startGame(socket, data.gameId);
        }
    });

    // Evento de desconexão do cliente
    socket.on('close', function() {
        console.log('Cliente desconectado');

        // Remover jogador do lobby ou de uma partida em andamento
        removeFromLobby(socket);
        removeFromGame(socket);
    });
});


// Loop principal do servidor
setInterval(function() {
    updateBallPosition();
    sendGameState();
    sendGameStateToLobby();
}, 16);


// Enviar mensagem de chat para todos os jogadores no lobby
function sendChatMessageToLobby(message) {
    wss.clients.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN && lobbyPlayers.includes(client)) {
            client.send(JSON.stringify({
                type: 'chatMessage',
                message: message
            }));
        }
    });
}

// Criar uma nova partida e adicionar o jogador como seu criador
function createGame(playerSocket) {
    const gameId = games.length;
    const game = {
        id: gameId,
        creator: playerSocket,
        status: 'created',
        players: [playerSocket]
    };
    games.push(game);

    // Enviar informações da partida para o criador
    playerSocket.send(JSON.stringify({
        type: 'gameCreated',
        gameId: gameId
    }));

    // Atualizar os jogadores no lobby sobre a partida criada
    sendGameStateToLobby();
}

// Entrar em uma partida existente
function joinGame(playerSocket, gameId) {
    const game = games.find(g => g.id === gameId);

    if (game && game.status === 'created' && !game.players.includes(playerSocket)) {
        game.players.push(playerSocket);

        // Enviar informações da partida para o jogador
        playerSocket.send(JSON.stringify({
            type: 'gameJoined',
            gameId: gameId
        }));

        // Atualizar os jogadores no lobby sobre a partida atualizada
        sendGameStateToLobby();
    }
}

// Iniciar a partida, somente o criador da partida pode fazer isso
function startGame(playerSocket, gameId) {
    const game = games.find(g => g.id === gameId);

    if (game && game.creator === playerSocket && game.players.length >= minimumPlayers) {
        game.status = 'started';

        // Enviar informações da partida atualizada para todos os jogadores na partida
        game.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'gameStarted'
            }));
        });

        // Remover a partida do array de partidas
        games = games.filter(g => g !== game);

        // Atualizar os jogadores no lobby sobre a partida removida
        sendGameStateToLobby();
    }
}

// Remover jogador do lobby
function removeFromLobby(playerSocket) {
    lobbyPlayers = lobbyPlayers.filter(player => player !== playerSocket);

    // Atualizar os jogadores no lobby sobre a saída do jogador
    sendGameStateToLobby();
}

// Remover jogador de uma partida em andamento
function removeFromGame(playerSocket) {
    const game = games.find(g => g.players.includes(playerSocket));

    if (game) {
        game.players = game.players.filter(player => player !== playerSocket);

        // Enviar informações da partida atualizada para os jogadores restantes na partida
        game.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'playerLeftGame'
            }));
        });

        // Atualizar os jogadores no lobby sobre a partida atualizada
        sendGameStateToLobby();
    }
}

// Enviar estado das partidas para os jogadores no lobby
function sendGameStateToLobby() {
    const lobbyState = {
        lobbyPlayers: lobbyPlayers.length,
        games: games.filter(game => game.status === 'created').map(game => ({
            id: game.id,
            creator: game.creator.readyState === WebSocket.OPEN,
            players: game.players.length
        }))
    };

    lobbyPlayers.forEach(player => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({
                type: 'lobbyState',
                state: lobbyState
            }));
        }
    });
}


console.log('WebSocket server listening on port 4000');