import * as ort from 'onnxruntime-web';

export interface WasteDetection {
  label: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

export interface WasteDetectionResult {
  isWaste: boolean;
  message: string;
  callback: string;
  modelLoaded?: boolean;
  detections: WasteDetection[];
  primaryWaste?: {
    label: string;
    templateKey: string;
    confidence: number;
  };
}

const MODEL_PATH = '/models/trash_detector.onnx';
// Use 320 instead of 640 to reduce memory usage by 4x (avoid OOM crash)
// Use 640 for higher resolution detection (more detail)
const INPUT_SIZE = 640;
// Lower confidence threshold to capture more subtle items (increase recall)
const CONFIDENCE_THRESHOLD = 0.15;
// Slightly higher IoU to reduce overlapping boxes merging
const IOU_THRESHOLD = 0.55;
// Allow larger ratio before marking low confidence
const MIN_QUALITY_CONFIDENCE = 0.0; // Disabled low‑quality filter
const MAX_SAME_CLASS_RATIO = 2.0; // keep higher to avoid false low‑confidence

const LETTERBOX_VALUE = 114;

const WASTE_CLASSES: string[] = [
  'plastic',
  'glass',
  'paper',
  'cardboard',
  'metal',
  'trash'
];

const CLASS_TO_TEMPLATE: Record<string, { templateKey: string; label: string }> = {
  'plastic': { templateKey: 'plastic', label: 'Sampah Plastik' },
  'glass': { templateKey: 'glass', label: 'Sampah Kaca' },
  'paper': { templateKey: 'paper', label: 'Sampah Kertas' },
  'cardboard': { templateKey: 'paper', label: 'Sampah Kardus' },
  'metal': { templateKey: 'metal', label: 'Sampah Logam' },
  'trash': { templateKey: 'residue', label: 'Sampah Residu' },
};

let session: ort.InferenceSession | null = null;
let sessionPromise: Promise<ort.InferenceSession> | null = null;
let modelLoadError: string | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  // Return cached session
  if (session) return session;

  // If loading, wait for it
  if (sessionPromise) return sessionPromise;

  // Configure ONNX runtime: try WebGL first for GPU acceleration, fallback to WASM
  const providers: { name: string }[] = [];
  if ((ort as any).env && (ort as any).env.webgpu && (ort as any).env.webgpu.isSupported) {
    providers.push({ name: 'webgpu' }); // WebGPU if supported
  } else if (typeof WebGLRenderingContext !== 'undefined') {
    providers.push({ name: 'webgl' }); // WebGL fallback
  }
  // Always include WASM as final fallback
  providers.push({ name: 'wasm' });

  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;

  sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: providers.map(p => p.name),
    graphOptimizationLevel: 'basic',
    enableCpuMemArena: false,
    enableMemPattern: false,
  }).then(sess => {
    session = sess;
    modelLoadError = null;
    return sess;
  }).catch(err => {
    modelLoadError = err instanceof Error ? err.message : String(err);
    sessionPromise = null;
    throw err;
  });

  return sessionPromise;
}

function preprocessImage(img: HTMLImageElement): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const ratio = Math.min(INPUT_SIZE / imgW, INPUT_SIZE / imgH);
  const dw = (INPUT_SIZE - imgW * ratio) / 2;
  const dh = (INPUT_SIZE - imgH * ratio) / 2;

  ctx.fillStyle = `rgb(${LETTERBOX_VALUE},${LETTERBOX_VALUE},${LETTERBOX_VALUE})`;
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(img, dw, dh, imgW * ratio, imgH * ratio);

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = imageData.data;
  const total = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    input[i] = pixels[idx] / 255.0;           // R channel
    input[total + i] = pixels[idx + 1] / 255.0; // G channel
    input[2 * total + i] = pixels[idx + 2] / 255.0; // B channel
  }

  // Help GC
  canvas.width = 0;
  canvas.height = 0;

  return input;
}

function iou(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);

  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  const union = areaA + areaB - inter;

  return union > 0 ? inter / union : 0;
}

function nonMaxSuppression(
  detections: { box: number[]; score: number; classIdx: number }[]
): { box: number[]; score: number; classIdx: number }[] {
  detections.sort((a, b) => b.score - a.score);

  const keep: { box: number[]; score: number; classIdx: number }[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < detections.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(detections[i]);
    for (let j = i + 1; j < detections.length; j++) {
      if (suppressed.has(j)) continue;
      if (
        detections[i].classIdx === detections[j].classIdx &&
        iou(detections[i].box, detections[j].box) > IOU_THRESHOLD
      ) {
        suppressed.add(j);
      }
    }
  }

  return keep;
}

function parseYolov8Output(
  output: ort.Tensor
): { box: number[]; score: number; classIdx: number }[] {
  const data = output.data as Float32Array;
  const shape = output.dims;

  // YOLOv8 output shape: [1, num_classes+4, num_detections]
  // Transpose to iterate per detection
  const numBoxCoords = 4;
  const numClasses = shape[1] - numBoxCoords;
  const numDetections = shape[2];

  const detections: { box: number[]; score: number; classIdx: number }[] = [];

  for (let i = 0; i < numDetections; i++) {
    let maxClassScore = 0;
    let classIdx = 0;

    for (let c = 0; c < numClasses; c++) {
      // data is in [channel, detection] layout
      const score = data[(numBoxCoords + c) * numDetections + i];
      if (score > maxClassScore) {
        maxClassScore = score;
        classIdx = c;
      }
    }

    if (maxClassScore < CONFIDENCE_THRESHOLD) continue;

    const xCenter = data[0 * numDetections + i];
    const yCenter = data[1 * numDetections + i];
    const width = data[2 * numDetections + i];
    const height = data[3 * numDetections + i];

    const x1 = xCenter - width / 2;
    const y1 = yCenter - height / 2;
    const x2 = xCenter + width / 2;
    const y2 = yCenter + height / 2;

    detections.push({ box: [x1, y1, x2, y2], score: maxClassScore, classIdx });
  }

  return nonMaxSuppression(detections);
}

function getClassName(classIdx: number): string {
  return classIdx < WASTE_CLASSES.length ? WASTE_CLASSES[classIdx] : 'trash';
}

import { verifyWasteLabel } from "./gemini";
export async function detectWasteWithONNX(
  base64Image: string
): Promise<WasteDetectionResult> {
  let objectUrl: string | null = null;

  try {
    const sess = await getSession();

    // Decode base64 to Blob
    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    objectUrl = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl!;
    });

    const inputData = preprocessImage(img);
    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, INPUT_SIZE, INPUT_SIZE]);

    const feeds = { images: inputTensor };
    const results = await sess.run(feeds);

    const outputTensor =
      results['output0'] ||
      results[Object.keys(results)[0]];

    const rawDetections = parseYolov8Output(outputTensor);

    const detections: WasteDetection[] = rawDetections.map(d => ({
      label: getClassName(d.classIdx),
      confidence: d.score,
      bbox: { x1: d.box[0], y1: d.box[1], x2: d.box[2], y2: d.box[3] },
    }));

    const wasteDetections = detections.filter(d =>
      WASTE_CLASSES.includes(d.label.toLowerCase())
    );

    if (wasteDetections.length === 0) {
      return {
        isWaste: false,
        message: 'Sampah tidak terdeteksi',
        callback: 'bukan_sampah',
        modelLoaded: true,
        detections: [],
      };
    }

    const sorted = wasteDetections.sort((a, b) => b.confidence - a.confidence);
    const best = sorted[0];

    const totalConf = wasteDetections.reduce((s, d) => s + d.confidence, 0);
    const avgConf = totalConf / wasteDetections.length;
    const bestRatio = best.confidence / avgConf;

    const template =
      CLASS_TO_TEMPLATE[best.label.toLowerCase()] ||
      { templateKey: 'mixed', label: 'Sampah Campuran' };

    const isUncertain = bestRatio > MAX_SAME_CLASS_RATIO && wasteDetections.length > 1;
    const isLowQuality = best.confidence < MIN_QUALITY_CONFIDENCE;

    // Jika confidence rendah, gunakan Gemini untuk verifikasi label
    let finalLabel = template.label;
    if (best.confidence < 0.6) {
      try {
        const refined = await verifyWasteLabel(base64Image, best.label);
        if (refined && refined !== best.label) {
          const refinedTemplate = CLASS_TO_TEMPLATE[refined.toLowerCase()] || { templateKey: 'mixed', label: refined };
          finalLabel = refinedTemplate.label;
          const newTemplateKey = refinedTemplate.templateKey;
          return {
            isWaste: true,
            message: `Sampah terdeteksi: ${finalLabel} (${(best.confidence * 100).toFixed(1)}%)`,
            callback: isLowQuality || isUncertain ? 'low_confidence' : 'sampah_terdeteksi',
            modelLoaded: true,
            detections: wasteDetections,
            primaryWaste: {
              label: finalLabel,
              templateKey: newTemplateKey,
              confidence: best.confidence,
            },
          };
        }
      } catch (e) {
        console.error('Gemini verification failed:', e);
      }
    }

    // fallback ke hasil ONNX
    return {
      isWaste: true,
      message: `Sampah terdeteksi: ${template.label} (${(best.confidence * 100).toFixed(1)}%)`,
      callback: isLowQuality || isUncertain ? 'low_confidence' : 'sampah_terdeteksi',
      modelLoaded: true,
      detections: wasteDetections,
      primaryWaste: {
        label: template.label,
        templateKey: template.templateKey,
        confidence: best.confidence,
      },
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('ONNX waste detection failed:', errorMsg);
    return {
      isWaste: false,
      message: 'Model deteksi gagal dimuat',
      callback: 'error',
      modelLoaded: false,
      detections: [],
    };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function isONNXModelAvailable(): boolean {
  return modelLoadError === null;
}