import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { 
  getUsers, getConversations, createConversation, getMessages, 
  sendDirectMessage,
  DbUser, Conversation, DirectMessage 
} from '../api/client';
import { browserEncrypt, browserDecrypt } from '../api/clientCrypto';
import { Lock, User as UserIcon, Send, Shield, Zap, Copy, Plus, Check } from 'lucide-react';

export default function Messenger() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<DbUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [activePeer, setActivePeer] = useState<DbUser | null>(null);
  
  const [messages, setMessages] = useState<(DirectMessage & { plaintext?: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null!);

  // Offline Node Addition State
  const [trustedIds, setTrustedIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(`trustedIds_${user?.id}`) || '[]'); } 
    catch { return []; }
  });
  const [addNodeInput, setAddNodeInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  const trustedUsers = users.filter(u => trustedIds.includes(u.id));

  const myIdentityCode = `SBX-${btoa(user?.username || '')}`;
  const copyIdentity = () => {
    navigator.clipboard.writeText(myIdentityCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNodeInput) return;
    try {
      const uNameBase64 = addNodeInput.replace('SBX-', '');
      const decodedName = atob(uNameBase64);
      const foundUser = users.find(u => u.username === decodedName);
      if (foundUser) {
        if (!trustedIds.includes(foundUser.id)) {
          const newIds = [...trustedIds, foundUser.id];
          setTrustedIds(newIds);
          localStorage.setItem(`trustedIds_${user?.id}`, JSON.stringify(newIds));
        }
        setAddNodeInput('');
      } else {
        alert('Node not found on the live network. Or offline code is invalid.');
      }
    } catch (err) {
      alert('Invalid offline code format.');
    }
  };

  // Initialize Data
  useEffect(() => {
    if (!token || !user) return;
    const init = async () => {
      try {
        const resp = await getUsers() as any;
        const uList = Array.isArray(resp) ? resp : (resp.users || []);
        setUsers(uList);
      } catch (uErr) {
        console.error('User fetch failed', uErr);
      }

      try {
        const c = await getConversations();
        setConversations(c);
      } catch (cErr) {
        console.error('Convs fetch failed', cErr);
      }
    };
    init();
  }, [token, user]);

  // Initialize WebSockets
  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/messenger/ws?token=${token}`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => console.log('WebSocket Connected');
    ws.current.onmessage = (_e) => { /* overridden by the effect below */ };
    ws.current.onclose = () => console.log('WebSocket Disconnected');

    return () => {
      ws.current?.close();
    };
  }, [token]);

  // WebSocket message handler — ALL decryption in browser
  useEffect(() => {
    if (!ws.current) return;
    ws.current.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'new_conversation') {
        setConversations(prev => [...prev, data.conversation]);
      } else if (data.type === 'new_message') {
        const c_id = data.conversation_id;
        const rawMsg = data.message;
        
        const targetConv = conversations.find(c => c.id === c_id);
        if (targetConv && activeConv && targetConv.id === activeConv.id) {
          try {
            // Decrypt entirely in browser — server never sees plaintext
            const plaintext = await browserDecrypt(
              targetConv.id,
              targetConv.my_encapsulated_key,
              rawMsg.ciphertext_b64
            );
            setMessages(prev => [...prev, { ...rawMsg, plaintext }]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          } catch (err) {
            setMessages(prev => [...prev, { ...rawMsg, plaintext: '[Decryption Error]' }]);
          }
        }
      }
    };
  }, [conversations, activeConv]);

  // Select a user to chat with
  const selectPeer = async (peer: DbUser) => {
    setActivePeer(peer);
    let conv = conversations.find(c => c.other_user.id === peer.id);
    if (!conv) {
      try {
        const resp = await createConversation({ recipient_id: peer.id });
        if (resp.session_key_b64) {
          conv = {
            id: resp.id,
            other_user: { id: peer.id, username: peer.username },
            my_encapsulated_key: resp.session_key_b64
          };
          setConversations(prev => [...prev, conv!]);
        }
      } catch (err) {
        console.error('Failed KEM exchange', err);
        return;
      }
    }
    
    if (conv) {
      setActiveConv(conv);
      // Fetch history — decrypt every message in browser
      const history = await getMessages(conv.id);
      const decryptedHistory = await Promise.all(history.map(async (m) => {
        try {
          const plaintext = await browserDecrypt(conv!.id, conv!.my_encapsulated_key, m.ciphertext_b64);
          return { ...m, plaintext };
        } catch {
          return { ...m, plaintext: '[Decryption Error]' };
        }
      }));
      setMessages(decryptedHistory);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv) return;
    
    const txt = inputText;
    setInputText('');
    setIsTyping(true);
    
    try {
      // Encrypt entirely in the browser — server never receives plaintext
      const ciphertext_b64 = await browserEncrypt(
        activeConv.id,
        activeConv.my_encapsulated_key,
        txt
      );
      
      await sendDirectMessage({
        conversation_id: activeConv.id,
        ciphertext_b64,
        signature_b64: null
      });
      
    } catch (err) {
      console.error('Encryption/Send Error', err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden bg-background">
      {/* Sidebar Directory */}
      <div className="w-80 border-r border-white/5 bg-[#0a0f1d] flex flex-col">
        <div className="p-4 border-b border-white/5 bg-black/20">
          <h2 className="font-mono font-bold text-[var(--neon-green)] flex items-center gap-2">
            <Lock className="w-4 h-4" /> SECURE_DIRECTORY
          </h2>
          
          {/* Offline Sync Controls */}
          <div className="mt-4 space-y-3">
            <button 
              onClick={copyIdentity}
              className="w-full text-xs font-mono font-bold border border-[var(--cyan)] text-[var(--cyan)] hover:bg-[var(--cyan)] hover:text-black py-2 rounded flex items-center justify-center gap-2 transition-all"
            >
              {copySuccess ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
              {copySuccess ? 'COPIED TO CLIPBOARD' : 'SHARE NODE IDENTITY'}
            </button>
            <form onSubmit={handleAddNode} className="flex gap-2">
              <input 
                type="text" value={addNodeInput} onChange={e => setAddNodeInput(e.target.value)}
                placeholder="Paste Peer Code..."
                className="flex-1 bg-black/40 border border-white/10 rounded px-2 w-full text-xs font-mono text-white focus:outline-none focus:border-[var(--green)]" 
              />
              <button type="submit" className="bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors" title="Add Node">
                <Plus className="w-3 h-3" />
              </button>
            </form>
          </div>

          <div className="text-[0.6rem] font-mono text-gray-500 mt-4 pt-3 border-t border-white/10 uppercase flex justify-between">
            <span>Trusted Nodes</span>
            <span>{trustedUsers.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {trustedUsers.map(u => {
            const isActive = activePeer?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => selectPeer(u)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)', fontSize: '0.8rem', borderRadius: 'var(--radius)',
                  background: isActive ? 'rgba(0,255,200,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(0,255,200,0.4)' : '1px solid transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease', cursor: 'pointer', marginBottom: '0.2rem'
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)',
                    border: isActive ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <UserIcon size={16} color={isActive ? 'var(--cyan)' : 'var(--text-muted)'} />
                  </div>
                  <span style={{ fontWeight: isActive ? 600 : 400, letterSpacing: '0.02em' }}>{u.username}</span>
                </div>
                {conversations.some(c => c.other_user.id === u.id) && (
                  <Shield size={14} color="var(--green)" />
                )}
              </button>
            );
          })}
          {trustedUsers.length === 0 && (
            <div className="text-center p-4">
              <div className="text-[var(--cyan)] opacity-50 mb-2 flex justify-center"><UserIcon size={24} /></div>
              <p className="text-xs font-mono text-gray-500 leading-relaxed">
                NO TRUSTED NODES.<br/>
                Add a peer using their offline identity code to establish a connection.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#050810]">
        {activePeer && activeConv ? (
          <>
            <div className="p-4 border-b border-white/5 bg-[#0a0f1d] flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-lg font-bold text-white">{activePeer.username}</h3>
                <span className="px-2 py-0.5 rounded bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 text-[var(--neon-green)] text-xs font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3" /> E2E BROWSER ENCRYPTED
                </span>
              </div>
              <div className="text-xs font-mono text-gray-500 flex items-center gap-1">
                <Zap className="w-3 h-3 text-[var(--cyber-blue)]" /> Kyber KEM · Browser AES-256-GCM
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <Shield className="w-12 h-12 text-[var(--cyber-blue)]" />
                  <p className="font-mono text-sm text-[var(--cyber-blue)]">
                    Quantum-Resistant KEM Tunnel Established.<br/>
                    All messages encrypted in your browser. Server sees only ciphertext.
                  </p>
                </div>
              )}
              {messages.map(m => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="text-[0.65rem] font-mono text-gray-500 mb-1 px-1">
                      {isMe ? 'YOU' : activePeer.username} &bull; {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={`px-4 py-3 rounded-lg max-w-[70%] font-mono text-sm ${isMe ? 'bg-[var(--cyber-blue)]/20 border border-[var(--cyber-blue)]/50 text-white rounded-tr-none' : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-none'}`}>
                      {m.plaintext}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/5 bg-[#0a0f1d]">
              <form onSubmit={handleSend} className="flex gap-2 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Transmit encrypted payload..."
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-[var(--cyber-blue)] transition-colors placeholder-gray-600"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  disabled={isTyping || !inputText.trim()}
                  className="bg-[var(--cyber-blue)] hover:bg-[#3FA0FF] text-black w-12 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Encrypt & Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-70 animate-pulse space-y-6">
            <div className="w-24 h-24 rounded-full border-2 border-[var(--cyan)] border-dashed flex items-center justify-center bg-[var(--cyan)]/5">
              <Lock className="w-10 h-10 text-[var(--cyan)]" />
            </div>
            <div className="text-center font-mono">
              <p className="text-[var(--cyan)] text-lg mb-2 tracking-widest">AWAITING CONNECTION</p>
              <p className="text-gray-400 text-sm">Select a trusted node from the Secure Directory on the left to establish an E2E tunnel.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
