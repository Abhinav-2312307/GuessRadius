const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nlp = require('./nlp');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Game State
// rooms[roomId] = {
//   players: { socketId: { name: "Player1", targetWord: "apple", score: 0, guesses: [] } },
//   status: 'lobby' | 'playing' | 'finished'
// }
const rooms = {};

// Generate random 4-letter room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Start NLP Engine
console.log('Loading NLP Engine...');
nlp.init();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ name }, callback) => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      players: {},
      status: 'lobby'
    };
    rooms[roomId].players[socket.id] = {
      name,
      targetWord: null,
      score: 0,
      guesses: []
    };
    socket.join(roomId);
    callback({ roomId, players: Object.values(rooms[roomId].players) });
    io.to(roomId).emit('roomUpdate', { players: rooms[roomId].players, status: rooms[roomId].status });
  });

  socket.on('joinRoom', ({ roomId, name }, callback) => {
    roomId = roomId.toUpperCase();
    if (!rooms[roomId]) {
      return callback({ error: 'Room not found' });
    }
    if (rooms[roomId].status !== 'lobby') {
      return callback({ error: 'Game already in progress' });
    }
    
    rooms[roomId].players[socket.id] = {
      name,
      targetWord: null,
      score: 0,
      guesses: []
    };
    socket.join(roomId);
    callback({ roomId, players: Object.values(rooms[roomId].players) });
    io.to(roomId).emit('roomUpdate', { players: rooms[roomId].players, status: rooms[roomId].status });
  });

  socket.on('setTargetWord', ({ roomId, word }, callback) => {
    if (!rooms[roomId] || !rooms[roomId].players[socket.id]) return;
    
    // Normalize target word
    const normalizedWord = nlp.normalizeWord(word);
    
    if (!nlp.isWordInDictionary(normalizedWord)) {
       return callback({ error: 'Word not found in dictionary. Try a more common word.' });
    }

    rooms[roomId].players[socket.id].targetWord = normalizedWord;
    callback({ success: true, word: normalizedWord });

    io.to(roomId).emit('roomUpdate', { players: rooms[roomId].players, status: rooms[roomId].status });

    // Check if all players have set their word
    const allSet = Object.values(rooms[roomId].players).every(p => p.targetWord !== null);
    if (allSet && Object.values(rooms[roomId].players).length > 1) {
      rooms[roomId].status = 'playing';
      io.to(roomId).emit('gameStart', { players: rooms[roomId].players });
    }
  });

  socket.on('guessWord', async ({ roomId, word }, callback) => {
    if (!rooms[roomId] || rooms[roomId].status !== 'playing') return;

    const normalizedWord = nlp.normalizeWord(word);
    
    if (!nlp.isWordInDictionary(normalizedWord)) {
      return callback({ error: 'Word not found in dictionary.' });
    }

    const playerGuesses = {};
    let foundNew = false;
    
    // Process all target players
    for (const targetSocketId of Object.keys(rooms[roomId].players)) {
       if (targetSocketId === socket.id) continue;

       const targetPlayer = rooms[roomId].players[targetSocketId];
       const rank = await nlp.getRank(normalizedWord, targetPlayer.targetWord);
       
       playerGuesses[targetSocketId] = { word: normalizedWord, rank };

       if (rank === 1) {
          const alreadyFound = rooms[roomId].players[socket.id].guesses.some(g => g.targetPlayerId === targetSocketId && g.rank === 1);
          if (!alreadyFound) {
             rooms[roomId].players[socket.id].score += 1000;
             foundNew = true;
          }
       }
       
       rooms[roomId].players[socket.id].guesses.push({
          targetPlayerId: targetSocketId,
          word: normalizedWord,
          rank: rank
       });
    }

    callback({ success: true, guesses: playerGuesses });
    
    // Broadcast update to room (for scores and maybe live activity feed)
    io.to(roomId).emit('roomUpdate', { players: rooms[roomId].players, status: rooms[roomId].status });
    
    if (foundNew) {
       io.to(roomId).emit('playerFoundWord', { playerName: rooms[roomId].players[socket.id].name });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('roomUpdate', { players: rooms[roomId].players, status: rooms[roomId].status });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
