import { Storage } from "@google-cloud/storage";
import { env } from "../config/env";
import path from "path";

export class UploadService {
    private static storage: Storage;
    private static bucketName: string;

    static {
        if (env.GCS_BUCKET_NAME) {
            this.bucketName = env.GCS_BUCKET_NAME;

            // Use explicit credentials if provided, otherwise fallback to Default Credentials
            if (env.GCS_PROJECT_ID && env.GCS_CLIENT_EMAIL && env.GCS_PRIVATE_KEY) {
                this.storage = new Storage({
                    projectId: env.GCS_PROJECT_ID,
                    credentials: {
                        client_email: env.GCS_CLIENT_EMAIL,
                        private_key: env.GCS_PRIVATE_KEY.replace(/\\n/g, "\n"),
                    },
                });
            } else if (env.GCS_PROJECT_ID) {
                // Fallback to ADC (Application Default Credentials)
                this.storage = new Storage({
                    projectId: env.GCS_PROJECT_ID,
                });
            } else {
                this.storage = new Storage();
            }
        }
    }

    static async uploadImage(file: Express.Multer.File, folder: string = "general"): Promise<string> {
        if (!this.storage || !this.bucketName) {
            throw new Error("Google Cloud Storage is not configured");
        }

        const bucket = this.storage.bucket(this.bucketName);
        const uniqueFilename = `${folder}/${Date.now()}-${file.originalname}`;
        const fileUpload = bucket.file(uniqueFilename);

        const stream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype,
            },
        });

        return new Promise((resolve, reject) => {
            stream.on("error", (error) => {
                console.error("Error uploading to GCS:", error);
                reject(error);
            });

            stream.on("finish", async () => {
                // Return the relative path instead of the public URL
                resolve(uniqueFilename);
            });

            stream.end(file.buffer);
        });
    }

    static async uploadDocument(file: Express.Multer.File, folder: string = "documents"): Promise<string> {
        if (!this.storage || !this.bucketName) {
            throw new Error("Google Cloud Storage is not configured");
        }

        const bucket = this.storage.bucket(this.bucketName);
        const uniqueFilename = `${folder}/${Date.now()}-${file.originalname}`;
        const fileUpload = bucket.file(uniqueFilename);

        const stream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype,
            },
        });

        return new Promise((resolve, reject) => {
            stream.on("error", (error) => {
                console.error("Error uploading document to GCS:", error);
                reject(error);
            });

            stream.on("finish", async () => {
                resolve(uniqueFilename);
            });

            stream.end(file.buffer);
        });
    }

    static async getSignedUrl(filename: string, expiresInMinutes: number = 60): Promise<string> {
        if (!this.storage || !this.bucketName) {
            throw new Error("Google Cloud Storage is not configured");
        }

        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(filename);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiresInMinutes * 60 * 1000,
        });

        return url;
    }
}
