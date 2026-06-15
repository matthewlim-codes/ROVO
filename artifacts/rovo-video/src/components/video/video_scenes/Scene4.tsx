import { motion } from 'framer-motion';

export function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex gap-8">
        {['Post Trip', 'Get Matched', 'Ride Together'].map((text, i) => (
          <motion.div 
            key={i}
            className="px-8 py-4 border-2 border-[#22C55E] rounded-full text-[2vw] text-white"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.5 + 0.5, type: 'spring', damping: 15 }}
          >
            {text}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}