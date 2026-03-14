'use client';
import { useState } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const MAX = 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const d = await res.json();
        setError(d.error || 'Something went wrong');
      }
    } catch {
      setError('Network error, please try again');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
        <div style={{textAlign:'center',maxWidth:'500px'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>✨</div>
          <h1 style={{fontSize:'24px',fontWeight:'700',marginBottom:'12px',color:'#fff'}}>Confession Submitted!</h1>
          <p style={{color:'#aaa',marginBottom:'24px'}}>Your confession has been received. It will be reviewed and posted on <strong style={{color:'#fff'}}>@bu.confess</strong> soon.</p>
          <button onClick={() => { setText(''); setSubmitted(false); }}
            style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 24px',cursor:'pointer',fontWeight:'600'}}>Submit Another</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'600px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <h1 style={{fontSize:'32px',fontWeight:'800',color:'#fff',marginBottom:'8px'}}>BU Confessions</h1>
          <p style={{color:'#aaa'}}>Submit your anonymous confession. It will be reviewed before posting.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{background:'#1a1a1a',borderRadius:'16px',padding:'24px',border:'1px solid #333'}}>
            <label style={{display:'block',marginBottom:'8px',color:'#ccc',fontSize:'14px',fontWeight:'600'}}>YOUR CONFESSION</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Start typing your confession..."
              maxLength={MAX}
              rows={8}
              style={{width:'100%',background:'#111',color:'#fff',border:'1px solid #444',borderRadius:'8px',padding:'12px',fontSize:'16px',resize:'vertical',outline:'none',fontFamily:'inherit'}}
            />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'12px'}}>
              <span style={{color: text.length > MAX*0.9 ? '#f59e0b':'#666',fontSize:'13px'}}>{text.length}/{MAX}</span>
              {error && <span style={{color:'#ef4444',fontSize:'13px'}}>{error}</span>}
            </div>
            <button type="submit" disabled={loading || !text.trim()}
              style={{width:'100%',marginTop:'16px',background: loading || !text.trim() ? '#333':'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'14px',fontSize:'16px',fontWeight:'600',cursor: loading || !text.trim() ? 'not-allowed':'pointer',transition:'background 0.2s'}}>
              {loading ? 'Submitting...' : 'Submit Confession →'}
            </button>
          </div>
        </form>
        <p style={{textAlign:'center',color:'#555',fontSize:'12px',marginTop:'16px'}}>100% anonymous • @bu.confess</p>
      </div>
    </main>
  );
}
