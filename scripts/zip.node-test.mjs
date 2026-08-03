import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';

import { crc32, createZip } from './zip.mjs';

test('creates a deterministic deflated ZIP with a folder entry path', () => {
  const entries = [
    { name: 'project-weave/main.js', data: Buffer.from('plugin code') },
    { name: 'project-weave/manifest.json', data: Buffer.from('{}') },
  ];
  const first = createZip(entries);
  const second = createZip([...entries].reverse());

  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
  assert.ok(first.includes(Buffer.from('project-weave/main.js')));
  assert.equal(readFirstEntry(first).toString('utf8'), 'plugin code');
});

test('computes the standard CRC-32 value and rejects unsafe names', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.throws(() =>
    createZip([{ name: '../escape.txt', data: Buffer.from('no') }]),
  );
  assert.throws(() =>
    createZip([
      { name: 'same.txt', data: Buffer.from('one') },
      { name: 'same.txt', data: Buffer.from('two') },
    ]),
  );
});

function readFirstEntry(archive) {
  const compressedSize = archive.readUInt32LE(18);
  const nameLength = archive.readUInt16LE(26);
  const extraLength = archive.readUInt16LE(28);
  const dataStart = 30 + nameLength + extraLength;
  return inflateRawSync(
    archive.subarray(dataStart, dataStart + compressedSize),
  );
}
