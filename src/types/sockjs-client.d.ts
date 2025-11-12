// src/types/sockjs-client.d.ts
declare module 'sockjs-client' {
  class SockJS {
    constructor(url: string, protocols?: string | string[], options?: any);
    onopen: (event: Event) => void;
    onmessage: (event: MessageEvent) => void;
    onclose: (event: CloseEvent) => void;
    onerror: (event: Event) => void;
    send(data: string | ArrayBuffer | Blob): void;
    close(code?: number, reason?: string): void;
  }
  export = SockJS;
}