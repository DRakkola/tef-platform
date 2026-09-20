import React, { useEffect, useState, useRef } from "react";
import {
  Image as ImageIcon,
  Upload,
  Music,
  FileText,
  Trash2,
  Download,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchMediaAssets,
  uploadMediaAsset,
  getMediaPresignedUrl,
  deleteMediaAsset,
} from "./api";
import type { MediaAssetItem } from "./types";
import { Button } from "@/components/ui/button";

export const MediaManagerPage: React.FC = () => {
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("audio");
  const [isUploading, setIsUploading] = useState(false);

  // Audio player preview
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadMedia = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMediaAssets({
        media_type: typeFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setAssets(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load media assets." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [typeFilter]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      await uploadMediaAsset(selectedFile, uploadTitle || selectedFile.name, uploadType, false);
      setMsg({ type: "success", text: `File "${selectedFile.name}" uploaded successfully.` });
      setUploadModalOpen(false);
      setSelectedFile(null);
      setUploadTitle("");
      loadMedia();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to upload file." });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePlayAudio = async (asset: MediaAssetItem) => {
    if (playingAssetId === asset.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingAssetId(null);
      }
      return;
    }

    try {
      const { url } = await getMediaPresignedUrl(asset.id, 1800);
      setPlayingAssetId(asset.id);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch (err: any) {
      setMsg({ type: "error", text: "Failed to generate presigned audio URL." });
    }
  };

  const handleDownloadPresigned = async (asset: MediaAssetItem) => {
    try {
      const { url } = await getMediaPresignedUrl(asset.id, 3600);
      window.open(url, "_blank");
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to get download URL." });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete media asset "${name}"?`)) return;
    try {
      await deleteMediaAsset(id);
      setMsg({ type: "success", text: `Asset "${name}" deleted.` });
      loadMedia();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to delete asset." });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-sky-400" />
              Media Assets Library ({total})
            </h1>
            <p className="text-sm text-slate-400">
              MinIO private object storage with MIME verification and expiring presigned URLs.
            </p>
          </div>
          <Button
            onClick={() => setUploadModalOpen(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 gap-1.5 self-start"
          >
            <Upload className="h-4 w-4" /> Upload Media
          </Button>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              msg.type === "success"
                ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border border-rose-800 text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {msg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {msg.text}
            </span>
            <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Hidden Audio Player */}
        <audio
          ref={audioRef}
          onEnded={() => setPlayingAssetId(null)}
          className="hidden"
        />

        {/* Filters */}
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Filter type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
          >
            <option value="">All Media Types</option>
            <option value="audio">Audio (Listening Snippets)</option>
            <option value="image">Images & Diagrams</option>
            <option value="document">Documents & PDFs</option>
          </select>
        </div>

        {/* Media Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading media assets...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm">
            No media assets found in private storage.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const isAudio = asset.media_type === "audio";
              const isPlaying = playingAssetId === asset.id;

              return (
                <div
                  key={asset.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-indigo-400">
                        {isAudio ? (
                          <Music className="h-5 w-5" />
                        ) : asset.media_type === "image" ? (
                          <ImageIcon className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-white text-xs truncate max-w-[180px]">
                          {asset.title}
                        </h3>
                        <p className="text-2xs text-slate-400 font-mono truncate max-w-[180px]">
                          {asset.filename}
                        </p>
                      </div>
                    </div>

                    <span className="text-2xs px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 uppercase font-mono">
                      {asset.media_type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-2xs text-slate-400 font-mono pt-1">
                    <span>Size: {formatFileSize(asset.file_size)}</span>
                    <span className="truncate max-w-[130px]" title={asset.content_type}>
                      {asset.content_type}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      {isAudio && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePlayAudio(asset)}
                          className={`h-7 text-xs gap-1 ${
                            isPlaying
                              ? "bg-indigo-600 text-white border-indigo-500"
                              : "border-slate-700 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="h-3 w-3" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" /> Preview
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPresigned(asset)}
                        className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1"
                        title="Download via expiring presigned URL"
                      >
                        <Download className="h-3 w-3" /> Presigned
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(asset.id, asset.filename)}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                      title="Delete asset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Upload Media */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-400" />
                Upload Media Asset
              </h2>
              <form onSubmit={handleUpload} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Title / Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annonce SNCF Retard TGV"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Media Type</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  >
                    <option value="audio">Audio (.mp3, .wav, .m4a)</option>
                    <option value="image">Image (.png, .jpg, .webp)</option>
                    <option value="document">Document (.pdf)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Select File (Max 50MB)</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!uploadTitle) setUploadTitle(e.target.files[0].name);
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-950 file:text-indigo-300 hover:file:bg-indigo-900"
                  />
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-2xs text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Uploaded files are stored privately in MinIO. Access requires time-limited presigned URLs.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadModalOpen(false)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUploading}
                    className="bg-indigo-600 hover:bg-indigo-500 gap-1"
                  >
                    {isUploading ? "Uploading..." : "Upload File"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
