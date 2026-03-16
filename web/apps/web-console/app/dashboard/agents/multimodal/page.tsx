'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMultimodalInfer, useMultimodalStats, MultimodalResponse } from '@/hooks/useMultimodal';
import { Image, Mic, Send, Upload, X, Activity, Clock, CheckCircle, BarChart3, Zap } from 'lucide-react';

function base64Encode(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function MultimodalPage() {
  const inferMutation = useMultimodalInfer();
  const { data: stats } = useMultimodalStats();

  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [result, setResult] = useState<MultimodalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearAudio = () => {
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!prompt && !imageFile && !audioFile) return;
    setError(null);
    setResult(null);

    try {
      let imageData: string | undefined;
      let imageMime: string | undefined;
      let audioData: string | undefined;
      let audioMime: string | undefined;

      if (imageFile) {
        const buf = await imageFile.arrayBuffer();
        imageData = base64Encode(buf);
        imageMime = imageFile.type;
      }

      if (audioFile) {
        const buf = await audioFile.arrayBuffer();
        audioData = base64Encode(buf);
        audioMime = audioFile.type;
      }

      const res = await inferMutation.mutateAsync({
        prompt,
        image_data: imageData,
        image_mime: imageMime,
        audio_data: audioData,
        audio_mime: audioMime,
      });

      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inference failed');
    }
  };

  const activeModalities = [
    prompt && 'text',
    imageFile && 'image',
    audioFile && 'audio',
  ].filter(Boolean);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-[#f6f6f4]">
            Multimodal Inference
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Send images and audio to capable providers alongside text prompts
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Requests</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {stats?.total_requests ?? '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4 text-purple-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Image Requests</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {stats?.image_requests ?? '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-green-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Audio Requests</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {stats?.audio_requests ?? '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-yellow-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Avg Latency</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {stats ? `${Math.round(stats.avg_latency_ms)}ms` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Input</CardTitle>
              <CardDescription className="text-xs">
                Combine text, image, and audio for a single inference request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Text prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Text Prompt</Label>
                <Textarea
                  placeholder="Describe what you want to analyze…"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  className="text-xs min-h-[80px] resize-none"
                />
              </div>

              {/* Image upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Image (optional)</Label>
                {imagePreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#f6f6f4]/10">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 bg-gray-900/60 text-white rounded-full p-0.5 hover:bg-gray-900/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-2 left-2">
                      <span className="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                        {imageFile?.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-200 dark:border-[#f6f6f4]/20 rounded-lg text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Click to upload image (JPEG, PNG, WebP)
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              {/* Audio upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Audio (optional)</Label>
                {audioFile ? (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Mic className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{audioFile.name}</span>
                      <span className="text-[10px] text-gray-400">
                        {(audioFile.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button onClick={clearAudio} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full h-14 border-2 border-dashed border-gray-200 dark:border-[#f6f6f4]/20 rounded-lg text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Mic className="h-4 w-4" />
                    Click to upload audio (WAV, MP3, M4A)
                  </button>
                )}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/wav,audio/mpeg,audio/mp4,audio/m4a"
                  className="hidden"
                  onChange={handleAudioSelect}
                />
              </div>

              {/* Active modalities indicator */}
              {activeModalities.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">Active:</span>
                  {activeModalities.map(m => (
                    <span key={m as string} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              )}

              <Button
                className="w-full h-8 text-xs gap-1.5"
                onClick={handleSubmit}
                disabled={inferMutation.isPending || (!prompt && !imageFile && !audioFile)}
              >
                <Send className="h-3.5 w-3.5" />
                {inferMutation.isPending ? 'Processing…' : 'Run Inference'}
              </Button>
            </CardContent>
          </Card>

          {/* Result panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Result</CardTitle>
              <CardDescription className="text-xs">Inference output and metadata</CardDescription>
            </CardHeader>
            <CardContent>
              {inferMutation.isPending && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-gray-400">Running inference…</p>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              {result && !inferMutation.isPending && (
                <div className="space-y-4">
                  {/* Response content */}
                  <div className="rounded-lg bg-gray-50 dark:bg-[#1b1912] border border-gray-100 dark:border-[#f6f6f4]/10 p-3">
                    <p className="text-xs text-gray-800 dark:text-[#f6f6f4] leading-relaxed whitespace-pre-wrap">
                      {result.content}
                    </p>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-100 dark:border-[#f6f6f4]/10 p-2.5">
                      <p className="text-[10px] text-gray-400 mb-1">Provider / Model</p>
                      <p className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4]">{result.provider}</p>
                      <p className="text-[10px] text-gray-500">{result.model}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 dark:border-[#f6f6f4]/10 p-2.5">
                      <p className="text-[10px] text-gray-400 mb-1">Latency</p>
                      <p className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4]">{result.latency_ms}ms</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 dark:border-[#f6f6f4]/10 p-2.5">
                      <p className="text-[10px] text-gray-400 mb-1">Tokens</p>
                      <p className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4]">
                        {result.input_tokens} in / {result.output_tokens} out
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-100 dark:border-[#f6f6f4]/10 p-2.5">
                      <p className="text-[10px] text-gray-400 mb-1">Modalities</p>
                      <div className="flex flex-wrap gap-1">
                        {result.modalities.map(m => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!result && !inferMutation.isPending && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex gap-2 mb-3">
                    <Image className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
                    <Mic className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs text-gray-400">
                    Add a prompt, image, or audio file and run inference
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Supported providers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Supported Providers</CardTitle>
            <CardDescription className="text-xs">Providers with vision and audio capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: 'Anthropic', modalities: ['text', 'image'], models: ['claude-opus-4-6', 'claude-sonnet-4-6'] },
                { name: 'OpenAI', modalities: ['text', 'image', 'audio'], models: ['gpt-4o', 'whisper-1'] },
                { name: 'Google', modalities: ['text', 'image'], models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
              ].map(provider => (
                <div key={provider.name} className="rounded-lg border border-gray-100 dark:border-[#f6f6f4]/10 p-3">
                  <p className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-2">{provider.name}</p>
                  <div className="flex gap-1 mb-2">
                    {provider.modalities.map(m => (
                      <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-0.5">
                    {provider.models.map(m => (
                      <p key={m} className="text-[10px] text-gray-400 font-mono">{m}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
