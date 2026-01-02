import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Innertube } from 'youtubei.js';

let ytPromise: Promise<Innertube> | null = null;

const getClient = () => {
  if (!ytPromise) {
    ytPromise = Innertube.create({});
  }
  return ytPromise;
};

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:v=|\/v\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
};

const parseCaptionEvents = (events: any[]): string => {
  if (!events || !Array.isArray(events)) return '';
  return events
    .map((event) => {
      if (!event?.segs) return '';
      return event.segs.map((s: any) => s.utf8 || '').join('').trim();
    })
    .filter(Boolean)
    .join('\n');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const url = (req.body as any)?.url as string;
    if (!url || !url.trim()) {
      res.status(400).send('URL이 필요합니다.');
      return;
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      res.status(400).send('올바른 유튜브 URL이 아닙니다.');
      return;
    }

    const yt = await getClient();
    const info = await yt.getInfo(videoId);
    const tracks = info?.captions?.tracks;

    if (!tracks || tracks.length === 0) {
      res.status(404).send('이 영상에는 사용 가능한 대본(자막)이 없습니다.');
      return;
    }

    // 한국어 우선, 없으면 기본 자막
    const preferred =
      tracks.find((t: any) => (t.language_code || '').startsWith('ko')) || tracks[0];

    const captionRes = await yt.session.http.fetch(preferred.url);
    if (!captionRes.ok) {
      res.status(502).send('자막을 불러오는 데 실패했습니다.');
      return;
    }
    const captionJson = await captionRes.json();
    const transcriptText = parseCaptionEvents(captionJson?.events || []);

    if (!transcriptText.trim()) {
      res.status(404).send('자막을 읽을 수 없습니다.');
      return;
    }

    res.status(200).json({ text: transcriptText });
  } catch (error: any) {
    console.error('[fetch-transcript] error:', error);
    res
      .status(500)
      .send(error?.message || '대본을 불러오는 중 오류가 발생했습니다.');
  }
}
