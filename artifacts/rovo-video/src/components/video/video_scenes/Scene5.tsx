import { motion } from 'framer-motion';

export function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.h1 
        className="text-[10vw] font-display font-black text-white tracking-tighter"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 15 }}
      >
        ROVO
      </motion.h1>
      <motion.div 
        className="mt-4 text-[2vw] text-[#22C55E] font-medium tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        DOWNLOAD THE APP
      </motion.div>
    </motion.div>
  );
}