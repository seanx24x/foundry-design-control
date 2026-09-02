import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = process.env.FOUNDRY_MOTION_SOURCE ?? path.resolve(scriptRoot, '..');
const outputRoot = process.env.FOUNDRY_MOTION_OUTPUT ?? scriptRoot;

const stories = [
  { id: 'navigate', number: '01', title: 'Navigate the running product' },
  { id: 'layout', number: '02', title: 'Refine layout directly' },
  { id: 'review', number: '03', title: 'Review the complete batch' },
  { id: 'apply', number: '04', title: 'Apply, rebuild, and verify' },
];
const themes = ['light', 'dark'];
const outputs = [];

await Promise.all([
  mkdir(path.join(outputRoot, 'final'), { recursive: true }),
  mkdir(path.join(outputRoot, 'posters'), { recursive: true }),
]);

for (const story of stories) {
  for (const theme of themes) {
    const suffix = theme === 'dark' ? 'Dark' : 'Light';
    const input = path.join(sourceRoot, 'raw', `${story.id}-${theme}-4000x2500.mp4`);
    const videoName = `FD_ui_${story.number}_${suffix}.mp4`;
    const posterName = `FD_ui_${story.number}_${suffix}.jpg`;
    const video = path.join(outputRoot, 'final', videoName);
    const poster = path.join(outputRoot, 'posters', posterName);

    await run('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', input,
      '-vf', 'scale=1920:1200:flags=lanczos:in_range=full:out_range=tv,format=yuv420p',
      '-an', '-r', '60', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-color_range', 'tv',
      '-movflags', '+faststart', video,
    ], { maxBuffer: 32 * 1024 * 1024 });

    await run('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-ss', '14.2', '-i', video,
      '-frames:v', '1', '-q:v', '2', poster,
    ]);

    outputs.push({
      story: story.id,
      title: story.title,
      theme,
      video: `final/${videoName}`,
      poster: `posters/${posterName}`,
      width: 1920,
      height: 1200,
      fps: 60,
      audio: false,
    });
    console.log(`Composed ${story.id} ${theme}`);
  }
}

await writeFile(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify({ format: 'ui-only', outputs }, null, 2)}\n`,
);
