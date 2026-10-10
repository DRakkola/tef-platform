import React, { useEffect, useState } from "react";
import { Search, Music, Image as ImageIcon, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchMediaAssets, getMediaPresignedUrl } from "../api";
import type { MediaAssetItem } from "../types";

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAssetItem, presignedUrl?: string) => void;
  allowedMediaType?: "audio" | "image";
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  allowedMediaType,
}) => {
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "audio" | "image">(
    allowedMediaType || "all"
  );
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen, mediaTypeFilter]);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMediaAssets({
        media_type: mediaTypeFilter !== "all" ? mediaTypeFilter : undefined,
        page: 1,
        page_size: 100,
      });
      setAssets(data.items || []);
    } catch {
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetClick = async (asset: MediaAssetItem) => {
    setSelectedAsset(asset);
    try {
      const res = await getMediaPresignedUrl(asset.id);
      setPreviewUrl(res.url);
    } catch {
      setPreviewUrl(null);
    }
  };

  const handleConfirm = () => {
    if (selectedAsset) {
      onSelect(selectedAsset, previewUrl || undefined);
      onClose();
    }
  };

  if (!isOpen) return null;

  const filteredAssets = assets.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Bibliothèque de Médias</h2>
            <p className="text-xs text-muted-foreground">
              Sélectionnez un fichier audio ou une image déjà hébergé(e) sur MinIO.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre ou nom de fichier..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {!allowedMediaType && (
            <div className="flex items-center gap-1">
              {(["all", "audio", "image"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                    mediaTypeFilter === t
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "all" ? "Tous" : t === "audio" ? "Audio" : "Images"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Chargement des médias...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs">
              Aucun média trouvé. Téléversez un nouveau fichier directement depuis l'éditeur.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => handleAssetClick(asset)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-2 text-xs relative ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-xs"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-muted text-primary shrink-0">
                        {asset.media_type === "audio" ? (
                          <Music className="h-4 w-4" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate" title={asset.title}>
                          {asset.title}
                        </div>
                        <div className="text-2xs text-muted-foreground truncate" title={asset.filename}>
                          {asset.filename}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1 border-t border-border/40">
                      <span className="uppercase font-mono font-semibold">{asset.media_type}</span>
                      <span>{(asset.file_size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Preview Footer */}
        {selectedAsset && previewUrl && (
          <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 text-xs">
              <span className="font-semibold text-foreground truncate block">
                {selectedAsset.title}
              </span>
              {selectedAsset.media_type === "audio" ? (
                <audio controls src={previewUrl} className="h-8 mt-1 w-full max-w-md" />
              ) : (
                <img
                  src={previewUrl}
                  alt={selectedAsset.title}
                  className="h-12 w-auto object-cover rounded mt-1 border border-border"
                />
              )}
            </div>

            <Button onClick={handleConfirm} size="sm" className="gap-1.5 shrink-0">
              <Check className="h-4 w-4" /> Sélectionner ce média
            </Button>
          </div>
        )}

        {/* Modal Action Footer */}
        {!selectedAsset && (
          <div className="p-3 border-t border-border flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
