import { motion } from 'framer-motion';

export const LoadingScreen = ({ progress, status }: { progress: number; status: string }) => {
    return (
        <div className="fixed inset-0 bg-neo-white flex flex-col items-center justify-center z-50">
            <div className="relative w-64 h-64 mb-8 flex items-center justify-center">

                {/* Geometric Cute Fish */}
                <motion.div
                    className="relative w-48 h-32"
                    animate={{ x: [-10, 10, -10], rotate: [-2, 2, -2] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Tail (Triangle) */}
                    <motion.div
                        className="absolute -left-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[30px] border-t-transparent border-b-[30px] border-b-transparent border-r-[40px] border-r-black"
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                        style={{ originX: 1 }} // Pivot at attachment
                    />
                    <motion.div
                        className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[20px] border-t-transparent border-b-[20px] border-b-transparent border-r-[30px] border-r-white"
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                        style={{ originX: 1 }}
                    />

                    {/* Body (Ellipse/Rounded Rect) */}
                    <div className="absolute inset-0 bg-white border-4 border-black rounded-[60px_60px_40px_40px] z-10 overflow-hidden">
                        {/* Scales Pattern */}
                        <div className="absolute inset-0 opacity-10"
                            style={{ backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2.5px)', backgroundSize: '12px 12px' }}
                        />

                        {/* Gill line */}
                        <div className="absolute right-16 top-4 bottom-4 w-4 border-l-4 border-black rounded-[50%]" />
                    </div>

                    {/* Fin (Top) */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[30px] border-b-black" />
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[24px] border-b-white z-0" />

                    {/* Fin (Side/Pectoral) - Flapping */}
                    <motion.div
                        className="absolute top-1/2 left-1/2 w-12 h-8 bg-white border-4 border-black rounded-[50%_50%_50%_50%_/_30%_30%_70%_70%] z-20 origin-top"
                        animate={{ rotateX: [0, 60, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                    />

                    {/* Eye */}
                    <div className="absolute top-8 right-8 w-8 h-8 bg-black rounded-full z-20 flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rounded-full translate-x-1 -translate-y-1" />
                    </div>

                    {/* Mouth */}
                    <div className="absolute top-[60%] right-2 w-6 h-4 border-b-4 border-black rounded-full" />

                </motion.div>

                {/* Geometric Bubbles */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute w-6 h-6 border-4 border-black bg-white rounded-full z-0"
                        style={{ right: '0%', top: '20%' }}
                        animate={{
                            y: -120 - (i * 40),
                            x: Math.sin(i * 2) * 20 + 20,
                            opacity: [0, 1, 0],
                            scale: [0.5, 1]
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            delay: i * 0.8,
                            ease: "easeOut"
                        }}
                    />
                ))}
            </div>

            <div className="w-80 space-y-4">
                <div className="text-xl font-black font-mono uppercase text-center tracking-widest flex items-center justify-center gap-2">
                    {/* Bouncing Dots */}
                    <span>{status === 'downloading' ? 'DOWNLOADING' : 'PROCESSING'}</span>
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>.</motion.span>
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                </div>

                {/* Geo-Progress Bar */}
                <div className="w-full h-8 border-4 border-black bg-white shadow-neo p-1">
                    <motion.div
                        className="h-full bg-neo-green border-r-4 border-black"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: 'spring', damping: 20 }}
                    />
                </div>
                <div className="text-right font-black font-mono text-2xl">{Math.round(progress)}%</div>
            </div>
        </div>
    );
};
