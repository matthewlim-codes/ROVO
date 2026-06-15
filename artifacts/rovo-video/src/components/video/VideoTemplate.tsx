import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = { open: 4000, problem: 5000, solution: 6000, match: 5000, close: 4000 };

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A0A0A]">
      <div className="absolute inset-0">
        <motion.div className="absolute w-[80vw] h-[80vw] rounded-full opacity-20 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #22C55E, transparent)' }}
          animate={{ x: ['-20%', '50%', '-10%'], y: ['-20%', '30%', '-20%'], scale: [1, 1.2, 0.8] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} />
      </div>

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="problem" />}
        {currentScene === 2 && <Scene3 key="solution" />}
        {currentScene === 3 && <Scene4 key="match" />}
        {currentScene === 4 && <Scene5 key="close" />}
      </AnimatePresence>
    </div>
  );
}