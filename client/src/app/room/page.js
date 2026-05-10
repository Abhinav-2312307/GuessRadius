'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Send, Crown, Info, X, Trophy } from 'lucide-react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export default function RoomPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('connecting'); // connecting, lobby, playing
  const [error, setError] = useState('');
  
  const [targetWordInput, setTargetWordInput] = useState('');
  const [myTargetWord, setMyTargetWord] = useState(null);
  
  const [guessInput, setGuessInput] = useState('');
  const [activeTab, setActiveTab] = useState(0); // Which player's list we are viewing
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showTopWords, setShowTopWords] = useState(false);
  const [topWordsList, setTopWordsList] = useState([]);

  // Initialize Socket
  useEffect(() => {
    const action = searchParams.get('action');
    const name = searchParams.get('name');
    const code = searchParams.get('code');

    if (!name || (action === 'join' && !code)) {
      router.push('/');
      return;
    }

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (action === 'create') {
        newSocket.emit('createRoom', { name }, (response) => {
          if (response.error) {
            setError(response.error);
          } else {
            setRoomId(response.roomId);
            setStatus('lobby');
          }
        });
      } else if (action === 'join') {
        newSocket.emit('joinRoom', { roomId: code, name }, (response) => {
          if (response.error) {
            setError(response.error);
          } else {
            setRoomId(response.roomId);
            setStatus('lobby');
          }
        });
      }
    });

    newSocket.on('roomUpdate', (data) => {
      setPlayers(Object.entries(data.players).map(([id, p]) => ({ id, ...p })));
      if (data.status === 'playing' && status !== 'playing') {
        setStatus('playing');
      }
    });

    newSocket.on('gameStart', () => {
      setStatus('playing');
    });

    return () => newSocket.disconnect();
  }, [searchParams, router]);

  const handleSetTargetWord = (e) => {
    e.preventDefault();
    if (!targetWordInput || !socket) return;
    setIsSubmitting(true);
    socket.emit('setTargetWord', { roomId, word: targetWordInput }, (response) => {
      setIsSubmitting(false);
      if (response.error) {
        alert(response.error);
      } else {
        setMyTargetWord(response.word);
      }
    });
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (!guessInput || !socket || isSubmitting) return;

    const normalizedGuess = guessInput.toLowerCase().trim();
    
    // Check for duplicate guess
    if (me && otherPlayers.length > 0) {
      const targetPlayerId = otherPlayers[activeTab].id;
      const alreadyGuessed = me.guesses.some(g => 
        g.targetPlayerId === targetPlayerId && g.word === normalizedGuess
      );
      
      if (alreadyGuessed) {
        alert("You have already guessed this word!");
        setGuessInput('');
        return;
      }
    }
    
    setIsSubmitting(true);
    socket.emit('guessWord', { roomId, word: guessInput }, (response) => {
      setIsSubmitting(false);
      if (response.error) {
        alert(response.error);
      }
      setGuessInput('');
    });
  };

  const handleViewTopWords = () => {
    if (!socket || otherPlayers.length === 0) return;
    socket.emit('getTopWords', { roomId, targetPlayerId: otherPlayers[activeTab].id }, (res) => {
      if (res.topWords) {
        setTopWordsList(res.topWords);
        setShowTopWords(true);
      }
    });
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--error)', marginBottom: '1rem' }}>Error</h2>
          <p>{error}</p>
          <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => router.push('/')}>Go Back</button>
        </div>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="title">Connecting...</div>
      </div>
    );
  }

  const myId = socket?.id;
  const otherPlayers = players.filter(p => p.id !== myId);
  const me = players.find(p => p.id === myId);
  const hasWonActiveTab = me && otherPlayers.length > 0 && me.guesses.some(g => g.targetPlayerId === otherPlayers[activeTab].id && g.rank === 1);

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem' }}>
        <h1 className="title" style={{ margin: 0, fontSize: '2rem' }}>WordRank</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--accent)" />
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Room: {roomId}</span>
          </div>
          {me && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Crown size={20} color="#facc15" />
              <span>Score: {me.score}</span>
            </div>
          )}
        </div>
      </header>

      {status === 'lobby' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Lobby</h2>
          
          <div style={{ marginBottom: '2rem', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} /> Players ({players.length})
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {players.map(p => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{p.name} {p.id === myId ? '(You)' : ''}</span>
                  <span style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '12px', background: p.targetWord ? 'var(--success)' : 'var(--surface-hover)' }}>
                    {p.targetWord ? 'Ready' : 'Thinking...'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!myTargetWord ? (
            <form onSubmit={handleSetTargetWord} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Choose a secret word for others to guess.</p>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter secret word..." 
                value={targetWordInput}
                onChange={e => setTargetWordInput(e.target.value)}
                disabled={isSubmitting}
                required
              />
              <button type="submit" className="btn-primary" disabled={isSubmitting || !targetWordInput}>
                Set Word
              </button>
            </form>
          ) : (
            <div>
              <p style={{ color: 'var(--success)', fontWeight: 'bold', marginBottom: '1rem' }}>Your word is set: {myTargetWord}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Waiting for other players...</p>
            </div>
          )}
        </motion.div>
      )}

      {status === 'playing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '2rem', flex: 1 }}>
          
          {/* Guessing Area */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
               {!hasWonActiveTab ? (
                 <form onSubmit={handleGuess} style={{ display: 'flex', gap: '1rem' }}>
                   <input 
                      type="text"
                      className="input-field"
                      placeholder="Type a word to guess..."
                      value={guessInput}
                      onChange={e => setGuessInput(e.target.value)}
                      autoFocus
                   />
                   <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={isSubmitting || !guessInput}>
                     <Send size={18} /> Guess
                   </button>
                 </form>
               ) : (
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <p style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Trophy size={20} /> You found the word!
                   </p>
                   <button onClick={handleViewTopWords} className="btn-primary" style={{ background: 'var(--surface-hover)' }}>
                     View Top 1000 Words
                   </button>
                 </div>
               )}
            </div>

            {/* Tabs for other players */}
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>
               <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                 {otherPlayers.map((p, idx) => (
                    <button 
                      key={p.id}
                      onClick={() => setActiveTab(idx)}
                      style={{
                        padding: '1rem 1.5rem',
                        background: activeTab === idx ? 'rgba(255,255,255,0.05)' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === idx ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === idx ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '1.1rem',
                        fontWeight: activeTab === idx ? '600' : '400',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.name}'s Word
                    </button>
                 ))}
               </div>

               <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
                  {otherPlayers.length > 0 && me ? (
                     <GuessList 
                        guesses={me.guesses.filter(g => g.targetPlayerId === otherPlayers[activeTab].id)} 
                     />
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No other players to guess.</p>
                  )}
               </div>
            </div>
          </div>

          {/* Leaderboard Sidebar */}
          <div className="glass-panel" style={{ flex: 1, minWidth: '300px', height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Crown size={20} color="var(--accent)" /> Leaderboard
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[...players].sort((a,b) => b.score - a.score).map((p, i) => (
                <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: i === 0 ? '#facc15' : 'var(--text-secondary)' }}>
                     #{i + 1}
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                     <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Score: {p.score}</div>
                   </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      {/* Top 1000 Words Modal */}
      <AnimatePresence>
        {showTopWords && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Crown color="var(--accent)" /> Top 1000 Closest Words</h2>
                <button onClick={() => setShowTopWords(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
              </div>
              <div style={{ overflowY: 'auto', padding: '1rem 0', flex: 1 }}>
                {topWordsList.map((w, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontWeight: i === 0 ? 'bold' : 'normal', color: i === 0 ? 'var(--success)' : 'inherit', textTransform: 'capitalize' }}>{w.word}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{w.rank}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}

// Component to render a sorted list of guesses with animations
function GuessList({ guesses }) {
  // Sort guesses by rank ascending (1 is best)
  const sortedGuesses = [...guesses].sort((a, b) => a.rank - b.rank);

  if (guesses.length === 0) {
     return (
       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '1rem', opacity: 0.5 }}>
         <Info size={48} />
         <p>Make a guess to see how close you are!</p>
       </div>
     );
  }

  const getRankColorClass = (rank) => {
    if (rank === 1) return 'rank-1';
    if (rank <= 100) return 'rank-1-100';
    if (rank <= 500) return 'rank-100-500';
    if (rank <= 10000) return 'rank-500-10000';
    return 'rank-far';
  };

  const getBarWidth = (rank) => {
    // Inverse visual width logic. Rank 1 = 100%. Rank 10000 = 5%.
    const percentage = Math.max(5, 100 - (rank / 100)); 
    return `${percentage}%`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <AnimatePresence>
        {sortedGuesses.map((g) => (
          <motion.div 
            key={g.word}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Visual Bar */}
            <div style={{ 
              position: 'absolute', left: 0, top: 0, bottom: 0, 
              width: getBarWidth(g.rank), 
              background: g.rank === 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.03)',
              zIndex: 0 
            }} />
            
            <span style={{ position: 'relative', zIndex: 1, fontWeight: '500', fontSize: '1.1rem', textTransform: 'capitalize' }} className={getRankColorClass(g.rank)}>
              {g.word}
            </span>
            <span style={{ position: 'relative', zIndex: 1, fontFamily: 'monospace', fontSize: '1.1rem' }} className={getRankColorClass(g.rank)}>
              {g.rank}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
