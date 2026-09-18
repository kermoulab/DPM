import React from 'react';
import { Search, X, User, ShoppingBag, Box, Layers, ArrowRight } from 'lucide-react';
import { api } from '../api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, id?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Keyboard shortcut listener
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.search(val);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <User size={15} className="text-emerald-500" />;
      case 'order':
        return <ShoppingBag size={15} className="text-blue-500" />;
      case 'product':
        return <Box size={15} className="text-purple-500" />;
      default:
        return <Layers size={15} className="text-amber-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="global-search-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-900/40 backdrop-blur-xs p-4"
    >
      <div
        id="global-search-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Type to search customers, orders, license keys, products..."
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-400">Searching database...</div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((res, i) => (
                <div
                  key={i}
                  onClick={() => {
                    onClose();
                    const tab = res.type === 'customer' ? 'customers' : res.type === 'order' ? 'orders' : res.type === 'product' ? 'products' : 'inventory';
                    onNavigate(tab, res.id);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-white transition shadow-2xs">
                      {getIcon(res.type)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition">
                        {res.title}
                      </p>
                      <p className="text-[11px] text-slate-400">{res.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {res.type}
                    </span>
                    <ArrowRight size={13} className="text-slate-300 group-hover:text-blue-600 transition" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching records found in database for "{query}".
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              Search by customer name, order number, product, or account login.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
