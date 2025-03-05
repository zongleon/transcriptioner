import express from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const app = express();
const port = 3000;

// S3 client (automatically uses IAM role if running on EC2)
const s3 = new S3Client({ region: "us-east-1" });

app.get("/get-signed-url", async (req, res) => {
  try {
    const { file } = req.query;
    if (!file) {
      return res.status(400).json({ error: "Missing fileName" });
    }
    console.log(file);

    const command = new GetObjectCommand({
      Bucket: "zulu-clause-embedding",
      Key: file,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 }); // URL valid for 60s

    res.json({ signedUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));