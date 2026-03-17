import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class S3Service {
  private readonly client?: S3Client
  private readonly bucket?: string
  private readonly enabled: boolean

  constructor() {
    const region = process.env.AWS_REGION
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const bucket = process.env.AWS_S3_BUCKET

    const available = !!region && !!accessKeyId && !!secretAccessKey && !!bucket
    this.enabled = available

    if (!available) {
      return
    }

    this.bucket = bucket
    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  async createPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 60 * 5,
  ) {
    if (!this.enabled || !this.client || !this.bucket) {
      throw new InternalServerErrorException(
        'Cannot generate presigned URL because AWS S3 configuration is missing',
      )
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    })

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    return { url, key }
  }
}
