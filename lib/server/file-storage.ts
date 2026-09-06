import 'server-only';

// Node filesystem access is exposed to route handlers only through this boundary.
export * from '@/lib/storage-core';
