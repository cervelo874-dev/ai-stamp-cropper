import { motion } from 'framer-motion';
import { useState } from 'react';
import { X, Edit2 } from 'lucide-react';
import type { SegmentedObject } from '../hooks/useObjectSegmenter';

interface ResultGridProps {
    items: SegmentedObject[];
    onRemove: (id: string) => void;
    onEdit: (item: SegmentedObject) => void;
    shape: 'original' | 'square' | 'circle';
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemAnim = {
    hidden: { y: 20, opacity: 0, scale: 0.8 },
    show: { y: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 100 } as any }
};

export const ResultGrid = ({ items, onRemove, onEdit, shape }: ResultGridProps) => {
    const [exportW, setExportW] = useState<number>(0);
    const [exportH, setExportH] = useState<number>(0);

    const downloadImage = async (url: string, id: string, format: 'original' | 'resized') => {
        if (format === 'original') {
            // Download original full quality PNG
            const link = document.createElement('a');
            link.href = url;
            link.download = `stamp-${id}.png`;
            link.click();
        } else {
            // Resize logic
            // If both 0, treat as original size (unconstrained) - but user clicked "RESIZED"
            // Let's assume if 0, it means "don't constrain this dimension".
            // If both are 0, we effectively do nothing but maybe re-encode? 
            // Let's just output original logic if both provided as 0 to be safe, 
            // OR strictly follow constraints. If 0, maybe treat as infinite?

            // Logic:
            // MaxW = exportW > 0 ? exportW : Infinity
            // MaxH = exportH > 0 ? exportH : Infinity

            const img = new Image();
            img.src = url;
            await new Promise(r => img.onload = r);

            let width = img.width;
            let height = img.height;

            const maxW = exportW > 0 ? exportW : Infinity;
            const maxH = exportH > 0 ? exportH : Infinity;

            const scaleW = maxW / width;
            const scaleH = maxH / height;

            // We want to fit within the box, so we take the smaller scale
            const scale = Math.min(scaleW, scaleH);

            // Only scale down if scale < 1. If scale > 1 (box is bigger than image), 
            // usually we don't upscale stamps, but maybe user wants it? 
            // Let's assuming scaling down to fit. If we want to allow upscale, we just apply scale.
            // Let's applied scale regardless, or maybe only if < 1?
            // "Resize to specified size". Let's apply scale.

            width *= scale;
            height *= scale;

            // Handle edge case where both are Infinity (both 0)
            if (scale === Infinity) {
                // Should fallback to original size
                width = img.width;
                height = img.height;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // High quality scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = newUrl;
                        link.download = `stamp-${id}-${Math.round(width)}x${Math.round(height)}.png`;
                        link.click();
                    }
                }, 'image/png'); // Force PNG format
            }
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Export Size Controls */}
            <div className="bg-neo-white border-b-2 border-black p-2 mb-2 flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold whitespace-nowrap">MAX SIZE (PX):</span>

                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold">W:</span>
                        <input
                            type="number"
                            value={exportW}
                            onChange={(e) => setExportW(Number(e.target.value))}
                            className="w-16 border-2 border-black px-1 font-bold text-center"
                            placeholder="0"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold">H:</span>
                        <input
                            type="number"
                            value={exportH}
                            onChange={(e) => setExportH(Number(e.target.value))}
                            className="w-16 border-2 border-black px-1 font-bold text-center"
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 overflow-y-auto"
            >
                {items.map((item) => (
                    <motion.div
                        key={item.id}
                        variants={itemAnim}
                        className="relative group neo-card p-2 flex items-center justify-center bg-[url('/transparent-bg.png')] bg-repeat"
                    >
                        {/* Checkerboard background */}
                        <div className="absolute inset-0 -z-10 opacity-20"
                            style={{
                                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                            }}
                        />

                        {/* Image with Shape Masking */}
                        <div className={`relative overflow-hidden ${shape === 'original' ? '' : 'aspect-square w-full flex items-center justify-center'} ${shape === 'circle' ? 'rounded-full border-2 border-black' : ''} ${shape === 'square' ? 'border-2 border-black' : ''}`}>
                            <img
                                src={item.url}
                                alt="stamp"
                                className={`max-w-full max-h-32 object-contain filter drop-shadow-lg transition-all ${shape !== 'original' ? 'w-full h-full object-cover' : ''}`}
                                style={{ objectFit: 'contain' }}
                            />
                        </div>

                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => downloadImage(item.url, item.id, 'original')}
                                    className="bg-neo-green border-2 border-black p-1 hover:bg-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-[10px] font-bold"
                                    title="Download Original (PNG)"
                                >
                                    PNG
                                </button>
                                <button
                                    onClick={() => downloadImage(item.url, item.id, 'resized')}
                                    className="bg-neo-blue border-2 border-black p-1 hover:bg-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-[10px] font-bold"
                                    title="Download Resized"
                                >
                                    RESIZED
                                </button>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => onEdit(item)}
                                    className="bg-neo-yellow border-2 border-black p-1 hover:bg-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                                    title="Edit Mask"
                                >
                                    <Edit2 size={16} color="black" />
                                </button>
                                <button
                                    onClick={() => onRemove(item.id)}
                                    className="bg-neo-pink border-2 border-black p-1 hover:bg-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                                >
                                    <X size={16} color="black" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};
