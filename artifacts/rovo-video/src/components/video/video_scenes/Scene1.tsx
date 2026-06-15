import { motion } from 'framer-motion';

export function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8 }}
    >
      <motion.h1 
        className="text-[8vw] font-display font-bold text-white tracking-tighter"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', damping: 20 }}
      >
        ROVO
      </motion.h1>
      <motion.div 
        className="absolute bottom-[20%] text-[2vw] text-[#22C55E]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Your tournament rideshare crew
      </motion.div>
    </motion.div>
  );
}