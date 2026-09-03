import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { logError } from "../lib/errorLogger";
import { detectWasteWithONNX, isONNXModelAvailable } from "./wasteDetection";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '';

const genAI = new GoogleGenerativeAI(apiKey);
export { genAI };

// Fungsi untuk memverifikasi label sampah menggunakan Gemini
export async function verifyWasteLabel(base64Image: string, detectedLabel: string): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const prompt = `Apakah label "${detectedLabel}" tepat untuk gambar ini? Berikan nama kategori sampah yang paling tepat dalam Bahasa Indonesia, satu kata saja. Jika tidak cocok, beri label yang lebih sesuai.`;
    const result = await model.generateContent([
      {
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/jpeg',
        },
      },
      prompt,
    ]);
    const text = result.response?.text?.() ?? '';
    const refined = text.trim();
    return refined || null;
  } catch (e) {
    console.error('Gemini verification error:', e);
    return null;
  }
}


const DEBUG_WASTE = (import.meta.env && import.meta.env.VITE_WASTE_DEBUG === 'true') || (typeof process !== 'undefined' && process.env.VITE_WASTE_DEBUG === 'true');

export interface WasteAnalysis {
  isNotWaste?: boolean;
  name: string;
  category: "Organik" | "Residu" | "Anorganik" | "B3" | "Kertas" | "Plastik" | "Logam" | "Kaca" | "Bukan Sampah";
  composition: {
    material: string;
    percentage: number;
    description?: string;
  }[];
  disposalGuide: string;
  recyclable: boolean;
  accuracy: number;
  tips: string;
  environmentalImpact: string;
  creativeIdeas: string[];
  impactStats: {
    co2Saved: number;
    waterSaved: number;
    energySaved: number;
  };
}

const IMAGE_ANALYSIS_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

let localVisionModelPromise: Promise<any> | null = null;
let cocoModelPromise: Promise<any> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureTfBackend(): Promise<void> {
  try {
    if (!tf || !tf.setBackend) return;
    const preferred = ['webgl', 'cpu'];
    for (const b of preferred) {
      try {
        await tf.setBackend(b);
        await tf.ready();
        if (tf.getBackend && tf.getBackend() === b) return;
      } catch (e) {
        // try next
      }
    }
  } catch (e) {
    // ignore
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const ID_LABEL_MAP: Record<string, string> = {
  'botol plastik': 'Botol Plastik',
  'botol kaca': 'Botol Kaca',
  'galon plastik': 'Galon Plastik',
  'kantong plastik': 'Kantong Plastik',
  'kantong kertas': 'Kantong Kertas',
  'kardus': 'Kardus',
  'kotak karton': 'Kotak Karton',
  'buku': 'Buku',
  'buku tulis': 'Buku Tulis',
  'amplop': 'Amplop',
  'koran': 'Koran',
  'majalah': 'Majalah',
  'tisu': 'Tisu',
  'tisu toilet': 'Tisu Toilet',
  'handuk kertas': 'Handuk Kertas',
  'serbet': 'Serbet',
  'kaleng aluminium': 'Kaleng Aluminium',
  'kaleng': 'Kaleng',
  'kaleng soda': 'Kaleng Soda',
  'kaleng bir': 'Kaleng Bir',
  'kaleng minuman': 'Kaleng Minuman',
  'tutup botol': 'Tutup Botol',
  'gelas kaca': 'Gelas Kaca',
  'mangkuk/cangkir': 'Mangkuk/Cangkir',
  'mug': 'Mug',
  'teko': 'Teko',
  'teko listrik': 'Teko Listrik',
  'garpu': 'Garpu',
  'sendok': 'Sendok',
  'pisau': 'Pisau',
  'peralatan makan': 'Peralatan Makan',
  'piring': 'Piring',
  'wajan': 'Wajan',
  'panci': 'Panci',
  'panggangan': 'Panggangan',
  'mixer': 'Mixer',
  'blender': 'Blender',
  'microwave': 'Microwave',
  'kulkas': 'Kulkas',
  'mesin cuci': 'Mesin Cuci',
  'tv': 'TV',
  'monitor': 'Monitor',
  'keyboard': 'Keyboard',
  'mouse': 'Mouse',
  'remote': 'Remote',
  'hp': 'HP',
  'iphone': 'iPhone',
  'charger': 'Charger',
  'kabel': 'Kabel',
  'baterai': 'Baterai',
  'bohlam': 'Bohlam',
  'lampu': 'Lampu',
  'lilin': 'Lilin',
  'pena': 'Pena',
  'pensil': 'Pensil',
  'spidol': 'Spidol',
  'penghapus': 'Penghapus',
  'stapler': 'Stapler',
  'gunting': 'Gunting',
  'pita lakban': 'Pita Lakban',
  'lem': 'Lem',
  'cat': 'Cat',
  'semprotan cat': 'Semprotan Cat',
  'aerosol': 'Aerosol',
  'obat': 'Obat',
  'obat kaplet': 'Obat Kaplet',
  'perban': 'Perban',
  'suntikan': 'Suntikan',
  'termometer': 'Termometer',
  'cermin': 'Cermin',
  'bingkai foto': 'Bingkai Foto',
  'foto': 'Foto',
  'vas': 'Vas',
  'pot bunga': 'Pot Bunga',
  'jam': 'Jam',
  'jam tangan': 'Jam Tangan',
  'kacamata': 'Kacamata',
  'payung': 'Payung',
  'sepatu': 'Sepatu',
  'sepatu boot': 'Sepatu Boot',
  'sandal': 'Sandal',
  'sandal kaos': 'Sandal Kaos',
  'tas ransel': 'Tas Ransel',
  'tas': 'Tas',
  'dompet': 'Dompet',
  'ikat pinggang': 'Ikat Pinggang',
  'topi': 'Topi',
  'kaus kaki': 'Kaus Kaki',
  'dasi': 'Dasi',
  'kemeja': 'Kemeja',
  'celana': 'Celana',
  'jeans': 'Jeans',
  'gaun': 'Gaun',
  'rok': 'Rok',
  'jaket': 'Jaket',
  'mantel': 'Mantel',
  'sweater': 'Sweater',
  'hoodie': 'Hoodie',
  'handuk': 'Handuk',
  'selimut': 'Selimut',
  'bantal': 'Bantal',
  'bantal sofa': 'Bantal Sofa',
  'tirai': 'Tirai',
  'karpet': 'Karpet',
  'keranjang': 'Keranjang',
  'ember': 'Ember',
  'ember pel': 'Ember Pel',
  'tempat sampah': 'Tempat Sampah',
  'mainan': 'Mainan',
  'boneka': 'Boneka',
  'bola': 'Bola',
  'balon': 'Balon',
  'layang layang': 'Layang-layang',
  'buku komik': 'Buku Komik',
  'kamus': 'Kamus',
  'kalender': 'Kalender',
  'peta': 'Peta',
  'globe': 'Globe',
  'layar': 'Layar',
  'printer': 'Printer',
  'scanner': 'Scanner',
  'speaker': 'Speaker',
  'headphone': 'Headphone',
  'mikrofon': 'Mikrofon',
  'kamera': 'Kamera',
  'teropong': 'Teropong',
  'teleskop': 'Teleskop',
  'mikroskop': 'Mikroskop',
  'cincin': 'Cincin',
  'kalung': 'Kalung',
  'gelang': 'Gelang',
  'anting': 'Anting',
  'lencana': 'Lencana',
  'medali': 'Medali',
  'piala': 'Piala',
  'mahkota': 'Mahkota',
  'topeng': 'Topeng',
  'oxygen mask': 'Sampah Plastik',
  'mask': 'Sampah Medis/Plastik',
  'helm': 'Helm',
  'syal': 'Syal',
  'sarung tangan': 'Sarung Tangan',
  'kipas angin': 'Kipas Angin',
  'ac': 'AC',
  'pemanas': 'Pemanas',
  'vacuum': 'Vacuum',
  'sapu': 'Sapu',
  'pel': 'Pel',
  'spons': 'Spons',
  'sikat': 'Sikat',
  'sisir': 'Sisir',
  'sikat gigi': 'Sikat Gigi',
  'sikat rambut': 'Sikat Rambut',
  'timbangan': 'Timbangan',
  'penggaris': 'Penggaris',
  'meteran': 'Meteran',
  'lidah': 'Lidah',
  'ingkung': 'Ingkung',
  'obeng': 'Obeng',
  'palu': 'Palu',
  'kapak': 'Kapak',
  'gergaji': 'Gergaji',
  'bor': 'Bor',
  'tang': 'Tang',
  'senter': 'Senter',
  'lentera': 'Lentera',
  'korek api': 'Korek Api',
  'bara api': 'Bara Api',
  'asbak': 'Asbak',
  'tembakau': 'Tembakau',
  'rokok': 'Rokok',
  'vape': 'Vape',
  'pipa': 'Pipa',
  'shisha': 'Shisha',
  'pisang': 'Pisang',
  'apel': 'Apel',
  'jeruk': 'Jeruk',
  'jeruk lemon': 'Jeruk Lemon',
  'jeruk nipis': 'Jeruk Nipis',
  'stroberi': 'Stroberi',
  'nanas': 'Nanas',
  'semangka': 'Semangka',
  'kelapa': 'Kelapa',
  'jagung': 'Jagung',
  'wortel': 'Wortel',
  'kentang': 'Kentang',
  'jamur': 'Jamur',
  'telur': 'Telur',
  'roti': 'Roti',
  'keju': 'Keju',
  'pizza': 'Pizza',
  'burger': 'Burger',
  'hotdog': 'Hotdog',
  'es krim': 'Es Krim',
  'kue': 'Kue',
  'kopi': 'Kopi',
  'espresso': 'Espresso',
  'teh': 'Teh',
  'jus': 'Jus',
  'air': 'Air',
  'anggur': 'Anggur',
  'bir': 'Bir',
  'soda': 'Soda',
  'susu': 'Susu',
  'yoghurt': 'Yoghurt',
  'maduu': 'Madu',
  'gula': 'Gula',
  'garam': 'Garam',
  'lada': 'Lada',
  'minyak': 'Minyak',
  'saus': 'Saus',
  'saus tomat': 'Saus Tomat',
  'mustard': 'Mustard',
  'dressing': 'Dressing',
  'sup': 'Sup',
  'salad': 'Salad',
  'sushi': 'Sushi',
  'ramen': 'Ramen',
  'mie': 'Mie',
  'pasta': 'Pasta',
  'nasi': 'Nasi',
  'steak': 'Steak',
  'ayam': 'Ayam',
  'ikan': 'Ikan',
  'udang': 'Udang',
  'kepiting': 'Kepiting',
  'lobster': 'Lobster',
  'penyu': 'Penyu',
  'ular': 'Ular',
  'kadal': 'Kadal',
  'katak': 'Katak',
  'buaya': 'Buaya',
  'dinosaurus': 'Dinosaurus',
  'burung': 'Burung',
  'kakatua': 'Kakatua',
  'elang': 'Elang',
  'burung hantu': 'Burung Hantu',
  'penguin': 'Penguin',
  'flamin-go': 'Flamin-go',
  'angsa': 'Angsa',
  'bebek': 'Bebek',
  'kalkun': 'Kalkun',
  'ayam jantan': 'Ayam Jantan',
  'ayam betina': 'Ayam Betina',
  'sarang': 'Sarang',
  'laba-laba': 'Laba-laba',
  'serangga': 'Serangga',
  'semut': 'Semut',
  'lebah': 'Lebah',
  'kupu-kupu': 'Kupu-kupu',
  'ngengat': 'Ngengat',
  'capung': 'Capung',
  'kumbang': 'Kumbang',
  'kumbang cinderella': 'Kumbang Cinderella',
  'jangkrik': 'Jangkrik',
  'belalang': 'Belalang',
  'kecoa': 'Kecoa',
  'lalat': 'Lalat',
  'nyamuk': 'Nyamuk',
  'kutu': 'Kutu',
  'cacing': 'Cacing',
  'siput': 'Siput',
  'bintang laut': 'Bintang Laut',
   'karang': 'Karang',
  'ubur-ubur': 'Ubur-ubur',
  'gurita': 'Gurita',
  'cumi': 'Cumi',
  'kerang': 'Kerang',
  'tiram': 'Tiram',
  'cacing tanah': 'Cacing Tanah',
  'lintah': 'Lintah',
  'anemon laut': 'Anemon Laut',
  'bulu babi': 'Bulu Babi',
  'teripang': 'Teripang',
};

function formatLabel(label: string): string {
  const cleaned = label
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleaned) return "Sampah Visual";

  const direct = ID_LABEL_MAP[cleaned];
  if (direct) return direct;

  const words = cleaned.split(' ');

  for (const word of words) {
    const translated = ID_LABEL_MAP[word];
    if (translated) return translated;
  }

  const titleCase = words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return titleCase || "Sampah Visual";
}

function normalizeWasteAnalysis(analysis: WasteAnalysis, confidence: number): WasteAnalysis {
  const validCategories = ["Organik", "Residu", "Anorganik", "B3", "Kertas", "Plastik", "Logam", "Kaca", "Bukan Sampah"] as const;
  const category = (validCategories as readonly string[]).includes(analysis.category) ? analysis.category : "Anorganik";

  return {
    ...analysis,
    category,
    accuracy: clamp(confidence || analysis.accuracy || 0.5, 0.4, 0.96),
    composition: analysis.composition.length > 0
      ? analysis.composition.map(item => ({
          ...item,
          percentage: clamp(Number(item.percentage) || 0, 1, 100),
        }))
      : [{ material: "Material visual", percentage: 100 }],
    creativeIdeas: analysis.creativeIdeas.length > 0
      ? analysis.creativeIdeas.slice(0, 3)
      : ["Kumpulkan sesuai jenis material.", "Bersihkan sebelum digunakan ulang.", "Setor ke titik daur ulang terdekat."],
    impactStats: {
      co2Saved: Math.max(0, Number(analysis.impactStats.co2Saved) || 0),
      waterSaved: Math.max(0, Number(analysis.impactStats.waterSaved) || 0),
      energySaved: Math.max(0, Number(analysis.impactStats.energySaved) || 0),
    },
  };
}

const TEMPLATES: Record<string, WasteAnalysis> = {
  b3: {
    name: "Limbah B3",
    category: "B3",
    composition: [
      { material: "Limbah B3/rumah tangga berbahaya", percentage: 100, description: "Objek terdeteksi sebagai benda yang berpotensi berbahaya, seperti baterai, elektronik kecil, obat, atau kemasan kimia." },
    ],
    disposalGuide: "Jangan campurkan dengan sampah daur ulang. Simpan di wadah aman, tutup rapat, dan serahkan ke dropbox limbah B3 atau titik pengumpulan resmi.",
    recyclable: false,
    accuracy: 0.55,
    tips: "Hindari membuka, menusuk, membakar, atau membuang limbah B3 ke saluran air dan tempat sampah umum.",
    environmentalImpact: "Penyerahan limbah B3 ke titik resmi mencegah pencemaran tanah, air, dan udara.",
    creativeIdeas: [
      "Jangan gunakan ulang kemasan B3 untuk makanan atau minuman.",
      "Kumpulkan baterai bekas dalam wadah kering terpisah.",
      "Serahkan ke dropbox B3 terdekat sebelum menyetor sampah lain.",
    ],
    impactStats: { co2Saved: 5, waterSaved: 2, energySaved: 1 },
  },
  organic: {
    name: "Sampah Organik",
    category: "Organik",
    composition: [
      { material: "Bahan organik alami", percentage: 90, description: "Sisa makanan, kulit buah, daun, atau material alami yang mudah terurai." },
      { material: "Kotoran/kemasan kecil", percentage: 10, description: "Bagian non-organik yang sebaiknya dipisahkan sebelum pengolahan." },
    ],
    disposalGuide: "Pisahkan dari plastik dan logam. Gunakan untuk kompos, eco-enzyme, atau kumpulkan di titik sampah organik terdekat.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Potong menjadi ukuran kecil agar proses pengomposan lebih cepat dan tidak menimbulkan bau.",
    environmentalImpact: "Mengolah sampah organik menjadi kompos mengurangi emisi metana dari TPA.",
    creativeIdeas: [
      "Kulit buah bisa diolah menjadi eco-enzyme pembersih alami.",
      "Sisa sayur dan daun kering bisa menjadi bahan kompos rumah.",
      "Ampas kopi atau teh dapat dicampur ke media tanam sebagai pupuk ringan.",
    ],
    impactStats: { co2Saved: 45, waterSaved: 18, energySaved: 4 },
  },
  residue: {
    name: "Sampah Residu/Sisa Makanan",
    category: "Residu",
    composition: [
      { material: "Sisa makanan/residu organik", percentage: 100, description: "Limbah makanan mentah atau matang, potongan daging, tulang, sisa nasi, kulit buah, sayuran, dll." },
    ],
    disposalGuide: "Kumpulkan dalam wadah tertutup dan basah, pisahkan dari sampah plastik dan logam. Setor ke bank sampah dengan label Residu atau gunakan untuk pakan ternak/kompos.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Simpan di wadah tertutup untuk menghindari bau dan lalat. Bersihkan tangan setelah menangani. Sebaiknya dibuang dalam 2-3 hari untuk mencegah pembusukan berlebih.",
    environmentalImpact: "Mengelola residu makanan dengan baik mencegah pencemaran air dan tanah, serta dapat diolah menjadi biogas atau pupuk organik.",
    creativeIdeas: [
      "Sisa makanan dapat diolah menjadi eco-enzyme yang berguna untuk pembersih alami.",
      "Tulang dan cangkang dapat dikeringkan dan dibuat sebagai bahan pupuk organik berkualitas tinggi.",
      "Residu makanan dapat menjadi bahan pakan alternatif untuk ternak atau kompos rumahan.",
    ],
    impactStats: { co2Saved: 55, waterSaved: 20, energySaved: 5 },
  },
  paper: {
    name: "Sampah Kertas",
    category: "Kertas",
    composition: [
      { material: "Serat kertas/kardus", percentage: 88, description: "Material berbasis kertas yang dapat didaur ulang jika bersih dan kering." },
      { material: "Tinta, lem, atau lapisan tipis", percentage: 12, description: "Bagian yang dapat mengurangi kualitas daur ulang jika terlalu banyak." },
    ],
    disposalGuide: "Lipat agar rapi, jaga tetap kering, dan pisahkan dari sampah basah, minyak, atau plastik laminasi.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Kertas yang bersih dan kering memiliki nilai daur ulang lebih tinggi daripada kertas basah atau berminyak.",
    environmentalImpact: "Mendaur ulang kertas membantu mengurangi penebangan pohon dan penggunaan air produksi.",
    creativeIdeas: [
      "Kardus bekas bisa dijadikan kotak organizer meja.",
      "Kertas bekas dapat dijadikan kertas daur ulang dengan tekstur unik.",
      "Gulungan kertas atau kardus bisa dibuat menjadi pot kecil untuk semai tanaman.",
    ],
    impactStats: { co2Saved: 75, waterSaved: 42, energySaved: 7 },
  },
  metal: {
    name: "Sampah Logam",
    category: "Logam",
    composition: [
      { material: "Logam/aluminium/baja", percentage: 90, description: "Material logam yang bernilai tinggi untuk didaur ulang." },
      { material: "Cat, label, atau sisa isi", percentage: 10, description: "Bersihkan sisa isi agar lebih aman dan layak daur ulang." },
    ],
    disposalGuide: "Kosongkan dan bilas jika ada sisa makanan/minuman. Kumpulkan kaleng atau logam kecil dalam wadah terpisah.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Tekan kaleng ringan untuk menghemat ruang, tetapi hati-hati jika bagian logam tajam.",
    environmentalImpact: "Daur ulang aluminium dan baja dapat menghemat energi produksi material baru.",
    creativeIdeas: [
      "Kaleng bekas dapat dijadikan pot mini setelah tepinya dilindungi.",
      "Tutup botol logam bisa dikumpulkan untuk proyek mosaik sederhana.",
      "Sendok atau garpu rusak dapat dijadikan gantungan dekoratif jika aman digunakan.",
    ],
    impactStats: { co2Saved: 170, waterSaved: 55, energySaved: 24 },
  },
  glass: {
    name: "Sampah Kaca",
    category: "Kaca",
    composition: [
      { material: "Kaca", percentage: 92, description: "Wadah kaca, botol kaca, atau pecahan kaca yang tidak mudah terurai." },
      { material: "Tutup, label, atau sisa cairan", percentage: 8, description: "Pisahkan tutup logam/plastik dan bersihkan sebelum didaur ulang." },
    ],
    disposalGuide: "Bungkus pecahan kaca dengan kertas tebal sebelum dibuang. Untuk botol utuh, bilas dan pisahkan tutupnya.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Jangan mencampur pecahan kaca dengan plastik atau kertas karena berisiko melukai petugas pemilah.",
    environmentalImpact: "Daur ulang kaca mengurangi kebutuhan bahan baku pasir, soda ash, dan energi peleburan.",
    creativeIdeas: [
      "Botol kaca bisa dijadikan vas mini atau tempat lilin dengan pinggiran aman.",
      "Toples kaca bekas cocok untuk wadah bumbu atau penyimpanan kering.",
      "Pecahan kaca yang sudah dibungkus aman dapat diserahkan ke titik daur ulang kaca.",
    ],
    impactStats: { co2Saved: 95, waterSaved: 24, energySaved: 8 },
  },
  mixed: {
    name: "Sampah Campuran",
    category: "Anorganik",
    composition: [
      { material: "Material campuran", percentage: 70, description: "Objek tampak mengandung lebih dari satu jenis material." },
      { material: "Plastik/kertas/logam/kaca", percentage: 30, description: "Pilah bagian terbesar sesuai material sebelum disetor." },
    ],
    disposalGuide: "Pisahkan komponen yang terlihat: plastik, kertas, logam, atau kaca. Kumpulkan bagian terbersih untuk daur ulang.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Foto objek dari sisi paling jelas dan pisahkan kemasan berlapis agar hasil analisis lebih akurat.",
    environmentalImpact: "Memilah material campuran meningkatkan peluang tiap bagian untuk didaur ulang.",
    creativeIdeas: [
      "Gunakan bagian terbersih untuk proyek daur ulang sederhana.",
      "Pisahkan komponen kecil agar lebih mudah disetor ke bank sampah.",
      "Simpan material yang masih layak pakai sebelum memutuskan mendaur ulang.",
    ],
    impactStats: { co2Saved: 55, waterSaved: 20, energySaved: 5 },
  },
  plastic: {
    name: "Sampah Plastik",
    category: "Plastik",
    composition: [
      { material: "Plastik", percentage: 85, description: "Wadah, kemasan, botol, atau benda plastik yang dapat dikumpulkan untuk daur ulang." },
      { material: "Sisa isi/kotoran", percentage: 15, description: "Bersihkan sebelum disetor agar lebih aman dan layak daur ulang." },
    ],
    disposalGuide: "Kosongkan dan bilas jika ada sisa isi. Pipihkan jika memungkinkan dan kumpulkan bersama sampah plastik sejenis.",
    recyclable: true,
    accuracy: 0.55,
    tips: "Plastik bersih dan kering lebih mudah diterima di bank sampah daripada plastik yang masih berisi sisa makanan atau cairan.",
    environmentalImpact: "Mendaur ulang plastik mengurangi penggunaan bahan baku minyak bumi dan beban sampah di TPA.",
    creativeIdeas: [
      "Botol plastik bisa dijadikan pot vertikal untuk tanaman kecil.",
      "Kemasan plastik tebal dapat dijadikan ecobrick jika diisi padat dan kering.",
      "Wadah plastik bersih dapat dipakai ulang untuk menyimpan barang non-makanan.",
    ],
    impactStats: { co2Saved: 120, waterSaved: 32, energySaved: 12 },
  },
};

const COCO_CLASS_TO_WASTE: Record<string, { templateKey: keyof typeof TEMPLATES; label: string }> = {
  'bottle': { templateKey: 'plastic', label: 'Botol Plastik' },
  'wine glass': { templateKey: 'glass', label: 'Gelas Kaca' },
  'cup': { templateKey: 'residue', label: 'Makanan di Cangkir' },
  'bowl': { templateKey: 'residue', label: 'Makanan di Mangkuk' },
  'banana': { templateKey: 'residue', label: 'Sisa Makanan/Buah' },
  'apple': { templateKey: 'residue', label: 'Sisa Buah' },
  'sandwich': { templateKey: 'residue', label: 'Sisa Sandwich' },
  'orange': { templateKey: 'residue', label: 'Sisa Jeruk' },
  'broccoli': { templateKey: 'residue', label: 'Sisa Sayuran' },
  'carrot': { templateKey: 'residue', label: 'Sisa Wortel' },
  'hot dog': { templateKey: 'residue', label: 'Sisa Hotdog' },
  'pizza': { templateKey: 'residue', label: 'Sisa Pizza' },
  'donut': { templateKey: 'residue', label: 'Sisa Donat' },
  'cake': { templateKey: 'residue', label: 'Sisa Kue' },
  'book': { templateKey: 'paper', label: 'Buku' },
  'scissors': { templateKey: 'metal', label: 'Gunting' },
  'fork': { templateKey: 'metal', label: 'Garpu' },
  'knife': { templateKey: 'metal', label: 'Pisau' },
  'spoon': { templateKey: 'metal', label: 'Sendok' },
  'keyboard': { templateKey: 'b3', label: 'Keyboard Elektronik' },
  'mouse': { templateKey: 'b3', label: 'Mouse Elektronik' },
  'remote': { templateKey: 'b3', label: 'Remote Elektronik' },
  'cell phone': { templateKey: 'b3', label: 'HP Elektronik' },
  'microwave': { templateKey: 'b3', label: 'Microwave Elektronik' },
  'oven': { templateKey: 'b3', label: 'Oven Elektronik' },
  'toaster': { templateKey: 'b3', label: 'Toaster Elektronik' },
  'refrigerator': { templateKey: 'b3', label: 'Kulkas Elektronik' },
  'tv': { templateKey: 'b3', label: 'TV Elektronik' },
  'laptop': { templateKey: 'b3', label: 'Laptop Elektronik' },
  'hair drier': { templateKey: 'b3', label: 'Pengering Rambut Elektronik' },
  'toothbrush': { templateKey: 'plastic', label: 'Sikat Gigi' },
  'backpack': { templateKey: 'plastic', label: 'Tas Ransel' },
  'umbrella': { templateKey: 'plastic', label: 'Payung' },
  'handbag': { templateKey: 'plastic', label: 'Tas' },
  'plate': { templateKey: 'residue', label: 'Piring Berisi Makanan' },
  'chair': { templateKey: 'mixed', label: 'Kursi' },
  'couch': { templateKey: 'mixed', label: 'Sofa' },
  'potted plant': { templateKey: 'organic', label: 'Tanaman Pot' },
  'bed': { templateKey: 'mixed', label: 'Tempat Tidur' },
  'dining table': { templateKey: 'residue', label: 'Makanan di Meja' },
  'clock': { templateKey: 'mixed', label: 'Jam' },
  'vase': { templateKey: 'glass', label: 'Vas' },
  'teddy bear': { templateKey: 'mixed', label: 'Boneka' },
  'person': { templateKey: 'organic', label: 'Sisa Organik Manusia' },
  'bicycle': { templateKey: 'metal', label: 'Sepeda' },
  'motorcycle': { templateKey: 'metal', label: 'Motor' },
  'car': { templateKey: 'metal', label: 'Mobil' },
  'bus': { templateKey: 'metal', label: 'Bus' },
  'train': { templateKey: 'metal', label: 'Kereta' },
  'truck': { templateKey: 'metal', label: 'Truk' },
  'boat': { templateKey: 'mixed', label: 'Perahu' },
  'traffic light': { templateKey: 'b3', label: 'Lampu Lalu Lintas' },
  'fire hydrant': { templateKey: 'metal', label: 'Hydran' },
  'stop sign': { templateKey: 'metal', label: 'Rambu Stop' },
  'parking meter': { templateKey: 'metal', label: 'Parkir Meter' },
  'bench': { templateKey: 'mixed', label: 'Bangku' },
  'bird': { templateKey: 'organic', label: 'Burung' },
  'cat': { templateKey: 'organic', label: 'Kucing' },
  'dog': { templateKey: 'organic', label: 'Anjing' },
  'horse': { templateKey: 'organic', label: 'Kuda' },
  'sheep': { templateKey: 'organic', label: 'Domba' },
  'cow': { templateKey: 'organic', label: 'Sapi' },
  'elephant': { templateKey: 'organic', label: 'Gajah' },
  'bear': { templateKey: 'organic', label: 'Beruang' },
  'zebra': { templateKey: 'organic', label: 'Zebra' },
  'giraffe': { templateKey: 'organic', label: 'Jerapah' },
  'hat': { templateKey: 'plastic', label: 'Topi' },
  'shoe': { templateKey: 'plastic', label: 'Sepatu' },
  'eye glasses': { templateKey: 'b3', label: 'Kacamata' },
  'bag': { templateKey: 'plastic', label: 'Kantong Plastik' },
  'tie': { templateKey: 'plastic', label: 'Dasi' },
  'suitcase': { templateKey: 'plastic', label: 'Koper' },
  'frisbee': { templateKey: 'plastic', label: 'Frisbee' },
  'skis': { templateKey: 'plastic', label: 'Ski' },
  'snowboard': { templateKey: 'plastic', label: 'Snowboard' },
  'sports ball': { templateKey: 'plastic', label: 'Bola' },
  'kite': { templateKey: 'paper', label: 'Layang-layang' },
  'baseball bat': { templateKey: 'metal', label: 'Tongkat Baseball' },
  'skateboard': { templateKey: 'plastic', label: 'Skateboard' },
  'surfboard': { templateKey: 'plastic', label: 'Papan Selancar' },
  'tennis racket': { templateKey: 'mixed', label: 'Raket Tennis' },
};

// Direct mapping for common labels/keywords to reduce ambiguity
const DIRECT_LABEL_MAP: Record<string, keyof typeof TEMPLATES> = {
  // Plastic
  'oxygen mask': 'plastic',
  'mask': 'plastic',
  'plastic bag': 'plastic',
  'botol plastik': 'plastic',
  'bottle': 'plastic',
  'plastic bottle': 'plastic',
  'water bottle': 'plastic',
  'soda bottle': 'plastic',
  'container': 'plastic',
  'food container': 'plastic',
  'wrapper': 'plastic',
  'straw': 'plastic',
  'cup': 'plastic',
  'plastic cup': 'plastic',
  'toy': 'plastic',
  'shoe': 'plastic',
  'sandal': 'plastic',
  'slipper': 'plastic',
  'backpack': 'plastic',
  'handbag': 'plastic',
  'purse': 'plastic',
  'remote': 'plastic',
  'remote control': 'plastic',
  'pen': 'plastic',
  'ruler': 'plastic',
  'eraser': 'plastic',
  'folder': 'plastic',
  'balloon': 'plastic',
  'kite': 'paper',
  'frisbee': 'plastic',
  'skateboard': 'plastic',
  'surfboard': 'plastic',
  'ski': 'plastic',
  'snowboard': 'plastic',
  'sports ball': 'plastic',
  'guitar': 'plastic',
  'drum': 'plastic',
  'violin': 'plastic',
  'flute': 'plastic',
  'trumpet': 'plastic',
  'racket': 'mixed',
  'phone': 'b3',
  'cell phone': 'b3',
  'hp': 'b3',
  'laptop': 'b3',
  'keyboard': 'b3',
  'mouse': 'b3',
  'tv': 'b3',
  'television': 'b3',
  'monitor': 'b3',
  'screen': 'b3',
  'printer': 'b3',
  'microwave': 'b3',
  'oven': 'b3',
  'toaster': 'b3',
  'refrigerator': 'b3',
  'fridge': 'b3',
  'hair dryer': 'b3',
  'toothbrush': 'plastic',
  // Metal
  'bottle cap': 'metal',
  'can': 'metal',
  'kaleng': 'metal',
  'aluminum': 'metal',
  'aluminium': 'metal',
  'tin': 'metal',
  'foil': 'metal',
  'spoon': 'metal',
  'fork': 'metal',
  'knife': 'metal',
  'scissors': 'metal',
  'gunting': 'metal',
  'nail': 'metal',
  'screw': 'metal',
  'chain': 'metal',
  'padlock': 'metal',
  'wok': 'metal',
  'pot': 'metal',
  'frying pan': 'metal',
  'saucepan': 'metal',
  'staple': 'metal',
  'wire': 'metal',
  'kawat': 'metal',
  'ring': 'metal',
  'coin': 'metal',
  'uang': 'metal',
  'pin': 'metal',
  'clamp': 'metal',
  'bolt': 'metal',
  'nut': 'metal',
  'washer': 'metal',
  'gear': 'metal',
  'cog': 'metal',
  // Paper
  'kardus': 'paper',
  'cardboard': 'paper',
  'box': 'paper',
  'kotak': 'paper',
  'newspaper': 'paper',
  'koran': 'paper',
  'book': 'paper',
  'buku': 'paper',
  'notebook': 'paper',
  'envelope': 'paper',
  'amplop': 'paper',
  'receipt': 'paper',
  'struk': 'paper',
  'paper bag': 'paper',
  'tissue': 'paper',
  'tisu': 'paper',
  'napkin': 'paper',
  'menu': 'paper',
  'poster': 'paper',
  'magazine': 'paper',
  'catalog': 'paper',
  'letter': 'paper',
  'package': 'paper',
  // Organic/Residue
  'food': 'organic',
  'sisa makanan': 'residue',
  'residu': 'residue',
  'residue': 'residue',
  'food residue': 'residue',
  'food waste': 'residue',
  'sampah organik': 'residue',
  'bone': 'residue',
  'tulang': 'residue',
  'grill mark': 'residue',
  'cooked food': 'residue',
  'leftover': 'residue',
  'sisa nasi': 'residue',
  'nasi sisa': 'residue',
  'sisa masak': 'residue',
  'bekas masak': 'residue',
  'potongan daging': 'residue',
  'sisa daging': 'residue',
  'sisa ikan': 'residue',
  'sisa ayam': 'residue',
  'tulang ayam': 'residue',
  'sisa sup': 'residue',
  'banana': 'organic',
  'pisang': 'organic',
  'apple': 'organic',
  'apel': 'organic',
  'orange': 'organic',
  'jeruk': 'organic',
  'fruit': 'organic',
  'buah': 'organic',
  'vegetable': 'organic',
  'sayur': 'organic',
  'leaf': 'organic',
  'daun': 'organic',
  'plant': 'organic',
  'tanaman': 'organic',
  'cake': 'organic',
  'kue': 'organic',
  'bread': 'organic',
  'roti': 'organic',
  'rice': 'organic',
  'nasi': 'organic',
  'eggshell': 'organic',
  'kulit telur': 'organic',
  'peel': 'organic',
  'kulit buah': 'organic',
  'flower': 'organic',
  'bunga': 'organic',
  'grass': 'organic',
  'rumput': 'organic',
  'corn': 'organic',
  'jagung': 'organic',
  'potato': 'organic',
  'kentang': 'organic',
  'avocado': 'organic',
  'alpukat': 'organic',
  'strawberry': 'organic',
  'stroberi': 'organic',
  'pineapple': 'organic',
  'nanas': 'organic',
  'lettuce': 'organic',
  'selada': 'organic',
  'cucumber': 'organic',
  'timun': 'organic',
  'carrot': 'organic',
  'wortel': 'organic',
  'mushroom': 'organic',
  'jamur': 'organic',
  'pizza': 'organic',
  'sandwich': 'organic',
  'hotdog': 'organic',
  'donut': 'organic',
  'donat': 'organic',
  'sushi': 'organic',
  'ramen': 'organic',
  'noodle': 'organic',
  'mie': 'organic',
  'pasta': 'organic',
  'steak': 'organic',
  'daging': 'organic',
  'chicken': 'organic',
  'ayam': 'organic',
  'fish': 'organic',
  'ikan': 'organic',
  'shrimp': 'organic',
  'udang': 'organic',
  'crab': 'organic',
  'kepiting': 'organic',
  'lobster': 'organic',
  'meat': 'organic',
  'egg': 'organic',
  'telur': 'organic',
  'cheese': 'organic',
  'keju': 'organic',
  'yogurt': 'organic',
  'coffee': 'organic',
  'kopi': 'organic',
  'tea': 'organic',
  'teh': 'organic',
  'juice': 'organic',
  'jus': 'organic',
  'soda': 'organic',
  'milk': 'organic',
  'susu': 'organic',
  'water': 'organic',
  'air': 'organic',
  'sugar': 'organic',
  'gula': 'organic',
  'salt': 'organic',
  'garam': 'organic',
  'pepper': 'organic',
  'lada': 'organic',
  'oil': 'organic',
  'minyak': 'organic',
  'sauce': 'organic',
  'saus': 'organic',
  'soup': 'organic',
  'sup': 'organic',
  'salad': 'organic',
  'ice cream': 'organic',
  'es krim': 'organic',
  'cookie': 'organic',
  'candy': 'organic',
  'permen': 'organic',
  'chocolate': 'organic',
  'coklat': 'organic',
  // Glass
  'wine bottle': 'glass',
  'wine glass': 'glass',
  'beer bottle': 'glass',
  'glass bottle': 'glass',
  'botol kaca': 'glass',
  'vase': 'glass',
  'vas': 'glass',
  'jar': 'glass',
  'wineglass': 'glass',
  'cocktail shaker': 'glass',
  'mangkuk': 'glass',
  'glass': 'glass',
  'gelas': 'glass',
  'window': 'glass',
  'jendela': 'glass',
  'mirror': 'glass',
  'cermin': 'glass',
  'lens': 'glass',
  'lensa': 'glass',
  'aquarium': 'glass',
  'fish tank': 'glass',
  // B3
  'battery': 'b3',
  'baterai': 'b3',
  'charger': 'b3',
  'cable': 'b3',
  'kabel': 'b3',
  'plug': 'b3',
  'steker': 'b3',
  'electronic': 'b3',
  'elektronik': 'b3',
  'medicine': 'b3',
  'obat': 'b3',
  'pill': 'b3',
  'tablet': 'b3',
  'chemical': 'b3',
  'kimia': 'b3',
  'spray': 'b3',
  'semprot': 'b3',
  'paint': 'b3',
  'cat': 'b3',
  'cleaner': 'b3',
  'pembersih': 'b3',
  'cosmetic': 'b3',
  'kosmetik': 'b3',
  'tube': 'b3',
  'light bulb': 'b3',
  'lampu': 'b3',
  'bulb': 'b3',
  'thermometer': 'b3',
  'termometer': 'b3',
  'toner': 'b3',
  'ink': 'b3',
  'tinta': 'b3',
  'pesticide': 'b3',
  'pestisida': 'b3',
  'televisi': 'b3',
  'sikat gigi': 'b3',
};

function classifyWasteType(label: string): keyof typeof TEMPLATES {
  const text = label.toLowerCase();

  // Direct keyword map first (more specific)
  for (const key of Object.keys(DIRECT_LABEL_MAP)) {
    if (text.includes(key)) return DIRECT_LABEL_MAP[key];
  }

  // Check for residue/food waste first - more specific than generic organic
  if (/(sisa makanan|residu|residue|food residue|food waste|sampah organik|bone|tulang|cooked|leftover|sisa nasi|sisa masak|bekas masak|potongan daging|sisa daging|sisa ikan|sisa ayam|tulang ayam|sisa sup)/.test(text)) return "residue";
  
  if (/(battery|baterai|charger|cable|wire|plug|electronic|phone|mouse|keyboard|medicine|pill|chemical|spray|paint|cleaner|cosmetic|tube|light[\s-]?bulb|bulb|thermometer|toner|ink|pesticide|laptop|tv|remote|microwave|oven|toaster|refrigerator|hair[\s-]?dryer|toothbrush)/.test(text)) return "b3";
  if (/(banana|apple|orange|fruit|vegetable|leaf|plant|food|cake|bread|rice|eggshell|peel|flower|grass|corn|potato|avocado|strawberry|pineapple|lettuce|cucumber|carrot|mushroom|pizza|sandwich|hotdog|donut|sushi|ramen|noodle|pasta|steak|chicken|fish|shrimp|crab|lobster|meat|egg|cheese|yogurt|coffee|tea|juice|soda|milk|water|sugar|salt|pepper|oil|sauce|soup|salad|ice[\s-]?cream|cookie|candy|chocolate)/.test(text)) return "organic";
  if (/(paper[\s-]?towel|toilet[\s-]?tissue|notebook|envelope|cardboard|box|newspaper|book|receipt|paper[\s-]?bag|paper|carton|tissue|napkin|menu|poster|magazine|catalog|folder|envelope|letter|package)/.test(text)) return "paper";
  if (/\b(metal|can|aluminum|tin[\s-]?foil|foil|spoon|fork|knife|key|scissors|nail|screw|chain|padlock|wok|\bpot\b|frying[\s-]?pan|saucepan|staple|wire|bottle[\s-]?cap|ring|coin|pin|clamp|bolt|nut|washer|gear|cog)\b/i.test(text) && !/(cable|charger|plug|electronic)/.test(text)) return "metal";
  if (/(wine[\s-]?bottle|beer[\s-]?bottle|glass[\s-]?bottle|vase|jar|wineglass|cocktail[\s-]?shaker|cup|glass|window|mirror|lens|aquarium|fish[\s-]?tank)/.test(text)) return "glass";
  if (/(pop[\s-]?bottle|plastic[\s-]?bag|bottle|cup|container|package|wrapper|straw|bucket|basket|toy|chair|table|comb|ladle|tray|pitcher|jug|backpack|handbag|purse|sock|sandal|slipper|remote[\s-]?control|pen|ruler|eraser|folder|balloon|kite|frisbee|skateboard|surfboard|ski|snowboard|racket|guitar|drum|violin|flute|trumpet)/.test(text)) return "plastic";

  return "mixed";
}

function getDominantColor(base64Image: string): Promise<{ r: number; g: number; b: number; brightness: number; saturation: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ r: 180, g: 180, b: 180, brightness: 0.7, saturation: 0.1 });
          return;
        }

        ctx.drawImage(image, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 125) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }

        if (count === 0) {
          resolve({ r: 180, g: 180, b: 180, brightness: 0.7, saturation: 0.1 });
          return;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const saturation = max === 0 ? 0 : (max - min) / max;

        resolve({ r, g, b, brightness: max, saturation });
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = reject;
    image.src = `data:image/jpeg;base64,${base64Image}`;
  });
}

async function analyzeWasteWithCoco(base64Image: string): Promise<{ name: string; templateKey: keyof typeof TEMPLATES } | null> {
  try {
    const model = await loadCocoSsdModel();
    const image = await loadImageElement(`data:image/jpeg;base64,${base64Image}`);
    const predictions = await model.detect(image, 5);

    if (predictions.length === 0) return null;

    const best = predictions[0];
    const cocoClass = best.class.toLowerCase();
    const waste = COCO_CLASS_TO_WASTE[cocoClass];

    if (waste) {
      return {
        name: waste.label,
        templateKey: waste.templateKey,
      };
    }

    return null;
  } catch (error) {
    console.warn('COCO-SSD detection failed:', error);
    return null;
  }
}

function heuristicWasteType(color: { r: number; g: number; b: number; brightness: number; saturation: number }): keyof typeof TEMPLATES {
  const { r, g, b, brightness, saturation } = color;

  // AGGRESSIVE RESIDUE DETECTION: Brown/tan/food colors (cooked food, plates with food)
  // Dark brown (cooked rice, meat, sauce)
  if (r > 100 && r < 160 && g > 60 && g < 130 && b < 90 && brightness < 0.6 && brightness > 0.15) return "residue";
  // Medium brown (general food color)
  if (r > 130 && g > 90 && b < 100 && saturation > 0.1 && brightness < 0.75) return "residue";
  // Warm beige/tan (cooked food on plate)
  if (r > 160 && g > 130 && b < 110 && saturation < 0.3 && brightness > 0.4) return "residue";
  // Food plate colors (mix of browns and reds)
  if (r > 110 && g > 70 && b < 80 && saturation > 0.15 && brightness < 0.65) return "residue";
  // Very saturated warm tones (food with sauce/oil)
  if (r > g * 1.05 && g > b * 1.1 && saturation > 0.3 && brightness > 0.3 && brightness < 0.7) return "residue";

  // Organic: green/bright colors (fresh fruits, vegetables) - green tones with good saturation
  if (g > r * 1.1 && g > b * 1.05 && saturation > 0.25 && brightness > 0.35) return "organic";
  // Red/yellow organic (tomato, apple, citrus)
  if (r > 120 && g > 80 && b < 80 && saturation > 0.3 && brightness > 0.3 && brightness < 0.8) return "organic";
  // Bright yellow/orange (citrus, banana)
  if (r > 150 && g > 100 && b < 100 && saturation > 0.2 && brightness > 0.4) return "organic";
  
  // Plastic: transparent/white/light colored (bottles, containers, wrappers)
  if (saturation < 0.18 && brightness > 0.55) return "plastic";
  if (saturation < 0.22 && brightness > 0.6 && r > 200 && g > 200 && b > 200) return "plastic";
  if (r > 180 && g < 120 && b < 120 && saturation > 0.25 && brightness > 0.4) return "plastic";
  if (r < 120 && g > 150 && b > 150 && saturation > 0.2 && brightness > 0.5) return "plastic";
  
  // Paper: beige/white/tan tones (cardboard, paper, napkins)
  if (saturation < 0.15 && brightness > 0.7 && r > 200 && g > 190 && b > 170) return "paper";
  if (r > 180 && g > 160 && b < 140 && saturation < 0.2 && brightness > 0.5) return "paper";
  
  // Glass: transparent/cyan/blue transparent
  if (b > r * 1.15 && b > g && saturation > 0.1 && brightness > 0.5) return "glass";
  if (saturation < 0.12 && brightness > 0.65 && b > r && b > g) return "glass";
  
  // Metal: true metallic gray/silver with moderate brightness
  if (saturation < 0.06 && brightness > 0.45 && brightness < 0.75 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) return "metal";
  
  // Dark objects = residue if brownish, else mixed
  if (brightness < 0.2) {
    if (r > b && g > b * 0.9) return "residue";
    return "mixed";
  }
  
  // Default: mixed
  return "mixed";
}

async function aggregateLocalPredictions(base64Image: string, userId?: string): Promise<{ type: keyof typeof TEMPLATES; name: string; composition: { material: string; percentage: number; description?: string }[]; confidence: number } | null> {
  try {
    const image = await loadImageElement(`data:image/jpeg;base64,${base64Image}`);

    const [mobilenetModel, cocoModel] = await Promise.all([loadLocalVisionModel(), loadCocoSsdModel()]);

    // mobilenet predictions
    const mnPreds = await mobilenetModel.classify(image, 5);

    // coco predictions (with bbox and score)
    let cocoPreds: any[] = [];
    try {
      cocoPreds = await cocoModel.detect(image, 5);
    } catch (e) {
      // ignore coco errors
      cocoPreds = [];
    }

    const weights: Record<string, number> = {};
    const labelNames: Record<string, string> = {};

    // Strict waste-only COCO classes - ignore animals, insects, electronics, etc.
    const WASTE_ONLY_CLASSES = new Set([
      'bottle', 'wine glass', 'cup', 'bowl', 'fork', 'knife', 'spoon', 'plate',
      'banana', 'apple', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
      'sandwich', 'potted plant', 'clock', 'vase', 'teddy bear', 'hair drier', 'toothbrush',
      'scissors', 'book', 'remote', 'keyboard', 'mouse', 'cell phone', 'microwave', 'oven',
      'toaster', 'refrigerator', 'tv', 'laptop', 'backpack', 'umbrella', 'handbag', 'suitcase',
      'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'skateboard',
      'surfboard', 'tennis racket', 'chair', 'couch', 'bed', 'dining table', 'toilet',
      'dining table', 'potted plant', // food-bearing surfaces
    ]);

    // COCO contributions - highest priority for object detection
    for (const p of cocoPreds || []) {
      const cocoClass = (p.class || '').toLowerCase();
      
      // Only accept waste-related COCO classes
      if (!WASTE_ONLY_CLASSES.has(cocoClass)) {
        continue;
      }
      
      const mapped = COCO_CLASS_TO_WASTE[cocoClass];
      if (mapped) {
        const type = mapped.templateKey;
        const w = (Number(p.score) || 0) * 5.0; // dominant weight for waste objects
        weights[type] = (weights[type] || 0) + w;
        labelNames[type] = mapped.label || labelNames[type] || formatLabel(cocoClass);
      }
    }

    // Mobilenet contributions - minor weight, only for waste-related predictions
    for (const p of mnPreds || []) {
      const label = (p.className || '').toLowerCase();
      
      // Skip non-waste MobileNet predictions
      const nonWasteKeywords = ['person', 'dog', 'cat', 'bird', 'horse', 'cow', 'sheep', 
                                'elephant', 'bear', 'zebra', 'giraffe', 'monkey', 'rabbit',
                                'car', 'bus', 'truck', 'bicycle', 'motorcycle', 'train', 'boat',
                                'airplane', 'helicopter', 'ship', 'tank', 'tractor', 'ambulance',
                                'fire engine', 'school bus', 'beach wagon', 'minivan', 'taxi',
                                'sports car', 'convertible', 'jeep', 'limousine', 'pickup',
                                'trailer truck', 'moving van', 'bicycle-built-for-two', 'tricycle',
                                'mountain bike', 'motor scooter', 'moped', 'unicycle'];
      
      const isNonWaste = nonWasteKeywords.some(keyword => label.includes(keyword));
      if (isNonWaste) continue;
      
      // Boost weight for food-related predictions
      let type = classifyWasteType(label);
      let w = (Number(p.probability) || 0) * 0.4;
      
      // If MobileNet detects food-related items, aggressively boost residue
      if (/(food|apple|orange|banana|carrot|broccoli|tomato|lettuce|vegetable|fruit|plate|dish|rice|noodle|pasta|bread|meat|chicken|fish|seafood|soup|sauce)/.test(label)) {
        type = 'residue';
        w = (Number(p.probability) || 0) * 2.5; // Heavy boost for food
      }
      
      weights[type] = (weights[type] || 0) + w;
      labelNames[type] = formatLabel(label);
    }

    // Color heuristic - strong contribution when models disagree
    try {
      const color = await getDominantColor(base64Image);
      const htype = heuristicWasteType(color);
      // Boost color weight, especially for residue detection
      const colorWeight = htype === 'residue' ? 1.5 : 0.8;
      weights[htype] = (weights[htype] || 0) + colorWeight;
    } catch {}

    if (DEBUG_WASTE) {
      console.log('WASTE_DEBUG: mobilenet preds=', mnPreds);
      console.log('WASTE_DEBUG: coco preds=', cocoPreds);
      try { const colorDbg = await getDominantColor(base64Image); console.log('WASTE_DEBUG: color=', colorDbg); } catch {}
      console.log('WASTE_DEBUG: weights=', weights);
    }

    const entries = Object.keys(weights).map(k => ({ k, w: weights[k] }));
    if (entries.length === 0) return null;

    entries.sort((a, b) => b.w - a.w);
    const total = entries.reduce((s, e) => s + e.w, 0) || 1;

    // If COCO produced strong detection, prefer it
    const cocoWeights: Record<string, number> = {};
    for (const p of cocoPreds || []) {
      const cocoClass = (p.class || '').toLowerCase();
      const mapped = COCO_CLASS_TO_WASTE[cocoClass];
      if (mapped) {
        cocoWeights[mapped.templateKey] = (cocoWeights[mapped.templateKey] || 0) + (Number(p.score) || 0);
      }
    }

    // Build composition from top 3 types
    const top = entries.slice(0, 3);
    const composition = top.map(e => {
      const pct = Math.max(3, Math.round((e.w / total) * 100));
      const template = TEMPLATES[e.k] || TEMPLATES.mixed;
      return { material: template.composition[0]?.material || template.name, percentage: pct, description: template.composition[0]?.description };
    });

    // normalize percentages to sum 100
    let sum = composition.reduce((s, x) => s + x.percentage, 0);
    if (sum !== 100) {
      const diff = 100 - sum;
      composition[0].percentage = Math.min(100, composition[0].percentage + diff);
      sum = composition.reduce((s, x) => s + x.percentage, 0);
    }

    // Prefer non-mixed coco detection if it's strong
    let chosen = entries[0].k as keyof typeof TEMPLATES;
    if (chosen === 'mixed' && Object.keys(cocoWeights).length > 0) {
      const cocoEntries = Object.keys(cocoWeights).map(k => ({ k, w: cocoWeights[k] }));
      cocoEntries.sort((a, b) => b.w - a.w);
      if (cocoEntries[0] && cocoEntries[0].k !== 'mixed' && cocoEntries[0].w > 0.3 * total) {
        chosen = cocoEntries[0].k as keyof typeof TEMPLATES;
      }
    }

    // If top result is 'mixed' but another type has close weight, pick the more specific type
    if (chosen === 'mixed' && entries[1] && entries[1].w > entries[0].w * 0.6) {
      chosen = entries[1].k as keyof typeof TEMPLATES;
    }
    const name = labelNames[chosen] || TEMPLATES[chosen].name;
    const confidence = clamp(entries[0].w / (total + 0.001), 0.35, 0.95);

    return { type: chosen, name, composition, confidence };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await logError({
      severity: 'WARNING',
      type: 'local_predictions_aggregation_failed',
      message: `Local predictions aggregation failed: ${errorMsg}`,
      context: 'waste_scan',
      userId,
      functionName: 'aggregateLocalPredictions',
      stack: e instanceof Error ? e.stack : undefined
    });
    return null;
  }
}

async function analyzeWasteLocally(base64Image: string, userId?: string): Promise<WasteAnalysis> {
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  try {
    // Ensure TFJS backend is ready before loading models
    await ensureTfBackend();

    // First try to aggregate local model predictions (mobilenet + coco + heuristic)
    const aggregated = await aggregateLocalPredictions(base64Image, userId);
    if (aggregated) {
      const template = TEMPLATES[aggregated.type] || TEMPLATES.mixed;
      return normalizeWasteAnalysis({
        ...template,
        name: aggregated.name || template.name,
        composition: aggregated.composition.length > 0 ? aggregated.composition : template.composition,
        accuracy: aggregated.confidence,
      }, aggregated.confidence);
    }

    // Fallback: single-model classify + heuristic
    const image = await loadImageElement(dataUrl);
    const model = await loadLocalVisionModel();
    const predictions = await model.classify(image, 5);
    const bestPrediction = predictions[0];

    if (!bestPrediction) {
      return await getFallbackAnalysis(base64Image, userId);
    }

    const label = bestPrediction.className;
    const confidence = clamp(bestPrediction.probability || 0.48, 0.45, 0.92);
    const type = classifyWasteType(label);
    const template = TEMPLATES[type] || TEMPLATES.mixed;
    const translatedName = formatLabel(label) || template.name;

    return normalizeWasteAnalysis({
      ...template,
      name: translatedName,
      accuracy: confidence,
    }, confidence);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn("Local vision model gagal, menggunakan heuristik warna:", error);
    await logError({
      severity: 'WARNING',
      type: 'local_model_fallback',
      message: `Local vision model failed: ${errorMsg}`,
      context: 'waste_scan',
      userId,
      functionName: 'analyzeWasteLocally',
      stack: error instanceof Error ? error.stack : undefined
    });
    return await getFallbackAnalysis(base64Image, userId);
  }
}

async function getFallbackAnalysis(base64Image: string, userId?: string): Promise<WasteAnalysis> {
  try {
    const color = await getDominantColor(base64Image);
    const type = heuristicWasteType(color);
    const template = TEMPLATES[type] || TEMPLATES.mixed;
    return normalizeWasteAnalysis({
      ...template,
      name: template.name,
      accuracy: 0.5,
    }, 0.5);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logError({
      severity: 'WARNING',
      type: 'color_heuristic_failed',
      message: `Color heuristic fallback failed: ${errorMsg}`,
      context: 'waste_scan',
      userId,
      functionName: 'getFallbackAnalysis',
      stack: error instanceof Error ? error.stack : undefined
    });
    return normalizeWasteAnalysis(TEMPLATES.mixed, 0.5);
  }
}

async function loadLocalVisionModel(): Promise<any> {
  if (!localVisionModelPromise) {
    localVisionModelPromise = (async () => {
      await ensureTfBackend();
      return mobilenet.load({ version: 2, alpha: 1.0 });
    })();
  }
  return localVisionModelPromise;
}

async function loadCocoSsdModel(): Promise<any> {
  if (!cocoModelPromise) {
    cocoModelPromise = (async () => {
      await ensureTfBackend();
      return cocoSsd.load({ base: 'mobilenet_v2' });
    })();
  }
  return cocoModelPromise;
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function parseWasteAnalysis(text: string): WasteAnalysis {
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanedText) as WasteAnalysis;
  } catch (e) {
    console.error("Gagal parse JSON:", cleanedText);
    throw new Error("Format hasil analisis tidak sesuai. Silakan coba lagi.");
  }
}

async function analyzeWasteWithGemini(base64Image: string, userId?: string): Promise<WasteAnalysis> {
  const prompt = `Kamu adalah sistem analisis sampah AI yang sangat akurat untuk aplikasi daur ulang di Indonesia. Tugasmu adalah mengidentifikasi sampah dari foto dengan presisi tinggi.

== LANGKAH WAJIB (ikuti urutan ini) ==

LANGKAH 1 — IDENTIFIKASI OBJEK DOMINAN:
Lihat gambar dengan seksama. Identifikasi SATU objek utama yang paling besar/paling mendominasi gambar. Abaikan latar belakang. Sebut nama objek tersebut secara spesifik (contoh: "Botol Plastik Air Mineral", "Kaleng Soda Aluminium", "Kardus Bekas", "Ember Plastik Merah", "Kantong Kresek", "Baterai AA").

LANGKAH 2 — TENTUKAN MATERIAL UTAMA:
Berdasarkan objek dominan tersebut, tentukan material utamanya:
- Plastik → botol plastik, ember, kantong plastik, gelas plastik, sedotan, mainan plastik, wadah plastik, styrofoam
- Logam → kaleng aluminium, kaleng soda, kawat, besi, seng, paku, sendok/garpu logam, kaleng makanan
- Kertas → kardus, karton, koran, majalah, buku, tissue box, dus, amplop
- Kaca → botol kaca, gelas kaca, guci, cermin, kaca jendela
- B3 (Berbahaya) → baterai, charger, kabel, HP, elektronik, obat-obatan, bahan kimia, aerosol, cat
- Organik → buah utuh segar, sayuran segar, daun, rumput, ranting, sampah kebun
- Residu → sisa nasi, tulang ayam, makanan matang sisa, ampas kopi, kulit telur, sisa masak
- Anorganik → campuran yang tidak masuk kategori di atas

LANGKAH 3 — DETEKSI BUKAN SAMPAH:
Jika gambar menunjukkan: wajah manusia, selfie, orang hidup, hewan peliharaan, kendaraan bersih, bangunan, langit, pemandangan alam tanpa sampah, atau benda apapun yang JELAS BUKAN sampah/barang bekas → set "isNotWaste": true.

LANGKAH 4 — ANALISIS KOMPOSISI:
Jika ada beberapa jenis material terlihat (misalnya tumpukan sampah campuran), buat komposisi dengan persentase berdasarkan apa yang TERLIHAT SECARA VISUAL. Total harus 100%.

LANGKAH 5 — BUAT NAMA SPESIFIK DALAM BAHASA INDONESIA:
"name" harus nama spesifik berdasarkan objek asli yang terlihat, dalam Bahasa Indonesia. Contoh:
- "Botol Air Mineral Plastik" bukan "Plastik"
- "Kaleng Minuman Aluminium" bukan "Logam"
- "Kardus Bekas" bukan "Kertas"
- "Tumpukan Sampah Campuran" jika memang tercampur
- "Ember Plastik" bukan "Bucket, Pail"

== ATURAN PENTING ==
- Jangan gunakan nama bahasa Inggris untuk field "name" — WAJIB dalam Bahasa Indonesia
- Untuk gambar tumpukan sampah campuran: pilih kategori material yang paling DOMINAN secara visual
- Sisa makanan/bekas masak → SELALU "Residu", BUKAN "Organik"
- Buah/sayuran SEGAR dan UTUH → "Organik"
- accuracy harus REALISTIS: 0.75-0.95 untuk objek jelas, 0.60-0.74 untuk gambar buram/campuran

Kembalikan HANYA JSON dengan struktur berikut (tanpa teks lain):
{
  "isNotWaste": false,
  "name": "nama spesifik objek dalam Bahasa Indonesia",
  "category": "Plastik | Logam | Kertas | Kaca | B3 | Organik | Residu | Anorganik | Bukan Sampah",
  "composition": [
    {"material": "nama material dalam Bahasa Indonesia", "percentage": angka, "description": "deskripsi singkat"}
  ],
  "disposalGuide": "panduan pembuangan dalam Bahasa Indonesia",
  "recyclable": true atau false,
  "accuracy": angka antara 0.60 dan 0.95,
  "tips": "tips pengelolaan sampah ini dalam Bahasa Indonesia",
  "environmentalImpact": "dampak lingkungan dalam Bahasa Indonesia",
  "creativeIdeas": ["ide kreatif 1", "ide kreatif 2", "ide kreatif 3"],
  "impactStats": {"co2Saved": angka_kg, "waterSaved": angka_liter, "energySaved": angka_kwh}
}`;

  const parts: Part[] = [
    {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg",
      },
    },
    { text: prompt },
  ];

  const errors: string[] = [];

  for (const modelName of IMAGE_ANALYSIS_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" } 
      });
      const result = await model.generateContent(parts);
      const text = result.response.text().trim();
      if (!text) throw new Error("No analysis result received from AI");
      const parsed = parseWasteAnalysis(text);
      if (parsed.isNotWaste || parsed.category === "Bukan Sampah") {
        throw new Error("BUKAN_SAMPAH: Objek yang dipindai bukan merupakan sampah. Mohon pindaikan barang bekas atau sampah yang dapat didaur ulang.");
      }
      return normalizeWasteAnalysis(parsed, 0.82);
    } catch (e: any) {
      errors.push(`${modelName}: ${e?.message || e}`);
      await logError({
        severity: 'WARNING',
        type: 'gemini_model_fallback',
        message: `Model ${modelName} failed: ${e?.message}`,
        context: 'waste_scan',
        userId,
        functionName: 'analyzeWasteWithGemini',
        metadata: { modelName, errorMessage: e?.message }
      });
    }
  }

  const finalError = new Error(`Gemini gagal: ${errors.join(' | ')}`);
  await logError({
    severity: 'ERROR',
    type: 'gemini_all_models_failed',
    message: finalError.message,
    context: 'waste_scan',
    userId,
    functionName: 'analyzeWasteWithGemini',
    metadata: { attempts: IMAGE_ANALYSIS_MODELS.length, errors }
  });
  throw finalError;
}

export async function analyzeWaste(base64Image: string, userId?: string): Promise<WasteAnalysis> {
  try {
  if (!base64Image || base64Image.length < 100) {
    const validationError = new Error('Gambar tidak valid atau terlalu kecil untuk dianalisis.');
    await logError({
      severity: 'WARNING',
      type: 'invalid_image',
      message: validationError.message,
      context: 'waste_scan',
      userId,
      functionName: 'analyzeWaste',
      metadata: { imageSize: base64Image?.length || 0 }
    });
    throw validationError;
  }

  // ONNX local filter disabled: model too large (11.7MB) for browser WebAssembly memory
  // Detection handled entirely by Gemini AI to prevent Out of Memory crashes

  let geminiError: Error | null = null;

  // Skip cloud Gemini entirely if no API key is configured (use local on-device analysis)
  const skipGemini = !apiKey;

  if (!skipGemini) {
    // Try cloud Gemini with extended timeout and one retry
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const timeoutMs = 60000; // 60s
        const geminiResult = await Promise.race([
          analyzeWasteWithGemini(base64Image, userId),
          delay(timeoutMs).then(() => { throw new Error('Gemini timeout'); }),
        ]);
        return geminiResult;
      } catch (error: any) {
        geminiError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Gemini attempt ${attempt + 1} failed:`, geminiError.message);

        // Jika hasil deteksi menyatakan BUKAN_SAMPAH, langsung lempar error tanpa retry
        if (geminiError.message.includes('BUKAN_SAMPAH')) {
          throw geminiError;
        }

        await logError({
          severity: 'WARNING',
          type: 'gemini_api_failed',
          message: `Gemini attempt ${attempt + 1}/${2} failed: ${geminiError.message}`,
          context: 'waste_scan',
          userId,
          functionName: 'analyzeWaste',
          metadata: { attempt: attempt + 1, error: geminiError.message }
        });
        // If the model is text-only / invalid / not found, retrying won't help — fall back to local now
        const msg = geminiError.message.toLowerCase();
        const fatal = msg.includes('does not support image') || msg.includes('not found') ||
          msg.includes('not supported') || msg.includes('invalid') || msg.includes('permission') ||
          msg.includes('api key') || msg.includes('api_key') || msg.includes('unauthorized');
        if (fatal) break;
        // small backoff before retry
        if (attempt === 0) await delay(1000);
      }
    }
  }
  
  await logError({
    severity: 'ERROR',
    type: 'gemini_exhausted_retries',
    message: `Gemini failed after 2 attempts: ${geminiError?.message || 'unknown'}. Fallback to local analysis.`,
    context: 'waste_scan',
    userId,
    functionName: 'analyzeWaste'
  });
  console.warn('Gemini gagal setelah retry, menggunakan analisis lokal:', geminiError?.message || 'unknown');

  // ONNX fallback disabled: use local Gemini-free analysis instead

  const localResult = await analyzeWasteLocally(base64Image, userId);
  return localResult;
  } catch (e: any) {
    if (e?.message?.includes('BUKAN_SAMPAH')) throw e;
    return normalizeWasteAnalysis(TEMPLATES.mixed, 0.3);
  }
}
