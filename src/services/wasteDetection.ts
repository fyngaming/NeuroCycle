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
  detections: WasteDetection[];
  primaryWaste?: {
    label: string;
    templateKey: string;
    confidence: number;
  };
}

const MODEL_PATH = '/models/trash_detector.onnx';
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.45;
const IOU_THRESHOLD = 0.45;

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

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['wasm', 'cpu'],
    });
  }
  return sessionPromise;
}

function preprocessImage(img: HTMLImageElement): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const input = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let h = 0; h < INPUT_SIZE; h++) {
    for (let w = 0; w < INPUT_SIZE; w++) {
      const idx = (h * INPUT_SIZE + w) * 4;
      input[h * INPUT_SIZE + w] = imageData.data[idx] / 255.0;
      input[INPUT_SIZE * INPUT_SIZE + h * INPUT_SIZE + w] = imageData.data[idx + 1] / 255.0;
      input[2 * INPUT_SIZE * INPUT_SIZE + h * INPUT_SIZE + w] = imageData.data[idx + 2] / 255.0;
    }
  }
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

function nonMaxSuppression(detections: { box: number[]; score: number; classIdx: number }[]): { box: number[]; score: number; classIdx: number }[] {
  detections.sort((a, b) => b.score - a.score);

  const keep: { box: number[]; score: number; classIdx: number }[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < detections.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(detections[i]);
    for (let j = i + 1; j < detections.length; j++) {
      if (suppressed.has(j)) continue;
      if (detections[i].classIdx === detections[j].classIdx && iou(detections[i].box, detections[j].box) > IOU_THRESHOLD) {
        suppressed.add(j);
      }
    }
  }

  return keep;
}

function parseYolov8Output(output: ort.Tensor): { box: number[]; score: number; classIdx: number }[] {
  const data = output.data as Float32Array;
  const shape = output.dims;
  
  const numClasses = shape[1] - 4;
  const numDetections = shape[2];

  const detections: { box: number[]; score: number; classIdx: number }[] = [];

  for (let i = 0; i < numDetections; i++) {
    const offset = i * shape[1];
    
    const xCenter = data[offset];
    const yCenter = data[offset + 1];
    const width = data[offset + 2];
    const height = data[offset + 3];

    let maxClassScore = 0;
    let classIdx = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[offset + 4 + c];
      if (score > maxClassScore) {
        maxClassScore = score;
        classIdx = c;
      }
    }

    if (maxClassScore < CONFIDENCE_THRESHOLD) continue;

    const x1 = xCenter - width / 2;
    const y1 = yCenter - height / 2;
    const x2 = xCenter + width / 2;
    const y2 = yCenter + height / 2;

    detections.push({
      box: [x1, y1, x2, y2],
      score: maxClassScore,
      classIdx,
    });
  }

  return nonMaxSuppression(detections);
}

function getClassName(classIdx: number): string {
  if (classIdx < WASTE_CLASSES.length) {
    return WASTE_CLASSES[classIdx];
  }
  return 'trash';
}

export async function detectWasteWithONNX(base64Image: string): Promise<WasteDetectionResult> {
  try {
    const session = await getSession();

    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    const inputTensor = new ort.Tensor('float32', preprocessImage(img), [1, 3, INPUT_SIZE, INPUT_SIZE]);

    const feeds = { images: inputTensor };
    const results = await session.run(feeds);

    const outputTensor = results['output0'] || results['images'] || Object.values(results)[0];
    const rawDetections = parseYolov8Output(outputTensor);

    URL.revokeObjectURL(url);

    const detections: WasteDetection[] = rawDetections.map(d => ({
      label: getClassName(d.classIdx),
      confidence: d.score,
      bbox: { x1: d.box[0], y1: d.box[1], x2: d.box[2], y2: d.box[3] },
    }));

    const wasteDetections = detections.filter(d => {
      const className = d.label.toLowerCase();
      return WASTE_CLASSES.includes(className);
    });

    if (wasteDetections.length === 0) {
      return {
        isWaste: false,
        message: 'Sampah tidak terdeteksi',
        callback: 'bukan_sampah',
        detections: [],
      };
    }

    const best = wasteDetections.sort((a, b) => b.confidence - a.confidence)[0];
    const template = CLASS_TO_TEMPLATE[best.label.toLowerCase()] || { templateKey: 'mixed', label: 'Sampah Campuran' };

    return {
      isWaste: true,
      message: `Sampah terdeteksi: ${template.label} (${(best.confidence * 100).toFixed(1)}%)`,
      callback: 'sampah_terdeteksi',
      detections: wasteDetections,
      primaryWaste: {
        label: template.label,
        templateKey: template.templateKey,
        confidence: best.confidence,
      },
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('ONNX waste detection failed:', errorMsg);
    return {
      isWaste: false,
      message: 'Model deteksi gagal',
      callback: 'error',
      detections: [],
    };
  }
}

export function isONNXModelAvailable(): boolean {
  return true;
}
