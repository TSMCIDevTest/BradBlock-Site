// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // serves index.html and game.js

const players = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  players[socket.id] = {
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
  };

  // Notify others
  socket.broadcast.emit('playerJoined', socket.id);

  // Send current players to new player (optional)
  for (const id in players) {
    if (id !== socket.id) {
      socket.emit('playerJoined', id);
    }
  }

  // When player moves
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id] = data;
      socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    socket.broadcast.emit('playerLeft', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
