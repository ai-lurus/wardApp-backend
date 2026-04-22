import * as dotenv from "dotenv";
import path from "path";
import { envSchema } from "../../config/envSchema";

dotenv.config({ path: path.resolve(__dirname, "../../../.env.test") });

export const env = envSchema.parse(process.env);
