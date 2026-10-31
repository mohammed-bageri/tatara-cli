import type { DeliverConsumer } from "@tatara/notifications";
import { consumers } from "#modules/notifications/services/notifier";

/** Stores one user's notification and sends it on each channel, once each. */
const deliver: DeliverConsumer = consumers[1];
export default deliver;
