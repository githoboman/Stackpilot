import { useConnectWallet } from '@/lib/stacksWallet';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface StacksWalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin?: () => void;
}

/**
 * Stacks wallet connect modal. @stacks/connect renders its own wallet picker
 * (Leather / Xverse), so this is a thin launcher that opens it and closes on success.
 */
export function SuiWalletSelector({ isOpen, onClose, onBackToLogin }: StacksWalletSelectorProps) {
  const { mutateAsync: connect } = useConnectWallet();
  const modalRef = useRef<HTMLDivElement>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useGSAP(() => {
    if (isOpen) {
      gsap.fromTo(modalRef.current, { opacity: 0, scale: 0.95, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connect();
      onClose();
    } catch {
      /* user cancelled */
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 overflow-hidden bg-black/95 backdrop-blur-xl">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FF6A4D]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#246AFC]/20 rounded-full blur-[120px]" />
      </div>

      <div className="fixed top-0 left-0 right-0 p-8 flex justify-between items-center z-10">
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors font-medium text-sm group cursor-pointer"
        >
          <ChevronRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
      </div>

      <div ref={modalRef} className="relative w-full max-w-[340px] z-10">
        <div className="bg-[#070B0F] border border-white/10 rounded-[32px] p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          <h2 className="text-xl font-bold text-white text-center mb-6 tracking-tight">
            Connect your Stacks wallet
          </h2>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full group flex items-center justify-between p-3.5 rounded-full transition-all duration-300 cursor-pointer border bg-[#FF6A4D] border-transparent hover:bg-[#FF7A5E] disabled:opacity-60"
          >
            <span className="font-bold text-sm text-white pl-2">
              {connecting ? 'Opening wallet…' : 'Connect Leather / Xverse'}
            </span>
            <ChevronRight size={16} className="text-white/80 group-hover:translate-x-1 transition-all" />
          </button>

          <div className="text-center mt-6">
            <p className="text-white/40 font-bold text-[10px]">
              No wallet?{' '}
              <a href="https://leather.io" target="_blank" rel="noreferrer" className="text-[#FF9472] hover:underline">Install Leather</a>
              {' '}— set it to Testnet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
