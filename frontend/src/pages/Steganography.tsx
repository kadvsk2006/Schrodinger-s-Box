import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, EyeOff, Eye, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { generateKeys, hideStegoMessage, extractStegoMessage } from '../api/client';

export default function Steganography() {
  const [activeTab, setActiveTab] = useState<'hide' | 'extract'>('hide');
  
  // Shared state
  const [sessionId, setSessionId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Hide State
  const [messageToHide, setMessageToHide] = useState('');
  const [generatedSeed, setGeneratedSeed] = useState<string | undefined>(undefined);
  const [stegoImageBlob, setStegoImageBlob] = useState<string | undefined>(undefined);
  
  // Extract State
  const [seedInput, setSeedInput] = useState('');
  const [extractedMessage, setExtractedMessage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const createAdhocSession = async () => {
    try {
      const keys = await generateKeys();
      setSessionId(keys.session_id);
    } catch (err) {
      setError("Failed to generate ad-hoc session keys.");
    }
  };

  const handleHide = async () => {
    if (!sessionId || !messageToHide || !imageFile) {
      setError("Missing properties. Need Session ID, Message, and Image.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('message', messageToHide);
      formData.append('image', imageFile);

      const blob: any = await hideStegoMessage(formData);
      
      // The custom property added in client.ts
      if (blob.quantumSeed) {
        setGeneratedSeed(blob.quantumSeed);
      }
      
      const imageUrl = URL.createObjectURL(blob);
      setStegoImageBlob(imageUrl);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to embed message");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtract = async () => {
    if (!sessionId || !seedInput || !imageFile) {
      setError("Missing properties. Need Session ID, Seed, and Stego Image.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('seed_b64', seedInput);
      formData.append('image', imageFile);

      const res = await extractStegoMessage(formData);
      if (res.success) {
        setExtractedMessage(res.plaintext);
      } else {
        setError("Extraction failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to extract message");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full border border-primary/20 mb-4">
          <EyeOff className="w-5 h-5" />
          <span className="font-mono text-sm tracking-wider uppercase">Q-Steg Protocol</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Quantum-Stealth <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Image Upload</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
          Embed AES-256 encrypted ciphertexts into normal images. The bits are scattered across the 
          image using a Qiskit true-random quantum seed, rendering the payload completely invisible to classical steganalysis.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex justify-center border-b border-primary/20">
        <button
          onClick={() => { setActiveTab('hide'); setError(null); }}
          className={"px-8 py-4 font-mono text-sm border-b-2 transition-colors " + (activeTab === 'hide' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-gray-300')}
        >
          <div className="flex items-center gap-2"><EyeOff className="w-4 h-4" /> Embed (Hide) Message</div>
        </button>
        <button
          onClick={() => { setActiveTab('extract'); setError(null); }}
          className={"px-8 py-4 font-mono text-sm border-b-2 transition-colors " + (activeTab === 'extract' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-gray-300')}
        >
          <div className="flex items-center gap-2"><Eye className="w-4 h-4" /> Extract Message</div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        
        {/* Left Column: Properties */}
        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-lg font-semibold font-mono flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Session Parameters
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground">Kyber+McEliece Session ID</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="PQC Session UUID"
                className="flex-1 input font-mono text-sm"
              />
              <button onClick={createAdhocSession} className="btn btn-secondary text-xs">Generate</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground">Cover Image (PNG/JPG)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-primary/20 border-dashed rounded-lg cursor-pointer bg-background/50 hover:bg-background/80 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-mono">
                  {imageFile ? imageFile.name : "Click to upload image"}
                </p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>

          {activeTab === 'hide' ? (
            <div className="space-y-2">
              <label className="text-sm font-mono text-muted-foreground">Secret Payload (Message)</label>
              <textarea 
                value={messageToHide}
                onChange={(e) => setMessageToHide(e.target.value)}
                className="input min-h-[100px] resize-y"
                placeholder="Enter highly classified text..."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-mono text-muted-foreground">Quantum Seed (Base64)</label>
              <textarea 
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                className="input font-mono text-xs text-accent"
                placeholder="Generated QRNG seed from encoder..."
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded border border-red-500/20 text-sm">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <button 
            onClick={activeTab === 'hide' ? handleHide : handleExtract}
            disabled={isProcessing}
            className={"btn w-full justify-center " + (activeTab === 'hide' ? 'btn-primary' : 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/50')}
          >
            {isProcessing ? "Processing Quantum Entanglement..." : (activeTab === 'hide' ? "Embed & Encrypt" : "Decrypt & Extract")}
          </button>
        </div>

        {/* Right Column: Results */}
        <div className="glass-panel p-6 flex flex-col justify-center items-center h-full min-h-[400px]">
          {activeTab === 'hide' && !stegoImageBlob && (
            <div className="text-center opacity-50 space-y-4">
              <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground" />
              <p className="font-mono text-sm">Awaiting cover image & payload...</p>
            </div>
          )}

          {activeTab === 'hide' && stegoImageBlob && (
            <div className="space-y-4 w-full animate-fade-in">
              <div className="bg-primary/10 border border-primary/20 rounded p-4 text-center">
                <ShieldCheck className="w-8 h-8 text-primary mx-auto mb-2" />
                <h4 className="font-bold text-lg text-primary">Steganography Complete</h4>
                <p className="text-xs text-muted-foreground">Data embedded invisibly via quantum seed.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase text-center block">Download Cover Image</label>
                <img src={stegoImageBlob} className="max-h-64 rounded border border-primary/20 mx-auto" />
                <div className="text-center mt-2">
                  <a href={stegoImageBlob} download="classified_quantum_stego.png" className="text-xs text-primary hover:underline font-mono">
                    Download image
                  </a>
                </div>
              </div>

              <div className="space-y-2 mt-6">
                <label className="text-xs font-mono text-muted-foreground uppercase">Required Quantum Extraction Seed</label>
                <div className="bg-background/80 p-3 rounded border border-primary/20 font-mono text-xs text-accent break-all select-all">
                  {generatedSeed}
                </div>
                <p className="text-xs text-muted-foreground text-center">Bob needs this seed + the PQC Session ID to extract the payload.</p>
              </div>
            </div>
          )}

          {activeTab === 'extract' && !extractedMessage && (
            <div className="text-center opacity-50 space-y-4">
              <Key className="w-16 h-16 mx-auto text-muted-foreground" />
              <p className="font-mono text-sm">Awaiting stego image, session ID, and quantum seed...</p>
            </div>
          )}

          {activeTab === 'extract' && extractedMessage && (
            <div className="w-full space-y-4 animate-fade-in">
              <div className="bg-accent/10 border border-accent/20 rounded p-4 text-center">
                <ShieldCheck className="w-8 h-8 text-accent mx-auto mb-2" />
                <h4 className="font-bold text-lg text-accent">Payload Extracted</h4>
              </div>
              <div className="bg-background/80 border border-accent/20 rounded p-6">
                <label className="text-xs font-mono text-muted-foreground mb-2 block uppercase text-accent">Decrypted Message Data</label>
                <div className="whitespace-pre-wrap text-sm text-gray-200">
                  {extractedMessage}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
