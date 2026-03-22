import { useEffect, useRef, useState } from 'react';
import type { DealStatus } from '@/types/deal';
import { useDealStore } from '@/store/dealStore';

interface DealActionsProps {
  dealId: string;
  dealName: string;
  dealStatus: DealStatus;
  onClose: () => void;
}

const menuBtn: React.CSSProperties = {
  width: '100%', textAlign: 'left', padding: '5px 10px',
  fontSize: 9, color: 'var(--text-primary)', background: 'transparent',
  border: 'none', cursor: 'pointer', transition: 'background 0.1s',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '4px 8px', fontSize: 9,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
};

export function DealActions({ dealId, dealName, dealStatus, onClose }: DealActionsProps) {
  const [mode, setMode] = useState<'menu' | 'rename' | 'description' | 'confirm-delete'>('menu');
  const [inputValue, setInputValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (mode === 'rename' || mode === 'description') inputRef.current?.focus();
  }, [mode]);

  const handleRename = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    await useDealStore.getState().renameDeal(dealId, trimmed);
    onClose();
  };

  const handleDescription = async () => {
    await useDealStore.getState().updateDealDescription(dealId, inputValue.trim());
    onClose();
  };

  const handleArchiveToggle = async () => {
    if (dealStatus === 'archived') {
      const deals = useDealStore.getState().deals;
      const deal = deals.find((d) => d.id === dealId);
      if (deal) {
        const updated = { ...deal, status: 'active' as DealStatus, updatedAt: Date.now() };
        const { getPersistence } = await import('@/services/persistence/adapter');
        const persistence = getPersistence();
        await persistence.set('deals', dealId, updated);
        useDealStore.setState((state) => ({
          deals: state.deals.map((d) => (d.id === dealId ? updated : d)),
        }));
      }
    } else {
      await useDealStore.getState().archiveDeal(dealId);
    }
    onClose();
  };

  const handleDelete = async () => {
    const store = useDealStore.getState();
    if (store.activeDealId === dealId) {
      const otherDeal = store.deals.find((d) => d.id !== dealId && d.status === 'active');
      if (otherDeal) { await store.switchDeal(otherDeal.id); }
      else { await store.ensureDefaultDeal(); const freshState = useDealStore.getState(); const defaultDeal = freshState.deals.find((d) => d.id === 'default'); if (defaultDeal) await store.switchDeal(defaultDeal.id); }
    }
    await useDealStore.getState().softDeleteDeal(dealId);
    onClose();
  };

  const primaryBtn: React.CSSProperties = {
    flex: 1, padding: '3px 8px', fontSize: 7, fontFamily: 'var(--font-pixel)',
    backgroundColor: 'var(--accent-gold)', color: 'var(--bg-dark)',
    border: 'none', borderRadius: 3, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
  };

  const cancelBtn: React.CSSProperties = {
    flex: 1, padding: '3px 8px', fontSize: 7, fontFamily: 'var(--font-pixel)',
    color: 'var(--text-secondary)', background: 'transparent', border: 'none',
    cursor: 'pointer', letterSpacing: 1,
  };

  return (
    <div ref={dropdownRef} onClick={(e) => e.stopPropagation()} style={{
      position: 'absolute', right: 6, top: 24, width: 140,
      backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 30,
      overflow: 'hidden',
    }}>
      {mode === 'menu' && (
        <>
          <button style={menuBtn} onClick={() => { setInputValue(dealName); setMode('rename'); }}>Rename</button>
          <button style={menuBtn} onClick={() => { setInputValue(''); setMode('description'); }}>Description</button>
          <button style={menuBtn} onClick={() => void handleArchiveToggle()}>
            {dealStatus === 'archived' ? 'Unarchive' : 'Archive'}
          </button>
          <button style={{ ...menuBtn, color: 'var(--accent-coral)' }} onClick={() => setMode('confirm-delete')}>Delete</button>
        </>
      )}

      {mode === 'rename' && (
        <div style={{ padding: 8 }}>
          <input ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(); if (e.key === 'Escape') onClose(); }}
            style={inputStyle} placeholder="Deal name..." />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button style={primaryBtn} onClick={() => void handleRename()} disabled={!inputValue.trim()}>SAVE</button>
            <button style={cancelBtn} onClick={onClose}>CANCEL</button>
          </div>
        </div>
      )}

      {mode === 'description' && (
        <div style={{ padding: 8 }}>
          <input ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleDescription(); if (e.key === 'Escape') onClose(); }}
            style={inputStyle} placeholder="Brief description..." />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button style={primaryBtn} onClick={() => void handleDescription()}>SAVE</button>
            <button style={cancelBtn} onClick={onClose}>CANCEL</button>
          </div>
        </div>
      )}

      {mode === 'confirm-delete' && (
        <div style={{ padding: 8 }}>
          <p style={{ fontSize: 8, color: 'var(--text-secondary)', marginBottom: 6, margin: 0 }}>
            Delete &apos;{dealName}&apos;? Cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button style={{ ...primaryBtn, backgroundColor: 'var(--accent-coral)' }} onClick={() => void handleDelete()}>DELETE</button>
            <button style={cancelBtn} onClick={onClose}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}
