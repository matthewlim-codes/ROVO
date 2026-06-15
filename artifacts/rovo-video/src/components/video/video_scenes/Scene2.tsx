import { motion } from 'framer-motion';

export function Scene2() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0A]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.8, type: 'spring', damping: 25 }}
    >
      <motion.div className="text-[4vw] font-display font-bold text-white/80"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      >
        Random group chats?
      </motion.div>
      <motion.div className="text-[6vw] font-display font-black text-white mt-4 text-center leading-none"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
      >
        Tournament travel<br/>is chaotic.
      </motion.div>
    </motion.div>
  );
}