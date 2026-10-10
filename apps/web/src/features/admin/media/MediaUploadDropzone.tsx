import React, { useRef, useState } from "react";
import { UploadCloud, Music, Image as ImageIcon, X, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadMediaFile, getMediaPresignedUrl } from "../api";
import { MediaLibraryModal } from "./MediaLibraryModal";

interface MediaUploadDropzoneProps {
  mediaUrl?: string | null;
  mediaAssetId?: string | null;
  onMediaChange: (mediaUrl: string | null, mediaAssetId: string | null) => void;
  allowedMediaType?: "audio" | "image";
  label?: string;
  disabled?: boolean;
}

export const MediaUploadDropzone: React.FC<MediaUploadDropzoneProps> = ({
  mediaUrl,
  mediaAssetId: _mediaAssetId,
  onMediaChange,
  allowedMediaType,
  label = "Fichier multimédia (Audio d'écoute ou Illustration)",
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (disabled) return;
    setErrorMsg(null);
    setIsUploading(true);

    const isAudio = file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i);
    const isImage = file.type.startsWith("image/") || file.name.match(/\.(png|jpe?g|webp|gif)$/i);

    if (allowedMediaType === "audio" && !isAudio) {
      setErrorMsg("Veuillez sélectionner un fichier audio valide (.mp3, .wav, .ogg, .m4a).");
      setIsUploading(false);
      return;
    }

    if (allowedMediaType === "image" && !isImage) {
      setErrorMsg("Veuillez sélectionner une image valide (.png, .jpg, .webp).");
      setIsUploading(false);
      return;
    }

    const detectedType: "audio" | "image" = isAudio ? "audio" : "image";
    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

    try {
      const asset = await uploadMediaFile(file, cleanTitle, detectedType);
      const presigned = await getMediaPresignedUrl(asset.id);
      onMediaChange(presigned.url, asset.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Échec du téléversement vers MinIO.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    onMediaChange(null, null);
  };

  const isAudioFile =
    mediaUrl?.match(/\.(mp3|wav|ogg|m4a|webm)($|\?)/i) ||
    allowedMediaType === "audio";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {allowedMediaType === "audio" ? (
            <Music className="h-3.5 w-3.5 text-primary" />
          ) : allowedMediaType === "image" ? (
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5 text-primary" />
          )}
          {label}
        </label>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsLibraryOpen(true)}
          disabled={disabled || isUploading}
          className="h-6 text-2xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <FolderOpen className="h-3 w-3" /> Bibliothèque de médias
        </Button>
      </div>

      {errorMsg && (
        <div className="text-2xs text-rose-600 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
          {errorMsg}
        </div>
      )}

      {/* Media Active Display */}
      {mediaUrl ? (
        <div className="p-3 rounded-xl border border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
              {isAudioFile ? <Music className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate">
                Média attaché
              </div>
              <div className="text-2xs text-muted-foreground truncate max-w-xs sm:max-w-md">
                {mediaUrl}
              </div>

              {isAudioFile ? (
                <audio controls src={mediaUrl} className="h-7 mt-2 w-full max-w-sm" />
              ) : (
                <img
                  src={mediaUrl}
                  alt="Aperçu média"
                  className="h-16 w-auto object-contain rounded mt-2 border border-border"
                />
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
            className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" /> Retirer
          </Button>
        </div>
      ) : (
        /* Dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 bg-card/60"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            accept={
              allowedMediaType === "audio"
                ? "audio/*,.mp3,.wav,.ogg,.m4a"
                : allowedMediaType === "image"
                ? "image/*,.png,.jpg,.jpeg,.webp"
                : "audio/*,image/*,.mp3,.wav,.ogg,.m4a,.png,.jpg,.jpeg,.webp"
            }
            className="hidden"
            disabled={disabled || isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Téléversement vers MinIO en cours...</span>
            </div>
          ) : (
            <>
              <div className="p-2.5 rounded-full bg-muted text-muted-foreground">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold text-foreground">
                Glissez-déposez un fichier ici, ou <span className="text-primary underline">parcourir</span>
              </div>
              <div className="text-2xs text-muted-foreground">
                {allowedMediaType === "audio"
                  ? "Formats audio : MP3, WAV, OGG, M4A (Max 50 MB)"
                  : allowedMediaType === "image"
                  ? "Formats image : PNG, JPEG, WEBP (Max 10 MB)"
                  : "Audio (MP3, WAV) ou Image (PNG, JPEG)"}
              </div>
            </>
          )}
        </div>
      )}

      {/* Library Modal */}
      <MediaLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        allowedMediaType={allowedMediaType}
        onSelect={(asset, presigned) => {
          onMediaChange(presigned || asset.storage_object_key, asset.id);
        }}
      />
    </div>
  );
};
