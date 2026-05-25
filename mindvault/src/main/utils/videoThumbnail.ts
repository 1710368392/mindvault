// @ts-nocheck

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const repo = require('../db/repository');

let ffmpegPath = null;
let ffmpegChecked = false;

const VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'];

function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

function checkFfmpeg() {
  return new Promise((resolve) => {
    if (ffmpegChecked) {
      resolve(ffmpegPath);
      return;
    }

    ffmpegChecked = true;

    try {
      const staticPath = require('ffmpeg-static');
      if (staticPath && fs.existsSync(staticPath)) {
        ffmpegPath = staticPath;
        console.log('[videoThumbnail] 使用内置 ffmpeg:', ffmpegPath);
        resolve(ffmpegPath);
        return;
      }
    } catch (e) {
      console.log('[videoThumbnail] ffmpeg-static 不可用:', e.message);
    }

    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, ['ffmpeg'], (err) => {
      if (!err) {
        ffmpegPath = 'ffmpeg';
        console.log('[videoThumbnail] 使用系统 PATH 中的 ffmpeg');
      } else {
        ffmpegPath = null;
        console.log('[videoThumbnail] ffmpeg 不可用，跳过缩略图生成');
      }
      resolve(ffmpegPath);
    });
  });
}

function getThumbnailsDir() {
  const dir = path.join(repo.mediaDir, 'thumbnails');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function extractThumbnail(videoPath) {
  return new Promise(async (resolve) => {
    if (!isVideoFile(videoPath)) {
      resolve(null);
      return;
    }

    const ffmpeg = await checkFfmpeg();
    if (!ffmpeg) {
      resolve(null);
      return;
    }

    if (!fs.existsSync(videoPath)) {
      console.log('[videoThumbnail] 视频文件不存在:', videoPath);
      resolve(null);
      return;
    }

    const thumbDir = getThumbnailsDir();
    const videoBasename = path.basename(videoPath, path.extname(videoPath));
    const thumbFilename = `thumb_${videoBasename}.jpg`;
    const thumbPath = path.join(thumbDir, thumbFilename);

    if (fs.existsSync(thumbPath)) {
      resolve(thumbPath);
      return;
    }

    const args = [
    '-i', videoPath,
    '-ss', '00:00:00',
    '-frames:v', '1',
    '-q:v', '2',
    '-vf', 'scale=min(1440\,iw):-1',
    '-y',
    thumbPath,
  ];

    execFile(ffmpeg, args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[videoThumbnail] ffmpeg 提取缩略图失败:', err.message);
        resolve(null);
        return;
      }
      if (!fs.existsSync(thumbPath) || fs.statSync(thumbPath).size === 0) {
        console.error('[videoThumbnail] 缩略图文件未生成或为空');
        resolve(null);
        return;
      }
      console.log('[videoThumbnail] 缩略图已生成:', thumbPath);
      resolve(thumbPath);
    });
  });
}

module.exports = { extractThumbnail, isVideoFile, checkFfmpeg, getThumbnailsDir };
