// Client-side safe fetch helper with JSON validation
export async function safeJsonFetch(url: string, options?: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) {
    try { const data = await res.json(); throw new Error(data.error || `Request failed: ${res.status}`); }
    catch { throw new Error(`Request failed: ${res.status} ${res.statusText}`); }
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Server returned a non-JSON response');
  return res.json();
}
