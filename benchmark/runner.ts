import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { detectDiffBoundingBox, optimizeImageForProvider } from '../src/core/image-optimizer.js';
import { percentSavings } from '../src/core/provider-math.js';
import { classifyProvider, readBenchmarkEnv, listCaseDirs } from './provider.js';
import { buildBenchmarkReport, type BenchmarkRunResult } from './report.js';

interface GroundTruth {
  defect: string;
  affectedElement: string;
  defectType: string;
  rootCause: string;
  suggestedFix: string;
  expectedBoundingBox: { x: number; y: number; width: number; height: number };
}

interface CaseMetadata {
  id: string;
  name: string;
  category: string;
  viewport: { width: number; height: number };
  diffPixels: number;
  groundTruth: GroundTruth;
}

// Load .env
function loadEnv(): { baseUrl: string; model: string; apiKey?: string } {
  const env = readBenchmarkEnv();
  let baseUrl = env.OPENAI_BASE_URL ?? 'https://spark.ntsd.dev:8001/v1';
  const model = env.AGENT_MODEL ?? 'RadixArk/Qwen3.8-27B-NVFP4';
  let apiKey: string | undefined = env.OPENAI_API_KEY;
  const aiStudioKey: string | undefined = env.AI_STUDIO_API_KEY;

  // Gemma/Gemini models route through Google AI Studio's OpenAI-compatible endpoint.
  if (classifyProvider(model) === 'gemini' && aiStudioKey) {
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
    apiKey = aiStudioKey;
  }

  // Only relax TLS verification for the self-signed local SGLang endpoint.
  if (baseUrl.includes('spark.ntsd.dev')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  } else {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }

  return { baseUrl, model, apiKey };
}

// Evaluate accuracy against ground truth
function evaluateAccuracy(answer: string, reasoning: string, gt: GroundTruth): { score: number; found: boolean } {
  const text = (answer + ' ' + reasoning).toLowerCase();
  let score = 0;

  // 1. Element Identification (up to 35 pts)
  const elemKeywords = gt.affectedElement.toLowerCase().replace(/[.#]/g, ' ').split(/\s+/).filter(Boolean);
  const matchedElem = elemKeywords.some(k => k.length > 2 && text.includes(k));
  if (matchedElem) {
    score += 35;
  }

  // 2. Defect Type / Symptom Identification (up to 35 pts)
  const defectWords = gt.defectType.toLowerCase().split('_');
  const matchedDefect = defectWords.some(w => w.length > 3 && text.includes(w));
  const generalDefectKeywords = [
    'shift',
    'padding',
    'margin',
    'contrast',
    'overlap',
    'overflow',
    'color',
    'clip',
    'broken',
    'misaligned',
    'collision'
  ];
  const matchedGeneral = generalDefectKeywords.some(k => gt.defect.toLowerCase().includes(k) && text.includes(k));

  if (matchedDefect || matchedGeneral) {
    score += 35;
  }

  // 3. Root Cause & Fix Recommendation (up to 30 pts)
  const fixKeywords = gt.rootCause
    .toLowerCase()
    .split(/\s+/)
    .concat(gt.suggestedFix.toLowerCase().split(/\s+/))
    .filter(w => w.length > 3);
  const matchedFix = fixKeywords.some(w => text.includes(w));
  if (matchedFix) {
    score += 30;
  }

  const found = score >= 50;
  return { score, found };
}

// Providers split output differently: Qwen/SGLang streams thoughts into
// reasoning_content with empty content; AI Studio may return either field,
// null content, or content as an array of parts.
function extractText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((p: any) => p?.text ?? '').join('');
  return '';
}

// Gemma 4 on AI Studio emits thinking inline in content as <thought>...</thought>
// tags with no separate reasoning_content field. Split it out so the benchmark
// records both a clean answer and the reasoning.
function splitThoughtTags(text: string): { content: string; reasoning: string } {
  const thoughts = [...text.matchAll(/<thought>([\s\S]*?)<\/thought>/g)].map(m => m[1]!.trim()).filter(Boolean);
  if (thoughts.length === 0) return { content: text, reasoning: '' };
  return {
    content: text.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim(),
    reasoning: thoughts.join('\n\n')
  };
}

function pickEffectiveAnswer(res: { content: string; reasoning: string }): string {
  const content = res.content.trim();
  return content.length > 10
    ? content
    : res.reasoning.split('\n\n').slice(-3).join('\n\n').trim() || res.reasoning.trim();
}

// Shape of a single VLM call result, shared by callVlm and the trace-session writer.
type VlmResult = {
  content: string;
  reasoning: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    image_tokens: number;
    reasoning_tokens: number;
  };
  latencyMs: number;
};

async function callVlm(
  baseUrl: string,
  model: string,
  imageDataUri: string,
  promptText: string,
  apiKey?: string
): Promise<VlmResult> {
  const startTime = performance.now();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: imageDataUri } }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.1
    })
  });

  const latencyMs = Math.round(performance.now() - startTime);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message ?? {};
  let content = extractText(message.content);
  let reasoning = extractText(message.reasoning_content) || extractText(message.reasoning);
  const thoughtSplit = splitThoughtTags(content);
  if (!reasoning && thoughtSplit.reasoning) {
    reasoning = thoughtSplit.reasoning;
    content = thoughtSplit.content;
  }
  const usage = data.usage ?? {};
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;

  return {
    content,
    reasoning,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: usage.total_tokens ?? promptTokens + completionTokens,
      image_tokens: usage.prompt_tokens_details?.image_tokens ?? usage.image_tokens ?? 0,
      reasoning_tokens: usage.reasoning_tokens ?? usage.completion_tokens_details?.reasoning_tokens ?? 0
    },
    latencyMs
  };
}

// AI Studio intermittently fails vision ingestion under load: 429/5xx, or a
// transient 400 "Unable to process input image" (Google's own message says
// "Please retry"). Back off and retry all three.
async function callVlmWithRetry(...args: Parameters<typeof callVlm>): ReturnType<typeof callVlm> {
  const attempts = 4;
  for (let i = 0; ; i++) {
    try {
      return await callVlm(...args);
    } catch (err: any) {
      const retryable =
        /API error \((429|5\d\d)\)/.test(err.message) || err.message.includes('Unable to process input image');
      if (!retryable || i === attempts - 1) throw err;
      const delayMs = 3000 * 2 ** i + Math.round(Math.random() * 1000);
      console.warn(`      ↻ API error, retry ${i + 1}/${attempts - 1} in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function runBenchmark() {
  const { baseUrl, model, apiKey } = loadEnv();
  console.log(`🚀 ZeroVisual Vision Benchmark Runner`);
  console.log(`🌐 Base URL: ${baseUrl}`);
  console.log(`🧠 Model:    ${model}`);
  console.log(`🔑 Auth:     ${apiKey ? 'API key' : 'none'}\n`);

  const testdataDir = path.resolve(process.cwd(), 'benchmark/testdata');
  const resultsDir = path.resolve(process.cwd(), 'benchmark/results');
  const sessionsDir = path.join(resultsDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const cases = listCaseDirs(testdataDir);

  console.log(`Discovered ${cases.length} benchmark test cases:`);
  cases.forEach(c => console.log(` - ${c}`));
  console.log('');

  const allResults: BenchmarkRunResult[] = [];
  const runTimestamp = new Date().toISOString();

  for (const caseId of cases) {
    const caseDir = path.join(testdataDir, caseId);
    const metaPath = path.join(caseDir, 'metadata.json');
    const actualPath = path.join(caseDir, 'actual.png');
    const diffPath = path.join(caseDir, 'diff.png');

    if (!fs.existsSync(metaPath) || !fs.existsSync(actualPath) || !fs.existsSync(diffPath)) {
      console.warn(`Skipping ${caseId}: missing required test assets.`);
      continue;
    }

    const metadata: CaseMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const actualPng = fs.readFileSync(actualPath);
    const diffPng = fs.readFileSync(diffPath);

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`🧪 Running Test Case: [${metadata.id}] ${metadata.name}`);
    console.log(`   Category: ${metadata.category}`);

    const promptText = `You are an automated visual regression QA engineer analyzing a screenshot from a failed visual test.
Be concise and direct.
Identify:
1. Affected Element / Component name
2. Nature of the Visual Defect (e.g. padding shift, font size, contrast violation, margin collapse, element overlap)
3. Probable Root Cause in CSS or layout
4. Suggested Fix or code snippet`;

    const writeTraceSession = (
      id: string,
      mode: string,
      inputImage: {
        resolution: CaseMetadata['viewport'];
        format: string;
        bytes: number;
        isZeroVisualOptimized: boolean;
        cropBox?: GroundTruth['expectedBoundingBox'];
      },
      res: VlmResult,
      accuracyScore: number
    ): void => {
      const trace = {
        id,
        timestamp: new Date().toISOString(),
        benchmarkRunTimestamp: runTimestamp,
        caseId: metadata.id,
        caseName: metadata.name,
        mode,
        model,
        systemPrompt: 'You are an automated visual regression QA engineer.',
        userPrompt: promptText,
        inputImage,
        output: {
          content: res.content,
          reasoning: res.reasoning
        },
        metrics: {
          promptTokens: res.usage.prompt_tokens,
          imageTokens: res.usage.image_tokens,
          completionTokens: res.usage.completion_tokens,
          reasoningTokens: res.usage.reasoning_tokens,
          totalTokens: res.usage.total_tokens,
          latencyMs: res.latencyMs,
          accuracyScore
        },
        groundTruth: metadata.groundTruth
      };
      fs.writeFileSync(path.join(sessionsDir, `${id}.json`), JSON.stringify(trace, null, 2));
    };

    // Shared constructor for both per-case result objects; only the per-mode
    // inputs differ, the 12 shared fields are assembled in one place.
    const buildRunResult = (
      mode: BenchmarkRunResult['mode'],
      imageResolution: BenchmarkRunResult['imageResolution'],
      imagePayloadBytes: number,
      imageFormat: string,
      res: VlmResult,
      modelAnswer: string,
      evalRes: { score: number; found: boolean },
      traceSessionId: string
    ): BenchmarkRunResult => ({
      mode,
      caseId: metadata.id,
      caseName: metadata.name,
      category: metadata.category,
      imageResolution,
      imagePayloadBytes,
      imageFormat,
      promptTokens: res.usage.prompt_tokens,
      imageTokens: res.usage.image_tokens,
      completionTokens: res.usage.completion_tokens,
      reasoningTokens: res.usage.reasoning_tokens,
      totalTokens: res.usage.total_tokens,
      latencyMs: res.latencyMs,
      accuracyScore: evalRes.score,
      defectFound: evalRes.found,
      modelAnswer,
      modelReasoning: res.reasoning,
      traceSessionId
    });

    // =========================================================================
    // RUN 1: WITHOUT ZeroVisual (Raw full-viewport screenshot)
    // =========================================================================
    console.log(`   ⏳ Mode A: WITHOUT ZeroVisual (Raw Full Viewport)...`);
    const rawMeta = await sharp(actualPng).metadata();
    const rawBase64 = `data:image/png;base64,${actualPng.toString('base64')}`;
    const rawPayloadBytes = actualPng.length;

    let resA;
    try {
      resA = await callVlmWithRetry(baseUrl, model, rawBase64, promptText, apiKey);
    } catch (err: any) {
      console.error(`   ❌ Failed Mode A:`, err.message);
      continue;
    }

    const evalA = evaluateAccuracy(resA.content, resA.reasoning, metadata.groundTruth);
    const traceSessionIdA = `session-${metadata.id}-without-${Date.now()}`;

    const effectiveAnswerA = pickEffectiveAnswer(resA);
    const resultA = buildRunResult(
      'without_zerovisual',
      { width: rawMeta.width ?? 0, height: rawMeta.height ?? 0 },
      rawPayloadBytes,
      'png',
      resA,
      effectiveAnswerA,
      evalA,
      traceSessionIdA
    );
    allResults.push(resultA);

    console.log(
      `      ✓ Mode A Complete: ${resA.usage.total_tokens} tokens (Img: ${resA.usage.image_tokens}), Latency: ${resA.latencyMs}ms, Accuracy: ${evalA.score}%`
    );

    // Save Langfuse / Pi agent session trace for Mode A
    const imageA = {
      resolution: resultA.imageResolution,
      format: 'png',
      bytes: rawPayloadBytes,
      isZeroVisualOptimized: false
    };
    writeTraceSession(traceSessionIdA, 'without_zerovisual', imageA, resA, evalA.score);

    // =========================================================================
    // RUN 2: WITH ZeroVisual (Cropped diff box + model-aligned WebP)
    // =========================================================================
    console.log(`   ⏳ Mode B: WITH ZeroVisual (Diff Bounding Box + Tile Downscaled WebP)...`);

    // Detect diff bounding box with ZeroVisual
    const diffResult = await detectDiffBoundingBox(diffPng, { padding: 32 });

    // Determine target provider based on model architecture
    const targetProvider = classifyProvider(model);

    // Optimize image for target provider
    const optResult = await optimizeImageForProvider(actualPng, {
      provider: targetProvider,
      cropBox: diffResult.boundingBox,
      quality: 85
    });

    const optPayloadBytes = optResult.buffer.length;
    let resB;
    try {
      resB = await callVlmWithRetry(baseUrl, model, optResult.dataUri, promptText, apiKey);
    } catch (err: any) {
      console.error(`   ❌ Failed Mode B:`, err.message);
      continue;
    }

    const evalB = evaluateAccuracy(resB.content, resB.reasoning, metadata.groundTruth);
    const traceSessionIdB = `session-${metadata.id}-with-${Date.now()}`;

    const effectiveAnswerB = pickEffectiveAnswer(resB);
    const resultB = buildRunResult(
      'with_zerovisual',
      { width: optResult.width, height: optResult.height },
      optPayloadBytes,
      'webp',
      resB,
      effectiveAnswerB,
      evalB,
      traceSessionIdB
    );
    allResults.push(resultB);

    const tokenSavedPct = percentSavings(resultA.totalTokens, resultB.totalTokens).toFixed(1);
    const imgTokenSavedPct =
      resultA.imageTokens > 0 ? percentSavings(resultA.imageTokens, resultB.imageTokens).toFixed(1) : '0.0';
    const bytesSavedPct = percentSavings(rawPayloadBytes, optPayloadBytes).toFixed(1);

    console.log(
      `      ✓ Mode B Complete: ${resB.usage.total_tokens} tokens (Img: ${resB.usage.image_tokens}), Latency: ${resB.latencyMs}ms, Accuracy: ${evalB.score}%`
    );
    console.log(
      `      ⚡️ Savings: Total Tokens: -${tokenSavedPct}% | Vision Image Tokens: -${imgTokenSavedPct}% | Bytes: -${bytesSavedPct}%\n`
    );

    // Save Langfuse / Pi agent session trace for Mode B
    const imageB = {
      resolution: resultB.imageResolution,
      format: 'webp',
      bytes: optPayloadBytes,
      isZeroVisualOptimized: true,
      cropBox: diffResult.boundingBox
    };
    writeTraceSession(traceSessionIdB, 'with_zerovisual', imageB, resB, evalB.score);
  }

  // Generate Reports
  generateReports(allResults, resultsDir, model, baseUrl);
}

function generateReports(results: BenchmarkRunResult[], resultsDir: string, model: string, baseUrl: string) {
  // Write raw summary JSON
  fs.writeFileSync(path.join(resultsDir, 'benchmark-summary.json'), JSON.stringify(results, null, 2));

  // Build + write Markdown report (pure builder lives in report.ts so it is unit-testable)
  const md = buildBenchmarkReport(results, model, baseUrl);
  fs.writeFileSync(path.join(resultsDir, 'benchmark-report.md'), md);
  console.log(`\n📄 Generated comprehensive report: ${path.join(resultsDir, 'benchmark-report.md')}`);
  console.log(`📊 Generated summary data: ${path.join(resultsDir, 'benchmark-summary.json')}`);
}

runBenchmark().catch(console.error);
