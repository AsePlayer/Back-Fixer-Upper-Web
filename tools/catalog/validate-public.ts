import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash } from './generate';
import { validateManifest, validateIndex, validateDetails } from '../../src/catalog/validation.js';
export async function validatePublicDirectory(directory: string) {
  const manifest = validateManifest(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')));
  const resource = async (item: any) => {
    const bytes = await readFile(join(directory,item.path));
    if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error(`Integrity failed: ${item.path}`);
    return JSON.parse(bytes.toString());
  };
  const index = validateIndex(await resource(manifest.index), manifest);
  const videos=[];
  for (let i=0;i<manifest.chunks.length;i++) videos.push(...validateDetails(await resource(manifest.chunks[i]), manifest, i, index));
  if(hash(JSON.stringify({schemaVersion:1,classifierVersion:manifest.classifierVersion,creators:manifest.creators,videos}))!==manifest.revision)throw new Error('Content-derived catalog revision mismatch.');
  return manifest;
}
