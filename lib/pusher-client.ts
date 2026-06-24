import PusherJs from "pusher-js";

let instance: PusherJs | null = null;

export function getPusherClient(): PusherJs {
  if (!instance) {
    instance = new PusherJs(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return instance;
}
