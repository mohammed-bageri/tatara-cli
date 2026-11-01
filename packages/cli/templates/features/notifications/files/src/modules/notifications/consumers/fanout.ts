import type { FanoutConsumer } from "@tatara/notifications";
import { consumers } from "#modules/notifications/services/notifier";

/** Resolves a notification's recipients and queues one delivery per user. */
const fanout: FanoutConsumer = consumers[0];
export default fanout;
