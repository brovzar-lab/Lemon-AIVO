import { useEffect, useRef, useState } from 'react';
import { useDealStore } from '@/store/dealStore';

interface CreateDealFormProps {
  onCreated: (dealId: string) => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '4px 8px', fontSize: 9,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-primary)',
  outline: 'none', marginBottom: 4,
};

export function CreateDealForm({ onCreated, onCancel }: CreateDealFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;
    setCreating(true);
    try {
      const dealId = await useDealStore.getState().createDeal(trimmedName, description.trim() || undefined);
      onCreated(dealId);
    } finally { setCreating(false); }
  };

  return (
    <div data-testid="create-deal-form" style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
      <input
        ref={nameRef} type="text" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); if (e.key === 'Escape') onCancel(); }}
        style={inputStyle} placeholder="Deal name..."
      />
      <input
        type="text" value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); if (e.key === 'Escape') onCancel(); }}
        style={inputStyle} placeholder="Brief description..."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || creating}
          style={{
            padding: '3px 10px', fontSize: 7, fontFamily: 'var(--font-pixel)',
            backgroundColor: 'var(--accent-gold)', color: 'var(--bg-dark)',
            border: 'none', borderRadius: 3, fontWeight: 700, cursor: 'pointer',
            letterSpacing: 1, opacity: (!name.trim() || creating) ? 0.5 : 1,
          }}
        >
          {creating ? 'CREATING...' : 'CREATE'}
        </button>
        <button
          onClick={onCancel}
          style={{
            fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)',
            background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: 1,
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
