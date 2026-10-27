// Error reports from edge functions (SPEC decision 71).
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

Sentry.init(sentryOptions);
