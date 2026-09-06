import assert from 'node:assert/strict';

type Node = { id: string; parentId: string | null };
function assertNoCycle(nodes: Node[], movedId: string, parentId: string | null) { let cursor = parentId; while (cursor) { assert.notEqual(cursor, movedId, 'folder cycle'); cursor = nodes.find((node) => node.id === cursor)?.parentId ?? null; } }
function importIdentity(source: string, relativePath: string) { return `${source}\0${relativePath}`; }

assert.notEqual(importIdentity('legacy-2026', '2024/a.xlsx'), importIdentity('legacy-2026', '2025/a.xlsx'));
assert.equal(importIdentity('legacy-2026', '2024/a.xlsx'), importIdentity('legacy-2026', '2024/a.xlsx'));
assertNoCycle([{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }], 'a', null);
assert.throws(() => assertNoCycle([{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }], 'a', 'b'));
console.log('Folder/import identity verification passed.');
