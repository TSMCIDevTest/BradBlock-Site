const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = {};

app.use(express.static('public')); // Serve static files (e.g., HTML, JS, etc.)

// Handle new player connection
io.on('connection', (socket) => {
  console.log(`Player ${socket.id} connected`);

  // Emit to the new player the list of current players
  socket.emit('currentPlayers', players);

  // When a player joins
  players[socket.id] = {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
  };

  // Notify all other clients about the new player
  socket.broadcast.emit('playerJoined', socket.id);

  // Handle player movement
  socket.on('move', (data) => {
    players[socket.id].position = data.position;
    players[socket.id].rotationY = data.rotationY;

    // Broadcast updated player state to all clients
    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      position: data.position,
      rotationY: data.rotationY,
    });
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Player ${socket.id} disconnected`);

    // Remove player from the list
    delete players[socket.id];

    // Notify other clients that the player has left
    io.emit('playerLeft', socket.id);
  });

  // Chat functionality
  socket.on('chat', (message) => {
    console.log(`Chat message from ${socket.id}: ${message}`);

    // Broadcast chat message to all connected clients
    io.emit('chat', { id: socket.id, message });
  });
});

// Start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
