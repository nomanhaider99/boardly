import Pusher from "pusher";
export { boardChannel, CARDS_UPDATED, type CardsUpdatedPayload } from "@/lib/pusher-shared";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});
