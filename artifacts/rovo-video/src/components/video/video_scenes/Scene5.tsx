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
      <motion.img
        src="/rovo-logo.png"
        alt="ROVO"
        className="w-[32vw] h-[32vw] max-w-[480px] max-h-[480px] rounded-[2vw] object-cover"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 15 }}
      />
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