import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { useVoiceStore } from '@/store/voiceStore';
import { Avatar } from '@/components/ui/Avatar';

// Discord-style incoming-call banner that rings until answered / declined.
export default function IncomingCallModal() {
  const incoming = useVoiceStore((s) => s.incomingCall);
  const navigate = useNavigate();

  // Auto–stop ringing after 30s (missed call).
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => useVoiceStore.getState().clearIncomingCall(), 30_000);
    return () => clearTimeout(t);
  }, [incoming?.dmId]);

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          className="glass-strong fixed bottom-6 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-4 rounded-2xl p-4 shadow-panel"
        >
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1, repeat: Infinity }} className="rounded-full ring-4 ring-success/50">
            <Avatar userId={incoming.callerId} name={incoming.callerName} size={52} />
          </motion.div>
          <div className="pr-2">
            <div className="text-sm font-bold text-content">{incoming.callerName}</div>
            <div className="flex items-center gap-1.5 text-xs text-success">
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1 w-1 rounded-full bg-success" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </span>
              Incoming voice call…
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => useVoiceStore.getState().clearIncomingCall()}
              className="grid h-11 w-11 place-items-center rounded-full bg-danger text-white transition hover:brightness-110"
              title="Decline"
            >
              <PhoneOff size={18} />
            </button>
            <motion.button
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              onClick={() => {
                const dmId = incoming.dmId;
                useVoiceStore.getState().clearIncomingCall();
                navigate(`/channels/@me/${dmId}`);
                void useVoiceStore.getState().joinDM(dmId);
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-success text-white transition hover:brightness-110"
              title="Accept"
            >
              <Phone size={18} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
