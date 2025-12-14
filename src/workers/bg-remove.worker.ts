import { env, AutoModel, AutoProcessor, RawImage } from '@xenova/transformers';

// Skip local checks for faster loading in some environments, but for web it's mostly about CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

class BackgroundRemover {
    static instance: any = null;

    static async getInstance(progress_callback: Function) {
        if (this.instance === null) {
            // Load model and processor
            const model_id = 'briaai/RMBG-1.4';

            this.instance = {
                model: await AutoModel.from_pretrained(model_id, {
                    progress_callback,
                    // Quantized version is usually default and smaller
                }),
                processor: await AutoProcessor.from_pretrained(model_id),
            };
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    if (type === 'process') {
        try {
            const { imageUrl } = data;

            // Notify start
            self.postMessage({ type: 'status', data: { status: 'loading' } });

            const remover = await BackgroundRemover.getInstance((data: any) => {
                self.postMessage({ type: 'status', data: { ...data, status: 'downloading' } });
            });

            self.postMessage({ type: 'status', data: { status: 'processing' } });

            // Load image
            const image = await RawImage.fromURL(imageUrl);

            // Pre-process
            const { pixel_values } = await remover.processor(image);

            // Inference
            const { output } = await remover.model({ input: pixel_values });

            // Post-process (get mask)
            // The output of RMBG-1.4 is usually a single channel mask or RGBA. 
            // For briaai/RMBG-1.4, the output is a mask. We need to apply it.

            // Wait, transformers.js v3 might handle this differently? 
            // Assuming standard output structure. 
            // We need to resize mask to original image size and apply.

            const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);

            // Create new RGBA image
            const canvas = new OffscreenCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context null');

            // Draw original
            const originalCanvas = new OffscreenCanvas(image.width, image.height);
            const originalCtx = originalCanvas.getContext('2d');
            originalCtx?.drawImage(image.toCanvas(), 0, 0);
            const originalData = originalCtx?.getImageData(0, 0, image.width, image.height);

            // Draw mask
            ctx.drawImage(mask.toCanvas(), 0, 0);
            const maskData = ctx.getImageData(0, 0, image.width, image.height);

            if (originalData && maskData) {
                for (let i = 0; i < originalData.data.length; i += 4) {
                    // Verify mask channel (usually 0, 1, 2 are same for grayscale mask)
                    const alpha = maskData.data[i];
                    originalData.data[i + 3] = alpha; // Apply mask to alpha
                }
                ctx.putImageData(originalData, 0, 0);
            }

            const bitmap = canvas.transferToImageBitmap();

            (self as any).postMessage({ type: 'complete', data: { bitmap } }, [bitmap]);

        } catch (error) {
            console.error(error);
            self.postMessage({ type: 'error', data: error });
        }
    }
});
