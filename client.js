const pong = document.getElementById('pong');
const player = document.getElementById('player');
const opponent = document.getElementById('opponent');
const ball = document.getElementById('ball');

const socket = new WebSocket('ws://localhost:4000');

let playerPosition = 200;
let opponentPosition = 200;

let inGame = false; // Indicador se o jogador está em uma partida
let gameId = null; // ID da partida em que o jogador está

// Adicionar os eventos para capturar as teclas pressionadas
const keys = {
    upPressed: false,
    downPressed: false
};

document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowUp') {
        keys.upPressed = true;
    } else if (event.key === 'ArrowDown') {
        keys.downPressed = true;
    }
});

document.addEventListener('keyup', function(event) {
    if (event.key === 'ArrowUp') {
        keys.upPressed = false;
    } else if (event.key === 'ArrowDown') {
        keys.downPressed = false;
    }
});

// Função para atualizar a posição da raquete do jogador e enviar ao servidor
function update() {
    if (keys.upPressed) {
        playerPosition -= 5; // Mover para cima
    } else if (keys.downPressed) {
        playerPosition += 5; // Mover para baixo
    }

    const playerData = {
        type: 'playerPosition',
        position: playerPosition
    };
    socket.send(JSON.stringify(playerData));

    // Atualizar a posição da raquete do jogador no jogo
    player.style.top = playerPosition + 'px';

    requestAnimationFrame(update);
}

//Modificar o evento 'message' para tratar as mensagens recebidas relacionadas ao lobby:
socket.addEventListener('message', function(event) {
    const data = JSON.parse(event.data);

    if (data.type === 'gameCreated') {
        // Partida criada, atualizar o estado do jogo no cliente
        gameId = data.gameId;
        inGame = true;
        // Atualizar a interface do jogo para exibir a tela de partida criada
        showGameCreatedScreen();
    } else if (data.type === 'gameJoined') {
        // Entrou em uma partida existente, atualizar o estado do jogo no cliente
        gameId = data.gameId;
    }
});

// Iniciar o loop do jogo
requestAnimationFrame(update);