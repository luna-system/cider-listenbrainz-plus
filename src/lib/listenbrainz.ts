export type ListenPayload = {
  track_metadata: {
    artist_name: string;
    track_name: string;
    release_name?: string;
    additional_info?: Record<string, unknown>;
  };
  listened_at?: number; // unix timestamp seconds; required for "single"/"import", omitted for "playing_now"
};

type ListenType = "single" | "import" | "playing_now";

export async function submitListens(
  token: string,
  payload: {
    listen_type?: ListenType;
    payload: ListenPayload[];
  }
) {
  const body = {
    listen_type: payload.listen_type ?? "single",
    payload: payload.payload,
  };

  const res = await fetch("https://api.listenbrainz.org/1/submit-listens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ListenBrainz error ${res.status}: ${text}`);
  }
  return res.json();
}
