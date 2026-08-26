// ============================================================
// Storage Adapter — Abstraction layer for file storage
// Supports: Local (dev) → Aliyun OSS (production)
// ============================================================

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

export interface MultipartUploadOptions extends UploadOptions {
  partSize?: number; // bytes, default 5MB
}

export interface StorageAdapter {
  uploadFile(
    key: string,
    file: File | Blob,
    options?: UploadOptions
  ): Promise<{ key: string; url: string }>;

  deleteFile(key: string): Promise<void>;

  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  createMultipartUpload(
    key: string,
    file: File,
    options?: MultipartUploadOptions
  ): Promise<{ key: string; uploadId: string }>;

  listFiles(prefix: string): Promise<{ key: string; size: number; lastModified: string }[]>;
}

// ---------- Local Storage Adapter (Development) ----------

export class LocalStorageAdapter implements StorageAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage') {
    this.baseUrl = baseUrl;
  }

  async uploadFile(
    key: string,
    file: File | Blob,
    options?: UploadOptions
  ): Promise<{ key: string; url: string }> {
    // Simulate upload with progress
    const totalSteps = 10;
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise((r) => setTimeout(r, 200));
      options?.onProgress?.((i / totalSteps) * 100);
    }

    return {
      key,
      url: `${this.baseUrl}/${key}`,
    };
  }

  async deleteFile(key: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));
    console.log(`[LocalStorage] Deleted: ${key}`);
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return `${this.baseUrl}/${key}?signed=true`;
  }

  async createMultipartUpload(
    key: string,
    _file: File,
    _options?: MultipartUploadOptions
  ): Promise<{ key: string; uploadId: string }> {
    return {
      key,
      uploadId: `multipart-${Date.now()}`,
    };
  }

  async listFiles(prefix: string): Promise<{ key: string; size: number; lastModified: string }[]> {
    console.log(`[LocalStorage] Listing files with prefix: ${prefix}`);
    return [];
  }
}

// ---------- Future: Aliyun OSS Adapter ----------
// export class AliyunOSSAdapter implements StorageAdapter { ... }

// ---------- Storage Instance ----------

let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    storageInstance = new LocalStorageAdapter();
  }
  return storageInstance;
}

export function setStorage(adapter: StorageAdapter): void {
  storageInstance = adapter;
}

// ---------- Storage Key Generator ----------

export function generateStorageKey(params: {
  year?: number;
  department?: string;
  taskId?: string;
  deliverableId?: string;
  fileId: string;
  extension: string;
}): string {
  const parts = [
    params.year?.toString() ?? new Date().getFullYear().toString(),
    params.department ?? 'general',
    params.taskId ?? 'unlinked',
    params.deliverableId ?? 'direct',
    `${params.fileId}${params.extension}`,
  ];
  return parts.join('/');
}
