'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Users } from 'lucide-react';

export default function Home() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!name) return;
    // We will pass the action to the room page via query params, 
    // or just let the room page handle the socket connection.
    router.push(`/room?name=${encodeURIComponent(name)}&action=create`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!name || !roomCode) return;
    router.push(`/room?name=${encodeURIComponent(name)}&action=join&code=${encodeURIComponent(roomCode)}`);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel"
        style={{ width: '100%', maxWidth: '480px' }}
      >
        <h1 className="title">WordRank</h1>
        <p className="subtitle">Multiplayer Contexto. Guess the secret words!</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              <User size={18} /> Your Name
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter your nickname..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)' }}>
            <button 
              style={{ 
                flex: 1, padding: '12px', background: 'none', border: 'none', 
                color: !isJoining ? 'var(--accent)' : 'var(--text-secondary)', 
                borderBottom: !isJoining ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: '500'
              }}
              onClick={() => setIsJoining(false)}
            >
              Create Room
            </button>
            <button 
              style={{ 
                flex: 1, padding: '12px', background: 'none', border: 'none', 
                color: isJoining ? 'var(--accent)' : 'var(--text-secondary)', 
                borderBottom: isJoining ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: '500'
              }}
              onClick={() => setIsJoining(true)}
            >
              Join Room
            </button>
          </div>

          {!isJoining ? (
            <motion.form 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <button type="submit" className="btn-primary" disabled={!name}>
                Create New Game
              </button>
            </motion.form>
          ) : (
            <motion.form 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  <Users size={18} /> Room Code
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. ABCD"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  style={{ textTransform: 'uppercase', letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={!name || roomCode.length !== 4}>
                Join Game
              </button>
            </motion.form>
          )}
        </div>
      </motion.div>
    </main>
  );
}
