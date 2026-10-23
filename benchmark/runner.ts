import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { detectDiffBoundingBox, optimizeImageForProvider } from '../dist/index.js';

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

interface BenchmarkRunResult {
  mode: 'without_zerovisual' | 'with_zerovisual';
  caseId: string;
  caseName: string;
  category: string;
  imageResolution: { width: number; height: number };
  imagePayloadBytes: number;
  imageFormat: string;
  promptTokens: number;
  imageTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  latencyMs: number;
  accuracyScore: number;
  defectFound: boolean;
  modelAnswer: string;
  modelReasoning: string;
  traceSessionId: string;
}

// Load .env
function loadEnv(): { baseUrl: string; model: string; apiKey?: string } {
  const envPath = path.resolve(process.cwd(), 'benchmark/.env');
  let baseUrl = 'https://spark.ntsd.dev:8001/v1';
  let model = 'RadixArk/Qwen3.8-27B-NVFP4';
  let apiKey: string | undefined;
  let aiStudioKey: string | undefined;

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cleanLine = trimmed.split('#')[0]!.trim();
      const [k, ...v] = cleanLine.split('=');
      const val = v.join('=').trim();
      if (k?.trim() === 'OPENAI_BASE_URL') baseUrl = val;
      if (k?.trim() === 'AGENT_MODEL') model = val;
      if (k?.trim() === 'OPENAI_API_KEY') apiKey = val;
      if (k?.trim() === 'AI_STUDIO_API_KEY') aiStudioKey = val;
    }
  }

  // Gemma/Gemini models route through Google AI Studio's OpenAI-compatible endpoint.
  if (/gemma|gemini/i.test(model) && aiStudioKey) {
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
  const generalDefectKeywords = ['shift', 'padding', 'margin', 'contrast', 'overlap', 'overflow', 'color', 'clip', 'broken', 'misaligned', 'collision'];
  const matchedGeneral = generalDefectKeywords.some(k => gt.defect.toLowerCase().includes(k) && text.includes(k));

  if (matchedDefect || matchedGeneral) {
    score += 35;
  }

  // 3. Root Cause & Fix Recommendation (up to 30 pts)
  const fixKeywords = gt.rootCause.toLowerCase().split(/\s+/).concat(gt.suggestedFix.toLowerCase().split(/\s+/)).filter(w => w.length > 3);
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
  const thoughts = [...text.matchAll(/<thought>([\s\S]*?)<\/thought>/g)]
    .map(m => m[1]!.trim())
    .filter(Boolean);
  if (thoughts.length === 0) return { content: text, reasoning: '' };
  return {
    content: text.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim(),
    reasoning: thoughts.join('\n\n')
  };
}

async function callVlm(
  baseUrl: string,
  model: string,
  imageDataUri: string,
  promptText: string,
  apiKey?: string
): Promise<{
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
}> {
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
      const retryable = /API error \((429|5\d\d)\)/.test(err.message)
        || err.message.includes('Unable to process input image');
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

  const cases = fs.readdirSync(testdataDir).filter(f => fs.statSync(path.join(testdataDir, f)).isDirectory()).sort();

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

    const effectiveAnswerA = resA.content.trim().length > 10
      ? resA.content.trim()
      : (resA.reasoning.split('\n\n').slice(-3).join('\n\n').trim() || resA.reasoning.trim());

    const resultA: BenchmarkRunResult = {
      mode: 'without_zerovisual',
      caseId: metadata.id,
      caseName: metadata.name,
      category: metadata.category,
      imageResolution: { width: rawMeta.width ?? 0, height: rawMeta.height ?? 0 },
      imagePayloadBytes: rawPayloadBytes,
      imageFormat: 'png',
      promptTokens: resA.usage.prompt_tokens,
      imageTokens: resA.usage.image_tokens,
      completionTokens: resA.usage.completion_tokens,
      reasoningTokens: resA.usage.reasoning_tokens,
      totalTokens: resA.usage.total_tokens,
      latencyMs: resA.latencyMs,
      accuracyScore: evalA.score,
      defectFound: evalA.found,
      modelAnswer: effectiveAnswerA,
      modelReasoning: resA.reasoning,
      traceSessionId: traceSessionIdA
    };
    allResults.push(resultA);

    console.log(`      ✓ Mode A Complete: ${resA.usage.total_tokens} tokens (Img: ${resA.usage.image_tokens}), Latency: ${resA.latencyMs}ms, Accuracy: ${evalA.score}%`);

    // Save Langfuse / Pi agent session trace for Mode A
    const traceA = {
      id: traceSessionIdA,
      timestamp: new Date().toISOString(),
      benchmarkRunTimestamp: runTimestamp,
      caseId: metadata.id,
      caseName: metadata.name,
      mode: 'without_zerovisual',
      model,
      systemPrompt: 'You are an automated visual regression QA engineer.',
      userPrompt: promptText,
      inputImage: {
        resolution: resultA.imageResolution,
        format: 'png',
        bytes: rawPayloadBytes,
        isZeroVisualOptimized: false
      },
      output: {
        content: resA.content,
        reasoning: resA.reasoning
      },
      metrics: {
        promptTokens: resA.usage.prompt_tokens,
        imageTokens: resA.usage.image_tokens,
        completionTokens: resA.usage.completion_tokens,
        reasoningTokens: resA.usage.reasoning_tokens,
        totalTokens: resA.usage.total_tokens,
        latencyMs: resA.latencyMs,
        accuracyScore: evalA.score
      },
      groundTruth: metadata.groundTruth
    };
    fs.writeFileSync(path.join(sessionsDir, `${traceSessionIdA}.json`), JSON.stringify(traceA, null, 2));

    // =========================================================================
    // RUN 2: WITH ZeroVisual (Cropped diff box + model-aligned WebP)
    // =========================================================================
    console.log(`   ⏳ Mode B: WITH ZeroVisual (Diff Bounding Box + Tile Downscaled WebP)...`);

    // Detect diff bounding box with ZeroVisual
    const diffResult = await detectDiffBoundingBox(diffPng, { padding: 32 });

    // Determine target provider based on model architecture
    const targetProvider = model.toLowerCase().includes('gemma')
      ? 'gemini'
      : (model.toLowerCase().includes('qwen') ? 'qwen' : 'local');

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

    const effectiveAnswerB = resB.content.trim().length > 10
      ? resB.content.trim()
      : (resB.reasoning.split('\n\n').slice(-3).join('\n\n').trim() || resB.reasoning.trim());

    const resultB: BenchmarkRunResult = {
      mode: 'with_zerovisual',
      caseId: metadata.id,
      caseName: metadata.name,
      category: metadata.category,
      imageResolution: { width: optResult.width, height: optResult.height },
      imagePayloadBytes: optPayloadBytes,
      imageFormat: 'webp',
      promptTokens: resB.usage.prompt_tokens,
      imageTokens: resB.usage.image_tokens,
      completionTokens: resB.usage.completion_tokens,
      reasoningTokens: resB.usage.reasoning_tokens,
      totalTokens: resB.usage.total_tokens,
      latencyMs: resB.latencyMs,
      accuracyScore: evalB.score,
      defectFound: evalB.found,
      modelAnswer: effectiveAnswerB,
      modelReasoning: resB.reasoning,
      traceSessionId: traceSessionIdB
    };
    allResults.push(resultB);

    const tokenSavedPct = (((resultA.totalTokens - resultB.totalTokens) / resultA.totalTokens) * 100).toFixed(1);
    const imgTokenSavedPct = resultA.imageTokens > 0
      ? (((resultA.imageTokens - resultB.imageTokens) / resultA.imageTokens) * 100).toFixed(1)
      : '0.0';
    const bytesSavedPct = (((rawPayloadBytes - optPayloadBytes) / rawPayloadBytes) * 100).toFixed(1);

    console.log(`      ✓ Mode B Complete: ${resB.usage.total_tokens} tokens (Img: ${resB.usage.image_tokens}), Latency: ${resB.latencyMs}ms, Accuracy: ${evalB.score}%`);
    console.log(`      ⚡️ Savings: Total Tokens: -${tokenSavedPct}% | Vision Image Tokens: -${imgTokenSavedPct}% | Bytes: -${bytesSavedPct}%\n`);

    // Save Langfuse / Pi agent session trace for Mode B
    const traceB = {
      id: traceSessionIdB,
      timestamp: new Date().toISOString(),
      benchmarkRunTimestamp: runTimestamp,
      caseId: metadata.id,
      caseName: metadata.name,
      mode: 'with_zerovisual',
      model,
      systemPrompt: 'You are an automated visual regression QA engineer.',
      userPrompt: promptText,
      inputImage: {
        resolution: resultB.imageResolution,
        format: 'webp',
        bytes: optPayloadBytes,
        isZeroVisualOptimized: true,
        cropBox: diffResult.boundingBox
      },
      output: {
        content: resB.content,
        reasoning: resB.reasoning
      },
      metrics: {
        promptTokens: resB.usage.prompt_tokens,
        imageTokens: resB.usage.image_tokens,
        completionTokens: resB.usage.completion_tokens,
        reasoningTokens: resB.usage.reasoning_tokens,
        totalTokens: resB.usage.total_tokens,
        latencyMs: resB.latencyMs,
        accuracyScore: evalB.score
      },
      groundTruth: metadata.groundTruth
    };
    fs.writeFileSync(path.join(sessionsDir, `${traceSessionIdB}.json`), JSON.stringify(traceB, null, 2));
  }

  // Generate Reports
  generateReports(allResults, resultsDir, model, baseUrl);
}

function generateReports(results: BenchmarkRunResult[], resultsDir: string, model: string, baseUrl: string) {
  // Write raw summary JSON
  fs.writeFileSync(path.join(resultsDir, 'benchmark-summary.json'), JSON.stringify(results, null, 2));

  // Compute Aggregate Stats
  const rawRuns = results.filter(r => r.mode === 'without_zerovisual');
  const optRuns = results.filter(r => r.mode === 'with_zerovisual');

  const totalRawTokens = rawRuns.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalOptTokens = optRuns.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalTokenSavings = totalRawTokens > 0 ? (((totalRawTokens - totalOptTokens) / totalRawTokens) * 100).toFixed(1) : '0';

  const totalRawImgTokens = rawRuns.reduce((sum, r) => sum + r.imageTokens, 0);
  const totalOptImgTokens = optRuns.reduce((sum, r) => sum + r.imageTokens, 0);
  const totalImgTokenSavings = totalRawImgTokens > 0 ? (((totalRawImgTokens - totalOptImgTokens) / totalRawImgTokens) * 100).toFixed(1) : '0';

  const totalRawBytes = rawRuns.reduce((sum, r) => sum + r.imagePayloadBytes, 0);
  const totalOptBytes = optRuns.reduce((sum, r) => sum + r.imagePayloadBytes, 0);
  const totalByteSavings = totalRawBytes > 0 ? (((totalRawBytes - totalOptBytes) / totalRawBytes) * 100).toFixed(1) : '0';

  const avgRawLatency = rawRuns.length > 0 ? Math.round(rawRuns.reduce((sum, r) => sum + r.latencyMs, 0) / rawRuns.length) : 0;
  const avgOptLatency = optRuns.length > 0 ? Math.round(optRuns.reduce((sum, r) => sum + r.latencyMs, 0) / optRuns.length) : 0;

  const avgRawAccuracy = rawRuns.length > 0 ? (rawRuns.reduce((sum, r) => sum + r.accuracyScore, 0) / rawRuns.length).toFixed(1) : '0';
  const avgOptAccuracy = optRuns.length > 0 ? (optRuns.reduce((sum, r) => sum + r.accuracyScore, 0) / optRuns.length).toFixed(1) : '0';

  // Build Markdown Report
  let md = `# 📊 ZeroVisual Empirical Benchmark Report\n\n`;
  md += `> **Model Evaluated:** \`${model}\` via \`${baseUrl}\`\n`;
  md += `> **Date:** ${new Date().toISOString()}\n`;
  md += `> **Total Test Cases:** ${rawRuns.length}\n\n`;

  md += `## 🌟 Executive Summary\n\n`;
  md += `| Core Metric | Without ZeroVisual (Raw) | With ZeroVisual (Optimized) | Empirical Improvement |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **Total Tokens Consumed** | **${totalRawTokens.toLocaleString()} tokens** | **${totalOptTokens.toLocaleString()} tokens** | **-${totalTokenSavings}% Token Reduction** |\n`;
  md += `| **Vision Image Tokens (ViT)** | **${totalRawImgTokens.toLocaleString()} tokens** | **${totalOptImgTokens.toLocaleString()} tokens** | **-${totalImgTokenSavings}% Vision Token Savings** |\n`;
  md += `| **Network Payload Transfer** | **${(totalRawBytes / 1024).toFixed(1)} KB** | **${(totalOptBytes / 1024).toFixed(1)} KB** | **-${totalByteSavings}% Payload Bandwidth Reduction** |\n`;
  md += `| **Average Roundtrip Latency** | **${avgRawLatency} ms** | **${avgOptLatency} ms** | **${avgRawLatency > avgOptLatency ? `${Math.round(((avgRawLatency - avgOptLatency) / avgRawLatency) * 100)}% Faster` : 'Comparable'}** |\n`;
  md += `| **Average Triage Accuracy** | **${avgRawAccuracy}%** | **${avgOptAccuracy}%** | **${Number(avgOptAccuracy) >= Number(avgRawAccuracy) ? `+${(Number(avgOptAccuracy) - Number(avgRawAccuracy)).toFixed(1)}% Accuracy` : `${(Number(avgOptAccuracy) - Number(avgRawAccuracy)).toFixed(1)}%`}** |\n\n`;

  md += `## 📋 Per-Case Benchmark Breakdown\n\n`;
  md += `| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (let i = 0; i < rawRuns.length; i++) {
    const raw = rawRuns[i];
    const opt = optRuns[i];

    md += `| **${raw.caseName}** | Raw Viewport | ${raw.imageResolution.width}×${raw.imageResolution.height} | ${(raw.imagePayloadBytes / 1024).toFixed(1)} KB | ${raw.totalTokens} | ${raw.imageTokens} | ${raw.latencyMs} ms | ${raw.accuracyScore}% |\n`;
    if (opt) {
      md += `| | **ZeroVisual** | **${opt.imageResolution.width}×${opt.imageResolution.height}** | **${(opt.imagePayloadBytes / 1024).toFixed(1)} KB** | **${opt.totalTokens}** | **${opt.imageTokens}** | **${opt.latencyMs} ms** | **${opt.accuracyScore}%** |\n`;
    }
  }

  md += `\n---\n\n`;
  md += `## 🔬 Deep-Dive Case Details & Model Responses\n\n`;

  for (let i = 0; i < rawRuns.length; i++) {
    const raw = rawRuns[i];
    const opt = optRuns[i];

    md += `### Case ${i + 1}: ${raw.caseName} (\`${raw.caseId}\`)\n\n`;
    md += `- **Category:** ${raw.category}\n`;
    md += `- **Without ZeroVisual Tokens:** ${raw.totalTokens} (Image: ${raw.imageTokens}) | Latency: ${raw.latencyMs}ms | Accuracy: ${raw.accuracyScore}%\n`;
    if (opt) {
      const savedPct = (((raw.totalTokens - opt.totalTokens) / raw.totalTokens) * 100).toFixed(1);
      const imgSavedPct = raw.imageTokens > 0 ? (((raw.imageTokens - opt.imageTokens) / raw.imageTokens) * 100).toFixed(1) : '0';
      md += `- **With ZeroVisual Tokens:** **${opt.totalTokens}** (Image: **${opt.imageTokens}**) | Latency: ${opt.latencyMs}ms | Accuracy: ${opt.accuracyScore}%\n`;
      md += `- **Savings:** **${savedPct}% total tokens**, **${imgSavedPct}% vision image tokens**, **${(((raw.imagePayloadBytes - opt.imagePayloadBytes) / raw.imagePayloadBytes) * 100).toFixed(1)}% bandwidth**\n\n`;

      md += `#### Model Diagnosis (ZeroVisual Optimized)\n`;
      const cleanAnswer = (opt.modelAnswer || opt.modelReasoning.slice(-400)).trim();
      md += `> ${cleanAnswer.replace(/\n/g, '\n> ')}\n\n`;
    }
  }

  md += `## 📂 Agent Session Traces\n\n`;
  md += `Full interaction sessions (prompts, raw reasoning, tool outputs, latency metrics) are archived in JSON format under \`benchmark/results/sessions/\`:\n\n`;
  results.forEach(r => {
    md += `- [\`${r.traceSessionId}.json\`](./sessions/${r.traceSessionId}.json) (${r.mode}, ${r.totalTokens} tokens)\n`;
  });

  fs.writeFileSync(path.join(resultsDir, 'benchmark-report.md'), md);
  console.log(`\n📄 Generated comprehensive report: ${path.join(resultsDir, 'benchmark-report.md')}`);
  console.log(`📊 Generated summary data: ${path.join(resultsDir, 'benchmark-summary.json')}`);
}

runBenchmark().catch(console.error);
