import { useEffect, useRef } from 'react';

export default function useRealtimeChannel(url, onMessage) {
  const cbRef = useRef(onMessage);

  useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) return undefined;

    const source = new EventSource(url);

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        cbRef.current?.(parsed);
      } catch {
        cbRef.current?.(event.data);
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [url]);
}
