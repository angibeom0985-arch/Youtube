const extractVideoId = (url: string): string | null => {
  // Handle full YouTube URLs and shorts
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

export interface TranscriptResponse {
  text: string;
}

export const fetchTranscript = async (url: string): Promise<TranscriptResponse> => {
  const videoId = extractVideoId(url.trim());
  if (!videoId) {
    throw new Error("올바른 유튜브 URL이 아닙니다.");
  }

  const response = await fetch("/api/fetch-transcript", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "대본을 불러오지 못했습니다.");
  }

  const data = (await response.json()) as TranscriptResponse;
  if (!data.text || !data.text.trim()) {
    throw new Error("사용 가능한 대본이 없습니다.");
  }

  return data;
};
